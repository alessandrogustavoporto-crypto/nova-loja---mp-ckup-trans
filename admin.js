// Global Cache
let cachedAdminData = {
    orders: null,
    products: null,
    categories: null,
    brands: null,
    clients: null,
    banners: null
};

// Pagination State
let ordersCurrentPage = 1;
const ordersPageSize = 50;

function logErrorToDOM(msg) {
    const div = document.createElement('div');
    div.style.position = 'fixed'; div.style.top = '0'; div.style.left = '0'; div.style.right = '0'; div.style.background = 'red'; div.style.color = 'white'; div.style.padding = '20px'; div.style.zIndex = '999999'; div.style.fontSize = '24px'; div.style.fontWeight = 'bold';
    div.textContent = 'ERRO CRÍTICO: ' + msg;
    if (document.body) document.body.prepend(div); else window.onload = () => document.body.prepend(div);
}
window.addEventListener('error', function (e) { logErrorToDOM(e.message); });
window.addEventListener('unhandledrejection', function (e) { logErrorToDOM(e.reason ? e.reason.message || e.reason : 'Rejeição de promessa'); });


// ---- Auth ----
const AdminAuth = {
    _sessionKey: 'ecostore_admin_session',

    isLoggedIn() { return !!sessionStorage.getItem(this._sessionKey); },
    async hasMaster() {
        try {
            const { data, error } = await supabase.from('admins').select('*').limit(1);
            if (error) {
                console.error("Supabase Error in hasMaster:", error);
                return false; // Assume no master if there's an error
            }
            return data && data.length > 0;
        } catch (err) {
            console.error("JS Error in hasMaster:", err);
            return false;
        }
    },

    async register(name, email, password) {
        if (await this.hasMaster()) { alert('Já existe um master'); return false; }
        const { error } = await supabase.from('admins').insert([{ name, email, password }]);
        if (error) {
            alert('Falha ao cadastrar: ' + error.message);
            console.error('Insert error:', error);
            return false;
        }
        return true;
    },

    async login(email, pass) {
        const { data, error } = await supabase.from('admins').select('*').eq('email', email).eq('password', pass).single();
        if (error) {
            alert('Falha ao logar: ' + error.message);
            console.error('Login error:', error);
            return false;
        }
        if (data) {
            sessionStorage.setItem(this._sessionKey, JSON.stringify({ email: data.email, name: data.name }));
            return true;
        }
        return false;
    },

    logout() { sessionStorage.removeItem(this._sessionKey); window.location.href = 'admin-login.html'; },
    getAdmin() { return JSON.parse(sessionStorage.getItem(this._sessionKey) || 'null'); }
};

window.adminLogout = function () { AdminAuth.logout(); };

// ---- Data Store ----
const AdminData = {
    async getOrders() {
        const { data } = await supabase.from('orders').select('*').order('id', { ascending: false });
        return (data || []).map(o => ({
            ...o,
            clientName: o.client_name,
            clientEmail: o.client_email,
            clientPhone: (o.address && o.address.phone) ? o.address.phone : (o.clientPhone || '11999999999'),
            date: new Date(o.created_at).toLocaleDateString('pt-BR'),
            address: typeof o.address === 'object' ? (o.address.logradouro + ', ' + o.address.numero + ' - ' + o.address.cidade) : o.address
        }));
    },

    async getProducts() {
        const { data } = await supabase.from('products').select('*').order('id', { ascending: false });
        return (data || []).map(p => ({
            ...p,
            oldPrice: p.old_price,
            promoActive: p.promo_active,
            promoPrice: p.promo_price
        }));
    },

    async getCategories() {
        const { data } = await supabase.from('categories').select('*').order('id', { ascending: true });
        return data || [];
    },

    async getBrands() {
        const { data } = await supabase.from('brands').select('*').order('id', { ascending: true });
        return data || [];
    },

    async getClients() {
        const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
        const orders = await this.getOrders();
        return (data || []).map(u => ({
            ...u,
            type: u.is_pj ? 'PJ' : 'PF',
            orders: orders.filter(o => o.clientEmail === u.email).length
        }));
    },

    async getBanners() {
        const { data } = await supabase.from('banners').select('*').order('id', { ascending: true });
        return (data || []).map(b => ({
            ...b,
            btnText: b.btn_text,
            btnLink: b.btn_link
        }));
    }
};

// ---- Formatters ----
const fmt = v => 'R$ ' + parseFloat(v || 0).toFixed(2).replace('.', ',');
const statusInfo = {
    aguardando: { label: 'Aguardando Pagamento', badge: 'badge-aguardando' },
    separacao: { label: 'Em Separação', badge: 'badge-separacao' },
    saiu: { label: 'Saiu para Entrega', badge: 'badge-saiu' },
    entregue: { label: 'Entregue', badge: 'badge-entregue' },
    cancelado: { label: 'Cancelado', badge: 'badge-cancelado' },
    processando: { label: 'Processando', badge: 'badge-processando' },
    enviado: { label: 'Enviado', badge: 'badge-separacao' }
};

function statusBadge(s) {
    const info = statusInfo[s] || { label: s, badge: 'badge-processando' };
    return '<span class="badge ' + info.badge + '">' + info.label + '</span>';
}

// ---- Admin Toast (reuse if script.js loaded, else fallback) ----
function adminToast(msg, type) {
    if (typeof showToast === 'function') { showToast(msg, type); return; }
    alert(msg);
}

