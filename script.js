// ===== Configuration =====
const LOCAL_API = 'http://localhost:3000/api';
const REMOTE_API = 'https://aitsam916-clothes-backend.hf.space/api'; // Update this with your new Hugging Face URL if it changes
const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? LOCAL_API : REMOTE_API;

let products = [];
let cart = [];
let revealObserver = null;
let selectedPaymentMethod = null;
const PAYMENT_DETAILS = {
    JazzCash: { title: 'JazzCash', account: '0300-1215152', name: 'Account Owner' },
    'Credit/Debit Card': { title: 'Bank Transfer', account: '000123456789', bank: 'ABC Bank', name: 'Account Owner' },
    'Cash on Delivery': { title: 'Cash on Delivery', account: '', name: 'Pay at Doorstep' }
};
try {
    const override = localStorage.getItem('PAYMENT_INFO');
    if (override) {
        const obj = JSON.parse(override);
        Object.assign(PAYMENT_DETAILS, obj);
    }
} catch {}

document.addEventListener('DOMContentLoaded', () => {
    initRevealObserver();
    fetchProducts();
    updateUI();
    showSection('home');
});

// ===== Section Switching =====
function showSection(id) {
    const sections = document.querySelectorAll('section');
    sections.forEach(s => {
        if (s instanceof HTMLElement) {
            s.style.display = 'none';
            s.classList.remove('active');
        }
    });

    const target = document.getElementById(id);
    if (target) {
        target.style.display = 'block';
        setTimeout(() => {
            target.classList.add('active');
        }, 50);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== Dropdown Menu Logic =====
function toggleDropdown() {
    const dropdown = document.getElementById('dropdownMenu');
    if (dropdown instanceof HTMLElement) {
        dropdown.classList.toggle('show');
    }
}

// Close dropdown when clicking outside (Fixed Style Error)
window.onclick = function(event) {
    if (!event.target.closest('.menu')) {
        const dropdowns = document.getElementsByClassName("dropdown");
        for (let i = 0; i < dropdowns.length; i++) {
            const openDropdown = dropdowns[i];
            if (openDropdown instanceof HTMLElement) {
                openDropdown.classList.remove('show');
            }
        }
    }
}

// ===== Cart Logic =====
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.qty++;
    } else {
        cart.push({
            id: product.id,
            name: product.name || 'Suit',
            price: product.price,
            qty: 1,
            image: product.image_url
        });
    }
    
    renderCart();
    // alert('Item added to cart!'); // Optional: comment out to avoid alert spam
}

function renderCart() {
    const container = document.getElementById('cartItems');
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#aaa;">Your cart is empty.</p>';
        return;
    }

    let total = 0;
    container.innerHTML = cart.map(item => {
        total += item.price * item.qty;
        return `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.name}">
            <div>
                <h4>${item.name}</h4>
                <p>Rs. ${item.price} x ${item.qty}</p>
            </div>
            <button onclick="removeFromCart(${item.id})" style="background:red; padding:5px 10px;">Remove</button>
        </div>
        `;
    }).join('');
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    renderCart();
}

function showCart() {
    showSection('cart');
}

function showWishlist() {
    showSection('wishlist');
}

function goHome() {
    showSection('home');
}

// ===== Auth Logic =====
async function login() {
    const emailInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginPass');

    if (emailInput instanceof HTMLInputElement && passInput instanceof HTMLInputElement) {
        const email = emailInput.value;
        const pass = passInput.value;

        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: pass })
            });
            const data = await res.json();

            if (data.success) {
                localStorage.setItem('user', JSON.stringify(data.user));
                // Clear login fields after successful login
                emailInput.value = '';
                passInput.value = '';
                updateUI();
                toggleDropdown();
                showSection('home');
                alert('Welcome back, ' + data.user.name);
            } else {
                alert('Login Failed: ' + (data.error || data.message || 'Unknown error'));
            }
        } catch (err) {
            alert('Server error. Please try again.');
        }
    }
}

