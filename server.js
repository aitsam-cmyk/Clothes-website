const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
function isValidPgUrl(u) {
    if (!u) return false;
    try {
        const parsed = new URL(u);
        const proto = parsed.protocol.replace(':', '');
        const schemeOk = proto === 'postgres' || proto === 'postgresql';
        const hostOk = !!parsed.hostname && parsed.hostname !== 'base';
        return schemeOk && hostOk;
    } catch {
        return false;
    }
}
const usePg = isValidPgUrl(process.env.DATABASE_URL);
let db = null;
let pgPool = null;

if (usePg) {
    const { Pool } = require('pg');
    pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    function initPg() {
        const queries = [
            "CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT 'customer')",
            "CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, price NUMERIC(10,2) NOT NULL, description TEXT, category TEXT, image_url TEXT)",
            "CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, user_email TEXT NOT NULL, total_amount NUMERIC(10,2) NOT NULL, status TEXT DEFAULT 'Pending', created_at TIMESTAMP DEFAULT NOW())",
            "CREATE TABLE IF NOT EXISTS order_items (id SERIAL PRIMARY KEY, order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE, product_id INTEGER REFERENCES products(id), quantity INTEGER, price_at_time NUMERIC(10,2))",
            "CREATE TABLE IF NOT EXISTS payments (id SERIAL PRIMARY KEY, order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE, method TEXT, status TEXT DEFAULT 'Pending', paid_amount NUMERIC(10,2), transaction_id TEXT, payer_email TEXT, created_at TIMESTAMP DEFAULT NOW())",
            "INSERT INTO users (name, email, password, role) VALUES ('Admin1', 'zellburyofficial3@gmail.com', 'farnaz90', 'admin') ON CONFLICT (email) DO NOTHING",
            "INSERT INTO users (name, email, password, role) VALUES ('Admin2', 'jasimkhan5917@gmail.com', '@Jasimkhan5917', 'admin') ON CONFLICT (email) DO NOTHING",
            "INSERT INTO users (name, email, password, role) VALUES ('Admin3', 'admin@store.com', 'admin123', 'admin') ON CONFLICT (email) DO NOTHING",
            "INSERT INTO products (name, price, description, category, image_url) VALUES ('Ladies Suit 1', 5100, 'Beautiful suit for ladies', 'suits', '/placeholder.svg') ON CONFLICT (name) DO NOTHING",
            "INSERT INTO products (name, price, description, category, image_url) VALUES ('Ladies Suit 2', 5200, 'Beautiful suit for ladies', 'suits', '/placeholder.svg') ON CONFLICT (name) DO NOTHING",
            "INSERT INTO products (name, price, description, category, image_url) VALUES ('Ladies Suit 3', 5300, 'Beautiful suit for ladies', 'suits', '/placeholder.svg') ON CONFLICT (name) DO NOTHING",
            "INSERT INTO products (name, price, description, category, image_url) VALUES ('Ladies Suit 4', 5400, 'Beautiful suit for ladies', 'suits', '/placeholder.svg') ON CONFLICT (name) DO NOTHING"
        ];
        queries.reduce((p, sql) => p.then(() => pgPool.query(sql)), Promise.resolve()).catch(() => {});
    }
    initPg();
} else {
    db = require('./database');
}

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
    if (usePg) {
        pgPool.query("SELECT id, password FROM users").then(res => {
            res.rows.forEach(row => {
                if (row.password && !row.password.startsWith('pbkdf2$')) {
                    const hashed = hashPassword(row.password);
                    pgPool.query("UPDATE users SET password = $1 WHERE id = $2", [hashed, row.id]);
                }
            });
        }).catch(() => {});
    } else {
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
}

migratePasswords();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

