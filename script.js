// ===== Configuration =====
const API_URL = '/api';

// ===== Data Initialization =====
/**
 * @typedef {Object} Product
 * @property {number} id
 * @property {string} name
 * @property {number} price
 * @property {string} desc
 * @property {string} category
 * @property {string[]} images
 */

/**
 * @typedef {Object} CartItem
 * @property {number} id
 * @property {string} name
 * @property {number} price
 * @property {number} qty
 * @property {string[]} images
 */

/** @type {Product[]} */
let products = [];
/** @type {CartItem[]} */
let cart = [];
/** @type {Product[]} */
let wishlist = [];

// ===== Fetch Data =====
async function fetchProducts() {
    try {
        const res = await fetch(`${API_URL}/products`);
        if (!res.ok) throw new Error('Failed to fetch products');
        products = await res.json();
        renderProducts(products);
    } catch (err) {
        console.error(err);
        // Fallback or empty
        products = [];
        renderProducts(products);
    }
}

// ===== Navigation Functions =====
function goHome() {
    showSection('home');
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    if (searchInput) /** @type {HTMLInputElement} */ (searchInput).value = '';
    if (categoryFilter) /** @type {HTMLSelectElement} */ (categoryFilter).value = 'all';
    fetchProducts(); // Refresh data
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showSection(id) {
    const sections = ['home', 'detail', 'cart', 'wishlist', 'uploadSection', 'manageSection', 'editSection', 'signup', 'login', 'adminDashboard'];
    
    // Security check for admin sections
    const adminSections = ['uploadSection', 'manageSection', 'editSection', 'adminDashboard'];
    if (adminSections.includes(id)) {
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        
        if (!user || user.role !== 'admin') {
            alert('Access Denied: Admins only');
            showSection('home');
            return;
        }
    }

    sections.forEach(s => {
        const el = document.getElementById(s);
        if(el) {
            el.style.display = 'none';
            el.style.opacity = '0'; 
        }
    });
    
    const target = document.getElementById(id);
    if(target) {
        target.style.display = 'block';
        setTimeout(() => {
            target.style.opacity = '1';
        }, 10);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Dropdown Toggle
function toggleDropdown() {
    const menu = document.getElementById('dropdownMenu');
    if (menu) {
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    }
}

window.onclick = function(e) {
    // @ts-ignore
    if (e.target && !e.target.matches('.menu') && !e.target.matches('.dropdown') && !e.target.matches('.dropdown *')) {
        const menu = document.getElementById('dropdownMenu');
        if(menu) menu.style.display = 'none';
    }
}

// ===== Product Display =====
/**
 * @param {Product[]} list 
 */
function renderProducts(list) {
    let html = '';
    list.forEach(p => {
        // Ensure image is valid or use placeholder
        const img = (p.images && p.images.length > 0) ? p.images[0] : 'https://via.placeholder.com/400';
        html += `
        <div class="card">
            <img src="${img}" alt="${p.name}" onclick="viewDetail(${p.id})">
            <h3>${p.name}</h3>
            <p>PKR ${p.price}</p>
            <button onclick="addToCart(${p.id}, event)"><i class="fas fa-shopping-cart"></i> Add to Cart</button>
            <button class="quick-view-btn" onclick="viewDetail(${p.id})"><i class="fas fa-eye"></i></button>
        </div>`;
    });
    const container = document.getElementById('products');
    if(container) container.innerHTML = html;
}

function filterProducts() {
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    
    const term = searchInput ? /** @type {HTMLInputElement} */ (searchInput).value.toLowerCase() : '';
    const cat = categoryFilter ? /** @type {HTMLSelectElement} */ (categoryFilter).value : 'all';
    
    let filtered = products.filter(p => p.name.toLowerCase().includes(term));
    if (cat !== 'all') filtered = filtered.filter(p => p.category === cat);
    renderProducts(filtered);
}

function viewDetail(id) {
    const p = products.find(x => x.id === id);
    if(!p) return;
    
    let sliderHtml = '';
    const imgs = p.images && p.images.length > 0 ? p.images : ['https://via.placeholder.com/400'];
    imgs.forEach((img, idx) => {
        sliderHtml += `<img src="${img}" onclick="changeMainImage('${img}', this)" class="${idx===0?'selected':''}">`;
    });

    const html = `
        <div style="display:flex; flex-wrap:wrap; gap:40px; justify-content:center;">
            <div style="flex:1; max-width:500px;">
                <img id="mainImage" src="${imgs[0]}">
                <div class="slider">${sliderHtml}</div>
            </div>
            <div style="flex:1; max-width:500px; padding:20px;">
                <h2 style="color:#ff66b2; margin-bottom:15px;">${p.name}</h2>
                <h3 style="margin-bottom:20px;">PKR ${p.price}</h3>
                <p style="margin-bottom:20px; line-height:1.6;">${p.desc || p.description}</p>
                <div style="display:flex; gap:15px;">
                    <button onclick="addToCart(${p.id}, event)" style="padding:12px 25px; background:#ff66b2; color:white; border:none; border-radius:8px; cursor:pointer;">Add to Cart</button>
                    <button onclick="addToWishlist(${p.id})" style="padding:12px 25px; background:#333; color:white; border:none; border-radius:8px; cursor:pointer;">Wishlist</button>
                </div>
            </div>
        </div>
        <button onclick="goHome()" style="margin-top:30px; background:none; border:1px solid #ff66b2; color:#ff66b2; padding:10px 20px; border-radius:5px; cursor:pointer;">← Back to Home</button>
    `;
    
    const detail = document.getElementById('detail');
    if (detail) detail.innerHTML = html;
    showSection('detail');
}

function changeMainImage(src, thumb) {
    const mainImage = document.getElementById('mainImage');
    if (mainImage) /** @type {HTMLImageElement} */ (mainImage).src = src;
    
    document.querySelectorAll('.slider img').forEach(img => img.classList.remove('selected'));
    // @ts-ignore
    if (thumb) thumb.classList.add('selected');
}

// ===== Cart Logic =====
function addToCart(id) {
    let p = products.find(x => x.id === id);
    if (!p) return;

    let cartItem = cart.find(c => c.id === id);
    if (cartItem) {
        cartItem.qty += 1;
    } else {
        // @ts-ignore
        cart.push({...p, qty: 1});
    }
    
    // Animation feedback
    // @ts-ignore
    const event = window.event;
    if (event && event.target) {
        /** @type {HTMLElement} */
        // @ts-ignore
        const btn = event.target.closest('button');
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Added!';
            btn.style.background = '#28a745';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.background = '';
            }, 1000);
        }
    }
    
    renderCart();
}

