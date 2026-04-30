// ============================================================
// GLOBAL PRODUCT CATALOG
// ============================================================
const PRODUCTS = [
    { id: 1, name: "Óleo Essencial de Lavanda 10ml Puro", category: "Bem-estar", price: 45.90, oldPrice: 55.00, image: "https://images.unsplash.com/photo-1608222351212-18fe0ec7b13b?auto=format&fit=crop&w=300&q=80", offer: "-16%" },
    { id: 2, name: "Suplemento Vitamina C 1000mg 60 Cápsulas", category: "Suplementos", price: 69.90, image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=300&q=80" },
    { id: 3, name: "Creme Hidratante Vegano Facial Noturno", category: "Cosméticos", price: 89.00, oldPrice: 110.00, image: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=300&q=80", offer: "-19%" },
    { id: 4, name: "Chá Verde Orgânico Caixa com 30g", category: "Alimentos", price: 22.50, image: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?auto=format&fit=crop&w=300&q=80" },
    { id: 5, name: "Whey Protein Sabor Baunilha 900g", category: "Nutrição Esportiva", price: 159.90, image: "https://images.unsplash.com/photo-1579722820308-d74e571900a9?auto=format&fit=crop&w=300&q=80" },
    { id: 6, name: "Sabonete Líquido de Alecrim 250ml", category: "Cosméticos", price: 35.00, oldPrice: 40.00, image: "https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=300&q=80", offer: "-12%" },
    { id: 7, name: "Mel Silvestre Puro Bisnaga 500g", category: "Alimentos", price: 42.00, image: "https://images.unsplash.com/photo-1587049352847-4d4b1ed74dd4?auto=format&fit=crop&w=300&q=80" },
    { id: 8, name: "Colágeno Hidrolisado em Pó 300g", category: "Suplementos", price: 95.00, oldPrice: 120.00, image: "https://images.unsplash.com/photo-1576073719676-aa95576db207?auto=format&fit=crop&w=300&q=80", offer: "-20%" },
    { id: 9, name: "Snack de Grão de Bico Assado com Ervas", category: "Alimentos", price: 15.90, image: "https://images.unsplash.com/photo-1599490659213-e2b9527bd08c?auto=format&fit=crop&w=300&q=80" },
    { id: 10, name: "Kit Shampoo e Condicionador Sólido", category: "Cosméticos", price: 78.00, image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=300&q=80" }
];

// ============================================================
// PRODUCT STORE MODULE
// ============================================================
const ProductStore = {
    _key: 'ecostore_products',
    getAll() { 
        const prods = JSON.parse(localStorage.getItem(this._key) || '[]');
        if (prods.length === 0 && typeof PRODUCTS !== 'undefined') {
            // First time initialization with static catalog
            localStorage.setItem(this._key, JSON.stringify(PRODUCTS));
            return PRODUCTS;
        }
        return prods;
    },
    getById(id) { return this.getAll().find(p => p.id === id); }
};

// ============================================================
// CART MODULE
// ============================================================
const Cart = {
    _key: 'ecostore_cart',
    getItems() { return JSON.parse(localStorage.getItem(this._key) || '[]'); },
    save(items) { localStorage.setItem(this._key, JSON.stringify(items)); document.dispatchEvent(new CustomEvent('cartChanged')); },
    add(productId) {
        const product = ProductStore.getById(productId);
        if (!product) return;
        const items = this.getItems();
        const existing = items.find(i => i.id === productId);
        const actualPrice = (product.promoActive && product.promoPrice) ? product.promoPrice : product.price;

        if (existing) {
            existing.qty += 1;
            existing.price = actualPrice; // Update price in case it changed while in cart
        } else {
            items.push({ id: product.id, name: product.name, price: actualPrice, image: product.image, qty: 1 });
        }
        this.save(items);
    },
    remove(productId) { this.save(this.getItems().filter(i => i.id !== productId)); },
    setQty(productId, qty) {
        if (qty <= 0) { this.remove(productId); return; }
        const items = this.getItems();
        const item = items.find(i => i.id === productId);
        if (item) { item.qty = qty; this.save(items); }
    },
    clear() { localStorage.removeItem(this._key); document.dispatchEvent(new CustomEvent('cartChanged')); },
    total() { return this.getItems().reduce((s, i) => s + i.price * i.qty, 0); },
    count() { return this.getItems().reduce((s, i) => s + i.qty, 0); }
};

// ============================================================
// AUTH MODULE
// ============================================================
const Auth = {
    _key: 'ecostore_user',
    _allUsersKey: 'ecostore_all_users',
    isLoggedIn() { return !!localStorage.getItem(this._key); },
    getUser() { return JSON.parse(localStorage.getItem(this._key) || 'null'); },
    getAllUsers() { return JSON.parse(localStorage.getItem(this._allUsersKey) || '[]'); },
    login(user) {
        localStorage.setItem(this._key, JSON.stringify(user));
        // Save to all users list if not there
        const all = this.getAllUsers();
        if (!all.find(u => u.email === user.email)) {
            all.push({ ...user, date: new Date().toLocaleDateString('pt-BR'), status: 'ativo', orders: 0 });
            localStorage.setItem(this._allUsersKey, JSON.stringify(all));
        }
    },
    logout() { localStorage.removeItem(this._key); }
};

// ============================================================
// ORDERS MODULE
// ============================================================
const Orders = {
    _key: 'ecostore_orders',
    getAll() { return JSON.parse(localStorage.getItem(this._key) || '[]'); },
    create(items, total, address) {
        const orders = this.getAll();
        const user = Auth.getUser();
        const order = {
            id: '#' + String(10593 + orders.length).padStart(5, '0'),
            date: new Date().toLocaleDateString('pt-BR'),
            status: 'processando',
            statusLabel: 'Processando',
            total,
            items: items.map(i => ({ ...i })),
            address,
            clientEmail: user ? user.email : 'anonimo@email.com',
            clientName: user ? user.name : 'Cliente Anônimo'
        };
        orders.unshift(order);
        localStorage.setItem(this._key, JSON.stringify(orders));
        return order;
    }
};

// ============================================================
// HERO BANNER (ROTATIVO)
// ============================================================
let currentBannerIndex = 0;
let bannerInterval = null;

function initHeroBanner() {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    const banners = JSON.parse(localStorage.getItem('ecostore_banners') || '[]');
    const activeBanners = banners.filter(b => b.active);

    if (activeBanners.length === 0) {
        // Fallback caso não existam banners no localStorage
        hero.style.background = "linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('https://images.unsplash.com/photo-1501854140801-50d01674aa3e?auto=format&fit=crop&w=1600&q=80') center/cover";
        const title = hero.querySelector('h1');
        const subtitle = hero.querySelector('p');
        const btn = hero.querySelector('.hero-content a.btn-primary');
        if (title) title.textContent = "Bem-vindo à EcoStore";
        if (subtitle) subtitle.textContent = "Sua vida mais saudável e natural começa aqui.";
        if (btn) btn.textContent = "Ver Produtos";
        return;
    }

    const renderBanner = (index) => {
        const b = activeBanners[index];
        hero.style.backgroundImage = `url('${b.image}')`;
        hero.style.cursor = b.btnLink ? 'pointer' : 'default';
        
        // Armazena o link atual para o clique
        hero.onclick = () => {
            if (b.btnLink) window.location.href = b.btnLink;
        };

        const title = hero.querySelector('h1');
        const subtitle = hero.querySelector('p');
        const btn = hero.querySelector('.hero-content a.btn-primary');

        if (title) {
            title.style.opacity = 0;
            setTimeout(() => { title.textContent = b.title || ''; title.style.opacity = 1; }, 300);
        }
        if (subtitle) {
            subtitle.style.opacity = 0;
            setTimeout(() => { subtitle.textContent = b.subtitle || ''; subtitle.style.opacity = 1; }, 300);
        }
        if (btn) {
            btn.textContent = b.btnText || 'Comprar Agora';
            btn.href = b.btnLink || '#produtos';
        }
    };

    // Inicial
    renderBanner(0);

    const nextBanner = () => {
        currentBannerIndex = (currentBannerIndex + 1) % activeBanners.length;
        renderBanner(currentBannerIndex);
    };

    const prevBanner = () => {
        currentBannerIndex = (currentBannerIndex - 1 + activeBanners.length) % activeBanners.length;
        renderBanner(currentBannerIndex);
    };

    const resetInterval = () => {
        if (bannerInterval) clearInterval(bannerInterval);
        bannerInterval = setInterval(nextBanner, 5000);
    };

    // Botões de navegação
    const btnPrev = document.getElementById('banner-prev');
    const btnNext = document.getElementById('banner-next');

    if (btnPrev && btnNext) {
        if (activeBanners.length > 1) {
            btnPrev.style.display = 'flex';
            btnNext.style.display = 'flex';
            
            btnPrev.onclick = (e) => {
                e.stopPropagation();
                prevBanner();
                resetInterval();
            };
            
            btnNext.onclick = (e) => {
                e.stopPropagation();
                nextBanner();
                resetInterval();
            };
        } else {
            btnPrev.style.display = 'none';
            btnNext.style.display = 'none';
        }
    }

    // Se houver mais de um, inicia rotação
    if (activeBanners.length > 1) {
        resetInterval();
    }
}

// ============================================================
// TOAST
// ============================================================
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) { container = document.createElement('div'); container.id = 'toast-container'; document.body.appendChild(container); }
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<i class="fas fa-' + (type === 'success' ? 'check-circle' : 'exclamation-circle') + '"></i> ' + message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 400); }, 3000);
}

// ============================================================
// CART BADGE
// ============================================================
function updateCartBadge() {
    const badge = document.querySelector('.cart-count');
    if (!badge) return;
    const count = Cart.count();
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
}

document.addEventListener('cartChanged', updateCartBadge);

// ============================================================
// ADD TO CART (global, called by onclick)
// ============================================================
window.addToCart = function(productId) {
    const product = ProductStore.getById(productId);
    if (!product) return;
    Cart.add(productId);
    showToast('"' + product.name.substring(0, 30) + '..." adicionado!');
    const cartIcon = document.querySelector('.cart-icon');
    if (cartIcon) { cartIcon.style.transform = 'scale(1.3)'; setTimeout(() => { cartIcon.style.transform = 'scale(1)'; }, 200); }
};

// ============================================================
// DOMCONTENTLOADED
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    updateCartBadge();

    // Sticky header
    const header = document.getElementById('header');
    if (header) { window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 50)); }

    renderPromoProducts();
    renderAllProducts();
    initCategoriesMenu();
    initHeroBanner();
    initCartPage();
    initCheckoutPage();
    initAuthPages();
    initDashboard();
    initSearch();
    updateHeaderAuth();
    syncCurrentToAllUsers();
});

