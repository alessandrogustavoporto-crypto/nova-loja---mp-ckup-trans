// ============================================================
// DIAGNÓSTICO: Pedido 106 + Estado do Estoque
// Execute com: node diagnostico_pedido106.js
// ============================================================

const SUPABASE_URL = 'https://kakeytwbtnwbkofintuh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtha2V5dHdidG53YmtvZmludHVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODM3NjYsImV4cCI6MjA5MzE1OTc2Nn0.6mDIto6yuhcFDm7R-QKR3M3IcgeMdCykDkNUH8MFc5M';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
};

async function fetchJSON(url) {
    const res = await fetch(url, { headers });
    return res.json();
}

async function main() {
    console.log('=== DIAGNÓSTICO DO PEDIDO 106 ===\n');

    // 1. Busca o pedido 106
    const orders = await fetchJSON(SUPABASE_URL + '/rest/v1/orders?id=eq.106&select=id,status,status_label,items');
    if (!orders || orders.length === 0) {
        console.log('❌ PEDIDO 106 NÃO ENCONTRADO NO BANCO!');
        return;
    }

    const order = orders[0];
    console.log('📦 PEDIDO 106:');
    console.log('   Status:', order.status);
    console.log('   Status Label:', order.status_label);
    console.log('   Items (raw):', JSON.stringify(order.items, null, 2));
    console.log('');

    const items = order.items || [];

    if (items.length === 0) {
        console.log('⚠️  PROBLEMA ENCONTRADO: items está VAZIO ou NULL!');
        console.log('   → O campo items não foi salvo corretamente neste pedido.');
        return;
    }

    console.log(`✅ Items encontrados: ${items.length} item(s)\n`);

    // 2. Verifica o estoque de cada produto nos items
    console.log('=== ESTADO ATUAL DO ESTOQUE DOS PRODUTOS ===\n');
    for (const item of items) {
        console.log(`Produto: "${item.name}" (id: ${item.id}) | qty no pedido: ${item.qty}`);

        if (!item.id) {
            console.log('   ⚠️  PROBLEMA: item sem campo "id"!');
            console.log('   → Estrutura do item:', JSON.stringify(item));
            continue;
        }

        const products = await fetchJSON(SUPABASE_URL + '/rest/v1/products?id=eq.' + item.id + '&select=id,name,stock');
        if (!products || products.length === 0) {
            console.log('   ❌ Produto id=' + item.id + ' NÃO ENCONTRADO no banco (foi excluído?)');
            continue;
        }

        const prod = products[0];
        console.log(`   Estoque atual no banco: ${prod.stock}`);
        console.log(`   Estoque esperado após restauração: ${prod.stock + item.qty}`);
        console.log('');
    }

    // 3. Testa se consegue fazer UPDATE em products (RLS check)
    console.log('=== TESTE DE PERMISSÃO DE UPDATE EM PRODUCTS ===\n');
    if (items.length > 0 && items[0].id) {
        const testProdId = items[0].id;
        const testProducts = await fetchJSON(SUPABASE_URL + '/rest/v1/products?id=eq.' + testProdId + '&select=id,stock');
        if (testProducts && testProducts.length > 0) {
            const currentStock = testProducts[0].stock;
            // Tenta atualizar com o mesmo valor (sem alterar nada de fato)
            const updateRes = await fetch(SUPABASE_URL + '/rest/v1/products?id=eq.' + testProdId, {
                method: 'PATCH',
                headers: { ...headers, 'Prefer': 'return=representation' },
                body: JSON.stringify({ stock: currentStock })
            });
            const updateBody = await updateRes.json();
            if (updateRes.ok) {
                console.log('✅ UPDATE em products funcionou! (RLS ok)');
                console.log('   Resposta:', JSON.stringify(updateBody).substring(0, 100));
            } else {
                console.log('❌ UPDATE em products BLOQUEADO!');
                console.log('   Status HTTP:', updateRes.status);
                console.log('   Resposta:', JSON.stringify(updateBody));
                console.log('   → Problema de RLS (Row Level Security) no Supabase!');
            }
        }
    }
}

main().catch(console.error);