async function signup() {
    const nameEl = document.getElementById('signupName');
    const emailEl = document.getElementById('signupEmail');
    const passEl = document.getElementById('signupPass');

    if (nameEl instanceof HTMLInputElement && emailEl instanceof HTMLInputElement && passEl instanceof HTMLInputElement) {
        const name = nameEl.value.trim();
        const email = emailEl.value.trim();
        const password = passEl.value;
        if (!name || !email || !password) {
            alert('Please fill all fields');
            return;
        }
        try {
            const res = await fetch(`${API_URL}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const data = await res.json();
            if (data.success) {
                alert('Signup successful. Please login.');
                showSection('login');
            } else {
                alert(data.error || 'Signup failed');
            }
        } catch (e) {
            alert('Server error. Try again later.');
        }
    }
}

function logout() {
    localStorage.removeItem('user');
    const emailField = document.getElementById('loginEmail');
    const passField = document.getElementById('loginPass');

    if (emailField instanceof HTMLInputElement) emailField.value = '';
    if (passField instanceof HTMLInputElement) passField.value = '';

    updateUI();
    toggleDropdown();
    showSection('home');
    alert('Logged out successfully');
}

// ===== UI Updates =====
function updateUI() {
    const userStr = localStorage.getItem('user');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const btnAdmin = document.getElementById('btnAdminDashboard');

    if (userStr) {
        const user = JSON.parse(userStr);
        if (loginBtn instanceof HTMLElement) loginBtn.style.display = 'none';
        if (logoutBtn instanceof HTMLElement) logoutBtn.style.display = 'block';
        
        document.querySelectorAll('[id^="btn"]').forEach(btn => {
            if (btn instanceof HTMLElement) {
                btn.style.display = user.role === 'admin' ? 'flex' : 'none';
            }
        });
    } else {
        if (loginBtn instanceof HTMLElement) loginBtn.style.display = 'block';
        if (logoutBtn instanceof HTMLElement) logoutBtn.style.display = 'none';
        document.querySelectorAll('[id^="btn"]').forEach(btn => {
            if (btn instanceof HTMLElement) {
                btn.style.display = 'none';
            }
        });
    }
}

// ===== Fetch & Render =====
async function fetchProducts() {
    try {
        const res = await fetch(`${API_URL}/products`);
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        const arr = Array.isArray(data) ? data : [];
        products = arr.map(p => ({
            ...p,
            image_url: p.image_url || 'placeholder.svg'
        }));
        renderProducts(products);
    } catch (err) {
        products = [
            { id: 1, name: 'Ladies Suit 1', price: 5100, image_url: 'placeholder.svg' },
            { id: 2, name: 'Ladies Suit 2', price: 5200, image_url: 'placeholder.svg' },
            { id: 3, name: 'Ladies Suit 3', price: 5300, image_url: 'placeholder.svg' }
        ];
        renderProducts(products);
    }
}

function renderProducts(items) {
    const container = document.getElementById('products');
    if (!container) return;

    container.innerHTML = items.map(p => `
        <div class="card reveal">
            <img src="${(Array.isArray(p.images) && p.images[0]) || p.image_url}" alt="${p.name}" loading="lazy" decoding="async" />
            <h3>${p.name}</h3>
            <p>Rs. ${p.price}</p>
            <button onclick="addToCart(${p.id})">Add to Cart</button>
            <button onclick="addToWishlist(${p.id})">Add to Wishlist</button>
            <button class="quick-view-btn" onclick="showDetail(${p.id})">View</button>
        </div>
    `).join('');
    setupReveal();
}

// ===== Filter =====
function filterProducts() {
    const inputEl = document.getElementById('searchInput');
    const selectEl = document.getElementById('categoryFilter');

    // Safe check for inputs
    let term = "";
    let category = "all";

    if (inputEl instanceof HTMLInputElement) term = inputEl.value.toLowerCase();
    if (selectEl instanceof HTMLSelectElement) category = selectEl.value;
    
    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(term);
        // Add category logic if needed, currently defaults to true for all
        const matchesCategory = true; 
        return matchesSearch && matchesCategory;
    });
    
    renderProducts(filtered);
}

function initRevealObserver() {
    revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });
    setupReveal();
}

function setupReveal() {
    document.querySelectorAll('.reveal').forEach(el => {
        if (revealObserver) revealObserver.observe(el);
    });
}
function isAdmin() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return false;
    try {
        const user = JSON.parse(userStr);
        return user.role === 'admin';
    } catch {
        return false;
    }
}

function showDetail(id) {
    const suit = products.find(p => p.id === id);
    const detailEl = document.getElementById('detail');
    if (!suit || !detailEl) return;
    const gallery = (Array.isArray(suit.images) ? suit.images : [suit.image_url]).map(url => `<img src="${url}" alt="${suit.name}" style="width:100%; max-width:120px; border-radius:8px; margin-right:8px;"/>`).join('');
    detailEl.innerHTML = `
        <div class="detail-view">
            <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">${gallery}</div>
            <h2 style="margin-top:15px;">${suit.name}</h2>
            <p style="font-size:18px;">Rs. ${suit.price}</p>
            <p style="margin:10px 0; color:#ccc;">${suit.description || 'No description available.'}</p>
            <div style="display:flex; gap:10px; margin-top:15px;">
                <button onclick="addToCart(${suit.id})">Add to Cart</button>
                <button onclick="goHome()" style="background:#555;">Back</button>
            </div>
            <div style="margin-top:20px; background:#222; padding:15px; border-radius:10px;">
                <h3>Customer Reviews</h3>
                <div id="reviewsList"></div>
                <div style="margin-top:10px;">
                    <input id="reviewName" placeholder="Your Name" style="width:100%; margin-bottom:8px;">
                    <input id="reviewRating" type="number" min="1" max="5" placeholder="Rating (1-5)" style="width:100%; margin-bottom:8px;">
                    <textarea id="reviewComment" placeholder="Write a review" style="width:100%; margin-bottom:8px;"></textarea>
                    <button onclick="submitReview(${suit.id})">Submit Review</button>
                </div>
            </div>
        </div>
    `;
    showSection('detail');
    loadReviews(suit.id);
}

async function loadReviews(productId) {
    try {
        const res = await fetch(`${API_URL}/reviews/${productId}`);
        const reviews = await res.json();
        const listEl = document.getElementById('reviewsList');
        if (listEl) {
            listEl.innerHTML = (Array.isArray(reviews) && reviews.length) ? reviews.map(r => `
                <div class="cart-item">
                    <div>
                        <h4>${r.user_name} • ${r.rating}/5</h4>
                        <p>${r.comment || ''}</p>
                    </div>
                </div>
            `).join('') : '<p style="text-align:center; color:#aaa;">No reviews yet</p>';
        }
    } catch {}
}

async function submitReview(productId) {
    const nameEl = document.getElementById('reviewName');
    const ratingEl = document.getElementById('reviewRating');
    const commentEl = document.getElementById('reviewComment');
    if (!(nameEl instanceof HTMLInputElement) || !(ratingEl instanceof HTMLInputElement)) return;
    const name = nameEl.value.trim();
    const rating = parseInt(ratingEl.value, 10);
    const comment = (commentEl instanceof HTMLTextAreaElement ? commentEl.value : '');
    if (!name || isNaN(rating)) {
        alert('Please fill name and rating');
        return;
    }
    try {
        const res = await fetch(`${API_URL}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, name, rating, comment })
        });
        const data = await res.json();
        if (data.success) {
            alert('Thanks for your review!');
            loadReviews(productId);
            nameEl.value = '';
            ratingEl.value = '';
            if (commentEl instanceof HTMLTextAreaElement) commentEl.value = '';
        } else {
            alert(data.error || 'Failed to submit review');
        }
    } catch {
        alert('Server error');
    }
}
async function submitNewSuit() {
    if (!isAdmin()) {
        alert('Admin required');
        return;
    }
    const nameEl = document.getElementById('newSuitName');
    const priceEl = document.getElementById('newSuitPrice');
    const descEl = document.getElementById('newSuitDesc');
    const filesEl = document.getElementById('newSuitImages');
    if (!(nameEl instanceof HTMLInputElement) || !(priceEl instanceof HTMLInputElement) || !(descEl instanceof HTMLInputElement) || !(filesEl instanceof HTMLInputElement)) return;
    const name = nameEl.value.trim();
    const price = parseFloat(priceEl.value);
    const desc = descEl.value.trim();
    if (!name || isNaN(price)) {
        alert('Enter valid name and price');
        return;
    }
    const fd = new FormData();
    fd.append('name', name);
    fd.append('price', String(price));
    fd.append('desc', desc);
    if (filesEl.files && filesEl.files.length > 0) {
        for (let i = 0; i < filesEl.files.length; i++) {
            fd.append('images', filesEl.files[i]);
        }
    }
    try {
        const res = await fetch(`${API_URL}/products`, { method: 'POST', body: fd });
        const data = await res.json();
        if (data.success) {
            alert('Product added');
            nameEl.value = '';
            priceEl.value = '';
            descEl.value = '';
            if (filesEl) filesEl.value = '';
            await fetchProducts();
            showSection('manageSection');
            showManageSection();
        } else {
            alert(data.error || 'Add failed');
        }
    } catch (e) {
        alert('Server error');
    }
}