// ============================================================
// PAGE: Admin Login
// ============================================================
async function initAdminLogin() {
    const isLoginPage = !!document.getElementById('admin-login-form');
    if (!isLoginPage) return;

    if (AdminAuth.isLoggedIn()) { window.location.href = 'admin.html'; return; }

    const loginForm = document.getElementById('admin-login-form');
    const regForm = document.getElementById('admin-register-form');
    const msgEl = document.getElementById('admin-auth-msg');
    if (!loginForm || !regForm) return;

    // Determine which form to show
    const hasMaster = await AdminAuth.hasMaster();
    if (!hasMaster) {
        regForm.classList.remove('hidden');
        regForm.style.display = 'block';
        if (msgEl) {
            msgEl.textContent = 'Olá! Crie seu primeiro acesso de Administrador.';
            msgEl.style.background = '#e8f5e9';
            msgEl.style.color = '#27ae60';
            msgEl.classList.remove('hidden');
            msgEl.style.display = 'block';
        }
    } else {
        loginForm.classList.remove('hidden');
        loginForm.style.display = 'block';
    }

    // Handle Registration
    window.submitAdminRegister = async function (e) {
        if (e) e.preventDefault();
        const name = document.getElementById('reg-admin-name').value.trim();
        const email = document.getElementById('reg-admin-email').value.trim();
        const pass = document.getElementById('reg-admin-pass').value.trim();
        if (!name || !email || !pass) { alert('Preencha todos os campos!'); return; }

        const btn = regForm.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Cadastrando...'; }

        const success = await AdminAuth.register(name, email, pass);
        if (success) {
            if (msgEl) {
                msgEl.textContent = 'Cadastro realizado! Agora faça seu login.';
                msgEl.style.background = '#e8f5e9';
                msgEl.style.color = '#27ae60';
                msgEl.classList.remove('hidden');
                msgEl.style.display = 'block';
            }
            regForm.style.display = 'none';
            loginForm.classList.remove('hidden');
            loginForm.style.display = 'block';
        } else {
            if (btn) { btn.disabled = false; btn.textContent = 'Criar Conta Administrador'; }
        }
    };

    // Handle Login
    window.submitAdminLogin = async function (e) {
        if (e) e.preventDefault();
        const email = document.getElementById('admin-email').value.trim();
        const pass = document.getElementById('admin-pass').value.trim();
        if (!email || !pass) { alert('Preencha e-mail e senha!'); return; }

        const btn = loginForm.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }

        const success = await AdminAuth.login(email, pass);
        if (success) {
            window.location.href = 'admin.html';
        } else {
            if (btn) { btn.disabled = false; btn.textContent = 'Entrar no Painel'; }
            if (msgEl) {
                msgEl.textContent = 'Credenciais inválidas. Verifique e-mail e senha.';
                msgEl.style.background = '#ffeaea';
                msgEl.style.color = '#c0392b';
                msgEl.classList.remove('hidden');
                msgEl.style.display = 'block';
            }
        }
    };
}

// ============================================================
// PAGE: Admin Dashboard
// ============================================================
async function initAdminDashboard() {
    if (!document.getElementById('admin-page-title')) return;
    if (!AdminAuth.isLoggedIn()) { window.location.href = 'admin-login.html'; return; }

    // Show admin name
    const admin = AdminAuth.getAdmin();
    const nameEl = document.getElementById('admin-name-display');
    if (nameEl && admin) nameEl.textContent = admin.name;

    // 1. Busca todos os dados em paralelo (MUITO MAIS RÁPIDO)
    const [orders, products, categories, brands, clients, banners] = await Promise.all([
        AdminData.getOrders(),
        AdminData.getProducts(),
        AdminData.getCategories(),
        AdminData.getBrands(),
        AdminData.getClients(),
        AdminData.getBanners()
    ]);

    // Salva no cache global
    cachedAdminData = { orders, products, categories, brands, clients, banners };
    cachedFinanceData = { orders, products, clients };

    // 2. Renderiza as seções usando os dados já carregados
    await loadDashboard(orders, products, clients, banners);
    await loadProducts(null, products);
    await loadCategories(categories, products);
    await loadBrands(brands);
    await loadClients(null, null, clients);
    await loadOrders(null, null, orders);
    await loadBanners(banners);

    // Sidebar navigation
    const btns = document.querySelectorAll('.sidebar-btn[data-section]');
    btns.forEach(btn => btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        const sectionId = btn.dataset.section;
        const sec = document.getElementById('section-' + sectionId);
        if (sec) sec.classList.add('active');
        document.getElementById('admin-page-title').textContent = btn.textContent.trim();

        // Carregamento instantâneo via cache
        if (sectionId === 'financeiro') loadFinanceData('7days');
    }));

    // Finance Tabs Navigation
    const fTabBtns = document.querySelectorAll('.f-tab-btn');
    fTabBtns.forEach(btn => btn.addEventListener('click', () => {
        fTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.f-tab-content').forEach(c => c.classList.remove('active'));
        const tab = document.getElementById('f-tab-' + btn.dataset.fTab);
        if (tab) tab.classList.add('active');
    }));

    // Sales Period Filter
    const salesFilter = document.getElementById('sales-period-filter');
    if (salesFilter) {
        if (!salesFilter._bound) {
            salesFilter._bound = true;
            salesFilter.addEventListener('change', () => loadSalesCharts(salesFilter.value, cachedAdminData.orders));
        }
    }

    // Customer Period Filter
    const custFilter = document.getElementById('cust-period-filter');
    if (custFilter) {
        if (!custFilter._bound) {
            custFilter._bound = true;
            custFilter.addEventListener('change', () => {
                const now = new Date();
                const filtered = cachedAdminData.orders.filter(o => {
                    if (o.status === 'cancelado') return false;
                    const period = custFilter.value;
                    if (period === 'all') return true;
                    const oDate = new Date(o.created_at);
                    if (period === 'today') return oDate.toDateString() === now.toDateString();
                    const diffDays = (now - oDate) / (1000 * 60 * 60 * 24);
                    if (period === '7days') return diffDays <= 7;
                    if (period === '30days') return diffDays <= 30;
                    if (period === 'year') return oDate.getFullYear() === now.getFullYear();
                    return true;
                });
                loadCustomersFinance(filtered, cachedAdminData.clients, custFilter.value);
            });
        }
    }

    // Overview Period Filter
    const ovFilter = document.getElementById('overview-period-filter');
    if (ovFilter) {
        if (!ovFilter._bound) {
            ovFilter._bound = true;
            ovFilter.addEventListener('change', () => loadFinanceData(ovFilter.value));
        }
    }

    // Product Period Filter
    const prodFilter = document.getElementById('prod-period-filter');
    if (prodFilter) {
        if (!prodFilter._bound) {
            prodFilter._bound = true;
            prodFilter.addEventListener('change', () => {
                const now = new Date();
                const filtered = cachedAdminData.orders.filter(o => {
                    if (o.status === 'cancelado') return false;
                    const period = prodFilter.value;
                    if (period === 'all') return true;
                    const oDate = new Date(o.created_at);
                    if (period === 'today') return oDate.toDateString() === now.toDateString();
                    const diffDays = (now - oDate) / (1000 * 60 * 60 * 24);
                    if (period === '7days') return diffDays <= 7;
                    if (period === '30days') return diffDays <= 30;
                    if (period === 'year') return oDate.getFullYear() === now.getFullYear();
                    return true;
                });
                loadProductsFinance(filtered, cachedAdminData.products);
            });
        }
    }

    // Orders Pagination Listeners
    const btnPrev = document.getElementById('prev-orders');
    const btnNext = document.getElementById('next-orders');
    if (btnPrev && !btnPrev._bound) {
        btnPrev._bound = true;
        btnPrev.addEventListener('click', () => { if (ordersCurrentPage > 1) { ordersCurrentPage--; renderOrdersTable(); } });
    }
    if (btnNext && !btnNext._bound) {
        btnNext._bound = true;
        btnNext.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredOrdersCount / ordersPageSize);
            if (ordersCurrentPage < totalPages) { ordersCurrentPage++; renderOrdersTable(); }
        });
    }
}

