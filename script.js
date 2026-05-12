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
// CARREGA CORES DO SITE AO INICIAR
// ============================================================
(async function applySavedColors() {
    try {
        const { data: stores } = await supabase.from('store_settings').select('primary_color, text_color').limit(1);
        const store = (stores && stores.length > 0) ? stores[0] : null;
        const primary = store?.primary_color;
        const text = store?.text_color;
        if (primary) document.documentElement.style.setProperty('--primary-green', primary);
        if (text) document.documentElement.style.setProperty('--text-main', text);
        if (primary) {
            const num = parseInt(primary.slice(1), 16);
            const f = 0.3;
            const r = Math.max(0, (num >> 16) - Math.round((num >> 16) * f));
            const g = Math.max(0, ((num >> 8) & 0xFF) - Math.round(((num >> 8) & 0xFF) * f));
            const b = Math.max(0, (num & 0xFF) - Math.round((num & 0xFF) * f));
            document.documentElement.style.setProperty('--dark-green', '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1));
        }
    } catch(e) { /* silencioso */ }
})();

// GLOBAL DATA CACHES
window.APP_DATA = {
    products: [],
    banners: [],
    orders: [],
    users: []
};

// ============================================================
// PRODUCT STORE MODULE
// ============================================================
const ProductStore = {
    _cacheKey: 'ecostore_cache_products',
    loadCache() {
        try {
            const cached = localStorage.getItem(this._cacheKey);
            if (cached) window.APP_DATA.products = JSON.parse(cached);
        } catch (e) { console.error('Cache load error', e); }
    },
    async fetchAll() {
        const { data, error } = await supabase.from('products').select('*').order('id', { ascending: false });
        if (!error && data && data.length > 0) {
            const newProducts = data.map(p => ({
                ...p,
                oldPrice: p.old_price,
                promoActive: p.promo_active,
                promoPrice: p.promo_price
            }));
            const cacheStr = JSON.stringify(newProducts);
            if (localStorage.getItem(this._cacheKey) !== cacheStr) {
                window.APP_DATA.products = newProducts;
                try { localStorage.setItem(this._cacheKey, cacheStr); } catch(e) { console.warn('Cache cheio'); }
                return true; // Mudou
            }
        } else if (!error && data && data.length === 0) {
            if (typeof PRODUCTS !== 'undefined') {
                const { data: inserted, error: insertErr } = await supabase.from('products').insert(PRODUCTS.map(p => {
                    const obj = {...p, old_price: p.oldPrice, promo_active: p.promoActive || !!p.offer, promo_price: p.price};
                    delete obj.id; // let supabase generate id
                    delete obj.oldPrice;
                    delete obj.promoActive;
                    delete obj.promoPrice;
                    return obj;
                })).select();
                if (!insertErr && inserted) {
                    const newProducts = inserted.map(p => ({
                        ...p,
                        oldPrice: p.old_price,
                        promoActive: p.promo_active,
                        promoPrice: p.promo_price
                    }));
                    const cacheStr = JSON.stringify(newProducts);
                    window.APP_DATA.products = newProducts;
                    try { localStorage.setItem(this._cacheKey, cacheStr); } catch(e) { console.warn('Cache cheio'); }
                    return true;
                }
            }
        }
        return false;
    },
    getAll() { return window.APP_DATA.products; },
    getById(id) { return this.getAll().find(p => p.id == id); }
};

// ============================================================
// BANNERS STORE MODULE
// ============================================================
const BannerStore = {
    _cacheKey: 'ecostore_cache_banners',
    loadCache() {
        try {
            const cached = localStorage.getItem(this._cacheKey);
            if (cached) window.APP_DATA.banners = JSON.parse(cached);
        } catch (e) {}
    },
    async fetchAll() {
        const { data, error } = await supabase.from('banners').select('*');
        if (!error && data) {
            const newBanners = data.map(b => ({
                ...b,
                btnText: b.btn_text,
                btnLink: b.btn_link
            }));
            const cacheStr = JSON.stringify(newBanners);
            if (localStorage.getItem(this._cacheKey) !== cacheStr) {
                window.APP_DATA.banners = newBanners;
                try { localStorage.setItem(this._cacheKey, cacheStr); } catch(e) { console.warn('Cache cheio'); }
                return true;
            }
        }
        return false;
    },
    getAll() { return window.APP_DATA.banners; }
};

// ============================================================
// CART MODULE
// ============================================================
const Cart = {
    _key: 'ecostore_cart',
    getItems() { return JSON.parse(localStorage.getItem(this._key) || '[]'); },
    save(items) {
        localStorage.setItem(this._key, JSON.stringify(items));
        document.dispatchEvent(new CustomEvent('cartChanged'));
        // Auto-sync to cloud if user is logged in (debounced)
        clearTimeout(this._syncTimer);
        this._syncTimer = setTimeout(() => this.saveToCloud(), 800);
    },
    add(productId) {
        const product = ProductStore.getById(productId);
        if (!product) return;
        const items = this.getItems();
        const existing = items.find(i => i.id === productId && !i.isVariation);
        const actualPrice = (product.promoActive && product.promoPrice) ? product.promoPrice : product.price;
        if (existing) {
            existing.qty += 1;
            existing.price = actualPrice;
        } else {
            items.push({ id: product.id, name: product.name, price: actualPrice, image: product.image, qty: 1 });
        }
        this.save(items);
    },
    addCustom(productId, customName, customPrice) {
        const product = ProductStore.getById(productId);
        if (!product) return;
        const items = this.getItems();
        const existing = items.find(i => i.id === productId && i.name === customName);
        if (existing) {
            existing.qty += 1;
            existing.price = customPrice;
        } else {
            items.push({ id: product.id, name: customName, price: customPrice, image: product.image, qty: 1, isVariation: true });
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
    clear() {
        localStorage.removeItem(this._key);
        document.dispatchEvent(new CustomEvent('cartChanged'));
        this.clearCloud();
    },
    total() { return this.getItems().reduce((s, i) => s + i.price * i.qty, 0); },
    count() { return this.getItems().reduce((s, i) => s + i.qty, 0); },

    // ---- Cloud Sync ----
    async saveToCloud() {
        const user = Auth.isLoggedIn() ? Auth.getUser() : null;
        if (!user || !user.email || !window.supabase) return;
        const items = this.getItems();
        // Upsert: insert or update based on customer_email
        await supabase.from('carts').upsert(
            [{ customer_email: user.email, items: items, updated_at: new Date().toISOString() }],
            { onConflict: 'customer_email' }
        );
    },

    async loadFromCloud(email) {
        if (!window.supabase || !email) return;
        const { data } = await supabase.from('carts').select('items').eq('customer_email', email).single();
        if (data && data.items && data.items.length > 0) {
            // Merge: cloud items take priority if local cart is empty
            const localItems = this.getItems();
            if (localItems.length === 0) {
                localStorage.setItem(this._key, JSON.stringify(data.items));
                document.dispatchEvent(new CustomEvent('cartChanged'));
                showToast('\uD83D\uDED2 Seu carrinho foi restaurado!');
            }
        }
    },

    async clearCloud() {
        const user = Auth.isLoggedIn() ? Auth.getUser() : null;
        if (!user || !user.email || !window.supabase) return;
        await supabase.from('carts').delete().eq('customer_email', user.email);
    }
};


// ============================================================
// AUTH MODULE
// ============================================================
const Auth = {
    _key: 'ecostore_user',
    isLoggedIn() { return !!localStorage.getItem(this._key); },
    getUser() { return JSON.parse(localStorage.getItem(this._key) || 'null'); },
    async fetchAllUsers() {
        const { data, error } = await supabase.from('customers').select('*');
        if (!error && data) window.APP_DATA.users = data;
    },
    getAllUsers() { return window.APP_DATA.users; },

    // Register a new customer with password
    async register(userData) {
        const { data: existing } = await supabase.from('customers').select('id').eq('email', userData.email).single();
        if (existing) return { success: false, error: 'E-mail já cadastrado.' };

        const { error } = await supabase.from('customers').insert([{
            name: userData.name,
            email: userData.email,
            password: userData.password,
            phone: userData.phone || null,
            cpf: userData.cpf || null,
            cnpj: userData.cnpj || null,
            is_pj: !!userData.cnpj,
            address: userData.address || null,
            status: 'ativo'
        }]);
        if (error) return { success: false, error: error.message };
        await this.fetchAllUsers();
        return { success: true };
    },

    // Login: validate email + password against Supabase
    async loginWithPassword(email, password) {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('email', email)
            .eq('password', password)
            .single();
        if (error || !data) return { success: false, error: 'E-mail ou senha incorretos.' };
        localStorage.setItem(this._key, JSON.stringify(data));
        // Restore cloud cart after login
        await Cart.loadFromCloud(email);
        return { success: true, user: data };
    },

    logout() { localStorage.removeItem(this._key); }
};


// ============================================================
// ORDERS MODULE
// ============================================================
// Mapa de status → label legível (espelha o admin)
const ORDER_STATUS_MAP = {
    aguardando:  'Aguardando Pagamento',
    separacao:   'Em Separação',
    saiu:        'Saiu para Entrega',
    entregue:    'Entregue',
    cancelado:   'Cancelado',
    processando: 'Processando',
    enviado:     'Enviado'
};

const Orders = {
    _latestOrders: [], // Cache global para acompanhamento
    async fetchAll() {
        const { data, error } = await supabase.from('orders').select('*').order('id', { ascending: false });
        if (!error && data) {
            // Normaliza campos para o padrão usado no front-end
            window.APP_DATA.orders = data.map(o => ({
                ...o,
                // ID formatado com #
                id: '#' + String(o.id).padStart(5, '0'),
                // Garante statusLabel sempre preenchido (usa status_label do banco ou gera pelo map)
                statusLabel: o.status_label || ORDER_STATUS_MAP[o.status] || o.status,
                // Data formatada para pt-BR
                date: o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : '—',
                // items e address já vêm como JSON do Supabase
                items: o.items || [],
                address: (typeof o.address === 'string') ? (() => { try { return JSON.parse(o.address); } catch(e) { return {}; } })() : (o.address || {})
            }));
        }
    },
    getAll() { return window.APP_DATA.orders; },
    // Retorna somente os pedidos do usuário logado
    getByUser(email) {
        return this.getAll().filter(o => o.client_email === email);
    },
    async create(items, total, address) {
        const user = Auth.getUser();
        const newOrder = {
            client_email: user ? user.email : 'anonimo@email.com',
            client_name: user ? user.name : 'Cliente Anônimo',
            total: total,
            status: 'processando',
            status_label: 'Processando',
            items: items,
            address: address
        };
        const { data, error } = await supabase.from('orders').insert([newOrder]).select().single();
        if (data) {
            // Normaliza o pedido recém-criado antes de adicionar ao cache
            const normalized = {
                ...data,
                id: '#' + String(data.id).padStart(5, '0'),
                statusLabel: data.status_label || ORDER_STATUS_MAP[data.status] || data.status,
                date: data.created_at ? new Date(data.created_at).toLocaleDateString('pt-BR') : '—',
                items: data.items || [],
                address: data.address || {}
            };
            window.APP_DATA.orders.unshift(normalized);
            
            // Realiza a baixa de estoque
            this.decrementStock(items);
            
            return normalized;
        }
        return newOrder;
    },
    async decrementStock(items) {
        for (const item of items) {
            try {
                const { data } = await supabase.from('products').select('stock').eq('id', item.id).single();
                if (data) {
                    const newStock = Math.max(0, (data.stock || 0) - item.qty);
                    await supabase.from('products').update({ stock: newStock }).eq('id', item.id);
                }
            } catch(e) { console.error('Erro ao baixar estoque:', e); }
        }
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

    const banners = BannerStore.getAll();
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
    
    // Validar estoque
    if (product.stock <= 0) {
        showToast('Produto esgotado no momento!', 'error');
        return;
    }

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
    updateHeaderAuth(); // -> Lê localStorage, sem esperar Supabase
    initCartPage();     // -> Carrinho também usa localStorage, renderiza imediato

    // Sticky header
    const header = document.getElementById('header');
    if (header) { window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 50)); }

    // CARGA IMEDIATA VIA CACHE (localStorage)
    ProductStore.loadCache();
    BannerStore.loadCache();

    // Renderiza a interface instantaneamente com o que tiver no cache
    renderPromoProducts();
    renderAllProducts();
    initCategoriesMenu();
    initHeroBanner();

    initCheckoutPage();
    if (typeof initAuthPages === 'function') initAuthPages();
    if (typeof initDashboard === 'function') initDashboard();
    initSearch();
    syncCurrentToAllUsers();

    // FETCH EM BACKGROUND DO SUPABASE
    if (window.supabase) {
        // Não bloqueia o resto da execução
        Promise.all([
            ProductStore.fetchAll(),
            BannerStore.fetchAll(),
            Auth.fetchAllUsers(),
            Orders.fetchAll() // Carrega pro cache local, mas a tela de pedidos tem seu próprio polling
        ]).then(([productsChanged, bannersChanged]) => {
            // Se houve mudança no banco, atualiza a UI
            if (productsChanged) {
                renderPromoProducts();
                renderAllProducts();
                initCategoriesMenu();
            }
            if (bannersChanged) {
                initHeroBanner();
            }
        });
    }
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

    renderGrid('promo-product-grid', 'promo-pagination', products, page, 10, 'promo');
}

function renderAllProducts(page = 1, filterCategory = null, filterText = null, filterPromo = false) {
    let products = ProductStore.getAll();

    if (filterCategory) {
        products = products.filter(p => p.category === filterCategory);
    }

    if (filterPromo) {
        products = products.filter(p => p.promoActive);
        
        const getDiscountPct = (p) => {
            // 1. Try to extract from 'offer' string (e.g. "-20%" -> 20)
            if (p.offer) {
                const match = p.offer.match(/(\d+)/);
                if (match) return parseInt(match[1]);
            }
            
            // 2. Math fallback
            const getPrice = (v) => {
                if (typeof v === 'number') return v;
                if (!v) return 0;
                return parseFloat(String(v).replace(',', '.').replace(/[^\d.]/g, '')) || 0;
            };

            const price = getPrice(p.price);
            const promo = getPrice(p.promoPrice);
            if (price > 0 && promo > 0 && price > promo) {
                return Math.round(((price - promo) / price) * 100);
            }
            return 0;
        };

        // Order by extracted/calculated percentage
        products.sort((a, b) => getDiscountPct(b) - getDiscountPct(a));
    }

    if (filterText) {
        const query = filterText.toLowerCase().trim();
        products = products.filter(p => 
            p.name.toLowerCase().includes(query) || 
            (p.brand && p.brand.toLowerCase().includes(query)) ||
            (p.barcode && p.barcode.toLowerCase().includes(query))
        );
    }

    renderGrid('all-product-grid', 'all-pagination', products, page, 20, 'all', filterCategory, filterText, filterPromo);
}

window.filterByPromo = function() {
    renderAllProducts(1, null, null, true);
    const allTitle = document.getElementById('all-products-title');
    if (allTitle) allTitle.innerHTML = `<i class="fas fa-tag"></i> Melhores Ofertas (Maior Desconto)`;
    
    // Hide hero and promo section to focus on results
    const hero = document.querySelector('.hero');
    if (hero) hero.style.display = 'none';
    const promoSec = document.getElementById('promo-section');
    if (promoSec) promoSec.style.display = 'none';

    // Scroll to products
    const section = document.getElementById('all-products-section');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
};

function renderGrid(gridId, paginationId, products, page, perPage, type, cat = null, text = null, promo = false) {
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
        const hasVariations = product.variations && product.variations.length > 0;
        const btnText = hasVariations ? 'Escolher Opções' : 'Comprar';
        const btnAction = hasVariations ? `openProductDetail(${product.id})` : `addToCart(${product.id})`;
        const btnIcon = hasVariations ? 'fa-list-ul' : 'fa-cart-plus';

        // Calculate discount percentage if not provided but promo is active
        let offerBadge = product.offer || '';
        if (!offerBadge && product.promoActive && product.promoPrice && product.price > product.promoPrice) {
            const discount = Math.round(((product.price - product.promoPrice) / product.price) * 100);
            if (discount > 0) offerBadge = `-${discount}%`;
        }

        const isOut = product.stock <= 0;
        const btnClass = isOut ? 'btn-buy btn-out-of-stock' : 'btn-buy';
        const finalBtnText = isOut ? 'Esgotado' : btnText;
        const finalBtnAction = isOut ? '' : btnAction;
        const finalBtnIcon = isOut ? 'fa-times-circle' : btnIcon;

        grid.innerHTML += '<div class="product-card">' +
            (offerBadge ? '<span class="badge-offer">' + offerBadge + '</span>' : '') +
            '<img src="' + product.image + '" alt="' + product.name + '" class="product-img" onclick="openProductDetail(' + product.id + ')" style="cursor:pointer">' +
            '<span class="product-category">' + product.category + '</span>' +
            '<h3 class="product-title" onclick="openProductDetail(' + product.id + ')" style="cursor:pointer">' + product.name + '</h3>' +
            '<div class="product-price">' + (product.promoActive && product.promoPrice ? fmt(product.promoPrice) : fmt(product.price)) + (product.promoActive && product.promoPrice ? '<span>' + fmt(product.price) + '</span>' : '') + '</div>' +
            '<button class="' + btnClass + '" onclick="' + finalBtnAction + '" ' + (isOut ? 'disabled' : '') + '><i class="fas ' + finalBtnIcon + '"></i> ' + finalBtnText + '</button>' +
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
                    else renderAllProducts(i, cat, text, promo);
                    
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
        
        const singleViewSection = document.getElementById('single-product-view-section');
        if (singleViewSection && !singleViewSection.classList.contains('hidden')) {
            backToGrid();
        }
        
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
    const hero = document.querySelector('.hero');
    const promoSec = document.getElementById('promo-section');

    if (allTitle) {
        allTitle.innerHTML = category ? `<i class="fas fa-th-large"></i> Categoria: ${category}` : `<i class="fas fa-th-large"></i> Todos os Produtos`;
    }
    
    // Hide/Show sections based on filter
    if (category) {
        if (hero) hero.style.display = 'none';
        if (promoSec) promoSec.style.display = 'none';
    } else {
        if (hero) hero.style.display = 'block';
        renderPromoProducts(); // This handles showing the promo section if there are products
    }

    // Fechar o dropdown após clicar
    const dropdown = document.getElementById('categories-dropdown');
    if (dropdown) dropdown.classList.remove('show');

    // Voltar para a grid caso esteja na visualização única
    const singleViewSection = document.getElementById('single-product-view-section');
    if (singleViewSection && !singleViewSection.classList.contains('hidden')) {
        backToGrid();
    }

    // Scroll to products
    const section = document.getElementById('all-products-section');
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
    let selectedPrice = (product.promoActive && product.promoPrice) ? product.promoPrice : product.price;
    let selectedOption = null;

    // Hide Grid and Hero
    const hero = document.querySelector('.hero');
    if (hero) hero.style.display = 'none';
    const promoSection = document.getElementById('promo-section');
    if (promoSection) promoSection.style.display = 'none';
    const allProductsSection = document.getElementById('all-products-section');
    if (allProductsSection) allProductsSection.style.display = 'none';
    
    // Show Single View
    const singleViewSection = document.getElementById('single-product-view-section');
    if (singleViewSection) singleViewSection.classList.remove('hidden');

    document.getElementById('single-img').src = product.image;
    document.getElementById('single-category').textContent = product.category;
    document.getElementById('single-title').textContent = product.name;
    document.getElementById('single-description').textContent = product.description || 'Este produto premium foi selecionado especialmente para você.';
    
    const priceEl = document.getElementById('single-price');
    const oldPriceEl = document.getElementById('single-old-price');
    
    function updateDisplayPrice(price) {
        priceEl.textContent = fmt(price);
        if (product.promoActive && product.promoPrice && !selectedOption) {
            oldPriceEl.textContent = fmt(product.price);
            oldPriceEl.style.display = 'inline';
        } else {
            oldPriceEl.style.display = 'none';
        }
    }

    updateDisplayPrice(selectedPrice);

    // Variations Logic
    const varContainer = document.getElementById('single-variations-container');
    const varList = document.getElementById('single-variations-list');
    if (product.variations && product.variations.length > 0) {
        varContainer.classList.remove('hidden');
        varList.innerHTML = product.variations.map((v, idx) => 
            `<button class="variation-btn" onclick="selectVariation(${idx}, ${v.price || selectedPrice}, '${v.name}')" style="padding: 10px 18px; border: 2px solid #ddd; border-radius: 6px; background: #fff; cursor: pointer; font-weight: 500; transition: all 0.2s;">${v.name}</button>`
        ).join('');

        window.selectVariation = (idx, price, name) => {
            selectedPrice = price;
            selectedOption = name;
            updateDisplayPrice(price);
            document.querySelectorAll('.variation-btn').forEach((b, i) => {
                b.style.borderColor = (i === idx) ? 'var(--primary-green)' : '#ddd';
                b.style.background = (i === idx) ? '#eef7f2' : '#fff';
                b.style.color = (i === idx) ? 'var(--primary-green)' : 'inherit';
            });
        };
    } else {
        varContainer.classList.add('hidden');
    }

    document.getElementById('single-qty').value = 1;
    
    // Bind Add to Cart
    const addBtn = document.getElementById('single-add-btn');
    addBtn.onclick = () => {
        if (product.variations && product.variations.length > 0 && !selectedOption) {
            showToast('Por favor, selecione uma opção antes de adicionar ao carrinho.', 'error');
            // Shake effect on variations container
            varContainer.style.animation = 'shake 0.5s';
            setTimeout(() => { varContainer.style.animation = ''; }, 500);
            return;
        }

        const qty = parseInt(document.getElementById('single-qty').value);
        const cartItemName = selectedOption ? `${product.name} - ${selectedOption}` : product.name;
        
        for(let i=0; i<qty; i++) {
            if (selectedOption) {
                Cart.addCustom(id, cartItemName, selectedPrice);
            } else {
                Cart.add(id);
            }
        }
        showToast(qty + 'x "' + cartItemName.substring(0, 20) + '..." adicionado!');
    };

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.backToGrid = function() {
    // Hide Single View
    const singleViewSection = document.getElementById('single-product-view-section');
    if (singleViewSection) singleViewSection.classList.add('hidden');
    
    // Show Grid and Hero
    const hero = document.querySelector('.hero');
    if (hero) hero.style.display = 'block';
    
    renderPromoProducts(); // Re-exibe promos se houver
    
    const allProductsSection = document.getElementById('all-products-section');
    if (allProductsSection) allProductsSection.style.display = 'block';
    
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
    const wrapper = document.getElementById('user-nav-wrapper');
    if (!link || !wrapper) return;

    if (Auth.isLoggedIn()) {
        const user = Auth.getUser();
        const firstName = (user.name || 'Cliente').split(' ')[0];
        const isOnAccountPage = window.location.pathname.includes('minha-conta');

        icon.className = 'fas fa-user-circle';
        link.classList.add('user-logged-in');
        link.title = 'Olá, ' + firstName;

        // Use onclick to avoid stacking multiple listeners
        link.href = 'javascript:void(0)';
        link.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleUserDropdown(wrapper, firstName, isOnAccountPage);
        };

    } else {
        link.href = 'login.html';
        link.onclick = null;
        icon.className = 'far fa-user';
        link.classList.remove('user-logged-in');
    }

    // Close dropdown when clicking outside — register ONCE only
    if (!document._dropdownListenerSet) {
        document._dropdownListenerSet = true;
        document.addEventListener('click', function(e) {
            const dropdown = document.getElementById('user-dropdown');
            const w = document.getElementById('user-nav-wrapper');
            if (dropdown && w && !w.contains(e.target)) {
                dropdown.remove();
            }
        });
    }
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
// CHECKOUT PAGE - TRANSPARENT CHECKOUT
// ============================================================
let mp = null;
let cardPaymentBrickController = null;

async function initCheckoutPage() {
    const checkoutWrapper = document.getElementById('checkout-wrapper');
    if (!checkoutWrapper) return;
    const items = Cart.getItems();
    if (items.length === 0) { window.location.href = 'carrinho.html'; return; }
    
    const fmt = v => 'R$ ' + v.toFixed(2).replace('.', ',');
    const summaryBody = document.getElementById('checkout-summary-body');
    summaryBody.innerHTML = items.map(i => '<tr><td><img src="' + i.image + '" class="cart-thumb"> ' + i.name + '</td><td class="text-center">' + i.qty + 'x</td><td class="cart-subtotal">' + fmt(i.price * i.qty) + '</td></tr>').join('');
    document.getElementById('checkout-total-value').textContent = fmt(Cart.total());
    
    const user = Auth.getUser();
    const addr = user?.address || { logradouro: '—', numero: '—', bairro: '—', cidade: '—', estado: '—', cep: '—' };
    document.getElementById('checkout-address').textContent = addr.logradouro + ', ' + addr.numero + ' — ' + addr.bairro + ', ' + addr.cidade + '/' + addr.estado + ' | CEP: ' + addr.cep;

    // --- MERCADO PAGO INITIALIZATION ---
    const MP_PUBLIC_KEY = 'APP_USR-c404bdea-25d7-4dd2-9514-c32c13ebb328'; 
    mp = new MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });

    // --- TAB SWITCHING ---
    const tabs = document.querySelectorAll('.payment-tab');
    const contents = document.querySelectorAll('.payment-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const type = tab.dataset.type;
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`payment-${type}-content`)?.classList.add('active');
            
            if (type === 'card' && !cardPaymentBrickController) initCardBrick();
            if (type === 'pix') initPixBrick();
        });
    });

    // Default: Card
    initCardBrick();

    // Confirm Order Button
    document.getElementById('btn-confirm-order').addEventListener('click', async () => {
        const activeTab = document.querySelector('.payment-tab.active').dataset.type;
        
        if (activeTab === 'card') {
            // O Brick do cartão gerencia o envio via callback (onSubmit)
            // Mas podemos forçar o clique se necessário ou usar o botão do Brick
            // Para manter a UI consistente, vamos ocultar o botão global e usar o do Brick ou vice-versa.
            // Aqui vamos disparar o submit do Brick.
            showToast('Por favor, finalize o pagamento no formulário do cartão.', 'info');
        } else if (activeTab === 'pix') {
            // Lógica similar para PIX
        }
    });
}

