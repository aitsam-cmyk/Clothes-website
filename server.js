require('dotenv').config(); // Load env vars
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
let pgUrlInUse = process.env.DATABASE_URL || null;

function altPgUrl(u) {
    try {
        const parsed = new URL(u);
        if (parsed.hostname.includes('-pooler.')) {
            const altHost = parsed.hostname.replace('-pooler.', '.');
            parsed.hostname = altHost;
            return parsed.toString();
        }
    } catch {}
    return null;
}

async function ensurePgPool() {
    if (!usePg) return;
    const { Pool } = require('pg');
    const candidates = [pgUrlInUse].concat(altPgUrl(pgUrlInUse) ? [altPgUrl(pgUrlInUse)] : []);
    for (const url of candidates) {
        try {
            pgPool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, keepAlive: true, connectionTimeoutMillis: 8000 });
            await pgPool.query('SELECT 1');
            pgUrlInUse = url;
            return true;
        } catch (e) {
            pgPool = null;
        }
    }
    return false;
}

if (usePg) {
    (async () => { await ensurePgPool(); })();
    function initPg() {
        const queries = [
            "CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT 'customer')",
            "CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, price NUMERIC(10,2) NOT NULL, description TEXT, category TEXT, image_url TEXT)",
            "CREATE TABLE IF NOT EXISTS product_images (id SERIAL PRIMARY KEY, product_id INTEGER REFERENCES products(id) ON DELETE CASCADE, url TEXT)",
            "CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, user_email TEXT NOT NULL, total_amount NUMERIC(10,2) NOT NULL, status TEXT DEFAULT 'Pending', created_at TIMESTAMP DEFAULT NOW(), customer_name TEXT, address TEXT, contact_number TEXT, pieces_count INTEGER, color_preferences TEXT, screenshot_url TEXT)",
            "CREATE TABLE IF NOT EXISTS order_items (id SERIAL PRIMARY KEY, order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE, product_id INTEGER REFERENCES products(id), quantity INTEGER, price_at_time NUMERIC(10,2))",
            "CREATE TABLE IF NOT EXISTS payments (id SERIAL PRIMARY KEY, order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE, method TEXT, status TEXT DEFAULT 'Pending', paid_amount NUMERIC(10,2), transaction_id TEXT, payer_email TEXT, created_at TIMESTAMP DEFAULT NOW())",
            "CREATE TABLE IF NOT EXISTS reviews (id SERIAL PRIMARY KEY, product_id INTEGER REFERENCES products(id) ON DELETE SET NULL, user_name TEXT, rating INTEGER, comment TEXT, status TEXT DEFAULT 'Approved', created_at TIMESTAMP DEFAULT NOW())",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS address TEXT",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS contact_number TEXT",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS pieces_count INTEGER",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS color_preferences TEXT",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS screenshot_url TEXT",
            "INSERT INTO users (name, email, password, role) VALUES ('Admin1', 'zellburyofficial3@gmail.com', 'farnaz90', 'admin') ON CONFLICT (email) DO NOTHING",
            "INSERT INTO users (name, email, password, role) VALUES ('Admin2', 'jasimkhan5917@gmail.com', '@Jasimkhan5917', 'admin') ON CONFLICT (email) DO NOTHING",
            "INSERT INTO users (name, email, password, role) VALUES ('Admin3', 'admin@store.com', 'admin123', 'admin') ON CONFLICT (email) DO NOTHING"
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
    if (usePg && pgPool) {
        pgPool.query("SELECT id, password FROM users").then(res => {
            res.rows.forEach(row => {
                if (row.password && !row.password.startsWith('pbkdf2$')) {
                    const hashed = hashPassword(row.password);
                    pgPool.query("UPDATE users SET password = $1 WHERE id = $2", [hashed, row.id]);
                }
            });
        }).catch(() => {});
    } else if (db) {
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
setTimeout(migratePasswords, 2000);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// API Routes
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

async function notifyOwnerEmail(orderId, info) {
    try {
        let admins = [];
        if (usePg) {
            const r = await pgPool.query("SELECT email FROM users WHERE role = 'admin'");
            admins = r.rows.map(x => x.email);
        } else {
            await new Promise((resolve) => {
                db.all("SELECT email FROM users WHERE role = 'admin'", [], (err, rows) => {
                    admins = (rows || []).map(x => x.email);
                    resolve();
                });
            });
        }
        const toList = (process.env.OWNER_EMAIL || '').split(',').filter(Boolean);
        const recipients = toList.length ? toList : admins;
        if (!recipients.length) return;
        let nodemailer;
        try {
            nodemailer = require('nodemailer');
        } catch {
            return;
        }
        const host = process.env.SMTP_HOST || 'smtp.gmail.com';
        const port = parseInt(process.env.SMTP_PORT || '587', 10);
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        if (!user || !pass) return;
        const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
        const subject = `New Order #${orderId}`;
        const text = `Order ID: ${orderId}
Email: ${info.email}
Name: ${info.customerName || '-'}
Contact: ${info.contactNumber || '-'}
Address: ${info.address || '-'}
Pieces: ${info.piecesCount || '-'}
Colors: ${info.colorPreferences || '-'}
Total: ${info.total}
Payment Method: ${info.method}`;
        await transport.sendMail({ from: user, to: recipients.join(','), subject, text });
    } catch {}
}

app.get('/api/products', (req, res) => {
    const sql = "SELECT * FROM products";
    const base = `${req.protocol}://${req.get('host')}`;
    if (usePg) {
        Promise.all([
            pgPool.query(sql),
            pgPool.query("SELECT product_id, url FROM product_images")
        ]).then(([pr, ir]) => {
            const imgMap = {};
            ir.rows.forEach(row => {
                if (!imgMap[row.product_id]) imgMap[row.product_id] = [];
                imgMap[row.product_id].push(row.url);
            });
            const products = pr.rows.map(p => {
                const imgs = imgMap[p.id] || [];
                const list = p.image_url ? [p.image_url, ...imgs] : imgs;
                const absList = list.map(u => u && u.startsWith('/') ? (base + u) : u).filter(Boolean);
                return { ...p, images: absList.length ? absList : [base + '/placeholder.svg'] };
            });
            res.json(products);
        }).catch(err => res.status(500).json({ error: err.message }));
    } else {
        db.all(sql, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            db.all("SELECT product_id, url FROM product_images", [], (e2, imgs) => {
                if (e2) return res.status(500).json({ error: e2.message });
                const map = {};
                imgs.forEach(r => {
                    if (!map[r.product_id]) map[r.product_id] = [];
                    map[r.product_id].push(r.url);
                });
                const products = rows.map(p => {
                    const list = (map[p.id] || []);
                    if (p.image_url) list.unshift(p.image_url);
                    const absList = list.map(u => u && u.startsWith('/') ? (base + u) : u).filter(Boolean);
                    return { ...p, images: absList.length ? absList : [base + '/placeholder.svg'] };
                });
                res.json(products);
            });
        });
    }
});

app.post('/api/products', upload.array('images'), (req, res) => {
    const { name, price, desc, image_url } = req.body;
    const files = req.files;
    let imageUrl = image_url || 'https://via.placeholder.com/400';
    
    if (Array.isArray(files) && files.length > 0) {
        imageUrl = '/uploads/' + files[0].filename;
    }

    if (usePg) {
        const sql = "INSERT INTO products (name, price, description, category, image_url) VALUES ($1, $2, $3, 'suits', $4) RETURNING id";
        pgPool.query(sql, [name, price, desc, imageUrl]).then(async r => {
            const id = r.rows[0].id;
            if (Array.isArray(files) && files.length > 0) {
                for (const file of files) {
                    const url = '/uploads/' + file.filename;
                    await pgPool.query("INSERT INTO product_images (product_id, url) VALUES ($1, $2)", [id, url]);
                }
            }
            res.json({ success: true, id });
        }).catch(err => res.status(500).json({ error: err.message }));
    } else {
        db.run("INSERT INTO products (name, price, description, category, image_url) VALUES (?, ?, ?, 'suits', ?)", [name, price, desc, imageUrl], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const id = this.lastID;
            if (Array.isArray(files) && files.length > 0) {
                const stmt = db.prepare("INSERT INTO product_images (product_id, url) VALUES (?, ?)");
                files.forEach(file => {
                    stmt.run(id, '/uploads/' + file.filename);
                });
                stmt.finalize();
            }
            res.json({ success: true, id });
        });
    }
});

app.put('/api/products/:id', upload.array('images'), (req, res) => {
    const { name, price, desc, image_url } = req.body;
    const id = req.params.id;
    const files = req.files;
    const hasFiles = Array.isArray(files) && files.length > 0;

    if (usePg) {
        let sql = "UPDATE products SET name = $1, price = $2, description = $3 WHERE id = $4";
        let params = [name, price, desc, id];
        if (hasFiles || image_url) {
            const img = hasFiles ? ('/uploads/' + files[0].filename) : image_url;
            sql = "UPDATE products SET name = $1, price = $2, description = $3, image_url = $4 WHERE id = $5";
            params = [name, price, desc, img, id];
        }
        pgPool.query(sql, params).then(async () => {
            if (Array.isArray(files) && files.length > 1) {
                for (let i = 1; i < files.length; i++) {
                    await pgPool.query("INSERT INTO product_images (product_id, url) VALUES ($1, $2)", [id, '/uploads/' + files[i].filename]);
                }
            }
            res.json({ success: true });
        }).catch(err => res.status(500).json({ error: err.message }));
    } else {
        let sql = "UPDATE products SET name = ?, price = ?, description = ? WHERE id = ?";
        let params = [name, price, desc, id];
        if (hasFiles) {
            const imageUrl = '/uploads/' + files[0].filename;
            sql = "UPDATE products SET name = ?, price = ?, description = ?, image_url = ? WHERE id = ?";
            params = [name, price, desc, imageUrl, id];
        }
        db.run(sql, params, function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (Array.isArray(files) && files.length > 1) {
                const stmt = db.prepare("INSERT INTO product_images (product_id, url) VALUES (?, ?)");
                for (let i = 1; i < files.length; i++) {
                    stmt.run(id, '/uploads/' + files[i].filename);
                }
                stmt.finalize();
            }
            res.json({ success: true });
        });
    }
});

app.delete('/api/products/:id', (req, res) => {
    const id = req.params.id;
    if (usePg) {
        (async () => {
            const client = await pgPool.connect();
            try {
                await client.query("BEGIN");
                const chk = await client.query("SELECT COUNT(*) AS cnt FROM order_items WHERE product_id = $1", [id]);
                const cnt = parseInt(chk.rows[0].cnt, 10) || 0;
                if (cnt > 0) {
                    await client.query("ROLLBACK");
                    return res.status(400).json({ error: "Cannot delete product with existing order items" });
                }
                await client.query("DELETE FROM product_images WHERE product_id = $1", [id]);
                await client.query("DELETE FROM products WHERE id = $1", [id]);
                await client.query("COMMIT");
                res.json({ success: true });
            } catch (err) {
                await client.query("ROLLBACK");
                res.status(500).json({ error: err.message });
            } finally {
                client.release();
            }
        })();
    } else {
        db.get("SELECT COUNT(*) AS cnt FROM order_items WHERE product_id = ?", [id], (e, row) => {
            if (e) return res.status(500).json({ error: e.message });
            const cnt = (row && row.cnt) || 0;
            if (cnt > 0) {
                return res.status(400).json({ error: "Cannot delete product with existing order items" });
            }
            db.serialize(() => {
                db.run("BEGIN");
                db.run("DELETE FROM product_images WHERE product_id = ?", [id]);
                db.run("DELETE FROM products WHERE id = ?", [id], function(err) {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: err.message });
                    }
                    db.run("COMMIT");
                    res.json({ success: true });
                });
            });
        });
    }
});

