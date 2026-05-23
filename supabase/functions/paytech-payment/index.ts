// paytech-payment — Initiate PayTech checkout (Wave + OM + CB)
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

  let body: { tracking_id?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const trackingId = (body.tracking_id ?? '').trim();
  if (!trackingId) {
    return new Response(JSON.stringify({ error: 'tracking_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supa = createClient(SB_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: dossier, error: dErr } = await supa
    .from('dossiers')
    .select('id, tracking_id, reference, payment_status, final_amount_xof, estimated_cost')
    .or(`tracking_id.eq.${trackingId},reference.eq.${trackingId}`)
    .maybeSingle();

  if (dErr || !dossier) {
    return new Response(JSON.stringify({ error: 'dossier_not_found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (dossier.payment_status === 'paid') {
    return new Response(JSON.stringify({ error: 'already_paid' }), {
      status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const amount = dossier.final_amount_xof
    ?? (dossier.estimated_cost ? Math.round(Number(dossier.estimated_cost) * 655.957) : 0);
  if (!amount || amount <= 0) {
    return new Response(JSON.stringify({ error: 'invalid_amount' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const refCommand = `YOB-PAY-${dossier.tracking_id ?? dossier.reference}-${Date.now()}`;

  const params = new URLSearchParams({
    item_name: `Expédition Yobbanté ${dossier.tracking_id ?? dossier.reference}`,
    item_price: String(amount),
    currency: 'XOF',
    ref_command: refCommand,
    command_name: `Paiement colis ${dossier.tracking_id ?? dossier.reference}`,
    env: PAYTECH_ENV,
    ipn_url: `${SB_URL}/functions/v1/paytech-webhook`,
    success_url: `https://yobbante.com/pay/${dossier.tracking_id ?? dossier.reference}?success=1`,
    cancel_url: `https://yobbante.com/pay/${dossier.tracking_id ?? dossier.reference}?cancel=1`,
    custom_field: JSON.stringify({ dossier_id: dossier.id, tracking_id: dossier.tracking_id }),
  });

  try {
    const ptRes = await fetch('https://paytech.sn/api/payment/request-payment', {
      method: 'POST',
      headers: {
        API_KEY,
        API_SECRET,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const pt = await ptRes.json().catch(() => ({}));
    console.log('paytech-payment response', pt);

    if (!ptRes.ok || pt?.success !== 1 || !pt?.redirect_url) {
      return new Response(JSON.stringify({ error: 'paytech_request_failed', detail: pt }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supa.from('dossiers').update({
      payment_provider_ref: pt.token ?? null,
      payment_external_id: refCommand,
      payment_method: 'paytech',
    }).eq('id', dossier.id);

    return new Response(JSON.stringify({ redirect_url: pt.redirect_url, token: pt.token }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('paytech-payment error', e);
    return new Response(JSON.stringify({ error: 'paytech_request_error', message: (e as Error).message }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