// ---- Dashboard KPIs ----
async function loadDashboard(orders, products, clients, banners) {
    if (!orders) orders = await AdminData.getOrders();
    allAdminOrders = orders;
    if (!products) products = await AdminData.getProducts();
    if (!clients) clients = await AdminData.getClients();
    if (!banners) banners = await AdminData.getBanners();

    const now = new Date();
    const filteredOrders = orders.filter(o => o.status !== 'cancelado');
    const salesTotal = filteredOrders.reduce((s, o) => s + parseFloat(o.total || 0), 0);
    
    // Vendas no Mês Corrente (Sempre fixo do dia 1 até hoje)
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const salesMonthTotal = orders.filter(o => {
        if (o.status === 'cancelado') return false;
        const oDate = new Date(o.created_at);
        return oDate >= firstDayOfMonth && oDate <= now;
    }).reduce((s, o) => s + parseFloat(o.total || 0), 0);

    const pending = orders.filter(o => ['aguardando', 'separacao', 'processando'].includes(o.status)).length;
    const activeBanners = banners.filter(b => b.active).length;

    document.getElementById('kpi-sales').textContent = fmt(salesTotal);
    document.getElementById('kpi-month-sales').textContent = fmt(salesMonthTotal);
    document.getElementById('kpi-pending').textContent = pending;
    document.getElementById('kpi-clients').textContent = clients.length;
    document.getElementById('kpi-banners').textContent = activeBanners;

    const tbody = document.getElementById('dashboard-orders-table');
    tbody.innerHTML = orders.slice(0, 5).map(o =>
        '<tr>' +
        '<td><strong>' + o.id + '</strong></td>' +
        '<td>' + (o.clientName || '—') + '</td>' +
        '<td>' + o.date + '</td>' +
        '<td>' + fmt(o.total) + '</td>' +
        '<td>' + statusBadge(o.status) + '</td>' +
        '<td><button class="btn-icon btn-icon-view" onclick="viewOrder(\'' + o.id + '\')"><i class="fas fa-eye"></i></button></td>' +
        '</tr>'
    ).join('');
}

// ---- Products ----
async function loadProducts(filter, preloadedProds) {
    const fmt = v => 'R$ ' + (isNaN(v) ? '0,00' : v.toFixed(2).replace('.', ','));
    let prods = preloadedProds || await AdminData.getProducts();
    if (filter) {
        const f = filter.toLowerCase();
        prods = prods.filter(p => 
            p.name.toLowerCase().includes(f) || 
            (p.category || '').toLowerCase().includes(f) ||
            (p.brand || '').toLowerCase().includes(f) ||
            (p.barcode || '').toLowerCase().includes(f)
        );
    }
    const tbody = document.getElementById('products-table');
    if (!tbody) return;
    tbody.innerHTML = prods.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted)">Nenhum produto encontrado.</td></tr>' :
        prods.map(p =>
            '<tr>' +
            '<td><img src="' + (p.image || '') + '" class="product-thumb-sm" alt=""></td>' +
            '<td><strong>' + p.name + '</strong></td>' +
            '<td>' + (p.category || '—') + '</td>' +
            '<td>' + (p.brand || '—') + '</td>' +
            '<td>' + fmt(p.price) + '</td>' +
            '<td>' + (p.stock || 0) + ' un</td>' +
            '<td><span class="badge ' + (p.promoActive ? 'badge-ativo' : '') + '">' + (p.promoActive ? 'Ativa' : '—') + '</span></td>' +
            '<td>' +
            '<button class="btn-icon btn-icon-edit" onclick="openProductModal(' + p.id + ')" title="Editar"><i class="fas fa-edit"></i></button> ' +
            '<button class="btn-icon btn-icon-delete" onclick="deleteProduct(' + p.id + ')" title="Excluir"><i class="fas fa-trash"></i></button>' +
            '</td></tr>'
        ).join('');

    // Search listener
    const search = document.getElementById('product-search');
    if (search && !search._bound) {
        search._bound = true;
        search.addEventListener('input', () => loadProducts(search.value));
    }

    await populateCategorySelect();
    await populateBrandSelect();
}

window.openProductModal = async function (id) {
    const modal = document.getElementById('product-modal');
    modal.classList.remove('hidden');
    await populateCategorySelect();
    await populateBrandSelect();

    // Preview Reset
    const preview = document.getElementById('prod-img-preview');
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    const fileInput = document.getElementById('prod-image-file');
    if (fileInput) fileInput.value = '';

    if (!id) {
        document.getElementById('product-modal-title').textContent = 'Novo Produto';
        ['prod-id', 'prod-name', 'prod-image-base64', 'prod-desc', 'prod-barcode'].forEach(f => { const el = document.getElementById(f); if (el) el.value = ''; });
        ['prod-price', 'prod-promo-price', 'prod-stock', 'prod-cost'].forEach(f => { const el = document.getElementById(f); if (el) el.value = ''; });
        document.getElementById('prod-promo-active').checked = false;
        renderVariations([]);
        return;
    }

    const prods = await AdminData.getProducts();
    const prod = prods.find(p => p.id === id);
    if (!prod) return;
    document.getElementById('product-modal-title').textContent = 'Editar Produto';
    document.getElementById('prod-id').value = prod.id;
    document.getElementById('prod-name').value = prod.name;
    document.getElementById('prod-price').value = prod.price;
    document.getElementById('prod-promo-price').value = prod.promoPrice || '';
    document.getElementById('prod-stock').value = prod.stock || 0;
    document.getElementById('prod-cost').value = prod.cost || 0;
    document.getElementById('prod-barcode').value = prod.barcode || '';
    document.getElementById('prod-image-base64').value = prod.image || '';
    document.getElementById('prod-desc').value = prod.description || '';
    document.getElementById('prod-category').value = prod.category || '';
    document.getElementById('prod-brand').value = prod.brand || '';
    document.getElementById('prod-promo-active').checked = !!prod.promoActive;

    if (prod.image && preview) {
        preview.src = prod.image;
        preview.style.display = 'block';
    }

    // Render variations
    renderVariations(prod.variations || []);
};

window.addVariationRow = function (name = '', price = '') {
    const list = document.getElementById('variations-list');
    const div = document.createElement('div');
    div.className = 'variation-row';
    div.style = 'display: flex; gap: 10px; align-items: center;';
    div.innerHTML = `
        <input type="text" placeholder="Ex: Azul" class="v-name" value="${name}" style="flex: 2; padding: 8px;">
        <input type="number" placeholder="Preço" class="v-price" value="${price}" step="0.01" style="flex: 1; padding: 8px;">
        <button type="button" onclick="this.parentElement.remove()" style="background: none; border: none; color: #e74c3c; cursor: pointer; padding: 5px;">
            <i class="fas fa-times"></i>
        </button>
    `;
    list.appendChild(div);
};

function renderVariations(variations) {
    const list = document.getElementById('variations-list');
    list.innerHTML = '';
    variations.forEach(v => window.addVariationRow(v.name, v.price));
}

