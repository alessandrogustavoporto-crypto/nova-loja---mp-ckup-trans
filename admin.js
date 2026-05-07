// ============================================================
// ADMIN MODULE — EcoStore
// ============================================================
function logErrorToDOM(msg) {
    const div = document.createElement('div');
    div.style.position = 'fixed'; div.style.top = '0'; div.style.left = '0'; div.style.right = '0'; div.style.background = 'red'; div.style.color = 'white'; div.style.padding = '20px'; div.style.zIndex = '999999'; div.style.fontSize = '24px'; div.style.fontWeight = 'bold';
    div.textContent = 'ERRO CRÍTICO: ' + msg;
    if(document.body) document.body.prepend(div); else window.onload = () => document.body.prepend(div);
}
window.addEventListener('error', function(e) { logErrorToDOM(e.message); });
window.addEventListener('unhandledrejection', function(e) { logErrorToDOM(e.reason ? e.reason.message || e.reason : 'Rejeição de promessa'); });


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

window.adminLogout = function() { AdminAuth.logout(); };

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
async function initAdminLogin() {
    const isLoginPage = !!document.getElementById('admin-login-form');
    if (!isLoginPage) return;

    if (AdminAuth.isLoggedIn()) { window.location.href = 'admin.html'; return; }
    
    const loginForm = document.getElementById('admin-login-form');
    const regForm   = document.getElementById('admin-register-form');
    const msgEl     = document.getElementById('admin-auth-msg');
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
    window.submitAdminRegister = async function(e) {
        if (e) e.preventDefault();
        const name  = document.getElementById('reg-admin-name').value.trim();
        const email = document.getElementById('reg-admin-email').value.trim();
        const pass  = document.getElementById('reg-admin-pass').value.trim();
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
    window.submitAdminLogin = async function(e) {
        if (e) e.preventDefault();
        const email = document.getElementById('admin-email').value.trim();
        const pass  = document.getElementById('admin-pass').value.trim();
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

    await loadDashboard();
    await loadProducts();
    await loadCategories();
    await loadBrands();
    await loadClients();
    await loadOrders();
    await loadBanners();
}

// ---- Dashboard KPIs ----
async function loadDashboard() {
    const orders   = await AdminData.getOrders();
    allAdminOrders = orders; // Garante que os dados estejam disponíveis para o modal de detalhes
    const products = await AdminData.getProducts();
    const clients  = await AdminData.getClients();
    const banners  = await AdminData.getBanners();

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
async function loadProducts(filter) {
    const fmt = v => 'R$ ' + (isNaN(v) ? '0,00' : v.toFixed(2).replace('.', ','));
    let prods = await AdminData.getProducts();
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

    await populateCategorySelect();
    await populateBrandSelect();
}

window.openProductModal = async function(id) {
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
        ['prod-id','prod-name','prod-image-base64','prod-desc'].forEach(f => { const el = document.getElementById(f); if(el) el.value = ''; });
        ['prod-price','prod-promo-price','prod-stock','prod-cost'].forEach(f => { const el = document.getElementById(f); if(el) el.value = ''; });
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

window.addVariationRow = function(name = '', price = '') {
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

window.closeProductModal = function() { document.getElementById('product-modal').classList.add('hidden'); };

window.saveProduct = async function() {
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

window.deleteProduct = async function(id) {
    if (!confirm('Confirmar exclusão deste produto?')) return;
    await supabase.from('products').delete().eq('id', id);
    await loadProducts();
    adminToast('Produto excluído.', 'error');
};

// ---- Categories ----
async function loadCategories() {
    const cats = await AdminData.getCategories();
    const prods = await AdminData.getProducts();
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

window.openCatModal = async function(id) {
    document.getElementById('cat-modal').classList.remove('hidden');
    if (!id) { document.getElementById('cat-id').value = ''; document.getElementById('cat-name').value = ''; return; }
    const cats = await AdminData.getCategories();
    const cat = cats.find(c => c.id === id);
    if (cat) { document.getElementById('cat-id').value = cat.id; document.getElementById('cat-name').value = cat.name; }
};

window.closeCatModal = function() { document.getElementById('cat-modal').classList.add('hidden'); };

window.saveCategory = async function() {
    const id = document.getElementById('cat-id').value;
    const name = document.getElementById('cat-name').value.trim();
    if (!name) { adminToast('Digite um nome.', 'error'); return; }
    if (id) {
        await supabase.from('categories').update({name}).eq('id', id);
    } else {
        await supabase.from('categories').insert([{name}]);
    }
    closeCatModal();
    await loadCategories();
    adminToast('Categoria salva!');
};

window.deleteCategory = async function(id) {
    if (!confirm('Excluir esta categoria?')) return;
    await supabase.from('categories').delete().eq('id', id);
    await loadCategories();
};

// ---- Clients ----
async function loadClients(nameFilter, typeFilter) {
    let clients = await AdminData.getClients();
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
        '<button class="btn-icon btn-icon-view" onclick="document.querySelector(\'[data-section=pedidos]\').click(); document.getElementById(\'order-admin-search\').value=\'' + c.email + '\'; document.getElementById(\'order-admin-search\').dispatchEvent(new Event(\'input\'));" title="Ver pedidos"><i class="fas fa-history"></i></button> ' +
        '<button class="btn-icon btn-icon-edit" onclick="openClientModal(\'' + c.email + '\')" title="Editar"><i class="fas fa-edit"></i></button> ' +
        '<button class="btn-icon btn-icon-block" onclick="toggleClientBlock(\'' + c.email + '\', \'' + c.status + '\')" title="Bloquear/Desbloquear"><i class="fas fa-ban"></i></button> ' +
        '<button class="btn-icon btn-icon-delete" onclick="deleteClient(\'' + c.email + '\')" title="Excluir"><i class="fas fa-trash"></i></button>' +
        '</td></tr>'
    ).join('');

    const search = document.getElementById('client-search');
    const typeF  = document.getElementById('client-type-filter');
    if (search && !search._bound) { search._bound = true; search.addEventListener('input', () => loadClients(search.value, typeF.value)); }
    if (typeF && !typeF._bound)   { typeF._bound = true;  typeF.addEventListener('change', () => loadClients(search.value, typeF.value)); }
}

window.openClientModal = async function(email) {
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

window.closeClientModal = function() {
    document.getElementById('client-modal').classList.add('hidden');
};

window.saveClient = async function() {
    const emailId = document.getElementById('client-modal-id').value;
    const name = document.getElementById('client-modal-name').value;
    const email = document.getElementById('client-modal-email').value;
    const phone = document.getElementById('client-modal-phone').value;
    const status = document.getElementById('client-modal-status').value;

    await supabase.from('customers').update({name, email, phone, status}).eq('email', emailId);

    adminToast('Dados do cliente atualizados!');
    closeClientModal();
    await loadClients();
    await loadDashboard();
};

window.toggleClientBlock = async function(email, currentStatus) {
    const newStatus = currentStatus === 'ativo' ? 'bloqueado' : 'ativo';
    const msg = newStatus === 'bloqueado' ? 'Deseja bloquear este cliente?' : 'Deseja desbloquear este cliente?';
    if (!confirm(msg)) return;

    const { error } = await supabase.from('customers').update({ status: newStatus }).eq('email', email);
    if (error) { adminToast('Erro: ' + error.message, 'error'); return; }

    adminToast('Status do cliente atualizado para ' + newStatus);
    await loadClients();
};

window.deleteClient = async function(email) {
    if (!confirm('AVISO: Esta ação é irreversível. Deseja excluir permanentemente este cliente e seus dados?')) return;

    const { error } = await supabase.from('customers').delete().eq('email', email);
    if (error) { adminToast('Erro ao excluir: ' + error.message, 'error'); return; }

    adminToast('Cliente excluído com sucesso!', 'error');
    await loadClients();
};

// ---- Orders ----
let allAdminOrders = [];

async function loadOrders(statusFilter, searchFilter) {
    allAdminOrders = await AdminData.getOrders();
    let orders = allAdminOrders;
    if (statusFilter) orders = orders.filter(o => o.status === statusFilter);
    if (searchFilter) orders = orders.filter(o => 
        String(o.id).toLowerCase().includes(searchFilter.toLowerCase()) || 
        (o.clientName || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
        (o.clientEmail || '').toLowerCase().includes(searchFilter.toLowerCase())
    );

    const tbody = document.getElementById('orders-admin-table');
    if (!tbody) return;
    tbody.innerHTML = orders.map(o =>
        '<tr>' +
        '<td><strong>#' + String(o.id).padStart(5, '0') + '</strong></td>' +
        '<td>' + (o.clientName || '—') + '</td>' +
        '<td>' + o.date + '</td>' +
        '<td>' + fmt(o.total) + '</td>' +
        '<td>' +
        '<select class="status-select" onchange="updateOrderStatus(\'' + o.id + '\', this.value)">' +
        ['aguardando','separacao','saiu','entregue','cancelado','processando'].map(s =>
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

window.updateOrderStatus = async function(id, newStatus) {
    await supabase.from('orders').update({status: newStatus, status_label: statusInfo[newStatus].label}).eq('id', id);
    adminToast('Status atualizado: ' + statusInfo[newStatus].label);
    await loadDashboard();
};

window.viewOrder = function(id) {
    const o = allAdminOrders.find(o => o.id == id);
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
async function loadBanners() {
    const banners = await AdminData.getBanners();
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

window.toggleBannerActive = async function(id) {
    const banners = await AdminData.getBanners();
    const b = banners.find(item => item.id === id);
    if (b) {
        await supabase.from('banners').update({active: !b.active}).eq('id', id);
        await loadBanners();
        adminToast('Status do banner atualizado!');
    }
};

window.openBannerModal = async function(id) {
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

window.closeBannerModal = function() {
    document.getElementById('banner-modal').classList.add('hidden');
};

window.saveBanner = async function() {
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

window.deleteBanner = async function(id) {
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

window.openBrandModal = async function(id) {
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

window.closeBrandModal = function() {
    document.getElementById('brand-modal').classList.add('hidden');
};

window.saveBrand = async function() {
    const id = document.getElementById('brand-id').value;
    const name = document.getElementById('brand-name').value.trim();

    if (!name) { adminToast('O nome da marca é obrigatório!', 'error'); return; }

    if (id) {
        await supabase.from('brands').update({name}).eq('id', id);
    } else {
        await supabase.from('brands').insert([{name}]);
    }

    adminToast('Marca salva com sucesso!');
    closeBrandModal();
    await loadBrands();
};

window.deleteBrand = async function(id) {
    if (!confirm('Deseja excluir esta marca?')) return;
    await supabase.from('brands').delete().eq('id', id);
    adminToast('Marca excluída!');
    await loadBrands();
};
