// ============================================================
// ADMIN MODULE — EcoStore
// ============================================================

// ---- Auth ----
const AdminAuth = {
    _sessionKey: 'ecostore_admin_session',
    _masterKey: 'ecostore_admin_master',
    
    isLoggedIn() { return !!sessionStorage.getItem(this._sessionKey); },
    hasMaster() { return !!localStorage.getItem(this._masterKey); },
    
    register(name, email, password) {
        if (this.hasMaster()) return false;
        const admin = { name, email, password };
        localStorage.setItem(this._masterKey, JSON.stringify(admin));
        return true;
    },
    
    login(email, pass) {
        const master = JSON.parse(localStorage.getItem(this._masterKey) || 'null');
        if (master && email === master.email && pass === master.password) {
            sessionStorage.setItem(this._sessionKey, JSON.stringify({ email: master.email, name: master.name }));
            return true;
        }
        return false;
    },
    
    logout() { sessionStorage.removeItem(this._sessionKey); window.location.href = 'admin-login.html'; },
    getAdmin() { return JSON.parse(sessionStorage.getItem(this._sessionKey) || 'null'); }
};

window.adminLogout = function() { AdminAuth.logout(); };

// ---- Data Store ----
const AdminData = {
    // Shared orders from customer localStorage
    getOrders() {
        const stored = JSON.parse(localStorage.getItem('ecostore_orders') || '[]');
        const mock = [
            { id: '#10592', clientName: 'João Silva', clientEmail: 'joao@email.com', clientPhone: '11987654321', date: '28/04/2026', status: 'saiu', total: 159.80, items: [{ name: 'Whey Protein Baunilha 900g', qty: 1, price: 159.90 }, { name: 'Chá Verde Orgânico', qty: 1, price: 22.50 }], address: 'Av. Paulista, 1578 - Bela Vista - São Paulo/SP - CEP: 01310-200' },
            { id: '#09884', clientName: 'Maria Costa', clientEmail: 'maria@email.com', clientPhone: '11912345678', date: '10/04/2026', status: 'entregue', total: 89.00, items: [{ name: 'Creme Hidratante Vegano', qty: 1, price: 89.00 }], address: 'Rua das Flores, 210 - Jardins - São Paulo/SP - CEP: 01452-000' },
            { id: '#08501', clientName: 'Carlos Mendes', clientEmail: 'carlos@empresa.com.br', clientPhone: '11933221100', date: '02/04/2026', status: 'aguardando', total: 320.00, items: [{ name: 'Colágeno Hidrolisado 300g', qty: 2, price: 95.00 }, { name: 'Vitamina C 1000mg', qty: 2, price: 69.90 }], address: 'Av. Brasil, 500 - Centro - Rio de Janeiro/RJ - CEP: 20040-002' }
        ];
        // Merge stored orders (from checkout) with mocks
        const storedWithInfo = stored.map(o => ({
            ...o,
            clientName: o.clientName || 'Cliente Online',
            clientEmail: o.clientEmail || 'cliente@email.com',
            clientPhone: o.clientPhone || '11999999999',
            address: typeof o.address === 'object'
                ? (o.address.logradouro + ', ' + o.address.numero + ' - ' + o.address.bairro + ' - ' + o.address.cidade + '/' + o.address.estado + ' - CEP: ' + o.address.cep)
                : (o.address || '')
        }));
        return [...storedWithInfo, ...mock];
    },
    saveOrders(orders) {
        const lsOrders = orders.filter(o => !['#10592','#09884','#08501'].includes(o.id));
        localStorage.setItem('ecostore_orders', JSON.stringify(lsOrders));
    },

    // Products (extends window PRODUCTS if available, else local)
    getProducts() {
        const stored = JSON.parse(localStorage.getItem('ecostore_products') || 'null');
        if (stored) return stored;
        // Seed from global PRODUCTS if available
        const base = typeof PRODUCTS !== 'undefined' ? PRODUCTS.map(p => ({ ...p, stock: Math.floor(Math.random() * 50) + 5, description: 'Produto natural de alta qualidade.', promoActive: !!p.offer, promoPrice: p.oldPrice || null })) : [];
        return base;
    },
    saveProducts(prods) { localStorage.setItem('ecostore_products', JSON.stringify(prods)); },

    // Categories
    getCategories() {
        const def = ['Bem-estar', 'Suplementos', 'Cosméticos', 'Alimentos', 'Nutrição Esportiva'];
        return JSON.parse(localStorage.getItem('ecostore_categories') || JSON.stringify(def.map((n, i) => ({ id: i + 1, name: n }))));
    },
    saveCategories(cats) { localStorage.setItem('ecostore_categories', JSON.stringify(cats)); },

    // Brands
    getBrands() {
        return JSON.parse(localStorage.getItem('ecostore_brands') || '[]');
    },
    saveBrands(brands) { localStorage.setItem('ecostore_brands', JSON.stringify(brands)); },

    // Clients
    getClients() {
        const mock = [
            { name: 'João Silva', email: 'joao@email.com', type: 'PF', orders: 2, status: 'ativo' },
            { name: 'Maria Costa', email: 'maria@email.com', type: 'PF', orders: 1, status: 'ativo' },
            { name: 'Carlos Mendes LTDA', email: 'carlos@empresa.com.br', type: 'PJ', orders: 3, status: 'ativo' },
            { name: 'Ana Paula Ramos', email: 'ana@email.com', type: 'PF', orders: 0, status: 'bloqueado' }
        ];
        const real = JSON.parse(localStorage.getItem('ecostore_all_users') || '[]');
        const orders = this.getOrders();

        const processedReal = real.map(u => ({
            name: u.name,
            email: u.email,
            phone: u.phone || '',
            type: u.cnpj ? 'PJ' : 'PF',
            // Count actual orders for this email
            orders: orders.filter(o => o.clientEmail === u.email).length,
            status: u.status || 'ativo'
        }));
        return [...processedReal, ...mock];
    },

    // Banners
    getBanners() {
        const stored = JSON.parse(localStorage.getItem('ecostore_banners') || '[]');
        if (stored.length === 0) {
            // Default banner
            return [{
                id: 1,
                title: 'Sua vida mais saudável e natural',
                subtitle: 'Descubra nossa nova linha de produtos orgânicos com até 30% de desconto.',
                btnText: 'Comprar Agora',
                btnLink: '#produtos',
                image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=80',
                active: true
            }];
        }
        return stored;
    },
    saveBanners(banners) { localStorage.setItem('ecostore_banners', JSON.stringify(banners)); }
};

