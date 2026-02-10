-- 1. Users Table (Customer aur Admin ke liye)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'customer' -- 'admin' ya 'customer'
);

-- 2. Products Table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    price REAL NOT NULL,
    description TEXT,
    category TEXT,
    image_url TEXT DEFAULT '/placeholder.svg'
);

-- 3. Product Images (Ek product ki multiple images ke liye)
CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    url TEXT,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 4. Orders Table (Checkout details store karne ke liye)
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'Pending', -- 'Pending', 'Received', 'Cancelled'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    customer_name TEXT,
    address TEXT,
    contact_number TEXT,
    pieces_count INTEGER,
    color_preferences TEXT,
    screenshot_url TEXT -- JazzCash/Bank transfer proof ke liye
);

-- 5. Order Items Table (Kis order mein kya saaman tha)
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    price_at_time REAL,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id)
);

-- 6. Reviews Table (Customer Feedback ke liye)
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    user_name TEXT,
    rating INTEGER CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    status TEXT DEFAULT 'Approved',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- 7. Insert Default Admins (Agar pehle se nahi hain)
INSERT OR IGNORE INTO users (name, email, password, role) VALUES 
('Admin1', 'zellburyofficial3@gmail.com', 'farnaz90', 'admin'),
('Admin2', 'jasimkhan5917@gmail.com', '@Jasimkhan5917', 'admin'),
('Admin3', 'admin@store.com', 'admin123', 'admin');

-- 8. Insert Initial Products (Initial testing ke liye)
INSERT OR IGNORE INTO products (name, price, description, category, image_url) VALUES 
('Ladies Suit 1', 5100, 'Premium quality ladies suit', 'suits', '/placeholder.svg'),
('Ladies Suit 2', 5200, 'Stylish design for events', 'suits', '/placeholder.svg'),
('Ladies Suit 3', 5300, 'Comfortable summer wear', 'suits', '/placeholder.svg');