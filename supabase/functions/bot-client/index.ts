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
const SESSION_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4h (NLP refonte)
const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const NLP_MODEL = 'google/gemini-2.5-flash';

// --- Weight validation rules ---
const MAX_WEIGHT_KG = 500;
const MIN_WEIGHT_KG = 0.1;
const HEAVY_WEIGHT_THRESHOLD_KG = 30;

type WeightCheck =
  | { ok: true; weight: number; heavy: boolean }
  | { ok: false; error: string };

function validateWeight(raw: string): WeightCheck {
  const w = parseFloat((raw || '').replace(',', '.').replace(/[^\d.,]/g, ''));
  if (!w || isNaN(w) || w <= 0) {
    return { ok: false, error: `Poids invalide. Indiquez en kg (ex: 5)` };
  }
  if (w < MIN_WEIGHT_KG) {
    return { ok: false, error: `Poids minimum ${MIN_WEIGHT_KG}kg.\nQuel est le poids de votre colis ?` };
  }
  if (w > MAX_WEIGHT_KG) {
    return {
      ok: false,
      error:
        `Ce poids semble incorrect.\n` +
        `Le maximum accepte est ${MAX_WEIGHT_KG}kg.\n` +
        `Quel est le poids reel de votre colis ?`,
    };
  }
  return { ok: true, weight: w, heavy: w > HEAVY_WEIGHT_THRESHOLD_KG };
}

// --- Destinations Yobbante reconnues (free-text) ---
// Aliases tolerent typos, accents, abreviations courantes.
const VALID_DESTINATIONS: { city: string; aliases: string[]; country: string }[] = [
  { city: 'Paris', aliases: ['paris', 'pari', 'france', 'fr'], country: 'FR' },
  { city: 'Lyon', aliases: ['lyon'], country: 'FR' },
  { city: 'Marseille', aliases: ['marseille', 'marseill'], country: 'FR' },
  { city: 'Bordeaux', aliases: ['bordeaux', 'bordeau'], country: 'FR' },
  { city: 'Toulouse', aliases: ['toulouse'], country: 'FR' },
  { city: 'Nice', aliases: ['nice'], country: 'FR' },
  { city: 'New York', aliases: ['new york', 'newyork', 'new-york', 'nyc', 'usa', 'us', 'etats unis', 'etats-unis', 'amerique', 'america'], country: 'US' },
  { city: 'Washington', aliases: ['washington', 'washington dc', 'dc'], country: 'US' },
  { city: 'Rhode Island', aliases: ['rhode island', 'rhodeisland', 'providence'], country: 'US' },
  { city: 'Miami', aliases: ['miami'], country: 'US' },
  { city: 'Boston', aliases: ['boston'], country: 'US' },
  { city: 'Montreal', aliases: ['montreal', 'montréal', 'canada', 'ca'], country: 'CA' },
  { city: 'Toronto', aliases: ['toronto'], country: 'CA' },
  { city: 'Dubai', aliases: ['dubai', 'dubaii', 'dubaï', 'doubai', 'doubaï', 'emirats', 'emirates', 'uae', 'eau'], country: 'AE' },
  { city: 'Abidjan', aliases: ['abidjan', 'abdijan', 'abijan', 'cote d ivoire', 'cote divoire', 'cote-divoire', 'ivory coast', 'ci'], country: 'CI' },
  { city: 'Douala', aliases: ['douala', 'cameroun', 'cameroon'], country: 'CM' },
  { city: 'Londres', aliases: ['londres', 'london', 'uk', 'angleterre'], country: 'GB' },
];

function resolveDestination(input?: string | null): { city: string; country: string } | null {
  if (!input) return null;
  const q = (input ?? '')
    .toString()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (!q) return null;
  for (const d of VALID_DESTINATIONS) {
    if (d.aliases.some((a) => q === a || q.includes(a) || a.includes(q))) {
      return { city: d.city, country: d.country };
    }
  }
  return null;
}

const INVALID_DESTINATION_MSG =
  `Je ne reconnais pas cette destination.\n` +
  `Nous desservons : Paris, New York, Dubai, Abidjan, Montreal et plus.\n\n` +
  `Quelle est votre destination ?`;

// --- Detection d'intent pour messages en anglais (deterministe, avant NLP) ---
type Intent2 =
  | 'EXPEDITION' | 'DEVIS' | 'SUIVI' | 'AGENT' | 'DEPARTS' | 'HELP_EN' | null;

function detectEnglishIntent(raw: string): Intent2 {
  const s = (raw ?? '').toLowerCase().trim();
  if (!s) return null;
  // Doit "ressembler" a de l anglais (mots-cles courants) pour eviter les faux positifs.
  const englishMarkers = /\b(what|how|where|when|why|can|could|would|i\s+want|i\s+need|please|hello|hi|hey|help|send|track|package|parcel|agent|human|cost|price|how\s+much)\b/;
  if (!englishMarkers.test(s)) return null;
  if (/\b(agent|human|representative|person|speak\s+to)\b/.test(s)) return 'AGENT';
  if (/\b(where|track)\b.*\b(package|parcel|order|shipment)\b/.test(s)) return 'SUIVI';
  if (/\bwhere\s+is\s+my\b/.test(s)) return 'SUIVI';
  if (/\b(how\s+much|price|cost|rate|quote)\b/.test(s)) return 'DEVIS';
  if (/\b(i\s+want\s+to\s+send|send\s+a?\s*(package|parcel)|ship\s+(a|something))\b/.test(s)) return 'EXPEDITION';
  if (/\b(next\s+departures?|available\s+departures?|when\s+is\s+the\s+next)\b/.test(s)) return 'DEPARTS';
  if (/\b(what\s+can\s+you|what\s+do\s+you\s+do|help|hello|hi|hey)\b/.test(s)) return 'HELP_EN';
  return 'HELP_EN';
}

const HELP_EN_REPLY =
  `Je suis l assistant Yobbante.\n` +
  `Je peux vous aider a :\n` +
  `- envoyer un colis\n` +
  `- suivre votre expedition\n` +
  `- obtenir un devis`;

type Intent =
  | 'DEPARTS'
  | 'SUIVI'
  | 'EXPEDITION'
  | 'DEVIS'
  | 'AGENT'
  | 'PLAINTE'
  | 'CONFIRMATION'
  | 'ANNULATION'
  | 'UNKNOWN';

interface NlpEntities {
  origin: string | null;
  destination: string | null;
  tracking_id: string | null;
  weight: number | null;
  date: string | null;
  response: 'OUI' | 'NON' | null;
}

type Urgency = 'LOW' | 'MEDIUM' | 'HIGH';

interface NlpResult {
  intent: Intent;
  entities: NlpEntities;
  confidence: number;
  urgency: Urgency;
  language: 'fr' | 'en' | 'wo' | 'mixed' | 'other';
}