// ============================================================
// RENDER PRODUCTS (PROMO & ALL)
// ============================================================
function renderPromoProducts(page = 1) {
    const products = ProductStore.getAll().filter(p => p.promoActive);
    
    // Se não houver promoções, esconde a seção
    const section = document.getElementById('promo-section');
    if (products.length === 0) {
        if (section) section.style.display = 'none';
        return;
    }
    if (section) section.style.display = 'block';

    renderGrid('promo-product-grid', 'promo-pagination', products, page, 8, 'promo');
}

function renderAllProducts(page = 1, filterCategory = null, filterText = null) {
    let products = ProductStore.getAll();

    if (filterCategory) {
        products = products.filter(p => p.category === filterCategory);
    }

    if (filterText) {
        const query = filterText.toLowerCase().trim();
        products = products.filter(p => 
            p.name.toLowerCase().includes(query) || 
            (p.brand && p.brand.toLowerCase().includes(query))
        );
    }

    renderGrid('all-product-grid', 'all-pagination', products, page, 20, 'all', filterCategory, filterText);
}

function renderGrid(gridId, paginationId, products, page, perPage, type, cat = null, text = null) {
    const grid = document.getElementById(gridId);
    const pag = document.getElementById(paginationId);
    if (!grid) return;

    grid.innerHTML = '';
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const paginated = products.slice(start, end);

    if (products.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);"><i class="fas fa-search" style="font-size: 40px; margin-bottom: 15px; display: block; opacity: 0.3;"></i>Nenhum produto encontrado.</div>';
        if (pag) pag.innerHTML = '';
        return;
    }

    const fmt = p => 'R$ ' + p.toFixed(2).replace('.', ',');

    paginated.forEach(product => {
        grid.innerHTML += '<div class="product-card">' +
            (product.offer ? '<span class="badge-offer">' + product.offer + '</span>' : '') +
            '<img src="' + product.image + '" alt="' + product.name + '" class="product-img" onclick="openProductDetail(' + product.id + ')" style="cursor:pointer">' +
            '<span class="product-category">' + product.category + '</span>' +
            '<h3 class="product-title" onclick="openProductDetail(' + product.id + ')" style="cursor:pointer">' + product.name + '</h3>' +
            '<div class="product-price">' + (product.promoActive && product.promoPrice ? fmt(product.promoPrice) : fmt(product.price)) + (product.promoActive && product.promoPrice ? '<span>' + fmt(product.price) + '</span>' : '') + '</div>' +
            '<button class="btn-buy" onclick="addToCart(' + product.id + ')"><i class="fas fa-cart-plus"></i> Comprar</button>' +
            '</div>';
    });

    // Pagination
    if (pag) {
        const totalPages = Math.ceil(products.length / perPage);
        pag.innerHTML = '';
        
        if (totalPages > 1) {
            for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement('button');
                btn.className = `pag-btn ${i === page ? 'active' : ''}`;
                btn.textContent = i;
                btn.onclick = () => {
                    if (type === 'promo') renderPromoProducts(i);
                    else renderAllProducts(i, cat, text);
                    
                    grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
                };
                pag.appendChild(btn);
            }
        }
    }
}

