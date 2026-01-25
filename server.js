const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve frontend files from root
app.use('/uploads', express.static(uploadDir));

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ================= API ROUTES =================

// --- Auth ---
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            res.json({ success: true, user: { name: row.name, email: row.email, role: row.role } });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    });
});

app.post('/api/signup', (req, res) => {
    const { name, email, password } = req.body;
    db.run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'customer')", [name, email, password], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, message: 'Signup successful' });
    });
});

// --- Products ---
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // Transform rows to match frontend structure (images array)
        const products = rows.map(p => ({
            ...p,
            images: [p.image_url] // Backend stores single URL for simplicity, frontend expects array
        }));
        res.json(products);
    });
});

app.post('/api/products', upload.array('images'), (req, res) => {
    const { name, price, desc } = req.body;
    const files = req.files;
    let imageUrl = 'https://via.placeholder.com/400';
    if (files && files.length > 0) {
        imageUrl = '/uploads/' + files[0].filename;
    }

    db.run("INSERT INTO products (name, price, description, category, image_url) VALUES (?, ?, ?, 'suits', ?)",
        [name, price, desc, imageUrl],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

app.put('/api/products/:id', upload.array('images'), (req, res) => {
    const { name, price, desc } = req.body;
    const id = req.params.id;
    const files = req.files;

    let sql = "UPDATE products SET name = ?, price = ?, description = ? WHERE id = ?";
    let params = [name, price, desc, id];

    if (files && files.length > 0) {
        const imageUrl = '/uploads/' + files[0].filename;
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

// --- Orders ---
app.get('/api/orders', (req, res) => {
    db.all("SELECT * FROM orders ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // For dashboard, we need items too. This is a simplified version.
        // A real app would join tables.
        // For now, let's just return orders. Frontend expects 'items' array.
        // We'll fetch items for each order? That's N+1.
        // Let's just do a JOIN.
        const sql = `
            SELECT o.*, oi.product_id, p.name as product_name, oi.quantity 
            FROM orders o 
            LEFT JOIN order_items oi ON o.id = oi.order_id 
            LEFT JOIN products p ON oi.product_id = p.id
        `;
        db.all(sql, [], (err, rawRows) => {
             if (err) return res.status(500).json({ error: err.message });
             
             // Group by order
             const ordersMap = {};
             rawRows.forEach(row => {
                 if (!ordersMap[row.id]) {
                     ordersMap[row.id] = {
                         id: row.id,
                         email: row.user_email,
                         total: row.total_amount,
                         date: row.created_at,
                         status: row.status,
                         items: []
                     };
                 }
                 if (row.product_id) {
                     ordersMap[row.id].items.push({
                         name: row.product_name,
                         qty: row.quantity
                     });
                 }
             });
             
             res.json(Object.values(ordersMap));
        });
    });
});

app.post('/api/orders', (req, res) => {
    const { email, items, total } = req.body;
    
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
