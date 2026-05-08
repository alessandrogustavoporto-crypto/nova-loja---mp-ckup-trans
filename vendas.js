// Admin Auth Check
const _sessionKey = 'ecostore_admin_session';
const loggedAdmin = JSON.parse(sessionStorage.getItem(_sessionKey) || 'null');

if (!loggedAdmin) {
    window.location.href = 'admin-login.html';
}

let pdvItems = [];
let allProducts = [];
let allCustomers = [];
let selectedCustomer = null;
let editingItemIndex = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Update Seller Name
    if (loggedAdmin && document.getElementById('vendedor-nome')) {
        document.getElementById('vendedor-nome').textContent = loggedAdmin.name;
    }
    
    updateClock();
    setInterval(updateClock, 1000);
    
    await loadInitialData();
    setupEventListeners();
    setupShortcuts();
});

function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR');
    document.getElementById('current-time').textContent = timeStr;
}

async function loadInitialData() {
    try {
        const { data: prods } = await supabase.from('products').select('*');
        const { data: custs } = await supabase.from('customers').select('*');
        allProducts = prods || [];
        allCustomers = custs || [];
        console.log('Dados carregados:', allProducts.length, 'produtos');
    } catch (e) {
        console.error('Erro ao carregar dados:', e);
    }
}

// ============================================================
// EVENT LISTENERS & SHORTCUTS
// ============================================================

function setupEventListeners() {
    const prodSearch = document.getElementById('pdv-prod-search');
    const addBtn = document.getElementById('pdv-add-btn');

    // Busca em tempo real de produtos
    prodSearch.addEventListener('input', (e) => showProductSuggestions(e.target.value));

    // Add item on Enter in search
    const inputs = ['pdv-prod-search', 'pdv-prod-qty', 'pdv-prod-price'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addItemFromSearch();
            });
        }
    });

    addBtn.addEventListener('click', addItemFromSearch);

    // Amount received change (for troco)
    document.getElementById('pdv-amount-received').addEventListener('input', updateChange);
    document.getElementById('pdv-global-discount').addEventListener('input', renderTotals);

    // Customer search
    document.getElementById('pdv-cust-search').addEventListener('input', (e) => searchCustomer(e.target.value));
}

function setupShortcuts() {
    document.addEventListener('keydown', (e) => {
        // F1: Focus Product Search
        if (e.key === 'F1') {
            e.preventDefault();
            document.getElementById('pdv-prod-search').focus();
        }
        // F2: Focus Quantity
        if (e.key === 'F2') {
            e.preventDefault();
            document.getElementById('pdv-prod-qty').focus();
        }
        // F5: Finish Sale
        if (e.key === 'F5') {
            e.preventDefault();
            openCheckoutModal();
        }
        // ESC: Close Modal or Clear
        if (e.key === 'Escape') {
            const modal = document.getElementById('modal-checkout');
            if (!modal.classList.contains('hidden')) {
                closeCheckoutModal();
            } else {
                if (confirm('Deseja realmente cancelar esta venda?')) clearPDV();
            }
        }
    });
}

// ============================================================
// PRODUCT SEARCH & ADD
// ============================================================

function showProductSuggestions(query) {
    const list = document.getElementById('prod-suggestions');
    if (query.length < 2) {
        list.classList.add('hidden');
        return;
    }

    // Se for código de barras exato (geralmente longo e numérico), não abre lista, espera o Enter ou Adicionar
    const exactMatch = allProducts.find(p => p.barcode === query);
    if (exactMatch && query.length >= 8) {
        list.classList.add('hidden');
        return;
    }

    const matches = allProducts.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase()) || 
        (p.barcode && p.barcode.includes(query))
    ).slice(0, 8);

    if (matches.length > 0) {
        list.innerHTML = matches.map(p => `
            <div class="suggestion-item" data-id="${p.id}">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span>${p.name}</span>
                    <strong class="suggestion-price">${fmt(p.price)}</strong>
                </div>
                <small>Estoque: ${p.stock || 0} | EAN: ${p.barcode || '—'}</small>
            </div>
        `).join('');
        list.classList.remove('hidden');

        // Eventos de clique
        list.querySelectorAll('.suggestion-item').forEach(item => {
            item.onmousedown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.selectProduct(item.getAttribute('data-id'));
            };
        });
    } else {
        list.classList.add('hidden');
    }
}