// ============================================================
// SEARCH LOGIC
// ============================================================
function initSearch() {
    const input = document.getElementById('main-search-input');
    const btn = document.getElementById('main-search-btn');
    if (!input || !btn) return;

    const handleSearch = () => {
        const query = input.value;
        renderAllProducts(1, null, query);
        
        // Esconde promoções durante a busca para focar no resultado
        const promoSec = document.getElementById('promo-section');
        const hero = document.querySelector('.hero');
        const allTitle = document.getElementById('all-products-title');

        if (query.trim() !== '') {
            if (hero) hero.style.display = 'none';
            if (promoSec) promoSec.style.display = 'none';
            if (allTitle) allTitle.innerHTML = `<i class="fas fa-search"></i> Resultados para: "${query}"`;
        } else {
            if (hero) hero.style.display = 'block';
            renderPromoProducts(); // Re-exibe promos
            if (allTitle) allTitle.innerHTML = `<i class="fas fa-th-large"></i> Todos os Produtos`;
        }

        // Scroll para os produtos
        const grid = document.getElementById('all-product-grid');
        if (grid) grid.scrollIntoView({ behavior: 'smooth' });
    };

    btn.addEventListener('click', handleSearch);
    input.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
}

// ============================================================
// CATEGORIES MENU
// ============================================================
function initCategoriesMenu() {
    const btn = document.getElementById('btn-categories');
    const dropdown = document.getElementById('categories-dropdown');
    if (!btn || !dropdown) return;

    // Get unique categories
    const allProducts = ProductStore.getAll();
    const categories = [...new Set(allProducts.map(p => p.category))];

    // Populate dropdown
    dropdown.innerHTML = '<li><a href="javascript:void(0)" onclick="filterByCategory(null)">Todas as Categorias</a></li>' +
        categories.map(cat => `<li><a href="javascript:void(0)" onclick="filterByCategory('${cat}')">${cat}</a></li>`).join('');

    // Toggle dropdown
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
        if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });
}

