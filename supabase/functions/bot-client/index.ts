// bot-client — WhatsApp assistant for clients on 607 (+221786078080)
// Handles: departures list, tracking, new shipment, quote, human handoff.
// All text without accents (WhatsApp friendly).
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface BotInput {
  inbound_id?: string;
  from_phone: string;
  from_name?: string | null;
  message?: string | null;
}

const ADMIN_PHONE = '+221784604003';
const BOT_PHONE_DISPLAY = '+221786078080';
const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 1h

function norm(t?: string | null): string {
  return (t ?? '')
    .toString()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}`;
}

const STATUS_FR: Record<string, string> = {
  SUBMITTED: 'Soumis',
  AWAITING_CLIENT: 'En attente de vos infos',
  IN_REVIEW: 'En analyse',
  ASSIGNED: 'GP assigne',
  COLLECTING: 'Collecte en cours',
  COLLECTED: 'Collecte',
  WEIGHED: 'Pese - Paiement en attente',
  ARRIVED_HUB: 'Arrive au hub',
  IN_TRANSIT: 'En transit',
  ARRIVED: 'Arrive',
  DELIVERED: 'Livre',
  CANCELLED: 'Annule',
};

const MAIN_MENU = `Bonjour ! Je suis l assistant Yobbante.

1 - Prochains departs disponibles
2 - Suivre mon colis
3 - Nouvelle expedition
4 - Obtenir un devis
5 - Parler a un agent`;

const SHORT_MENU = `Choisissez :

1 - Departs
2 - Suivi
3 - Expedition
4 - Devis
5 - Agent`;


const SESSION_EXPIRED = `Votre session a expire.

1 - Prochains departs
2 - Suivre mon colis
3 - Nouvelle expedition
4 - Obtenir un devis
5 - Parler a un agent`;

const MENU_TRIGGERS = /^(aide|bonjour|bonsoir|salut|hello|hi|hey|menu|help|salam|salaam|allo|alo|coucou|retour|annuler)\b/;
const BACK_TO_MENU = /^(0|menu|retour|annuler)$/;

const FALLBACK = `Je n ai pas compris.`;

// Append short menu after info replies, full menu after errors/fallback
function withShortMenu(reply: string): string {
  return `${reply}\n\n${SHORT_MENU}`;
}
function withFullMenu(reply: string): string {
  return `${reply}\n\n${MAIN_MENU}`;
}
// Used while a session is waiting for a precise input (tracking, weight, etc.)
function withBack(reply: string): string {
  return `${reply}\n\nOu tapez 0 pour revenir au menu.`;
}


async function sendWa(supa: any, phone: string, message: string, trigger: string) {
  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        recipient_phone: phone,
        recipient_type: 'client',
        message,
        trigger_type: trigger,
      }),
    });
  } catch (e) {
    console.error('BOT_CLIENT send error', e);
  }
}

async function sendWaButtons(
  phone: string,
  bodyText: string,
  buttons: Array<{ id: string; label: string }>,
  fallbackText: string,
  trigger: string,
) {
  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        recipient_phone: phone,
        recipient_type: 'client',
        interactive_type: 'button',
        interactive_body: bodyText,
        buttons,
        fallback_text: fallbackText,
        trigger_type: trigger,
      }),
    });
  } catch (e) {
    console.error('BOT_CLIENT send buttons error', e);
  }
}

async function getSession(supa: any, phone: string): Promise<{ session: any; expired: boolean }> {
  const { data } = await supa
    .from('client_bot_sessions')
    .select('*')
    .eq('from_phone', phone)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { session: null, expired: false };
  const age = Date.now() - new Date(data.updated_at).getTime();
  if (age > SESSION_TIMEOUT_MS) {
    const hadIntent = !!data.pending_intent;
    return { session: { ...data, pending_intent: null, pending_data: {} }, expired: hadIntent };
  }
  return { session: data, expired: false };
}

async function saveSession(
  supa: any,
  phone: string,
  intent: string | null,
  data: Record<string, any>,
  pauseUntil?: string | null,
) {
  const existing = await supa
    .from('client_bot_sessions')
    .select('id')
    .eq('from_phone', phone)
    .limit(1)
    .maybeSingle();
  const payload: any = {
    from_phone: phone,
    pending_intent: intent,
    pending_data: data,
    updated_at: new Date().toISOString(),
  };
  if (pauseUntil !== undefined) payload.bot_paused_until = pauseUntil;
  if (existing?.data?.id) {
    await supa.from('client_bot_sessions').update(payload).eq('id', existing.data.id);
  } else {
    await supa.from('client_bot_sessions').insert(payload);
  }
}

async function handleMenu1Departures(supa: any) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: deps } = await supa
    .from('public_active_departures')
    .select('short_ref,transporteur_ref,departure_date,origin_city,destination_city,available_capacity_kg')
    .gte('departure_date', today)
    .order('departure_date', { ascending: true })
    .limit(10);
  if (!deps || deps.length === 0) {
    return `Aucun depart disponible actuellement.\n\nReessayez bientot ou tapez 4 pour un devis.`;
  }
  let txt = `Prochains departs Yobbante :\n\n`;
  for (const d of deps) {
    const ref = d.short_ref || d.transporteur_ref || '----';
    txt += `${fmtDate(d.departure_date)} - ${d.origin_city || '?'} -> ${d.destination_city || '?'}\nRef #${ref} - Places dispo : ${d.available_capacity_kg ?? 0}kg\n\n`;
  }
  txt += `Pour reserver, repondez :\nRESERVER {ref} {poids}kg\nEx: RESERVER ${deps[0].short_ref || deps[0].transporteur_ref || 'XXXX'} 3kg`;
  return txt;
}

