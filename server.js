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
    } catch { }
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
            "INSERT INTO users (name, email, password, role) VALUES ('Admin1', 'zellburyofficial3@gmail.com', 'farnaz90', 'admin') ON CONFLICT (email) DO NOTHING",
            "INSERT INTO users (name, email, password, role) VALUES ('Admin2', 'jasimkhan5917@gmail.com', '@Jasimkhan5917', 'admin') ON CONFLICT (email) DO NOTHING",
            "INSERT INTO users (name, email, password, role) VALUES ('Admin3', 'admin@store.com', 'admin123', 'admin') ON CONFLICT (email) DO NOTHING"
        ];
        queries.reduce((p, sql) => p.then(() => pgPool.query(sql)), Promise.resolve()).catch(() => { });
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

// Helper to fix image URLs
function getFullUrl(req, relativePath) {
    if (!relativePath) return null;
    if (relativePath.startsWith('http')) return relativePath;
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    return `${protocol}://${host}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
}

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

app.get('/api/products', (req, res) => {
    const sql = "SELECT * FROM products";
    if (usePg) {
        Promise.all([
            pgPool.query(sql),
            pgPool.query("SELECT product_id, url FROM product_images")
        ]).then(([pr, ir]) => {
            const imgMap = {};
            ir.rows.forEach(row => {
                if (!imgMap[row.product_id]) imgMap[row.product_id] = [];
                imgMap[row.product_id].push(getFullUrl(req, row.url));
            });
            const products = pr.rows.map(p => {
                const imgs = imgMap[p.id] || [];
                const mainImg = getFullUrl(req, p.image_url) || getFullUrl(req, '/placeholder.svg');
                return { ...p, image_url: mainImg, images: [mainImg, ...imgs] };
            });
            res.json(products);
        }).catch(err => res.status(500).json({ error: err.message }));
    } else {
        db.all(sql, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            db.all("SELECT product_id, url FROM product_images", [], (e2, imgs) => {
                const map = {};
                if (imgs) imgs.forEach(r => {
                    if (!map[r.product_id]) map[r.product_id] = [];
                    map[r.product_id].push(getFullUrl(req, r.url));
                });
                const products = rows.map(p => {
                    const mainImg = getFullUrl(req, p.image_url) || getFullUrl(req, '/placeholder.svg');
                    const imgs = map[p.id] || [];
                    return { ...p, image_url: mainImg, images: [mainImg, ...imgs] };
                });
                res.json(products);
            });
        });
    }
});

app.post('/api/products', upload.array('images'), (req, res) => {
    const { name, price, desc } = req.body;
    const files = req.files;
    let imageUrl = '/placeholder.svg';
    
    // @ts-ignore
    if (files && files.length > 0) {
        imageUrl = '/uploads/' + files[0].filename;
    }

    if (usePg) {
        pgPool.query("INSERT INTO products (name, price, description, category, image_url) VALUES ($1, $2, $3, 'suits', $4) RETURNING id", [name, price, desc, imageUrl])
        .then(async r => {
            const id = r.rows[0].id;
            // @ts-ignore
            if (files && files.length > 1) {
                // @ts-ignore
                for (let i = 1; i < files.length; i++) {
                    await pgPool.query("INSERT INTO product_images (product_id, url) VALUES ($1, $2)", [id, '/uploads/' + files[i].filename]);
                }
            }
            res.json({ success: true, id });
        }).catch(err => res.status(500).json({ error: err.message }));
    } else {
        db.run("INSERT INTO products (name, price, description, category, image_url) VALUES (?, ?, ?, 'suits', ?)", [name, price, desc, imageUrl], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const id = this.lastID;
            // @ts-ignore
            if (files && files.length > 1) {
                const stmt = db.prepare("INSERT INTO product_images (product_id, url) VALUES (?, ?)");
                // @ts-ignore
                for (let i = 1; i < files.length; i++) {
                    stmt.run(id, '/uploads/' + files[i].filename);
                }
                stmt.finalize();
            }
            res.json({ success: true, id });
        });
    }
});

app.post('/api/orders', upload.single('screenshot'), async (req, res) => {
    const body = req.body || {};
    const email = body.email;
    const items = body.items ? (typeof body.items === 'string' ? JSON.parse(body.items) : body.items) : [];
    const screenshotUrl = req.file ? ('/uploads/' + req.file.filename) : null;

    if (!email) return res.status(400).json({ error: 'Email is required' });

    if (usePg) {
        const client = await pgPool.connect();
        try {
            await client.query("BEGIN");
            const result = await client.query("INSERT INTO orders (email, items, screenshot_url) VALUES ($1, $2, $3) RETURNING id", [email, JSON.stringify(items), screenshotUrl]);
            const id = result.rows[0].id;
            await client.query("COMMIT");
            res.json({ success: true, id });
        } catch (err) {
            await client.query("ROLLBACK");
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    } else {
        db.run("INSERT INTO orders (email, items, screenshot_url) VALUES (?, ?, ?)", [email, JSON.stringify(items), screenshotUrl], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const id = this.lastID;
            res.json({ success: true, id });
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});