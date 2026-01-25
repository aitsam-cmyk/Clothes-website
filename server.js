const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(uploadDir));

function hashPassword(pw) {
    const salt = crypto.randomBytes(16).toString('hex');
    const iterations = 100000;
    const hash = crypto.pbkdf2Sync(pw, salt, iterations, 64, 'sha512').toString('hex');
    return `pbkdf2$${iterations}$${salt}$${hash}`;
}

function verifyPassword(pw, stored) {
    if (!stored || !stored.startsWith('pbkdf2$')) return pw === stored;
    const parts = stored.split('$');
    const iterations = parseInt(parts[1], 10);
    const salt = parts[2];
    const hash = parts[3];
    const calc = crypto.pbkdf2Sync(pw, salt, iterations, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(calc, 'hex'));
}

function migratePasswords() {
    db.all("SELECT id, password FROM users", [], (err, rows) => {
        if (err || !rows) return;
        rows.forEach(row => {
            if (row.password && !row.password.startsWith('pbkdf2$')) {
                const hashed = hashPassword(row.password);
                db.run("UPDATE users SET password = ? WHERE id = ?", [hashed, row.id]);
            }
        });
    });
}

migratePasswords();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(401).json({ success: false, message: 'Invalid credentials' });
        const ok = verifyPassword(password, row.password);
        if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });
        res.json({ success: true, user: { name: row.name, email: row.email, role: row.role } });
    });
});

app.post('/api/signup', (req, res) => {
    const { name, email, password } = req.body;
    const hashed = hashPassword(password);
    db.run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'customer')", [name, email, hashed], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email already exists' });
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const products = rows.map(p => ({ ...p, images: [p.image_url] }));
        res.json(products);
    });
});

app.post('/api/products', upload.array('images'), (req, res) => {
    const { name, price, desc } = req.body;
    let imageUrl = 'https://via.placeholder.com/400';
    if (req.files && req.files.length > 0) {
        imageUrl = '/uploads/' + req.files[0].filename;
    }
    db.run("INSERT INTO products (name, price, description, category, image_url) VALUES (?, ?, ?, 'suits', ?)", [name, price, desc, imageUrl], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

app.put('/api/products/:id', upload.array('images'), (req, res) => {
    const { name, price, desc } = req.body;
    const id = req.params.id;
    let sql = "UPDATE products SET name = ?, price = ?, description = ? WHERE id = ?";
    let params = [name, price, desc, id];
    if (req.files && req.files.length > 0) {
        const imageUrl = '/uploads/' + req.files[0].filename;
        sql = "UPDATE products SET name = ?, price = ?, description = ?, image_url = ? WHERE id = ?";
        params = [name, price, desc, imageUrl, id];
    }
    db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/products/:id', (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM products WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.get('/api/orders', (req, res) => {
    const sql = "SELECT o.*, oi.product_id, p.name as product_name, oi.quantity FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id LEFT JOIN products p ON oi.product_id = p.id";
    db.all(sql, [], (err, rawRows) => {
        if (err) return res.status(500).json({ error: err.message });
        const ordersMap = {};
        rawRows.forEach(row => {
            if (!ordersMap[row.id]) {
                ordersMap[row.id] = { id: row.id, email: row.user_email, total: row.total_amount, date: row.created_at, status: row.status, items: [] };
            }
            if (row.product_id) {
                ordersMap[row.id].items.push({ name: row.product_name, qty: row.quantity });
            }
        });
        res.json(Object.values(ordersMap));
    });
});

app.post('/api/orders', (req, res) => {
    const { email, items, total } = req.body;
    db.serialize(() => {
        db.run("BEGIN");
        db.run("INSERT INTO orders (user_email, total_amount) VALUES (?, ?)", [email, total], function(err) {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: err.message });
            }
            const orderId = this.lastID;
            const stmt = db.prepare("INSERT INTO order_items (order_id, product_id, quantity, price_at_time) VALUES (?, ?, ?, ?)");
            items.forEach(item => {
                stmt.run(orderId, item.id, item.qty, item.price);
            });
            stmt.finalize();
            db.run("COMMIT");
            res.json({ success: true, orderId });
        });
    });
});

app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