function getVariationsData() {
    const list = document.getElementById('variations-list');
    const rows = list.querySelectorAll('.variation-row');
    const data = [];
    rows.forEach(row => {
        const name = row.querySelector('.v-name').value.trim();
        const price = parseFloat(row.querySelector('.v-price').value) || null;
        if (name) data.push({ name, price });
    });
    return data;
}

window.closeProductModal = function () { document.getElementById('product-modal').classList.add('hidden'); };

window.saveProduct = async function () {
    const id = document.getElementById('prod-id').value;
    const product = {
        name: document.getElementById('prod-name').value,
        price: parseFloat(document.getElementById('prod-price').value),
        promo_price: parseFloat(document.getElementById('prod-promo-price').value) || null,
        stock: parseInt(document.getElementById('prod-stock').value) || 0,
        image: document.getElementById('prod-image-base64').value,
        description: document.getElementById('prod-desc').value,
        category: document.getElementById('prod-category').value,
        brand: document.getElementById('prod-brand').value,
        promo_active: document.getElementById('prod-promo-active').checked,
        cost: parseFloat(document.getElementById('prod-cost').value) || 0,
        barcode: document.getElementById('prod-barcode').value,
        variations: getVariationsData()
    };

    if (!product.name || isNaN(product.price)) { adminToast('Preencha nome e preço.', 'error'); return; }

    let error;
    if (id) {
        const res = await supabase.from('products').update(product).eq('id', id);
        error = res.error;
    } else {
        const res = await supabase.from('products').insert([product]);
        error = res.error;
    }

    if (error) {
        adminToast('Erro ao salvar: ' + error.message, 'error');
        console.error('saveProduct error:', error);
        return;
    }

    closeProductModal();
    adminToast('Produto salvo com sucesso!');
    await loadProducts();
};