function parseReserver(msg: string): { ref: string; weight: number } | null {
  const m = norm(msg).match(/reserver\s+([a-z0-9]+)\s+(\d+(?:[.,]\d+)?)\s*kg?/);
  if (!m) return null;
  const w = parseFloat(m[2].replace(',', '.'));
  if (!w || w <= 0) return null;
  return { ref: m[1].toUpperCase(), weight: w };
}

async function handleReserver(supa: any, phone: string, _name: string | null, ref: string, weight: number) {
  const { data: dep } = await supa
    .from('manual_departures')
    .select('id,short_ref,transporteur_ref,departure_date,origin_city,destination_city,available_capacity_kg')
    .or(`short_ref.eq.${ref},transporteur_ref.eq.${ref}`)
    .limit(1)
    .maybeSingle();
  if (!dep) return `Ref #${ref} introuvable. Tapez 1 pour voir les departs.`;
  if ((dep.available_capacity_kg ?? 0) < weight) {
    return `Desole, plus que ${dep.available_capacity_kg ?? 0}kg dispo sur #${ref}.\n\nTapez 1 pour voir d autres departs.`;
  }
  await saveSession(supa, phone, 'reserve_name', {
    departure_id: dep.id,
    step: 'name',
    ref,
    weight,
  });
  return `Super ! Reservation en cours.\n\nDepart : Ref #${ref} - ${fmtDate(dep.departure_date)}\nPoids : ${weight}kg\n\nPour finaliser, donnez-nous :\nVotre nom complet ?`;
}

async function handleTrackingLookup(supa: any, trackingInput: string) {
  const trk = trackingInput.toUpperCase().replace(/\s/g, '');
  const { data: d } = await supa
    .from('dossiers')
    .select('tracking_id,reference,status,origin_country,destination_country,updated_at')
    .or(`tracking_id.eq.${trk},reference.eq.${trk}`)
    .limit(1)
    .maybeSingle();
  if (!d) return `Numero ${trk} introuvable. Verifiez et reessayez.`;
  const id = d.tracking_id || d.reference;
  const label = STATUS_FR[d.status] || d.status;
  const upd = new Date(d.updated_at).toLocaleDateString('fr-FR');
  return `Votre colis ${id} :\nStatut : ${label}\nRoute : ${d.origin_country} -> ${d.destination_country}\nDerniere mise a jour : ${upd}\n\nPour plus de details :\nyobbante.com/suivre/${id}`;
}