window.filterByCategory = function(category) {
    renderAllProducts(1, category);
    const allTitle = document.getElementById('all-products-title');
    if (allTitle) {
        allTitle.innerHTML = category ? `<i class="fas fa-th-large"></i> Categoria: ${category}` : `<i class="fas fa-th-large"></i> Todos os Produtos`;
    }
    
    // Fechar o dropdown após clicar
    const dropdown = document.getElementById('categories-dropdown');
    if (dropdown) dropdown.classList.remove('show');

    // Voltar para a grid caso esteja na visualização única
    if (!document.getElementById('single-product-view').classList.contains('hidden')) {
        backToGrid();
    }

    // Scroll to products
    const section = document.getElementById('produtos');
    if (section) {
        const headerOffset = 80;
        const elementPosition = section.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
};

// ============================================================
// PRODUCT DETAIL MODAL
// ============================================================
let currentDetailProductId = null;

window.openProductDetail = function(id) {
    const product = ProductStore.getById(id);
    if (!product) return;

    const fmt = v => 'R$ ' + v.toFixed(2).replace('.', ',');

    // Hide Grid and Hero
    const hero = document.querySelector('.hero');
    if (hero) hero.style.display = 'none';
    document.getElementById('grid-header').style.display = 'none';
    document.getElementById('main-product-grid').style.display = 'none';
    
    // Show Single View
    const singleView = document.getElementById('single-product-view');
    singleView.classList.remove('hidden');

    document.getElementById('single-img').src = product.image;
    document.getElementById('single-category').textContent = product.category;
    document.getElementById('single-title').textContent = product.name;
    document.getElementById('single-description').textContent = product.description || 'Este produto premium foi selecionado especialmente para você, garantindo a máxima qualidade e benefícios para sua rotina de bem-estar.';
    
    const priceEl = document.getElementById('single-price');
    const oldPriceEl = document.getElementById('single-old-price');
    
    if (product.promoActive && product.promoPrice) {
        priceEl.textContent = fmt(product.promoPrice);
        oldPriceEl.textContent = fmt(product.price);
        oldPriceEl.style.display = 'inline';
    } else {
        priceEl.textContent = fmt(product.price);
        oldPriceEl.style.display = 'none';
    }

    document.getElementById('single-qty').value = 1;
    
    // Bind Add to Cart
    const addBtn = document.getElementById('single-add-btn');
    addBtn.onclick = () => {
        const qty = parseInt(document.getElementById('single-qty').value);
        for(let i=0; i<qty; i++) Cart.add(id);
        showToast(qty + 'x "' + product.name.substring(0, 20) + '..." adicionado!');
    };

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.backToGrid = function() {
    // Hide Single View
    document.getElementById('single-product-view').classList.add('hidden');
    
    // Show Grid and Hero
    const hero = document.querySelector('.hero');
    if (hero) hero.style.display = 'block';
    document.getElementById('grid-header').style.display = 'block';
    document.getElementById('main-product-grid').style.display = 'grid';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.changeDetailQty = function(delta) {
    const input = document.getElementById('single-qty');
    if (!input) return;
    let val = parseInt(input.value) + delta;
    if (val < 1) val = 1;
    input.value = val;
};

// Sync current session user to the global list (migration/fix)
function syncCurrentToAllUsers() {
    if (Auth.isLoggedIn()) {
        const current = Auth.getUser();
        const all = Auth.getAllUsers();
        if (!all.find(u => u.email === current.email)) {
            all.push({ ...current, date: new Date().toLocaleDateString('pt-BR'), status: 'ativo', orders: 0 });
            localStorage.setItem(Auth._allUsersKey, JSON.stringify(all));
        }
    }
}

// ============================================================
// HEADER AUTH STATE — dropdown menu on click
// ============================================================
function updateHeaderAuth() {
    const link    = document.getElementById('user-nav-link');
    const icon    = document.getElementById('user-nav-icon');
    const tooltip = document.getElementById('user-tooltip');
    const wrapper = document.getElementById('user-nav-wrapper');
    if (!link || !wrapper) return;

    if (Auth.isLoggedIn()) {
        const user = Auth.getUser();
        const firstName = (user.name || 'Cliente').split(' ')[0];
        const isOnAccountPage = window.location.pathname.includes('minha-conta');

        // Update visual state
        icon.className = 'fas fa-user-circle';
        link.classList.add('user-logged-in');
        if (tooltip) tooltip.textContent = 'Olá, ' + firstName + ' ▸';

        // Prevent the <a> from navigating directly — show dropdown instead
        link.href = 'javascript:void(0)';
        link.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleUserDropdown(wrapper, firstName, isOnAccountPage);
        });

    } else {
        // Not logged in → go to login page
        link.href = 'login.html';
        icon.className = 'far fa-user';
        if (tooltip) tooltip.textContent = 'Entrar';
        link.classList.remove('user-logged-in');
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('user-dropdown');
        if (dropdown && !wrapper.contains(e.target)) {
            dropdown.remove();
        }
    });
}