// Handle Image File Upload to Base64
document.addEventListener('change', e => {
    if (e.target.id === 'prod-image-file') {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            const base64 = event.target.result;
            document.getElementById('prod-image-base64').value = base64;
            const preview = document.getElementById('prod-img-preview');
            if (preview) {
                preview.src = base64;
                preview.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    }
});

window.deleteProduct = async function (id) {
    if (!confirm('Confirmar exclusão deste produto?')) return;
    await supabase.from('products').delete().eq('id', id);
    adminToast('Produto excluído.');
    initAdminDashboard();
};

// ---- Categories ----
async function loadCategories(preloadedCats, preloadedProds) {
    const cats = preloadedCats || await AdminData.getCategories();
    const prods = preloadedProds || await AdminData.getProducts();
    const tbody = document.getElementById('categories-table');
    if (!tbody) return;
    tbody.innerHTML = cats.map((c, i) => {
        const count = prods.filter(p => p.category === c.name).length;
        return '<tr>' +
            '<td>' + (i + 1) + '</td>' +
            '<td><strong>' + c.name + '</strong></td>' +
            '<td>' + count + ' produtos</td>' +
            '<td>' +
            '<button class="btn-icon btn-icon-edit" onclick="openCatModal(' + c.id + ')" title="Editar"><i class="fas fa-edit"></i></button> ' +
            '<button class="btn-icon btn-icon-delete" onclick="deleteCategory(' + c.id + ')" title="Excluir"><i class="fas fa-trash"></i></button>' +
            '</td></tr>';
    }).join('');
}

async function populateCategorySelect() {
    const sel = document.getElementById('prod-category');
    if (!sel) return;
    const cats = await AdminData.getCategories();
    sel.innerHTML = cats.map(c => '<option value="' + c.name + '">' + c.name + '</option>').join('');
}

window.openCatModal = async function (id) {
    document.getElementById('cat-modal').classList.remove('hidden');
    if (!id) { document.getElementById('cat-id').value = ''; document.getElementById('cat-name').value = ''; return; }
    const cats = await AdminData.getCategories();
    const cat = cats.find(c => c.id === id);
    if (cat) { document.getElementById('cat-id').value = cat.id; document.getElementById('cat-name').value = cat.name; }
};

window.closeCatModal = function () { document.getElementById('cat-modal').classList.add('hidden'); };

window.saveCategory = async function () {
    const id = document.getElementById('cat-id').value;
    const name = document.getElementById('cat-name').value.trim();
    if (!name) { adminToast('Digite um nome.', 'error'); return; }
    if (id) {
        await supabase.from('categories').update({ name }).eq('id', id);
    } else {
        await supabase.from('categories').insert([{ name }]);
    }
    closeCatModal();
    initAdminDashboard();
    adminToast('Categoria salva!');
};

window.deleteCategory = async function (id) {
    if (!confirm('Excluir esta categoria?')) return;
    await supabase.from('categories').delete().eq('id', id);
    initAdminDashboard();
};

// ---- Clients ----
async function loadClients(nameFilter, typeFilter, preloadedClients) {
    let clients = preloadedClients || cachedAdminData.clients || await AdminData.getClients();

    // Filtro local (INSTANTÂNEO)
    if (nameFilter) {
        const nf = nameFilter.toLowerCase();
        clients = clients.filter(c => (c.name || '').toLowerCase().includes(nf) || (c.email || '').toLowerCase().includes(nf));
    }
    if (typeFilter) {
        clients = clients.filter(c => c.type === typeFilter);
    }

    const tbody = document.getElementById('clients-table');
    if (!tbody) return;
    tbody.innerHTML = clients.map(c =>
        '<tr>' +
        '<td><strong>' + c.name + '</strong></td>' +
        '<td>' + c.email + '</td>' +
        '<td><span class="badge badge-ativo">' + c.type + '</span></td>' +
        '<td>' + c.orders + ' pedidos</td>' +
        '<td><span class="badge ' + (c.status === 'ativo' ? 'badge-entregue' : 'badge-cancelado') + '">' + c.status + '</span></td>' +
        '<td>' +
        '<button class="btn-icon btn-icon-view" onclick="document.querySelector(\'[data-section=pedidos]\').click(); document.getElementById(\'order-admin-search\').value=\'' + c.email + '\'; document.getElementById(\'order-admin-search\').dispatchEvent(new Event(\'input\'));" title="Ver pedidos"><i class="fas fa-history"></i></button> ' +
        '<button class="btn-icon btn-icon-edit" onclick="openClientModal(\'' + c.email + '\')" title="Editar"><i class="fas fa-edit"></i></button> ' +
        '<button class="btn-icon btn-icon-block" onclick="toggleClientBlock(\'' + c.email + '\', \'' + c.status + '\')" title="Bloquear/Desbloquear"><i class="fas fa-ban"></i></button> ' +
        '<button class="btn-icon btn-icon-delete" onclick="deleteClient(\'' + c.email + '\')" title="Excluir"><i class="fas fa-trash"></i></button>' +
        '</td></tr>'
    ).join('');

    const search = document.getElementById('client-search');
    const typeF = document.getElementById('client-type-filter');
    if (search && !search._bound) { search._bound = true; search.addEventListener('input', () => loadClients(search.value, typeF.value)); }
    if (typeF && !typeF._bound) { typeF._bound = true; typeF.addEventListener('change', () => loadClients(search.value, typeF.value)); }
}

window.openClientModal = async function (email) {
    const clients = await AdminData.getClients();
    const client = clients.find(c => c.email === email);
    if (!client) return;

    document.getElementById('client-modal-id').value = client.email;
    document.getElementById('client-modal-name').value = client.name;
    document.getElementById('client-modal-email').value = client.email;
    document.getElementById('client-modal-phone').value = client.phone || '';
    document.getElementById('client-modal-status').value = client.status || 'ativo';

    document.getElementById('client-modal').classList.remove('hidden');
};

window.closeClientModal = function () {
    document.getElementById('client-modal').classList.add('hidden');
};

window.saveClient = async function () {
    const emailId = document.getElementById('client-modal-id').value;
    const name = document.getElementById('client-modal-name').value;
    const email = document.getElementById('client-modal-email').value;
    const phone = document.getElementById('client-modal-phone').value;
    const status = document.getElementById('client-modal-status').value;

    await supabase.from('customers').update({ name, email, phone, status }).eq('email', emailId);

    adminToast('Dados do cliente atualizados!');
    closeClientModal();
    initAdminDashboard();
};

window.toggleClientBlock = async function (email, currentStatus) {
    const newStatus = currentStatus === 'ativo' ? 'bloqueado' : 'ativo';
    const msg = newStatus === 'bloqueado' ? 'Deseja bloquear este cliente?' : 'Deseja desbloquear este cliente?';
    if (!confirm(msg)) return;

    const { error } = await supabase.from('customers').update({ status: newStatus }).eq('email', email);
    if (error) { adminToast('Erro: ' + error.message, 'error'); return; }

    adminToast('Status do cliente atualizado para ' + newStatus);
    initAdminDashboard();
};

window.deleteClient = async function (email) {
    if (!confirm('AVISO: Esta ação é irreversível. Deseja excluir permanentemente este cliente e seus dados?')) return;

    const { error } = await supabase.from('customers').delete().eq('email', email);
    if (error) { adminToast('Erro ao excluir: ' + error.message, 'error'); return; }

    adminToast('Cliente excluído com sucesso!', 'error');
    initAdminDashboard();
};

// ---- Orders ----
let allAdminOrders = [];
let filteredOrdersCount = 0;
let currentOrdersList = [];

async function loadOrders(statusFilter, searchFilter, preloadedOrders) {
    allAdminOrders = preloadedOrders || cachedAdminData.orders || await AdminData.getOrders();
    let orders = allAdminOrders;

    if (statusFilter) orders = orders.filter(o => o.status === statusFilter);
    if (searchFilter) orders = orders.filter(o =>
        String(o.id).toLowerCase().includes(searchFilter.toLowerCase()) ||
        (o.clientName || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
        (o.clientEmail || '').toLowerCase().includes(searchFilter.toLowerCase())
    );

    currentOrdersList = orders;
    filteredOrdersCount = orders.length;
    ordersCurrentPage = 1; // Reset to page 1 on filter change
    renderOrdersTable();

    const search = document.getElementById('order-admin-search');
    const status = document.getElementById('order-admin-status');
    if (search && !search._bound) { search._bound = true; search.addEventListener('input', () => loadOrders(status.value, search.value)); }
    if (status && !status._bound) { status._bound = true; status.addEventListener('change', () => loadOrders(status.value, search.value)); }
}

function renderOrdersTable() {
    const tbody = document.getElementById('orders-admin-table');
    if (!tbody) return;

    const start = (ordersCurrentPage - 1) * ordersPageSize;
    const end = start + ordersPageSize;
    const paginated = currentOrdersList.slice(start, end);

    tbody.innerHTML = paginated.map((o, index) => {
        const rowNum = start + index + 1;
        return `
            <tr>
                <td>${rowNum}</td>
                <td><strong>#${String(o.id).padStart(5, '0')}</strong></td>
                <td>${o.clientName || '—'}</td>
                <td>${o.date}</td>
                <td>${fmt(o.total)}</td>
                <td>
                    <select class="status-select" onchange="updateOrderStatus('${o.id}', this.value)">
                        ${['aguardando', 'separacao', 'saiu', 'entregue', 'cancelado', 'processando'].map(s =>
            `<option value="${s}"${o.status === s ? ' selected' : ''}>${statusInfo[s].label}</option>`
        ).join('')}
                    </select>
                </td>
                <td>
                    <button class="btn-icon btn-icon-view" onclick="viewOrder('${o.id}')" title="Ver detalhes"><i class="fas fa-eye"></i></button>
                    ${o.clientPhone ? ` <a href="https://wa.me/55${o.clientPhone.replace(/\D/g, '')}" target="_blank" class="btn-icon" style="color:#25D366;" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>` : ''}
                </td>
            </tr>
        `;
    }).join('');

    // Update pagination info
    const totalPages = Math.ceil(filteredOrdersCount / ordersPageSize) || 1;
    const info = document.getElementById('orders-page-info');
    if (info) info.textContent = `Página ${ordersCurrentPage} de ${totalPages}`;

    // Update button states
    const btnPrev = document.getElementById('prev-orders');
    const btnNext = document.getElementById('next-orders');
    if (btnPrev) btnPrev.disabled = ordersCurrentPage === 1;
    if (btnNext) btnNext.disabled = ordersCurrentPage === totalPages;
}

window.updateOrderStatus = async function (id, newStatus) {
    await supabase.from('orders').update({ status: newStatus, status_label: statusInfo[newStatus].label }).eq('id', id);
    adminToast('Status atualizado: ' + statusInfo[newStatus].label);
    initAdminDashboard();
};

window.viewOrder = function (id) {
    const o = allAdminOrders.find(o => o.id == id);
    if (!o) return;
    document.getElementById('order-detail-title').textContent = 'Pedido ' + o.id;
    document.getElementById('order-detail-body').innerHTML =
        '<div class="order-detail-section">' +
        '<h4><i class="fas fa-user"></i> Dados do Cliente</h4>' +
        '<p><strong>Nome:</strong> ' + (o.clientName || '—') + '</p>' +
        '<p><strong>E-mail:</strong> ' + (o.clientEmail || '—') + '</p>' +
        '<p><strong>WhatsApp:</strong> ' + (o.clientPhone ? '<a href="https://wa.me/55' + o.clientPhone.replace(/\D/g, '') + '" target="_blank" style="color:#25D366"><i class="fab fa-whatsapp"></i> ' + o.clientPhone + '</a>' : '—') + '</p>' +
        '</div>' +
        '<div class="order-detail-section">' +
        '<h4><i class="fas fa-map-marker-alt"></i> Endereço de Entrega</h4>' +
        '<p>' + (o.address || '—') + '</p>' +
        '</div>' +
        '<div class="order-detail-section">' +
        '<h4><i class="fas fa-shopping-basket"></i> Itens do Pedido</h4>' +
        '<table class="order-detail-table">' +
        '<thead><tr><th>Produto</th><th>Qty</th><th>Preço Unit.</th><th>Subtotal</th></tr></thead><tbody>' +
        (o.items || []).map(i => '<tr><td>' + i.name + '</td><td>' + i.qty + '</td><td>' + fmt(i.price) + '</td><td>' + fmt(i.price * i.qty) + '</td></tr>').join('') +
        '</tbody></table>' +
        '</div>' +
        '<div style="text-align:right;font-size:18px;font-weight:700;color:var(--primary-green);margin-top:10px;">Total: ' + fmt(o.total) + '</div>';

    // Store for print
    window._currentOrder = o;
    document.getElementById('order-detail-modal').classList.remove('hidden');
};

window.closeOrderModal = function () { document.getElementById('order-detail-modal').classList.add('hidden'); };

window.printOrder = function () {
    const o = window._currentOrder;
    if (!o) return;
    const printArea = document.getElementById('print-area');
    printArea.innerHTML =
        '<h2>PICK LIST — Pedido ' + o.id + '</h2>' +
        '<p><strong>Data:</strong> ' + o.date + ' | <strong>Status:</strong> ' + (statusInfo[o.status]?.label || o.status) + '</p>' +
        '<p><strong>Cliente:</strong> ' + (o.clientName || '—') + ' | <strong>Tel:</strong> ' + (o.clientPhone || '—') + '</p>' +
        '<p><strong>Entrega:</strong> ' + (o.address || '—') + '</p>' +
        '<br><table><thead><tr><th>Produto</th><th>Qty</th><th>Preço</th><th>Subtotal</th></tr></thead><tbody>' +
        (o.items || []).map(i => '<tr><td>' + i.name + '</td><td>' + i.qty + '</td><td>' + fmt(i.price) + '</td><td>' + fmt(i.price * i.qty) + '</td></tr>').join('') +
        '</tbody></table><br><p><strong>TOTAL: ' + fmt(o.total) + '</strong></p>';
    printArea.classList.remove('hidden');
    window.print();
    printArea.classList.add('hidden');
};

// ---- Banners ----
async function loadBanners(preloadedBanners) {
    const banners = preloadedBanners || await AdminData.getBanners();
    const tbody = document.getElementById('banners-table');
    if (!tbody) return;

    tbody.innerHTML = banners.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted)">Nenhum banner cadastrado.</td></tr>' :
        banners.map(b =>
            '<tr>' +
            '<td><img src="' + b.image + '" style="width:120px; height:50px; object-fit:cover; border-radius:4px; border:1px solid #ddd;"></td>' +
            '<td><strong>' + (b.title || 'Sem título') + '</strong></td>' +
            '<td>' + (b.subtitle || '—') + '</td>' +
            '<td>' +
            '<button class="badge ' + (b.active ? 'badge-ativo' : 'badge-bloqueado') + '" onclick="toggleBannerActive(' + b.id + ')" style="border:none; cursor:pointer;">' +
            (b.active ? '<i class="fas fa-check-circle"></i> Ativo' : '<i class="fas fa-times-circle"></i> Inativo') +
            '</button>' +
            '</td>' +
            '<td>' +
            '<button class="btn-icon btn-icon-edit" onclick="openBannerModal(' + b.id + ')" title="Editar"><i class="fas fa-edit"></i></button> ' +
            '<button class="btn-icon btn-icon-delete" onclick="deleteBanner(' + b.id + ')" title="Excluir"><i class="fas fa-trash"></i></button>' +
            '</td></tr>'
        ).join('');
}

window.toggleBannerActive = async function (id) {
    const banners = await AdminData.getBanners();
    const b = banners.find(item => item.id === id);
    if (b) {
        await supabase.from('banners').update({ active: !b.active }).eq('id', id);
        await loadBanners();
        adminToast('Status do banner atualizado!');
    }
};

window.openBannerModal = async function (id) {
    const modal = document.getElementById('banner-modal');
    modal.classList.remove('hidden');

    // Preview Reset
    const preview = document.getElementById('banner-img-preview');
    const placeholder = document.getElementById('preview-placeholder');
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    if (placeholder) { placeholder.style.display = 'block'; }
    const fileInput = document.getElementById('banner-image-file');
    if (fileInput) fileInput.value = '';

    if (!id) {
        document.getElementById('banner-modal-title').textContent = 'Inserir Novo Banner';
        ['banner-id', 'banner-title', 'banner-subtitle', 'banner-btn-text', 'banner-btn-link', 'banner-image-base64'].forEach(f => { const el = document.getElementById(f); if (el) el.value = ''; });
        document.getElementById('banner-active').checked = true;
        return;
    }

    const banners = await AdminData.getBanners();
    const banner = banners.find(b => b.id === id);
    if (!banner) return;

    document.getElementById('banner-modal-title').textContent = 'Editar Banner';
    document.getElementById('banner-id').value = banner.id;
    document.getElementById('banner-title').value = banner.title || '';
    document.getElementById('banner-subtitle').value = banner.subtitle || '';
    document.getElementById('banner-btn-text').value = banner.btnText || '';
    document.getElementById('banner-btn-link').value = banner.btnLink || '';
    document.getElementById('banner-image-base64').value = banner.image || '';
    document.getElementById('banner-active').checked = !!banner.active;

    if (banner.image && preview) {
        preview.src = banner.image;
        preview.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
    }
};

window.closeBannerModal = function () {
    document.getElementById('banner-modal').classList.add('hidden');
};

window.saveBanner = async function () {
    const id = document.getElementById('banner-id').value;

    const banner = {
        title: document.getElementById('banner-title').value,
        subtitle: document.getElementById('banner-subtitle').value,
        btn_text: document.getElementById('banner-btn-text').value,
        btn_link: document.getElementById('banner-btn-link').value,
        image: document.getElementById('banner-image-base64').value,
        active: document.getElementById('banner-active').checked
    };

    if (!banner.image) { adminToast('É necessário fazer o upload de uma imagem.', 'error'); return; }

    if (id) {
        await supabase.from('banners').update(banner).eq('id', id);
    } else {
        await supabase.from('banners').insert([banner]);
    }

    closeBannerModal();
    await loadBanners();
    adminToast('Banner salvo com sucesso!');
};


// ============================================================
// FINANCE MODULE
// ============================================================
let financeCharts = {};
let cachedFinanceData = null; // Cache para performance

async function loadFinanceData(period = '7days', forceRefresh = false) {
    const container = document.getElementById('section-financeiro');
    if (!container) return;

    // Se já temos os dados e não é um refresh forçado, renderiza instantâneo
    if (cachedFinanceData && !forceRefresh) {
        renderFinanceDashboard(cachedFinanceData, period);
        return;
    }

    // Feedback visual de carregamento
    const btn = document.querySelector('.sidebar-btn[data-section="financeiro"]');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';
    btn.disabled = true;

    try {
        const [orders, products, clients] = await Promise.all([
            AdminData.getOrders(),
            AdminData.getProducts(),
            AdminData.getClients()
        ]);

        cachedFinanceData = { orders, products, clients };
        renderFinanceDashboard(cachedFinanceData, period);
    } catch (err) {
        console.error("Erro ao carregar financeiro:", err);
        adminToast("Erro ao carregar dados financeiros.", "error");
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

function renderFinanceDashboard(data, period) {
    const { orders: allOrders, products, clients } = data;

    // Filtro de Período + Filtro de Cancelados
    const now = new Date();
    const orders = allOrders.filter(o => {
        if (o.status === 'cancelado') return false; // Ignora cancelados
        if (period === 'all') return true;
        const oDate = new Date(o.created_at);
        if (period === 'today') return oDate.toDateString() === now.toDateString();

        const diffDays = (now - oDate) / (1000 * 60 * 60 * 24);
        if (period === '7days') return diffDays <= 7;
        if (period === '30days') return diffDays <= 30;
        if (period === 'year') return oDate.getFullYear() === now.getFullYear();
        return true;
    });

    const totalBilling = orders.reduce((s, o) => s + parseFloat(o.total || 0), 0);
    const avgTicket = orders.length > 0 ? totalBilling / orders.length : 0;

    // Calculo de Cancelados (dentro do período selecionado)
    const canceledOrders = allOrders.filter(o => {
        if (o.status !== 'cancelado') return false;
        if (period === 'all') return true;
        const oDate = new Date(o.created_at);
        if (period === 'today') return oDate.toDateString() === now.toDateString();
        const diffDays = (now - oDate) / (1000 * 60 * 60 * 24);
        if (period === '7days') return diffDays <= 7;
        if (period === '30days') return diffDays <= 30;
        if (period === 'year') return oDate.getFullYear() === now.getFullYear();
        return true;
    });
    const totalCanceled = canceledOrders.reduce((s, o) => s + parseFloat(o.total || 0), 0);

    let totalProfit = 0;
    orders.forEach(o => {
        (o.items || []).forEach(item => {
            const p = products.find(prod => prod.name === item.name);
            if (p) {
                const cost = parseFloat(p.cost || 0);
                const price = parseFloat(item.price || 0);
                totalProfit += (price - cost) * (item.qty || 1);
            }
        });
    });

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setVal('fin-total-billing', fmt(totalBilling));
    setVal('fin-avg-ticket', fmt(avgTicket));
    setVal('fin-total-orders', orders.length);
    setVal('fin-total-profit', fmt(totalProfit));
    setVal('fin-total-canceled', fmt(totalCanceled));

    initOverviewCharts(orders, period);
    loadSalesCharts('7days', allOrders); // Passa allOrders para o gráfico real
    loadProductsFinance(orders, products);
    loadCustomersFinance(orders, clients, period);
}

function initOverviewCharts(orders, period = '7days') {
    const payments = {};
    orders.forEach(o => {
        const method = o.payment_method || 'Outros';
        payments[method] = (payments[method] || 0) + 1;
    });

    renderChart('chart-payment-methods', 'pie', {
        labels: Object.keys(payments),
        datasets: [{
            data: Object.values(payments),
            backgroundColor: ['#27ae60', '#3498db', '#f1c40f', '#e67e22', '#95a5a6']
        }]
    }, { plugins: { title: { display: true, text: 'Formas de Pagamento' } } });

    // Billing Chart adjustment based on period
    let lastDays = {};
    let count = 7;
    if (period === 'today') count = 1;
    if (period === '30days') count = 30;
    if (period === 'all' || period === 'year') count = 30; // Max 30 for visualization

    for (let i = count - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        lastDays[d.toLocaleDateString('pt-BR').substring(0, 5)] = 0;
    }

    orders.forEach(o => {
        const day = o.date.substring(0, 5);
        if (lastDays[day] !== undefined) lastDays[day] += parseFloat(o.total || 0);
    });

    renderChart('chart-billing-overview', 'line', {
        labels: Object.keys(lastDays),
        datasets: [{
            label: 'Faturamento R$',
            data: Object.values(lastDays),
            borderColor: '#27ae60',
            tension: 0.3,
            fill: true,
            backgroundColor: 'rgba(39, 174, 96, 0.1)'
        }]
    });
}

function loadSalesCharts(period, allOrders) {
    if (!allOrders) return;
    const orders = allOrders.filter(o => o.status !== 'cancelado');

    let labels = [];
    let data = [];

    if (period === 'year') {
        labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const monthly = new Array(12).fill(0);
        const currentYear = new Date().getFullYear();
        orders.forEach(o => {
            const d = new Date(o.created_at);
            if (d.getFullYear() === currentYear) monthly[d.getMonth()] += parseFloat(o.total || 0);
        });
        data = monthly;
    } else {
        const daysToCount = period === '30days' ? 30 : 7;
        const timeline = [];
        for (let i = daysToCount - 1; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            timeline.push({
                label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                key: d.toLocaleDateString('pt-BR').substring(0, 5),
                val: 0
            });
        }
        orders.forEach(o => {
            const dayKey = o.date.substring(0, 5);
            const entry = timeline.find(l => l.key === dayKey);
            if (entry) entry.val += parseFloat(o.total || 0);
        });
        labels = timeline.map(l => l.label);
        data = timeline.map(l => l.val);
    }

    renderChart('chart-sales-history', 'bar', {
        labels: labels,
        datasets: [{ label: 'Faturamento R$', data: data, backgroundColor: '#3498db' }]
    });

    // Análise por Dia da Semana (Real)
    const dowLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    const dowData = new Array(7).fill(0);
    orders.forEach(o => {
        const d = new Date(o.created_at);
        dowData[d.getDay()] += parseFloat(o.total || 0);
    });

    renderChart('chart-dow-analysis', 'radar', {
        labels: dowLabels,
        datasets: [{ label: 'Vendas acumuladas por dia', data: dowData, borderColor: '#e67e22' }]
    });
}

function loadProductsFinance(orders, products) {
    const ranking = {};
    orders.forEach(o => {
        (o.items || []).forEach(item => {
            if (!ranking[item.name]) ranking[item.name] = { qty: 0, revenue: 0, profit: 0 };
            ranking[item.name].qty += item.qty;
            ranking[item.name].revenue += item.price * item.qty;

            const p = products.find(prod => prod.name === item.name);
            if (p) {
                ranking[item.name].profit += (item.price - (p.cost || 0)) * item.qty;
            }
        });
    });

    const sorted = Object.entries(ranking).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
    const tbody = document.getElementById('fin-products-ranking');
    if (tbody) tbody.innerHTML = sorted.map(([name, data]) => {
        const profitColor = data.profit < 0 ? '#e74c3c' : '#27ae60';
        return `
            <tr>
                <td>${name}</td>
                <td>${data.qty}</td>
                <td>${fmt(data.revenue)}</td>
                <td style="color: ${profitColor}; font-weight: 700;">${fmt(data.profit)}</td>
            </tr>
        `;
    }).join('');

    const lowStock = products.filter(p => p.stock <= 5);
    const container = document.getElementById('fin-low-stock-container');
    if (container) {
        if (lowStock.length > 0) {
            container.innerHTML = `<h4><i class="fas fa-exclamation-triangle"></i> Alerta de Estoque Baixo (Menos de 5 und)</h4>` +
                lowStock.map(p => `<p>• ${p.name}: <strong>${p.stock} unidades</strong> restantes.</p>`).join('');
        } else {
            container.innerHTML = `<p style="color: #27ae60"><i class="fas fa-check-circle"></i> Estoque em dia.</p>`;
        }
    }
}

function loadCustomersFinance(orders, clients, period = '7days') {
    const customerValue = {};
    orders.forEach(o => {
        if (!o.clientEmail) return;
        if (!customerValue[o.clientEmail]) customerValue[o.clientEmail] = { name: o.clientName, orders: 0, total: 0 };
        customerValue[o.clientEmail].orders++;
        customerValue[o.clientEmail].total += parseFloat(o.total || 0);
    });

    const vips = Object.entries(customerValue).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
    const tbody = document.getElementById('fin-vip-ranking');
    if (tbody) tbody.innerHTML = vips.map(([email, data]) => {
        const avg = data.total / (data.orders || 1);
        return `
            <tr>
                <td>${data.name} <br><small>${email}</small></td>
                <td>${data.orders}</td>
                <td>${fmt(data.total)}</td>
                <td>${fmt(avg)}</td>
            </tr>
        `;
    }).join('');

    const now = new Date();
    const newClients = clients.filter(c => {
        if (period === 'all') return true;
        const cDate = new Date(c.created_at);
        if (period === 'today') return cDate.toDateString() === now.toDateString();
        const diffDays = (now - cDate) / (1000 * 60 * 60 * 24);
        if (period === '7days') return diffDays <= 7;
        if (period === '30days') return diffDays <= 30;
        if (period === 'year') return cDate.getFullYear() === now.getFullYear();
        return true;
    }).length;
    const purchasingClientsCount = Object.keys(customerValue).length;
    const recurring = Object.values(customerValue).filter(v => v.orders > 1).length;

    const totalBilling = orders.reduce((s, o) => s + parseFloat(o.total || 0), 0);
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setVal('fin-ltv', fmt(totalBilling / (purchasingClientsCount || 1)));
    setVal('fin-recurring-clients', recurring);
    setVal('fin-new-clients', clients.length);
    setVal('fin-return-rate', (purchasingClientsCount > 0 ? (recurring / purchasingClientsCount * 100).toFixed(0) : 0) + '%');
}

function renderChart(id, type, data, options = {}) {
    if (financeCharts[id]) financeCharts[id].destroy();
    const el = document.getElementById(id);
    if (!el) return;
    const ctx = el.getContext('2d');
    financeCharts[id] = new Chart(ctx, {
        type: type,
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            ...options
        }
    });
}

window.deleteBanner = async function (id) {
    if (!confirm('Excluir este banner permanentemente?')) return;
    await supabase.from('banners').delete().eq('id', id);
    await loadBanners();
    adminToast('Banner removido.', 'error');
};

// Handle Banner Image Upload
document.addEventListener('change', e => {
    if (e.target.id === 'banner-image-file') {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (event) {
            const base64 = event.target.result;
            document.getElementById('banner-image-base64').value = base64;
            const preview = document.getElementById('banner-img-preview');
            const placeholder = document.getElementById('preview-placeholder');
            if (preview) { preview.src = base64; preview.style.display = 'block'; }
            if (placeholder) { placeholder.style.display = 'none'; }
        };
        reader.readAsDataURL(file);
    }
});

// ============================================================
// BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    await initAdminLogin();
    await initAdminDashboard();
});

