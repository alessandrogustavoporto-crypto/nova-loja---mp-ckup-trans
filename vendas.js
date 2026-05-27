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

// Barcode scanner detection
let barcodeBuffer = '';
let barcodeLastKeyTime = 0;
const BARCODE_SPEED_THRESHOLD = 50; // ms entre teclas — leitores são < 50ms
const BARCODE_MIN_LENGTH = 8;       // EAN-8 mínimo

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

    // Detecção de leitor de código de barras via velocidade de digitação
    prodSearch.addEventListener('keydown', (e) => {
        const now = Date.now();
        const delta = now - barcodeLastKeyTime;
        barcodeLastKeyTime = now;

        // Ignora teclas de controle no buffer
        if (e.key.length === 1) {
            if (delta < BARCODE_SPEED_THRESHOLD) {
                barcodeBuffer += e.key;
            } else {
                // Nova sequência de digitação (humana) — reseta buffer
                barcodeBuffer = e.key;
            }
        }

        // Enter: verifica se veio de leitor (buffer longo e rápido)
        if (e.key === 'Enter') {
            const query = prodSearch.value.trim();
            const exactMatch = allProducts.find(p => p.barcode === query);

            if (exactMatch) {
                // Código de barras exato — insere automaticamente
                e.preventDefault();
                const qty = parseInt(document.getElementById('pdv-prod-qty').value) || 1;
                addItem(exactMatch, qty, NaN);
                prodSearch.value = '';
                document.getElementById('pdv-prod-qty').value = '1';
                document.getElementById('prod-suggestions').classList.add('hidden');
                barcodeBuffer = '';
                showBarcodeFlash(exactMatch.name);
                return;
            }

            // Sem correspondência exata — tenta busca normal
            addItemFromSearch();
            barcodeBuffer = '';
        }
    });

    // Busca em tempo real de produtos (sem auto-insert — apenas sugestões)
    prodSearch.addEventListener('input', (e) => {
        const query = e.target.value;
        const now = Date.now();
        const delta = now - barcodeLastKeyTime;

        // Se digitação for rápida demais (leitor), só mostra sugestões se não houver match exato
        if (delta < BARCODE_SPEED_THRESHOLD && query.length >= BARCODE_MIN_LENGTH) {
            const exactMatch = allProducts.find(p => p.barcode === query);
            if (exactMatch) {
                // Leitor completou o código — insere diretamente (sem precisar de Enter)
                const qty = parseInt(document.getElementById('pdv-prod-qty').value) || 1;
                addItem(exactMatch, qty, NaN);
                prodSearch.value = '';
                document.getElementById('pdv-prod-qty').value = '1';
                document.getElementById('prod-suggestions').classList.add('hidden');
                barcodeBuffer = '';
                showBarcodeFlash(exactMatch.name);
                return;
            }
            // Código ainda incompleto — esconde sugestões durante scan
            document.getElementById('prod-suggestions').classList.add('hidden');
            return;
        }

        showProductSuggestions(query);
    });

    // Add item via botão
    const otherInputs = ['pdv-prod-qty', 'pdv-prod-price'];
    otherInputs.forEach(id => {
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
    document.getElementById('pdv-discount-type').addEventListener('change', renderTotals);
    document.getElementById('pdv-global-addition').addEventListener('input', renderTotals);

    // Customer search
    document.getElementById('pdv-cust-search').addEventListener('input', (e) => searchCustomer(e.target.value));
}

// Flash visual ao inserir via código de barras
function showBarcodeFlash(productName) {
    let flash = document.getElementById('barcode-flash');
    if (!flash) {
        flash = document.createElement('div');
        flash.id = 'barcode-flash';
        flash.style.cssText = `
            position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
            background: #27ae60; color: white; padding: 12px 28px;
            border-radius: 8px; font-size: 15px; font-weight: 700;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 9999;
            display: flex; align-items: center; gap: 10px;
            animation: fadeInDown 0.2s ease;
        `;
        document.body.appendChild(flash);
    }
    flash.innerHTML = `<i class="fas fa-barcode"></i> ${productName} adicionado!`;
    flash.style.display = 'flex';
    clearTimeout(flash._timer);
    flash._timer = setTimeout(() => { flash.style.display = 'none'; }, 1800);
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

    // Se for código de barras exato, não abre lista (já foi ou será inserido automaticamente)
    const exactMatch = allProducts.find(p => p.barcode === query);
    if (exactMatch && query.length >= BARCODE_MIN_LENGTH) {
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
    const email = document.getElementById('new-cust-email').value.trim() || `pdv_${Date.now()}@otmake10.com`;
    const phone = document.getElementById('new-cust-phone').value.trim();

    if (!name) { alert('O nome é obrigatório!'); return; }

    try {
        const { data, error } = await supabase.from('customers').insert([{
            name, cpf, email, phone
        }]).select().single();

        if (error) throw error;

        alert('Cliente cadastrado com sucesso!');
        await loadInitialData(); // Refresh list
        window.selectCustomer(data.id);
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

function calculateTotal() {
    const subtotal = pdvItems.reduce((acc, item) => acc + item.subtotal, 0);
    const discVal = parseFloat(document.getElementById('pdv-global-discount').value) || 0;
    const discType = document.getElementById('pdv-discount-type').value;
    const additionAmount = Math.max(0, parseFloat(document.getElementById('pdv-global-addition').value) || 0);

    let discountAmount = 0;
    if (discType === 'pct') {
        discountAmount = subtotal * (discVal / 100);
    } else {
        discountAmount = discVal;
    }

    return {
        subtotal,
        discountAmount,
        additionAmount,
        total: Math.max(0, subtotal - discountAmount + additionAmount)
    };
}

function renderTotals() {
    const { subtotal, discountAmount, additionAmount, total } = calculateTotal();

    const elSubtotal    = document.getElementById('pdv-subtotal');
    const elDiscounts   = document.getElementById('pdv-discounts');
    const elAdditions   = document.getElementById('pdv-additions');
    const elTotal       = document.getElementById('pdv-total');
    const elCheckout    = document.getElementById('checkout-final-total');

    if (elSubtotal)  elSubtotal.textContent  = fmt(subtotal);
    if (elDiscounts) elDiscounts.textContent = '- ' + fmt(discountAmount);
    if (elAdditions) elAdditions.textContent = additionAmount > 0 ? '+ ' + fmt(additionAmount) : fmt(0);
    if (elTotal)     elTotal.textContent     = fmt(total);
    if (elCheckout)  elCheckout.textContent  = fmt(total);

    updateChange();
}

function updateChange() {
    const { total } = calculateTotal();
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

    const { subtotal, discountAmount, additionAmount, total } = calculateTotal();
    const paymentMethod = document.getElementById('pdv-payment-method').value;
    const received = parseFloat(document.getElementById('pdv-amount-received').value) || 0;

    if (paymentMethod === 'dinheiro' && received < total) {
        alert('Para vendas em DINHEIRO, o valor recebido deve ser igual ou maior que o total da venda!');
        document.getElementById('pdv-amount-received').focus();
        return;
    }

    try {
        // 1. Create Order in Supabase
        const orderData = {
            client_name: selectedCustomer ? selectedCustomer.name : 'Consumidor Final',
            client_email: selectedCustomer ? selectedCustomer.email : 'venda_pdv@otmake10.com',
            total: total,
            discount_amount: discountAmount,
            addition_amount: additionAmount,
            status: 'entregue',
            status_label: 'Entregue',
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
    document.getElementById('pdv-global-addition').value = '0.00';
    document.getElementById('pdv-amount-received').value = '';
    document.getElementById('pdv-cust-search').value = '';
    renderItems();
}

function fmt(v) {
    return 'R$ ' + (isNaN(v) ? '0.00' : parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}