if (!usePg) {
    db.run(`CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        method TEXT,
        status TEXT DEFAULT 'Pending',
        paid_amount REAL,
        transaction_id TEXT,
        payer_email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
}
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (usePg) {
        pgPool.query("SELECT * FROM users WHERE email = $1", [email])
            .then(r => {
                const row = r.rows[0];
                if (!row) return res.status(401).json({ success: false, message: 'Invalid credentials' });
                const ok = verifyPassword(password, row.password);
                if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });
                res.json({ success: true, user: { name: row.name, email: row.email, role: row.role } });
            })
            .catch(err => res.status(500).json({ error: err.message }));
    } else {
        db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(401).json({ success: false, message: 'Invalid credentials' });
            const ok = verifyPassword(password, row.password);
            if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });
            res.json({ success: true, user: { name: row.name, email: row.email, role: row.role } });
        });
    }
});

app.post('/api/signup', (req, res) => {
    const { name, email, password } = req.body;
    const hashed = hashPassword(password);
    if (usePg) {
        pgPool.query("INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'customer')", [name, email, hashed])
            .then(() => res.json({ success: true }))
            .catch(err => {
                if ((err.message || '').includes('duplicate')) return res.status(400).json({ error: 'Email already exists' });
                return res.status(500).json({ error: err.message });
            });
    } else {
        db.run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'customer')", [name, email, hashed], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email already exists' });
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true });
        });
    }
});

app.get('/api/products', (req, res) => {
    const sql = "SELECT * FROM products";
    if (usePg) {
        pgPool.query(sql).then(r => {
            const products = r.rows.map(p => ({ ...p, images: [p.image_url] }));
            res.json(products);
        }).catch(err => res.status(500).json({ error: err.message }));
    } else {
        db.all(sql, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            const products = rows.map(p => ({ ...p, images: [p.image_url] }));
            res.json(products);
        });
    }
});

app.post('/api/products', upload.array('images'), (req, res) => {
    const { name, price, desc, image_url } = req.body;
    let imageUrl = image_url || 'https://via.placeholder.com/400';
    if (req.files && req.files.length > 0) {
        imageUrl = '/uploads/' + req.files[0].filename;
    }
    if (usePg) {
        const sql = "INSERT INTO products (name, price, description, category, image_url) VALUES ($1, $2, $3, 'suits', $4) RETURNING id";
        pgPool.query(sql, [name, price, desc, imageUrl]).then(r => {
            res.json({ success: true, id: r.rows[0].id });
        }).catch(err => res.status(500).json({ error: err.message }));
    } else {
        db.run("INSERT INTO products (name, price, description, category, image_url) VALUES (?, ?, ?, 'suits', ?)", [name, price, desc, imageUrl], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        });
    }
});

app.put('/api/products/:id', upload.array('images'), (req, res) => {
    const { name, price, desc, image_url } = req.body;
    const id = req.params.id;
    if (usePg) {
        let sql = "UPDATE products SET name = $1, price = $2, description = $3 WHERE id = $4";
        let params = [name, price, desc, id];
        if ((req.files && req.files.length > 0) || image_url) {
            const img = (req.files && req.files.length > 0) ? ('/uploads/' + req.files[0].filename) : image_url;
            sql = "UPDATE products SET name = $1, price = $2, description = $3, image_url = $4 WHERE id = $5";
            params = [name, price, desc, img, id];
        }
        pgPool.query(sql, params).then(() => res.json({ success: true })).catch(err => res.status(500).json({ error: err.message }));
    } else {
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
    }
});

app.delete('/api/products/:id', (req, res) => {
    const id = req.params.id;
    if (usePg) {
        pgPool.query("DELETE FROM products WHERE id = $1", [id]).then(() => res.json({ success: true })).catch(err => res.status(500).json({ error: err.message }));
    } else {
        db.run("DELETE FROM products WHERE id = ?", [id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    }
});

app.get('/api/orders', (req, res) => {
    const sql = "SELECT o.*, oi.product_id, p.name as product_name, oi.quantity FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id LEFT JOIN products p ON oi.product_id = p.id";
    if (usePg) {
        pgPool.query(sql).then(r => {
            const ordersMap = {};
            r.rows.forEach(row => {
                if (!ordersMap[row.id]) {
                    ordersMap[row.id] = { id: row.id, email: row.user_email, total: row.total_amount, date: row.created_at, status: row.status, items: [] };
                }
                if (row.product_id) {
                    ordersMap[row.id].items.push({ name: row.product_name, qty: row.quantity });
                }
            });
            res.json(Object.values(ordersMap));
        }).catch(err => res.status(500).json({ error: err.message }));
    } else {
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
    }
});

app.post('/api/orders', async (req, res) => {
    const { email, items, total, method } = req.body;
    if (usePg) {
        const client = await pgPool.connect();
        try {
            await client.query("BEGIN");
            const r = await client.query("INSERT INTO orders (user_email, total_amount) VALUES ($1, $2) RETURNING id", [email, total]);
            const orderId = r.rows[0].id;
            for (const item of items) {
                await client.query("INSERT INTO order_items (order_id, product_id, quantity, price_at_time) VALUES ($1, $2, $3, $4)", [orderId, item.id, item.qty, item.price]);
            }
            await client.query("INSERT INTO payments (order_id, method, status, paid_amount, payer_email) VALUES ($1, $2, 'Pending', $3, $4)", [orderId, method || 'Unknown', total, email]);
            await client.query("COMMIT");
            res.json({ success: true, orderId });
        } catch (err) {
            await client.query("ROLLBACK");
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    } else {
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
                db.run("INSERT INTO payments (order_id, method, status, paid_amount, payer_email) VALUES (?, ?, 'Pending', ?, ?)", [orderId, method || 'Unknown', total, email], function(payErr) {
                    if (payErr) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: payErr.message });
                    }
                    db.run("COMMIT");
                    res.json({ success: true, orderId });
                });
            });
        });
    }
});

app.get('/api/payments', (req, res) => {
    const sql = "SELECT p.*, o.user_email as order_user, o.total_amount as order_total FROM payments p LEFT JOIN orders o ON p.order_id = o.id ORDER BY p.created_at DESC";
    if (usePg) {
        pgPool.query(sql).then(r => res.json(r.rows)).catch(err => res.status(500).json({ error: err.message }));
    } else {
        db.all(sql, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    }
});

app.get('/api/health', async (req, res) => {
    if (usePg) {
        try {
            const r = await pgPool.query('SELECT 1 as ok');
            return res.json({ db: 'postgres', ok: !!(r.rows && r.rows[0] && r.rows[0].ok) });
        } catch (e) {
            return res.status(500).json({ db: 'postgres', error: e.message });
        }
    } else {
        db.get('SELECT 1 as ok', [], (err, row) => {
            if (err) return res.status(500).json({ db: 'sqlite', error: err.message });
            res.json({ db: 'sqlite', ok: !!(row && row.ok) });
        });
    }
});

app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
