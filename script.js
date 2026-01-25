// ===== Configuration =====
const DEFAULT_API = '/api';
const API_URL = localStorage.getItem('API_URL') || DEFAULT_API;

// ===== Fetch Data =====
async function fetchProducts() {
    try {
        const res = await fetch(`${API_URL}/products`);
        if (!res.ok) throw new Error('Failed to fetch products');
        const data = await res.json();
        
        // MySQL data ko frontend structure ke liye map karna
        products = data.map(p => ({
            ...p,
            images: p.image_url ? [p.image_url] : ['https://via.placeholder.com/400'],
            desc: p.description // database mein 'description' column hai
        }));

        renderProducts(products);
    } catch (err) {
        console.error("Products load nahi ho sakay:", err);
        products = [];
        renderProducts(products);
    }
}

// ===== Order Logic Update =====
async function placeOrder() {
    if (cart.length === 0) {
        alert('Cart is empty!');
        return;
    }
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    
    if (!user) {
        alert('Please login to place an order.');
        showSection('login');
        return;
    }
    
    const total = cart.reduce((sum, c) => sum + (c.price * c.qty), 0);
    const orderData = {
        email: user.email,
        items: cart.map(item => ({ id: item.id, qty: item.qty, price: item.price })), // Clean data structure
        total: total
    };

    try {
        const res = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        const data = await res.json();
        
        if (data.success) {
            cart = [];
            renderCart();
            alert('Order placed successfully! Your order has been saved.');
            goHome();
        } else {
            alert('Failed to place order: ' + data.error);
        }
    } catch (err) {
        console.error(err);
        alert('Server se rabta nahi ho saka.');
    }
}