window.selectProduct = function(id) {
    const product = allProducts.find(p => String(p.id) === String(id));
    if (product) {
        const qty = parseInt(document.getElementById('pdv-prod-qty').value) || 1;
        const priceOverride = parseFloat(document.getElementById('pdv-prod-price').value);
        
        if (editingItemIndex !== null) {
            // Update
            pdvItems[editingItemIndex].qty = qty;
            pdvItems[editingItemIndex].price = !isNaN(priceOverride) && priceOverride > 0 ? priceOverride : product.price;
            pdvItems[editingItemIndex].subtotal = pdvItems[editingItemIndex].qty * pdvItems[editingItemIndex].price;
            editingItemIndex = null;
            document.getElementById('pdv-add-btn').innerHTML = '<i class="fas fa-plus"></i> ADICIONAR';
            renderItems();
        } else {
            addItem(product, qty, priceOverride);
        }
        
        document.getElementById('pdv-prod-search').value = '';
        document.getElementById('pdv-prod-qty').value = '1';
        document.getElementById('pdv-prod-price').value = '';
        document.getElementById('prod-suggestions').classList.add('hidden');
        document.getElementById('pdv-prod-search').focus();
    }
}

function addItemFromSearch() {
    const query = document.getElementById('pdv-prod-search').value.trim();
    const qty = parseInt(document.getElementById('pdv-prod-qty').value) || 1;
    const priceOverride = parseFloat(document.getElementById('pdv-prod-price').value);

    if (!query) return;

    const product = allProducts.find(p => 
        p.barcode === query || 
        p.id.toString() === query || 
        p.name.toLowerCase() === query.toLowerCase()
    );

    if (product) {
        if (editingItemIndex !== null) {
            // Update existing item
            pdvItems[editingItemIndex].qty = qty;
            pdvItems[editingItemIndex].price = !isNaN(priceOverride) && priceOverride > 0 ? priceOverride : product.price;
            pdvItems[editingItemIndex].subtotal = pdvItems[editingItemIndex].qty * pdvItems[editingItemIndex].price;
            
            editingItemIndex = null;
            const addBtn = document.getElementById('pdv-add-btn');
            if (addBtn) addBtn.innerHTML = '<i class="fas fa-plus"></i> ADICIONAR';
            
            renderItems();
        } else {
            addItem(product, qty, priceOverride);
        }
        
        document.getElementById('pdv-prod-search').value = '';
        document.getElementById('pdv-prod-qty').value = '1';
        document.getElementById('pdv-prod-price').value = '';
        document.getElementById('prod-suggestions').classList.add('hidden');
        document.getElementById('pdv-prod-search').focus();
    } else {
        alert('Produto não encontrado!');
    }
}

window.editItem = function(index) {
    const item = pdvItems[index];
    if (!item) return;

    editingItemIndex = index;
    
    document.getElementById('pdv-prod-search').value = item.name;
    document.getElementById('pdv-prod-qty').value = item.qty;
    document.getElementById('pdv-prod-price').value = item.price;
    
    const addBtn = document.getElementById('pdv-add-btn');
    if (addBtn) addBtn.innerHTML = '<i class="fas fa-check"></i> ATUALIZAR';
    
    document.getElementById('pdv-prod-qty').focus();
};

function addItem(product, qty, priceOverride) {
    const price = !isNaN(priceOverride) && priceOverride > 0 ? priceOverride : product.price;
    
    // Check if already in list
    const existing = pdvItems.find(i => i.id === product.id);
    if (existing) {
        existing.qty += qty;
        existing.subtotal = existing.qty * existing.price;
    } else {
        pdvItems.push({
            id: product.id,
            barcode: product.barcode || '—',
            name: product.name,
            price: price,
            qty: qty,
            subtotal: qty * price
        });
    }

    renderItems();
}