function toggleUserDropdown(wrapper, firstName, isOnAccountPage) {
    // Remove if already open
    const existing = document.getElementById('user-dropdown');
    if (existing) { existing.remove(); return; }

    const dropdown = document.createElement('div');
    dropdown.id = 'user-dropdown';
    dropdown.className = 'user-dropdown';

    if (!isOnAccountPage) {
        dropdown.innerHTML =
            '<div class="user-dropdown-header"><i class="fas fa-user-circle"></i> ' + firstName + '</div>' +
            '<a href="minha-conta.html" class="user-dropdown-item"><i class="fas fa-id-card"></i> Minha Conta</a>' +
            '<a href="carrinho.html" class="user-dropdown-item"><i class="fas fa-shopping-cart"></i> Meu Carrinho</a>' +
            '<div class="user-dropdown-divider"></div>' +
            '<button class="user-dropdown-item user-dropdown-logout" onclick="doLogout()"><i class="fas fa-sign-out-alt"></i> Sair</button>';
    } else {
        dropdown.innerHTML =
            '<div class="user-dropdown-header"><i class="fas fa-user-circle"></i> ' + firstName + '</div>' +
            '<button class="user-dropdown-item user-dropdown-logout" onclick="doLogout()"><i class="fas fa-sign-out-alt"></i> Sair da conta</button>';
    }

    wrapper.appendChild(dropdown);
}

window.doLogout = function() {
    Auth.logout();
    window.location.href = 'index.html';
};


// ============================================================
// CART PAGE
// ============================================================
function initCartPage() {
    const cartWrapper = document.getElementById('cart-page-wrapper');
    if (!cartWrapper) return;

    function renderCart() {
        const items = Cart.getItems();
        const emptyState = document.getElementById('cart-empty');
        const cartContent = document.getElementById('cart-content');
        const cartBody = document.getElementById('cart-body');
        const cartTotal = document.getElementById('cart-total-value');
        const cartTotal2 = document.getElementById('cart-total-value2');
        if (items.length === 0) { emptyState.classList.remove('hidden'); cartContent.classList.add('hidden'); return; }
        emptyState.classList.add('hidden'); cartContent.classList.remove('hidden');
        const fmt = v => 'R$ ' + v.toFixed(2).replace('.', ',');
        cartBody.innerHTML = items.map(item => '<tr class="cart-row" data-id="' + item.id + '">' +
            '<td class="cart-product-cell"><img src="' + item.image + '" alt="' + item.name + '" class="cart-thumb"><span class="cart-product-name">' + item.name + '</span></td>' +
            '<td class="cart-price">' + fmt(item.price) + '</td>' +
            '<td><div class="qty-control"><button class="qty-btn" onclick="cartUpdateQty(' + item.id + ',' + (item.qty - 1) + ')">−</button><span class="qty-value">' + item.qty + '</span><button class="qty-btn" onclick="cartUpdateQty(' + item.id + ',' + (item.qty + 1) + ')">+</button></div></td>' +
            '<td class="cart-subtotal">' + fmt(item.price * item.qty) + '</td>' +
            '<td><button class="btn-remove" onclick="cartRemove(' + item.id + ')" title="Remover"><i class="fas fa-trash-alt"></i></button></td>' +
            '</tr>').join('');
        const totalFormatted = fmt(Cart.total());
        if (cartTotal) cartTotal.textContent = totalFormatted;
        if (cartTotal2) cartTotal2.textContent = totalFormatted;
    }
    renderCart();
    document.addEventListener('cartChanged', renderCart);
}

window.cartUpdateQty = function(id, qty) { Cart.setQty(id, qty); if (qty <= 0) showToast('Item removido.', 'error'); };
window.cartRemove = function(id) { Cart.remove(id); showToast('Item removido.', 'error'); };
window.goToCheckout = function() {
    if (!Auth.isLoggedIn()) { showToast('Faça login para finalizar o pedido.', 'error'); setTimeout(() => { window.location.href = 'login.html'; }, 1500); return; }
    window.location.href = 'checkout.html';
};