async function initCardBrick() {
    const bricksBuilder = mp.bricks();
    const user = Auth.getUser();
    const total = Cart.total();

    const renderCardPaymentBrick = async (bricksBuilder) => {
        const settings = {
            initialization: {
                amount: total,
                payer: {
                    email: user?.email || '',
                },
            },
            customization: {
                visual: {
                    style: {
                        theme: 'default',
                    },
                },
            },
            callbacks: {
                onReady: () => {
                    const btn = document.getElementById('btn-confirm-order');
                    if (btn) btn.style.display = 'none';
                },
                onSubmit: async (formData) => {
                    return processTransparentPayment(formData);
                },
                onError: (error) => {
                    console.error('Brick Error:', error);
                    // Se o Brick falhar, mostra o botão global de novo como fallback
                    const btn = document.getElementById('btn-confirm-order');
                    if (btn) btn.style.display = 'block';
                },
            },
        };
        cardPaymentBrickController = await bricksBuilder.create(
            'cardPayment',
            'cardPaymentBrick_container',
            settings
        );
    };
    renderCardPaymentBrick(bricksBuilder);
}

async function initPixBrick() {
    // Implementação do Brick de PIX se desejado, ou lógica customizada
    const container = document.getElementById('pixPaymentBrick_container');
    container.innerHTML = `
        <div style="text-align:center; padding: 20px;">
            <i class="fas fa-qrcode" style="font-size: 40px; color: var(--primary-green); margin-bottom: 15px;"></i>
            <p>Ao confirmar, um código PIX será gerado para pagamento instantâneo.</p>
            <button onclick="processPixPayment()" class="btn-primary" style="margin-top: 15px;">Gerar PIX</button>
        </div>
    `;
}