function showManageSection() {
    if (!isAdmin()) {
        alert('Admin required');
        return;
    }
    const listEl = document.getElementById('manageList');
    if (!listEl) return;
    showSection('manageSection');
    const html = products.map(p => `
        <div class="cart-item">
            <img src="${p.image_url}" alt="${p.name}">
            <div>
                <h4>${p.name}</h4>
                <p>Rs. ${p.price}</p>
            </div>
            <div>
                <button onclick="openEditSuit(${p.id})" style="margin-right:8px;">Edit</button>
                <button onclick="deleteSuit(${p.id})" style="background:red;">Delete</button>
            </div>
        </div>
    `).join('');
    listEl.innerHTML = html || '<p style="text-align:center; color:#aaa;">No products</p>';
}

function openEditSuit(id) {
    if (!isAdmin()) {
        alert('Admin required');
        return;
    }
    const suit = products.find(p => p.id === id);
    const idEl = document.getElementById('editSuitId');
    const nameEl = document.getElementById('editSuitName');
    const priceEl = document.getElementById('editSuitPrice');
    const descEl = document.getElementById('editSuitDesc');
    if (!suit || !(idEl instanceof HTMLInputElement) || !(nameEl instanceof HTMLInputElement) || !(priceEl instanceof HTMLInputElement) || !(descEl instanceof HTMLInputElement)) return;
    idEl.value = String(suit.id);
    nameEl.value = suit.name || '';
    priceEl.value = String(suit.price || '');
    descEl.value = suit.description || '';
    showSection('editSection');
}