// ============================================================
// CHECKOUT PAGE
// ============================================================
function initCheckoutPage() {
    const checkoutWrapper = document.getElementById('checkout-wrapper');
    if (!checkoutWrapper) return;
    const items = Cart.getItems();
    if (items.length === 0) { window.location.href = 'carrinho.html'; return; }
    const fmt = v => 'R$ ' + v.toFixed(2).replace('.', ',');
    const summaryBody = document.getElementById('checkout-summary-body');
    summaryBody.innerHTML = items.map(i => '<tr><td><img src="' + i.image + '" class="cart-thumb"> ' + i.name + '</td><td class="text-center">' + i.qty + 'x</td><td class="cart-subtotal">' + fmt(i.price * i.qty) + '</td></tr>').join('');
    document.getElementById('checkout-total-value').textContent = fmt(Cart.total());
    const user = Auth.getUser();
    if (user && user.address) {
        const a = user.address;
        document.getElementById('checkout-address').textContent = a.logradouro + ', ' + a.numero + ' — ' + a.bairro + ', ' + a.cidade + '/' + a.estado + ' | CEP: ' + a.cep;
    }
    document.getElementById('btn-confirm-order').addEventListener('click', () => {
        const payment = document.querySelector('input[name="payment"]:checked');
        if (!payment) { showToast('Selecione uma forma de pagamento.', 'error'); return; }
        const addr = user?.address || { logradouro: 'Av. Paulista', numero: '1578', bairro: 'Bela Vista', cidade: 'São Paulo', estado: 'SP', cep: '01310-200' };
        const order = Orders.create(Cart.getItems(), Cart.total(), addr);
        Cart.clear();
        document.getElementById('order-id-confirm').textContent = order.id;
        document.getElementById('confirm-modal').classList.remove('hidden');
        setTimeout(() => document.getElementById('confirm-modal').classList.add('visible'), 10);
    });
}

// ============================================================
// AUTH PAGES
// ============================================================
function initAuthPages() {
    const pjToggle = document.getElementById('pj-toggle');
    if (pjToggle) {
        pjToggle.addEventListener('change', e => {
            const isPJ = e.target.checked;
            document.getElementById('pf-fields').classList.toggle('hidden', isPJ);
            document.getElementById('pj-fields').classList.toggle('hidden', !isPJ);
            document.getElementById('nome').required = !isPJ;
            document.getElementById('cpf').required = !isPJ;
            document.getElementById('razao-social').required = isPJ;
            document.getElementById('cnpj').required = isPJ;
        });
    }
    const btnCep = document.getElementById('btn-busca-cep');
    if (btnCep) {
        btnCep.addEventListener('click', () => {
            const cep = document.getElementById('cep').value.replace(/\D/g, '');
            if (cep.length >= 8) { document.getElementById('logradouro').value = 'Av. Paulista'; document.getElementById('bairro').value = 'Bela Vista'; document.getElementById('cidade').value = 'São Paulo'; document.getElementById('estado').value = 'SP'; showToast('Endereço encontrado!'); }
            else { showToast('CEP inválido.', 'error'); }
        });
    }
    const cadastroForm = document.getElementById('cadastro-form');
    if (cadastroForm) {
        cadastroForm.addEventListener('submit', e => {
            e.preventDefault();
            const isPJ = document.getElementById('pj-toggle')?.checked;
            const user = { 
                name: (document.getElementById('nome')?.value || document.getElementById('razao-social')?.value || 'Cliente'), 
                email: document.getElementById('email-cad').value,
                phone: isPJ ? document.getElementById('telefone-pj').value : document.getElementById('telefone-pf').value,
                cnpj: isPJ ? document.getElementById('cnpj').value : null,
                cpf: isPJ ? null : document.getElementById('cpf').value,
                address: { 
                    logradouro: document.getElementById('logradouro').value, 
                    numero: document.getElementById('numero').value, 
                    bairro: document.getElementById('bairro').value, 
                    cidade: document.getElementById('cidade').value, 
                    estado: document.getElementById('estado').value, 
                    cep: document.getElementById('cep').value 
                } 
            };
            Auth.login(user);
            const msg = document.getElementById('feedback-msg');
            msg.textContent = 'Cadastro realizado com sucesso! Redirecionando...';
            msg.className = 'feedback-msg feedback-success';
            msg.classList.remove('hidden');
            setTimeout(() => { window.location.href = 'minha-conta.html'; }, 1800);
        });
    }
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', e => {
            e.preventDefault();
            const emailVal = document.getElementById('email').value;
            
            // Tenta encontrar o usuário real para pegar o nome correto
            const allUsers = Auth.getAllUsers();
            const realUser = allUsers.find(u => u.email === emailVal);
            
            let displayName = '';
            if (realUser) {
                displayName = realUser.name;
            } else {
                // Fallback: deriva o nome do e-mail apenas se não houver cadastro prévio
                displayName = emailVal.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            }

            Auth.login({
                name: displayName || 'Usuário EcoStore',
                email: emailVal,
                phone: realUser?.phone || '(11) 99999-9999',
                address: realUser?.address || { logradouro: 'Av. Paulista', numero: '1578', bairro: 'Bela Vista', cidade: 'São Paulo', estado: 'SP', cep: '01310-200' }
            });
            showToast('Login realizado! Bem-vindo(a) de volta.');
            setTimeout(() => { window.location.href = 'minha-conta.html'; }, 1200);
        });
    }
}