async function processTransparentPayment(formData) {
    const btn = document.getElementById('btn-confirm-order');
    const user = Auth.getUser();
    const addr = user?.address || {};

    try {
        // 1. Cria o pedido no Supabase primeiro
        const order = await Orders.create(Cart.getItems(), Cart.total(), addr);
        
        // 2. Envia para o Supabase Edge Function processar o pagamento transparente
        const response = await fetch('https://kakeytwbtnwbkofintuh.supabase.co/functions/v1/mercadopago-checkout', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({
                transaction_amount: formData.transaction_amount,
                token: formData.token,
                description: 'Compra EcoStore - Pedido ' + order.id,
                installments: formData.installments,
                payment_method_id: formData.payment_method_id,
                issuer_id: formData.issuer_id,
                payer: {
                    email: formData.payer.email,
                    identification: formData.payer.identification
                },
                external_reference: order.id,
                orderId: order.id
            })
        });

        const result = await response.json();

        if (result.status === 'approved') {
            showToast('Pagamento aprovado com sucesso!', 'success');
            Cart.clear();
            setTimeout(() => { window.location.href = 'minha-conta.html'; }, 2000);
        } else if (result.status === 'in_process') {
            showToast('Pagamento em análise.', 'info');
            setTimeout(() => { window.location.href = 'minha-conta.html'; }, 2000);
        } else {
            showToast('Pagamento recusado: ' + (result.detail || 'Verifique os dados'), 'error');
        }
    } catch (err) {
        console.error('Erro no processamento:', err);
        showToast('Erro técnico ao processar pagamento.', 'error');
    }
}

