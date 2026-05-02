export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    // Extrai os itens do carrinho e o ID do pedido
    const { items, orderId, payer } = body;

    // Converte os itens do nosso carrinho para o formato do Mercado Pago
    const mpItems = items.map(item => ({
      id: String(item.id),
      title: item.title,
      description: item.subtitle || 'Produto EcoStore',
      picture_url: item.image,
      quantity: Number(item.quantity),
      currency_id: "BRL",
      unit_price: Number(item.price)
    }));

    // Cria a preferência de pagamento (Preference) chamando a API do Mercado Pago
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.MP_ACCESS_TOKEN}`, // A chave virá das variáveis de ambiente do Cloudflare
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items: mpItems,
        payer: {
          email: payer?.email || "cliente@email.com",
          name: payer?.name?.split(' ')[0] || "Cliente"
        },
        back_urls: {
          success: new URL(request.url).origin + "/minha-conta.html",
          failure: new URL(request.url).origin + "/checkout.html",
          pending: new URL(request.url).origin + "/minha-conta.html"
        },
        auto_return: "approved",
        external_reference: orderId, // Nosso ID do pedido (ex: #00001) para conciliação futura
        statement_descriptor: "ECOSTORE"
      })
    });

    const mpData = await response.json();

    if (!response.ok) {
      console.error("Erro do Mercado Pago:", mpData);
      return new Response(JSON.stringify({ error: "Erro ao gerar pagamento no Mercado Pago", details: mpData }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Retorna o ID da preferência gerada para o frontend
    return new Response(JSON.stringify({ preferenceId: mpData.id }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