const NLP_SYSTEM = `Tu es le bot WhatsApp de Yobbante, service logistique Dakar vers le monde.
Analyse le message du client et retourne UNIQUEMENT un JSON valide :
{"intent":"DEPARTS|SUIVI|EXPEDITION|DEVIS|AGENT|PLAINTE|CONFIRMATION|ANNULATION|UNKNOWN","entities":{"origin":string|null,"destination":string|null,"tracking_id":string|null,"weight":number|null,"date":string|null,"response":"OUI"|"NON"|null},"confidence":number,"urgency":"LOW|MEDIUM|HIGH","language":"fr|en|wo|mixed|other"}

REGLES STRICTES :
1. Origine par defaut = Dakar si non specifie.
2. Normaliser destinations vers les villes valides ci-dessous. Si non reconnue, destination=null.
3. Poids accepte en chiffres OU en lettres (ex "cinq kg" = 5). Plage 0.1-500 kg.
4. Si le message est en anglais, l intent reste normal mais la reponse sera en francais (ne change pas l intent).
5. PLAINTE = client mecontent, en colere, parle de probleme grave, retard inacceptable, colis perdu/casse, remboursement, "scandale", "honte", "voleurs", "j en ai marre", "inadmissible". urgency=HIGH.
6. "What can you do" / "que faites-vous" / questions generiques sur le service -> intent=UNKNOWN.
7. Si la ville mentionnee n est pas dans la liste valide -> destination=null (ne JAMAIS inventer).
8. urgency=HIGH si plainte, urgence, "tres urgent", "vite", "aujourd hui meme". MEDIUM si demande sensible. LOW sinon.
9. language : detecter fr, en, wo (wolof : nanga def, jamm, naka, deuk, ndaal, baxna, mbaa), mixed, other.

Exemples:
- "Dakar Paris" -> DEPARTS, origin Dakar, destination Paris, conf 0.95, urgency LOW, language fr
- "je veux envoyer un colis a Paris" -> EXPEDITION, destination Paris, urgency LOW
- "YOB-9KPR4A" ou "YOB9KPR4A" -> SUIVI, tracking_id YOB-9KPR4A
- "mon colis" / "ou est mon colis" -> SUIVI
- "oui","ok","yes","ouii","d accord" -> CONFIRMATION, response OUI
- "non","nop","pas ok","refuse" -> ANNULATION, response NON
- "parler a quelquun","agent","humain","conseiller" -> AGENT
- "combien ca coute pour Paris 5kg" -> DEVIS, destination Paris, weight 5
- "prochains departs" / "departs disponibles" -> DEPARTS
- "annule mon dossier" -> ANNULATION
- "ou est mon colis ca fait 3 semaines c est inadmissible" -> PLAINTE, urgency HIGH
- "I want to send a package" -> EXPEDITION, language en
- "how much for Paris 5kg" -> DEVIS, destination Paris, weight 5, language en
- "where is my package" -> SUIVI, language en
- "speak to an agent" / "human" -> AGENT, language en
- "what can you do" / "hello" -> UNKNOWN (laisser destination null)
- "nanga def" -> UNKNOWN, language wo

REGLE STRICTE : ne JAMAIS mettre une question generique ("what","how","where","que","comment") comme destination.
Destinations valides : Paris, Lyon, Marseille, Bordeaux, Toulouse, Nice, New York, Washington, Rhode Island, Miami, Boston, Montreal, Toronto, Dubai, Abidjan, Douala, Londres.
Reponds STRICTEMENT en JSON, rien d autre.`;

async function classifyMessage(msg: string): Promise<NlpResult | null> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey || !msg.trim()) return null;
  try {
    const resp = await fetch(LOVABLE_AI_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: NLP_MODEL,
        messages: [
          { role: 'system', content: NLP_SYSTEM },
          { role: 'user', content: msg.slice(0, 500) },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!resp.ok) {
      console.error('NLP HTTP', resp.status);
      return null;
    }
    const j = await resp.json();
    const txt = j?.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(txt);
    return {
      intent: (parsed.intent ?? 'UNKNOWN') as Intent,
      entities: {
        origin: parsed.entities?.origin ?? null,
        destination: parsed.entities?.destination ?? null,
        tracking_id: parsed.entities?.tracking_id ?? null,
        weight: typeof parsed.entities?.weight === 'number' ? parsed.entities.weight : null,
        date: parsed.entities?.date ?? null,
        response: parsed.entities?.response ?? null,
      },
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      urgency: (parsed.urgency === 'HIGH' || parsed.urgency === 'MEDIUM' || parsed.urgency === 'LOW') ? parsed.urgency : 'LOW',
      language: (['fr', 'en', 'wo', 'mixed', 'other'].includes(parsed.language)) ? parsed.language : 'fr',
    };
  } catch (e) {
    console.error('NLP parse err', e instanceof Error ? e.message : String(e));
    return null;
  }
}



// --- FAQ deterministe (avant NLP, reponses directes) ---
const FAQ_RESPONSES: Array<{ patterns: RegExp[]; reply: string }> = [
  {
    patterns: [/\bpaiement\b/, /\bpayer\b/, /\bcomment\s+payer\b/, /\bmode\s+de\s+paiement\b/, /\bpayment\b/],
    reply:
      `Modes de paiement Yobbante :\n` +
      `- Wave\n` +
      `- Orange Money\n` +
      `- Especes a la collecte`,
  },
  {
    patterns: [/\bdelai\b/, /\bcombien\s+de\s+temps\b/, /\bdelivery\s+time\b/, /\bquand\s+arrive\b/, /\bca\s+prend\b/],
    reply:
      `Delais moyens depuis Dakar :\n` +
      `- Paris / France : 3-5 jours\n` +
      `- USA / New York : 5-8 jours\n` +
      `- Dubai : 4-6 jours\n` +
      `- Abidjan : 2-3 jours`,
  },
  {
    patterns: [/\bdedouan/, /\bdouane\b/, /\bcustom/, /\bfrais\s+de\s+douane\b/],
    reply: `Le dedouanement est inclus dans le prix affiche. Aucun frais supplementaire a la livraison.`,
  },
  {
    patterns: [/\blivraison\s+(a\s+)?domicile\b/, /\blivrer\s+chez\s+moi\b/, /\bhome\s+delivery\b/],
    reply:
      `Livraison a domicile disponible uniquement a Dakar.\n` +
      `Hors Dakar : retrait au point relais le plus proche.`,
  },
  {
    patterns: [/\bmedicament/, /\bordonnance\b/, /\bmedicine\b/, /\bpharmac/],
    reply: `Medicaments acceptes uniquement avec ordonnance valide.`,
  },
  {
    patterns: [/\btelephone\b/, /\bphones?\b/, /\bsmartphone\b/, /\biphone\b/],
    reply: `Telephones acceptes uniquement avec facture d achat originale.`,
  },
  {
    patterns: [/\bc\s*est\s+quoi\s+un\s+gp\b/, /\bqu\s*est\s*ce\s+qu\s*un\s+gp\b/, /\bdefinition\s+gp\b/, /\bwhat\s+is\s+a\s+gp\b/],
    reply:
      `Un GP (Gros Porteur) est un voyageur partenaire Yobbante.\n` +
      `Il transporte vos colis dans ses bagages lors de ses voyages.\n` +
      `Plus economique et plus rapide qu un transporteur classique.`,
  },
  {
    patterns: [/\bqui\s+etes\s+vous\b/, /\bpresentation\b/, /\byobbante\s+c\s*est\s+quoi\b/, /\bwhat\s+is\s+yobbante\b/, /\babout\s+yobbante\b/],
    reply:
      `Yobbante connecte vos colis aux voyageurs (GP) depuis Dakar.\n` +
      `Envois rapides, prix transparents, suivi en temps reel.\n` +
      `Vers Paris, New York, Dubai, Abidjan et plus.`,
  },
];

function detectFaq(raw: string): string | null {
  const n = norm(raw);
  if (!n) return null;
  for (const f of FAQ_RESPONSES) {
    if (f.patterns.some((p) => p.test(n))) return f.reply;
  }
  return null;
}

