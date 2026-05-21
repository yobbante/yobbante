// gp-bot — assistant WhatsApp tolerant pour transporteurs Yobbanté (122).
// Parser tolérant + conversation guidée + onboarding + alertes admin.
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
  transporteur_id?: string | null;
  message?: string | null;
}

// =================================================================
//  Utilitaires de normalisation
// =================================================================

function normalize(text: string): string {
  return (text ?? '')
    .toString()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const FRENCH_MONTHS: Record<string, number> = {
  'janv': 1, 'janvier': 1, 'jan': 1,
  'fev': 2, 'fevr': 2, 'fevrier': 2, 'feb': 2,
  'mars': 3, 'mar': 3,
  'avr': 4, 'avril': 4, 'apr': 4,
  'mai': 5, 'may': 5,
  'juin': 6, 'jun': 6,
  'juil': 7, 'juillet': 7, 'jul': 7,
  'aout': 8, 'aug': 8,
  'sept': 9, 'septembre': 9, 'sep': 9,
  'oct': 10, 'octobre': 10,
  'nov': 11, 'novembre': 11,
  'dec': 12, 'decembre': 12,
};

function parseDateLoose(input: string): string | null {
  if (!input) return null;
  const raw = normalize(input).replace(/\s+/g, ' ').trim();

  // JJ/MM, JJ-MM, JJ.MM, JJ/MM/AAAA
  let m = raw.match(/(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    let year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // JJMMAAAA (8 digits compact)
  m = raw.match(/\b(\d{2})(\d{2})(\d{4})\b/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 28 mai / 28mai / 28 mai 2026
  m = raw.match(/(\d{1,2})\s?([a-z]+)\.?(?:\s?(\d{4}))?/);
  if (m) {
    const day = parseInt(m[1], 10);
    const monthName = m[2];
    const month = FRENCH_MONTHS[monthName] || FRENCH_MONTHS[monthName.slice(0, 4)] || FRENCH_MONTHS[monthName.slice(0, 3)];
    const year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return null;
}

function parseWeight(input: string): number | null {
  if (!input) return null;
  const m = normalize(input).match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|k)?/);
  if (!m) return null;
  const v = parseFloat(m[1].replace(',', '.'));
  return isNaN(v) || v <= 0 ? null : v;
}

function parseTracking(input: string): string | null {
  if (!input) return null;
  // Cherche YOB[-]?XXXXXX (tracking_id v2 = YOB-6chars)
  const m = input.toUpperCase().match(/YOB[-\s]?([A-Z0-9]{6})/);
  if (m) return `YOB-${m[1]}`;
  // Référence dossier YBT-YYYY-NNNN
  const m2 = input.toUpperCase().match(/YBT[-\s]?(\d{4})[-\s]?(\d{4})/);
  if (m2) return `YBT-${m2[1]}-${m2[2]}`;
  return null;
}

function formatDateFr(iso: string): string {
  const dt = new Date(iso);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

// =================================================================
//  Messages canoniques (sans accents, compatibilité WhatsApp basique)
// =================================================================

const HELP_TEXT = `Bienvenue sur Yobbante GP 👋
Je suis votre assistant automatique.
Voici comment je fonctionne :

📅 ENREGISTRER UN DEPART
Envoyez : DEP [ville] [date] [poids]kg
Exemple : DEP Paris 28/05 25kg

✅ CONFIRMER UNE COLLECTE
Envoyez : COLLECTE [numero de suivi]
Exemple : COLLECTE YOB-K7M9P2

⚖️ ENREGISTRER LE POIDS
Envoyez : POIDS [numero] [poids]kg
Exemple : POIDS YOB-K7M9P2 2.3kg

🏠 CONFIRMER UNE LIVRAISON
Envoyez : LIVRE [numero de suivi]
Exemple : LIVRE YOB-K7M9P2

📦 VOS COLIS EN COURS
Envoyez : MES MISSIONS

🚀 VOS PROCHAINS DEPARTS
Envoyez : MES DEPARTS

❓ AFFICHER CE MENU
Envoyez : AIDE

Pour toute urgence : +221784604003`;

const ONBOARDING_TEXT = `Bonjour ! 👋
Ce numero est reserve aux transporteurs partenaires de Yobbante.

Si vous etes transporteur et souhaitez rejoindre notre reseau :
👉 konnekt.app/beta

Si vous etes deja partenaire et avez un probleme d'acces, contactez-nous :
+221784604003

Merci !`;

// =================================================================
//  Main handler
// =================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  let input: BotInput;
  try {
    input = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const fromPhone = input.from_phone;
  const rawMsg = (input.message ?? '').trim();
  const msg = normalize(rawMsg);

  console.log('GP_BOT msg', JSON.stringify({ from: fromPhone.slice(-4), msg: msg.slice(0, 80) }));

  // ---------- Resolve transporteur ----------
  let transporteur: any = null;
  if (input.transporteur_id) {
    const { data } = await supa.from('transporteurs').select('*').eq('id', input.transporteur_id).maybeSingle();
    transporteur = data;
  }
  if (!transporteur) {
    const tail = fromPhone.slice(-9);
    const { data } = await supa
      .from('transporteurs')
      .select('*')
      .or(`telephone_1.ilike.%${tail}%,whatsapp.ilike.%${tail}%`)
      .limit(1)
      .maybeSingle();
    transporteur = data;
  }

  // ---------- Helpers ----------
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
    } catch (e) {
      console.error('WA_ERROR send', e);
    }
  }

  async function reply(text: string, intent?: string) {
    await sendWa({
      recipient_phone: fromPhone,
      recipient_type: 'gp',
      message: text,
      transporteur_id: transporteur?.id,
      trigger_type: intent ?? 'gp_bot_reply',
    });
    if (input.inbound_id) {
      try {
        await supa
          .from('whatsapp_inbound_messages')
          .update({ bot_intent: intent ?? null, bot_response: text, replied_at: new Date().toISOString() })
          .eq('id', input.inbound_id);
      } catch (e) {
        console.error('WA_ERROR inbound update', e);
      }
    }
  }

  async function notifyAdmin(text: string) {
    const adminPhone = Deno.env.get('ADMIN_WHATSAPP_NUMBER');
    if (!adminPhone) return;
    await sendWa({
      recipient_phone: adminPhone,
      recipient_type: 'admin',
      message: text,
      trigger_type: 'admin_gp_alert',
    });
  }

  // ---------- Onboarding numéros inconnus ----------
  if (!transporteur) {
    try {
      await supa.from('gp_unknown_contacts').insert({
        phone: fromPhone,
        from_name: input.from_name ?? null,
        message: rawMsg.slice(0, 500),
      });
    } catch (e) {
      console.error('WA_ERROR log unknown', e);
    }
    await reply(ONBOARDING_TEXT, 'onboarding_unknown');
    await notifyAdmin(`Nouveau contact sur le 122 :
${fromPhone}${input.from_name ? ` (${input.from_name})` : ''}
"${rawMsg.slice(0, 100)}"`);
    return new Response('ok', { headers: corsHeaders });
  }

  // ---------- Bot en pause (admin a pris le relais) ----------
  if (transporteur.bot_paused_until && new Date(transporteur.bot_paused_until) > new Date()) {
    console.log('GP_BOT paused for', transporteur.reference);
    // L'inbound est déjà loggé par le webhook. On notifie juste l'admin si pas déjà fait récemment.
    return new Response('ok', { headers: corsHeaders });
  }

  const prenom = transporteur.prenom || (transporteur.nom ?? '').split(' ')[0] || 'partenaire';

  // ---------- Charger session en cours ----------
  const { data: session } = await supa
    .from('gp_bot_sessions')
    .select('*')
    .eq('from_phone', fromPhone)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Session vieille de plus de 10 min → expirée
  const sessionActive = session
    && session.pending_intent
    && (Date.now() - new Date(session.updated_at).getTime()) < 10 * 60 * 1000;

  async function clearSession() {
    if (session?.id) {
      await supa.from('gp_bot_sessions').delete().eq('id', session.id);
    }
  }

  async function saveSession(intent: string, data: Record<string, unknown>) {
    if (session?.id) {
      await supa.from('gp_bot_sessions').update({
        pending_intent: intent,
        pending_data: data,
      }).eq('id', session.id);
    } else {
      await supa.from('gp_bot_sessions').insert({
        transporteur_id: transporteur.id,
        from_phone: fromPhone,
        pending_intent: intent,
        pending_data: data,
      });
    }
  }

  // ---------- Commande d'annulation explicite ----------
  if (/^(annul|stop|cancel|reset)/i.test(msg)) {
    await clearSession();
    await reply(`OK, action annulee. Tapez AIDE pour les commandes.`, 'cancel');
    return new Response('ok', { headers: corsHeaders });
  }

  // =================================================================
  //  Détection d'intent
  // =================================================================

  const isAide = /^(aide|help|menu|\?)$/.test(msg);
  const isStart = /^(start|bonjour|hello|salam|salut|coucou|hi|hey)\b/i.test(rawMsg) || msg === '';
  const isMesDeparts = /^(mes\s+departs?|liste\s+departs?|mes\s+trajets?)$/.test(msg);
  const isMesMissions = /^(mes\s+missions?|mes\s+colis|mes\s+livraisons?)$/.test(msg);

  if (isAide || (isStart && !sessionActive)) {
    await clearSession();
    if (isStart && !isAide) {
      await reply(`Bonjour ${prenom} ! 👋
Tapez AIDE pour voir toutes les commandes disponibles.`, 'start');
    } else {
      await reply(HELP_TEXT, 'help');
    }
    return new Response('ok', { headers: corsHeaders });
  }

  // ---------- MES DEPARTS ----------
  if (isMesDeparts) {
    await clearSession();
    const { data } = await supa
      .from('manual_departures')
      .select('short_ref, destination, departure_date, total_capacity_kg, available_capacity_kg')
      .eq('transporteur_ref', transporteur.reference)
      .gte('departure_date', new Date().toISOString().slice(0, 10))
      .order('departure_date', { ascending: true })
      .limit(20);
    if (!data || data.length === 0) {
      await reply(`Aucun depart programme.\nTapez DEP [ville] [date] [Xkg] pour en creer un.`, 'mes_departs');
    } else {
      const lines = data.map((d) => {
        const dStr = d.departure_date ? formatDateFr(d.departure_date) : '?';
        const used = (d.total_capacity_kg ?? 0) - (d.available_capacity_kg ?? 0);
        return `Ref ${d.short_ref} - ${d.destination ?? '?'} - ${dStr} - ${used}/${d.total_capacity_kg}kg`;
      }).join('\n');
      await reply(`📋 Vos prochains departs :\n${lines}`, 'mes_departs');
    }
    return new Response('ok', { headers: corsHeaders });
  }

  // ---------- MES MISSIONS ----------
  if (isMesMissions) {
    await clearSession();
    const { data } = await supa
      .from('dossiers')
      .select('tracking_id, buyer_name, contact_phone, estimated_weight, actual_weight_kg, status')
      .eq('assigned_transporteur_ref', transporteur.reference)
      .not('status', 'in', '(DELIVERED,ARCHIVED,CANCELLED)')
      .order('updated_at', { ascending: false })
      .limit(20);
    if (!data || data.length === 0) {
      await reply(`Aucune mission active.`, 'mes_missions');
    } else {
      const lines = data.map((d) => {
        const w = d.actual_weight_kg ?? d.estimated_weight ?? '?';
        return `${d.tracking_id ?? '—'} - ${d.buyer_name ?? '?'} - ${w}kg - ${d.status}`;
      }).join('\n');
      await reply(`📦 Vos missions actives :\n${lines}`, 'mes_missions');
    }
    return new Response('ok', { headers: corsHeaders });
  }

  // =================================================================
  //  Détection intent DEP / COLLECTE / POIDS / LIVRE (tolérant)
  // =================================================================

  const hasDepKeyword = /\b(dep|depart|departure|trajet)\b/.test(msg);
  const hasCollectKeyword = /\b(collect|pris|recup|recupere|prise)\b/.test(msg) || /\bok\s+collect/.test(msg);
  const hasPoidsKeyword = /\b(poids|pese|weight|fait\s+\d|pesant)\b/.test(msg);
  const hasLivreKeyword = /\b(livr|delivered|remis|depose|livraison)\b/.test(msg);

  // ---------- DEP : enregistrer un départ ----------
  if (hasDepKeyword || (!sessionActive && /\d{1,2}[\/.\-]\d{1,2}/.test(rawMsg) && /\d+\s*kg/i.test(rawMsg))) {
    return await handleDep(rawMsg, {});
  }
  if (sessionActive && session!.pending_intent === 'dep') {
    return await handleDep(rawMsg, (session!.pending_data ?? {}) as Record<string, any>);
  }

  // ---------- COLLECTE ----------
  if (hasCollectKeyword) {
    return await handleCollecte(rawMsg, {});
  }
  if (sessionActive && session!.pending_intent === 'collecte') {
    return await handleCollecte(rawMsg, (session!.pending_data ?? {}) as Record<string, any>);
  }

  // ---------- POIDS ----------
  if (hasPoidsKeyword) {
    return await handlePoids(rawMsg, {});
  }
  if (sessionActive && session!.pending_intent === 'poids') {
    return await handlePoids(rawMsg, (session!.pending_data ?? {}) as Record<string, any>);
  }

  // ---------- LIVRE ----------
  if (hasLivreKeyword) {
    return await handleLivre(rawMsg, {});
  }
  if (sessionActive && session!.pending_intent === 'livre') {
    return await handleLivre(rawMsg, (session!.pending_data ?? {}) as Record<string, any>);
  }

  // ---------- Fallback : intent inconnu ----------
  await notifyAdmin(`Commande non comprise de ${prenom} (Ref ${transporteur.reference}) :
"${rawMsg.slice(0, 150)}"
A traiter manuellement.`);
  await reply(`Je n'ai pas compris votre message. 🤔
Tapez AIDE pour voir toutes les commandes disponibles.`, 'unknown');
  return new Response('ok', { headers: corsHeaders });

  // =================================================================
  //  Handlers d'intent
  // =================================================================

  async function handleDep(text: string, prior: Record<string, any>) {
    // Strip keyword
    const cleaned = text.replace(/\b(dep|depart|départ|departure|trajet)\b\s*/i, '').trim();

    // Extract weight first (clearest marker)
    let weight = prior.weight as number | null | undefined;
    const wMatch = cleaned.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|k)\b/i);
    if (!weight && wMatch) weight = parseFloat(wMatch[1].replace(',', '.'));

    // Extract date
    let dateIso = prior.date as string | null | undefined;
    if (!dateIso) dateIso = parseDateLoose(cleaned);

    // City: what remains after stripping date + weight tokens
    let city = prior.city as string | undefined;
    if (!city) {
      let cityCandidate = cleaned
        .replace(/\d+(?:[.,]\d+)?\s*(?:kg|kilos?|k)\b/gi, ' ')
        .replace(/\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?/g, ' ')
        .replace(/\b\d{1,2}\s?[a-zA-Zéû]+\.?\s?\d{0,4}\b/g, (m) => /\d/.test(m) && /[a-z]/i.test(m) ? ' ' : m)
        .replace(/[,;]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      // If a session has no city stored and the cleaned cityCandidate is empty, treat as missing
      if (cityCandidate.length >= 2 && /[a-z]/i.test(cityCandidate)) {
        city = cityCandidate;
      }
    }

    const collected = { city, date: dateIso, weight };

    // Demande progressive
    if (!city) {
      await saveSession('dep', collected);
      await reply(`Vers quelle ville partez-vous ?`, 'dep_ask_city');
      return new Response('ok', { headers: corsHeaders });
    }
    if (!dateIso) {
      await saveSession('dep', collected);
      await reply(`Quelle est la date de depart ? (ex: 28/05)`, 'dep_ask_date');
      return new Response('ok', { headers: corsHeaders });
    }
    if (!weight) {
      await saveSession('dep', collected);
      await reply(`Quelle est votre capacite en kg ?`, 'dep_ask_weight');
      return new Response('ok', { headers: corsHeaders });
    }

    // Tout est OK → on crée
    const capacity = Math.max(1, Math.round(weight));
    const { data: dep, error } = await supa
      .from('manual_departures')
      .insert({
        transporteur_ref: transporteur.reference,
        destination: city,
        departure_date: dateIso,
        total_capacity_kg: capacity,
        available_capacity_kg: capacity,
        status: 'active',
      })
      .select('short_ref')
      .maybeSingle();

    await clearSession();

    if (error) {
      console.error('WA_ERROR dep insert', error.message);
      await reply(`Desole, impossible d'enregistrer ce depart : ${error.message}`, 'dep_error');
      return new Response('ok', { headers: corsHeaders });
    }

    const dStr = formatDateFr(dateIso);
    await reply(`✅ Depart enregistre !
Ref #${dep?.short_ref} - ${city} - ${dStr} - ${capacity}kg
Visible sur yobbante.com sous 1h.
Tapez AIDE pour toutes les commandes.`, 'dep_ok');

    await notifyAdmin(`Nouveau depart enregistre par ${prenom} (Ref ${transporteur.reference}) :
Ref #${dep?.short_ref} - ${city} - ${dStr} - ${capacity}kg`);
    return new Response('ok', { headers: corsHeaders });
  }

  async function handleCollecte(text: string, prior: Record<string, any>) {
    let tracking = (prior.tracking as string | undefined) ?? parseTracking(text);
    if (!tracking) {
      await saveSession('collecte', {});
      await reply(`Quel est le numero de suivi du colis ?
(Exemple : YOB-K7M9P2)`, 'collecte_ask_tracking');
      return new Response('ok', { headers: corsHeaders });
    }

    const { data: dossier } = await supa
      .from('dossiers')
      .select('id, assigned_transporteur_ref, status, tracking_id, contact_phone, buyer_name')
      .or(`tracking_id.eq.${tracking},reference.eq.${tracking}`)
      .maybeSingle();

    if (!dossier) {
      await clearSession();
      await reply(`Tracking ${tracking} non trouve. Verifiez le numero et reessayez.`, 'collecte_notfound');
      return new Response('ok', { headers: corsHeaders });
    }
    if (dossier.assigned_transporteur_ref !== transporteur.reference) {
      await clearSession();
      await reply(`Ce dossier ne vous est pas assigne.`, 'collecte_unauthorized');
      return new Response('ok', { headers: corsHeaders });
    }

    const { error } = await supa
      .from('dossiers')
      .update({ status: 'COLLECTED', collected_at: new Date().toISOString() })
      .eq('id', dossier.id);

    await clearSession();

    if (error) {
      await reply(`Erreur : ${error.message}`, 'collecte_error');
    } else {
      await reply(`✅ Collecte enregistree pour ${dossier.tracking_id}.
Pesez le colis et envoyez :
POIDS ${dossier.tracking_id} X.Xkg`, 'collecte_ok');
      await notifyAdmin(`${prenom} (Ref ${transporteur.reference}) a confirme la collecte de ${dossier.tracking_id} (${dossier.buyer_name ?? '—'})`);
    }
    return new Response('ok', { headers: corsHeaders });
  }

  async function handlePoids(text: string, prior: Record<string, any>) {
    let tracking = (prior.tracking as string | undefined) ?? parseTracking(text);
    let weight = (prior.weight as number | undefined) ?? parseWeight(text);

    if (!tracking) {
      await saveSession('poids', { weight });
      await reply(`Quel est le numero de suivi du colis ?
(Exemple : YOB-K7M9P2)`, 'poids_ask_tracking');
      return new Response('ok', { headers: corsHeaders });
    }
    if (!weight) {
      await saveSession('poids', { tracking });
      await reply(`Quel est le poids du colis en kg ? (Exemple : 2.3)`, 'poids_ask_weight');
      return new Response('ok', { headers: corsHeaders });
    }

    const { data: dossier } = await supa
      .from('dossiers')
      .select('id, assigned_transporteur_ref, tracking_id, destination_country, estimated_cost, buyer_name')
      .or(`tracking_id.eq.${tracking},reference.eq.${tracking}`)
      .maybeSingle();

    if (!dossier) {
      await clearSession();
      await reply(`Tracking ${tracking} non trouve.`, 'poids_notfound');
      return new Response('ok', { headers: corsHeaders });
    }
    if (dossier.assigned_transporteur_ref !== transporteur.reference) {
      await clearSession();
      await reply(`Ce dossier ne vous est pas assigne.`, 'poids_unauthorized');
      return new Response('ok', { headers: corsHeaders });
    }

    let amountXof: number | null = null;
    try {
      const { data: quote } = await supa.rpc('calculate_quote', {
        p_origin_country: 'FR',
        p_destination_country: dossier.destination_country || 'SN',
        p_weight_kg: weight,
        p_transport_type: 'air',
        p_priority: 'normal',
      });
      const row = Array.isArray(quote) ? quote[0] : quote;
      const eur = row?.price_eur;
      if (typeof eur === 'number') amountXof = Math.round(eur * 655.957);
    } catch (e) {
      console.error('WA_ERROR pricing', e);
    }

    const updates: Record<string, any> = {
      status: 'WEIGHED',
      actual_weight_kg: weight,
      weighed_at: new Date().toISOString(),
      payment_status: 'pending',
    };
    if (amountXof) updates.final_amount_xof = amountXof;

    const { error } = await supa.from('dossiers').update(updates).eq('id', dossier.id);

    await clearSession();

    if (error) {
      await reply(`Erreur : ${error.message}`, 'poids_error');
    } else {
      await reply(`✅ Poids ${weight}kg enregistre pour ${dossier.tracking_id}.
${amountXof ? `Montant final : ${amountXof.toLocaleString('fr-FR')} XOF.` : `Montant final en cours de calcul.`}
Client notifie pour paiement.`, 'poids_ok');
      await notifyAdmin(`${prenom} (Ref ${transporteur.reference}) a pese ${dossier.tracking_id} : ${weight}kg`);
    }
    return new Response('ok', { headers: corsHeaders });
  }

  async function handleLivre(text: string, prior: Record<string, any>) {
    let tracking = (prior.tracking as string | undefined) ?? parseTracking(text);
    if (!tracking) {
      await saveSession('livre', {});
      await reply(`Quel est le numero de suivi du colis livre ?
(Exemple : YOB-K7M9P2)`, 'livre_ask_tracking');
      return new Response('ok', { headers: corsHeaders });
    }

    const { data: dossier } = await supa
      .from('dossiers')
      .select('id, assigned_transporteur_ref, tracking_id, destination_country, destination_city, buyer_name')
      .or(`tracking_id.eq.${tracking},reference.eq.${tracking}`)
      .maybeSingle();

    if (!dossier) {
      await clearSession();
      await reply(`Tracking ${tracking} non trouve.`, 'livre_notfound');
      return new Response('ok', { headers: corsHeaders });
    }
    if (dossier.assigned_transporteur_ref !== transporteur.reference) {
      await clearSession();
      await reply(`Ce dossier ne vous est pas assigne.`, 'livre_unauthorized');
      return new Response('ok', { headers: corsHeaders });
    }

    const { error } = await supa
      .from('dossiers')
      .update({ status: 'DELIVERED', delivered_at: new Date().toISOString() })
      .eq('id', dossier.id);

    await clearSession();

    if (error) {
      await reply(`Erreur : ${error.message}`, 'livre_error');
    } else {
      await reply(`✅ Livraison confirmee pour ${dossier.tracking_id}. Merci !`, 'livre_ok');
      await notifyAdmin(`${prenom} (Ref ${transporteur.reference}) a confirme la livraison de ${dossier.tracking_id} a ${dossier.destination_city ?? dossier.destination_country ?? '—'}`);
    }
    return new Response('ok', { headers: corsHeaders });
  }
});
