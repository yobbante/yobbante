// Edge function : Notifications proactives client (NOTIF 1-9)
// Dispatch via send-whatsapp, dédup via client_notifications_sent (UNIQUE).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE = 'https://yobbante.com';

type NotifType =
  | 'welcome' | 'pickup_reminder' | 'collected' | 'payment_received'
  | 'in_transit' | 'arrived_hub' | 'delivered' | 'satisfaction' | 'loyalty';

interface Btn { id: string; title: string }
interface BuiltMessage {
  text: string;
  buttons?: Btn[];
  interactive_type?: 'button';
}

function noAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function fmtMoney(x: number | null | undefined): string {
  if (!x) return '0';
  return Math.round(x).toLocaleString('fr-FR').replace(/\s/g, ' ');
}
function fmtDateFr(d: string | Date | null | undefined): string {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
function getFirstName(name: string | null | undefined): string {
  if (!name) return 'client';
  return name.trim().split(/\s+/)[0];
}

function build(type: NotifType, dossier: any, profile: any): BuiltMessage {
  const prenom = getFirstName(profile?.full_name || dossier?.sender_name);
  const trk = dossier.tracking_id || dossier.reference;
  const dest = dossier.destination_city || dossier.destination_country || 'destination';
  const eta = dossier.estimated_delivery_date
    ? new Date(dossier.estimated_delivery_date).toLocaleDateString('fr-FR')
    : 'sous 5-10 jours';

  switch (type) {
    case 'welcome':
      return {
        text: noAccents(
`Salam ${prenom} !
Bienvenue chez Yobbante.
Commande ${trk} enregistree.
Notre equipe vous contacte sous 24h pour organiser la collecte.

Des questions ? Repondez ici.`),
        interactive_type: 'button',
        buttons: [
          { id: `track_${trk}`, title: 'Suivre ma commande' },
          { id: 'contact_agent', title: 'Contacter un agent' },
        ],
      };
    case 'pickup_reminder':
      return {
        text: noAccents(
`Salam ${prenom},
Rappel : votre collecte est prevue demain ${fmtDateFr(dossier.pickup_date)}.
Adresse : ${dossier.sender_address || 'a confirmer'}
Notre GP vous appellera 30 min avant d arriver.`),
        interactive_type: 'button',
        buttons: [
          { id: `confirm_pickup_${dossier.id}`, title: 'Confirmer' },
          { id: `change_date_${dossier.id}`, title: 'Changer la date' },
        ],
      };
    case 'collected': {
      const poids = dossier.actual_weight_kg || dossier.estimated_weight || '?';
      const montant = fmtMoney(dossier.final_amount_xof);
      return {
        text: noAccents(
`Bonne nouvelle ${prenom} !
Votre colis ${trk} a ete collecte par notre equipe.
Poids confirme : ${poids} kg
Montant : ${montant} FCFA

Procedez au paiement :`),
        interactive_type: 'button',
        buttons: [
          { id: `pay_wave_${trk}`, title: 'Payer par Wave' },
          { id: `pay_om_${trk}`, title: 'Payer Orange Money' },
          { id: `pay_cod_${trk}`, title: 'Payer a la livraison' },
        ],
      };
    }
    case 'payment_received':
      return {
        text: noAccents(
`Paiement recu ${prenom} !
Merci. Votre colis part bientot.

Recu : ${SITE}/recu/${trk}
Suivi : ${SITE}/suivre/${trk}`),
      };
    case 'in_transit':
      return {
        text: noAccents(
`Votre colis est parti ${prenom} !
${trk} a quitte Dakar.
Direction : ${dest}
Arrivee estimee : ${eta}

Suivi : ${SITE}/suivre/${trk}`),
      };
    case 'arrived_hub': {
      const mode = dossier.delivery_mode || 'pickup_gp';
      const detail = mode === 'relay_point' && dossier.relay_point_address
        ? `Adresse partenaire : ${dossier.relay_point_address}`
        : `Adresse de livraison : ${dossier.recipient_address || 'a confirmer'}`;
      return {
        text: noAccents(
`Votre colis est arrive ${prenom} !
${trk} est a ${dest}.
Livraison dans les 24-48h.

${detail}`),
        interactive_type: 'button',
        buttons: [
          { id: `confirm_delivery_${dossier.id}`, title: 'Confirmer adresse' },
          { id: `track_${trk}`, title: 'Suivre en direct' },
        ],
      };
    }
    case 'delivered':
      return {
        text: noAccents(
`Livre ! ${prenom}
${trk} a ete remis a ${dossier.recipient_name || 'votre destinataire'}.
Merci de nous avoir fait confiance.`),
        interactive_type: 'button',
        buttons: [{ id: `review_${dossier.id}`, title: 'Laisser un avis' }],
      };
    case 'satisfaction':
      return {
        text: noAccents(
`Salam ${prenom},
Comment s est passee votre experience avec Yobbante (colis ${trk}) ?`),
        interactive_type: 'button',
        buttons: [
          { id: `rate_excellent_${dossier.id}`, title: 'Excellent' },
          { id: `rate_bien_${dossier.id}`, title: 'Bien' },
          { id: `rate_probleme_${dossier.id}`, title: 'Probleme' },
        ],
      };
    case 'loyalty':
      return {
        text: noAccents(
`Salam ${prenom},
Votre prochain envoi : utilisez le code ${trk} pour -10% sur votre commande.
Valable 30 jours.

${SITE}`),
      };
  }
}

async function sendOne(supa: any, dossierId: string, type: NotifType) {
  // Idempotence : si déjà envoyée, on saute
  const { data: already } = await supa
    .from('client_notifications_sent')
    .select('id, sent_at')
    .eq('dossier_id', dossierId).eq('notification_type', type).maybeSingle();
  if (already) {
    return { skipped: true, reason: 'already_sent', sent_at: already.sent_at };
  }

  // Anti-spam : pas 2 notifications le même jour pour ce dossier
  const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
  const { data: recent } = await supa
    .from('client_notifications_sent')
    .select('id, notification_type, sent_at')
    .eq('dossier_id', dossierId)
    .gte('sent_at', since)
    .neq('notification_type', type)
    .limit(1);
  // We still allow welcome+others same day (welcome is rare). Hard rule applies between same-type only.

  const { data: dossier } = await supa
    .from('dossiers')
    .select('*')
    .eq('id', dossierId)
    .maybeSingle();
  if (!dossier) return { skipped: true, reason: 'dossier_not_found' };

  const { data: profile } = await supa
    .from('profiles')
    .select('full_name, phone, email')
    .eq('user_id', dossier.user_id)
    .maybeSingle();

  const phone = (dossier.sender_phone || profile?.phone || dossier.contact_phone || '').toString();
  if (!phone || phone.replace(/\D/g, '').length < 6) {
    // Track as failed but mark sent to avoid retries forever
    await supa.from('client_notifications_sent').insert({
      dossier_id: dossierId, notification_type: type,
      payload: { error: 'no_phone' }, error: 'no_phone',
    });
    return { skipped: true, reason: 'no_phone' };
  }

  const msg = build(type, dossier, profile);
  const body: any = {
    recipient_type: 'client',
    recipient_phone: phone,
    dossier_id: dossierId,
    trigger_type: `client_notif_${type}`,
    message: msg.text,
  };
  if (msg.interactive_type === 'button' && msg.buttons?.length) {
    body.interactive_type = 'button';
    body.interactive_body = msg.text;
    body.buttons = msg.buttons;
    body.fallback_text = msg.text;
  }

  try {
    const res = await fetch(`${SUPA_URL}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify(body),
    });
    const ok = res.ok;
    const respText = ok ? null : await res.text().catch(() => null);

    await supa.from('client_notifications_sent').insert({
      dossier_id: dossierId,
      notification_type: type,
      payload: { phone, has_buttons: !!body.buttons, recent_other: recent?.[0]?.notification_type ?? null },
      error: ok ? null : (respText?.slice(0, 500) ?? 'send_failed'),
    });

    return { ok, type, dossier_id: dossierId };
  } catch (e: any) {
    await supa.from('client_notifications_sent').insert({
      dossier_id: dossierId, notification_type: type,
      payload: { phone }, error: e?.message?.slice(0, 500) ?? 'fetch_error',
    });
    return { ok: false, error: e?.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supa = createClient(SUPA_URL, SERVICE_KEY);

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean).pop();
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

    // Single dispatch (called by DB trigger)
    if (!path || path === 'client-notifications') {
      const { dossier_id, notification_type } = body as any;
      if (!dossier_id || !notification_type) {
        return new Response(JSON.stringify({ error: 'dossier_id and notification_type required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const out = await sendOne(supa, dossier_id, notification_type);
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Cron entrypoints
    if (path === 'cron-pickup-reminder') {
      // J-1 : pickup_date = tomorrow, status in (CONFIRMED, ASSIGNED, COLLECTING)
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      const { data: rows } = await supa
        .from('dossiers')
        .select('id, status')
        .eq('pickup_date', tomorrow)
        .in('status', ['CONFIRMED', 'ASSIGNED', 'COLLECTING', 'SUBMITTED', 'DEPARTURE_CONFIRMED']);
      const results = [] as any[];
      for (const r of rows ?? []) results.push(await sendOne(supa, r.id, 'pickup_reminder'));
      return new Response(JSON.stringify({ ran: 'pickup_reminder', count: results.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === 'cron-satisfaction') {
      const minDate = new Date(Date.now() - 3 * 86_400_000).toISOString();
      const { data: rows } = await supa
        .from('dossiers')
        .select('id')
        .eq('status', 'DELIVERED')
        .lte('delivered_at', minDate)
        .gte('delivered_at', new Date(Date.now() - 10 * 86_400_000).toISOString());
      const results = [] as any[];
      for (const r of rows ?? []) results.push(await sendOne(supa, r.id, 'satisfaction'));
      return new Response(JSON.stringify({ ran: 'satisfaction', count: results.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === 'cron-loyalty') {
      const minDate = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data: rows } = await supa
        .from('dossiers')
        .select('id')
        .eq('status', 'DELIVERED')
        .lte('delivered_at', minDate)
        .gte('delivered_at', new Date(Date.now() - 14 * 86_400_000).toISOString());
      const results = [] as any[];
      for (const r of rows ?? []) results.push(await sendOne(supa, r.id, 'loyalty'));
      return new Response(JSON.stringify({ ran: 'loyalty', count: results.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'unknown_route', path }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'internal_error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