// --- Wolof / mixed detection (basique) ---
function detectWolof(raw: string): boolean {
  const n = norm(raw);
  if (!n) return false;
  return /\b(nanga\s*def|naka(?:la|nga)?|jamm|deuk|ndaal|baxna|mbaa|waaw|deedeet|jerejef|wala|sama|sa\s+yoon|am\s+na|amul)\b/.test(n);
}

// --- Plainte / complaint detection deterministe ---
function detectComplaint(raw: string): boolean {
  const n = norm(raw);
  if (!n) return false;
  return /\b(inadmissible|scandale|honte|voleur|arnaque|j\s*en\s*ai\s+marre|c\s*est\s+pas\s+normal|jamais\s+recu|3\s+semaines|trois\s+semaines|remboursement|reclamation|plainte|porter\s+plainte|fraude|escroc)\b/.test(n)
    || /\b(unacceptable|outrageous|refund|scam|fraud|complaint|never\s+received|missing)\b/.test(n);
}

}

// Normalise un nom de ville pour comparaison
function cityMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return norm(a).includes(norm(b)) || norm(b).includes(norm(a));
}

const DESTINATIONS_LIST = [
  { id: 'dest_paris', title: 'Paris / France', city: 'Paris', country: 'FR' },
  { id: 'dest_nyc', title: 'New York / USA', city: 'New York', country: 'US' },
  { id: 'dest_dubai', title: 'Dubai / Emirats', city: 'Dubai', country: 'AE' },
  { id: 'dest_abidjan', title: 'Abidjan / Cote d Ivoire', city: 'Abidjan', country: 'CI' },
  { id: 'dest_montreal', title: 'Montreal / Canada', city: 'Montreal', country: 'CA' },
  { id: 'dest_bordeaux', title: 'Bordeaux / France', city: 'Bordeaux', country: 'FR' },
  { id: 'dest_other', title: 'Autre (taper le nom)', city: '', country: '' },
];

// Guided EXPEDITION (3 etapes a boutons)
const EXP_WEIGHT_OPTIONS = [
  { id: 'expw_1', title: 'Moins de 1 kg', kg: 1 },
  { id: 'expw_5', title: '1 a 5 kg', kg: 5 },
  { id: 'expw_10', title: '5 a 10 kg', kg: 10 },
  { id: 'expw_20', title: '10 a 20 kg', kg: 20 },
  { id: 'expw_more', title: 'Plus de 20 kg', kg: 25 },
];

const EXP_TYPE_OPTIONS = [
  { id: 'expt_docs', title: 'Documents', code: 'documents' },
  { id: 'expt_vet', title: 'Vetements', code: 'vetements' },
  { id: 'expt_elec', title: 'Electronique', code: 'electronique' },
  { id: 'expt_alim', title: 'Alimentaire', code: 'alimentaire' },
  { id: 'expt_autre', title: 'Autre', code: 'autre' },
];

const COUNTRY_BY_CITY: Record<string, string> = {
  paris: 'FR', bordeaux: 'FR', marseille: 'FR', lyon: 'FR', toulouse: 'FR', nice: 'FR',
  'new york': 'US', newyork: 'US', miami: 'US', washington: 'US', boston: 'US',
  dubai: 'AE', 'abu dhabi': 'AE',
  abidjan: 'CI',
  montreal: 'CA', toronto: 'CA',
  londres: 'GB', london: 'GB',
  madrid: 'ES', barcelone: 'ES', barcelona: 'ES',
  rome: 'IT', milan: 'IT',
  bruxelles: 'BE', brussels: 'BE',
  geneve: 'CH', zurich: 'CH',
};

function buildExpedierLink(destCity: string, destCountry: string | null, weightKg: number, typeCode: string): string {
  const country = destCountry || COUNTRY_BY_CITY[norm(destCity)] || 'FR';
  const params = new URLSearchParams({
    origin: 'SN',
    origin_city: 'Dakar',
    destination: country,
    destination_city: destCity,
    weight: String(weightKg),
    type: typeCode,
    transport: 'AIR',
    source: 'wa-bot',
  });
  return `https://yobbante.com/expedier?${params.toString()}`;
}

async function askExpeditionDestination(supa: any, phone: string) {
  await saveSession(supa, phone, 'exp_destination', {});
  await sendWaList(
    phone,
    'Vers quelle destination expedier votre colis ?',
    'Choisir destination',
    [{
      title: 'Destinations',
      rows: DESTINATIONS_LIST.map((d) => ({ id: `expdest_${d.id.replace('dest_', '')}`, title: d.title })),
    }],
    'Tapez le nom de la ville de destination (ex: Paris)',
    'bot_client_exp_destination',
  );
}

async function askExpeditionWeight(supa: any, phone: string, data: Record<string, any>) {
  await saveSession(supa, phone, 'exp_weight', data);
  await sendWaList(
    phone,
    `Vers ${data.dest_city || data.dest}. Quel est le poids estime ?`,
    'Choisir poids',
    [{
      title: 'Poids',
      rows: EXP_WEIGHT_OPTIONS.map((w) => ({ id: w.id, title: w.title })),
    }],
    'Tapez le poids en kg (ex: 5)',
    'bot_client_exp_weight',
  );
}

async function askExpeditionType(supa: any, phone: string, data: Record<string, any>) {
  await saveSession(supa, phone, 'exp_type', data);
  await sendWaList(
    phone,
    'Quel type de contenu ?',
    'Choisir type',
    [{
      title: 'Type de contenu',
      rows: EXP_TYPE_OPTIONS.map((t) => ({ id: t.id, title: t.title })),
    }],
    'Tapez : documents, vetements, electronique, alimentaire ou autre',
    'bot_client_exp_type',
  );
}

async function finalizeExpedition(supa: any, phone: string, data: Record<string, any>): Promise<string> {
  const link = buildExpedierLink(
    data.dest_city || data.dest || 'Paris',
    data.dest_country || null,
    Number(data.weight) || 5,
    data.type_code || 'autre',
  );
  await saveSession(supa, phone, null, {});
  return withShortMenu(
    `Parfait !\n\nVotre expedition :\n* Destination : ${data.dest_city || data.dest}\n* Poids : ~${data.weight} kg\n* Contenu : ${data.type_label || data.type_code}\n\nFinalisez en 1 minute (formulaire pre-rempli) :\n${link}`,
  );
}