function removeItem(index) {
    pdvItems.splice(index, 1);
    renderItems();
}

function renderItems() {
    const tbody = document.getElementById('pdv-items-body');
    const emptyMsg = document.getElementById('empty-cart-msg');
    
    if (pdvItems.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.classList.remove('hidden');
    } else {
        emptyMsg.classList.add('hidden');
        tbody.innerHTML = pdvItems.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${item.barcode}</td>
                <td><strong>${item.name}</strong></td>
                <td>UN</td>
                <td>${fmt(item.price)}</td>
                <td>${item.qty}</td>
                <td><strong>${fmt(item.subtotal)}</strong></td>
                <td class="pdv-item-actions">
                    <button class="btn-action btn-edit" onclick="editItem(${index})" title="Editar Item">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-remove" onclick="removeItem(${index})" title="Remover Item">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderTotals();
}

// ============================================================
// CUSTOMER & TOTALS
// ============================================================

function openNewCustModal() {
    document.getElementById('modal-new-customer').classList.remove('hidden');
    document.getElementById('new-cust-name').focus();
}

function closeNewCustModal() {
    document.getElementById('modal-new-customer').classList.add('hidden');
}

async function saveNewCustomer() {
    const name = document.getElementById('new-cust-name').value.trim();
    const cpf = document.getElementById('new-cust-cpf').value.trim();
    const email = document.getElementById('new-cust-email').value.trim() || `pdv_${Date.now()}@ecostore.com`;
    const phone = document.getElementById('new-cust-phone').value.trim();

    if (!name) { alert('O nome é obrigatório!'); return; }

    try {
        const { data, error } = await supabase.from('customers').insert([{
            name, cpf, email, phone
        }]).select().single();

        if (error) throw error;

        alert('Cliente cadastrado com sucesso!');
        selectedCustomer = data;
        document.getElementById('selected-customer-info').classList.remove('hidden');
        document.getElementById('selected-cust-name').textContent = data.name;
        
        await loadInitialData(); // Refresh list
        closeNewCustModal();

    } catch (e) {
        console.error(e);
        alert('Erro ao cadastrar cliente: ' + (e.message || 'Verifique se o e-mail ou CPF já existem.'));
    }
}

function searchCustomer(query) {
    const list = document.getElementById('cust-suggestions');
    if (query.length < 3) {
        list.classList.add('hidden');
        return;
    }

    const matches = allCustomers.filter(c => 
        (c.cpf && c.cpf.includes(query)) || 
        (c.name && c.name.toLowerCase().includes(query.toLowerCase()))
    ).slice(0, 5);

    if (matches.length > 0) {
        list.innerHTML = matches.map(c => `
            <div class="suggestion-item" data-id="${c.id}">
                <span>${c.name}</span>
                <small>CPF: ${c.cpf || '—'} | ${c.email}</small>
            </div>
        `).join('');
        list.classList.remove('hidden');
        
        // Adiciona ouvintes de clique nos itens recém-criados
        list.querySelectorAll('.suggestion-item').forEach(item => {
            item.onmousedown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = item.getAttribute('data-id');
                window.selectCustomer(id);
            };
        });
    } else {
        list.classList.add('hidden');
    }
}

window.selectCustomer = function(id) {
    console.log('Selecionando cliente ID:', id);
    // Busca flexível (número ou string)
    const cust = allCustomers.find(c => String(c.id) === String(id));
    
    if (cust) {
        selectedCustomer = cust;
        
        // Esconde a busca e mostra o crachá do cliente
        document.getElementById('cust-search-container').classList.add('hidden');
        document.getElementById('selected-customer-badge').classList.remove('hidden');
        document.getElementById('selected-cust-name-badge').textContent = cust.name;
        
        document.getElementById('cust-suggestions').classList.add('hidden');
        document.getElementById('pdv-cust-search').value = '';
    } else {
        console.error('Cliente não encontrado no cache local para o ID:', id);
    }
}

