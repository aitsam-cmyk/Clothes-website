-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'customer' -- 'admin' or 'customer'
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    description TEXT,
    category TEXT,
    image_url TEXT
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Order Items Table (to normalize data)
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    price_at_time REAL,
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
);

-- Insert Default Admin (Password should be hashed in production, keeping plain for demo consistency)
INSERT OR IGNORE INTO users (name, email, password, role) VALUES 
('Admin1', 'zellburyofficial3@gmail.com', 'farnaz90', 'admin'),
('Admin2', 'jasimkhan5917@gmail.com', '@Jasimkhan5917', 'admin'),
('Admin3', 'admin@store.com', 'admin123', 'admin');

-- Insert Initial Products
INSERT OR IGNORE INTO products (name, price, description, category, image_url) VALUES 
('Ladies Suit 1', 5100, 'Beautiful suit for ladies', 'suits', 'https://via.placeholder.com/400?text=Suit+1'),
('Ladies Suit 2', 5200, 'Beautiful suit for ladies', 'suits', 'https://via.placeholder.com/400?text=Suit+2'),
('Ladies Suit 3', 5300, 'Beautiful suit for ladies', 'suits', 'https://via.placeholder.com/400?text=Suit+3'),
('Ladies Suit 4', 5400, 'Beautiful suit for ladies', 'suits', 'https://via.placeholder.com/400?text=Suit+4');
