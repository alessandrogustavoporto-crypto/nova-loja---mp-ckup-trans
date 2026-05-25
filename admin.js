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
let dashCurrentPage = 1;
const dashPageSize = 30;
let dashPendingOrders = [];
let caixaUpdateInterval = null;

function logErrorToDOM(msg) {
    const div = document.createElement('div');
    div.style.position = 'fixed'; div.style.top = '0'; div.style.left = '0'; div.style.right = '0'; div.style.background = 'red'; div.style.color = 'white'; div.style.padding = '20px'; div.style.zIndex = '999999'; div.style.fontSize = '24px'; div.style.fontWeight = 'bold';
    div.textContent = 'ERRO CRÍTICO: ' + msg;
    if (document.body) document.body.prepend(div); else window.onload = () => document.body.prepend(div);
}
window.addEventListener('error', function (e) { logErrorToDOM(e.message); });
window.addEventListener('unhandledrejection', function (e) { logErrorToDOM(e.reason ? e.reason.message || e.reason : 'Rejeição de promessa'); });

// ---- Layout / Sidebar ----
window.toggleSidebar = function() {
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;

    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('mobile-open');
        if (overlay) overlay.classList.toggle('active');
    } else {
        sidebar.classList.toggle('collapsed');
    }
};


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
        const { data } = await supabase
            .from('orders')
            .select('id, client_name, client_email, total, status, status_label, created_at, items, address')
            .order('id', { ascending: false });
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
        const { data } = await supabase
            .from('products')
            .select('id, name, category, brand, price, promo_price, promo_active, old_price, image, stock, variations, barcode, description, cost')
            .order('id', { ascending: false });
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

    async getClients(preloadedOrders = null) {
        const { data } = await supabase
            .from('customers')
            .select('id, name, email, phone, cpf, cnpj, is_pj, status, address, created_at')
            .order('created_at', { ascending: false });
        const orders = preloadedOrders || [];
        return (data || []).map(u => ({
            ...u,
            type: u.is_pj ? 'PJ' : 'PF',
            orders: orders.filter(o => o.clientEmail === u.email).length
        }));
    },

    async getBanners() {
        const { data } = await supabase
            .from('banners')
            .select('id, title, subtitle, btn_text, btn_link, image, active')
            .order('id', { ascending: true });
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

    // 1. Busca todos os dados em paralelo — orders primeiro para reutilizar em getClients
    const [orders, products, categories, brands, banners] = await Promise.all([
        AdminData.getOrders(),
        AdminData.getProducts(),
        AdminData.getCategories(),
        AdminData.getBrands(),
        AdminData.getBanners()
    ]);
    // Clientes reutiliza orders já carregados — elimina o segundo fetch de pedidos
    const clients = await AdminData.getClients(orders);

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
    // Dados da empresa são carregados apenas ao abrir a aba (evita salvar dados vazios)

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

        // Gerenciar atualização automática da aba Caixa
        if (caixaUpdateInterval) {
            clearInterval(caixaUpdateInterval);
            caixaUpdateInterval = null;
        }

        // Carregamento instantâneo via cache
        if (sectionId === 'financeiro') loadFinanceData('7days');
        if (sectionId === 'empresa') loadStoreSettings();
        if (sectionId === 'estoque') loadStock();
        if (sectionId === 'caixa') {
            initCaixaDashboard();
            caixaUpdateInterval = setInterval(async () => {
                const secCaixa = document.getElementById('section-caixa');
                if (currentCashSession && secCaixa && secCaixa.classList.contains('active')) {
                    // Verificar se o caixa deve ser fechado automaticamente (23:50 ou dia anterior)
                    const wasClosed = await checkAndAutoCloseCaixa(currentCashSession);
                    if (!wasClosed) {
                        await renderCaixaAbertoState();
                    }
                }
            }, 10000); // Atualiza a cada 10 segundos
        }
        if (sectionId === 'entradas') {
            initEntradasModule();
        }

        // No mobile, fecha a sidebar automaticamente ao clicar em uma seção
        if (window.innerWidth <= 768) {
            window.toggleSidebar();
        }
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
    if (salesFilter && !salesFilter._bound) {
        salesFilter._bound = true;
        salesFilter.addEventListener('change', () => updateFinanceSales(salesFilter.value));
    }

    // Customer Period Filter
    const custFilter = document.getElementById('cust-period-filter');
    if (custFilter && !custFilter._bound) {
        custFilter._bound = true;
        custFilter.addEventListener('change', () => updateFinanceCustomers(custFilter.value));
    }

    // Overview Period Filter
    const ovFilter = document.getElementById('overview-period-filter');
    if (ovFilter && !ovFilter._bound) {
        ovFilter._bound = true;
        ovFilter.addEventListener('change', () => updateFinanceOverview(ovFilter.value));
    }

    // Product Period Filter
    const prodFilter = document.getElementById('prod-period-filter');
    if (prodFilter && !prodFilter._bound) {
        prodFilter._bound = true;
        prodFilter.addEventListener('change', () => updateFinanceProducts(prodFilter.value));
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
async function loadDashboard(orders, products, clients, banners, period = 'all') {
    if (!orders) orders = await AdminData.getOrders();
    allAdminOrders = orders; 
    if (!products) products = await AdminData.getProducts();
    if (!clients) clients = await AdminData.getClients();
    if (!banners) banners = await AdminData.getBanners();

    // Filtro de Período para os Pedidos Pendentes e Novos Clientes no Dashboard
    const now = new Date();
    const pending = orders.filter(o => {
        const isPending = ['aguardando','separacao','processando'].includes(o.status);
        if (!isPending) return false;
        if (period === 'all') return true;
        const oDate = new Date(o.created_at);
        if (period === 'today') return oDate.toDateString() === now.toDateString();
        const diffDays = (now - oDate) / (1000 * 60 * 60 * 24);
        if (period === '7days') return diffDays <= 7;
        if (period === '30days') return diffDays <= 30;
        if (period === 'year') return oDate.getFullYear() === now.getFullYear();
        return true;
    }).length;

    const activeBanners = banners.filter(b => b.active).length;

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setVal('kpi-pending', pending);
    setVal('kpi-clients', clients.length);
    setVal('kpi-total-products', products.length);
    setVal('kpi-banners', activeBanners);

    // Filtrar apenas pedidos pendentes para a lista do dashboard
    dashPendingOrders = orders.filter(o => ['aguardando', 'separacao', 'processando'].includes(o.status));
    dashCurrentPage = 1;
    renderDashboardOrders();
}

function renderDashboardOrders() {
    const tbody = document.getElementById('dashboard-orders-table');
    const pagContainer = document.getElementById('dashboard-pagination');
    if (!tbody || !pagContainer) return;

    const start = (dashCurrentPage - 1) * dashPageSize;
    const end = start + dashPageSize;
    const paginated = dashPendingOrders.slice(start, end);

    if (dashPendingOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted)">Nenhum pedido pendente.</td></tr>';
        pagContainer.innerHTML = '';
        return;
    }

    tbody.innerHTML = paginated.map((o, index) =>
        '<tr>' +
        '<td>' + (start + index + 1) + '</td>' +
        '<td><strong>#' + String(o.id).padStart(5, '0') + '</strong></td>' +
        '<td>' + (o.clientName || '—') + '</td>' +
        '<td>' + o.date + '</td>' +
        '<td>' + fmt(o.total) + '</td>' +
        '<td>' + statusBadge(o.status) + '</td>' +
        '<td><button class="btn-icon btn-icon-view" onclick="viewOrder(\'' + o.id + '\')"><i class="fas fa-eye"></i></button></td>' +
        '</tr>'
    ).join('');

    // Render Pagination
    const totalPages = Math.ceil(dashPendingOrders.length / dashPageSize);
    let html = `
        <button class="btn-icon" ${dashCurrentPage === 1 ? 'disabled' : ''} onclick="changeDashPage(${dashCurrentPage - 1})"><i class="fas fa-chevron-left"></i></button>
        <span style="font-weight:600; font-size:14px;">Página ${dashCurrentPage} de ${totalPages}</span>
        <button class="btn-icon" ${dashCurrentPage === totalPages ? 'disabled' : ''} onclick="changeDashPage(${dashCurrentPage + 1})"><i class="fas fa-chevron-right"></i></button>
    `;
    pagContainer.innerHTML = html;
}

window.changeDashPage = function (page) {
    dashCurrentPage = page;
    renderDashboardOrders();
    document.getElementById('dashboard-orders-table').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

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
        ['prod-id', 'prod-name', 'prod-image-url', 'prod-desc', 'prod-barcode'].forEach(f => { const el = document.getElementById(f); if (el) el.value = ''; });
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
    document.getElementById('prod-image-url').value = prod.image || '';
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
        image: document.getElementById('prod-image-url').value,
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

// ---- Tenta criar o bucket 'product-images' automaticamente caso não exista ----
async function tryCreateBucket() {
    try {
        const { error } = await supabase.storage.createBucket('product-images', { public: true });
        if (!error) {
            console.log("Bucket 'product-images' criado com sucesso!");
            return true;
        }
    } catch (e) {
        console.warn("Falha ao criar o bucket automaticamente (normal para chaves de acesso anônimas).");
    }
    return false;
}

// ---- Upload de Imagem de Produto para o Supabase Storage ----
async function uploadProductImage(file) {
    const statusEl = document.getElementById('prod-upload-status');
    const statusText = document.getElementById('prod-upload-status-text');
    const preview = document.getElementById('prod-img-preview');

    // Mostra spinner
    if (statusEl) { statusEl.style.display = 'flex'; }
    if (statusText) statusText.textContent = 'Enviando imagem...';

    // Tenta criar o bucket se não existir
    await tryCreateBucket();

    try {
        // Gera nome de arquivo único e seguro
        const ext = file.name.split('.').pop().toLowerCase();
        const safeName = file.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `produtos/${Date.now()}_${safeName}`;

        // Upload para o Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(fileName, file, { upsert: true, contentType: file.type });

        if (uploadError) throw uploadError;

        // Obtém a URL pública
        const { data: urlData } = supabase.storage
            .from('product-images')
            .getPublicUrl(fileName);

        const publicUrl = urlData.publicUrl;

        // Armazena URL e atualiza prévia
        document.getElementById('prod-image-url').value = publicUrl;
        if (preview) {
            preview.src = publicUrl;
            preview.style.display = 'block';
        }

        if (statusText) statusText.textContent = '✓ Imagem enviada com sucesso!';
        setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 2500);

    } catch (err) {
        console.error('Erro ao enviar imagem:', err);
        const errMsg = err.message || '';
        if (errMsg.includes('Bucket not found')) {
            alert("Atenção: O bucket 'product-images' não existe no seu Supabase Storage!\n\nComo resolver em 10 segundos:\n1. Acesse o painel do seu Supabase (https://supabase.com)\n2. Vá em 'Storage' no menu esquerdo\n3. Clique em 'New Bucket'\n4. Digite o nome exato: product-images\n5. Marque a opção 'Public'\n6. Clique em Salvar e tente novamente!");
        } else if (errMsg.includes('row-level security') || errMsg.includes('security policy')) {
            alert("Atenção: Upload bloqueado pelas Políticas de Segurança (RLS) do Supabase!\n\nComo resolver em 30 segundos:\n1. Acesse o painel do Supabase (https://supabase.com)\n2. Vá em 'Storage' -> 'Policies' no menu lateral\n3. Sob o bucket 'product-images', clique em 'New Policy'\n4. Selecione 'Get started quickly' (ou similar)\n5. Escolha a opção: 'Give uploads access to everyone (public)' (marca as permissões INSERT e SELECT para anon/public)\n6. Salve a política e tente novamente!");
        }
        if (statusText) statusText.textContent = '✗ Erro ao enviar: ' + (err.message || 'verifique o Storage');
        adminToast('Erro ao enviar imagem: ' + (err.message || 'verifique as políticas de RLS no bucket'), 'error');
    }
}

// Handler de seleção de arquivo de produto → aciona upload para Storage
document.addEventListener('change', e => {
    if (e.target.id === 'prod-image-file') {
        const file = e.target.files[0];
        if (!file) return;
        uploadProductImage(file);
    }
});

// ---- MIGRAR IMAGENS BASE64 PARA SUPABASE STORAGE ----
let base64ProductsToMigrate = [];

window.openMigrateImagesModal = async function () {
    const modal = document.getElementById('modal-migrate-images');
    if (!modal) return;

    modal.classList.remove('hidden');

    const infoEl = document.getElementById('migrate-count-info');
    const startBtn = document.getElementById('migrate-start-btn');
    const startArea = document.getElementById('migrate-start-area');
    const progressArea = document.getElementById('migrate-progress-area');
    const doneBtn = document.getElementById('migrate-done-btn');
    const closeBtn = document.getElementById('migrate-close-btn');

    if (infoEl) infoEl.textContent = 'Buscando produtos no banco de dados...';
    if (startBtn) startBtn.style.display = 'none';
    if (startArea) startArea.style.display = 'block';
    if (progressArea) progressArea.style.display = 'none';
    if (doneBtn) doneBtn.style.display = 'none';
    if (closeBtn) closeBtn.style.display = 'block';

    try {
        // Carrega produtos
        const { data: products, error } = await supabase.from('products').select('id, name, image');
        if (error) throw error;

        // Filtra os que têm base64
        base64ProductsToMigrate = (products || []).filter(p => p.image && p.image.startsWith('data:image/'));

        if (infoEl) {
            if (base64ProductsToMigrate.length === 0) {
                infoEl.textContent = '✓ Excelente! Nenhum produto com imagem em Base64 encontrado. Todos já estão no Storage ou sem imagem.';
                if (startBtn) startBtn.style.display = 'none';
            } else {
                infoEl.textContent = `Encontrado(s) ${base64ProductsToMigrate.length} produto(s) com imagem em Base64 aguardando migração.`;
                if (startBtn) startBtn.style.display = 'inline-block';
            }
        }
    } catch (err) {
        console.error('Erro ao verificar imagens:', err);
        if (infoEl) infoEl.textContent = 'Erro ao carregar lista de produtos: ' + err.message;
    }
};

window.closeMigrateImagesModal = function () {
    const modal = document.getElementById('modal-migrate-images');
    if (modal) modal.classList.add('hidden');
};

function base64ToBlob(base64, contentType) {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
}

window.startImageMigration = async function () {
    const startArea = document.getElementById('migrate-start-area');
    const progressArea = document.getElementById('migrate-progress-area');
    const progressBar = document.getElementById('migrate-progress-bar');
    const progressText = document.getElementById('migrate-progress-text');
    const logEl = document.getElementById('migrate-log');
    const doneBtn = document.getElementById('migrate-done-btn');
    const closeBtn = document.getElementById('migrate-close-btn');

    if (startArea) startArea.style.display = 'none';
    if (progressArea) progressArea.style.display = 'block';
    if (closeBtn) closeBtn.style.display = 'none'; // Desabilita fechar durante migração
    if (doneBtn) doneBtn.style.display = 'none';

    if (progressBar) progressBar.style.width = '0%';
    if (progressText) progressText.textContent = `0 / ${base64ProductsToMigrate.length}`;
    if (logEl) logEl.innerHTML = '<div>Iniciando migração...</div>';

    // Tenta criar o bucket se não existir
    await tryCreateBucket();

    let successCount = 0;
    let failCount = 0;
    let isBucketMissing = false;
    let isRLSBlocked = false;

    for (let i = 0; i < base64ProductsToMigrate.length; i++) {
        const p = base64ProductsToMigrate[i];
        const logItem = document.createElement('div');
        logItem.style.marginBottom = '4px';
        logItem.textContent = `[${i+1}/${base64ProductsToMigrate.length}] Processando: "${p.name}"...`;
        if (logEl) {
            logEl.appendChild(logItem);
            logEl.scrollTop = logEl.scrollHeight;
        }

        try {
            // Decodifica Base64
            const matches = p.image.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
            if (!matches) {
                throw new Error('Formato Base64 inválido ou não suportado.');
            }

            const contentType = matches[1];
            const base64Data = matches[2];
            const ext = contentType.split('/')[1] || 'png';
            const safeName = p.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const fileName = `produtos/migrated_${p.id}_${Date.now()}.${ext}`;

            // Converte e faz Upload
            const blob = base64ToBlob(base64Data, contentType);
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(fileName, blob, { upsert: true, contentType: contentType });

            if (uploadError) throw uploadError;

            // Obtém URL Pública
            const { data: urlData } = supabase.storage
                .from('product-images')
                .getPublicUrl(fileName);

            const publicUrl = urlData.publicUrl;

            // Atualiza no banco
            const { error: updateError } = await supabase.from('products')
                .update({ image: publicUrl })
                .eq('id', p.id);

            if (updateError) throw updateError;

            successCount++;
            logItem.textContent += ' ✓ Migrado com sucesso!';
            logItem.style.color = '#a8e6c3';
        } catch (err) {
            failCount++;
            console.error(`Erro ao migrar produto ${p.name}:`, err);
            
            const errMsg = err.message || '';
            let logMsg = ` ✗ Erro: ${err.message || err}`;
            if (errMsg.includes('Bucket not found')) {
                logMsg = ` ✗ Erro: Bucket "product-images" não encontrado.`;
                isBucketMissing = true;
            } else if (errMsg.includes('row-level security') || errMsg.includes('security policy')) {
                logMsg = ` ✗ Erro: Permissão negada pela política RLS do bucket.`;
                isRLSBlocked = true;
            }
            logItem.textContent += logMsg;
            logItem.style.color = '#ff7675';
        }

        // Atualiza Progresso
        const pct = Math.round(((i + 1) / base64ProductsToMigrate.length) * 100);
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (progressText) progressText.textContent = `${i + 1} / ${base64ProductsToMigrate.length}`;
    }

    // Finalização
    const summary = document.createElement('div');
    summary.style.marginTop = '10px';
    summary.style.fontWeight = 'bold';
    summary.style.borderTop = '1px solid #333';
    summary.style.paddingTop = '8px';
    summary.textContent = `Fim da migração! Sucesso: ${successCount} | Falhas: ${failCount}`;
    if (logEl) {
        logEl.appendChild(summary);
        
        if (isBucketMissing) {
            const warning = document.createElement('div');
            warning.style.marginTop = '10px';
            warning.style.color = '#ffeaa7';
            warning.style.border = '1px dashed #ffeaa7';
            warning.style.padding = '8px';
            warning.style.borderRadius = '4px';
            warning.style.lineHeight = '1.6';
            warning.innerHTML = `<strong>⚠️ Como resolver o erro "Bucket not found":</strong><br>` +
                `1. Acesse o painel do seu Supabase (https://supabase.com)<br>` +
                `2. Clique em <strong>Storage</strong> no menu lateral esquerdo<br>` +
                `3. Clique em <strong>New Bucket</strong> no topo<br>` +
                `4. Nomeie como: <strong>product-images</strong> (exatamente igual)<br>` +
                `5. Ative a opção <strong>Public</strong><br>` +
                `6. Clique em Salvar e tente rodar a migração novamente!`;
            logEl.appendChild(warning);
        } else if (isRLSBlocked) {
            const rlsWarning = document.createElement('div');
            rlsWarning.style.marginTop = '10px';
            rlsWarning.style.color = '#ff7675';
            rlsWarning.style.border = '1px dashed #ff7675';
            rlsWarning.style.padding = '8px';
            rlsWarning.style.borderRadius = '4px';
            rlsWarning.style.lineHeight = '1.6';
            rlsWarning.innerHTML = `<strong>⚠️ Como resolver o erro RLS (Permissão Negada):</strong><br>` +
                `O seu Supabase está bloqueando os uploads porque faltam as políticas de acesso público.<br>` +
                `1. Acesse o painel do seu Supabase (https://supabase.com)<br>` +
                `2. Vá em <strong>Storage</strong> -> <strong>Policies</strong> no menu lateral esquerdo<br>` +
                `3. Sob a seção do bucket <strong>product-images</strong>, clique em <strong>New Policy</strong><br>` +
                `4. Selecione a opção rápida <strong>"Get started quickly"</strong><br>` +
                `5. Escolha a opção: <strong>"Give uploads access to everyone (public)"</strong> (irá marcar INSERT e SELECT para anon/public)<br>` +
                `6. Clique em <strong>Save</strong> para aplicar a política e tente rodar a migração novamente!`;
            logEl.appendChild(rlsWarning);
        }
        
        logEl.scrollTop = logEl.scrollHeight;
    }

    if (closeBtn) closeBtn.style.display = 'block';
    if (doneBtn) doneBtn.style.display = 'inline-block';

    adminToast(`Migração concluída! Sucesso: ${successCount}, Falhas: ${failCount}`, failCount > 0 ? 'warning' : 'success');
    await loadProducts(); // Recarrega os produtos para atualizar a tabela
};

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
                    <button class="btn-icon" onclick="printOrderFromTable('${o.id}')" title="Imprimir Pedido" style="color: #34495e;"><i class="fas fa-print"></i></button>
                    <button class="btn-icon btn-icon-delete" onclick="deleteOrder('${o.id}')" title="Excluir Pedido" style="color:#e74c3c;"><i class="fas fa-trash"></i></button>
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
        '<p><strong>Pagamento:</strong> ' + (o.payment_method || '—') + '</p>' +
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
        (o.discount_amount > 0 ? '<div style="text-align:right;font-size:14px;color:#e74c3c;margin-top:5px;">Desconto: - ' + fmt(o.discount_amount) + '</div>' : '') +
        '<div style="text-align:right;font-size:18px;font-weight:700;color:var(--primary-green);margin-top:5px;">Total: ' + fmt(o.total) + '</div>';

    // Store for print
    window._currentOrder = o;
    document.getElementById('order-detail-modal').classList.remove('hidden');
};