window.removeSelectedCustomer = function() {
    selectedCustomer = null;
    document.getElementById('cust-search-container').classList.remove('hidden');
    document.getElementById('selected-customer-badge').classList.add('hidden');
    document.getElementById('pdv-cust-search').focus();
}

function renderTotals() {
    const subtotal = pdvItems.reduce((acc, item) => acc + item.subtotal, 0);
    const discount = parseFloat(document.getElementById('pdv-global-discount').value) || 0;
    const total = subtotal - discount;

    document.getElementById('pdv-subtotal').textContent = fmt(subtotal);
    document.getElementById('pdv-discounts').textContent = '- ' + fmt(discount);
    document.getElementById('pdv-total').textContent = fmt(total);
    document.getElementById('checkout-final-total').textContent = fmt(total);
    
    updateChange();
}

function updateChange() {
    const total = pdvItems.reduce((acc, item) => acc + item.subtotal, 0) - (parseFloat(document.getElementById('pdv-global-discount').value) || 0);
    const received = parseFloat(document.getElementById('pdv-amount-received').value) || 0;
    const change = received - total;
    
    document.getElementById('pdv-change').value = change > 0 ? fmt(change) : 'R$ 0,00';
}

// ============================================================
// CHECKOUT & SYNC
// ============================================================

function openCheckoutModal() {
    if (pdvItems.length === 0) {
        alert('Adicione pelo menos um item para finalizar!');
        return;
    }
    if (!selectedCustomer) {
        alert('Por favor, identifique o cliente antes de finalizar a venda.');
        document.getElementById('pdv-cust-search').focus();
        return;
    }
    document.getElementById('modal-checkout').classList.remove('hidden');
    document.getElementById('pdv-amount-received').focus();
}

function closeCheckoutModal() {
    document.getElementById('modal-checkout').classList.add('hidden');
}

async function finishSale() {
    if (!confirm('Confirmar finalização de venda?')) return;

    const total = pdvItems.reduce((acc, item) => acc + item.subtotal, 0) - (parseFloat(document.getElementById('pdv-global-discount').value) || 0);
    const paymentMethod = document.getElementById('pdv-payment-method').value;

    try {
        // 1. Create Order in Supabase
        const orderData = {
            client_name: selectedCustomer ? selectedCustomer.name : 'Consumidor Final',
            client_email: selectedCustomer ? selectedCustomer.email : 'venda_pdv@ecostore.com',
            total: total,
            status: 'concluido',
            status_label: 'Concluído',
            payment_method: 'PDV - ' + paymentMethod,
            items: pdvItems.map(i => ({
                id: i.id,
                name: i.name,
                qty: i.qty,
                price: i.price
            })),
            address: 'Compra Presencial'
        };

        const { data: order, error } = await supabase.from('orders').insert([orderData]).select().single();

        if (error) {
            console.error('Erro detalhado do Supabase:', error);
            throw error;
        }

        // 2. Update Stock
        for (const item of pdvItems) {
            const prod = allProducts.find(p => p.id === item.id);
            if (prod) {
                const newStock = (prod.stock || 0) - item.qty;
                await supabase.from('products').update({ stock: newStock }).eq('id', item.id);
            }
        }

        alert('Venda finalizada com sucesso! Pedido #' + order.id);
        clearPDV();
        closeCheckoutModal();
        await loadInitialData(); // Reload for stock consistency

    } catch (e) {
        console.error('Erro ao finalizar venda:', e);
        alert('Erro técnico ao salvar venda.');
    }
}

function clearPDV() {
    pdvItems = [];
    removeSelectedCustomer();
    document.getElementById('pdv-items-body').innerHTML = '';
    document.getElementById('pdv-global-discount').value = '0.00';
    document.getElementById('pdv-amount-received').value = '';
    document.getElementById('pdv-cust-search').value = '';
    renderItems();
}

function fmt(v) {
    return 'R$ ' + (isNaN(v) ? '0.00' : parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}