async function handleSmartDepartures(
  supa: any,
  phone: string,
  origin: string | null,
  destination: string | null,
): Promise<string> {
  // Pas de destination -> liste interactive
  if (!destination) {
    await saveSession(supa, phone, 'await_destination_departs', { origin: origin ?? 'Dakar' });
    await sendWaList(
      phone,
      'Vers quelle destination ?',
      'Choisir destination',
      [{ title: 'Destinations populaires', rows: DESTINATIONS_LIST.map((d) => ({ id: d.id, title: d.title })) }],
      'Repondez avec votre destination (ex: Paris)',
      'bot_client_destinations',
    );
    return '';
  }

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: deps } = await supa
    .from('public_active_departures')
    .select('short_ref,transporteur_ref,departure_date,origin_city,destination_city,available_capacity_kg')
    .gte('departure_date', today)
    .lte('departure_date', horizon)
    .order('departure_date', { ascending: true })
    .limit(20);

  const filtered = (deps ?? []).filter((d: any) =>
    cityMatch(d.destination_city, destination) &&
    (!origin || cityMatch(d.origin_city, origin)),
  );

  const routeLabel = `${origin ?? 'Dakar'} -> ${destination}`;

  if (filtered.length === 0) {
    await saveSession(supa, phone, 'waitlist_confirm', { origin: origin ?? 'Dakar', destination });
    await sendWaButtons(
      phone,
      `Pas de depart ${routeLabel} dans les 30 prochains jours.\nVoulez-vous qu on vous previenne des qu un depart est dispo ?`,
      [
        { id: 'waitlist_yes', label: 'Oui, me prevenir' },
        { id: 'waitlist_no', label: 'Non merci' },
      ],
      `Pas de depart ${routeLabel}. Tapez OUI pour etre prevenu.`,
      'bot_client_waitlist_offer',
    );
    return '';
  }

  await saveSession(supa, phone, null, {});
  let txt = `Departs ${routeLabel} :\n\n`;
  for (const d of filtered.slice(0, 5)) {
    const ref = d.short_ref || d.transporteur_ref || '----';
    txt += `* ${fmtDate(d.departure_date)} - ${d.available_capacity_kg ?? 0}kg dispo\n  Ref #${ref}\n`;
  }
  txt += `\nPour reserver :\nRESERVER {ref} {poids}kg\nEx: RESERVER ${filtered[0].short_ref || filtered[0].transporteur_ref || 'XXXX'} 3kg`;
  return txt;
}

async function handleWaitlistOptIn(supa: any, phone: string, fromName: string | null, origin: string, destination: string) {
  try {
    await supa.from('waitlist_departures').insert({
      phone,
      origin,
      destination,
      client_name: fromName ?? null,
      source: 'bot_client',
    });
    await sendWa(
      supa,
      ADMIN_PHONE,
      `Waitlist depart : ${fromName ?? phone} (${phone}) veut etre prevenu pour ${origin} -> ${destination}`,
      'admin_notification',
    );
  } catch (e) {
    console.error('WAITLIST insert err', e instanceof Error ? e.message : String(e));
  }
  await saveSession(supa, phone, null, {});
  return withShortMenu(`C est note ! Nous vous previendrons des qu un depart ${origin} -> ${destination} sera disponible.`);
}

async function handleSmartTracking(supa: any, phone: string, trackingFromNlp: string | null): Promise<string> {
  // 1. Si un tracking_id est fourni, l utiliser directement
  if (trackingFromNlp) {
    const r = await handleTrackingLookup(supa, trackingFromNlp);
    await saveSession(supa, phone, null, {});
    return withShortMenu(r);
  }
  // 2. Sinon chercher tous les dossiers liés au téléphone
  const digits = phone.replace(/\D/g, '');
  const variants = [phone, `+${digits}`, digits];
  const orExpr = variants.map((v) => `contact_phone.eq.${v},sender_phone.eq.${v}`).join(',');
  const { data: rows } = await supa
    .from('dossiers')
    .select('tracking_id,reference,status,origin_country,destination_country,updated_at')
    .or(orExpr)
    .order('updated_at', { ascending: false })
    .limit(10);
  const items = (rows ?? []).filter((r: any) => r.tracking_id || r.reference);

  // Aucun dossier → demander tracking
  if (items.length === 0) {
    await saveSession(supa, phone, 'await_tracking', {});
    return withBack(`Quel est votre numero de suivi ?\nIl commence par YOB-`);
  }

  // Un seul dossier → afficher directement
  if (items.length === 1) {
    const d = items[0];
    const id = d.tracking_id || d.reference;
    const label = STATUS_FR[d.status] || d.status;
    const upd = new Date(d.updated_at).toLocaleDateString('fr-FR');
    await saveSession(supa, phone, null, {});
    return withShortMenu(`Votre colis ${id} :\nStatut : ${label}\nRoute : ${d.origin_country} -> ${d.destination_country}\nMise a jour : ${upd}\n\nSuivi complet :\nyobbante.com/suivre/${id}`);
  }

  // Plusieurs → liste interactive
  const active = items.filter((r: any) => !['DELIVERED', 'CANCELLED'].includes(r.status));
  const archived = items.filter((r: any) => ['DELIVERED', 'CANCELLED'].includes(r.status));
  const toRow = (r: any) => {
    const id = (r.tracking_id || r.reference).toString();
    const label = STATUS_FR[r.status] || r.status;
    return { id, title: id.slice(0, 24), description: `${label} - ${r.origin_country}->${r.destination_country}`.slice(0, 72) };
  };
  const sections: Array<{ title: string; rows: any[] }> = [];
  if (active.length) sections.push({ title: 'En cours', rows: active.slice(0, 8).map(toRow) });
  if (archived.length) sections.push({ title: 'Termines', rows: archived.slice(0, 10 - (sections[0]?.rows.length ?? 0)).map(toRow) });
  await saveSession(supa, phone, null, {});
  await sendWaList(
    phone,
    `Vos colis recents (${items.length}) :`,
    'Choisir un colis',
    sections,
    `Vos colis :\n${items.slice(0, 5).map((r: any) => `- ${r.tracking_id || r.reference} (${STATUS_FR[r.status] || r.status})`).join('\n')}`,
    'bot_client_my_packages',
  );
  return '';
}

