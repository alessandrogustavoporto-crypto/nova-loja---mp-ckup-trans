// ============================================================
// PDV - PONTO DE VENDA | CORE LOGIC
// ============================================================

let pdvItems = [];
let allProducts = [];
let allCustomers = [];
let selectedCustomer = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
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

    // Add item on Enter in search
    prodSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItemFromSearch();
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
// ITEM MANAGEMENT
// ============================================================

function addItemFromSearch() {
    const query = document.getElementById('pdv-prod-search').value.trim();
    const qty = parseInt(document.getElementById('pdv-prod-qty').value) || 1;
    const priceOverride = parseFloat(document.getElementById('pdv-prod-price').value);

    if (!query) return;

    const product = allProducts.find(p => 
        p.barcode === query || 
        p.id.toString() === query || 
        p.name.toLowerCase().includes(query.toLowerCase())
    );

    if (product) {
        addItem(product, qty, priceOverride);
        // Reset inputs
        document.getElementById('pdv-prod-search').value = '';
        document.getElementById('pdv-prod-qty').value = '1';
        document.getElementById('pdv-prod-price').value = '';
        document.getElementById('pdv-prod-search').focus();
    } else {
        alert('Produto não encontrado!');
    }
}

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
                <td style="text-align:right;">
                    <i class="fas fa-times-circle btn-icon-remove" onclick="removeItem(${index})"></i>
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
    if (query.length < 3) return;
    const cust = allCustomers.find(c => 
        (c.cpf && c.cpf.includes(query)) || 
        (c.name && c.name.toLowerCase().includes(query.toLowerCase())) ||
        (c.email && c.email.toLowerCase().includes(query.toLowerCase()))
    );

    if (cust) {
        selectedCustomer = cust;
        document.getElementById('selected-customer-info').classList.remove('hidden');
        document.getElementById('selected-cust-name').textContent = cust.name || cust.email;
    }
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
            clientName: selectedCustomer ? selectedCustomer.name : 'Consumidor Final',
            clientEmail: selectedCustomer ? selectedCustomer.email : 'venda_pdv@ecostore.com',
            total: total,
            status: 'concluido', // Venda local ja sai concluida
            date: new Date().toLocaleDateString('pt-BR'),
            paymentMethod: 'PDV - ' + paymentMethod,
            items: JSON.stringify(pdvItems.map(i => ({
                id: i.id,
                name: i.name,
                qty: i.qty,
                price: i.price
            })))
        };

        const { data: order, error } = await supabase.from('orders').insert([orderData]).select().single();

        if (error) throw error;

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
    selectedCustomer = null;
    document.getElementById('pdv-items-body').innerHTML = '';
    document.getElementById('pdv-global-discount').value = '0.00';
    document.getElementById('pdv-amount-received').value = '';
    document.getElementById('pdv-cust-search').value = '';
    document.getElementById('selected-customer-info').classList.add('hidden');
    renderItems();
}

function fmt(v) {
    return 'R$ ' + (isNaN(v) ? '0.00' : parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}