// ---- Formatters ----
const fmt = v => 'R$ ' + parseFloat(v || 0).toFixed(2).replace('.', ',');
const statusInfo = {
    aguardando: { label: 'Aguardando Pagamento', badge: 'badge-aguardando' },
    separacao:  { label: 'Em Separação',         badge: 'badge-separacao' },
    saiu:       { label: 'Saiu para Entrega',    badge: 'badge-saiu' },
    entregue:   { label: 'Entregue',             badge: 'badge-entregue' },
    cancelado:  { label: 'Cancelado',            badge: 'badge-cancelado' },
    processando:{ label: 'Processando',          badge: 'badge-processando' },
    enviado:    { label: 'Enviado',              badge: 'badge-separacao' }
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
function initAdminLogin() {
    const isLoginPage = !!document.getElementById('admin-login-form');
    if (!isLoginPage) return;

    if (AdminAuth.isLoggedIn()) { window.location.href = 'admin.html'; return; }
    
    const loginForm = document.getElementById('admin-login-form');
    const regForm   = document.getElementById('admin-register-form');
    const msgEl     = document.getElementById('admin-auth-msg');
    if (!loginForm || !regForm) return;

    // Determine which form to show
    if (!AdminAuth.hasMaster()) {
        regForm.classList.remove('hidden');
        if (msgEl) {
            msgEl.textContent = 'Olá! Crie seu primeiro acesso de Administrador.';
            msgEl.style.background = '#e8f5e9';
            msgEl.style.color = '#27ae60';
            msgEl.classList.remove('hidden');
        }
    } else {
        loginForm.classList.remove('hidden');
    }

    // Handle Registration
    regForm.addEventListener('submit', e => {
        e.preventDefault();
        const name  = document.getElementById('reg-admin-name').value;
        const email = document.getElementById('reg-admin-email').value;
        const pass  = document.getElementById('reg-admin-pass').value;
        
        if (AdminAuth.register(name, email, pass)) {
            msgEl.textContent = 'Cadastro realizado! Agora faça seu primeiro login.';
            msgEl.style.background = '#e8f5e9';
            msgEl.style.color = '#27ae60';
            regForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        }
    });

    // Handle Login
    loginForm.addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value;
        const pass  = document.getElementById('admin-pass').value;
        
        if (AdminAuth.login(email, pass)) {
            window.location.href = 'admin.html';
        } else {
            msgEl.textContent = 'Credenciais inválidas. Verifique seu usuário e senha.';
            msgEl.style.background = '#ffeaea';
            msgEl.style.color = '#c0392b';
            msgEl.classList.remove('hidden');
        }
    });
}