async function getClientFirstName(supa: any, phone: string, fromName: string | null): Promise<string | null> {
  if (fromName) return fromName.split(' ')[0];
  try {
    const digits = phone.replace(/\D/g, '');
    const variants = [phone, `+${digits}`, digits];
    const { data } = await supa
      .from('dossiers')
      .select('buyer_name')
      .or(variants.map((v) => `contact_phone.eq.${v}`).join(','))
      .not('buyer_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.buyer_name) return String(data.buyer_name).split(' ')[0];
  } catch {}
  return null;
}


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

// Interactive menu prompt — affiche uniquement via liste interactive Meta.
const MAIN_MENU_TEXT = `Bonjour ! Je suis l assistant Yobbante. Comment puis-je vous aider ?`;
const SHORT_MENU_TEXT = `Que souhaitez-vous faire ensuite ?`;
const SESSION_EXPIRED_TEXT = `Votre session a expire.`;
const FALLBACK = `Je veux m assurer de bien vous aider. Que cherchez-vous ?`;

// Sentinels: stripped before envoi, declenchent l UI interactive correspondante.
const UI_MENU = '[[UI_MENU]]';
const UI_BACK = '[[UI_BACK]]';

const MAIN_MENU = `${MAIN_MENU_TEXT}\n${UI_MENU}`;
const SHORT_MENU = `${SHORT_MENU_TEXT}\n${UI_MENU}`;
const SESSION_EXPIRED = `${SESSION_EXPIRED_TEXT}\n${UI_MENU}`;

const MENU_TRIGGERS = /^(aide|bonjour|bonsoir|salut|hello|hi|hey|menu|help|salam|salaam|allo|alo|coucou|retour|annuler)\b/;
const BACK_TO_MENU = /^(0|menu|retour|annuler)$/;

// Append interactive menu list (5 options) after info replies.
function withShortMenu(reply: string): string {
  return `${reply}\n\n${SHORT_MENU_TEXT}\n${UI_MENU}`;
}
function withFullMenu(reply: string): string {
  return `${reply}\n\n${MAIN_MENU_TEXT}\n${UI_MENU}`;
}
// Used while a session attend une saisie precise (tracking, poids, etc.)
function withBack(reply: string): string {
  return `${reply}\n${UI_BACK}`;
}

// Sections de la liste interactive principale (5 options).
const MAIN_MENU_SECTIONS = [
  {
    title: 'Nos services',
    rows: [
      { id: 'SUIVI', title: 'Mes colis', description: 'Suivre mes expeditions' },
      { id: 'EXPEDITION', title: 'Envoyer un colis', description: 'Nouvelle expedition depuis Dakar' },
      { id: 'DEPARTS', title: 'Prochains departs', description: 'Voir les departs disponibles' },
      { id: 'DEVIS', title: 'Obtenir un devis', description: 'Prix instantane en ligne' },
      { id: 'AGENT', title: 'Parler a un agent', description: 'Contacter notre equipe' },
    ],
  },
];
const MAIN_MENU_FALLBACK = `${MAIN_MENU_TEXT}\nRepondez : SUIVI, EXPEDITION, DEPARTS, DEVIS ou AGENT.`;
const BACK_BUTTONS = [{ id: 'MENU', label: 'Retour au menu' }];


// --- Notification button handlers (proactive flow replies) -------------------
// Returns true if the message was an interactive button id we handled.
async function handleNotificationButton(supa: any, phone: string, raw: string): Promise<true | null> {
  const id = (raw || '').trim();
  if (!id) return null;

  // Satisfaction ratings: rate_<level>_<dossier_id>
  const rateMatch = id.match(/^rate_(excellent|bien|moyen|probleme)_([0-9a-f-]{36})$/i);
  if (rateMatch) {
    const [, rating, dossierId] = rateMatch;
    const { data: dos } = await supa.from('dossiers')
      .select('id, user_id, tracking_id, reference').eq('id', dossierId).maybeSingle();
    await supa.from('satisfaction_ratings').insert({
      dossier_id: dossierId, user_id: dos?.user_id ?? null,
      rating: rating.toLowerCase(), source: 'whatsapp',
    });
    const trk = dos?.tracking_id || dos?.reference || dossierId;
    if (rating === 'probleme') {
      await supa.from('admin_notifications').insert({
        event_type: 'satisfaction_problem',
        message: `Avis probleme recu pour ${trk} (${phone})`,
        dossier_id: dossierId,
        payload: { rating, phone, tracking: trk },
      }).then(() => null, () => null);
      await sendWa(supa, phone,
        `Merci pour votre retour. Un agent Yobbante vous recontacte rapidement au sujet du colis ${trk}.`,
        'bot_client_rating_problem');
    } else {
      await sendWa(supa, phone,
        `Merci ${rating === 'excellent' ? 'beaucoup' : ''} pour votre avis ! Nous sommes ravis de vous avoir servi.`,
        'bot_client_rating_thanks');
    }
    return true;
  }

  // Review trigger: review_<dossier_id> -> send satisfaction buttons immediately
  const revMatch = id.match(/^review_([0-9a-f-]{36})$/i);
  if (revMatch) {
    const dossierId = revMatch[1];
    const { data: dos } = await supa.from('dossiers')
      .select('tracking_id, reference').eq('id', dossierId).maybeSingle();
    const trk = dos?.tracking_id || dos?.reference || '';
    await sendWaButtons(supa, phone,
      `Comment s est passee votre experience avec Yobbante (colis ${trk}) ?`,
      [
        { id: `rate_excellent_${dossierId}`, title: 'Excellent' },
        { id: `rate_bien_${dossierId}`, title: 'Bien' },
        { id: `rate_probleme_${dossierId}`, title: 'Probleme' },
      ], 'bot_client_review');
    return true;
  }

  // Pickup confirmation: confirm_pickup_<dossier_id>
  const confirmPickup = id.match(/^confirm_pickup_([0-9a-f-]{36})$/i);
  if (confirmPickup) {
    const dossierId = confirmPickup[1];
    const { data: dos } = await supa.from('dossiers')
      .select('tracking_id, reference, pickup_date').eq('id', dossierId).maybeSingle();
    const trk = dos?.tracking_id || dos?.reference || '';
    await supa.from('admin_notifications').insert({
      event_type: 'client_pickup_confirmed',
      message: `Client ${phone} confirme la collecte du ${dos?.pickup_date ?? ''} pour ${trk}`,
      dossier_id: dossierId, payload: { phone, tracking: trk },
    }).then(() => null, () => null);
    await sendWa(supa, phone,
      `Parfait, collecte confirmee pour ${trk}. Notre GP vous appellera 30 min avant.`,
      'bot_client_pickup_confirmed');
    return true;
  }

  // Change date: change_date_<dossier_id>
  const changeDate = id.match(/^change_date_([0-9a-f-]{36})$/i);
  if (changeDate) {
    const dossierId = changeDate[1];
    await sendWa(supa, phone,
      `Pas de souci. Connectez-vous sur yobbante.com/app pour choisir une nouvelle date, ou repondez ici avec la date souhaitee (ex: 15/06/2026).`,
      'bot_client_change_date');
    await supa.from('admin_notifications').insert({
      event_type: 'client_pickup_change_requested',
      message: `Client ${phone} souhaite changer la date de collecte (dossier ${dossierId})`,
      dossier_id: dossierId, payload: { phone },
    }).then(() => null, () => null);
    return true;
  }

  // Track button: track_<tracking_id>
  const track = id.match(/^track_(.+)$/i);
  if (track) {
    const trk = track[1];
    await sendWa(supa, phone,
      `Suivez votre colis en direct : https://yobbante.com/suivre/${trk}`,
      'bot_client_track_link');
    return true;
  }

  // Contact agent
  if (id === 'contact_agent') {
    await sendWa(supa, phone,
      `Un agent Yobbante vous recontacte rapidement. Vous pouvez aussi nous joindre au +221 78 460 40 03.`,
      'bot_client_contact_agent');
    await supa.from('admin_notifications').insert({
      event_type: 'client_requested_agent',
      message: `Client ${phone} demande un agent humain`,
      payload: { phone },
    }).then(() => null, () => null);
    return true;
  }

  // Payment buttons : pay_wave_<trk>, pay_om_<trk>, pay_cod_<trk>
  const pay = id.match(/^pay_(wave|om|cod)_(.+)$/i);
  if (pay) {
    const method = pay[1].toLowerCase();
    const trk = pay[2];
    if (method === 'cod') {
      try { await supa.rpc('set_dossier_cod_public', { p_tracking: trk }); } catch {}
      await sendWa(supa, phone,
        `Paiement a la livraison enregistre pour ${trk}. Vous reglerez a la remise du colis.`,
        'bot_client_pay_cod');
    } else {
      const label = method === 'wave' ? 'Wave' : 'Orange Money';
      await sendWa(supa, phone,
        `Pour payer par ${label} le colis ${trk}, suivez ce lien securise :\nhttps://yobbante.com/pay/${trk}?method=${method}`,
        `bot_client_pay_${method}`);
    }
    return true;
  }

  // Confirm delivery address: confirm_delivery_<dossier_id>
  const confirmDel = id.match(/^confirm_delivery_([0-9a-f-]{36})$/i);
  if (confirmDel) {
    const dossierId = confirmDel[1];
    await supa.from('admin_notifications').insert({
      event_type: 'client_delivery_address_confirmed',
      message: `Client ${phone} confirme l adresse de livraison (${dossierId})`,
      dossier_id: dossierId, payload: { phone },
    }).then(() => null, () => null);
    await sendWa(supa, phone,
      `Merci, adresse confirmee. Notre livreur vous contacte sous 24-48h.`,
      'bot_client_delivery_confirmed');
    return true;
  }

  return null;
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

async function sendWaList(
  phone: string,
  bodyText: string,
  listButtonLabel: string,
  sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>,
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
        interactive_type: 'list',
        interactive_body: bodyText,
        list_button_label: listButtonLabel,
        sections,
        fallback_text: fallbackText,
        trigger_type: trigger,
      }),
    });
  } catch (e) {
    console.error('BOT_CLIENT send list error', e);
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

// Marque la derniere action contextuelle dans la session (sans relancer un flow).
// pending_data conserve `last_action` + `last_data` pour interpreter le prochain OUI.
async function markLastAction(
  supa: any,
  phone: string,
  action: string,
  data: Record<string, any>,
) {
  try {
    const { session } = await getSession(supa, phone);
    const prevData = (session?.pending_data ?? {}) as Record<string, any>;
    const currentIntent = session?.pending_intent ?? null;
    await saveSession(supa, phone, currentIntent, {
      ...prevData,
      last_action: action,
      last_data: data,
      last_action_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('BOT_CLIENT markLastAction err', e instanceof Error ? e.message : String(e));
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
    const digits = phone.replace(/\D/g, '');
    const variants = [phone, `+${digits}`, digits];
    const orExpr = variants.map((v) => `contact_phone.eq.${v},sender_phone.eq.${v}`).join(',');
    const { data: rows } = await supa
      .from('dossiers')
      .select('tracking_id,reference,status,origin_country,destination_country,updated_at')
      .or(orExpr)
      .order('updated_at', { ascending: false })
      .limit(10);
    const items = (rows ?? []).filter((r: any) => r.tracking_id || r.reference);
    if (items.length === 0) {
      await saveSession(supa, phone, 'await_tracking', {});
      return withBack(`Aucun colis trouve pour votre numero.\nEntrez un numero de suivi.\n(Format : YOB-XXXXXX)`);
    }
    const active = items.filter((r: any) => !['DELIVERED', 'CANCELLED'].includes(r.status));
    const archived = items.filter((r: any) => ['DELIVERED', 'CANCELLED'].includes(r.status));
    const toRow = (r: any) => {
      const id = (r.tracking_id || r.reference).toString();
      const label = STATUS_FR[r.status] || r.status;
      return {
        id,
        title: id.slice(0, 24),
        description: `${label} - ${r.origin_country}->${r.destination_country}`.slice(0, 72),
      };
    };
    const sections: Array<{ title: string; rows: any[] }> = [];
    if (active.length) sections.push({ title: 'En cours', rows: active.slice(0, 8).map(toRow) });
    if (archived.length) sections.push({ title: 'Termines', rows: archived.slice(0, 10 - (sections[0]?.rows.length ?? 0)).map(toRow) });
    await saveSession(supa, phone, null, {});
    await sendWaList(
      phone,
      `Vos colis recents (${items.length}) :`,
      'Choisir un colis',
      sections,
      `Vos colis :\n${items.slice(0, 5).map((r: any) => `- ${r.tracking_id || r.reference} (${STATUS_FR[r.status] || r.status})`).join('\n')}\n\nRepondez avec le numero de suivi.`,
      'bot_client_my_packages',
    );
    return '';
  }
  if (choice === '3') {
    await askExpeditionDestination(supa, phone);
    return '';
  }
  if (choice === '4') {
    await saveSession(supa, phone, 'quote_origin', {});
    return withBack(`Origine ?`);
  }
  // 5 — AGENT
  const pauseUntil = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  await saveSession(supa, phone, null, {}, pauseUntil);
  const firstName = fromName ? fromName.split(' ')[0] : '';
  const agentMsg =
    `AGENT DEMANDE\n` +
    `Client : ${phone}${firstName ? ` (${firstName})` : ''}\n` +
    `Dernier message : ${lastMsg.slice(0, 200)}\n\n` +
    `Action requise sous 2h.\n` +
    `Repondre : MSG ${phone} [message]`;
  await sendWa(supa, ADMIN_PHONE, agentMsg, 'agent_handoff');
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
  // 1) Contexte session : last_action stocke dans pending_data
  try {
    const { session } = await getSession(supa, phone);
    const pd = (session?.pending_data ?? {}) as Record<string, any>;
    const lastAction = pd?.last_action ?? null;
    const lastData = (pd?.last_data ?? {}) as Record<string, any>;

    if (lastAction === 'devis_shown' && lastData?.dest) {
      // Le client vient de voir un devis et tape OUI : on lance le flow expedition pre-rempli
      const dest = resolveDestination(lastData.dest) ?? { city: lastData.dest, country: COUNTRY_BY_CITY[norm(lastData.dest)] || null };
      const weight = Number(lastData.weight) || 0;
      if (weight > 0) {
        await askExpeditionType(supa, phone, { dest_city: dest.city, dest_country: dest.country, weight });
      } else {
        await askExpeditionWeight(supa, phone, { dest_city: dest.city, dest_country: dest.country });
      }
      return '';
    }
  } catch (e) {
    console.error('BOT_CLIENT handleOui ctx err', e instanceof Error ? e.message : String(e));
  }

  // 2) Dossier en attente -> confirmation
  const d = await findPendingDossier(supa, phone);
  if (d) {
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

  // 3) Aucun contexte -> afficher le menu (ne plus dire "Aucune action")
  return MAIN_MENU;
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

    // PRIORITY -1: button IDs from proactive notifications (rate_*, review_*, confirm_pickup_*, etc.)
    const buttonHandled = await handleNotificationButton(supa, phone, msg);
    if (buttonHandled !== null) {
      return new Response(JSON.stringify({ ok: true, button: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
    // PRIORITY 2: numeric (legacy) OR interactive list/button id -> top-level menu choice
    else if (/^[1-5]$/.test(nMsg) || ['suivi','expedition','departs','devis','agent'].includes(nMsg)) {
      const idMap: Record<string, string> = {
        '1': '1', '2': '2', '3': '3', '4': '4', '5': '5',
        departs: '1', suivi: '2', expedition: '3', devis: '4', agent: '5',
      };
      await saveSession(supa, phone, null, {});
      reply = await handleMenuChoice(supa, phone, input.from_name ?? null, idMap[nMsg], msg);
    }

    // PRIORITY 2a: closure words ("rien", "merci", "ok", "d accord")
    // -> Une seule reponse polie, fin de session, PAS de menu.
    // (uniquement si pas de flow en cours, pour ne pas casser une saisie attendue)
    else if (!intent && /^(rien|merci|mercii+|ok|okay|d accord|daccord)\s*!?\s*$/.test(nMsg)) {
      await saveSession(supa, phone, null, {});
      await sendWa(supa, phone, `D accord ! N hesitez pas si vous avez besoin.`, 'bot_client_closure');
      return new Response(JSON.stringify({ ok: true, closed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PRIORITY 2b: OUI / NON → confirm or cancel pending dossier
    else if (/^(oui|ok|yes|y|confirme|confirmer|valide|valider|d accord|daccord)\b/.test(nMsg)) {
      reply = await handleOui(supa, phone, input.from_name ?? null);
    }
    else if (!intent && /^(non|no)\s*!?\s*$/.test(nMsg)) {
      // "non" tout seul sans flow = fermeture polie, pas d annulation
      await saveSession(supa, phone, null, {});
      await sendWa(supa, phone, `D accord ! N hesitez pas si vous avez besoin.`, 'bot_client_closure');
      return new Response(JSON.stringify({ ok: true, closed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    else if (/^(non|no|annul|annuler|refuse|refuser)\b/.test(nMsg)) {
      reply = await handleNon(supa, phone, input.from_name ?? null);
    }
    // PRIORITY 3a: MODIFIER command → generate edit link
    else if (/^modifier\b/.test(nMsg)) {
      reply = await handleModifierClient(supa, phone);
    }
    // PRIORITY 3: explicit RESERVER command
    else if (/^reserver(\s|$)/.test(nMsg)) {
      const p = parseReserver(msg);
      if (!p) {
        // Aucune ref fournie : afficher la liste des departs actifs, NE PAS lancer le flow expedition.
        const today = new Date().toISOString().slice(0, 10);
        const { data: deps } = await supa
          .from('public_active_departures')
          .select('short_ref,transporteur_ref,departure_date,origin_city,destination_city,available_capacity_kg')
          .gte('departure_date', today)
          .order('departure_date', { ascending: true })
          .limit(8);
        let depList = '';
        for (const d of (deps ?? [])) {
          const ref = d.short_ref || d.transporteur_ref || '----';
          depList += `* ${fmtDate(d.departure_date)} #${ref} - ${d.origin_city || '?'} -> ${d.destination_city || '?'} (${d.available_capacity_kg ?? 0}kg dispo)\n`;
        }
        if (!depList) depList = '(aucun depart actif pour le moment)';
        reply = withFullMenu(
          `Pour reserver un depart, indiquez la reference.\n` +
          `Ex : RESERVER 5421 3kg\n\n` +
          `Departs disponibles :\n${depList}`,
        );
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
      const v = validateWeight(nMsg);
      if (!v.ok) {
        reply = withBack(v.error);
      } else if (v.heavy && !data.weight_confirmed) {
        await saveSession(supa, phone, 'quote_weight_confirm', { ...data, pending_weight: v.weight });
        reply = withBack(`Vous avez bien ${v.weight}kg ?\nC est un envoi volumineux.\nConfirmez : OUI ou NON`);
      } else {
        const r = await handleQuoteCalc(supa, data.dest, v.weight);
        await saveSession(supa, phone, null, {
          last_action: 'devis_shown',
          last_data: { dest: data.dest, weight: v.weight },
          last_action_at: new Date().toISOString(),
        });
        reply = withShortMenu(r);
      }
    } else if (intent === 'quote_weight_confirm' && msg) {
      if (/^(oui|ok|yes|y|confirme)/.test(nMsg)) {
        const w = Number(data.pending_weight);
        const r = await handleQuoteCalc(supa, data.dest, w);
        await saveSession(supa, phone, null, {
          last_action: 'devis_shown',
          last_data: { dest: data.dest, weight: w },
          last_action_at: new Date().toISOString(),
        });
        reply = withShortMenu(r);
      } else {
        await saveSession(supa, phone, 'quote_weight', { dest: data.dest, origin: data.origin });
        reply = withBack(`Pas de souci. Quel est le poids reel en kg ?`);
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
      const v = validateWeight(nMsg);
      if (!v.ok) {
        reply = withBack(v.error);
      } else if (v.heavy && !data.weight_confirmed) {
        await saveSession(supa, phone, 'ship_weight_confirm', { ...data, pending_weight: v.weight });
        reply = withBack(`Vous avez bien ${v.weight}kg ?\nC est un envoi volumineux.\nConfirmez : OUI ou NON`);
      } else {
        data.weight = v.weight;
        await saveSession(supa, phone, 'ship_name', data);
        reply = withBack(`Merci. Quel est votre nom complet ?`);
      }
    } else if (intent === 'ship_weight_confirm' && msg) {
      if (/^(oui|ok|yes|y|confirme)/.test(nMsg)) {
        const d2 = { ...data, weight: Number(data.pending_weight) };
        delete d2.pending_weight;
        await saveSession(supa, phone, 'ship_name', d2);
        reply = withBack(`Merci. Quel est votre nom complet ?`);
      } else {
        await saveSession(supa, phone, 'ship_weight', { origin: data.origin, dest: data.dest });
        reply = withBack(`Pas de souci. Quel est le poids reel en kg ?`);
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
    // ---- Waitlist confirmation (after "pas de depart") ----
    else if (intent === 'waitlist_confirm' && msg) {
      const id = nMsg;
      if (id === 'waitlist_yes' || /^(oui|ok|yes|d accord|daccord)\b/.test(id)) {
        reply = await handleWaitlistOptIn(supa, phone, input.from_name ?? null, data.origin ?? 'Dakar', data.destination ?? '');
      } else {
        await saveSession(supa, phone, null, {});
        reply = withShortMenu(`Tres bien, pas de probleme.`);
      }
    }
    // ---- Destination choice for DEPARTS (list reply) ----
    else if (intent === 'await_destination_departs' && msg) {
      const id = nMsg;
      const picked = DESTINATIONS_LIST.find((d) => d.id === id);
      let dest: string | null = null;
      if (picked && picked.city) dest = picked.city;
      else if (id === 'dest_other') {
        await saveSession(supa, phone, 'await_destination_departs', { ...data, awaiting_city: true });
        reply = withBack(`Quelle destination ? Tapez le nom de la ville (ex: Londres)`);
      } else {
        // Texte libre = ville
        dest = msg;
      }
      if (dest) {
        const r = await handleSmartDepartures(supa, phone, data.origin ?? 'Dakar', dest);
        if (r) reply = withShortMenu(r);
      }
    }
    // ---- Guided EXPEDITION flow (destination -> poids -> type -> lien pre-rempli) ----
    else if (intent === 'exp_destination' && msg) {
      const id = nMsg;
      let city: string | null = null;
      let country: string | null = null;
      // match "expdest_paris" -> dest_paris (liste interactive)
      const matchId = id.startsWith('expdest_') ? `dest_${id.replace('expdest_', '')}` : id;
      const picked = DESTINATIONS_LIST.find((d) => d.id === matchId);
      if (picked && picked.city) {
        city = picked.city; country = picked.country;
      } else if (matchId === 'dest_other' || id === 'expdest_other') {
        await saveSession(supa, phone, 'exp_destination', {});
        reply = withBack(`Quelle destination ? Tapez le nom de la ville (ex: Londres)`);
      } else {
        // Texte libre : valider contre la liste Yobbante
        const resolved = resolveDestination(msg);
        if (!resolved) {
          reply = withBack(INVALID_DESTINATION_MSG);
        } else {
          city = resolved.city; country = resolved.country;
        }
      }
      if (city) {
        await askExpeditionWeight(supa, phone, { dest_city: city, dest_country: country });
      }
    }
    else if (intent === 'exp_weight' && msg) {
      const id = nMsg;
      const picked = EXP_WEIGHT_OPTIONS.find((w) => w.id === id);
      if (picked) {
        await askExpeditionType(supa, phone, { ...data, weight: picked.kg });
      } else {
        const v = validateWeight(nMsg);
        if (!v.ok) {
          reply = withBack(v.error);
        } else if (v.heavy && !data.weight_confirmed) {
          await saveSession(supa, phone, 'exp_weight_confirm', { ...data, pending_weight: v.weight });
          reply = withBack(`Vous avez bien ${v.weight}kg ?\nC est un envoi volumineux.\nConfirmez : OUI ou NON`);
        } else {
          await askExpeditionType(supa, phone, { ...data, weight: v.weight });
        }
      }
    }
    else if (intent === 'exp_weight_confirm' && msg) {
      if (/^(oui|ok|yes|y|confirme)/.test(nMsg)) {
        await askExpeditionType(supa, phone, { ...data, weight: Number(data.pending_weight) });
      } else {
        await saveSession(supa, phone, 'exp_weight', { dest_city: data.dest_city, dest_country: data.dest_country });
        reply = withBack(`Pas de souci. Quel est le poids reel en kg ?`);
      }
    }
    else if (intent === 'exp_type' && msg) {
      const id = nMsg;
      let typeCode: string | null = null;
      let typeLabel: string | null = null;
      const picked = EXP_TYPE_OPTIONS.find((t) => t.id === id);
      if (picked) { typeCode = picked.code; typeLabel = picked.title; }
      else {
        const byText = EXP_TYPE_OPTIONS.find((t) => norm(t.title).includes(id) || id.includes(t.code));
        if (byText) { typeCode = byText.code; typeLabel = byText.title; }
        else { typeCode = 'autre'; typeLabel = msg; }
      }
      reply = await finalizeExpedition(supa, phone, { ...data, type_code: typeCode, type_label: typeLabel });
    }
    // ---- Direct tracking number outside flow ----
    else if (/^yob[-\s]?[a-z0-9]{4,}/i.test(msg)) {
      const r = await handleTrackingLookup(supa, msg);
      reply = withShortMenu(r);
    } else if (!nMsg) {
      reply = MAIN_MENU;
    } else if (detectFaq(msg)) {
      // ---- FAQ deterministe : reponse directe, pas de NLP ----
      const faqReply = detectFaq(msg)!;
      await markLastAction(supa, phone, 'faq_shown', { topic: msg.slice(0, 60), retry_count: 0 });
      reply = withShortMenu(faqReply);
    } else if (detectComplaint(msg)) {
      // ---- PLAINTE : agent immediat + alerte URGENT admin ----
      try {
        await sendWa(
          supa,
          ADMIN_PHONE,
          `URGENT : ${phone}\n${(input.from_name ?? '').slice(0, 40)}\n${msg.slice(0, 300)}`,
          'agent_handoff_urgent',
        );
      } catch (e) { console.error('BOT_CLIENT urgent admin notify err', e); }
      await markLastAction(supa, phone, 'plainte', { urgency: 'HIGH', retry_count: 0, message: msg.slice(0, 200) });
      reply = await handleMenuChoice(supa, phone, input.from_name ?? null, '5', msg);
    } else if (detectEnglishIntent(msg)) {
      // ---- English fast-path : repondre en francais, ne jamais traiter de l anglais comme destination ----
      const enIntent = detectEnglishIntent(msg);
      if (enIntent === 'AGENT') {
        reply = await handleMenuChoice(supa, phone, input.from_name ?? null, '5', msg);
      } else if (enIntent === 'SUIVI') {
        const r = await handleSmartTracking(supa, phone, null);
        if (r) reply = r;
      } else if (enIntent === 'DEVIS') {
        reply = await handleMenuChoice(supa, phone, input.from_name ?? null, '4', msg);
      } else if (enIntent === 'EXPEDITION') {
        await askExpeditionDestination(supa, phone);
      } else if (enIntent === 'DEPARTS') {
        const r = await handleSmartDepartures(supa, phone, 'Dakar', null);
        if (r) reply = withShortMenu(r);
      } else {
        reply = withFullMenu(HELP_EN_REPLY);
      }
    } else {
      // ---- NLP fallback : analyse intelligente du message ----
      const nlp = await classifyMessage(msg);
      if (nlp && nlp.confidence >= 0.5) {
        const firstName = await getClientFirstName(supa, phone, input.from_name ?? null);
        const greet = firstName ? `Salam ${firstName} ! ` : '';

        if (nlp.intent === 'DEPARTS') {
          const dest = resolveDestination(nlp.entities.destination);
          if (nlp.entities.destination && !dest) {
            reply = withFullMenu(INVALID_DESTINATION_MSG);
          } else {
            const r = await handleSmartDepartures(supa, phone, nlp.entities.origin ?? 'Dakar', dest?.city ?? null);
            if (r) reply = withShortMenu(greet ? greet + '\n' + r : r);
          }
        } else if (nlp.intent === 'SUIVI') {
          const r = await handleSmartTracking(supa, phone, nlp.entities.tracking_id);
          if (r) reply = r;
        } else if (nlp.intent === 'CONFIRMATION') {
          reply = await handleOui(supa, phone, input.from_name ?? null);
        } else if (nlp.intent === 'ANNULATION') {
          reply = await handleNon(supa, phone, input.from_name ?? null);
        } else if (nlp.intent === 'AGENT') {
          reply = await handleMenuChoice(supa, phone, input.from_name ?? null, '5', msg);
        } else if (nlp.intent === 'EXPEDITION') {
          const dest = resolveDestination(nlp.entities.destination);
          if (nlp.entities.destination && !dest) {
            reply = withFullMenu(INVALID_DESTINATION_MSG);
          } else if (dest) {
            await askExpeditionWeight(supa, phone, { dest_city: dest.city, dest_country: dest.country });
          } else {
            await askExpeditionDestination(supa, phone);
          }
        } else if (nlp.intent === 'DEVIS') {
          const dest = resolveDestination(nlp.entities.destination);
          if (nlp.entities.destination && !dest) {
            reply = withFullMenu(INVALID_DESTINATION_MSG);
          } else if (dest && nlp.entities.weight) {
            const r = await handleQuoteCalc(supa, dest.city, nlp.entities.weight);
            await markLastAction(supa, phone, 'devis_shown', { dest: dest.city, weight: nlp.entities.weight });
            reply = withShortMenu(r);
          } else if (dest) {
            await saveSession(supa, phone, 'quote_weight', { origin: 'Dakar', dest: dest.city });
            reply = withBack(`${greet}Pour un devis vers ${dest.city}, quel poids (kg) ?`);
          } else {
            reply = await handleMenuChoice(supa, phone, input.from_name ?? null, '4', msg);
          }
        } else {
          reply = withFullMenu(`${greet}Je veux m assurer de bien vous aider. Que cherchez-vous ?`);
        }
      } else {
        // Confidence faible OU NLP indispo -> sortie positive, jamais d erreur
        reply = withFullMenu(`Je veux m assurer de bien vous aider. Que cherchez-vous ?`);
      }
    }


    if (reply) {
      const wantsMenu = reply.includes(UI_MENU);
      const wantsBack = !wantsMenu && reply.includes(UI_BACK);
      const cleanReply = reply.replaceAll(UI_MENU, '').replaceAll(UI_BACK, '').replace(/\n{3,}/g, '\n\n').trim();

      if (wantsMenu) {
        // Liste interactive 5 options — pas d envoi texte separe pour eviter le doublon menu.
        await sendWaList(
          phone,
          cleanReply || MAIN_MENU_TEXT,
          'Voir les options',
          MAIN_MENU_SECTIONS,
          MAIN_MENU_FALLBACK,
          'bot_client_main_menu',
        );
      } else if (wantsBack) {
        await sendWaButtons(
          phone,
          cleanReply,
          BACK_BUTTONS,
          `${cleanReply}\n\nRepondez MENU pour revenir au menu.`,
          'bot_client_back_button',
        );
      } else if (cleanReply) {
        await sendWa(supa, phone, cleanReply, 'bot_client_reply');
      }
    }
  } catch (e) {
    console.error('BOT_CLIENT error', e instanceof Error ? e.message : String(e));
    try {
      await sendWaList(phone, FALLBACK, 'Voir les options', MAIN_MENU_SECTIONS, MAIN_MENU_FALLBACK, 'bot_client_error');
    } catch {}
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
