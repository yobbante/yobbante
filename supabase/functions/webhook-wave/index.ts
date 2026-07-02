// webhook-wave — reçoit les notifications de paiement Wave
// Secret requis : WAVE_WEBHOOK_SECRET (header Wave-Signature)
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, wave-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_PHONE = '+221784604003';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const raw = await req.text();
  const sig = req.headers.get('wave-signature') || req.headers.get('Wave-Signature') || '';
  const secret = Deno.env.get('WAVE_WEBHOOK_SECRET');

  if (!secret) {
    console.error('WAVE_WEBHOOK_SECRET missing — refusing webhook (fail closed)');
    return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const ok = await verifyWaveSignature(raw, sig, secret);
  if (!ok) {
    console.error('WAVE_WEBHOOK invalid signature');
    return new Response('invalid signature', { status: 401, headers: corsHeaders });
  }


  let evt: any;
  try { evt = JSON.parse(raw); } catch { return new Response('bad json', { status: 400, headers: corsHeaders }); }

  if (evt?.type !== 'checkout.session.completed') {
    return new Response('ignored', { status: 200, headers: corsHeaders });
  }

  const session = evt.data ?? {};
  const trackingId = session.client_reference;
  if (!trackingId) return new Response('missing ref', { status: 400, headers: corsHeaders });

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  await markPaidAndNotify(supa, trackingId, 'wave', session.id ?? null);
  return new Response('ok', { status: 200, headers: corsHeaders });
});

async function verifyWaveSignature(raw: string, header: string, secret: string): Promise<boolean> {
  try {
    // Wave format: "t=...,v1=..."
    const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
    const t = parts.t, v1 = parts.v1;
    if (!t || !v1) return false;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${raw}`));
    const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');
    return hex === v1;
  } catch { return false; }
}

async function markPaidAndNotify(supa: any, trackingId: string, method: string, providerRef: string | null) {
  const { data: dossier } = await supa
    .from('dossiers')
    .select('id, tracking_id, reference, final_amount_xof, user_id, contact_phone, buyer_name')
    .or(`tracking_id.eq.${trackingId},reference.eq.${trackingId}`)
    .maybeSingle();
  if (!dossier) { console.error('webhook: dossier introuvable', trackingId); return; }

  await supa.from('dossiers').update({
    payment_status: 'paid',
    payment_method: method,
    payment_provider_ref: providerRef,
    paid_at: new Date().toISOString(),
  }).eq('id', dossier.id);

  const amount = dossier.final_amount_xof ?? 0;
  const ref = dossier.tracking_id || dossier.reference;

  // Notif client
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
    await invokeWa(supa, {
      recipient_type: 'client', recipient_phone: phone,
      template_name: 'payment_confirmation',
      template_params: [prenom, ref, `${amount.toLocaleString('fr-FR')} XOF`, method === 'wave' ? 'Wave' : 'Orange Money'],
      dossier_id: dossier.id, trigger_type: `payment_${method}_webhook`,
    });
  }

  // Notif admin
  await invokeWa(supa, {
    recipient_type: 'admin', recipient_phone: ADMIN_PHONE,
    message: `Paiement ${method === 'wave' ? 'Wave' : 'Orange Money'} recu : ${ref} - ${amount.toLocaleString('fr-FR')} XOF`,
    dossier_id: dossier.id, trigger_type: `payment_${method}_admin_notice`,
  });
}

async function invokeWa(supa: any, payload: any) {
  try {
    await supa.functions.invoke('send-whatsapp', { body: payload });
  } catch (e) { console.error('send-whatsapp failed', e); }
}
