// cron-gp-reminders — Relances GP automatiques (RELANCE A..G)
// A appeler toutes les heures via pg_cron.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_PHONE = '+221784604003';
const MAX_REMINDERS = 3;
const MIN_INTERVAL_MIN = 60;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const stats = { A: 0, C: 0, D: 0, E: 0, F: 0, G: 0, errors: 0 };

  async function sendWa(payload: Record<string, unknown>) {
    try {
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (e) {
      console.error('cron-gp send err', e);
      stats.errors++;
      return false;
    }
  }

  async function getGp(ref: string | null) {
    if (!ref) return null;
    const { data } = await supa
      .from('transporteurs')
      .select('id, reference, prenom, nom, telephone_1, whatsapp')
      .eq('reference', ref)
      .maybeSingle();
    return data as any;
  }

  function gpPhone(gp: any): string | null {
    const p = gp?.telephone_1 || gp?.whatsapp;
    return (p && String(p).replace(/\D/g, '').length >= 6) ? String(p) : null;
  }

  function prenomOf(gp: any): string {
    return (gp?.prenom?.trim() || gp?.nom?.split(' ')?.[0] || 'cher partenaire');
  }

  function shouldThrottle(d: any): boolean {
    if ((d.gp_reminder_count ?? 0) >= MAX_REMINDERS) return true;
    if (d.gp_reminded_at) {
      const diffMin = (Date.now() - new Date(d.gp_reminded_at).getTime()) / 60000;
      if (diffMin < MIN_INTERVAL_MIN) return true;
    }
    if (d.gp_last_action_at && d.gp_reminded_at && new Date(d.gp_last_action_at) > new Date(d.gp_reminded_at)) {
      return true;
    }
    return false;
  }

  async function bumpReminder(dossierId: string, currentCount: number) {
    await supa
      .from('dossiers')
      .update({ gp_reminded_at: new Date().toISOString(), gp_reminder_count: (currentCount ?? 0) + 1 })
      .eq('id', dossierId);
  }

  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();

  // ============================================================
  // RELANCE A — ASSIGNED non confirme depuis 2h
  // ============================================================
  try {
    const { data: rows } = await supa
      .from('dossiers')
      .select('id, tracking_id, buyer_name, origin_country, destination_country, destination_city, origin_city, assigned_transporteur_ref, gp_reminded_at, gp_reminder_count, gp_last_action_at')
      .eq('status', 'ASSIGNED')
      .not('assigned_transporteur_ref', 'is', null)
      .is('gp_reminded_at', null)
      .lt('updated_at', iso(now - 2 * 3600_000))
      .limit(50);

    for (const d of rows ?? []) {
      if (shouldThrottle(d)) continue;
      const gp = await getGp(d.assigned_transporteur_ref);
      const phone = gpPhone(gp);
      if (!phone) continue;
      const route = `${d.origin_city ?? d.origin_country ?? '?'} -> ${d.destination_city ?? d.destination_country ?? '?'}`;
      const msg = `Salam ${prenomOf(gp)},
Vous avez un nouveau colis assigne.

Ref : ${d.tracking_id}
Route : ${route}
Client : ${d.buyer_name ?? '—'}

Tapez MES MISSIONS pour voir tous vos colis ou AIDE pour les commandes disponibles.`;
      const ok = await sendWa({
        recipient_phone: phone,
        recipient_type: 'gp',
        message: msg,
        transporteur_id: gp.id,
        dossier_id: d.id,
        trigger_type: 'gp_reminder',
      });
      if (ok) { await bumpReminder(d.id, d.gp_reminder_count); stats.A++; }
    }
  } catch (e) { console.error('RELANCE A', e); stats.errors++; }

  // ============================================================
  // RELANCE C — Jour J (depart aujourd'hui)
  // ============================================================
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const { data: deps } = await supa
      .from('manual_departures')
      .select('id, departure_date, transporteur_ref')
      .gte('departure_date', today.toISOString().slice(0,10))
      .lt('departure_date', tomorrow.toISOString().slice(0,10))
      .limit(100);

    for (const dep of deps ?? []) {
      const { data: dossiers } = await supa
        .from('dossiers')
        .select('id, tracking_id, buyer_name, contact_phone, gp_reminded_at, gp_reminder_count, gp_last_action_at, status')
        .eq('assigned_departure_id', dep.id)
        .in('status', ['ASSIGNED', 'COLLECTING', 'COLLECTED']);
      if (!dossiers || dossiers.length === 0) continue;
      const gp = await getGp(dep.transporteur_ref);
      const phone = gpPhone(gp);
      if (!phone) continue;
      // Throttle per GP / per day via earliest dossier
      const head = dossiers[0];
      if (shouldThrottle(head)) continue;
      const liste = dossiers.map((d: any) =>
        `- ${d.tracking_id} (${d.buyer_name ?? '—'})`
      ).join('\n');
      const msg = `Bonjour ${prenomOf(gp)} !
Rappel : votre depart est AUJOURD HUI.

Colis a collecter avant le depart :
${liste}

Confirmez chaque collecte :
COLLECTE {tracking_id}`;
      const ok = await sendWa({
        recipient_phone: phone,
        recipient_type: 'gp',
        message: msg,
        transporteur_id: gp.id,
        trigger_type: 'gp_reminder',
      });
      if (ok) {
        for (const d of dossiers) await bumpReminder(d.id, d.gp_reminder_count);
        stats.C++;
      }
    }
  } catch (e) { console.error('RELANCE C', e); stats.errors++; }

  // ============================================================
  // RELANCE D — POIDS manquant 4h apres COLLECTE
  //   - 1 seul rappel WhatsApp au GP (pas de spam)
  //   - 1 seule alerte admin
  // ============================================================
  try {
    const { data: rows } = await supa
      .from('dossiers')
      .select('id, tracking_id, assigned_transporteur_ref, collected_at, gp_reminded_at, gp_reminder_count, gp_last_action_at, weight_alert_sent_at')
      .eq('status', 'COLLECTED')
      .is('actual_weight_kg', null)
      .lt('collected_at', iso(now - 4 * 3600_000))
      .limit(50);

    for (const d of rows ?? []) {
      // Une seule passe par dossier (pas de spam)
      if (d.weight_alert_sent_at) continue;

      const gp = await getGp(d.assigned_transporteur_ref);
      const phone = gpPhone(gp);

      // --- WhatsApp GP ---
      if (phone) {
        const msg = `Salam ${prenomOf(gp)},
Le colis ${d.tracking_id} a ete collecte mais le poids n est pas encore enregistre.

Envoyez le poids maintenant :
POIDS ${d.tracking_id} [poids]kg

Ex : POIDS ${d.tracking_id} 4.5kg

Si vous etes occupe, notre equipe peut peser le colis a la reception.`;
        const ok = await sendWa({
          recipient_phone: phone,
          recipient_type: 'gp',
          message: msg,
          transporteur_id: gp.id,
          dossier_id: d.id,
          trigger_type: 'gp_weight_fallback_4h',
        });
        if (ok) { await bumpReminder(d.id, d.gp_reminder_count); stats.D++; }
      }

      // --- Alerte admin ---
      const gpName = gp ? `${gp.prenom ?? ''} ${gp.nom ?? ''}`.trim() || gp.reference : (d.assigned_transporteur_ref ?? '—');
      const adminMsg = `ALERTE POIDS :
${d.tracking_id} collecte depuis 4h sans poids enregistre.
GP : ${gpName}
Action requise.`;
      const okAdmin = await sendWa({
        recipient_phone: ADMIN_PHONE,
        recipient_type: 'admin',
        message: adminMsg,
        dossier_id: d.id,
        trigger_type: 'admin_weight_missing_4h',
      });
      if (okAdmin) {
        await supa.from('dossiers').update({ weight_alert_sent_at: new Date().toISOString() }).eq('id', d.id);
      }
    }
  } catch (e) { console.error('RELANCE D', e); stats.errors++; }

  // ============================================================
  // RELANCE E — LIVRE manquant apres 72h en transit
  // ============================================================
  try {
    const { data: rows } = await supa
      .from('dossiers')
      .select('id, tracking_id, assigned_transporteur_ref, gp_reminded_at, gp_reminder_count, gp_last_action_at')
      .eq('status', 'IN_TRANSIT')
      .is('delivered_at', null)
      .lt('updated_at', iso(now - 72 * 3600_000))
      .lt('gp_reminder_count', MAX_REMINDERS)
      .limit(50);

    for (const d of rows ?? []) {
      if (shouldThrottle(d)) continue;
      const gp = await getGp(d.assigned_transporteur_ref);
      const phone = gpPhone(gp);
      if (!phone) continue;
      const msg = `Bonjour ${prenomOf(gp)},
Le colis ${d.tracking_id} est toujours en transit.

Si vous avez livre, confirmez :
LIVRE ${d.tracking_id}

Si probleme, tapez :
PB ${d.tracking_id} [description]`;
      const ok = await sendWa({
        recipient_phone: phone,
        recipient_type: 'gp',
        message: msg,
        transporteur_id: gp.id,
        dossier_id: d.id,
        trigger_type: 'gp_reminder',
      });
      if (ok) { await bumpReminder(d.id, d.gp_reminder_count); stats.E++; }
    }
  } catch (e) { console.error('RELANCE E', e); stats.errors++; }

  // ============================================================
  // RELANCE F — Aucune reponse 24h apres 2 relances -> alerte admin
  // ============================================================
  try {
    const { data: rows } = await supa
      .from('dossiers')
      .select('id, tracking_id, status, assigned_transporteur_ref, gp_last_action_at, gp_reminder_count')
      .in('status', ['ASSIGNED', 'COLLECTED', 'IN_TRANSIT'])
      .gte('gp_reminder_count', 2)
      .eq('gp_no_response_alert_sent', false)
      .or(`gp_last_action_at.is.null,gp_last_action_at.lt.${iso(now - 24 * 3600_000)}`)
      .limit(50);

    for (const d of rows ?? []) {
      const gp = await getGp(d.assigned_transporteur_ref);
      const phone = gpPhone(gp) ?? '?';
      const gpName = gp ? `${gp.prenom ?? ''} ${gp.nom ?? ''}`.trim() || gp.reference : (d.assigned_transporteur_ref ?? '?');
      const msg = `ALERTE : GP ${gpName} (${phone}) ne repond pas depuis 24h.
Dossier ${d.tracking_id} - ${d.status}

Appelez-le directement ou reassignez le dossier.`;
      const ok = await sendWa({
        recipient_phone: ADMIN_PHONE,
        recipient_type: 'admin',
        message: msg,
        client_name: gpName,
        dossier_id: d.id,
        trigger_type: 'gp_no_response_alert',
      });
      if (ok) {
        await supa.from('dossiers').update({ gp_no_response_alert_sent: true }).eq('id', d.id);
        stats.F++;
      }
    }
  } catch (e) { console.error('RELANCE F', e); stats.errors++; }

  // ============================================================
  // RELANCE G — WEIGHED + paid -> notifier GP "en route possible"
  // ============================================================
  try {
    const { data: rows } = await supa
      .from('dossiers')
      .select('id, tracking_id, assigned_transporteur_ref, gp_reminded_at, gp_reminder_count, gp_last_action_at')
      .eq('status', 'WEIGHED')
      .eq('payment_status', 'paid')
      .or(`gp_reminded_at.is.null,gp_reminded_at.lt.${iso(now - 30 * 60_000)}`)
      .limit(50);

    for (const d of rows ?? []) {
      const gp = await getGp(d.assigned_transporteur_ref);
      const phone = gpPhone(gp);
      if (!phone) continue;
      const msg = `Bonne nouvelle ${prenomOf(gp)} !
Le client a paye pour ${d.tracking_id}.

Le colis peut partir.
Confirmez le depart quand vous etes en route :
EN ROUTE ${d.tracking_id}`;
      const ok = await sendWa({
        recipient_phone: phone,
        recipient_type: 'gp',
        message: msg,
        transporteur_id: gp.id,
        dossier_id: d.id,
        trigger_type: 'gp_reminder',
      });
      if (ok) { await bumpReminder(d.id, d.gp_reminder_count); stats.G++; }
    }
  } catch (e) { console.error('RELANCE G', e); stats.errors++; }

  // ============================================================
  // RELANCE H — GP sans tarifs apres 24h, alerte admin a 48h
  // ============================================================
  try {
    const { data: gps } = await supa
      .from('transporteurs')
      .select('id, reference, prenom, nom, telephone_1, whatsapp, rates_per_city, created_at, notes, last_bot_activity_at')
      .eq('actif', true)
      .lt('created_at', iso(now - 24 * 3600_000))
      .limit(100);

    for (const gp of gps ?? []) {
      const rates = (gp.rates_per_city ?? {}) as Record<string, unknown>;
      if (Object.keys(rates).length > 0) continue;

      const ageH = (now - new Date(gp.created_at).getTime()) / 3600_000;
      const noted = (gp.notes ?? '').includes('[tarifs_reminder_24h]');
      const adminNoted = (gp.notes ?? '').includes('[tarifs_alert_48h]');

      // 24h : relance GP via WhatsApp
      if (ageH >= 24 && !noted) {
        const phone = gpPhone(gp);
        if (phone) {
          await sendWa({
            recipient_phone: phone,
            recipient_type: 'gp',
            message: `Bonjour ${prenomOf(gp)} 👋

Pour recevoir des missions, vous devez renseigner vos tarifs par ville.

Tapez TARIFS pour voir vos tarifs actuels, puis :
TARIF [ville] [prix]
Ex : TARIF Paris 6500`,
            transporteur_id: gp.id,
            trigger_type: 'gp_tarifs_reminder_24h',
          });
          await supa.from('transporteurs').update({
            notes: `${gp.notes ?? ''}\n[tarifs_reminder_24h ${new Date().toISOString()}]`,
          }).eq('id', gp.id);
        }
      }

      // 48h : alerte admin DESACTIVEE (spam) - supprime sur demande super admin.
      // Plus aucune notification individuelle GP n'est envoyee a +221784604003.

    }
  } catch (e) { console.error('RELANCE H', e); stats.errors++; }

  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