async function processPixPayment() {
    const user = Auth.getUser();
    const addr = user?.address || {};
    
    try {
        const order = await Orders.create(Cart.getItems(), Cart.total(), addr);
        const response = await fetch('https://kakeytwbtnwbkofintuh.supabase.co/functions/v1/mercadopago-checkout', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({
                transaction_amount: Cart.total(),
                description: 'Compra EcoStore PIX - Pedido ' + order.id,
                payment_method_id: 'pix',
                payer: { 
                    email: user.email,
                    first_name: user.nome?.split(' ')[0] || 'Cliente',
                    last_name: user.nome?.split(' ').slice(1).join(' ') || 'EcoStore',
                    identification: {
                        type: 'CPF',
                        number: user.cpf?.replace(/\D/g, '') || ''
                    }
                },
                external_reference: order.id,
                orderId: order.id
            })
        });
        const result = await response.json();
        
        if (result.point_of_interaction) {
            const qrCode = result.point_of_interaction.transaction_data.qr_code;
            const qrCodeBase64 = result.point_of_interaction.transaction_data.qr_code_base64;
            
            const container = document.getElementById('pixPaymentBrick_container');
            container.innerHTML = `
                <div style="text-align:center;">
                    <h4>Escaneie o QR Code</h4>
                    <img src="data:image/png;base64,${qrCodeBase64}" style="width:200px; margin: 10px 0;">
                    <p style="font-size:12px; word-break:break-all; background:#eee; padding:10px;">${qrCode}</p>
                    <button class="btn-small btn-primary" onclick="navigator.clipboard.writeText('${qrCode}'); showToast('Código copiado!')">Copiar Código PIX</button>
                </div>
            `;
            showToast('PIX gerado! Aguardando pagamento...');
            
            // Esconde o botão de confirmação lateral
            const btnGlobal = document.getElementById('btn-confirm-order');
            if (btnGlobal) btnGlobal.style.display = 'none';
            
            // Inicia vigia
            const checkStatus = setInterval(async () => {
                const dbId = order.id.replace('#', '').replace(/^0+/, '');
                const { data } = await supabase.from('orders').select('status').eq('id', dbId).single();
                if (data && data.status === 'separacao') {
                    clearInterval(checkStatus);
                    Cart.clear();
                    showToast('Pagamento Confirmado!', 'success');
                    setTimeout(() => { window.location.href = 'minha-conta.html'; }, 2000);
                }
            }, 3000);
        }
    } catch (e) {
        showToast('Erro ao gerar PIX.', 'error');
    }
}


