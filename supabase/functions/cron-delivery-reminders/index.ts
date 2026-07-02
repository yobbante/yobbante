// cron-delivery-reminders — Relances livraison finale (T+48h, T+5j, T+7j)
// A appeler toutes les heures via pg_cron.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_PHONE = '+221784604003';
const MAX_REMINDERS = 3;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // --- Auth: service-role bearer required (internal call only) ---
  const __SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const __auth = req.headers.get('authorization') ?? '';
  if (!__SR || __auth !== `Bearer ${__SR}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...(typeof corsHeaders !== 'undefined' ? corsHeaders : {}), 'Content-Type': 'application/json' },
    });
  }

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  async function sendWa(payload: Record<string, unknown>) {
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (e) { console.error('sendWa', e); }
  }

  const stats = { pickup_48h: 0, pickup_7d: 0, relay_5d: 0, relay_7d: 0 };

  // Candidats : dossiers ARRIVED_HUB, deja dispatches, pas encore livres
  const { data: candidates = [] } = await supa
    .from('dossiers')
    .select('id, tracking_id, reference, delivery_mode, delivery_notified_at, delivery_reminder_count, delivery_confirmed_by_client, relay_point_name, relay_point_address, recipient_phone, contact_phone, assigned_transporteur_ref, status')
    .eq('status', 'ARRIVED_HUB')
    .not('delivery_notified_at', 'is', null)
    .eq('delivery_confirmed_by_client', false);

  const now = Date.now();

  for (const d of candidates ?? []) {
    if ((d.delivery_reminder_count ?? 0) >= MAX_REMINDERS) continue;
    const notifiedAt = d.delivery_notified_at ? new Date(d.delivery_notified_at).getTime() : null;
    if (!notifiedAt) continue;
    const hoursSince = (now - notifiedAt) / 3_600_000;
    const clientPhone = d.recipient_phone || d.contact_phone;
    const tracking = d.tracking_id || d.reference;
    const mode = d.delivery_mode || 'pickup_gp';
    const count = d.delivery_reminder_count ?? 0;

    let sent: 'pickup_48h' | 'pickup_7d' | 'relay_5d' | 'relay_7d' | null = null;

    if (mode === 'pickup_gp') {
      if (hoursSince >= 48 && count === 0 && clientPhone) {
        let gpName = '', gpPhone = '';
        if (d.assigned_transporteur_ref) {
          const { data: gp } = await supa
            .from('transporteurs')
            .select('prenom, nom, telephone_1')
            .eq('reference', d.assigned_transporteur_ref).maybeSingle();
          if (gp) { gpName = `${gp.prenom ?? ''} ${gp.nom ?? ''}`.trim(); gpPhone = gp.telephone_1 ?? ''; }
        }
        await sendWa({
          recipient_type: 'client', recipient_phone: clientPhone,
          message: `Bonjour, votre colis ${tracking} vous attend.

N'oubliez pas de le recuperer chez ${gpName || 'notre partenaire'}${gpPhone ? ` : ${gpPhone}` : ''}.

Merci.`,
          dossier_id: d.id, trigger_type: 'delivery_reminder_pickup_48h',
        });
        sent = 'pickup_48h';
      } else if (hoursSince >= 24 * 7 && count <= 1) {
        await sendWa({
          recipient_type: 'admin', recipient_phone: ADMIN_PHONE,
          message: `Alerte : colis ${tracking} non recupere depuis 7 jours (pickup_gp).`,
          dossier_id: d.id, trigger_type: 'delivery_reminder_pickup_7d_admin',
        });
        sent = 'pickup_7d';
      }
    } else if (mode === 'relay_point') {
      if (hoursSince >= 24 * 5 && count === 0 && clientPhone) {
        await sendWa({
          recipient_type: 'client', recipient_phone: clientPhone,
          message: `Dernier rappel : votre colis ${tracking} au point relais ${d.relay_point_name || ''} expire dans 2 jours.

Pensez a le retirer rapidement.`,
          dossier_id: d.id, trigger_type: 'delivery_reminder_relay_5d',
        });
        sent = 'relay_5d';
      } else if (hoursSince >= 24 * 7 && count <= 1) {
        await sendWa({
          recipient_type: 'admin', recipient_phone: ADMIN_PHONE,
          message: `Alerte : colis ${tracking} non retire au point relais ${d.relay_point_name || ''} depuis 7 jours.`,
          dossier_id: d.id, trigger_type: 'delivery_reminder_relay_7d_admin',
        });
        sent = 'relay_7d';
      }
    }
    // home_delivery : suivi carrier hors scope cron.

    if (sent) {
      stats[sent]++;
      await supa.from('dossiers').update({
        delivery_reminder_count: count + 1,
      }).eq('id', d.id);
      await supa.from('dossier_events').insert({
        dossier_id: d.id,
        event_type: 'delivery_reminder_sent',
        event_data: { kind: sent, reminder_index: count + 1 },
        visible_to_client: false,
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, stats }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