// ============================================================
// DASHBOARD (minha-conta.html)
// ============================================================
function initDashboard() {
    // ---- FILL USER DATA ----
    if (Auth.isLoggedIn()) {
        const user = Auth.getUser();
        const dashName = document.getElementById('dash-user-name');
        const dashFull = document.getElementById('dash-full-name');
        const dashEmail = document.getElementById('dash-email');
        const dashPhone = document.getElementById('dash-phone');
        const dashAddr = document.getElementById('dash-address-box');

        if (dashName) dashName.textContent = user.name;
        if (dashFull) dashFull.textContent = user.name;
        if (dashEmail) dashEmail.textContent = user.email;
        if (dashPhone) dashPhone.textContent = user.phone || 'Não informado';
        if (dashAddr && user.address) {
            dashAddr.innerHTML = 
                '<p class="info-value">' + user.address.logradouro + ', ' + user.address.numero + '</p>' +
                '<p class="info-value">' + user.address.bairro + ', ' + user.address.cidade + ' - ' + user.address.estado + '</p>' +
                '<p class="info-value">CEP: ' + user.address.cep + '</p>';
        }
    } else {
        // Redireciona se tentar acessar a área sem estar logado
        if (window.location.pathname.includes('minha-conta.html')) {
            window.location.href = 'login.html';
        }
    }

    const editUserForm = document.getElementById('edit-user-form');
    if (editUserForm) {
        editUserForm.addEventListener('submit', e => {
            e.preventDefault();
            const user = Auth.getUser();
            const oldEmail = user.email;
            
            user.name = document.getElementById('edit-name').value;
            user.email = document.getElementById('edit-email').value;
            user.phone = document.getElementById('edit-phone').value;

            // Atualiza a sessão
            localStorage.setItem('ecostore_user', JSON.stringify(user));
            
            // Atualiza na lista global de usuários também
            const allUsers = Auth.getAllUsers();
            const idx = allUsers.findIndex(u => u.email === oldEmail);
            if (idx > -1) {
                allUsers[idx] = { ...allUsers[idx], ...user };
                localStorage.setItem('ecostore_all_users', JSON.stringify(allUsers));
            }

            showToast('Dados atualizados com sucesso!');
            closeEditUserModal();
            initDashboard(); // Re-renderiza os dados na tela
            updateHeaderAuth(); // Atualiza o nome no cabeçalho
        });
    }

    const editAddressForm = document.getElementById('edit-address-form');
    if (editAddressForm) {
        editAddressForm.addEventListener('submit', e => {
            e.preventDefault();
            const user = Auth.getUser();
            user.address = {
                cep: document.getElementById('edit-addr-cep').value,
                logradouro: document.getElementById('edit-addr-logradouro').value,
                numero: document.getElementById('edit-addr-numero').value,
                bairro: document.getElementById('edit-addr-bairro').value,
                cidade: document.getElementById('edit-addr-cidade').value,
                estado: document.getElementById('edit-addr-estado').value
            };
            localStorage.setItem('ecostore_user', JSON.stringify(user));
            const allUsers = Auth.getAllUsers();
            const idx = allUsers.findIndex(u => u.email === user.email);
            if (idx > -1) {
                allUsers[idx].address = user.address;
                localStorage.setItem('ecostore_all_users', JSON.stringify(allUsers));
            }
            showToast('Endereço atualizado!');
            closeEditAddressModal();
            initDashboard();
        });
    }

    const navBtns = document.querySelectorAll('.nav-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    if (navBtns.length > 0) {
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                navBtns.forEach(b => b.classList.remove('active'));
                tabPanes.forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const target = document.getElementById(btn.dataset.tab);
                if (target) target.classList.add('active');
            });
        });
    }

    const ordersContainer = document.getElementById('orders-list-container');
    if (!ordersContainer) return;

    const staticOrders = [
        { id: '#10592', date: '28/04/2026', status: 'enviado', statusLabel: 'Enviado', total: 159.80, items: [{ name: 'Whey Protein Sabor Baunilha 900g', qty: 1, price: 159.90 }, { name: 'Chá Verde Orgânico', qty: 1, price: 22.50 }], address: { logradouro: 'Av. Paulista', numero: '1578', bairro: 'Bela Vista', cidade: 'São Paulo', estado: 'SP', cep: '01310-200' } },
        { id: '#09884', date: '10/04/2026', status: 'entregue', statusLabel: 'Entregue', total: 89.00, items: [{ name: 'Creme Hidratante Vegano Facial Noturno', qty: 1, price: 89.00 }], address: { logradouro: 'Av. Paulista', numero: '1578', bairro: 'Bela Vista', cidade: 'São Paulo', estado: 'SP', cep: '01310-200' } }
    ];

    const allOrders = [...Orders.getAll(), ...staticOrders];
    renderOrdersList(allOrders, ordersContainer);

    const searchInput = document.getElementById('order-search');
    const statusFilter = document.getElementById('order-status-filter');
    const dateStart = document.getElementById('order-date-start');
    const dateEnd = document.getElementById('order-date-end');

    function applyFilters() {
        const searchVal = (searchInput?.value || '').toLowerCase().trim();
        const statusVal = (statusFilter?.value || '').toLowerCase().trim();
        const startVal = dateStart?.value; // YYYY-MM-DD
        const endVal = dateEnd?.value;

        const filtered = allOrders.filter(o => {
            const matchSearch = !searchVal || o.id.toLowerCase().includes(searchVal);
            const matchStatus = !statusVal || o.status === statusVal;
            
            let matchDate = true;
            if (startVal || endVal) {
                const [d, m, y] = o.date.split('/');
                const oDate = new Date(y, m - 1, d);
                oDate.setHours(0,0,0,0);

                if (startVal) {
                    const sDate = new Date(startVal);
                    sDate.setMinutes(sDate.getMinutes() + sDate.getTimezoneOffset());
                    sDate.setHours(0,0,0,0);
                    if (oDate < sDate) matchDate = false;
                }
                if (endVal) {
                    const eDate = new Date(endVal);
                    eDate.setMinutes(eDate.getMinutes() + eDate.getTimezoneOffset());
                    eDate.setHours(23,59,59,999);
                    if (oDate > eDate) matchDate = false;
                }
            }

            return matchSearch && matchStatus && matchDate;
        });

        renderOrdersList(filtered, ordersContainer);
    }

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (dateStart) dateStart.addEventListener('change', applyFilters);
    if (dateEnd) dateEnd.addEventListener('change', applyFilters);
}