async function handleQuoteCalc(supa: any, dest: string, weight: number): Promise<string> {
  const destLower = norm(dest);
  let destCountry = 'FR';
  if (destLower.includes('paris') || destLower.includes('france')) destCountry = 'FR';
  else if (destLower.includes('new york') || destLower.includes('usa') || destLower.includes('etats')) destCountry = 'US';
  else if (destLower.includes('londres') || destLower.includes('uk')) destCountry = 'GB';
  else if (destLower.includes('italie') || destLower.includes('rome')) destCountry = 'IT';
  else if (destLower.includes('espagne') || destLower.includes('madrid')) destCountry = 'ES';

  try {
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/pricing-calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
      body: JSON.stringify({ destination_country: destCountry, real_weight_kg: weight, transport_mode: 'air', priority: 'standard' }),
    });
    const std = await res.json().catch(() => null);
    const stdPrice = std?.price_xof ?? std?.total_xof ?? null;
    const expressPrice = stdPrice ? Math.round(stdPrice * 1.45) : null;

    let body = `Estimation Yobbante :\nDakar -> ${dest} - ${weight}kg :\n\n`;
    if (stdPrice) body += `Standard : ${stdPrice.toLocaleString('fr-FR')} FCFA (3 jours)\n`;
    if (expressPrice) body += `Express : ${expressPrice.toLocaleString('fr-FR')} FCFA (24h)\n`;
    if (!stdPrice) body += `Nous recherchons la meilleure option. Un agent vous contactera.\n`;
    body += `\nEnlevement inclus a Dakar.\n\nPour reserver : yobbante.com\nou repondez OUI`;
    return body;
  } catch (e) {
    console.error('BOT_CLIENT pricing err', e);
    return `Estimation indisponible pour le moment.\nUn agent vous contactera.`;
  }
}

// Handle a top-level menu choice (1-5). Returns the reply.
async function handleMenuChoice(
  supa: any,
  phone: string,
  fromName: string | null,
  choice: string,
  lastMsg: string,
): Promise<string> {
  if (choice === '1') {
    const r = await handleMenu1Departures(supa);
    await saveSession(supa, phone, null, {});
    return withShortMenu(r);
  }
  if (choice === '2') {
    await saveSession(supa, phone, 'await_tracking', {});
    return withBack(`Quel est votre numero de suivi ?\n(Format : YOB-XXXXXX)`);
  }
  if (choice === '3') {
    await saveSession(supa, phone, 'ship_origin', {});
    return withBack(`D ou part votre colis ?`);
  }
  if (choice === '4') {
    await saveSession(supa, phone, 'quote_origin', {});
    return withBack(`Origine ?`);
  }
  // 5
  const pauseUntil = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  await saveSession(supa, phone, null, {}, pauseUntil);
  await sendWa(
    supa,
    ADMIN_PHONE,
    `Client ${fromName ?? phone} (${phone}) demande un agent.\nDernier message : "${lastMsg.slice(0, 200)}"`,
    'agent_handoff',
  );
  return withShortMenu(`Un agent vous contacte sous 2h.\nMerci de votre patience.`);
}


// Generate an edit link for the client's most recent active dossier.
async function handleModifierClient(supa: any, phone: string): Promise<string> {
  // Find the most recent dossier for this phone
  const { data: dossier } = await supa
    .from('dossiers')
    .select('id, tracking_id, reference')
    .or(`contact_phone.eq.${phone},sender_phone.eq.${phone}`)
    .not('status', 'in', '(DELIVERED,CANCELLED)')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!dossier) {
    return withShortMenu(`Aucun dossier actif trouve pour votre numero.\nContactez-nous : +221 78 607 80 80`);
  }

  const { data: tok, error } = await supa
    .from('edit_tokens')
    .insert({
      entity_type: 'dossier_client',
      entity_id: dossier.id,
      fields_allowed: ['sender_name', 'sender_phone', 'sender_address', 'recipient_name', 'recipient_phone', 'recipient_address'],
    })
    .select('token')
    .single();

  if (error || !tok) {
    return withShortMenu(`Erreur technique. Reessayez plus tard.`);
  }

  const link = `https://yobbante.com/modifier/${tok.token}`;
  const ref = dossier.tracking_id || dossier.reference || '';
  return `Voici votre lien de modification pour ${ref} (valide 24h) :\n${link}\n\nSi vous avez des questions :\nTapez 5 pour parler a un agent.`;
}