// ============================================================
// AUTH PAGES
// ============================================================
function initAuthPages() {
    const pjToggle = document.getElementById('pj-toggle');
    if (pjToggle) {
        const togglePJ = (isPJ) => {
            document.getElementById('pf-fields').classList.toggle('hidden', isPJ);
            document.getElementById('pj-fields').classList.toggle('hidden', !isPJ);
            // PF fields required
            document.getElementById('nome').required = !isPJ;
            document.getElementById('cpf').required = !isPJ;
            document.getElementById('telefone-pf').required = !isPJ;
            // PJ fields required
            document.getElementById('razao-social').required = isPJ;
            document.getElementById('cnpj').required = isPJ;
            document.getElementById('telefone-pj').required = isPJ;
        };
        pjToggle.addEventListener('change', e => togglePJ(e.target.checked));
        togglePJ(pjToggle.checked); // apply on load
    }
    const btnCep = document.getElementById('btn-busca-cep');
    if (btnCep) {
        btnCep.addEventListener('click', async () => {
            const cepInput = document.getElementById('cep');
            btnCep.disabled = true;
            btnCep.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            const result = await Validators.buscarCep(cepInput.value, {
                logradouro: document.getElementById('logradouro'),
                bairro:     document.getElementById('bairro'),
                cidade:     document.getElementById('cidade'),
                estado:     document.getElementById('estado')
            });
            btnCep.disabled = false;
            btnCep.innerHTML = '<i class="fas fa-search"></i>';
            if (result.ok) showToast('Endereço encontrado!');
            else showToast(result.msg, 'error');
        });
    }

    const cadastroForm = document.getElementById('cadastro-form');
    if (cadastroForm) {
        cadastroForm.addEventListener('submit', async e => {
            e.preventDefault();
            const isPJ     = document.getElementById('pj-toggle')?.checked;
            const btnSubmit = cadastroForm.querySelector('button[type="submit"]');
            const msg       = document.getElementById('feedback-msg');

            const showErr = text => {
                if (msg) { msg.textContent = text; msg.className = 'feedback-msg feedback-error'; msg.classList.remove('hidden'); }
                if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = 'Finalizar Cadastro'; }
            };

            if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = 'Validando...'; }

            // ---- Validações ----
            const nomeRaw  = isPJ ? document.getElementById('razao-social')?.value : document.getElementById('nome')?.value;
            const emailRaw = document.getElementById('email-cad').value;
            const password = document.getElementById('senha-cad')?.value;
            const telefone = isPJ ? document.getElementById('telefone-pj').value : document.getElementById('telefone-pf').value;
            const cpfRaw   = !isPJ ? document.getElementById('cpf').value : null;
            const cnpjRaw  = isPJ  ? document.getElementById('cnpj').value : null;

            // Nome/Razão Social: PJ só precisa de mín 3 chars
            if (!nomeRaw || nomeRaw.trim().length < 3)
                return showErr((isPJ ? 'Razão Social' : 'Nome') + ' deve ter pelo menos 3 caracteres.');

            if (!isPJ) {
                // Nome completo PF: precisa de sobrenome e sem números
                const nomeErr = Validators.nome(nomeRaw);
                if (nomeErr) return showErr(nomeErr);
            }

            const emailErr = Validators.email(emailRaw);
            if (emailErr) return showErr(emailErr);

            if (!password || password.length < 6)
                return showErr('A senha deve ter no mínimo 6 caracteres.');

            const telErr = Validators.telefone(telefone);
            if (telErr) return showErr(telErr);

            if (!isPJ && cpfRaw) {
                const cpfErr = Validators.cpf(cpfRaw);
                if (cpfErr) return showErr(cpfErr);
            }
            if (isPJ && cnpjRaw) {
                const cnpjErr = Validators.cnpj(cnpjRaw);
                if (cnpjErr) return showErr(cnpjErr);
            }

            if (btnSubmit) btnSubmit.textContent = 'Cadastrando...';

            // ---- Sanitização antes de salvar ----
            const userData = {
                name:     Validators.sanitize.nome(nomeRaw || 'Cliente'),
                email:    Validators.sanitize.email(emailRaw),
                password: password,
                phone:    Validators.sanitize.telefone(telefone),
                cpf:      cpfRaw  ? Validators.sanitize.cpf(cpfRaw)   : null,
                cnpj:     cnpjRaw ? Validators.sanitize.cnpj(cnpjRaw) : null,
                address: {
                    logradouro: document.getElementById('logradouro').value,
                    numero:     document.getElementById('numero').value,
                    bairro:     document.getElementById('bairro').value,
                    cidade:     document.getElementById('cidade').value,
                    estado:     document.getElementById('estado').value,
                    cep:        Validators.sanitize.cep(document.getElementById('cep').value)
                }
            };

            const result = await Auth.register(userData);
            if (result.success) {
                localStorage.setItem('ecostore_user', JSON.stringify(userData));
                if (msg) { msg.textContent = 'Cadastro realizado com sucesso! Redirecionando...'; msg.className = 'feedback-msg feedback-success'; msg.classList.remove('hidden'); }
                setTimeout(() => { window.location.href = 'minha-conta.html'; }, 1000);
            } else {
                showErr(result.error || 'Erro ao cadastrar.');
            }
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async e => {
            e.preventDefault();
            const emailVal = document.getElementById('email').value.trim();
            const passVal  = document.getElementById('senha').value.trim();
            const btnSubmit = loginForm.querySelector('button[type="submit"]');
            const msg = document.getElementById('login-msg');
            if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = 'Entrando...'; }

            const result = await Auth.loginWithPassword(emailVal, passVal);
            if (result.success) {
                showToast('Login realizado! Bem-vindo(a), ' + result.user.name + '!');
                setTimeout(() => { window.location.href = 'minha-conta.html'; }, 1000);
            } else {
                if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = 'Entrar'; }
                if (msg) { msg.textContent = result.error; msg.className = 'feedback-msg feedback-error'; msg.classList.remove('hidden'); }
                else showToast(result.error, 'error');
            }
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

        if (dashName) dashName.textContent = user.name || user.email || 'Cliente';
        if (dashFull) dashFull.textContent = user.name || user.email || 'Cliente';
        if (dashEmail) dashEmail.textContent = user.email;
        if (dashPhone) dashPhone.textContent = user.phone || 'Não informado';

        const dashCpf = document.getElementById('dash-cpf');
        if (dashCpf) dashCpf.textContent = user.cpf || (user.cnpj ? 'CNPJ: ' + user.cnpj : 'Não informado');

        if (dashAddr) {
            // address can be a JSON string (Supabase TEXT) or an object
            let addr = user.address;
            if (typeof addr === 'string') { try { addr = JSON.parse(addr); } catch(e) { addr = null; } }
            if (addr && addr.logradouro) {
                dashAddr.innerHTML =
                    '<p class="info-value">' + addr.logradouro + ', ' + addr.numero + '</p>' +
                    '<p class="info-value">' + addr.bairro + ', ' + addr.cidade + ' - ' + addr.estado + '</p>' +
                    '<p class="info-value">CEP: ' + addr.cep + '</p>';
            } else {
                dashAddr.innerHTML = '<p class="info-value" style="color:var(--text-muted)">Endereço não cadastrado.</p>';
            }
        }

    } else {
        // Redireciona se tentar acessar a área sem estar logado
        if (window.location.pathname.includes('minha-conta.html')) {
            window.location.href = 'login.html';
        }
    }

    const editUserForm = document.getElementById('edit-user-form');
    if (editUserForm) {
        editUserForm.addEventListener('submit', async e => {
            e.preventDefault();
            const user = Auth.getUser();
            const oldEmail = user.email;
            const btn = editUserForm.querySelector('button[type="submit"]');
            if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

            user.name  = document.getElementById('edit-name').value.trim();
            user.cpf   = document.getElementById('edit-cpf').value.trim();
            user.email = document.getElementById('edit-email').value.trim();
            user.phone = document.getElementById('edit-phone').value.trim();

            // Update in Supabase
            const { error } = await supabase
                .from('customers')
                .update({ name: user.name, cpf: user.cpf, email: user.email, phone: user.phone })
                .eq('email', oldEmail);

            if (error) {
                showToast('Erro ao salvar: ' + error.message, 'error');
                if (btn) { btn.disabled = false; btn.textContent = 'Salvar Alterações'; }
                return;
            }

            // Update local session
            localStorage.setItem('ecostore_user', JSON.stringify(user));

            if (btn) { btn.disabled = false; btn.textContent = 'Salvar Alterações'; }
            showToast('Dados atualizados com sucesso!');
            closeEditUserModal();
            initDashboard();
            updateHeaderAuth();
        });
    }

    const editAddressForm = document.getElementById('edit-address-form');
    if (editAddressForm) {
        editAddressForm.addEventListener('submit', async e => {
            e.preventDefault();
            const user = Auth.getUser();
            const btn = editAddressForm.querySelector('button[type="submit"]');
            if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

            const newAddress = {
                cep: document.getElementById('edit-addr-cep').value,
                logradouro: document.getElementById('edit-addr-logradouro').value,
                numero: document.getElementById('edit-addr-numero').value,
                bairro: document.getElementById('edit-addr-bairro').value,
                cidade: document.getElementById('edit-addr-cidade').value,
                estado: document.getElementById('edit-addr-estado').value
            };

            // Update in Supabase
            const { error } = await supabase
                .from('customers')
                .update({ address: newAddress })
                .eq('email', user.email);

            if (error) {
                showToast('Erro ao salvar endereço: ' + error.message, 'error');
                if (btn) { btn.disabled = false; btn.textContent = 'Salvar Endereço'; }
                return;
            }

            // Update local session
            user.address = newAddress;
            localStorage.setItem('ecostore_user', JSON.stringify(user));

            if (btn) { btn.disabled = false; btn.textContent = 'Salvar Endereço'; }
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

    const user = Auth.getUser();
    const userEmail = user ? user.email : null;

    // ---- Estado de filtros compartilhado entre o polling e os inputs ----
    const filterState = { search: '', status: '', dateStart: '', dateEnd: '' };

    // ---- Função de busca e renderização (chamada a cada poll) ----
    async function fetchAndRenderUserOrders() {
        if (!userEmail || !window.supabase) { renderOrdersList([], ordersContainer); return; }

        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('client_email', userEmail)
            .order('id', { ascending: false });

        const allOrders = (!error && data) ? data.map(o => ({
            ...o,
            id: '#' + String(o.id).padStart(5, '0'),
            statusLabel: o.status_label || ORDER_STATUS_MAP[o.status] || o.status,
            date: o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : '—',
            items: o.items || [],
            address: (typeof o.address === 'string') ? (() => { try { return JSON.parse(o.address); } catch(e) { return {}; } })() : (o.address || {})
        })) : [];

        // Aplica os filtros ativos sem zerar inputs do usuário
        applyCurrentFilters(allOrders);
        return allOrders;
    }

    // ---- Aplica filtros aos pedidos e renderiza ----
    function applyCurrentFilters(allOrders) {
        const filtered = allOrders.filter(o => {
            const matchSearch = !filterState.search || o.id.toLowerCase().includes(filterState.search);
            const matchStatus = !filterState.status || o.status === filterState.status;
            let matchDate = true;
            if (filterState.dateStart || filterState.dateEnd) {
                const [d, m, y] = o.date.split('/');
                const oDate = new Date(y, m - 1, d);
                oDate.setHours(0,0,0,0);
                if (filterState.dateStart) {
                    const sDate = new Date(filterState.dateStart);
                    sDate.setMinutes(sDate.getMinutes() + sDate.getTimezoneOffset());
                    sDate.setHours(0,0,0,0);
                    if (oDate < sDate) matchDate = false;
                }
                if (filterState.dateEnd) {
                    const eDate = new Date(filterState.dateEnd);
                    eDate.setMinutes(eDate.getMinutes() + eDate.getTimezoneOffset());
                    eDate.setHours(23,59,59,999);
                    if (oDate > eDate) matchDate = false;
                }
            }
            return matchSearch && matchStatus && matchDate;
        });
        renderOrdersList(filtered, ordersContainer);
    }

    // ---- Bind dos filtros (feito UMA vez) ----
    const searchInput  = document.getElementById('order-search');
    const statusFilter = document.getElementById('order-status-filter');
    const dateStart    = document.getElementById('order-date-start');
    const dateEnd      = document.getElementById('order-date-end');



    const onFilter = () => {
        filterState.search    = (searchInput?.value  || '').toLowerCase().trim();
        filterState.status    = (statusFilter?.value || '').toLowerCase().trim();
        filterState.dateStart = dateStart?.value || '';
        filterState.dateEnd   = dateEnd?.value   || '';
        applyCurrentFilters(_latestOrders);
    };

    if (searchInput  && !searchInput._ordersFilterBound)  { searchInput._ordersFilterBound  = true; searchInput.addEventListener('input',  onFilter); }
    if (statusFilter && !statusFilter._ordersFilterBound) { statusFilter._ordersFilterBound = true; statusFilter.addEventListener('change', onFilter); }
    if (dateStart    && !dateStart._ordersFilterBound)    { dateStart._ordersFilterBound    = true; dateStart.addEventListener('change',   onFilter); }
    if (dateEnd      && !dateEnd._ordersFilterBound)      { dateEnd._ordersFilterBound      = true; dateEnd.addEventListener('change',     onFilter); }

    // ---- Carga inicial + indicador visual sutil ----
    ordersContainer.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fas fa-spinner fa-spin" style="font-size:28px;"></i><p style="margin-top:12px;font-size:14px;">Carregando pedidos...</p></div>';
    fetchAndRenderUserOrders().then(orders => { if (orders) Orders._latestOrders = orders; });

    // ---- Polling silencioso a cada 10 s ----
    // Atualiza apenas os dados sem piscar a tela
    const _ordersPollingInterval = setInterval(async () => {
        // Só executa se a aba de pedidos estiver visível
        const tabPedidos = document.getElementById('tab-pedidos');
        if (!tabPedidos || !tabPedidos.classList.contains('active')) return;

        const orders = await fetchAndRenderUserOrders();
        if (orders) Orders._latestOrders = orders;
    }, 10000);

    // Limpa o intervalo ao sair da página
    window.addEventListener('beforeunload', () => clearInterval(_ordersPollingInterval), { once: true });
}

function bindOrderFilters(allOrders, ordersContainer) {
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

    if (searchInput && !searchInput._boundFilters) { searchInput._boundFilters = true; searchInput.addEventListener('input', applyFilters); }
    if (statusFilter && !statusFilter._boundFilters) { statusFilter._boundFilters = true; statusFilter.addEventListener('change', applyFilters); }
    if (dateStart && !dateStart._boundFilters) { dateStart._boundFilters = true; dateStart.addEventListener('change', applyFilters); }
    if (dateEnd && !dateEnd._boundFilters) { dateEnd._boundFilters = true; dateEnd.addEventListener('change', applyFilters); }
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
        '</div>' + (order.discount_amount > 0 ? '<div style="text-align:right; font-size:13px; color:#e74c3c; margin-bottom:5px;"><strong>Desconto:</strong> - ' + fmt(order.discount_amount) + '</div>' : '') +
        '<div class="details-actions" style="margin-top:10px; border-top:1px solid #eee; padding-top:15px; text-align:right;">' +
        '<button class="btn-primary" onclick="trackOrder(\'' + order.id + '\')"><i class="fas fa-truck-fast"></i> Acompanhar Entrega</button>' +
        '</div></div></div>').join('');
}

window.toggleOrderDetails = function(headerEl) {
    const card = headerEl.closest('.order-card');
    card.classList.toggle('expanded');
    card.querySelector('.order-details').classList.toggle('hidden');
};

window.trackOrder = function(orderId) {
    // 1. Achar o pedido na lista
    const order = Orders._latestOrders.find(o => o.id === orderId);
    if (!order) return;

    // 2. Mudar para a aba de acompanhamento
    const trackBtn = document.querySelector('[data-tab="tab-acompanhamento"]');
    if (trackBtn) trackBtn.click();

    // 3. Renderizar o conteúdo
    const container = document.getElementById('tracking-content');
    if (!container) return;

    const s = order.status;
    const flow = ['aguardando', 'processando', 'separacao', 'enviado', 'saiu', 'entregue'];
    
    const isCompleted = step => {
        const currentIdx = flow.indexOf(s);
        const stepIdx = flow.indexOf(step);
        return currentIdx >= stepIdx;
    };
    
    const isActive = step => s === step || (s === 'saiu' && step === 'enviado');

    const steps = [
        { id: 'aguardando', label: 'Pedido Realizado', icon: 'fa-check' },
        { id: 'processando', label: 'Pagamento Aprovado', icon: 'fa-credit-card' },
        { id: 'enviado', label: 'Em Transporte', icon: 'fa-truck' },
        { id: 'entregue', label: 'Entregue', icon: 'fa-home' }
    ];

    let html = '<h2 class="tab-title">Acompanhamento do Pedido ' + order.id + '</h2>';
    html += '<div class="stepper-container">';
    
    steps.forEach((step, idx) => {
        const done = isCompleted(step.id);
        const active = isActive(step.id);
        const cls = done ? 'completed' : (active ? 'active' : '');
        
        html += '<div class="step ' + cls + '">' +
                '<div class="step-icon"><i class="fas ' + (done && step.id !== s ? 'fa-check' : step.icon) + '"></i></div>' +
                '<div class="step-label">' + step.label + '</div>' +
                '<div class="step-date">' + (done ? order.date : 'Pendente') + '</div>' +
                '</div>';
        
        if (idx < steps.length - 1) {
            html += '<div class="step-line ' + (done && flow.indexOf(s) > flow.indexOf(step.id) ? 'completed' : '') + '"></div>';
        }
    });

    html += '</div>';
    
    // Tracking History (Cumulativo)
    html += '<div class="tracking-details"><h3>Últimas Atualizações</h3><ul class="tracking-list">';
    
    const currentIdx = flow.indexOf(s);
    
    // Mostra as mensagens de acordo com o progresso (do mais novo para o mais antigo)
    if (currentIdx >= flow.indexOf('entregue')) 
        html += '<li><strong>' + order.date + '</strong> - Pedido entregue com sucesso!</li>';
        
    if (currentIdx >= flow.indexOf('enviado')) 
        html += '<li><strong>' + order.date + '</strong> - Pedido em trânsito para o seu endereço.</li>';
        
    if (currentIdx >= flow.indexOf('separacao')) 
        html += '<li><strong>' + order.date + '</strong> - Pedido em fase de separação e embalagem.</li>';
        
    if (currentIdx >= flow.indexOf('processando')) 
        html += '<li><strong>' + order.date + '</strong> - Pagamento aprovado e confirmado.</li>';
        
    if (s === 'cancelado') 
        html += '<li style="color:#c0392b"><strong>' + order.date + '</strong> - Este pedido foi cancelado.</li>';
        
    html += '<li><strong>' + order.date + '</strong> - Pedido recebido em nosso sistema.</li>';
    html += '</ul></div>';

    container.innerHTML = html;
};

window.openEditUserModal = function() {
    const user = Auth.getUser();
    if (!user) return;
    document.getElementById('edit-name').value = user.name || '';
    document.getElementById('edit-cpf').value = user.cpf || '';
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

window.buscaCepEdit = async function() {
    const btn = document.querySelector('[onclick="buscaCepEdit()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
    const result = await Validators.buscarCep(
        document.getElementById('edit-addr-cep').value,
        {
            logradouro: document.getElementById('edit-addr-logradouro'),
            bairro:     document.getElementById('edit-addr-bairro'),
            cidade:     document.getElementById('edit-addr-cidade'),
            estado:     document.getElementById('edit-addr-estado')
        }
    );
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-search"></i>'; }
    if (result.ok) showToast('Endereço encontrado!');
    else showToast(result.msg, 'error');
};

// ============================================================
// MODAL: ALTERAR SENHA
// ============================================================
window.openChangePasswordModal = function() {
    const modal = document.getElementById('change-password-modal');
    const msg   = document.getElementById('change-pass-msg');
    if (!modal) return;
    // Clear fields
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
    if (msg) { msg.textContent = ''; msg.className = 'feedback-msg hidden'; }
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('visible'), 10);

    const form = document.getElementById('change-password-form');
    if (form && !form._passwordHandlerSet) {
        form._passwordHandlerSet = true;
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const user        = Auth.getUser();
            const currentPass = document.getElementById('current-password').value;
            const newPass     = document.getElementById('new-password').value;
            const confirmPass = document.getElementById('confirm-password').value;
            const btn         = form.querySelector('button[type="submit"]');
            const msgEl       = document.getElementById('change-pass-msg');

            const showMsg = (text, isError) => {
                msgEl.textContent = text;
                msgEl.className = 'feedback-msg ' + (isError ? 'feedback-error' : 'feedback-success');
                msgEl.classList.remove('hidden');
            };

            // 1. Verify current password against Supabase
            const { data: check } = await supabase
                .from('customers')
                .select('id')
                .eq('email', user.email)
                .eq('password', currentPass)
                .single();

            if (!check) { showMsg('Senha atual incorreta.', true); return; }

            // 2. Validate new password
            if (newPass.length < 6) { showMsg('A nova senha deve ter pelo menos 6 caracteres.', true); return; }
            if (newPass !== confirmPass) { showMsg('As senhas não conferem.', true); return; }

            // 3. Update in Supabase
            if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
            const { error } = await supabase
                .from('customers')
                .update({ password: newPass })
                .eq('email', user.email);

            if (error) {
                showMsg('Erro ao salvar: ' + error.message, true);
                if (btn) { btn.disabled = false; btn.textContent = 'Salvar Nova Senha'; }
                return;
            }

            // 4. Update localStorage session
            user.password = newPass;
            localStorage.setItem('ecostore_user', JSON.stringify(user));

            if (btn) { btn.disabled = false; btn.textContent = 'Salvar Nova Senha'; }
            showMsg('Senha alterada com sucesso!', false);
            setTimeout(() => window.closeChangePasswordModal(), 1500);
        });
    }
};

window.closeChangePasswordModal = function() {
    const modal = document.getElementById('change-password-modal');
    if (!modal) return;
    modal.classList.remove('visible');
    setTimeout(() => modal.classList.add('hidden'), 300);
};