app.get('/api/orders', (req, res) => {
    const sql = "SELECT o.*, oi.product_id, p.name as product_name, oi.quantity, pay.method as payment_method FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id LEFT JOIN products p ON oi.product_id = p.id LEFT JOIN payments pay ON pay.order_id = o.id";
    if (usePg) {
        pgPool.query(sql).then(r => {
            const ordersMap = {};
            r.rows.forEach(row => {
                if (!ordersMap[row.id]) {
                    ordersMap[row.id] = { 
                        id: row.id, 
                        email: row.user_email, 
                        total: row.total_amount, 
                        date: row.created_at, 
                        status: row.status, 
                        customer_name: row.customer_name,
                        address: row.address,
                        contact_number: row.contact_number,
                        pieces_count: row.pieces_count,
                        color_preferences: row.color_preferences,
                        screenshot_url: row.screenshot_url,
                        method: row.payment_method,
                        items: [] 
                    };
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
                    ordersMap[row.id] = { 
                        id: row.id, 
                        email: row.user_email, 
                        total: row.total_amount, 
                        date: row.created_at, 
                        status: row.status, 
                        customer_name: row.customer_name,
                        address: row.address,
                        contact_number: row.contact_number,
                        pieces_count: row.pieces_count,
                        color_preferences: row.color_preferences,
                        screenshot_url: row.screenshot_url,
                        method: row.payment_method,
                        items: [] 
                    };
                }
                if (row.product_id) {
                    ordersMap[row.id].items.push({ name: row.product_name, qty: row.quantity });
                }
            });
            res.json(Object.values(ordersMap));
        });
    }
});