// ============================================================
// PAGE: Admin Dashboard
// ============================================================
function initAdminDashboard() {
    if (!document.getElementById('admin-page-title')) return;
    if (!AdminAuth.isLoggedIn()) { window.location.href = 'admin-login.html'; return; }

    // Show admin name
    const admin = AdminAuth.getAdmin();
    const nameEl = document.getElementById('admin-name-display');
    if (nameEl && admin) nameEl.textContent = admin.name;

    // Sidebar navigation
    const btns = document.querySelectorAll('.sidebar-btn[data-section]');
    btns.forEach(btn => btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        const sec = document.getElementById('section-' + btn.dataset.section);
        if (sec) sec.classList.add('active');
        document.getElementById('admin-page-title').textContent = btn.textContent.trim();
    }));

    loadDashboard();
    loadProducts();
    loadCategories();
    loadBrands();
    loadClients();
    loadOrders();
    loadBanners();
}

// ---- Dashboard KPIs ----
function loadDashboard() {
    const orders   = AdminData.getOrders();
    const products = AdminData.getProducts();
    const clients  = AdminData.getClients();
    const banners  = AdminData.getBanners();

    const salesTotal = orders.reduce((s, o) => s + parseFloat(o.total || 0), 0);
    const pending = orders.filter(o => ['aguardando','separacao','processando'].includes(o.status)).length;
    const activeBanners = banners.filter(b => b.active).length;

    document.getElementById('kpi-sales').textContent    = fmt(salesTotal);
    document.getElementById('kpi-pending').textContent  = pending;
    document.getElementById('kpi-clients').textContent  = clients.length;
    document.getElementById('kpi-banners').textContent  = activeBanners;

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
function loadProducts(filter) {
    let prods = AdminData.getProducts();
    if (filter) prods = prods.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
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

    // Populate category and brand selects in modal
    populateCategorySelect();
    populateBrandSelect();
}

window.openProductModal = function(id) {
    const modal = document.getElementById('product-modal');
    modal.classList.remove('hidden');
    populateCategorySelect();
    populateBrandSelect();
    
    // Preview Reset
    const preview = document.getElementById('prod-img-preview');
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    const fileInput = document.getElementById('prod-image-file');
    if (fileInput) fileInput.value = '';

    if (!id) {
        document.getElementById('product-modal-title').textContent = 'Novo Produto';
        ['prod-id','prod-name','prod-image-base64','prod-desc'].forEach(f => { const el = document.getElementById(f); if(el) el.value = ''; });
        ['prod-price','prod-promo-price','prod-stock'].forEach(f => { const el = document.getElementById(f); if(el) el.value = ''; });
        document.getElementById('prod-promo-active').checked = false;
        return;
    }
    const prod = AdminData.getProducts().find(p => p.id === id);
    if (!prod) return;
    document.getElementById('product-modal-title').textContent = 'Editar Produto';
    document.getElementById('prod-id').value = prod.id;
    document.getElementById('prod-name').value = prod.name;
    document.getElementById('prod-price').value = prod.price;
    document.getElementById('prod-promo-price').value = prod.promoPrice || '';
    document.getElementById('prod-stock').value = prod.stock || 0;
    document.getElementById('prod-image-base64').value = prod.image || '';
    document.getElementById('prod-desc').value = prod.description || '';
    document.getElementById('prod-category').value = prod.category || '';
    document.getElementById('prod-brand').value = prod.brand || '';
    document.getElementById('prod-promo-active').checked = !!prod.promoActive;

    if (prod.image && preview) {
        preview.src = prod.image;
        preview.style.display = 'block';
    }
};

window.closeProductModal = function() { document.getElementById('product-modal').classList.add('hidden'); };

window.saveProduct = function() {
    const id = document.getElementById('prod-id').value;
    const prods = AdminData.getProducts();
    const product = {
        id: id ? parseInt(id) : Date.now(),
        name: document.getElementById('prod-name').value,
        price: parseFloat(document.getElementById('prod-price').value),
        promoPrice: parseFloat(document.getElementById('prod-promo-price').value) || 0,
        stock: parseInt(document.getElementById('prod-stock').value) || 0,
        image: document.getElementById('prod-image-base64').value,
        description: document.getElementById('prod-desc').value,
        category: document.getElementById('prod-category').value,
        brand: document.getElementById('prod-brand').value,
        promoActive: document.getElementById('prod-promo-active').checked
    };

    if (!product.name || isNaN(product.price)) { adminToast('Preencha nome e preço.', 'error'); return; }

    if (id) {
        const idx = prods.findIndex(p => p.id === parseInt(id));
        if (idx > -1) prods[idx] = product;
    } else {
        prods.push(product);
    }

    AdminData.saveProducts(prods);
    closeProductModal();
    loadProducts();
    adminToast('Produto salvo com sucesso!');
};

// Handle Image File Upload to Base64
document.addEventListener('change', e => {
    if (e.target.id === 'prod-image-file') {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
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

window.deleteProduct = function(id) {
    if (!confirm('Confirmar exclusão deste produto?')) return;
    const prods = AdminData.getProducts().filter(p => p.id !== id);
    AdminData.saveProducts(prods);
    loadProducts();
    adminToast('Produto excluído.', 'error');
};

// ---- Categories ----
function loadCategories() {
    const cats = AdminData.getCategories();
    const prods = AdminData.getProducts();
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

function populateCategorySelect() {
    const sel = document.getElementById('prod-category');
    if (!sel) return;
    const cats = AdminData.getCategories();
    sel.innerHTML = cats.map(c => '<option value="' + c.name + '">' + c.name + '</option>').join('');
}

window.openCatModal = function(id) {
    document.getElementById('cat-modal').classList.remove('hidden');
    if (!id) { document.getElementById('cat-id').value = ''; document.getElementById('cat-name').value = ''; return; }
    const cat = AdminData.getCategories().find(c => c.id === id);
    if (cat) { document.getElementById('cat-id').value = cat.id; document.getElementById('cat-name').value = cat.name; }
};

window.closeCatModal = function() { document.getElementById('cat-modal').classList.add('hidden'); };

window.saveCategory = function() {
    const cats = AdminData.getCategories();
    const id = document.getElementById('cat-id').value;
    const name = document.getElementById('cat-name').value.trim();
    if (!name) { adminToast('Digite um nome.', 'error'); return; }
    if (id) {
        const c = cats.find(c => c.id === parseInt(id));
        if (c) c.name = name;
    } else {
        cats.push({ id: Date.now(), name });
    }
    AdminData.saveCategories(cats);
    closeCatModal();
    loadCategories();
    adminToast('Categoria salva!');
};

window.deleteCategory = function(id) {
    if (!confirm('Excluir esta categoria?')) return;
    AdminData.saveCategories(AdminData.getCategories().filter(c => c.id !== id));
    loadCategories();
};

// ---- Clients ----
function loadClients(nameFilter, typeFilter) {
    let clients = AdminData.getClients();
    if (nameFilter) clients = clients.filter(c => c.name.toLowerCase().includes(nameFilter.toLowerCase()) || c.email.toLowerCase().includes(nameFilter.toLowerCase()));
    if (typeFilter) clients = clients.filter(c => c.type === typeFilter);
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
        '<button class="btn-icon btn-icon-view" title="Ver pedidos"><i class="fas fa-history"></i></button> ' +
        '<button class="btn-icon btn-icon-edit" onclick="openClientModal(\'' + c.email + '\')" title="Editar"><i class="fas fa-edit"></i></button> ' +
        '<button class="btn-icon btn-icon-block" title="Bloquear/Desbloquear"><i class="fas fa-ban"></i></button> ' +
        '<button class="btn-icon btn-icon-delete" title="Excluir"><i class="fas fa-trash"></i></button>' +
        '</td></tr>'
    ).join('');

    const search = document.getElementById('client-search');
    const typeF  = document.getElementById('client-type-filter');
    if (search && !search._bound) { search._bound = true; search.addEventListener('input', () => loadClients(search.value, typeF.value)); }
    if (typeF && !typeF._bound)   { typeF._bound = true;  typeF.addEventListener('change', () => loadClients(search.value, typeF.value)); }
}

window.openClientModal = function(email) {
    const clients = AdminData.getClients();
    const client = clients.find(c => c.email === email);
    if (!client) return;

    document.getElementById('client-modal-id').value = client.email;
    document.getElementById('client-modal-name').value = client.name;
    document.getElementById('client-modal-email').value = client.email;
    document.getElementById('client-modal-phone').value = client.phone || '';
    document.getElementById('client-modal-status').value = client.status || 'ativo';

    document.getElementById('client-modal').classList.remove('hidden');
};

window.closeClientModal = function() {
    document.getElementById('client-modal').classList.add('hidden');
};

window.saveClient = function() {
    const emailId = document.getElementById('client-modal-id').value;
    const name = document.getElementById('client-modal-name').value;
    const email = document.getElementById('client-modal-email').value;
    const phone = document.getElementById('client-modal-phone').value;
    const status = document.getElementById('client-modal-status').value;

    const allUsers = JSON.parse(localStorage.getItem('ecostore_all_users') || '[]');
    const userIdx = allUsers.findIndex(u => u.email === emailId);

    if (userIdx > -1) {
        allUsers[userIdx].name = name;
        allUsers[userIdx].email = email;
        allUsers[userIdx].phone = phone;
        allUsers[userIdx].status = status;
        localStorage.setItem('ecostore_all_users', JSON.stringify(allUsers));
        adminToast('Dados do cliente atualizados!');
    } else {
        adminToast('Erro ao encontrar cliente real para editar.', 'error');
    }

    closeClientModal();
    loadClients();
    loadDashboard();
};

// ---- Orders ----
let allAdminOrders = [];

function loadOrders(statusFilter, searchFilter) {
    allAdminOrders = AdminData.getOrders();
    let orders = allAdminOrders;
    if (statusFilter) orders = orders.filter(o => o.status === statusFilter);
    if (searchFilter) orders = orders.filter(o => o.id.toLowerCase().includes(searchFilter.toLowerCase()) || (o.clientName || '').toLowerCase().includes(searchFilter.toLowerCase()));

    const tbody = document.getElementById('orders-admin-table');
    if (!tbody) return;
    tbody.innerHTML = orders.map(o =>
        '<tr>' +
        '<td><strong>' + o.id + '</strong></td>' +
        '<td>' + (o.clientName || '—') + '</td>' +
        '<td>' + o.date + '</td>' +
        '<td>' + fmt(o.total) + '</td>' +
        '<td>' +
        '<select class="status-select" onchange="updateOrderStatus(\'' + o.id + '\', this.value)">' +
        ['aguardando','separacao','saiu','entregue','cancelado'].map(s =>
            '<option value="' + s + '"' + (o.status === s ? ' selected' : '') + '>' + statusInfo[s].label + '</option>'
        ).join('') +
        '</select>' +
        '</td>' +
        '<td>' +
        '<button class="btn-icon btn-icon-view" onclick="viewOrder(\'' + o.id + '\')" title="Ver detalhes"><i class="fas fa-eye"></i></button>' +
        (o.clientPhone ? ' <a href="https://wa.me/55' + o.clientPhone.replace(/\D/g,'') + '" target="_blank" class="btn-icon" style="color:#25D366;" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>' : '') +
        '</td></tr>'
    ).join('');

    const search = document.getElementById('order-admin-search');
    const status = document.getElementById('order-admin-status');
    if (search && !search._bound) { search._bound = true; search.addEventListener('input', () => loadOrders(status.value, search.value)); }
    if (status && !status._bound) { status._bound = true; status.addEventListener('change', () => loadOrders(status.value, search.value)); }
}

window.updateOrderStatus = function(id, newStatus) {
    const orders = AdminData.getOrders();
    const o = orders.find(o => o.id === id);
    if (o) { o.status = newStatus; AdminData.saveOrders(orders); adminToast('Status atualizado: ' + statusInfo[newStatus].label); loadDashboard(); }
};

window.viewOrder = function(id) {
    const o = allAdminOrders.find(o => o.id === id);
    if (!o) return;
    document.getElementById('order-detail-title').textContent = 'Pedido ' + o.id;
    document.getElementById('order-detail-body').innerHTML =
        '<div class="order-detail-section">' +
        '<h4><i class="fas fa-user"></i> Dados do Cliente</h4>' +
        '<p><strong>Nome:</strong> ' + (o.clientName || '—') + '</p>' +
        '<p><strong>E-mail:</strong> ' + (o.clientEmail || '—') + '</p>' +
        '<p><strong>WhatsApp:</strong> ' + (o.clientPhone ? '<a href="https://wa.me/55' + o.clientPhone.replace(/\D/g,'') + '" target="_blank" style="color:#25D366"><i class="fab fa-whatsapp"></i> ' + o.clientPhone + '</a>' : '—') + '</p>' +
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

window.closeOrderModal = function() { document.getElementById('order-detail-modal').classList.add('hidden'); };

window.printOrder = function() {
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
function loadBanners() {
    const banners = AdminData.getBanners();
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

window.toggleBannerActive = function(id) {
    const banners = AdminData.getBanners();
    const banner = banners.find(b => b.active); // This line in previous logic was weirdly named, let's fix the whole function
    const b = banners.find(item => item.id === id);
    if (b) {
        b.active = !b.active;
        AdminData.saveBanners(banners);
        loadBanners();
        adminToast('Status do banner atualizado!');
    }
};

window.openBannerModal = function(id) {
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
        ['banner-id','banner-title','banner-subtitle','banner-btn-text','banner-btn-link','banner-image-base64'].forEach(f => { const el = document.getElementById(f); if(el) el.value = ''; });
        document.getElementById('banner-active').checked = true;
        return;
    }

    const banner = AdminData.getBanners().find(b => b.id === id);
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

window.closeBannerModal = function() {
    document.getElementById('banner-modal').classList.add('hidden');
};

window.saveBanner = function() {
    const id = document.getElementById('banner-id').value;
    const banners = AdminData.getBanners();
    
    const banner = {
        id: id ? parseInt(id) : Date.now(),
        title: document.getElementById('banner-title').value,
        subtitle: document.getElementById('banner-subtitle').value,
        btnText: document.getElementById('banner-btn-text').value,
        btnLink: document.getElementById('banner-btn-link').value,
        image: document.getElementById('banner-image-base64').value,
        active: document.getElementById('banner-active').checked
    };

    if (!banner.image) { adminToast('É necessário fazer o upload de uma imagem.', 'error'); return; }

    if (id) {
        const idx = banners.findIndex(b => b.id === parseInt(id));
        if (idx > -1) banners[idx] = banner;
    } else {
        banners.push(banner);
    }

    AdminData.saveBanners(banners);
    closeBannerModal();
    loadBanners();
    adminToast('Banner salvo com sucesso!');
};

window.deleteBanner = function(id) {
    if (!confirm('Excluir este banner permanentemente?')) return;
    const banners = AdminData.getBanners().filter(b => b.id !== id);
    AdminData.saveBanners(banners);
    loadBanners();
    adminToast('Banner removido.', 'error');
};

// Handle Banner Image Upload
document.addEventListener('change', e => {
    if (e.target.id === 'banner-image-file') {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(event) {
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
document.addEventListener('DOMContentLoaded', () => {
    initAdminLogin();
    initAdminDashboard();
});

// ============================================================
// MARCAS
// ============================================================
function loadBrands() {
    const brands = AdminData.getBrands();
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

function populateBrandSelect() {
    const select = document.getElementById('prod-brand');
    if (!select) return;
    const brands = AdminData.getBrands();
    select.innerHTML = '<option value="">Sem Marca</option>' + brands.map(b => '<option value="' + b.name + '">' + b.name + '</option>').join('');
}

window.openBrandModal = function(id) {
    const modal = document.getElementById('brand-modal');
    modal.classList.remove('hidden');

    if (!id) {
        document.getElementById('brand-modal-title').textContent = 'Nova Marca';
        document.getElementById('brand-id').value = '';
        document.getElementById('brand-name').value = '';
        return;
    }

    const b = AdminData.getBrands().find(item => item.id == id);
    if (b) {
        document.getElementById('brand-modal-title').textContent = 'Editar Marca';
        document.getElementById('brand-id').value = b.id;
        document.getElementById('brand-name').value = b.name;
    }
};

window.closeBrandModal = function() {
    document.getElementById('brand-modal').classList.add('hidden');
};

window.saveBrand = function() {
    const id = document.getElementById('brand-id').value;
    const name = document.getElementById('brand-name').value.trim();

    if (!name) { adminToast('O nome da marca é obrigatório!', 'error'); return; }

    const brands = AdminData.getBrands();
    if (id) {
        const idx = brands.findIndex(b => b.id == id);
        if (idx > -1) brands[idx].name = name;
    } else {
        brands.push({ id: Date.now(), name });
    }

    AdminData.saveBrands(brands);
    adminToast('Marca salva com sucesso!');
    closeBrandModal();
    loadBrands();
};

window.deleteBrand = function(id) {
    if (!confirm('Deseja excluir esta marca?')) return;
    const brands = AdminData.getBrands().filter(b => b.id != id);
    AdminData.saveBrands(brands);
    adminToast('Marca excluída!');
    loadBrands();
};
