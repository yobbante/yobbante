// cron-mission-lifecycle — appelée toutes les 15 min par pg_cron.
//
// 1) ALERTE MISSION NON ACCEPTÉE (CORRECTION #7) :
//    dossiers ASSIGNED avec mission_accepted IS NULL et notif GP > 1h.
//    On ne détache PLUS automatiquement le GP : on envoie une alerte
//    WhatsApp au super-admin, throttlée par gp_acceptance_alert_sent_at
//    (relancée au max toutes les 6h tant que le GP n'a pas répondu).
//
// 2) FEEDBACK post-livraison : dossiers DELIVERED depuis plus de 48h
//    dont feedback_sent_at IS NULL → envoi du questionnaire 1/2/3 et
//    creation d'une session 'feedback' sur le bot 926.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPER_ADMIN = '+221784604003';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const supaUrl = Deno.env.get('SUPABASE_URL')!;
  const srvKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  async function sendWa(payload: Record<string, unknown>) {
    try {
      await fetch(`${supaUrl}/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${srvKey}` },
        body: JSON.stringify(payload),
      });
    } catch (e) { console.error('cron sendWa', e); }
  }

  // -------- 1) ALERTE missions assignees > 1h sans reponse (no auto-detach) --------
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: pending, error: pErr } = await supa
    .from('dossiers')
    .select('id, tracking_id, reference, assigned_transporteur_ref, destination_city, destination_country, gp_reminded_at, gp_acceptance_alert_sent_at')
    .eq('status', 'ASSIGNED')
    .is('mission_accepted', null)
    .not('assigned_transporteur_ref', 'is', null)
    .not('gp_reminded_at', 'is', null)
    .lt('gp_reminded_at', oneHourAgo)
    .or(`gp_acceptance_alert_sent_at.is.null,gp_acceptance_alert_sent_at.lt.${sixHoursAgo}`)
    .limit(50);
  if (pErr) console.error('cron gp-acceptance-alert query', pErr);

  let alerted = 0;
  for (const d of pending ?? []) {
    const ref = d.tracking_id ?? d.reference ?? '?';
    const gpRef = d.assigned_transporteur_ref;
    const dest = d.destination_city ?? d.destination_country ?? '—';
    const reminded = d.gp_reminded_at ? new Date(d.gp_reminded_at) : null;
    const hoursPending = reminded
      ? Math.max(1, Math.round((Date.now() - reminded.getTime()) / 3_600_000))
      : 1;
    await sendWa({
      recipient_phone: SUPER_ADMIN,
      recipient_type: 'admin',
      message: `⏰ Mission non acceptée\nGP${gpRef} n'a pas répondu depuis ${hoursPending}h.\nColis ${ref} → ${dest}\nGP toujours assigné — relancer ou réassigner manuellement.`,
      trigger_type: 'gp_acceptance_pending_alert',
      dossier_id: d.id,
    });
    await supa.from('dossiers')
      .update({ gp_acceptance_alert_sent_at: new Date().toISOString() })
      .eq('id', d.id);
    alerted++;
  }

  // -------- 2) FEEDBACK 48h post-livraison --------
  const t48 = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: delivered, error: dErr } = await supa
    .from('dossiers')
    .select('id, tracking_id, reference, delivered_at, gp_id, assigned_transporteur_ref')
    .eq('status', 'DELIVERED')
    .is('feedback_sent_at', null)
    .not('delivered_at', 'is', null)
    .lt('delivered_at', t48)
    .limit(50);
  if (dErr) console.error('cron feedback query', dErr);

  let asked = 0;
  for (const d of delivered ?? []) {
    if (!d.gp_id) {
      // pas de GP identifié → marquer comme envoyé pour ne pas reboucler
      await supa.from('dossiers').update({ feedback_sent_at: new Date().toISOString() }).eq('id', d.id);
      continue;
    }
    const { data: gp } = await supa
      .from('transporteurs')
      .select('id, telephone_1, prenom, reference')
      .eq('id', d.gp_id)
      .maybeSingle();
    if (!gp?.telephone_1) {
      await supa.from('dossiers').update({ feedback_sent_at: new Date().toISOString() }).eq('id', d.id);
      continue;
    }

    const tracking = d.tracking_id ?? d.reference ?? '';
    const text =
      `Comment s'est passee cette mission (${tracking}) ?\n` +
      `1 → Parfait\n2 → Probleme mineur\n3 → Probleme serieux`;

    await sendWa({
      recipient_phone: gp.telephone_1,
      recipient_type: 'gp',
      message: text,
      transporteur_id: gp.id,
      dossier_id: d.id,
      trigger_type: 'gp_feedback_request',
    });

    // Cree (ou remplace) une session feedback pour ce GP
    const fromPhone = String(gp.telephone_1).replace(/\D/g, '');
    const { data: existing } = await supa
      .from('gp_bot_sessions')
      .select('id')
      .eq('from_phone', fromPhone)
      .maybeSingle();
    if (existing?.id) {
      await supa.from('gp_bot_sessions').update({
        pending_intent: 'feedback',
        pending_data: { dossier_id: d.id, tracking_id: tracking },
      }).eq('id', existing.id);
    } else {
      await supa.from('gp_bot_sessions').insert({
        transporteur_id: gp.id,
        from_phone: fromPhone,
        pending_intent: 'feedback',
        pending_data: { dossier_id: d.id, tracking_id: tracking },
      });
    }

    await supa.from('dossiers').update({ feedback_sent_at: new Date().toISOString() }).eq('id', d.id);
    asked++;
  }

  return new Response(
    JSON.stringify({ ok: true, alerted, asked }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