app.post('/api/orders', upload.single('screenshot'), async (req, res) => {
    const isMultipart = !!req.file || (req.headers['content-type'] || '').includes('multipart/form-data');
    const body = req.body || {};
    const email = body.email;
    const items = body.items ? (isMultipart ? JSON.parse(body.items) : body.items) : [];
    const total = body.total;
    const method = body.method;
    const customerName = body.customerName || body.name || null;
    const address = body.address || null;
    const contactNumber = body.contactNumber || null;
    const piecesCount = body.piecesCount ? parseInt(body.piecesCount, 10) : null;
    const colorPreferences = body.colorPreferences || null;
    const screenshotUrl = req.file ? ('/uploads/' + req.file.filename) : null;
    if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ error: 'Email is required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Items are required' });
    }
    const safeItems = items.map(it => ({
        id: Number(it.id),
        qty: Number(it.qty),
        price: Number(it.price)
    })).filter(it => it.id && it.qty && it.price >= 0);
    if (safeItems.length === 0) {
        return res.status(400).json({ error: 'Invalid items' });
    }
    const safeTotal = Number(total);
    const payMethod = (method && typeof method === 'string') ? method : 'Unknown';
    if (usePg) {
        const client = await pgPool.connect();
        try {
            await client.query("BEGIN");
            const r = await client.query("INSERT INTO orders (user_email, total_amount, customer_name, address, contact_number, pieces_count, color_preferences, screenshot_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id", [email.trim(), safeTotal, customerName, address, contactNumber, piecesCount, colorPreferences, screenshotUrl]);
            const orderId = r.rows[0].id;
            for (const item of safeItems) {
                await client.query("INSERT INTO order_items (order_id, product_id, quantity, price_at_time) VALUES ($1, $2, $3, $4)", [orderId, item.id, item.qty, item.price]);
            }
            await client.query("INSERT INTO payments (order_id, method, status, paid_amount, payer_email) VALUES ($1, $2, 'Pending', $3, $4)", [orderId, payMethod, safeTotal, email.trim()]);
            await client.query("COMMIT");
            notifyOwnerEmail(orderId, { email: email.trim(), customerName, contactNumber, address, piecesCount, colorPreferences, total: safeTotal, method: payMethod }).catch(() => {});
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
            db.run("INSERT INTO orders (user_email, total_amount, customer_name, address, contact_number, pieces_count, color_preferences, screenshot_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [email.trim(), safeTotal, customerName, address, contactNumber, piecesCount, colorPreferences, screenshotUrl], function(err) {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }
                const orderId = this.lastID;
                const stmt = db.prepare("INSERT INTO order_items (order_id, product_id, quantity, price_at_time) VALUES (?, ?, ?, ?)");
                safeItems.forEach(item => {
                    stmt.run(orderId, item.id, item.qty, item.price);
                });
                stmt.finalize();
                db.run("INSERT INTO payments (order_id, method, status, paid_amount, payer_email) VALUES (?, ?, 'Pending', ?, ?)", [orderId, payMethod, safeTotal, email.trim()], function(payErr) {
                    if (payErr) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: payErr.message });
                    }
                    db.run("COMMIT");
                    notifyOwnerEmail(orderId, { email: email.trim(), customerName, contactNumber, address, piecesCount, colorPreferences, total: safeTotal, method: payMethod }).catch(() => {});
                    res.json({ success: true, orderId });
                });
            });
        });
    }
});

