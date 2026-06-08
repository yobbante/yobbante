// cron-gp-departure-reminders — appelée chaque matin 08:00 UTC (Dakar).
// 1) Rappel J-3 et J-0 pour chaque depart actif.
// 2) Rappel colis ASSIGNED > 48h sans collecte.
// 3) Rappel colis COLLECTED > 24h sans pesee.
// Envoi depuis le 926 (phone_id WHATSAPP_GP_BOT_PHONE_ID).
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GP_PHONE_ID = '1184502448069695';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  const supaUrl = Deno.env.get('SUPABASE_URL')!;
  const srvKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  async function sendGp(phone: string, message: string, meta: Record<string, unknown> = {}) {
    if (!phone) return;
    try {
      await fetch(`${supaUrl}/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${srvKey}` },
        body: JSON.stringify({
          recipient_phone: phone,
          recipient_type: 'gp',
          phone_id: GP_PHONE_ID,
          message,
          ...meta,
        }),
      });
    } catch (e) { console.error('cron-gp-rem sendGp', e); }
  }

  async function loadGp(ref?: string | null) {
    if (!ref) return null;
    const { data } = await supa
      .from('transporteurs')
      .select('reference, prenom, telephone_1, telephone_2')
      .eq('reference', ref)
      .maybeSingle();
    return data;
  }

  function gpPhone(t: { telephone_1?: string | null; telephone_2?: string | null } | null) {
    return (t?.telephone_1 || t?.telephone_2 || '').trim();
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const j3 = new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10);

  let j3Sent = 0, j0Sent = 0, collectSent = 0, weightSent = 0;

  // -------- 1) Departs J-3 --------
  const { data: deps3 } = await supa
    .from('manual_departures')
    .select('id, destination_city, departure_date, total_capacity_kg, reserved_capacity_kg, transporteur_ref')
    .eq('status', 'active')
    .eq('departure_date', j3)
    .is('reminder_j3_sent_at', null)
    .not('transporteur_ref', 'is', null);

  for (const d of deps3 ?? []) {
    const gp = await loadGp(d.transporteur_ref);
    const phone = gpPhone(gp);
    if (!phone) continue;
    const { count } = await supa
      .from('dossiers')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_departure_id', d.id);
    const reserved = Number(d.reserved_capacity_kg ?? 0);
    const total = Number(d.total_capacity_kg ?? 0);
    const restant = Math.max(0, total - reserved);
    const msg = `✈️ Rappel départ dans 3 jours\nDestination : ${d.destination_city}\nColis assignés : ${count ?? 0} (${reserved}kg)\nCapacité restante : ${restant}kg\nTout est ok ? Tapez PROBLEME si besoin.`;
    await sendGp(phone, msg, { trigger_type: 'gp_departure_reminder_j3' });
    await supa.from('manual_departures').update({ reminder_j3_sent_at: now.toISOString() }).eq('id', d.id);
    j3Sent++;
  }

  // -------- 2) Departs J-0 --------
  const { data: deps0 } = await supa
    .from('manual_departures')
    .select('id, destination_city, departure_date, transporteur_ref')
    .eq('status', 'active')
    .eq('departure_date', today)
    .is('reminder_j0_sent_at', null)
    .not('transporteur_ref', 'is', null);

  for (const d of deps0 ?? []) {
    const gp = await loadGp(d.transporteur_ref);
    const phone = gpPhone(gp);
    if (!phone) continue;
    const { count } = await supa
      .from('dossiers')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_departure_id', d.id);
    const prenom = gp?.prenom || 'GP';
    const msg = `🚀 Bon voyage ${prenom} !\n${count ?? 0} colis à transporter aujourd'hui.\nCOLLECTE [ref] pour chaque colis récupéré\nLIVRE [ref] à la livraison\nBonne route !`;
    await sendGp(phone, msg, { trigger_type: 'gp_departure_reminder_j0' });
    await supa.from('manual_departures').update({ reminder_j0_sent_at: now.toISOString() }).eq('id', d.id);
    j0Sent++;
  }

  // -------- 3) Colis ASSIGNED > 48h sans collecte --------
  const t48 = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const { data: pendingCollect } = await supa
    .from('dossiers')
    .select('id, tracking_id, reference, assigned_transporteur_ref, gp_reminded_at, created_at')
    .eq('status', 'ASSIGNED')
    .is('collected_at', null)
    .is('collect_reminder_sent_at', null)
    .not('assigned_transporteur_ref', 'is', null)
    .lt('gp_reminded_at', t48)
    .limit(100);

  for (const d of pendingCollect ?? []) {
    const gp = await loadGp(d.assigned_transporteur_ref);
    const phone = gpPhone(gp);
    if (!phone) continue;
    const ref = d.tracking_id ?? d.reference ?? '?';
    const since = d.gp_reminded_at ? new Date(d.gp_reminded_at) : new Date(d.created_at);
    const days = Math.max(2, Math.floor((now.getTime() - since.getTime()) / 86400000));
    const msg = `⚠️ Rappel : ${ref} en attente de collecte depuis ${days}j.\nTapez COLLECTE ${ref} quand récupéré.`;
    await sendGp(phone, msg, { trigger_type: 'gp_collect_reminder', dossier_id: d.id });
    await supa.from('dossiers').update({ collect_reminder_sent_at: now.toISOString() }).eq('id', d.id);
    collectSent++;
  }

  // -------- 4) Colis COLLECTED > 24h sans pesee --------
  const t24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data: pendingWeight } = await supa
    .from('dossiers')
    .select('id, tracking_id, reference, assigned_transporteur_ref, collected_at')
    .not('collected_at', 'is', null)
    .lt('collected_at', t24)
    .is('actual_weight_kg', null)
    .is('weight_reminder_sent_at', null)
    .not('assigned_transporteur_ref', 'is', null)
    .limit(100);

  for (const d of pendingWeight ?? []) {
    const gp = await loadGp(d.assigned_transporteur_ref);
    const phone = gpPhone(gp);
    if (!phone) continue;
    const ref = d.tracking_id ?? d.reference ?? '?';
    const msg = `⚠️ Pesée manquante pour ${ref}.\nTapez POIDS ${ref} [kg]`;
    await sendGp(phone, msg, { trigger_type: 'gp_weight_reminder', dossier_id: d.id });
    await supa.from('dossiers').update({ weight_reminder_sent_at: now.toISOString() }).eq('id', d.id);
    weightSent++;
  }

  return new Response(JSON.stringify({ ok: true, j3Sent, j0Sent, collectSent, weightSent }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