async function submitEditSuit() {
    if (!isAdmin()) {
        alert('Admin required');
        return;
    }
    const idEl = document.getElementById('editSuitId');
    const nameEl = document.getElementById('editSuitName');
    const priceEl = document.getElementById('editSuitPrice');
    const descEl = document.getElementById('editSuitDesc');
    const filesEl = document.getElementById('editSuitImages');
    if (!(idEl instanceof HTMLInputElement) || !(nameEl instanceof HTMLInputElement) || !(priceEl instanceof HTMLInputElement) || !(descEl instanceof HTMLInputElement) || !(filesEl instanceof HTMLInputElement)) return;
    const id = idEl.value;
    const name = nameEl.value.trim();
    const price = parseFloat(priceEl.value);
    const desc = descEl.value.trim();
    if (!id || !name || isNaN(price)) {
        alert('Enter valid data');
        return;
    }
    let res;
    try {
        if (filesEl.files && filesEl.files.length > 0) {
            const fd = new FormData();
            fd.append('name', name);
            fd.append('price', String(price));
            fd.append('desc', desc);
            for (let i = 0; i < filesEl.files.length; i++) fd.append('images', filesEl.files[i]);
            res = await fetch(`${API_URL}/products/${id}`, { method: 'PUT', body: fd });
        } else {
            res = await fetch(`${API_URL}/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, price, desc })
            });
        }
        const data = await res.json();
        if (data.success) {
            alert('Updated');
            await fetchProducts();
            showManageSection();
            showSection('manageSection');
        } else {
            alert(data.error || 'Update failed');
        }
    } catch (e) {
        alert('Server error');
    }
}

async function deleteSuit(id) {
    if (!isAdmin()) {
        alert('Admin required');
        return;
    }
    if (!confirm('Delete this product?')) return;
    try {
        const res = await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            alert('Deleted');
            await fetchProducts();
            showManageSection();
        } else {
            alert(data.error || 'Delete failed');
        }
    } catch (e) {
        alert('Server error');
    }
}

async function showAdminDashboard() {
    if (!isAdmin()) {
        alert('Admin required');
        return;
    }
    showSection('adminDashboard');
    const ordersEl = document.getElementById('dashboardOrders');
    const totalOrdersEl = document.getElementById('totalOrders');
    const totalRevenueEl = document.getElementById('totalRevenue');
    try {
        const res = await fetch(`${API_URL}/orders`);
        const orders = await res.json();
        const totalOrders = Array.isArray(orders) ? orders.length : 0;
        let revenue = 0;
        const listHtml = (Array.isArray(orders) ? orders : []).map(o => {
            revenue += Number(o.total) || 0;
            const items = (o.items || []).map(i => `${i.name} x ${i.qty}`).join(', ');
            const details = [
                `Name: ${o.customer_name || '-'}`,
                `Contact: ${o.contact_number || '-'}`,
                `Address: ${o.address || '-'}`,
                `Method: ${o.method || '-'}`,
                `Pieces: ${o.pieces_count ?? '-'}`,
                `Colors: ${o.color_preferences || '-'}`
            ].join(' • ');
            return `<div class="cart-item">
                        <div>
                            <h4>Order #${o.id}</h4>
                            <p>${o.email} • ${new Date(o.date).toLocaleString()}</p>
                            <p>${items}</p>
                            <p>${details}</p>
                            <p>Status: ${o.status}</p>
                        </div>
                        <div>Rs. ${o.total}
                            <div style="margin-top:8px;">
                                <button onclick="markOrderReceived(${o.id})" style="margin-right:8px;">Mark Received</button>
                                <button onclick="deleteOrder(${o.id})" style="background:red;">Delete</button>
                            </div>
                        </div>
                    </div>`;
        }).join('');
        if (ordersEl) ordersEl.innerHTML = listHtml || '<p style="text-align:center; color:#aaa;">No orders</p>';
        if (totalOrdersEl) totalOrdersEl.textContent = String(totalOrders);
        if (totalRevenueEl) totalRevenueEl.textContent = String(revenue);
    } catch (e) {
        if (ordersEl) ordersEl.innerHTML = '<p style="text-align:center; color:#aaa;">Failed to load orders</p>';
    }
}

async function deleteOrder(id) {
    if (!isAdmin()) {
        alert('Admin required');
        return;
    }
    if (!confirm('Delete this order?')) return;
    try {
        const res = await fetch(`${API_URL}/orders/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            alert('Order deleted');
            showAdminDashboard();
        } else {
            alert(data.error || 'Delete failed');
        }
    } catch (e) {
        alert('Server error');
    }
}

async function markOrderReceived(id) {
    if (!isAdmin()) {
        alert('Admin required');
        return;
    }
    try {
        const res = await fetch(`${API_URL}/orders/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Received' })
        });
        const data = await res.json();
        if (data.success) {
            showAdminDashboard();
        } else {
            alert(data.error || 'Update failed');
        }
    } catch (e) {
        alert('Server error');
    }
}

async function placeOrder() {
    if (cart.length === 0) {
        alert('Cart is empty');
        return;
    }
    if (!selectedPaymentMethod || selectedPaymentMethod === 'Unknown') {
        alert('Please select a payment method');
        return;
    }
    const userStr = localStorage.getItem('user');
    const orderEmailEl = document.getElementById('orderEmail');
    let email = (orderEmailEl instanceof HTMLInputElement && orderEmailEl.value) ? orderEmailEl.value.trim() : '';
    if (!email) {
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                email = (user && user.email) ? String(user.email) : '';
            } catch {}
        }
    }
    if (!email) {
        email = prompt('Enter customer email for order') || '';
        email = email.trim();
        if (!email) return;
    }
    const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const items = cart.map(i => ({ id: i.id, qty: i.qty, price: i.price }));
    const nameEl = document.getElementById('orderName');
    const addrEl = document.getElementById('orderAddress');
    const contactEl = document.getElementById('orderContact');
    const piecesEl = document.getElementById('orderPieces');
    const colorsEl = document.getElementById('orderColors');
    const shotEl = document.getElementById('orderScreenshot');
    const customerName = (nameEl instanceof HTMLInputElement ? nameEl.value : '');
    const address = (addrEl instanceof HTMLTextAreaElement ? addrEl.value : '');
    const contact = (contactEl instanceof HTMLInputElement ? contactEl.value : '');
    const pieces = (piecesEl instanceof HTMLInputElement ? piecesEl.value : '');
    const colors = (colorsEl instanceof HTMLInputElement ? colorsEl.value : '');
    if (!customerName || !address || !contact || !pieces || !colors || !email) {
        alert('Please fill all order details');
        return;
    }
    if ((selectedPaymentMethod === 'JazzCash' || selectedPaymentMethod === 'Credit/Debit Card')) {
        if (!(shotEl instanceof HTMLInputElement && shotEl.files && shotEl.files[0])) {
            alert('Transaction screenshot is required for JazzCash/Bank payments');
            return;
        }
    }
    try {
        const fd = new FormData();
        fd.append('email', email);
        fd.append('items', JSON.stringify(items));
        fd.append('total', String(total));
        fd.append('method', selectedPaymentMethod || 'Unknown');
        fd.append('customerName', customerName);
        fd.append('address', address);
        fd.append('contactNumber', contact);
        fd.append('piecesCount', String(pieces || ''));
        fd.append('colorPreferences', colors);
        if (shotEl instanceof HTMLInputElement && shotEl.files && shotEl.files[0]) {
            fd.append('screenshot', shotEl.files[0]);
        }
        const res = await fetch(`${API_URL}/orders`, { method: 'POST', body: fd });
        const data = await res.json();
        if (data.success) {
            alert(`Order placed successfully! ID: ${data.orderId}\n\nFor any queries, contact Owner:\nMobile: 0300-1215152\nEmail: zellburyofficial3@gmail.com`);
            cart = [];
            renderCart();
            showSection('home');
        } else {
            alert(data.error || 'Order failed');
        }
    } catch (e) {
        alert('Server error');
    }
}

function pay(el, method) {
    const btns = document.querySelectorAll('.payment-buttons button');
    btns.forEach(b => b.classList.remove('active'));
    if (el instanceof HTMLElement) el.classList.add('active');
    selectedPaymentMethod = method;
    const infoEl = document.getElementById('paymentInfo');
    if (!infoEl) return;
    const d = PAYMENT_DETAILS[method] || {};
    let html = '';
    if (method === 'Easypaisa' || method === 'JazzCash') {
        html = `<strong>${d.title || method}</strong><br>Account: ${d.account || '-'}<br>Name: ${d.name || '-'}`;
    } else {
        html = `<strong>${d.title || method}</strong><br>Account: ${d.account || '-'}<br>Bank: ${d.bank || '-'}<br>Name: ${d.name || '-'}`;
    }
    infoEl.style.display = 'block';
    infoEl.innerHTML = html;
}

let wishlist = [];

function addToWishlist(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const exists = wishlist.find(w => w.id === productId);
    if (exists) return;
    wishlist.push({ id: product.id, name: product.name, price: product.price, image: product.image_url });
    renderWishlist();
}

function renderWishlist() {
    const container = document.getElementById('wishlistItems');
    if (!container) return;
    if (wishlist.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#aaa;">Wishlist empty</p>';
        return;
    }
    container.innerHTML = wishlist.map(item => `
        <div class="wishlist-item">
            <img src="${item.image}" alt="${item.name}">
            <div>
                <h4>${item.name}</h4>
                <p>Rs. ${item.price}</p>
            </div>
            <div>
                <button onclick="addToCart(${item.id})">Add to Cart</button>
            </div>
        </div>
    `).join('');
}

function subscribeNewsletter() {
    const emailEl = document.getElementById('newsletterEmail');
    if (!(emailEl instanceof HTMLInputElement)) return;
    const email = emailEl.value.trim();
    if (!email) {
        alert('Enter email');
        return;
    }
    alert('Subscribed: ' + email);
    emailEl.value = '';
}
