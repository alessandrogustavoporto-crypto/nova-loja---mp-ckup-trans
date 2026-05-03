const SUPABASE_URL = 'https://kakeytwbtnwbkofintuh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtha2V5dHdidG53YmtvZmludHVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODM3NjYsImV4cCI6MjA5MzE1OTc2Nn0.6mDIto6yuhcFDm7R-QKR3M3IcgeMdCykDkNUH8MFc5M';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS, GET', 'Access-Control-Allow-Headers': 'Content-Type' };

    // --- LOG DE ENTRADA ---
    console.log(`Chamada recebida: ${request.method} em ${url.pathname}`);

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    // --- WEBHOOK: RECEBENDO PAGAMENTO ---
    if (url.pathname.includes('/webhook')) {
      try {
        console.log('--- ENTROU NO WEBHOOK ---');
        const topic = url.searchParams.get('topic') || url.searchParams.get('type');
        let id = url.searchParams.get('id') || url.searchParams.get('data.id');

        // SÓ PROCESSA SE FOR 'PAYMENT' (Garante segurança e evita duplicados)
        if (id && topic === 'payment') {
          console.log(`--- PAGAMENTO RECEBIDO ID: ${id} ---`);
          
          const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { 
            headers: { 'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}` } 
          });
          const d = await r.json();
          
          const status = d.status; // 'approved', 'pending', etc.
          const ref = d.external_reference;

          console.log(`STATUS REAL DO MP: ${status} | PEDIDO: ${ref}`);

          // SÓ ATUALIZA SE ESTIVER REALMENTE APROVADO
          if (status === 'approved') {
            const cleanId = ref ? ref.replace('#', '').replace(/^0+/, '') : null;
            console.log(`Liberando pedido ${cleanId} no Supabase...`);
            
            const suba = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${cleanId}`, {
              method: 'PATCH',
              headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'separacao', status_label: 'Em Separação' })
            });
            console.log(`PEDIDO LIBERADO COM SUCESSO! Status Supabase: ${suba.status}`);
          }
        }
        return new Response('OK', { headers: corsHeaders });
      } catch (e) { 
        console.log(`ERRO: ${e.message}`);
        return new Response('OK', { headers: corsHeaders }); 
      }
    }

    // --- CHECKOUT: GERANDO LINK ---
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        const pref = {
          items: body.items.map(i => ({ title: i.name, quantity: i.qty, unit_price: i.price, currency_id: 'BRL' })),
          external_reference: body.orderId.toString(),
          payer: { email: body.payer?.email || 'cliente@email.com' },
          back_urls: { 
            success: 'https://alessandrogustavoporto-crypto.github.io/loja-nova/index.html',
            pending: 'https://alessandrogustavoporto-crypto.github.io/loja-nova/index.html',
            failure: 'https://alessandrogustavoporto-crypto.github.io/loja-nova/index.html'
          },
          auto_return: 'approved',
          notification_url: `https://api-pagamentos.alessandrogustavoporto.workers.dev/webhook`
        };
        const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(pref)
        });
        const d = await mpRes.json();
        return new Response(JSON.stringify({ initPoint: d.init_point }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (err) { 
        console.log('ERRO NA CRIAÇÃO:', err.message);
        return new Response(err.message, { status: 500, headers: corsHeaders }); 
      }
    }
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};
