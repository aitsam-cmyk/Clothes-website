-- Users Table (Postgres)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'customer'
);

-- Products Table (Postgres)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    price NUMERIC(10,2) NOT NULL,
    description TEXT,
    category TEXT,
    image_url TEXT
);

-- Orders Table (Postgres)
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_email TEXT NOT NULL,
    total_amount NUMERIC(10,2) NOT NULL,
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Order Items Table (to normalize data) (Postgres)
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER,
    price_at_time NUMERIC(10,2)
);

-- Insert Default Admins (Postgres)
INSERT INTO users (name, email, password, role) VALUES 
('Admin1', 'zellburyofficial3@gmail.com', 'farnaz90', 'admin'),
('Admin2', 'jasimkhan5917@gmail.com', '@Jasimkhan5917', 'admin'),
('Admin3', 'admin@store.com', 'admin123', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Insert Initial Products (Postgres)
INSERT INTO products (name, price, description, category, image_url) VALUES 
('Ladies Suit 1', 5100, 'Beautiful suit for ladies', 'suits', '/placeholder.svg'),
('Ladies Suit 2', 5200, 'Beautiful suit for ladies', 'suits', '/placeholder.svg'),
('Ladies Suit 3', 5300, 'Beautiful suit for ladies', 'suits', '/placeholder.svg'),
('Ladies Suit 4', 5400, 'Beautiful suit for ladies', 'suits', '/placeholder.svg')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    method TEXT,
    status TEXT DEFAULT 'Pending',
    paid_amount NUMERIC(10,2),
    transaction_id TEXT,
    payer_email TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