function renderCart() {
    const cartContainer = document.getElementById('cartItems');
    if (!cartContainer) return;

    if (cart.length === 0) {
        cartContainer.innerHTML = '<p style="text-align:center; padding:20px;">Your cart is empty!</p>';
        return;
    }
    let html = '';
    let grandTotal = 0;
    cart.forEach((c, i) => {
        let totalPrice = c.price * c.qty;
        grandTotal += totalPrice;
        const img = (c.images && c.images.length > 0) ? c.images[0] : 'https://via.placeholder.com/400';
        html += `
        <div class="cart-item">
            <img src="${img}">
            <div>
                <h3>${c.name}</h3>
                <p>PKR ${c.price} × ${c.qty} = <strong>PKR ${totalPrice}</strong></p>
            </div>
            <div>
                <button onclick="changeQty(${i}, -1)">-</button>
                <span style="margin:0 10px;">${c.qty}</span>
                <button onclick="changeQty(${i}, 1)">+</button>
                <button onclick="removeFromCart(${i})" style="background:#dc3545;">Remove</button>
            </div>
        </div>
        `;
    });
    html += `<div style="text-align:right; margin-top:20px; padding-top:20px; border-top:1px solid #333;">
                <h3>Grand Total: PKR ${grandTotal}</h3>
             </div>`;
    cartContainer.innerHTML = html;
}

function changeQty(index, delta) {
    if (cart[index]) {
        cart[index].qty += delta;
        if (cart[index].qty <= 0) {
            cart.splice(index, 1);
        }
        renderCart();
    }
}

function removeFromCart(i) {
    cart.splice(i, 1);
    renderCart();
}

function showCart() {
    showSection('cart');
    renderCart();
}

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
        items: cart,
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
            alert('Order placed successfully! We will contact you soon.');
            goHome();
        } else {
            alert('Failed to place order: ' + data.error);
        }
    } catch (err) {
        console.error(err);
        alert('Error placing order');
    }
}

// ===== Wishlist Logic =====
function addToWishlist(id) {
    let p = products.find(x => x.id === id);
    if (!p) return;

    if (!wishlist.some(w => w.id === id)) {
        wishlist.push(p);
        alert('Added to wishlist!');
    } else {
        alert('Already in wishlist!');
    }
}

function showWishlist() {
    showSection('wishlist');
    renderWishlist();
}