app.get('/api/health', async (req, res) => {
    if (usePg) {
        try {
            if (!pgPool) await ensurePgPool();
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
 
// Extra Order Endpoints
app.delete('/api/orders/:id', async (req, res) => {
    const id = req.params.id;
    if (usePg) {
        pgPool.query("DELETE FROM orders WHERE id = $1", [id])
            .then(() => res.json({ success: true }))
            .catch(err => res.status(500).json({ error: err.message }));
    } else {
        db.serialize(() => {
            db.run("BEGIN");
            db.run("DELETE FROM order_items WHERE order_id = ?", [id]);
            db.run("DELETE FROM payments WHERE order_id = ?", [id]);
            db.run("DELETE FROM orders WHERE id = ?", [id], function(err) {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }
                db.run("COMMIT");
                res.json({ success: true });
            });
        });
    }
});

app.put('/api/orders/:id/status', (req, res) => {
    const id = req.params.id;
    const status = (req.body && req.body.status) || null;
    if (!status) return res.status(400).json({ error: 'Missing status' });
    if (usePg) {
        pgPool.query("UPDATE orders SET status = $1 WHERE id = $2", [status, id])
            .then(() => res.json({ success: true }))
            .catch(err => res.status(500).json({ error: err.message }));
    } else {
        db.run("UPDATE orders SET status = ? WHERE id = ?", [status, id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    }
});

app.post('/api/reviews', (req, res) => {
    const { productId, name, rating, comment } = req.body || {};
    if (!productId || !name || !rating) return res.status(400).json({ error: 'Missing fields' });
    if (usePg) {
        pgPool.query("INSERT INTO reviews (product_id, user_name, rating, comment, status) VALUES ($1, $2, $3, $4, 'Approved')", [productId, name, rating, comment || ''])
            .then(() => res.json({ success: true }))
            .catch(err => res.status(500).json({ error: err.message }));
    } else {
        db.run("INSERT INTO reviews (product_id, user_name, rating, comment, status) VALUES (?, ?, ?, ?, 'Approved')", [productId, name, rating, comment || ''], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    }
});

app.get('/api/reviews/:productId', (req, res) => {
    const pid = req.params.productId;
    if (usePg) {
        pgPool.query("SELECT id, user_name, rating, comment, created_at FROM reviews WHERE product_id = $1 AND status = 'Approved' ORDER BY created_at DESC", [pid])
            .then(r => res.json(r.rows))
            .catch(err => res.status(500).json({ error: err.message }));
    } else {
        db.all("SELECT id, user_name, rating, comment, created_at FROM reviews WHERE product_id = ? AND status = 'Approved' ORDER BY created_at DESC", [pid], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        });
    }
});
