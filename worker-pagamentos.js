const SUPABASE_URL = 'https://kakeytwbtnwbkofintuh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtha2V5dHdidG53YmtvZmludHVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODM3NjYsImV4cCI6MjA5MzE1OTc2Nn0.6mDIto6yuhcFDm7R-QKR3M3IcgeMdCykDkNUH8MFc5M';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = { 
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Methods': 'POST, OPTIONS, GET', 
        'Access-Control-Allow-Headers': 'Content-Type' 
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    // --- WEBHOOK: RECEBENDO ATUALIZAÇÃO DE PAGAMENTO ---
    if (url.pathname.includes('/webhook')) {
      try {
        const topic = url.searchParams.get('topic') || url.searchParams.get('type');
        let id = url.searchParams.get('id') || url.searchParams.get('data.id');

        if (id && (topic === 'payment' || topic === 'payment_updated')) {
          const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { 
            headers: { 'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}` } 
          });
          const d = await r.json();
          
          if (d.status === 'approved') {
            const ref = d.external_reference;
            const cleanId = ref ? ref.replace('#', '').replace(/^0+/, '') : null;
            
            await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${cleanId}`, {
              method: 'PATCH',
              headers: { 
                'apikey': SUPABASE_KEY, 
                'Authorization': `Bearer ${SUPABASE_KEY}`, 
                'Content-Type': 'application/json' 
              },
              body: JSON.stringify({ status: 'separacao', status_label: 'Em Separação' })
            });
          }
        }
        return new Response('OK', { headers: corsHeaders });
      } catch (e) { 
        return new Response('OK', { headers: corsHeaders }); 
      }
    }

    // --- CHECKOUT TRANSPARENTE: PROCESSANDO PAGAMENTO ---
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        
        // Se houver token, é cartão. Se não e for pix, é pix.
        const paymentData = {
          transaction_amount: body.transaction_amount,
          description: body.description || 'Compra OTMake10',
          payment_method_id: body.payment_method_id,
          payer: {
            email: body.payer.email,
            identification: body.payer.identification
          },
          external_reference: body.external_reference,
          notification_url: `https://api-pagamentos.alessandrogustavoporto.workers.dev/webhook`
        };

        if (body.token) {
            paymentData.token = body.token;
            paymentData.installments = body.installments;
            paymentData.issuer_id = body.issuer_id;
        }

        const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}`, 
            'Content-Type': 'application/json',
            'X-Idempotency-Key': Date.now().toString()
          },
          body: JSON.stringify(paymentData)
        });

        const d = await mpRes.json();
        return new Response(JSON.stringify(d), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: mpRes.status
        });

      } catch (err) { 
        return new Response(JSON.stringify({ error: err.message }), { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }); 
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};
