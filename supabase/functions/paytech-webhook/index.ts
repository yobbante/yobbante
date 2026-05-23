// paytech-webhook — IPN PayTech (sale_complete / sale_canceled)
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_PHONE = Deno.env.get('ADMIN_WHATSAPP_NUMBER') ?? '+221784604003';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Always answer 200 to PayTech, log failures inside.
  const SB_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supa = createClient(SB_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let payload: Record<string, string> = {};
  try {
    const ctype = req.headers.get('content-type') ?? '';
    if (ctype.includes('application/json')) {
      payload = await req.json();
    } else {
      const form = await req.formData();
      form.forEach((v, k) => { payload[k] = String(v); });
    }
  } catch (e) {
    console.error('paytech-webhook parse error', e);
  }

  console.log('paytech-webhook payload', payload);

  const typeEvent = (payload.type_event ?? '').toLowerCase();
  const refCommand = payload.ref_command ?? '';
  const amount = payload.item_price ?? '';

  // Extract tracking_id from ref_command: YOB-PAY-{tracking}-{ts}
  let trackingId = '';
  const m = refCommand.match(/^YOB-PAY-(.+)-(\d+)$/);
  if (m) trackingId = m[1];

  if (!trackingId) {
    console.warn('paytech-webhook: cannot extract tracking_id from', refCommand);
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  const { data: dossier } = await supa
    .from('dossiers')
    .select('id, tracking_id, reference, payment_status, recipient_phone, sender_phone, final_amount_xof')
    .or(`tracking_id.eq.${trackingId},reference.eq.${trackingId}`)
    .maybeSingle();

  if (!dossier) {
    console.warn('paytech-webhook: dossier not found for', trackingId);
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  async function sendWa(payload: Record<string, unknown>) {
    try {
      await fetch(`${SB_URL}/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify(payload),
      });
    } catch (e) { console.error('sendWa err', e); }
  }

  if (typeEvent === 'sale_complete') {
    if (dossier.payment_status !== 'paid') {
      await supa.from('dossiers').update({
        payment_status: 'paid',
        payment_method: 'paytech',
        paid_at: new Date().toISOString(),
        payment_external_id: refCommand,
      }).eq('id', dossier.id);
    }

    // Notify client
    const clientPhone = dossier.recipient_phone || dossier.sender_phone;
    if (clientPhone) {
      await sendWa({
        recipient_type: 'client',
        recipient_phone: clientPhone,
        template_name: 'payment_confirmation',
        template_params: [dossier.tracking_id ?? dossier.reference, amount],
        message: `✅ Paiement reçu pour ${dossier.tracking_id ?? dossier.reference} (${amount} XOF).\nVotre colis prend la route.`,
        dossier_id: dossier.id,
        trigger_type: 'paytech_payment_confirmed',
      });
    }

    // Notify admin
    await sendWa({
      recipient_type: 'admin',
      recipient_phone: ADMIN_PHONE,
      message: `💰 Paiement PayTech reçu :\n${dossier.tracking_id ?? dossier.reference} — ${amount} XOF`,
      dossier_id: dossier.id,
      trigger_type: 'paytech_admin_notify',
    });
  } else if (typeEvent === 'sale_canceled') {
    await sendWa({
      recipient_type: 'admin',
      recipient_phone: ADMIN_PHONE,
      message: `❌ Paiement PayTech annulé :\n${dossier.tracking_id ?? dossier.reference}`,
      dossier_id: dossier.id,
      trigger_type: 'paytech_admin_canceled',
    });
  } else {
    console.log('paytech-webhook: unhandled type_event', typeEvent);
  }

  return new Response('ok', { status: 200, headers: corsHeaders });
});
