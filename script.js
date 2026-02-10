// ===== Configuration =====
const LOCAL_API = 'http://localhost:3000/api';
const REMOTE_API = 'https://aitsam916-clothes-backend.hf.space/api'; 
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
} catch (e) {}

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
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

window.onclick = function(event) {
    const target = event.target;
    if (target instanceof HTMLElement && !target.closest('.menu')) {
        const dropdowns = document.getElementsByClassName("dropdown-content");
        for (let i = 0; i < dropdowns.length; i++) {
            const openDropdown = dropdowns[i];
            if (openDropdown instanceof HTMLElement && openDropdown.classList.contains('show')) {
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
            image: product.image_url || 'placeholder.svg'
        });
    }
    
    renderCart();
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

// ===== Auth Logic =====
async function login() {
    const emailInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginPass');

    // Type Casting fix: Property 'value' exists on HTMLInputElement
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
                emailInput.value = '';
                passInput.value = '';
                updateUI();
                toggleDropdown();
                showSection('home');
                alert('Welcome back, ' + data.user.name);
            } else {
                alert('Login Failed: ' + (data.error || 'Check credentials'));
            }
        } catch (err) {
            alert('Server error.');
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
    showSection('home');
}

// ===== UI Updates =====
function updateUI() {
    const userStr = localStorage.getItem('user');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Fix: Property 'style' exists on HTMLElement
    const adminBtns = document.querySelectorAll('[id^="btnAdmin"]');

    if (userStr) {
        const user = JSON.parse(userStr);
        if (loginBtn instanceof HTMLElement) loginBtn.style.display = 'none';
        if (logoutBtn instanceof HTMLElement) logoutBtn.style.display = 'block';
        
        adminBtns.forEach(btn => {
            if (btn instanceof HTMLElement) {
                btn.style.display = user.role === 'admin' ? 'flex' : 'none';
            }
        });
    } else {
        if (loginBtn instanceof HTMLElement) loginBtn.style.display = 'block';
        if (logoutBtn instanceof HTMLElement) logoutBtn.style.display = 'none';
        adminBtns.forEach(btn => {
            if (btn instanceof HTMLElement) btn.style.display = 'none';
        });
    }
}

// ===== Fetch & Render =====
async function fetchProducts() {
    try {
        const res = await fetch(`${API_URL}/products`);
        const data = await res.json();
        products = Array.isArray(data) ? data : [];
        renderProducts(products);
    } catch (err) {
        console.error("Fetch error");
    }
}

function renderProducts(items) {
    const container = document.getElementById('products');
    if (!container) return;

    container.innerHTML = items.map(p => `
        <div class="card reveal">
            <img src="${p.image_url || 'placeholder.svg'}" alt="${p.name}" loading="lazy" />
            <h3>${p.name}</h3>
            <p>Rs. ${p.price}</p>
            <button onclick="addToCart(${p.id})">Add to Cart</button>
            <button onclick="showDetail(${p.id})">View</button>
        </div>
    `).join('');
    setupReveal();
}

// ===== Search/Filter Fix =====
function filterProducts() {
    const inputEl = document.getElementById('searchInput');
    if (inputEl instanceof HTMLInputElement) {
        const term = inputEl.value.toLowerCase();
        const filtered = products.filter(p => p.name.toLowerCase().includes(term));
        renderProducts(filtered);
    }
}

function initRevealObserver() {
    revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                revealObserver?.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });
}

function setupReveal() {
    document.querySelectorAll('.reveal').forEach(el => {
        if (revealObserver) revealObserver.observe(el);
    });
}

function goHome() {
    showSection('home');
}