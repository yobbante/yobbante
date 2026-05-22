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

const FALLBACK = `Je n ai pas compris.

Tapez AIDE ou appelez le ${BOT_PHONE_DISPLAY}`;

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

async function getSession(supa: any, phone: string) {
  const { data } = await supa
    .from('client_bot_sessions')
    .select('*')
    .eq('from_phone', phone)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  // Timeout
  const age = Date.now() - new Date(data.updated_at).getTime();
  if (age > SESSION_TIMEOUT_MS) {
    return { ...data, pending_intent: null, pending_data: {} };
  }
  return data;
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

async function handleReserver(supa: any, phone: string, name: string | null, ref: string, weight: number) {
  // Find departure by short_ref OR transporteur_ref
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
  // Create dossier
  const { data: dossier, error } = await supa
    .from('dossiers')
    .insert({
      user_id: '00000000-0000-0000-0000-000000000000', // placeholder until claim
      status: 'AWAITING_CLIENT',
      source: 'bot_client_session',
      product_description: 'Reservation via WhatsApp',
      origin_country: 'SN',
      destination_country: 'FR',
      estimated_weight: weight,
      contact_phone: phone,
      assigned_departure_id: dep.id,
      intake_method: 'bot',
      skip_whatsapp_trigger: true,
    })
    .select('id,tracking_id,reference')
    .maybeSingle();
  if (error || !dossier) {
    console.error('BOT_CLIENT create dossier err', error?.message);
    return `Erreur lors de la creation. Reessayez ou contactez ${BOT_PHONE_DISPLAY}.`;
  }
  const trk = dossier.tracking_id || dossier.reference;
  await saveSession(supa, phone, 'await_name', {
    dossier_id: dossier.id,
    step: 'name',
    ref,
    weight,
  });
  return `Super ! Reservation en cours.\n\nDossier : ${trk}\nDepart : Ref #${ref} - ${fmtDate(dep.departure_date)}\nPoids : ${weight}kg\n\nPour finaliser, donnez-nous :\nVotre nom complet ?`;
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
  // Map common dest names to ISO
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
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        destination_country: destCountry,
        real_weight_kg: weight,
        transport_mode: 'air',
      }),
    });
    const air = await res.json().catch(() => null);

    const res2 = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/pricing-calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        destination_country: destCountry,
        real_weight_kg: weight,
        transport_mode: 'sea_lcl',
      }),
    });
    const sea = await res2.json().catch(() => null);

    const airPrice = air?.price_xof ?? air?.total_xof ?? null;
    const seaPrice = sea?.price_xof ?? sea?.total_xof ?? null;
    let body = `Estimation Yobbante :\nDakar -> ${dest} - ${weight}kg :\n`;
    if (airPrice) body += `Aerien : ${airPrice.toLocaleString('fr-FR')} XOF (3-7 jours)\n`;
    if (seaPrice) body += `Maritime : ${seaPrice.toLocaleString('fr-FR')} XOF (25-30 jours)\n`;
    if (!airPrice && !seaPrice) body += `Nous recherchons la meilleure option. Un agent vous contactera.\n`;
    body += `\nPour reserver : yobbante.com\nou repondez OUI`;
    return body;
  } catch (e) {
    console.error('BOT_CLIENT pricing err', e);
    return `Estimation indisponible pour le moment.\nUn agent vous contactera.`;
  }
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

  try {
    const session = await getSession(supa, phone);

    // Bot paused?
    if (session?.bot_paused_until && new Date(session.bot_paused_until) > new Date()) {
      console.log('BOT_CLIENT paused for', phone);
      return new Response(JSON.stringify({ ok: true, paused: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const intent = session?.pending_intent ?? null;
    const data = session?.pending_data ?? {};

    let reply = '';

    // ============ Continuing flows ============
    if (intent === 'await_name' && msg) {
      data.name = msg;
      await supa.from('dossiers').update({ notes: `Nom client: ${msg}` }).eq('id', data.dossier_id);
      await saveSession(supa, phone, 'await_address', data);
      reply = `Merci ${msg.split(' ')[0]} !\nQuelle est l adresse de collecte (Dakar) ?`;
    } else if (intent === 'await_address' && msg) {
      data.address = msg;
      await saveSession(supa, phone, 'await_description', data);
      reply = `Bien recu.\nDecrivez votre colis (contenu + valeur estimee) ?`;
    } else if (intent === 'await_description' && msg) {
      data.description = msg;
      await supa
        .from('dossiers')
        .update({
          product_description: msg,
          notes: `Nom: ${data.name} | Adresse: ${data.address} | Desc: ${msg}`,
        })
        .eq('id', data.dossier_id);
      await saveSession(supa, phone, null, {});
      reply = `Parfait ! Votre dossier est enregistre.\nUn agent vous contactera sous 24h pour finaliser.\n\nMerci de votre confiance Yobbante !`;
    }
    // ---- Quote flow ----
    else if (intent === 'quote_origin' && msg) {
      data.origin = msg;
      await saveSession(supa, phone, 'quote_dest', data);
      reply = `Vers quelle ville ?`;
    } else if (intent === 'quote_dest' && msg) {
      data.dest = msg;
      await saveSession(supa, phone, 'quote_weight', data);
      reply = `Poids (kg) ?`;
    } else if (intent === 'quote_weight' && msg) {
      const w = parseFloat(nMsg.replace(',', '.'));
      if (!w || w <= 0) {
        reply = `Poids invalide. Indiquez en kg (ex: 5)`;
      } else {
        reply = await handleQuoteCalc(supa, data.dest, w);
        await saveSession(supa, phone, null, {});
      }
    }
    // ---- Shipment flow ----
    else if (intent === 'ship_origin' && msg) {
      data.origin = msg;
      await saveSession(supa, phone, 'ship_dest', data);
      reply = `Vers quelle ville ?`;
    } else if (intent === 'ship_dest' && msg) {
      data.dest = msg;
      await saveSession(supa, phone, 'ship_weight', data);
      reply = `Poids estime (kg) ?`;
    } else if (intent === 'ship_weight' && msg) {
      const w = parseFloat(nMsg.replace(',', '.'));
      if (!w || w <= 0) {
        reply = `Poids invalide. Indiquez en kg (ex: 5)`;
      } else {
        const est = await handleQuoteCalc(supa, data.dest, w);
        // Create dossier
        const { data: dossier } = await supa
          .from('dossiers')
          .insert({
            user_id: '00000000-0000-0000-0000-000000000000',
            status: 'AWAITING_CLIENT',
            source: 'whatsapp_bot',
            product_description: `Expedition ${data.origin} -> ${data.dest}`,
            origin_country: 'SN',
            destination_country: 'FR',
            estimated_weight: w,
            contact_phone: phone,
            intake_method: 'bot',
            notes: `Origine: ${data.origin} | Dest: ${data.dest}`,
          })
          .select('id,tracking_id,reference')
          .maybeSingle();
        const trk = dossier?.tracking_id || dossier?.reference || '';
        reply = `${est}\n\nDossier cree : ${trk}\nUn agent vous contactera.`;
        await saveSession(supa, phone, null, {});
      }
    }
    // ---- Tracking flow ----
    else if (intent === 'await_tracking' && msg) {
      reply = await handleTrackingLookup(supa, msg);
      await saveSession(supa, phone, null, {});
    }
    // ============ Direct commands ============
    else if (/^reserver\s/.test(nMsg)) {
      const p = parseReserver(msg);
      if (!p) {
        reply = `Format: RESERVER {ref} {poids}kg\nEx: RESERVER 5508 3kg`;
      } else {
        reply = await handleReserver(supa, phone, input.from_name ?? null, p.ref, p.weight);
      }
    } else if (nMsg === '1') {
      reply = await handleMenu1Departures(supa);
    } else if (nMsg === '2') {
      await saveSession(supa, phone, 'await_tracking', {});
      reply = `Quel est votre numero de suivi ?\n(Format : YOB-XXXXXX)`;
    } else if (nMsg === '3') {
      await saveSession(supa, phone, 'ship_origin', {});
      reply = `D ou part votre colis ?`;
    } else if (nMsg === '4') {
      await saveSession(supa, phone, 'quote_origin', {});
      reply = `Origine ?`;
    } else if (nMsg === '5') {
      const pauseUntil = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      await saveSession(supa, phone, null, {}, pauseUntil);
      // Notify admin
      await sendWa(
        supa,
        ADMIN_PHONE,
        `Client ${input.from_name ?? phone} (${phone}) demande un agent.\nDernier message : "${msg.slice(0, 200)}"`,
        'agent_handoff',
      );
      reply = `Un agent vous contacte sous 2h.\nMerci de votre patience.`;
    } else if (/^(aide|bonjour|salut|hello|hi|menu|help|salam)/.test(nMsg) || !nMsg) {
      reply = MAIN_MENU;
    } else if (/^yob[-\s]?[a-z0-9]{4,}/i.test(msg)) {
      // Direct tracking number
      reply = await handleTrackingLookup(supa, msg);
    } else {
      reply = `${FALLBACK}\n\n${MAIN_MENU}`;
    }

    if (reply) {
      await sendWa(supa, phone, reply, 'bot_client_reply');
    }
  } catch (e) {
    console.error('BOT_CLIENT error', e instanceof Error ? e.message : String(e));
    try {
      await sendWa(supa, phone, FALLBACK, 'bot_client_error');
    } catch {}
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