function renderOrdersList(orders, container) {
    const fmt = v => 'R$ ' + v.toFixed(2).replace('.', ',');
    if (orders.length === 0) { container.innerHTML = '<div class="orders-empty"><i class="fas fa-box-open"></i><p>Nenhum pedido encontrado.</p></div>'; return; }
    container.innerHTML = orders.map(order => '<div class="order-card" data-status="' + order.status + '">' +
        '<div class="order-header" onclick="toggleOrderDetails(this)">' +
        '<div class="order-info-col"><span class="order-label">Pedido</span><strong>' + order.id + '</strong></div>' +
        '<div class="order-info-col"><span class="order-label">Data</span><strong>' + order.date + '</strong></div>' +
        '<div class="order-info-col"><span class="order-label">Status</span><span class="status-badge status-' + order.status + '">' + order.statusLabel + '</span></div>' +
        '<div class="order-info-col"><span class="order-label">Total</span><strong>' + fmt(order.total) + '</strong></div>' +
        '<div class="order-toggle-icon"><i class="fas fa-chevron-down"></i></div></div>' +
        '<div class="order-details hidden"><div class="details-grid">' +
        '<div class="details-items"><h4>Itens do Pedido</h4><ul>' + order.items.map(i => '<li>' + i.qty + 'x ' + i.name + ' — ' + fmt(i.price) + '</li>').join('') + '</ul></div>' +
        '<div class="details-address"><h4>Endereço de Entrega</h4><p>' + order.address.logradouro + ', ' + order.address.numero + '</p><p>' + order.address.bairro + ' — ' + order.address.cidade + ' / ' + order.address.estado + '</p><p>CEP: ' + order.address.cep + '</p></div>' +
        '</div></div></div>').join('');
}

window.toggleOrderDetails = function(headerEl) {
    const card = headerEl.closest('.order-card');
    card.classList.toggle('expanded');
    card.querySelector('.order-details').classList.toggle('hidden');
};

window.openEditUserModal = function() {
    const user = Auth.getUser();
    if (!user) return;
    document.getElementById('edit-name').value = user.name || '';
    document.getElementById('edit-email').value = user.email || '';
    document.getElementById('edit-phone').value = user.phone || '';
    document.getElementById('edit-user-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('edit-user-modal').classList.add('visible'), 10);
};

window.closeEditUserModal = function() {
    document.getElementById('edit-user-modal').classList.remove('visible');
    setTimeout(() => document.getElementById('edit-user-modal').classList.add('hidden'), 300);
};

window.openEditAddressModal = function() {
    const user = Auth.getUser();
    if (!user || !user.address) return;
    const a = user.address;
    document.getElementById('edit-addr-cep').value = a.cep || '';
    document.getElementById('edit-addr-logradouro').value = a.logradouro || '';
    document.getElementById('edit-addr-numero').value = a.numero || '';
    document.getElementById('edit-addr-bairro').value = a.bairro || '';
    document.getElementById('edit-addr-cidade').value = a.cidade || '';
    document.getElementById('edit-addr-estado').value = a.estado || '';
    document.getElementById('edit-address-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('edit-address-modal').classList.add('visible'), 10);
};

window.closeEditAddressModal = function() {
    document.getElementById('edit-address-modal').classList.remove('visible');
    setTimeout(() => document.getElementById('edit-address-modal').classList.add('hidden'), 300);
};

window.buscaCepEdit = function() {
    const cep = document.getElementById('edit-addr-cep').value.replace(/\D/g, '');
    if (cep.length >= 8) {
        document.getElementById('edit-addr-logradouro').value = 'Av. Paulista';
        document.getElementById('edit-addr-bairro').value = 'Bela Vista';
        document.getElementById('edit-addr-cidade').value = 'São Paulo';
        document.getElementById('edit-addr-estado').value = 'SP';
        showToast('Endereço encontrado!');
    } else {
        showToast('CEP inválido.', 'error');
    }
};
