// webhook-orange-money — notifications de paiement Orange Money
// Secret requis : OM_WEBHOOK_TOKEN (vérifié dans le header Authorization)
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_PHONE = '+221784604003';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const expected = Deno.env.get('OM_WEBHOOK_TOKEN');
  if (!expected) {
    console.error('OM_WEBHOOK_TOKEN missing — refusing webhook (fail closed)');
    return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const auth = req.headers.get('authorization') || '';
  if (auth.replace(/^Bearer\s+/i, '') !== expected) {
    return new Response('unauthorized', { status: 401, headers: corsHeaders });
  }


  let evt: any;
  try { evt = await req.json(); } catch { return new Response('bad json', { status: 400, headers: corsHeaders }); }

  const status = String(evt?.status ?? '').toUpperCase();
  if (status !== 'SUCCESS' && status !== 'SUCCESSFUL' && status !== 'COMPLETED') {
    return new Response('ignored', { status: 200, headers: corsHeaders });
  }

  const trackingId = evt.reference || evt.order_id;
  if (!trackingId) return new Response('missing ref', { status: 400, headers: corsHeaders });

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data: dossier } = await supa
    .from('dossiers')
    .select('id, tracking_id, reference, final_amount_xof, user_id, contact_phone, buyer_name')
    .or(`tracking_id.eq.${trackingId},reference.eq.${trackingId}`)
    .maybeSingle();
  if (!dossier) return new Response('not found', { status: 404, headers: corsHeaders });

  await supa.from('dossiers').update({
    payment_status: 'paid',
    payment_method: 'orange_money',
    payment_provider_ref: evt.pay_token ?? evt.txnid ?? null,
    paid_at: new Date().toISOString(),
  }).eq('id', dossier.id);

  const amount = dossier.final_amount_xof ?? 0;
  const ref = dossier.tracking_id || dossier.reference;
  let prenom = 'Client';
  let phone: string | null = dossier.contact_phone ?? null;
  if (dossier.user_id) {
    const { data: prof } = await supa.from('profiles')
      .select('full_name, phone').eq('user_id', dossier.user_id).maybeSingle();
    if (prof?.full_name) prenom = String(prof.full_name).split(' ')[0];
    if (!phone && prof?.phone) phone = prof.phone;
  }
  if (!prenom && dossier.buyer_name) prenom = String(dossier.buyer_name).split(' ')[0];

  if (phone) {
    await supa.functions.invoke('send-whatsapp', { body: {
      recipient_type: 'client', recipient_phone: phone,
      template_name: 'payment_confirmation',
      template_params: [prenom, ref, `${amount.toLocaleString('fr-FR')} XOF`, 'Orange Money'],
      dossier_id: dossier.id, trigger_type: 'payment_om_webhook',
    }}).catch(console.error);
  }

  await supa.functions.invoke('send-whatsapp', { body: {
    recipient_type: 'admin', recipient_phone: ADMIN_PHONE,
    message: `Paiement Orange Money recu : ${ref} - ${amount.toLocaleString('fr-FR')} XOF`,
    dossier_id: dossier.id, trigger_type: 'payment_om_admin_notice',
  }}).catch(console.error);

  return new Response('ok', { status: 200, headers: corsHeaders });
});
