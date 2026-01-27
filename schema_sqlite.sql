-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'customer'
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    price REAL NOT NULL,
    description TEXT,
    category TEXT,
    image_url TEXT
);

-- Product Images (multiple images per product)
CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    url TEXT,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    customer_name TEXT,
    address TEXT,
    contact_number TEXT,
    pieces_count INTEGER,
    color_preferences TEXT,
    screenshot_url TEXT
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    price_at_time REAL,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id)
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    method TEXT,
    status TEXT DEFAULT 'Pending',
    paid_amount REAL,
    transaction_id TEXT,
    payer_email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    user_name TEXT,
    rating INTEGER,
    comment TEXT,
    status TEXT DEFAULT 'Approved',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- Insert Default Admins
INSERT OR IGNORE INTO users (name, email, password, role) VALUES 
('Admin1', 'zellburyofficial3@gmail.com', 'farnaz90', 'admin'),
('Admin2', 'jasimkhan5917@gmail.com', '@Jasimkhan5917', 'admin'),
('Admin3', 'admin@store.com', 'admin123', 'admin');

-- Insert Initial Products
INSERT OR IGNORE INTO products (name, price, description, category, image_url) VALUES 
('Ladies Suit 1', 5100, 'Beautiful suit for ladies', 'suits', '/placeholder.svg'),
('Ladies Suit 2', 5200, 'Beautiful suit for ladies', 'suits', '/placeholder.svg'),
('Ladies Suit 3', 5300, 'Beautiful suit for ladies', 'suits', '/placeholder.svg'),
('Ladies Suit 4', 5400, 'Beautiful suit for ladies', 'suits', '/placeholder.svg');