// Find the most recent dossier for this phone that is awaiting a client decision
// (status AWAITING_CLIENT or WEIGHED → paiement attendu, ou SUBMITTED).
async function findPendingDossier(supa: any, phone: string) {
  const digits = phone.replace(/\D/g, '');
  const variants = [phone, `+${digits}`, digits];
  const { data } = await supa
    .from('dossiers')
    .select('id, tracking_id, reference, status, final_amount_xof, estimated_cost')
    .in('status', ['AWAITING_CLIENT', 'SUBMITTED', 'WEIGHED', 'IN_REVIEW'])
    .or(variants.map((v) => `contact_phone.eq.${v}`).join(','))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function logDossierEvent(supa: any, dossierId: string, eventType: string, payload: Record<string, any>) {
  try {
    await supa.from('dossier_events').insert({
      dossier_id: dossierId,
      event_type: eventType,
      event_data: payload,
      visible_to_client: true,
    });
  } catch (e) {
    console.error('BOT_CLIENT log event err', e);
  }
}

async function handleOui(supa: any, phone: string, fromName: string | null): Promise<string> {
  const d = await findPendingDossier(supa, phone);
  if (!d) {
    return withShortMenu(`Merci ! Aucune action en attente trouvee sur votre dossier.`);
  }
  const ref = d.tracking_id || d.reference;
  await logDossierEvent(supa, d.id, 'client_confirmed', { via: 'bot_client', status: d.status });
  await sendWa(
    supa,
    ADMIN_PHONE,
    `Client ${fromName ?? phone} a confirme (OUI) sur ${ref}\nStatut actuel : ${STATUS_FR[d.status] || d.status}`,
    'admin_notification',
  );
  return withShortMenu(`Merci ! Votre confirmation pour ${ref} est enregistree.\nUn agent prend le relais.`);
}

async function handleNon(supa: any, phone: string, fromName: string | null): Promise<string> {
  const d = await findPendingDossier(supa, phone);
  if (!d) {
    return withShortMenu(`Aucune action en attente trouvee. Tapez 5 pour parler a un agent.`);
  }
  const ref = d.tracking_id || d.reference;
  try {
    await supa.from('dossiers').update({ status: 'CANCELLED' }).eq('id', d.id);
  } catch (e) {
    console.error('BOT_CLIENT cancel err', e);
  }
  await logDossierEvent(supa, d.id, 'client_cancelled', { via: 'bot_client', previous_status: d.status });
  await sendWa(
    supa,
    ADMIN_PHONE,
    `Client ${fromName ?? phone} a refuse (NON) sur ${ref}\nDossier annule (etait : ${STATUS_FR[d.status] || d.status})`,
    'admin_notification',
  );
  return withShortMenu(`Compris. Votre dossier ${ref} a ete annule.\nUn agent vous recontactera si besoin.`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  let input: BotInput;
  try {
    input = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
  }

  const phone = input.from_phone;
  const msg = (input.message ?? '').trim();
  const nMsg = norm(msg);

  if (!phone) {
    return new Response(JSON.stringify({ ok: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // SECURITY: super admin must never be handled by bot-client
  const phoneDigits = phone.replace(/\D/g, '');
  const adminDigits = ADMIN_PHONE.replace(/\D/g, '');
  if (phoneDigits === adminDigits) {
    console.log('BOT_CLIENT skipping super admin', phone);
    return new Response(JSON.stringify({ ok: true, skipped: 'super_admin' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }


  try {
    const { session, expired } = await getSession(supa, phone);

    if (session?.bot_paused_until && new Date(session.bot_paused_until) > new Date()) {
      console.log('BOT_CLIENT paused for', phone);
      return new Response(JSON.stringify({ ok: true, paused: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Session expired notice (only when there was a pending flow)
    if (expired) {
      await saveSession(supa, phone, null, {});
      await sendWa(supa, phone, SESSION_EXPIRED, 'bot_client_session_expired');
      return new Response(JSON.stringify({ ok: true, expired: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let intent = session?.pending_intent ?? null;
    let data = session?.pending_data ?? {};

    let reply = '';

    // PRIORITY 0: back-to-menu commands (0 / menu / retour / annuler)
    if (BACK_TO_MENU.test(nMsg)) {
      await saveSession(supa, phone, null, {});
      reply = MAIN_MENU;
    }
    // PRIORITY 1: greetings / menu triggers always reset session
    else if (MENU_TRIGGERS.test(nMsg)) {
      await saveSession(supa, phone, null, {});
      reply = MAIN_MENU;
    }
    // PRIORITY 2: numeric menu choice 1-5 always wins over any session content
    else if (/^[1-5]$/.test(nMsg)) {
      await saveSession(supa, phone, null, {});
      reply = await handleMenuChoice(supa, phone, input.from_name ?? null, nMsg, msg);
    }

    // PRIORITY 2b: OUI / NON → confirm or cancel pending dossier
    else if (/^(oui|ok|yes|y|confirme|confirmer|valide|valider|d accord|daccord)\b/.test(nMsg)) {
      reply = await handleOui(supa, phone, input.from_name ?? null);
    }
    else if (/^(non|no|annul|annuler|refuse|refuser)\b/.test(nMsg)) {
      reply = await handleNon(supa, phone, input.from_name ?? null);
    }
    // PRIORITY 3a: MODIFIER command → generate edit link
    else if (/^modifier\b/.test(nMsg)) {
      reply = await handleModifierClient(supa, phone);
    }
    // PRIORITY 3: explicit RESERVER command
    else if (/^reserver\s/.test(nMsg)) {
      const p = parseReserver(msg);
      if (!p) {
        reply = withFullMenu(`Format: RESERVER {ref} {poids}kg\nEx: RESERVER 5508 3kg`);
      } else {
        const r = await handleReserver(supa, phone, input.from_name ?? null, p.ref, p.weight);
        reply = r.startsWith('Super') ? r : withFullMenu(r);
      }
    }
    // PRIORITY 4: continuing flows
    else if (intent === 'reserve_name' && msg) {
      data.name = msg;
      await saveSession(supa, phone, 'reserve_address', data);
      reply = withBack(`Merci ${msg.split(' ')[0]} !\nQuelle est l adresse de collecte (Dakar) ?`);
    } else if (intent === 'reserve_address' && msg) {
      data.address = msg;
      await saveSession(supa, phone, 'reserve_description', data);
      reply = withBack(`Bien recu.\nDecrivez votre colis (contenu + valeur estimee) ?`);

    } else if (intent === 'reserve_description' && msg) {
      data.description = msg;
      const { data: dossier, error } = await supa
        .from('dossiers')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000',
          status: 'AWAITING_CLIENT',
          source: 'bot_client_session',
          product_description: msg,
          origin_country: 'SN',
          destination_country: 'FR',
          estimated_weight: data.weight,
          contact_phone: phone,
          buyer_name: data.name,
          intake_method: 'bot',
          assigned_departure_id: data.departure_id,
          skip_whatsapp_trigger: true,
          notes: `Reservation via WhatsApp | Ref: ${data.ref} | Nom: ${data.name} | Adresse: ${data.address} | Desc: ${msg}`,
        })
        .select('id,tracking_id,reference')
        .maybeSingle();

      if (error || !dossier) {
        console.error('BOT_CLIENT create reserve dossier err', error?.message);
        reply = withFullMenu(`Erreur lors de la creation. Reessayez ou contactez ${BOT_PHONE_DISPLAY}.`);
      } else {
        const trk = dossier.tracking_id || dossier.reference;
        await saveSession(supa, phone, null, {});
        reply = withShortMenu(`Parfait ! Votre dossier est enregistre.\nReference : ${trk}\nUn agent vous contactera sous 24h pour finaliser.\n\nMerci de votre confiance Yobbante !`);
      }
    }
    // ---- Quote flow ----
    else if (intent === 'quote_origin' && msg) {
      data.origin = msg;
      await saveSession(supa, phone, 'quote_dest', data);
      reply = withBack(`Vers quelle ville ?`);
    } else if (intent === 'quote_dest' && msg) {
      data.dest = msg;
      await saveSession(supa, phone, 'quote_weight', data);
      reply = withBack(`Poids (kg) ?`);
    } else if (intent === 'quote_weight' && msg) {
      const w = parseFloat(nMsg.replace(',', '.'));
      if (!w || w <= 0) {
        reply = withBack(`Poids invalide. Indiquez en kg (ex: 5)`);

      } else {
        const r = await handleQuoteCalc(supa, data.dest, w);
        await saveSession(supa, phone, null, {});
        reply = withShortMenu(r);
      }
    }
    // ---- Shipment flow ----
    else if (intent === 'ship_origin' && msg) {
      data.origin = msg;
      await saveSession(supa, phone, 'ship_dest', data);
      reply = withBack(`Vers quelle ville ?`);
    } else if (intent === 'ship_dest' && msg) {
      data.dest = msg;
      await saveSession(supa, phone, 'ship_weight', data);
      reply = withBack(`Poids estime (kg) ?`);
    } else if (intent === 'ship_weight' && msg) {
      const w = parseFloat(nMsg.replace(',', '.'));
      if (!w || w <= 0) {
        reply = withBack(`Poids invalide. Indiquez en kg (ex: 5)`);
      } else {
        data.weight = w;
        await saveSession(supa, phone, 'ship_name', data);
        reply = withBack(`Merci. Quel est votre nom complet ?`);
      }
    } else if (intent === 'ship_name' && msg) {
      data.name = msg;
      await saveSession(supa, phone, 'ship_phone', data);
      reply = withBack(`Quel numero de telephone doit etre associe a l expedition ?`);
    } else if (intent === 'ship_phone' && msg) {
      const digits = msg.replace(/\D/g, '');
      if (digits.length < 8) {
        reply = withBack(`Numero invalide. Envoyez un numero complet.`);

      } else {
        data.client_phone = msg;
        const est = await handleQuoteCalc(supa, data.dest, data.weight);
        const { data: dossier, error } = await supa
          .from('dossiers')
          .insert({
            user_id: '00000000-0000-0000-0000-000000000000',
            status: 'AWAITING_CLIENT',
            source: 'bot_client_session',
            product_description: `Expedition ${data.origin} -> ${data.dest}`,
            origin_country: 'SN',
            destination_country: 'FR',
            estimated_weight: data.weight,
            contact_phone: msg,
            buyer_name: data.name,
            intake_method: 'bot',
            skip_whatsapp_trigger: true,
            notes: `Origine: ${data.origin} | Dest: ${data.dest} | Nom: ${data.name} | Tel: ${msg}`,
          })
          .select('id,tracking_id,reference')
          .maybeSingle();

        if (!dossier || error) {
          console.error('BOT_CLIENT create ship dossier err', error?.message);
          reply = withFullMenu(`Erreur lors de la creation. Reessayez ou contactez ${BOT_PHONE_DISPLAY}.`);
        } else {
          const trk = dossier.tracking_id || dossier.reference || '';
          await saveSession(supa, phone, null, {});
          reply = withShortMenu(`${est}\n\nDossier cree : ${trk}\nUn agent vous contactera.`);
        }
      }
    }
    // ---- Tracking flow ----
    else if (intent === 'await_tracking' && msg) {
      const r = await handleTrackingLookup(supa, msg);
      await saveSession(supa, phone, null, {});
      reply = withShortMenu(r);
    }
    // ---- Direct tracking number outside flow ----
    else if (/^yob[-\s]?[a-z0-9]{4,}/i.test(msg)) {
      const r = await handleTrackingLookup(supa, msg);
      reply = withShortMenu(r);
    } else if (!nMsg) {
      reply = MAIN_MENU;
    } else {
      // Unrecognized → full menu
      reply = withFullMenu(FALLBACK);
    }

    if (reply) {
      await sendWa(supa, phone, reply, 'bot_client_reply');
      // Si la réponse contient le menu principal, ajouter des boutons interactifs
      // (les ids matchent les commandes texte existantes "2"/"3"/"5").
      if (reply.includes(MAIN_MENU) || reply.includes(SHORT_MENU)) {
        await sendWaButtons(
          phone,
          'Choisissez une option :',
          [
            { id: '2', label: 'Mes colis' },
            { id: '3', label: 'Envoyer' },
            { id: '5', label: 'Un agent' },
          ],
          'Tapez 2 pour suivre, 3 pour envoyer, 5 pour un agent.',
          'bot_client_menu_buttons',
        );
      }
    }
  } catch (e) {
    console.error('BOT_CLIENT error', e instanceof Error ? e.message : String(e));
    try {
      await sendWa(supa, phone, withFullMenu(FALLBACK), 'bot_client_error');
    } catch {}
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