function renderWishlist() {
    const wishlistContainer = document.getElementById('wishlistItems');
    if (!wishlistContainer) return;

    let html = '';
    if(wishlist.length === 0) {
        html = '<p style="text-align:center;">Wishlist is empty</p>';
    } else {
        wishlist.forEach((c, i) => {
            const img = (c.images && c.images.length > 0) ? c.images[0] : 'https://via.placeholder.com/400';
            html += `<div class="wishlist-item">
                        <img src="${img}">
                        <div>
                            <h3>${c.name}</h3>
                            <p>PKR ${c.price}</p>
                        </div>
                        <button onclick="addToCart(${c.id}, event)">Add to Cart</button>
                        <button onclick="removeFromWishlist(${i})" style="background:#dc3545;">Remove</button>
                    </div>`;
        });
    }
    wishlistContainer.innerHTML = html;
}

function removeFromWishlist(i) {
    wishlist.splice(i, 1);
    renderWishlist();
}

// ===== Auth Logic =====
async function signup() {
    const nameInput = document.getElementById('signupName');
    const emailInput = document.getElementById('signupEmail');
    const passInput = document.getElementById('signupPass');

    const n = nameInput ? /** @type {HTMLInputElement} */ (nameInput).value : '';
    const e = emailInput ? /** @type {HTMLInputElement} */ (emailInput).value : '';
    const p = passInput ? /** @type {HTMLInputElement} */ (passInput).value : '';
    
    if (!n || !e || !p) {
        alert('Please fill all fields');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: n, email: e, password: p })
        });
        const data = await res.json();
        
        if (data.success) {
            alert('Signup successful! Please login.');
            showSection('login');
        } else {
            alert('Signup failed: ' + (data.error || data.message));
        }
    } catch (err) {
        console.error(err);
        alert('Error connecting to server');
    }
}

async function login() {
    const emailInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginPass');

    const e = emailInput ? /** @type {HTMLInputElement} */ (emailInput).value : '';
    const p = passInput ? /** @type {HTMLInputElement} */ (passInput).value : '';

    if (!e || !p) {
        alert('Please enter email and password');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: e, password: p })
        });
        const data = await res.json();
        
        if (data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
            // Compatibility with old code
            localStorage.setItem('loggedIn', data.user.email);
            
            alert('Logged in successfully');
            updateUI();
            showSection('home');
        } else {
            alert('Invalid email or password');
        }
    } catch (err) {
        console.error(err);
        alert('Error connecting to server');
    }
}

function logout() {
    localStorage.removeItem('loggedIn');
    localStorage.removeItem('user');
    alert('Logged out');
    updateUI();
    showSection('home');
}

function updateUI() {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    
    const btnAdmin = document.getElementById('btnAdminDashboard');
    const btnAdd = document.getElementById('btnAdd');
    const btnManage = document.getElementById('btnManage');
    
    if (user) {
        if (user.role === 'admin') {
            if(btnAdmin) btnAdmin.style.display = 'flex';
            if(btnAdd) btnAdd.style.display = 'flex';
            if(btnManage) btnManage.style.display = 'flex';
        } else {
            if(btnAdmin) btnAdmin.style.display = 'none';
            if(btnAdd) btnAdd.style.display = 'none';
            if(btnManage) btnManage.style.display = 'none';
        }
    } else {
        if(btnAdmin) btnAdmin.style.display = 'none';
        if(btnAdd) btnAdd.style.display = 'none';
        if(btnManage) btnManage.style.display = 'none';
    }
}

// ===== Admin Functions =====
async function showAdminDashboard() {
    showSection('adminDashboard');
    
    try {
        const res = await fetch(`${API_URL}/orders`);
        const orders = await res.json();
        
        const totalOrders = orders.length;
        // @ts-ignore
        const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
        
        const elOrders = document.getElementById('totalOrders');
        const elRevenue = document.getElementById('totalRevenue');
        if (elOrders) elOrders.innerText = totalOrders.toString();
        if (elRevenue) elRevenue.innerText = totalRevenue.toLocaleString();
        
        let html = '<h3>Recent Orders</h3>';
        // @ts-ignore
        orders.slice().reverse().forEach(o => {
            const items = o.items ? o.items.map(i => `${i.name} (${i.qty})`).join(', ') : 'No items';
            html += `<div style="background:#1a1a1a; padding:15px; margin-bottom:10px; border-radius:8px;">
                        <p><strong>Email:</strong> ${o.email}</p>
                        <p><strong>Date:</strong> ${new Date(o.date).toLocaleString()}</p>
                        <p><strong>Total:</strong> PKR ${o.total}</p>
                        <p><strong>Items:</strong> ${items}</p>
                     </div>`;
        });
        const dashboardOrders = document.getElementById('dashboardOrders');
        if (dashboardOrders) dashboardOrders.innerHTML = html;
        
    } catch (err) {
        console.error(err);
        const dashboardOrders = document.getElementById('dashboardOrders');
        if (dashboardOrders) dashboardOrders.innerHTML = '<p>Error loading orders</p>';
    }
}