window.closeOrderModal = function () { document.getElementById('order-detail-modal').classList.add('hidden'); };

window.deleteOrder = async function (id) {
    const targetId = id || (window._currentOrder && window._currentOrder.id);
    if (!targetId) return;
    if (!confirm('Tem certeza que deseja excluir o pedido #' + String(targetId).padStart(5, '0') + '?\nEsta ação é irreversível.')) return;
    const { error } = await supabase.from('orders').delete().eq('id', targetId);
    if (error) { adminToast('Erro ao excluir pedido: ' + error.message, 'error'); return; }
    const modal = document.getElementById('order-detail-modal');
    if (modal && !modal.classList.contains('hidden')) closeOrderModal();
    adminToast('Pedido #' + String(targetId).padStart(5, '0') + ' excluído com sucesso.', 'error');
    initAdminDashboard();
};

window.printOrderFromTable = async function (id) {
    const o = allAdminOrders.find(o => o.id == id);
    if (o) {
        window._currentOrder = o;
        await printOrder();
    }
};

window.printOrder = async function () {
    const o = window._currentOrder;
    if (!o) return;

    // Usa cache se disponível, senão faz nova busca
    let store = window._storeSettings;
    if (!store) {
        const { data: stores } = await supabase.from('store_settings').select('*').limit(1);
        store = (stores && stores.length > 0) ? stores[0] : null;
        window._storeSettings = store;
    }

    const storeName = store?.store_name || 'MINHA LOJA';
    const companyName = store?.company_name || 'Razão Social não informada';
    const cnpj = store?.cnpj || 'Não informado';
    const ie = store?.state_registration || 'Não informado';
    const phone = store?.phone || 'Não informado';
    const email = store?.email || 'Não informado';

    let storeAddress = 'Endereço não cadastrado';
    if (store?.address) {
        const a = store.address;
        const parts = [a.street, a.number ? `nº ${a.number}` : '', a.neighborhood, a.city, a.uf ? `/ ${a.uf}` : '', a.cep ? `CEP: ${a.cep}` : ''].filter(Boolean);
        storeAddress = parts.join(', ');
    }

    const printArea = document.getElementById('print-area');
    printArea.innerHTML = `
        <div class="danfe-container">
            <div class="danfe-header">
                <div class="company-info">
                    <h2 style="margin:0; font-size:20px;">${storeName.toUpperCase()}</h2>
                    <p><strong>${companyName}</strong></p>
                    <p>CNPJ: ${cnpj} &nbsp;|&nbsp; IE: ${ie}</p>
                    <p>${storeAddress}</p>
                    <p>Fone: ${phone} &nbsp;|&nbsp; Email: ${email}</p>
                </div>
                <div class="order-badge">
                    <p>DOCUMENTO AUXILIAR DE VENDA</p>
                    <h3>PEDIDO Nº ${String(o.id).padStart(5, '0')}</h3>
                    <p>Data: ${o.date}</p>
                </div>
            </div>

            <div class="danfe-section">
                <div class="section-title">DADOS DO CLIENTE</div>
                <div class="danfe-grid">
                    <p><strong>NOME:</strong> ${o.clientName || 'CONSUMIDOR FINAL'}</p>
                    <p><strong>E-MAIL:</strong> ${o.clientEmail || '—'}</p>
                    <p><strong>TELEFONE:</strong> ${o.clientPhone || '—'}</p>
                    <p><strong>ENDEREÇO:</strong> ${o.address || '—'}</p>
                </div>
            </div>

            <div class="danfe-section">
                <div class="section-title">ITENS DO PEDIDO</div>
                <table class="danfe-table">
                    <thead>
                        <tr>
                            <th>DESCRIÇÃO DO PRODUTO</th>
                            <th>VALOR UNIT.</th>
                            <th>QTD</th>
                            <th>TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(o.items || []).map(i => `
                            <tr>
                                <td>${i.name}</td>
                                <td>${fmt(i.price)}</td>
                                <td>${i.qty}</td>
                                <td>${fmt(i.price * i.qty)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="danfe-footer">
                <div class="footer-totals">
                    <p>VALOR TOTAL DOS PRODUTOS: <strong>${fmt((o.items || []).reduce((acc, i) => acc + (i.price * i.qty), 0))}</strong></p>
                    ${o.discount_amount > 0 ? `<p>DESCONTO CONCEDIDO: <strong style="color:red">- ${fmt(o.discount_amount)}</strong></p>` : ''}
                    <h2 style="margin-top:10px;">TOTAL LÍQUIDO: ${fmt(o.total)}</h2>
                    <p style="margin-top:10px; font-size:12px; font-style:italic;">Forma de Pagamento: ${o.payment_method || '—'}</p>
                </div>
                <div class="danfe-obs">
                    <p><strong>Observações:</strong> Documento sem valor fiscal. Agradecemos a preferência!</p>
                </div>
            </div>
        </div>
    `;

    printArea.classList.remove('hidden');
    window.print();
    printArea.classList.add('hidden');
};

// ============================================================
// SECTION: Estoque
// ============================================================
let _allStockProducts = [];
let _stockCurrentPage = 1;
const _stockPageSize = 15;
let _currentStockList = [];
let _currentStockCategories = [];

async function loadStock() {
    const products = await AdminData.getProducts();
    const categories = cachedAdminData.categories || await AdminData.getCategories();
    _allStockProducts = products;

    // KPI Cards
    const total = products.length;
    const low = products.filter(p => p.stock > 0 && p.stock <= 5).length;
    const zero = products.filter(p => !p.stock || p.stock <= 0).length;
    const totalValue = products.reduce((acc, p) => acc + ((p.cost || 0) * (p.stock || 0)), 0);

    const setKpi = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setKpi('stock-kpi-total', total);
    setKpi('stock-kpi-low', low);
    setKpi('stock-kpi-zero', zero);
    setKpi('stock-kpi-value', fmt(totalValue));

    renderStockTable(products, categories);

    // Bind filters (resetam para pág 1)
    const searchEl = document.getElementById('stock-search');
    const filterEl = document.getElementById('stock-status-filter');
    const applyFilter = () => {
        const q = (searchEl?.value || '').toLowerCase();
        const s = filterEl?.value || '';
        let filtered = _allStockProducts;
        if (q) filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
        if (s === 'ok') filtered = filtered.filter(p => p.stock > 5);
        if (s === 'low') filtered = filtered.filter(p => p.stock > 0 && p.stock <= 5);
        if (s === 'zero') filtered = filtered.filter(p => !p.stock || p.stock <= 0);
        _stockCurrentPage = 1;
        renderStockTable(filtered, categories);
    };
    if (searchEl && !searchEl._stockBound) { searchEl._stockBound = true; searchEl.addEventListener('input', applyFilter); }
    if (filterEl && !filterEl._stockBound) { filterEl._stockBound = true; filterEl.addEventListener('change', applyFilter); }

    // Load exit report for current month by default
    loadStockExitReport();

    // Abas internas do estoque
    const stockTabBtns = document.querySelectorAll('[data-stock-tab]');
    stockTabBtns.forEach(btn => {
        if (btn._stockTabBound) return;
        btn._stockTabBound = true;
        btn.addEventListener('click', () => {
            stockTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.stock-tab-content').forEach(c => c.style.display = 'none');
            const target = document.getElementById('stock-tab-' + btn.dataset.stockTab);
            if (target) target.style.display = 'block';
        });
    });
}

function renderStockTable(products, categories) {
    // Atualiza lista e cat em cache (para navegação de páginas)
    _currentStockList = products;
    _currentStockCategories = categories;

    const tbody = document.getElementById('stock-table-body');
    const pageInfo = document.getElementById('stock-page-info');
    const pageNumbers = document.getElementById('stock-page-numbers');
    if (!tbody) return;

    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted)">Nenhum produto encontrado.</td></tr>';
        if (pageInfo) pageInfo.textContent = '';
        if (pageNumbers) pageNumbers.innerHTML = '';
        return;
    }

    // --- Paginação ---
    const totalPages = Math.ceil(products.length / _stockPageSize);
    if (_stockCurrentPage > totalPages) _stockCurrentPage = totalPages;
    const start = (_stockCurrentPage - 1) * _stockPageSize;
    const paginated = products.slice(start, start + _stockPageSize);

    if (pageInfo) pageInfo.textContent = `Exibindo ${start + 1}–${Math.min(start + _stockPageSize, products.length)} de ${products.length} produtos`;

    // Números das páginas
    if (pageNumbers) {
        pageNumbers.innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1).map(page => `
            <button
                onclick="goStockPage(${page})"
                style="
                    min-width:34px; height:34px; border-radius:6px; border:1px solid ${page === _stockCurrentPage ? 'var(--primary-green)' : '#ddd'};
                    background:${page === _stockCurrentPage ? 'var(--primary-green)' : '#fff'};
                    color:${page === _stockCurrentPage ? '#fff' : '#333'};
                    font-weight:${page === _stockCurrentPage ? '700' : '400'};
                    font-size:13px; cursor:pointer; transition:all 0.2s;
                ">${page}</button>
        `).join('');
    }

    // --- Renderiza linhas ---
    tbody.innerHTML = paginated.map((p, idx) => {
        const catName = (categories || []).find(c => c.id == p.category_id)?.name || '—';
        const stock = p.stock || 0;
        const cost = parseFloat(p.cost || 0);
        const rowNum = start + idx + 1;

        let statusBadge, statusClass;
        if (stock <= 0) { statusBadge = 'Sem Estoque'; statusClass = 'badge-cancelado'; }
        else if (stock <= 5) { statusBadge = 'Estoque Baixo'; statusClass = 'badge-aguardando'; }
        else { statusBadge = 'Em Estoque'; statusClass = 'badge-entregue'; }

        const borderStyle = stock <= 0 ? 'border-color:#e74c3c;' : stock <= 5 ? 'border-color:#e67e22;' : '';

        return `
            <tr id="stock-row-${p.id}">
                <td style="color:var(--text-muted);font-size:12px;width:36px;">${rowNum}</td>
                <td><strong>${p.name}</strong></td>
                <td>${catName}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:4px;">
                        <span style="font-size:12px;color:#666;">R$</span>
                        <input type="number" class="admin-input" id="cost-${p.id}"
                            value="${cost.toFixed(2)}" step="0.01" min="0"
                            style="width:90px; padding:5px 6px; font-size:13px; text-align:right;"
                            placeholder="0,00">
                    </div>
                </td>
                <td style="color:var(--primary-green); font-weight:600;">${fmt(p.price)}</td>
                <td>
                    <input type="number" class="admin-input" id="stock-${p.id}" value="${stock}" min="0" step="1"
                        style="width:80px; padding:5px 8px; font-size:13px; text-align:center; ${borderStyle}">
                </td>
                <td><span class="badge ${statusClass}">${statusBadge}</span></td>
                <td>
                    <button class="btn-icon btn-icon-edit" onclick="saveStockRow(${p.id})" title="Salvar">
                        <i class="fas fa-save"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

window.goStockPage = function(page) {
    _stockCurrentPage = page;
    renderStockTable(_currentStockList, _currentStockCategories);
};

window.saveStockRow = async function(productId) {
    const stockInput = document.getElementById(`stock-${productId}`);
    const costInput = document.getElementById(`cost-${productId}`);
    if (!stockInput || !costInput) return;

    const newStock = parseInt(stockInput.value) || 0;
    const newCost = parseFloat(costInput.value) || 0;

    const { error } = await supabase.from('products').update({
        stock: newStock,
        cost: newCost
    }).eq('id', productId);

    if (error) {
        adminToast('Erro ao salvar: ' + error.message, 'error');
    } else {
        adminToast('Estoque atualizado! ✅');
        // Atualiza cache local
        const p = _allStockProducts.find(x => x.id === productId);
        if (p) { p.stock = newStock; p.cost = newCost; }

        // Atualiza o badge de status e borda do input na linha sem recarregar
        const row = document.getElementById(`stock-row-${productId}`);
        if (row) {
            // Determina novo status
            let newLabel, newClass, newBorder;
            if (newStock <= 0) {
                newLabel = 'Sem Estoque'; newClass = 'badge-cancelado'; newBorder = 'border-color:#e74c3c;';
            } else if (newStock <= 5) {
                newLabel = 'Estoque Baixo'; newClass = 'badge-aguardando'; newBorder = 'border-color:#e67e22;';
            } else {
                newLabel = 'Em Estoque'; newClass = 'badge-entregue'; newBorder = '';
            }

            // Atualiza badge
            const badge = row.querySelector('.badge');
            if (badge) {
                badge.className = `badge ${newClass}`;
                badge.textContent = newLabel;
            }

            // Atualiza borda do input de estoque
            const sInput = document.getElementById(`stock-${productId}`);
            if (sInput) sInput.style.cssText = sInput.style.cssText.replace(/border-color:[^;]+;/g, '') + newBorder;
        }

        // Recarrega KPIs
        const totalValue = _allStockProducts.reduce((acc, p) => acc + ((p.cost || 0) * (p.stock || 0)), 0);
        const zero = _allStockProducts.filter(p => !p.stock || p.stock <= 0).length;
        const low = _allStockProducts.filter(p => p.stock > 0 && p.stock <= 5).length;
        const setKpi = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setKpi('stock-kpi-low', low);
        setKpi('stock-kpi-zero', zero);
        setKpi('stock-kpi-value', fmt(totalValue));
    }
};

window.loadStockExitReport = async function() {
    const startVal = document.getElementById('exit-date-start')?.value;
    const endVal = document.getElementById('exit-date-end')?.value;
    const productFilter = (document.getElementById('exit-product-filter')?.value || '').toLowerCase();
    const tbody = document.getElementById('stock-exit-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

    // Busca pedidos com filtro de data
    let query = supabase.from('orders').select('items, created_at, status').neq('status', 'cancelado');
    if (startVal) query = query.gte('created_at', startVal + 'T00:00:00');
    if (endVal) query = query.lte('created_at', endVal + 'T23:59:59');
    const { data: orders } = await query;

    // Agrega saídas por produto
    const exits = {};
    (orders || []).forEach(o => {
        (o.items || []).forEach(item => {
            const name = item.name;
            if (productFilter && !name.toLowerCase().includes(productFilter)) return;
            if (!exits[name]) exits[name] = { qty: 0, revenue: 0, cost: 0 };
            exits[name].qty += item.qty || 1;
            exits[name].revenue += (item.price || 0) * (item.qty || 1);
            // Busca custo do produto no cache
            const prod = _allStockProducts.find(p => p.name === name);
            exits[name].cost += (prod?.cost || 0) * (item.qty || 1);
        });
    });

    const sorted = Object.entries(exits).sort((a, b) => b[1].qty - a[1].qty);

    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted)">Nenhuma saída encontrada no período.</td></tr>';
        return;
    }

    // Cache do relatório completo para paginação e exportação
    window._exitReportData = sorted;
    window._exitCurrentPage = 1;
    renderExitReportPage();
};

function renderExitReportPage() {
    const sorted = window._exitReportData || [];
    const page = window._exitCurrentPage || 1;
    const pageSize = 15;
    const tbody = document.getElementById('stock-exit-body');
    const pageInfo = document.getElementById('exit-page-info');
    const pageNumbers = document.getElementById('exit-page-numbers');
    if (!tbody) return;

    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted)">Nenhuma saída encontrada no período.</td></tr>';
        if (pageInfo) pageInfo.textContent = '';
        if (pageNumbers) pageNumbers.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(sorted.length / pageSize);
    const start = (page - 1) * pageSize;
    const paginated = sorted.slice(start, start + pageSize);

    if (pageInfo) pageInfo.textContent = `Exibindo ${start + 1}–${Math.min(start + pageSize, sorted.length)} de ${sorted.length} itens`;

    if (pageNumbers) {
        pageNumbers.innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
            <button onclick="goExitPage(${p})" style="
                min-width:34px; height:34px; border-radius:6px;
                border:1px solid ${p === page ? 'var(--primary-green)' : '#ddd'};
                background:${p === page ? 'var(--primary-green)' : '#fff'};
                color:${p === page ? '#fff' : '#333'};
                font-weight:${p === page ? '700' : '400'};
                font-size:13px; cursor:pointer;">${p}</button>
        `).join('');
    }

    tbody.innerHTML = paginated.map(([name, d], idx) => {
        const profit = d.revenue - d.cost;
        const profitColor = profit >= 0 ? '#27ae60' : '#e74c3c';
        const rowNum = start + idx + 1;
        return `
            <tr>
                <td style="color:var(--text-muted);font-size:12px;">${rowNum}</td>
                <td><strong>${name}</strong></td>
                <td>${d.qty} un.</td>
                <td>${fmt(d.revenue)}</td>
                <td>${fmt(d.cost)}</td>
                <td style="color:${profitColor}; font-weight:700;">${fmt(profit)}</td>
            </tr>
        `;
    }).join('');
}

window.goExitPage = function(page) {
    window._exitCurrentPage = page;
    renderExitReportPage();
};

window.printExitReport = async function() {
    const sorted = window._exitReportData || [];
    if (sorted.length === 0) { adminToast('Nenhum dado para imprimir.', 'error'); return; }

    const { data: stores } = await supabase.from('store_settings').select('*').limit(1);
    const store = (stores && stores.length > 0) ? stores[0] : null;
    const storeName = store?.store_name || 'MINHA LOJA';

    const startVal = document.getElementById('exit-date-start')?.value || '—';
    const endVal = document.getElementById('exit-date-end')?.value || '—';
    const periodLabel = `Período: ${startVal} a ${endVal}`;

    const totalReceita = sorted.reduce((acc, [, d]) => acc + d.revenue, 0);
    const totalCusto = sorted.reduce((acc, [, d]) => acc + d.cost, 0);
    const totalLucro = totalReceita - totalCusto;
    const totalQty = sorted.reduce((acc, [, d]) => acc + d.qty, 0);

    const printArea = document.getElementById('print-area');
    printArea.innerHTML = `
        <div class="danfe-container">
            <div class="danfe-header">
                <div class="company-info">
                    <h2 style="margin:0; font-size:20px;">${storeName.toUpperCase()}</h2>
                    <p style="font-size:12px; margin-top:4px;">${periodLabel}</p>
                </div>
                <div class="order-badge">
                    <p>RELATÓRIO DE SAÍDA DE ESTOQUE</p>
                    <p>Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
                </div>
            </div>
            <div class="danfe-section">
                <div class="section-title">ITENS VENDIDOS NO PERÍODO</div>
                <table class="danfe-table">
                    <thead>
                        <tr>
                            <th>#</th><th>Produto</th><th>Qty</th><th>Receita</th><th>Custo</th><th>Lucro</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map(([name, d], idx) => {
                            const profit = d.revenue - d.cost;
                            return `<tr>
                                <td>${idx + 1}</td>
                                <td>${name}</td>
                                <td>${d.qty} un.</td>
                                <td>${fmt(d.revenue)}</td>
                                <td>${fmt(d.cost)}</td>
                                <td style="color:${profit >= 0 ? '#27ae60' : '#e74c3c'}; font-weight:700;">${fmt(profit)}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="danfe-footer">
                <div class="footer-totals">
                    <p>Total de itens vendidos: <strong>${totalQty} un.</strong></p>
                    <p>Receita Total: <strong>${fmt(totalReceita)}</strong></p>
                    <p>Custo Total: <strong>${fmt(totalCusto)}</strong></p>
                    <h2 style="margin-top:8px; color:${totalLucro >= 0 ? '#27ae60' : '#e74c3c'}">Lucro Total: ${fmt(totalLucro)}</h2>
                </div>
            </div>
        </div>
    `;
    printArea.classList.remove('hidden');
    window.print();
    printArea.classList.add('hidden');
};

window.saveExitReportCSV = function() {
    const sorted = window._exitReportData || [];
    if (sorted.length === 0) { adminToast('Nenhum dado para exportar.', 'error'); return; }

    const rows = [
        ['#', 'Produto', 'Qty Vendida', 'Receita (R$)', 'Custo Total (R$)', 'Lucro (R$)'],
        ...sorted.map(([name, d], idx) => {
            const profit = d.revenue - d.cost;
            return [idx + 1, name, d.qty, d.revenue.toFixed(2), d.cost.toFixed(2), profit.toFixed(2)];
        })
    ];

    const csvContent = '\uFEFF' + rows.map(r => r.join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-saida-estoque-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    adminToast('Relatório exportado com sucesso! ✅');
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
        ['banner-id', 'banner-title', 'banner-subtitle', 'banner-btn-text', 'banner-btn-link', 'banner-image-url'].forEach(f => { const el = document.getElementById(f); if (el) el.value = ''; });
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
    document.getElementById('banner-image-url').value = banner.image || '';
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
        image: document.getElementById('banner-image-url').value,
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

    if (cachedFinanceData && !forceRefresh) {
        updateFinanceOverview(period);
        updateFinanceSales(period);
        updateFinanceProducts(period);
        updateFinanceCustomers(period);
        return;
    }

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
        
        updateFinanceOverview(period);
        updateFinanceSales(period);
        updateFinanceProducts(period);
        updateFinanceCustomers(period);
    } catch (err) {
        console.error("Erro ao carregar financeiro:", err);
        adminToast("Erro ao carregar dados financeiros.", "error");
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

function getFilteredOrders(allOrders, period, startDate, endDate, includeCanceled = false) {
    const now = new Date();
    return allOrders.filter(o => {
        if (!includeCanceled && o.status === 'cancelado') return false;
        if (includeCanceled && o.status !== 'cancelado') return false;

        if (period === 'custom' && startDate && endDate) {
            const oDate = new Date(o.created_at);
            const start = new Date(startDate + 'T00:00:00');
            const end = new Date(endDate + 'T23:59:59');
            return oDate >= start && oDate <= end;
        }

        if (period === 'all') return true;
        const oDate = new Date(o.created_at);
        if (period === 'today') return oDate.toDateString() === now.toDateString();

        const diffDays = (now - oDate) / (1000 * 60 * 60 * 24);
        if (period === '7days') return diffDays <= 7;
        if (period === '30days') return diffDays <= 30;
        if (period === 'year') return oDate.getFullYear() === now.getFullYear();
        return true;
    });
}

function updateFinanceOverview(period, startDate, endDate) {
    if (!cachedFinanceData) return;
    
    // Limpar datas se um período pré-definido for escolhido
    if (period !== 'custom') {
        const s = document.getElementById('overview-start');
        const e = document.getElementById('overview-end');
        if (s) s.value = ""; if (e) e.value = "";
    }

    const { orders: allOrders, products } = cachedFinanceData;
    const orders = getFilteredOrders(allOrders, period, startDate, endDate);
    const canceled = getFilteredOrders(allOrders, period, startDate, endDate, true);

    const totalBilling = orders.reduce((s, o) => s + parseFloat(o.total || 0), 0);
    const avgTicket = orders.length > 0 ? totalBilling / orders.length : 0;
    const totalCanceled = canceled.reduce((s, o) => s + parseFloat(o.total || 0), 0);

    let totalProfit = 0;
    orders.forEach(o => {
        (o.items || []).forEach(item => {
            const p = products.find(prod => prod.name === item.name);
            if (p) totalProfit += (parseFloat(item.price || 0) - parseFloat(p.cost || 0)) * (item.qty || 1);
        });
    });

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setVal('fin-total-billing', fmt(totalBilling));
    setVal('fin-avg-ticket', fmt(avgTicket));
    setVal('fin-total-orders', orders.length);
    setVal('fin-total-profit', fmt(totalProfit));
    setVal('fin-total-canceled', fmt(totalCanceled));

    initOverviewCharts(orders, period, startDate, endDate);
}

function updateFinanceSales(period, startDate, endDate) {
    if (!cachedFinanceData) return;
    
    if (period !== 'custom') {
        const s = document.getElementById('sales-start');
        const e = document.getElementById('sales-end');
        if (s) s.value = ""; if (e) e.value = "";
    }

    loadSalesCharts(period, cachedFinanceData.orders, startDate, endDate);
}

function updateFinanceProducts(period, startDate, endDate) {
    if (!cachedFinanceData) return;
    
    if (period !== 'custom') {
        const s = document.getElementById('prod-start');
        const e = document.getElementById('prod-end');
        if (s) s.value = ""; if (e) e.value = "";
    }

    const orders = getFilteredOrders(cachedFinanceData.orders, period, startDate, endDate);
    loadProductsFinance(orders, cachedFinanceData.products);
}

function updateFinanceCustomers(period, startDate, endDate) {
    if (!cachedFinanceData) return;
    
    if (period !== 'custom') {
        const s = document.getElementById('cust-start');
        const e = document.getElementById('cust-end');
        if (s) s.value = ""; if (e) e.value = "";
    }

    const orders = getFilteredOrders(cachedFinanceData.orders, period, startDate, endDate);
    loadCustomersFinance(orders, cachedFinanceData.clients, period, startDate, endDate);
}

window.applyCustomFilter = function(tab) {
    const start = document.getElementById(`${tab}-start`).value;
    const end = document.getElementById(`${tab}-end`).value;
    if (!start || !end) { adminToast('Selecione ambas as datas.', 'error'); return; }
    if (new Date(start) > new Date(end)) { adminToast('Início maior que fim.', 'error'); return; }

    // Limpar o select de período ao aplicar datas customizadas
    const selId = (tab === 'prod' ? 'prod' : tab === 'cust' ? 'cust' : tab) + '-period-filter';
    const sel = document.getElementById(selId);
    if (sel) sel.value = "";

    if (tab === 'overview') updateFinanceOverview('custom', start, end);
    if (tab === 'sales') updateFinanceSales('custom', start, end);
    if (tab === 'prod') updateFinanceProducts('custom', start, end);
    if (tab === 'cust') updateFinanceCustomers('custom', start, end);
};

function initOverviewCharts(orders, period = '7days', startDate, endDate) {
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

    let lastDays = {};
    let count = 7;

    if (period === 'custom' && startDate && endDate) {
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        count = Math.min(diffDays, 60); // Limite de 60 dias para o gráfico não quebrar

        for (let i = 0; i < count; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            lastDays[d.toLocaleDateString('pt-BR').substring(0, 5)] = 0;
        }
    } else {
        if (period === 'today') count = 1;
        if (period === '30days') count = 30;
        if (period === 'all' || period === 'year') count = 30;

        for (let i = count - 1; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            lastDays[d.toLocaleDateString('pt-BR').substring(0, 5)] = 0;
        }
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

function loadSalesCharts(period, allOrders, startDate, endDate) {
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
    } else if (period === 'custom' && startDate && endDate) {
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        const daysToCount = Math.min(diffDays, 60);

        const timeline = [];
        for (let i = 0; i < daysToCount; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
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

    // Relatório de Pagamentos
    const payments = {};
    orders.forEach(o => {
        const rawMethod = o.payment_method || 'Outros';
        const method = rawMethod.replace('PDV - ', '');
        payments[method] = (payments[method] || 0) + parseFloat(o.total || 0);
    });

    const reportBody = document.getElementById('fin-payments-report');
    if (reportBody) {
        reportBody.innerHTML = Object.entries(payments).length === 0 ? '<tr><td colspan="2" style="text-align:center">Sem dados</td></tr>' :
            Object.entries(payments)
                .sort((a, b) => b[1] - a[1])
                .map(([method, total]) => `
                <tr>
                    <td><strong>${method.toUpperCase()}</strong></td>
                    <td>${fmt(total)}</td>
                </tr>
            `).join('');
    }
}

function loadCustomersFinance(orders, clients, period = '7days', startDate, endDate) {
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
        if (period === 'custom' && startDate && endDate) {
            const cDate = new Date(c.created_at);
            const start = new Date(startDate + 'T00:00:00');
            const end = new Date(endDate + 'T23:59:59');
            return cDate >= start && cDate <= end;
        }

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

// ============================================================
// SECTION: Empresa (Store Settings)
// ============================================================
window.loadStoreSettings = async function () {
    const { data: stores, error } = await supabase.from('store_settings').select('*').limit(1);
    if (error) { console.warn('Erro ao carregar dados da empresa:', error.message); return; }
    const data = (stores && stores.length > 0) ? stores[0] : null;
    
    // Armazena no cache global para uso na impressão
    window._storeSettings = data;

    if (!data) return;

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('set-store-name', data.store_name);
    setVal('set-company-name', data.company_name);
    setVal('set-cnpj', data.cnpj);
    setVal('set-ie', data.state_registration);
    setVal('set-email', data.email);
    setVal('set-phone', data.phone);

    if (data.address) {
        setVal('set-addr-street', data.address.street);
        setVal('set-addr-num', data.address.number);
        setVal('set-addr-bairro', data.address.neighborhood);
        setVal('set-addr-city', data.address.city);
        setVal('set-addr-uf', data.address.uf);
        setVal('set-addr-cep', data.address.cep);
    }
};

window.saveStoreSettings = async function () {
    const storeName = document.getElementById('set-store-name').value.trim();

    if (!storeName) {
        adminToast('Preencha ao menos o Nome Fantasia antes de salvar.', 'error');
        return;
    }

    const settings = {
        store_name: storeName,
        company_name: document.getElementById('set-company-name').value.trim(),
        cnpj: document.getElementById('set-cnpj').value.trim(),
        state_registration: document.getElementById('set-ie').value.trim(),
        email: document.getElementById('set-email').value.trim(),
        phone: document.getElementById('set-phone').value.trim(),
        address: {
            street: document.getElementById('set-addr-street').value.trim(),
            number: document.getElementById('set-addr-num').value.trim(),
            neighborhood: document.getElementById('set-addr-bairro').value.trim(),
            city: document.getElementById('set-addr-city').value.trim(),
            uf: document.getElementById('set-addr-uf').value.trim().toUpperCase(),
            cep: document.getElementById('set-addr-cep').value.trim()
        },
        updated_at: new Date().toISOString()
    };

    // UPDATE na linha existente (preserva primary_color e text_color)
    const existingId = window._storeSettings?.id || _storeSettingsId;
    let saveError;
    if (existingId) {
        const result = await supabase.from('store_settings').update(settings).eq('id', existingId);
        saveError = result.error;
    } else {
        const result = await supabase.from('store_settings').insert([settings]);
        saveError = result.error;
    }

    if (saveError) {
        adminToast('Erro ao salvar: ' + saveError.message, 'error');
    } else {
        // Atualiza o cache global imediatamente (preserva cores salvas)
        const colorsCached = {
            primary_color: window._storeSettings?.primary_color || _selectedPrimary,
            text_color: window._storeSettings?.text_color || _selectedText
        };
        window._storeSettings = { id: existingId, ...settings, ...colorsCached };
        adminToast('Dados da empresa atualizados com sucesso! ✅');
    }
};

// ---- Upload de Imagem de Banner para o Supabase Storage (bucket: product-images/banners/) ----
async function uploadBannerImage(file) {
    const preview = document.getElementById('banner-img-preview');
    const placeholder = document.getElementById('preview-placeholder');
    const statusEl = document.getElementById('banner-upload-status');
    const statusText = document.getElementById('banner-upload-status-text');

    if (statusEl) statusEl.style.display = 'flex';
    if (statusText) statusText.textContent = 'Enviando imagem...';

    await tryCreateBucket(); // Reutiliza o helper já existente

    try {
        const safeName = file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
        const fileName = `banners/${Date.now()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(fileName, file, { upsert: true, contentType: file.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
            .from('product-images')
            .getPublicUrl(fileName);

        const publicUrl = urlData.publicUrl;

        document.getElementById('banner-image-url').value = publicUrl;
        if (preview) { preview.src = publicUrl; preview.style.display = 'block'; }
        if (placeholder) placeholder.style.display = 'none';

        if (statusText) statusText.textContent = '✓ Imagem enviada com sucesso!';
        setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 2500);

    } catch (err) {
        console.error('Erro ao enviar imagem do banner:', err);
        if (statusText) statusText.textContent = '✗ Erro: ' + (err.message || 'verifique o Storage');
        adminToast('Erro ao enviar imagem do banner: ' + (err.message || ''), 'error');
    }
}

// Handler de seleção de arquivo de banner → aciona upload para Storage
document.addEventListener('change', e => {
    if (e.target.id === 'banner-image-file') {
        const file = e.target.files[0];
        if (!file) return;
        uploadBannerImage(file);
    }
});

// ---- MIGRAR IMAGENS DE BANNERS BASE64 PARA SUPABASE STORAGE ----
let base64BannersToMigrate = [];

window.openMigrateBannersModal = async function () {
    const modal = document.getElementById('modal-migrate-banners');
    if (!modal) return;
    modal.classList.remove('hidden');

    const infoEl = document.getElementById('migrate-banners-count-info');
    const startBtn = document.getElementById('migrate-banners-start-btn');
    const startArea = document.getElementById('migrate-banners-start-area');
    const progressArea = document.getElementById('migrate-banners-progress-area');
    const doneBtn = document.getElementById('migrate-banners-done-btn');
    const closeBtn = document.getElementById('migrate-banners-close-btn');
    const logEl = document.getElementById('migrate-banners-log');

    if (infoEl) infoEl.textContent = 'Buscando banners no banco de dados...';
    if (startBtn) startBtn.style.display = 'none';
    if (startArea) startArea.style.display = 'block';
    if (progressArea) progressArea.style.display = 'none';
    if (doneBtn) doneBtn.style.display = 'none';
    if (closeBtn) closeBtn.style.display = 'block';
    if (logEl) logEl.innerHTML = '';

    try {
        const { data: banners, error } = await supabase.from('banners').select('id, title, image');
        if (error) throw error;
        base64BannersToMigrate = (banners || []).filter(b => b.image && b.image.startsWith('data:image/'));
        if (infoEl) {
            if (base64BannersToMigrate.length === 0) {
                infoEl.textContent = '✓ Nenhum banner com imagem em Base64 encontrado. Todos já estão no Storage!';
            } else {
                infoEl.textContent = `Encontrado(s) ${base64BannersToMigrate.length} banner(s) com imagem em Base64 aguardando migração.`;
                if (startBtn) startBtn.style.display = 'inline-block';
            }
        }
    } catch (err) {
        if (infoEl) infoEl.textContent = 'Erro ao carregar banners: ' + err.message;
    }
};

window.closeMigrateBannersModal = function () {
    const modal = document.getElementById('modal-migrate-banners');
    if (modal) modal.classList.add('hidden');
};

window.startBannerMigration = async function () {
    const startArea = document.getElementById('migrate-banners-start-area');
    const progressArea = document.getElementById('migrate-banners-progress-area');
    const progressBar = document.getElementById('migrate-banners-progress-bar');
    const progressText = document.getElementById('migrate-banners-progress-text');
    const logEl = document.getElementById('migrate-banners-log');
    const doneBtn = document.getElementById('migrate-banners-done-btn');
    const closeBtn = document.getElementById('migrate-banners-close-btn');

    if (startArea) startArea.style.display = 'none';
    if (progressArea) progressArea.style.display = 'block';
    if (closeBtn) closeBtn.style.display = 'none';
    if (progressBar) progressBar.style.width = '0%';
    if (progressText) progressText.textContent = `0 / ${base64BannersToMigrate.length}`;
    if (logEl) logEl.innerHTML = '<div>Iniciando migração de banners...</div>';

    await tryCreateBucket();

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < base64BannersToMigrate.length; i++) {
        const b = base64BannersToMigrate[i];
        const logItem = document.createElement('div');
        logItem.style.marginBottom = '4px';
        logItem.textContent = `[${i+1}/${base64BannersToMigrate.length}] Processando banner: "${b.title || 'sem título'}"...`;
        if (logEl) { logEl.appendChild(logItem); logEl.scrollTop = logEl.scrollHeight; }

        try {
            const matches = b.image.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
            if (!matches) throw new Error('Formato Base64 inválido.');

            const contentType = matches[1];
            const ext = contentType.split('/')[1] || 'png';
            const fileName = `banners/migrated_${b.id}_${Date.now()}.${ext}`;

            const blob = base64ToBlob(matches[2], contentType);
            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(fileName, blob, { upsert: true, contentType });
            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
            const publicUrl = urlData.publicUrl;

            const { error: updateError } = await supabase.from('banners').update({ image: publicUrl }).eq('id', b.id);
            if (updateError) throw updateError;

            successCount++;
            logItem.textContent += ' ✓ Migrado com sucesso!';
            logItem.style.color = '#a8e6c3';
        } catch (err) {
            failCount++;
            logItem.textContent += ` ✗ Erro: ${err.message || err}`;
            logItem.style.color = '#ff7675';
        }

        const pct = Math.round(((i + 1) / base64BannersToMigrate.length) * 100);
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (progressText) progressText.textContent = `${i + 1} / ${base64BannersToMigrate.length}`;
    }

    const summary = document.createElement('div');
    summary.style.cssText = 'margin-top:10px;font-weight:bold;border-top:1px solid #333;padding-top:8px;';
    summary.textContent = `Fim! Sucesso: ${successCount} | Falhas: ${failCount}`;
    if (logEl) { logEl.appendChild(summary); logEl.scrollTop = logEl.scrollHeight; }

    if (closeBtn) closeBtn.style.display = 'block';
    if (doneBtn) doneBtn.style.display = 'inline-block';

    adminToast(`Migração de banners concluída! Sucesso: ${successCount}, Falhas: ${failCount}`, failCount > 0 ? 'warning' : 'success');
    await loadBanners();
};

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

// ============================================================
// SEÇÃO: CAIXA (CONTROLE DE FLUXO DE CAIXA)
// ============================================================
let currentCashSession = null;

async function initCaixaDashboard() {
    const loadingEl = document.getElementById('caixa-loading');
    const fechadoEl = document.getElementById('caixa-estado-fechado');
    const abertoEl = document.getElementById('caixa-estado-aberto');

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (fechadoEl) fechadoEl.classList.add('hidden');
    if (abertoEl) abertoEl.classList.add('hidden');

    try {
        // 1. Tentar buscar sessão de caixa aberta no Supabase
        const { data: activeSession, error } = await supabase
            .from('cash_sessions')
            .select('*')
            .eq('status', 'aberto')
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error("Erro ao buscar sessão do caixa no Supabase:", error);
            throw error;
        }

        if (activeSession) {
            // Verificar se o caixa deve ser fechado automaticamente (23:50 ou dia anterior)
            const wasClosed = await checkAndAutoCloseCaixa(activeSession);
            if (!wasClosed) {
                // Caixa está ABERTO!
                currentCashSession = activeSession;
                await renderCaixaAbertoState();
            }
        } else {
            // Caixa está FECHADO!
            currentCashSession = null;
            await renderCaixaFechadoState();
        }

        // Inicializar histórico de caixas por calendário
        await initCaixaHistoryCalendar();
    } catch (err) {
        console.error("Falha ao inicializar o controle de caixa:", err);
        // Exibir mensagem de erro informativa se as tabelas ainda não foram criadas
        if (loadingEl) {
            loadingEl.innerHTML = 
                '<div style="color:#c0392b; padding:25px; font-weight:bold; text-align:center; max-width:600px; margin:0 auto;">' +
                '<i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:15px;"></i>' +
                '<h3 style="margin-bottom:10px; font-size:18px;">Erro: Tabelas do Caixa não encontradas no Supabase!</h3>' +
                '<p style="font-size:14px; font-weight:normal; margin-bottom:15px; color:#555; line-height:1.6;">' +
                'Para ativar a aba Caixa, você precisa criar as tabelas correspondentes no seu banco de dados. ' +
                'Copie e execute o script SQL fornecido nas instruções no <strong>SQL Editor</strong> do painel do seu Supabase.' +
                '</p>' +
                '<div style="background:#f8f9fa; border:1px solid #ddd; padding:12px; border-radius:6px; font-size:13px; font-weight:600; color:#333; margin-bottom:10px; cursor:pointer;" onclick="window.copyCaixaSQL()">' +
                '<i class="far fa-copy"></i> Copiar Código SQL de Criação' +
                '</div>' +
                '<button class="btn-primary" onclick="initCaixaDashboard()" style="background:#27ae60; margin-top:10px;"><i class="fas fa-sync"></i> Já criei, tentar novamente</button>' +
                '</div>';
        }
    }
}

// 2. Renderizar Estado Fechado
async function renderCaixaFechadoState() {
    const loadingEl = document.getElementById('caixa-loading');
    const fechadoEl = document.getElementById('caixa-estado-fechado');
    const abertoEl = document.getElementById('caixa-estado-aberto');

    if (loadingEl) loadingEl.classList.add('hidden');
    if (fechadoEl) fechadoEl.classList.remove('hidden');
    if (abertoEl) abertoEl.classList.add('hidden');

    try {
        const { data: lastSession } = await supabase
            .from('cash_sessions')
            .select('final_amount')
            .eq('status', 'fechado')
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle();

        const inputFundo = document.getElementById('abertura-valor-inicial');
        if (inputFundo) {
            if (lastSession && lastSession.final_amount) {
                inputFundo.value = parseFloat(lastSession.final_amount).toFixed(2);
            } else {
                inputFundo.value = '0.00';
            }
        }
    } catch(e) { console.warn('Erro ao carregar último fechamento:', e); }
}

// 3. Renderizar Estado Aberto
async function renderCaixaAbertoState() {
    const loadingEl = document.getElementById('caixa-loading');
    const fechadoEl = document.getElementById('caixa-estado-fechado');
    const abertoEl = document.getElementById('caixa-estado-aberto');

    if (!currentCashSession) return;

    if (loadingEl) loadingEl.classList.add('hidden');
    if (fechadoEl) fechadoEl.classList.add('hidden');
    if (abertoEl) abertoEl.classList.remove('hidden');

    const openedDate = new Date(currentCashSession.opened_at).toLocaleString('pt-BR');
    const infoEl = document.getElementById('caixa-aberto-info');
    if (infoEl) infoEl.textContent = `Aberto por ${currentCashSession.opened_by} em ${openedDate}`;

    // C. Calcular Vendas Dinheiro (Vendas PDV - dinheiro)
    const { data: sales, error: salesErr } = await supabase
        .from('orders')
        .select('total, payment_method')
        .gte('created_at', currentCashSession.opened_at);

    // SEGURANÇA: Aborta se o caixa tiver sido fechado enquanto a rede respondia
    if (!currentCashSession) return;

    let totalSalesCash = 0;
    if (!salesErr && sales) {
        sales.forEach(o => {
            const payMethod = String(o.payment_method || '').toLowerCase();
            if (payMethod.includes('dinheiro')) {
                totalSalesCash += parseFloat(o.total || 0);
            }
        });
    }

    // D. Carregar Transações do Caixa (Sangrias e Suprimentos)
    const { data: transactions, error: txErr } = await supabase
        .from('cash_transactions')
        .select('*')
        .eq('session_id', currentCashSession.id)
        .order('id', { ascending: false });

    // SEGURANÇA: Aborta se o caixa tiver sido fechado enquanto a rede respondia
    if (!currentCashSession) return;

    let totalTransactions = 0;
    let totalSangrias = 0;
    let totalSuprimentos = 0;

    const tbody = document.getElementById('caixa-movimentacoes-table');
    if (tbody) {
        if (!txErr && transactions && transactions.length > 0) {
            tbody.innerHTML = transactions.map(t => {
                const isSangria = t.type === 'sangria';
                const color = isSangria ? '#c0392b' : '#27ae60';
                const opLabel = isSangria ? 'Sangria' : 'Suprimento';
                const hora = new Date(t.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                
                const val = parseFloat(t.amount || 0);
                if (isSangria) {
                    totalSangrias += val;
                    totalTransactions -= val;
                } else {
                    totalSuprimentos += val;
                    totalTransactions += val;
                }

                return '<tr>' +
                    '<td>' + hora + '</td>' +
                    '<td><span style="font-weight:700; color:' + color + ';">' + opLabel + '</span></td>' +
                    '<td>' + t.description + '</td>' +
                    '<td style="font-weight:700; color:' + color + ';">' + (isSangria ? '-' : '+') + ' R$ ' + val.toFixed(2).replace('.', ',') + '</td>' +
                    '</tr>';
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum suprimento ou sangria lançado nesta sessão.</td></tr>';
        }
    }

    // E. Atualizar Cards Financeiros
    const initialAmount = parseFloat(currentCashSession.initial_amount || 0);
    const balance = initialAmount + totalSalesCash + totalTransactions;

    const cardInitial = document.getElementById('card-caixa-inicial');
    const cardSales = document.getElementById('card-caixa-vendas');
    const cardMovs = document.getElementById('card-caixa-movs');
    const cardSaldo = document.getElementById('card-caixa-saldo');

    if (cardInitial) cardInitial.textContent = 'R$ ' + initialAmount.toFixed(2).replace('.', ',');
    if (cardSales) cardSales.textContent = 'R$ ' + totalSalesCash.toFixed(2).replace('.', ',');
    if (cardMovs) {
        const sign = totalTransactions >= 0 ? '+' : '-';
        cardMovs.textContent = sign + ' R$ ' + Math.abs(totalTransactions).toFixed(2).replace('.', ',');
        cardMovs.style.color = totalTransactions >= 0 ? '#27ae60' : '#c0392b';
    }
    if (cardSaldo) cardSaldo.textContent = 'R$ ' + balance.toFixed(2).replace('.', ',');

    currentCashSession.total_sales_cash = totalSalesCash;
    currentCashSession.total_transactions = totalTransactions;
    currentCashSession.total_sangrias = totalSangrias;
    currentCashSession.total_suprimentos = totalSuprimentos;
    currentCashSession.estimated_balance = balance;
}

// 4. Lógica de Submissão: Abertura de Caixa
document.addEventListener('submit', async (e) => {
    if (e.target && e.target.id === 'form-abrir-caixa') {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const valorInicial = parseFloat(document.getElementById('abertura-valor-inicial').value) || 0;
        
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Abrindo...'; }

        try {
            const adminSession = JSON.parse(sessionStorage.getItem('ecostore_admin_session') || '{}');
            const operator = adminSession.name || 'Operador Admin';

            // 1. Buscar último fechamento para comparar valores e lançar sangria/suprimento de ajuste
            let lastClosedAmount = null;
            try {
                const { data: lastSession } = await supabase
                    .from('cash_sessions')
                    .select('final_amount')
                    .eq('status', 'fechado')
                    .order('id', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                if (lastSession && lastSession.final_amount !== null) {
                    lastClosedAmount = parseFloat(lastSession.final_amount);
                }
            } catch (e) {
                console.warn('Erro ao carregar último fechamento para comparação de abertura:', e);
            }

            let sessionInitialAmount = valorInicial;
            let autoTransaction = null;

            if (lastClosedAmount !== null) {
                const diff = valorInicial - lastClosedAmount;
                // Considera diferenças maiores que 1 centavo para evitar imprecisões de ponto flutuante
                if (Math.abs(diff) > 0.009) {
                    sessionInitialAmount = lastClosedAmount;
                    autoTransaction = {
                        type: diff < 0 ? 'sangria' : 'suprimento',
                        amount: Math.abs(diff),
                        description: diff < 0 
                            ? `Diferença de abertura: menor que o fechamento anterior (Fundo esperado: R$ ${lastClosedAmount.toFixed(2).replace('.', ',')} | Informado: R$ ${valorInicial.toFixed(2).replace('.', ',')})`
                            : `Diferença de abertura: maior que o fechamento anterior (Fundo esperado: R$ ${lastClosedAmount.toFixed(2).replace('.', ',')} | Informado: R$ ${valorInicial.toFixed(2).replace('.', ',')})`
                    };
                }
            }

            const { data, error } = await supabase
                .from('cash_sessions')
                .insert([{
                    initial_amount: sessionInitialAmount,
                    opened_by: operator,
                    status: 'aberto'
                }])
                .select()
                .single();

            if (error) throw error;

            // 2. Se houver diferença, inserir transação automática de ajuste
            if (autoTransaction) {
                const { error: txErr } = await supabase
                    .from('cash_transactions')
                    .insert([{
                        session_id: data.id,
                        type: autoTransaction.type,
                        amount: autoTransaction.amount,
                        description: autoTransaction.description
                    }]);

                if (txErr) {
                    console.error('Erro ao registrar transação automática de ajuste:', txErr);
                }
            }

            adminToast('Caixa aberto com sucesso!');
            currentCashSession = data;
            await renderCaixaAbertoState();
            await initCaixaHistoryCalendar();
        } catch (err) {
            console.error('Erro ao abrir caixa:', err);
            adminToast('Erro ao abrir caixa: ' + err.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-lock-open"></i> Abrir Caixa'; }
        }
    }
});

// 5. Lógica de Submissão: Lançar Movimentação (Sangria / Suprimento)
document.addEventListener('submit', async (e) => {
    if (e.target && e.target.id === 'form-movimentacao-caixa') {
        e.preventDefault();
        if (!currentCashSession) return;

        const btn = e.target.querySelector('button[type="submit"]');
        const tipo = document.getElementById('mov-tipo').value;
        const valor = parseFloat(document.getElementById('mov-valor').value) || 0;
        const descricao = document.getElementById('mov-descricao').value.trim();

        if (valor <= 0) { adminToast('O valor deve ser maior que zero!', 'error'); return; }

        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Lançando...'; }

        try {
            const { error } = await supabase
                .from('cash_transactions')
                .insert([{
                    session_id: currentCashSession.id,
                    type: tipo,
                    amount: valor,
                    description: descricao
                }]);

            if (error) throw error;

            adminToast('Movimentação registrada com sucesso!');
            document.getElementById('mov-valor').value = '';
            document.getElementById('mov-descricao').value = '';
            
            await renderCaixaAbertoState();
        } catch (err) {
            console.error('Erro ao lançar movimentação:', err);
            adminToast('Erro ao lançar movimentação: ' + err.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus-circle"></i> Confirmar Lançamento'; }
        }
    }
});

// 6. Lógica de Abertura do Modal de Fechamento
document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'btn-pre-fechar-caixa') {
        if (!currentCashSession) return;

        const fundo = parseFloat(currentCashSession.initial_amount || 0);
        const vendas = parseFloat(currentCashSession.total_sales_cash || 0);
        const suprimentos = parseFloat(currentCashSession.total_suprimentos || 0);
        const sangrias = parseFloat(currentCashSession.total_sangrias || 0);
        const balance = parseFloat(currentCashSession.estimated_balance || 0);

        document.getElementById('fechamento-fundo').textContent = 'R$ ' + fundo.toFixed(2).replace('.', ',');
        document.getElementById('fechamento-vendas').textContent = '+ R$ ' + vendas.toFixed(2).replace('.', ',');
        document.getElementById('fechamento-suprimentos').textContent = '+ R$ ' + suprimentos.toFixed(2).replace('.', ',');
        document.getElementById('fechamento-sangrias').textContent = '- R$ ' + sangrias.toFixed(2).replace('.', ',');
        document.getElementById('fechamento-saldo-estimado').textContent = 'R$ ' + balance.toFixed(2).replace('.', ',');
        
        document.getElementById('fechamento-valor-real').value = balance.toFixed(2);
        document.getElementById('fechamento-observacao').value = '';

        document.getElementById('modal-fechamento-caixa').classList.remove('hidden');
    }
});

// 7. Lógica de Fechar o Modal
window.closeCloseCashModal = function() {
    document.getElementById('modal-fechamento-caixa').classList.add('hidden');
};

// 8. Lógica de Confirmação e Submissão do Fechamento
document.addEventListener('submit', async (e) => {
    if (e.target && e.target.id === 'form-fechar-caixa') {
        e.preventDefault();
        if (!currentCashSession) return;

        if (!confirm('Tem certeza que deseja FECHAR o caixa?')) return;

        const btn = e.target.querySelector('button[type="submit"]');
        const valorReal = parseFloat(document.getElementById('fechamento-valor-real').value) || 0;
        const nota = document.getElementById('fechamento-observacao').value.trim();

        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fechando...'; }

        try {
            const adminSession = JSON.parse(sessionStorage.getItem('ecostore_admin_session') || '{}');
            const operator = adminSession.name || 'Operador Admin';

            const { error } = await supabase
                .from('cash_sessions')
                .update({
                    closed_at: new Date().toISOString(),
                    total_sales_cash: currentCashSession.total_sales_cash,
                    total_transactions: currentCashSession.total_transactions,
                    final_amount: valorReal,
                    status: 'fechado',
                    closed_by: operator
                })
                .eq('id', currentCashSession.id);

            if (error) throw error;

            adminToast('Caixa fechado com sucesso!');
            closeCloseCashModal();
            currentCashSession = null;
            await renderCaixaFechadoState();
            await initCaixaHistoryCalendar();
        } catch (err) {
            console.error('Erro ao fechar caixa:', err);
            adminToast('Erro ao fechar caixa: ' + err.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-lock"></i> Confirmar e Fechar Caixa'; }
        }
    }
});

// ============================================================
// SEÇÃO: HISTÓRICO E CALENDÁRIO DE CAIXAS
// ============================================================
let historyCurrentDate = new Date();
let historySessions = [];

async function initCaixaHistoryCalendar() {
    const year = historyCurrentDate.getFullYear();
    const month = historyCurrentDate.getMonth();
    
    const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const monthLabel = document.getElementById('history-month-year');
    if (monthLabel) monthLabel.textContent = `${monthNames[month]} ${year}`;
    
    // Configura os limites do mês selecionado usando HORA LOCAL
    const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);
    
    try {
        const { data: sessions, error } = await supabase
            .from('cash_sessions')
            .select('*')
            .gte('opened_at', startOfMonth.toISOString())
            .lte('opened_at', endOfMonth.toISOString())
            .order('opened_at', { ascending: true });
            
        if (error) throw error;
        
        historySessions = sessions || [];
        renderCaixaHistoryCalendar(year, month);
    } catch (err) {
        console.error("Erro ao carregar histórico de caixas:", err);
    }
}

function renderCaixaHistoryCalendar(year, month) {
    const grid = document.getElementById('calendar-days-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    
    // Preencher dias vazios no início do calendário
    for (let i = 0; i < firstDayIndex; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell empty';
        grid.appendChild(cell);
    }
    
    // Preencher os dias do mês
    for (let day = 1; day <= totalDays; day++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell';
        cell.textContent = day;
        
        // Verificar se o dia corresponde a hoje
        if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === day) {
            cell.classList.add('today');
        }
        
        // Buscar sessões correspondentes a este dia (em Hora Local)
        const daySessions = historySessions.filter(s => {
            const opDate = new Date(s.opened_at);
            return opDate.getFullYear() === year && opDate.getMonth() === month && opDate.getDate() === day;
        });
        
        if (daySessions.length > 0) {
            const hasActive = daySessions.some(s => s.status === 'aberto');
            if (hasActive) {
                cell.classList.add('has-active-session');
            } else {
                cell.classList.add('has-closed-session');
            }
            
            // Adicionar ponto indicador
            const badge = document.createElement('span');
            badge.className = 'calendar-day-badge';
            cell.appendChild(badge);
        }
        
        cell.addEventListener('click', () => {
            document.querySelectorAll('.calendar-day-cell').forEach(c => c.classList.remove('selected'));
            cell.classList.add('selected');
            renderSelectedDaySessions(day, daySessions);
        });
        
        grid.appendChild(cell);
    }
}

window.changeHistoryMonth = async function(offset) {
    historyCurrentDate.setMonth(historyCurrentDate.getMonth() + offset);
    
    const title = document.getElementById('selected-day-title');
    if (title) title.textContent = 'Selecione um dia no calendário';
    
    const sessionsContainer = document.getElementById('selected-day-sessions');
    if (sessionsContainer) {
        sessionsContainer.innerHTML = '<p style="color:var(--text-muted); font-size:14px; text-align:center; padding:30px 0; margin:0;">Clique em um dia destacado para ver o histórico do caixa.</p>';
    }
    
    await initCaixaHistoryCalendar();
};

function renderSelectedDaySessions(day, daySessions) {
    const title = document.getElementById('selected-day-title');
    if (title) title.textContent = `Caixas do dia ${String(day).padStart(2, '0')}/${String(historyCurrentDate.getMonth() + 1).padStart(2, '0')}/${historyCurrentDate.getFullYear()}`;
    
    const container = document.getElementById('selected-day-sessions');
    if (!container) return;
    
    if (daySessions.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); font-size:14px; text-align:center; padding:30px 0; margin:0;">Nenhum caixa movimentado neste dia.</p>';
        return;
    }
    
    container.innerHTML = daySessions.map(s => {
        const openTime = new Date(s.opened_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const closeTime = s.closed_at ? new Date(s.closed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
        
        const statusBadge = s.status === 'aberto' 
            ? '<span class="badge badge-ativo" style="background:#27ae60; color:white; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:700;">Aberto</span>'
            : '<span class="badge badge-fechado" style="background:#7f8c8d; color:white; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:700;">Fechado</span>';
            
        const balanceLabel = s.status === 'aberto' ? 'Saldo Estimado' : 'Fundo Final';
        const balanceVal = s.status === 'aberto' 
            ? (parseFloat(s.initial_amount || 0) + parseFloat(s.total_sales_cash || 0) + parseFloat(s.total_transactions || 0)) 
            : parseFloat(s.final_amount || 0);
            
        return `<div class="history-session-item" onclick="viewHistorySessionReport(${s.id})">
            <div>
                <div style="font-weight:700; color:var(--text-color); font-size:14px;">Operador: ${s.opened_by}</div>
                <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
                    <i class="far fa-clock"></i> Abertura: ${openTime} ${closeTime ? `| Fechamento: ${closeTime}` : ''}
                </div>
                <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
                    ${balanceLabel}: <strong>R$ ${balanceVal.toFixed(2).replace('.', ',')}</strong>
                </div>
            </div>
            <div style="text-align:right;">
                ${statusBadge}
                <div style="font-size:11px; color:#2980b9; font-weight:600; margin-top:8px;"><i class="fas fa-eye"></i> Ver Relatório</div>
            </div>
        </div>`;
    }).join('');
}

window.viewHistorySessionReport = async function(sessionId) {
    const modal = document.getElementById('modal-historico-caixa');
    const body = document.getElementById('modal-historico-caixa-body');
    if (!modal || !body) return;
    
    body.innerHTML = '<div class="text-center" style="padding:40px;"><i class="fas fa-circle-notch fa-spin fa-2x" style="color:#2980b9;"></i><p style="margin-top:10px;">Carregando relatório...</p></div>';
    modal.classList.remove('hidden');
    
    try {
        // 1. Buscar a sessão específica
        const { data: session, error: sessErr } = await supabase
            .from('cash_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();
            
        if (sessErr) throw sessErr;
        
        // 2. Buscar transações daquela sessão
        const { data: transactions, error: txErr } = await supabase
            .from('cash_transactions')
            .select('*')
            .eq('session_id', sessionId)
            .order('id', { ascending: true });
            
        if (txErr) throw txErr;
        
        // 3. Renderizar o corpo do relatório detalhado
        const openDate = new Date(session.opened_at).toLocaleString('pt-BR');
        const closeDate = session.closed_at ? new Date(session.closed_at).toLocaleString('pt-BR') : 'Ainda Aberto';
        
        const initialAmount = parseFloat(session.initial_amount || 0);
        const salesAmount = parseFloat(session.total_sales_cash || 0);
        const transAmount = parseFloat(session.total_transactions || 0);
        const estimated = initialAmount + salesAmount + transAmount;
        const finalAmount = session.status === 'aberto' ? null : parseFloat(session.final_amount || 0);
        
        // Calcular Sangrias e Suprimentos separadamente
        let totalSangrias = 0;
        let totalSuprimentos = 0;
        (transactions || []).forEach(t => {
            const val = parseFloat(t.amount || 0);
            if (t.type === 'sangria') totalSangrias += val;
            else totalSuprimentos += val;
        });
        
        let diffHTML = '';
        if (session.status === 'fechado') {
            const diff = finalAmount - estimated;
            const diffColor = diff === 0 ? '#27ae60' : (diff > 0 ? '#2980b9' : '#c0392b');
            const diffLabel = diff === 0 ? 'Conferido (Sem divergências)' : (diff > 0 ? `Sobra de R$ ${diff.toFixed(2).replace('.', ',')}` : `Quebra de R$ ${Math.abs(diff).toFixed(2).replace('.', ',')}`);
            
            diffHTML = `
                <div class="history-session-kpi ${diff >= 0 ? 'success' : 'danger'}" style="grid-column: span 2;">
                    <span>Divergência / Fechamento Real</span>
                    <strong style="color:${diffColor};">${diffLabel} (Físico: R$ ${finalAmount.toFixed(2).replace('.', ',')})</strong>
                </div>
            `;
        }
        
        // Listagem de movimentações
        let txListHTML = '';
        if (transactions && transactions.length > 0) {
            txListHTML = transactions.map(t => {
                const isSangria = t.type === 'sangria';
                const color = isSangria ? '#c0392b' : '#27ae60';
                const symbol = isSangria ? '-' : '+';
                const label = isSangria ? 'Sangria' : 'Suprimento';
                const time = new Date(t.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                
                return `<tr>
                    <td>${time}</td>
                    <td style="color:${color}; font-weight:700;">${label}</td>
                    <td>${t.description || '—'}</td>
                    <td style="color:${color}; font-weight:700;">${symbol} R$ ${parseFloat(t.amount || 0).toFixed(2).replace('.', ',')}</td>
                </tr>`;
            }).join('');
        } else {
            txListHTML = '<tr><td colspan="4" style="text-align:center; padding:15px; color:var(--text-muted);">Nenhuma sangria ou suprimento lançado.</td></tr>';
        }
        
        body.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:20px; border-bottom:1px solid #eee; padding-bottom:15px;">
                <div>
                    <div style="font-size:12px; color:var(--text-muted); font-weight:600; text-transform:uppercase;">Operador de Abertura</div>
                    <strong style="font-size:16px;">${session.opened_by}</strong>
                    <div style="font-size:12px; color:var(--text-muted); margin-top:4px;"><i class="far fa-calendar-alt"></i> ${openDate}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:12px; color:var(--text-muted); font-weight:600; text-transform:uppercase;">Fechamento</div>
                    <strong style="font-size:16px;">${session.closed_by || '—'}</strong>
                    <div style="font-size:12px; color:var(--text-muted); margin-top:4px;"><i class="far fa-calendar-alt"></i> ${closeDate}</div>
                </div>
            </div>
            
            <div class="history-session-details-grid">
                <div class="history-session-kpi">
                    <span>Fundo de Caixa Inicial</span>
                    <strong>R$ ${initialAmount.toFixed(2).replace('.', ',')}</strong>
                </div>
                <div class="history-session-kpi success">
                    <span>Vendas no Dinheiro (PDV)</span>
                    <strong>+ R$ ${salesAmount.toFixed(2).replace('.', ',')}</strong>
                </div>
                <div class="history-session-kpi">
                    <span>Suprimentos (Aportes)</span>
                    <strong>+ R$ ${totalSuprimentos.toFixed(2).replace('.', ',')}</strong>
                </div>
                <div class="history-session-kpi danger">
                    <span>Sangrias (Retiradas)</span>
                    <strong>- R$ ${totalSangrias.toFixed(2).replace('.', ',')}</strong>
                </div>
                <div class="history-session-kpi" style="border-left-color:#8e44ad; grid-column: span 2;">
                    <span>Saldo Estimado em Gaveta</span>
                    <strong>R$ ${estimated.toFixed(2).replace('.', ',')}</strong>
                </div>
                ${diffHTML}
            </div>
            
            <div style="margin-top:20px;">
                <h4 style="font-size:14px; font-weight:700; margin-bottom:10px; color:var(--text-color);">Movimentações Manuais</h4>
                <div style="overflow-x:auto; border:1px solid var(--border-color); border-radius:6px;">
                    <table class="admin-table" style="margin:0; font-size:13px;">
                           <thead>
                               <tr>
                                   <th width="80">Hora</th>
                                   <th width="100">Operação</th>
                                   <th>Descrição / Motivo</th>
                                   <th width="120">Valor</th>
                               </tr>
                           </thead>
                        <tbody>
                            ${txListHTML}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (err) {
        console.error("Erro ao carregar detalhes do histórico:", err);
        body.innerHTML = `<div style="color:#c0392b; padding:20px; text-align:center;"><strong>Erro:</strong> ${err.message}</div>`;
    }
};

window.closeHistoryCashModal = function() {
    const modal = document.getElementById('modal-historico-caixa');
    if (modal) modal.classList.add('hidden');
};

async function checkAndAutoCloseCaixa(session) {
    if (!session || session.status !== 'aberto') return false;

    const now = new Date();
    const openedDate = new Date(session.opened_at);

    // 1. Verificar se a sessão foi aberta em um dia anterior (esquecido aberto)
    const isPreviousDay = (
        now.getFullYear() > openedDate.getFullYear() ||
        (now.getFullYear() === openedDate.getFullYear() && now.getMonth() > openedDate.getMonth()) ||
        (now.getFullYear() === openedDate.getFullYear() && now.getMonth() === openedDate.getMonth() && now.getDate() > openedDate.getDate())
    );

    // 2. Verificar se hoje já passou das 23:50
    const isPast1150PM = now.getHours() > 23 || (now.getHours() === 23 && now.getMinutes() >= 50);

    // Se for um dia anterior OU se hoje já passou das 23:50
    if (isPreviousDay || isPast1150PM) {
        console.log(`[Caixa] Fechamento automático ativado. Anterior: ${isPreviousDay}, Passou 23:50: ${isPast1150PM}`);
        
        try {
            // A. Calcular o saldo estimado atual do caixa
            const { data: sales } = await supabase
                .from('orders')
                .select('total, payment_method')
                .gte('created_at', session.opened_at);

            let totalSalesCash = 0;
            if (sales) {
                sales.forEach(o => {
                    const payMethod = String(o.payment_method || '').toLowerCase();
                    if (payMethod.includes('dinheiro')) {
                        totalSalesCash += parseFloat(o.total || 0);
                    }
                });
            }

            const { data: transactions } = await supabase
                .from('cash_transactions')
                .select('amount, type')
                .eq('session_id', session.id);

            let totalTransactions = 0;
            if (transactions) {
                transactions.forEach(t => {
                    const val = parseFloat(t.amount || 0);
                    if (t.type === 'sangria') totalTransactions -= val;
                    else totalTransactions += val;
                });
            }

            const initialAmount = parseFloat(session.initial_amount || 0);
            const balance = initialAmount + totalSalesCash + totalTransactions;

            // B. Atualizar a sessão no Supabase para fechado
            const closingTime = new Date();
            
            const { error } = await supabase
                .from('cash_sessions')
                .update({
                    closed_at: closingTime.toISOString(),
                    total_sales_cash: totalSalesCash,
                    total_transactions: totalTransactions,
                    final_amount: balance,
                    status: 'fechado',
                    closed_by: 'Sistema (Fechamento Automático)'
                })
                .eq('id', session.id);

            if (error) throw error;

            console.log(`[Caixa] Caixa ${session.id} fechado automaticamente com sucesso.`);
            
            // Se a sessão que fechamos for a sessão ativa na tela atual, resetar
            if (currentCashSession && currentCashSession.id === session.id) {
                currentCashSession = null;
                await renderCaixaFechadoState();
                await initCaixaHistoryCalendar();
                adminToast('O caixa ativo foi fechado automaticamente pelo sistema (horário limite: 23:50).', 'info');
            }
            return true;
        } catch (err) {
            console.error('Erro no fechamento automático do caixa:', err);
        }
    }
    return false;
}

// ============================================================
// SEÇÃO: ENTRADAS DE ESTOQUE (COMPRAS)
// ============================================================
let allStockEntries = [];
let cachedEntryProducts = [];

async function initEntradasModule() {
    const loadingEl = document.getElementById('entradas-loading');
    const errorEl = document.getElementById('entradas-error');
    const contentEl = document.getElementById('entradas-content');

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (errorEl) errorEl.classList.add('hidden');
    if (contentEl) contentEl.classList.add('hidden');

    try {
        // 1. Configurar data inicial como hoje na hora local
        const dateInput = document.getElementById('entry-date');
        if (dateInput && !dateInput.value) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
        }

        // 2. Carregar produtos para o cache e inicializar tabela como vazia
        let prods = cachedAdminData.products || await AdminData.getProducts();
        cachedEntryProducts = [...prods].sort((a, b) => a.name.localeCompare(b.name));

        const itemsBody = document.getElementById('entry-items-body');
        if (itemsBody) {
            itemsBody.innerHTML = '';
            checkIfEmptyTable();
        }

        // 3. Configurar campo global de busca autocomplete de produtos
        const searchInput = document.getElementById('entry-prod-search-global');
        const suggestionsDiv = document.getElementById('entry-prod-suggestions-global');

        if (searchInput && suggestionsDiv) {
            searchInput.value = '';
            suggestionsDiv.innerHTML = '';
            suggestionsDiv.classList.add('hidden');

            if (!searchInput._bound) {
                searchInput._bound = true;
                searchInput.addEventListener('input', (e) => {
                    const query = e.target.value.toLowerCase().trim();
                    if (query.length === 0) {
                        suggestionsDiv.innerHTML = '';
                        suggestionsDiv.classList.add('hidden');
                        return;
                    }

                    const matches = cachedEntryProducts.filter(p => 
                        p.name.toLowerCase().includes(query) || 
                        (p.barcode && p.barcode.includes(query)) ||
                        (p.sku && p.sku.toLowerCase().includes(query))
                    ).slice(0, 8);

                    if (matches.length > 0) {
                        suggestionsDiv.innerHTML = matches.map(p => `
                            <div class="prod-suggestion-row-item" data-id="${p.id}" data-name="${p.name.replace(/"/g, '&quot;')}" data-cost="${p.cost || 0}">
                                <div class="item-details">
                                    <span class="item-name">${p.name}</span>
                                </div>
                                <span class="item-stock">Estoque: ${p.stock || 0} un | Custo: R$ ${(p.cost || 0).toFixed(2)} | SKU: ${p.sku || '—'}</span>
                            </div>
                        `).join('');
                        suggestionsDiv.classList.remove('hidden');

                        suggestionsDiv.querySelectorAll('.prod-suggestion-row-item').forEach(item => {
                            item.onmousedown = (ev) => {
                                ev.preventDefault();
                                ev.stopPropagation();

                                const id = item.getAttribute('data-id');
                                const name = item.getAttribute('data-name');
                                const cost = parseFloat(item.getAttribute('data-cost')) || 0;

                                addEntryProductRow(id, name, cost);

                                searchInput.value = '';
                                suggestionsDiv.innerHTML = '';
                                suggestionsDiv.classList.add('hidden');
                            };
                        });
                    } else {
                        suggestionsDiv.innerHTML = '';
                        suggestionsDiv.classList.add('hidden');
                    }
                });

                searchInput.addEventListener('blur', () => {
                    setTimeout(() => {
                        suggestionsDiv.classList.add('hidden');
                    }, 150);
                });
            }
        }

        // 4. Buscar histórico de entradas no Supabase
        const { data: entries, error } = await supabase
            .from('stock_entries')
            .select(`
                id,
                date,
                supplier,
                invoice,
                product_id,
                quantity,
                cost_price,
                products (
                    name
                )
            `)
            .order('date', { ascending: false });

        if (error) {
            console.error("Erro ao buscar histórico de entradas:", error);
            throw error;
        }

        allStockEntries = entries || [];
        renderEntradasHistory();

        if (loadingEl) loadingEl.classList.add('hidden');
        if (contentEl) contentEl.classList.remove('hidden');
    } catch (err) {
        console.error("Falha ao inicializar o controle de entradas:", err);
        if (loadingEl) loadingEl.classList.add('hidden');
        if (errorEl) {
            errorEl.classList.remove('hidden');
            errorEl.innerHTML = 
                '<div style="color:#c0392b; padding:25px; font-weight:bold; text-align:center; max-width:600px; margin:0 auto;">' +
                '<i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:15px;"></i>' +
                '<h3 style="margin-bottom:10px; font-size:18px;">Erro: Tabela de Entradas não encontrada no Supabase!</h3>' +
                '<p style="font-size:14px; font-weight:normal; margin-bottom:15px; color:#555; line-height:1.6;">' +
                'Para ativar a aba de Entradas de Estoque, você precisa criar a tabela correspondente no seu banco de dados. ' +
                'Copie e execute o script SQL fornecido abaixo no <strong>SQL Editor</strong> do seu painel do Supabase.' +
                '</p>' +
                '<div style="background:#f8f9fa; border:1px solid #ddd; padding:12px; border-radius:6px; font-size:13px; font-weight:600; color:#333; margin-bottom:10px; cursor:pointer;" onclick="window.copyEntradasSQL()">' +
                '<i class="far fa-copy"></i> Copiar Código SQL de Criação' +
                '</div>' +
                '<button class="btn-primary" onclick="initEntradasModule()" style="background:#27ae60; margin-top:10px;"><i class="fas fa-sync"></i> Já criei, tentar novamente</button>' +
                '</div>';
        }
    }
}

function addEntryProductRow(id, name, cost) {
    const tbody = document.getElementById('entry-items-body');
    if (!tbody) return;

    // Verificar se o produto já foi adicionado para evitar duplicidade
    const existingRow = Array.from(tbody.querySelectorAll('.entry-item-row')).find(tr => {
        return tr.querySelector('.entry-prod-id').value === String(id);
    });

    if (existingRow) {
        adminToast('Este produto já foi adicionado à lista!', 'warning');
        return;
    }

    // Remover placeholder de tabela vazia se houver
    const emptyRow = tbody.querySelector('.empty-row-placeholder');
    if (emptyRow) emptyRow.remove();

    const rowId = 'row-' + Date.now();
    const tr = document.createElement('tr');
    tr.id = rowId;
    tr.className = 'entry-item-row';
    tr.innerHTML = `
        <td style="padding: 12px 15px; font-weight: 600; color: var(--text-main);">
            ${name}
            <input type="hidden" class="entry-prod-id" value="${id}">
        </td>
        <td style="padding: 10px 15px;">
            <input type="number" class="table-input-compact entry-qty-input" placeholder="Qtd" min="1" value="1" required style="width: 100%;">
        </td>
        <td style="padding: 10px 15px;">
            <input type="number" class="table-input-compact entry-cost-input" placeholder="R$ 0.00" step="0.01" min="0" value="${cost.toFixed(2)}" required style="width: 100%;">
        </td>
        <td style="padding: 10px 15px; font-weight: 600; color: #27ae60; font-size: 14px;" class="entry-row-total">
            R$ ${cost.toFixed(2).replace('.', ',')}
        </td>
        <td style="padding: 10px 15px; text-align: center;">
            <button type="button" class="btn-remove-row" title="Remover item"><i class="fas fa-trash-alt"></i></button>
        </td>
    `;

    const qtyInput = tr.querySelector('.entry-qty-input');
    const costInput = tr.querySelector('.entry-cost-input');
    const rowTotalEl = tr.querySelector('.entry-row-total');
    const removeBtn = tr.querySelector('.btn-remove-row');

    const updateRowTotal = () => {
        const qty = parseInt(qtyInput.value) || 0;
        const costVal = parseFloat(costInput.value) || 0;
        const total = qty * costVal;
        rowTotalEl.textContent = 'R$ ' + total.toFixed(2).replace('.', ',');
        updateEntrySummary();
    };

    qtyInput.addEventListener('input', updateRowTotal);
    costInput.addEventListener('input', updateRowTotal);

    removeBtn.addEventListener('click', () => {
        tr.remove();
        updateEntrySummary();
        checkIfEmptyTable();
    });

    tbody.appendChild(tr);
    updateEntrySummary();
}

function checkIfEmptyTable() {
    const tbody = document.getElementById('entry-items-body');
    if (tbody && tbody.querySelectorAll('.entry-item-row').length === 0) {
        tbody.innerHTML = `<tr class="empty-row-placeholder"><td colspan="5" style="text-align:center; padding:35px; color:var(--text-muted);"><i class="fas fa-search" style="margin-right:8px;"></i> Busque e adicione produtos acima para esta entrada.</td></tr>`;
    }
}

function updateEntrySummary() {
    const tbody = document.getElementById('entry-items-body');
    const summaryCount = document.getElementById('entry-summary-count');
    const summaryTotal = document.getElementById('entry-summary-total');

    if (!tbody || !summaryCount || !summaryTotal) return;

    const rows = tbody.querySelectorAll('.entry-item-row');
    let totalItems = 0;
    let totalValue = 0;

    rows.forEach(tr => {
        const qty = parseInt(tr.querySelector('.entry-qty-input').value) || 0;
        const cost = parseFloat(tr.querySelector('.entry-cost-input').value) || 0;
        totalItems += qty;
        totalValue += (qty * cost);
    });

    summaryCount.textContent = totalItems;
    summaryTotal.textContent = 'R$ ' + totalValue.toFixed(2).replace('.', ',');
}

function renderEntradasHistory(filter = '') {
    const tbody = document.getElementById('entradas-history-table');
    if (!tbody) return;

    const f = filter.toLowerCase().trim();
    const filtered = allStockEntries.filter(e => {
        const prodName = e.products ? String(e.products.name).toLowerCase() : '';
        return !f || 
            String(e.supplier).toLowerCase().includes(f) ||
            String(e.invoice || '').toLowerCase().includes(f) ||
            prodName.includes(f);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:35px; color:var(--text-muted);">Nenhuma entrada de estoque registrada.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(e => {
        const dateStr = new Date(e.date).toLocaleDateString('pt-BR');
        const prodName = e.products ? e.products.name : 'Produto Excluído';
        const cost = parseFloat(e.cost_price || 0);
        const qty = parseInt(e.quantity || 0);
        const total = cost * qty;

        return `<tr>
            <td>${dateStr}</td>
            <td><strong>${e.supplier}</strong></td>
            <td>${e.invoice || '—'}</td>
            <td>${prodName}</td>
            <td>${qty} un</td>
            <td>R$ ${cost.toFixed(2).replace('.', ',')}</td>
            <td style="font-weight:700; color:#27ae60;">R$ ${total.toFixed(2).replace('.', ',')}</td>
        </tr>`;
    }).join('');

    const search = document.getElementById('entry-history-search');
    if (search && !search._bound) {
        search._bound = true;
        search.addEventListener('input', (el) => renderEntradasHistory(el.target.value));
    }
}

// Handler de submissão do formulário de Entrada (Lote / Multi-Produto)
document.addEventListener('submit', async (e) => {
    if (e.target && e.target.id === 'form-lancar-entrada') {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        
        const entryDate = document.getElementById('entry-date').value;
        const supplier = document.getElementById('entry-supplier').value.trim();
        const invoice = document.getElementById('entry-invoice').value.trim();

        // Obter todas as linhas de produto
        const tbody = document.getElementById('entry-items-body');
        if (!tbody) return;
        const rows = tbody.querySelectorAll('.entry-item-row');
        
        if (rows.length === 0) {
            adminToast('Adicione pelo menos um produto!', 'error');
            return;
        }

        const itemsToSave = [];
        let validationError = null;

        rows.forEach((tr, index) => {
            const productId = parseInt(tr.querySelector('.entry-prod-id').value);
            const qty = parseInt(tr.querySelector('.entry-qty-input').value) || 0;
            const costPrice = parseFloat(tr.querySelector('.entry-cost-input').value) || 0;

            if (!productId) {
                validationError = `Linha ${index + 1}: Digite e selecione um produto válido da lista de sugestões!`;
                return;
            }
            if (qty <= 0) {
                validationError = `Linha ${index + 1}: Quantidade deve ser maior que zero!`;
                return;
            }
            if (costPrice < 0) {
                validationError = `Linha ${index + 1}: Preço de custo não pode ser negativo!`;
                return;
            }

            itemsToSave.push({
                product_id: productId,
                quantity: qty,
                cost_price: costPrice
            });
        });

        if (validationError) {
            adminToast(validationError, 'error');
            return;
        }

        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando Entrada em Lote...'; }

        try {
            // 1. Processar cada produto (Obter estoque atual, somar e atualizar)
            await Promise.all(itemsToSave.map(async (item) => {
                const { data: prod, error: fetchErr } = await supabase
                    .from('products')
                    .select('stock')
                    .eq('id', item.product_id)
                    .single();

                if (fetchErr) throw fetchErr;

                const currentStock = parseInt(prod.stock || 0);
                const newStock = currentStock + item.quantity;

                // Atualizar estoque e preço de custo do produto no Supabase
                const { error: updateErr } = await supabase
                    .from('products')
                    .update({
                        stock: newStock,
                        cost: item.cost_price
                    })
                    .eq('id', item.product_id);

                if (updateErr) throw updateErr;
            }));

            // 2. Registrar entradas no histórico de compras do Supabase (inserção em lote)
            const insertData = itemsToSave.map(item => ({
                date: entryDate ? new Date(entryDate).toISOString() : new Date().toISOString(),
                supplier: supplier,
                invoice: invoice || null,
                product_id: item.product_id,
                quantity: item.quantity,
                cost_price: item.cost_price
            }));

            const { error: insertErr } = await supabase
                .from('stock_entries')
                .insert(insertData);

            if (insertErr) throw insertErr;

            adminToast('Entrada de estoque em lote registrada com sucesso!');
            
            // Resetar a tabela dinâmica limpa com placeholder
            if (tbody) {
                tbody.innerHTML = '';
                checkIfEmptyTable();
            }

            // 3. Recarregar os produtos no cache global e atualizar tabelas
            const updatedProducts = await AdminData.getProducts();
            cachedAdminData.products = updatedProducts;
            await loadProducts(null, updatedProducts);
            
            // Atualizar os módulos de Estoque se estiverem abertos
            try {
                if (typeof loadStock === 'function') {
                    await loadStock();
                }
            } catch (e) { console.warn('Erro ao atualizar estoque geral:', e); }

            // Recarregar o histórico de entradas atualizado
            await initEntradasModule();
        } catch (err) {
            console.error('Erro ao registrar entrada de estoque:', err);
            adminToast('Erro ao registrar entrada: ' + err.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> Registrar Entrada e Atualizar Estoque'; }
        }
    }
});

// Helper para copiar SQL de criacao do Caixa
window.copyCaixaSQL = function() {
    const sql = `-- Criar tabelas do caixa
CREATE TABLE IF NOT EXISTS public.cash_sessions (
    id SERIAL PRIMARY KEY,
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    opened_by TEXT NOT NULL,
    initial_amount NUMERIC(10,2) DEFAULT 0.00 NOT NULL,
    total_sales_cash NUMERIC(10,2) DEFAULT 0.00 NOT NULL,
    total_transactions NUMERIC(10,2) DEFAULT 0.00 NOT NULL,
    final_amount NUMERIC(10,2),
    status TEXT DEFAULT 'aberto'::text NOT NULL,
    closed_by TEXT
);

CREATE TABLE IF NOT EXISTS public.cash_transactions (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES public.cash_sessions(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura para todos" ON public.cash_sessions FOR SELECT USING (true);
CREATE POLICY "Permitir insercao para todos" ON public.cash_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualizacao para todos" ON public.cash_sessions FOR UPDATE USING (true);
CREATE POLICY "Permitir leitura de transacoes" ON public.cash_transactions FOR SELECT USING (true);
CREATE POLICY "Permitir insercao de transacoes" ON public.cash_transactions FOR INSERT WITH CHECK (true);`;

    navigator.clipboard.writeText(sql);
    alert('SQL do Caixa copiado para a área de transferência!');
};

// Helper para copiar SQL de criacao de Entradas de Estoque
window.copyEntradasSQL = function() {
    const sql = `-- Criar tabela de entradas de estoque
CREATE TABLE IF NOT EXISTS public.stock_entries (
    id SERIAL PRIMARY KEY,
    date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    supplier TEXT NOT NULL,
    invoice TEXT,
    product_id INTEGER REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    quantity INTEGER NOT NULL,
    cost_price NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.stock_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de entradas" ON public.stock_entries FOR SELECT USING (true);
CREATE POLICY "Permitir insercao de entradas" ON public.stock_entries FOR INSERT WITH CHECK (true);`;

    navigator.clipboard.writeText(sql);
    alert('SQL de Entradas copiado para a área de transferência!');
};

