// dekk-payment — Initie un paiement PayTech pour une commande boutique Dëkk
// (Wave, Orange Money, carte bancaire). Le paiement à la livraison ne passe
// pas par ici.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEKK_ORIGIN = 'https://dekk.yobbante.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const API_KEY = Deno.env.get('PAYTECH_API_KEY');
  const API_SECRET = Deno.env.get('PAYTECH_API_SECRET');
  const PAYTECH_ENV = (Deno.env.get('PAYTECH_ENV') ?? 'test').toLowerCase();
  const SB_URL = Deno.env.get('SUPABASE_URL')!;

  if (!API_KEY || !API_SECRET) {
    return new Response(JSON.stringify({ available: false, reason: 'paytech_not_configured' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { reference?: string; origin?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const reference = (body.reference ?? '').trim();
  if (!reference || reference.length > 64 || !/^[A-Za-z0-9_-]+$/.test(reference)) {
    return new Response(JSON.stringify({ error: 'invalid_reference' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const origin = /^https:\/\/[a-z0-9.-]+\.(yobbante\.com|lovable\.app)$/i.test(body.origin ?? '')
    ? body.origin!
    : DEKK_ORIGIN;

  const supa = createClient(SB_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: order, error } = await supa
    .from('dekk_orders')
    .select('id, reference, total_fcfa, payment_status, payment_method')
    .eq('reference', reference)
    .maybeSingle();

  if (error || !order) {
    return new Response(JSON.stringify({ error: 'order_not_found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (order.payment_status === 'paid') {
    return new Response(JSON.stringify({ error: 'already_paid' }), {
      status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const amount = Math.round(Number(order.total_fcfa ?? 0));
  if (!amount || amount <= 0) {
    return new Response(JSON.stringify({ error: 'invalid_amount' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const refCommand = `DEKK-PAY-${order.reference}-${Date.now()}`;

  const params = new URLSearchParams({
    item_name: `Commande Dëkk ${order.reference}`,
    item_price: String(amount),
    currency: 'XOF',
    ref_command: refCommand,
    command_name: `Commande Dëkk ${order.reference}`,
    env: PAYTECH_ENV,
    ipn_url: `${SB_URL}/functions/v1/paytech-webhook`,
    success_url: `${origin}/panier/paiement/${order.reference}?success=1`,
    cancel_url: `${origin}/panier/paiement/${order.reference}?cancel=1`,
    custom_field: JSON.stringify({ order_id: order.id, reference: order.reference }),
  });

  try {
    const ptRes = await fetch('https://paytech.sn/api/payment/request-payment', {
      method: 'POST',
      headers: { API_KEY, API_SECRET, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const pt = await ptRes.json().catch(() => ({}));
    console.log('dekk-payment paytech response', JSON.stringify(pt));

    if (!ptRes.ok || pt?.success !== 1 || !pt?.redirect_url) {
      return new Response(JSON.stringify({ error: 'paytech_request_failed', status: ptRes.status, detail: pt }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supa.from('dekk_orders').update({
      payment_external_id: refCommand,
      payment_provider_ref: pt.token ?? null,
      payment_status: 'pending',
      status: 'pending',
    }).eq('id', order.id);

    return new Response(JSON.stringify({ redirect_url: pt.redirect_url, token: pt.token }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('dekk-payment error', e);
    return new Response(JSON.stringify({ error: 'paytech_request_error', message: (e as Error).message }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