async function submitNewSuit() {
    const nameInput = document.getElementById('newSuitName');
    const priceInput = document.getElementById('newSuitPrice');
    const descInput = document.getElementById('newSuitDesc');
    const fileInput = document.getElementById('newSuitImages');
    
    const name = nameInput ? /** @type {HTMLInputElement} */ (nameInput).value : '';
    const price = priceInput ? /** @type {HTMLInputElement} */ (priceInput).value : '';
    const desc = descInput ? /** @type {HTMLInputElement} */ (descInput).value : '';
    const files = fileInput ? /** @type {HTMLInputElement} */ (fileInput).files : null;
    
    if(!name || !price || !files || files.length === 0) {
        alert('Please fill required fields');
        return;
    }
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('price', price);
    formData.append('desc', desc);
    for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
    }
    
    try {
        const res = await fetch(`${API_URL}/products`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        
        if (data.success) {
            alert('Product added successfully!');
            fetchProducts();
            goHome();
        } else {
            alert('Failed to add product: ' + data.error);
        }
    } catch (err) {
        console.error(err);
        alert('Error adding product');
    }
}

function showManageSection() {
    showSection('manageSection');
    let html = '';
    products.forEach(p => {
        const img = (p.images && p.images.length > 0) ? p.images[0] : 'https://via.placeholder.com/400';
        html += `<div class="remove-item">
                    <img src="${img}">
                    <div>${p.name} (PKR ${p.price})</div>
                    <button onclick="showEditSection(${p.id})" style="background:#007bff;">Edit</button>
                    <button onclick="removeProduct(${p.id})" style="background:#dc3545;">Remove</button>
                 </div>`;
    });
    const manageList = document.getElementById('manageList');
    if (manageList) manageList.innerHTML = html;
}

function showEditSection(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    
    showSection('editSection');
    
    const idInput = document.getElementById('editSuitId');
    const nameInput = document.getElementById('editSuitName');
    const priceInput = document.getElementById('editSuitPrice');
    const descInput = document.getElementById('editSuitDesc');
    
    if (idInput) /** @type {HTMLInputElement} */ (idInput).value = p.id.toString();
    if (nameInput) /** @type {HTMLInputElement} */ (nameInput).value = p.name;
    if (priceInput) /** @type {HTMLInputElement} */ (priceInput).value = p.price.toString();
    if (descInput) /** @type {HTMLInputElement} */ (descInput).value = p.desc || p.description || '';
}

async function submitEditSuit() {
    const idInput = document.getElementById('editSuitId');
    const nameInput = document.getElementById('editSuitName');
    const priceInput = document.getElementById('editSuitPrice');
    const descInput = document.getElementById('editSuitDesc');
    const fileInput = document.getElementById('editSuitImages');

    const id = idInput ? Number(/** @type {HTMLInputElement} */ (idInput).value) : 0;
    const name = nameInput ? /** @type {HTMLInputElement} */ (nameInput).value : '';
    const price = priceInput ? /** @type {HTMLInputElement} */ (priceInput).value : '';
    const desc = descInput ? /** @type {HTMLInputElement} */ (descInput).value : '';
    const files = fileInput ? /** @type {HTMLInputElement} */ (fileInput).files : null;

    if (!id || !name || !price) {
        alert('Please fill required fields');
        return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('price', price);
    formData.append('desc', desc);
    if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            formData.append('images', files[i]);
        }
    }

    try {
        const res = await fetch(`${API_URL}/products/${id}`, {
            method: 'PUT',
            body: formData
        });
        const data = await res.json();
        
        if (data.success) {
            alert('Product updated successfully!');
            await fetchProducts(); // Wait for refresh
            showManageSection();
        } else {
            alert('Failed to update product: ' + data.error);
        }
    } catch (err) {
        console.error(err);
        alert('Error updating product');
    }
}

async function removeProduct(id) {
    if(confirm('Are you sure you want to delete this product?')) {
        try {
            const res = await fetch(`${API_URL}/products/${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            
            if (data.success) {
                await fetchProducts();
                showManageSection();
            } else {
                alert('Failed to delete product: ' + data.error);
            }
        } catch (err) {
            console.error(err);
            alert('Error deleting product');
        }
    }
}

// ===== Other Functions =====
function pay(method) {
    alert(`Redirecting to ${method} payment gateway...`);
}

function subscribeNewsletter() {
    const emailInput = document.getElementById('newsletterEmail');
    const email = emailInput ? /** @type {HTMLInputElement} */ (emailInput).value : '';
    
    if(email) {
        alert('Subscribed successfully!');
        if (emailInput) /** @type {HTMLInputElement} */ (emailInput).value = '';
    } else {
        alert('Please enter email');
    }
}

// Initialize
// (Called at top: fetchProducts and updateUI)