// ============================================================
// MARCAS
// ============================================================
// ============================================================
// MARCAS
// ============================================================
async function loadBrands() {
    const brands = await AdminData.getBrands();
    const tbody = document.getElementById('marcas-table');
    if (!tbody) return;

    tbody.innerHTML = brands.length === 0 ? '<tr><td colspan="2" style="text-align:center;padding:20px;color:var(--text-muted)">Nenhuma marca cadastrada.</td></tr>' :
        brands.map(b =>
            '<tr>' +
            '<td><strong>' + b.name + '</strong></td>' +
            '<td>' +
            '<button class="btn-icon btn-icon-edit" onclick="openBrandModal(' + b.id + ')" title="Editar"><i class="fas fa-edit"></i></button> ' +
            '<button class="btn-icon btn-icon-delete" onclick="deleteBrand(' + b.id + ')" title="Excluir"><i class="fas fa-trash"></i></button>' +
            '</td></tr>'
        ).join('');
}

async function populateBrandSelect() {
    const select = document.getElementById('prod-brand');
    if (!select) return;
    const brands = await AdminData.getBrands();
    select.innerHTML = '<option value="">Sem Marca</option>' + brands.map(b => '<option value="' + b.name + '">' + b.name + '</option>').join('');
}

window.openBrandModal = async function (id) {
    const modal = document.getElementById('brand-modal');
    modal.classList.remove('hidden');

    if (!id) {
        document.getElementById('brand-modal-title').textContent = 'Nova Marca';
        document.getElementById('brand-id').value = '';
        document.getElementById('brand-name').value = '';
        return;
    }

    const brands = await AdminData.getBrands();
    const b = brands.find(item => item.id == id);
    if (b) {
        document.getElementById('brand-modal-title').textContent = 'Editar Marca';
        document.getElementById('brand-id').value = b.id;
        document.getElementById('brand-name').value = b.name;
    }
};

window.closeBrandModal = function () {
    document.getElementById('brand-modal').classList.add('hidden');
};

window.saveBrand = async function () {
    const id = document.getElementById('brand-id').value;
    const name = document.getElementById('brand-name').value.trim();

    if (!name) { adminToast('O nome da marca é obrigatório!', 'error'); return; }

    if (id) {
        await supabase.from('brands').update({ name }).eq('id', id);
    } else {
        await supabase.from('brands').insert([{ name }]);
    }

    adminToast('Marca salva com sucesso!');
    closeBrandModal();
    await loadBrands();
};

window.deleteBrand = async function (id) {
    if (!confirm('Deseja excluir esta marca?')) return;
    await supabase.from('brands').delete().eq('id', id);
    adminToast('Marca excluída!');
    await loadBrands();
};
