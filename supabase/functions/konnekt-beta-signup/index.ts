// konnekt-beta-signup — Inscription publique à la beta Konnekt.
// Insère un transporteur (actif=false), notifie le GP et l'admin via WhatsApp.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_PHONE = '+221784604003';
const KONNEKT_GP_PHONE = '+221781221891';

interface SignupBody {
  prenom?: string;
  nom?: string;
  telephone?: string;
  email?: string;
  ville?: string;
  villes_desservies?: string[];
  frequence?: 'hebdomadaire' | 'mensuel' | 'occasionnel';
  source_decouverte?: string;
  ref_parrainage?: string | null;
}

function normalizePhone(input: string): string {
  let v = (input || '').toString().trim().replace(/[^\d+]/g, '');
  if (!v) return '';
  if (v.startsWith('00')) v = '+' + v.slice(2);
  if (!v.startsWith('+')) {
    if (v.length === 9) v = '+221' + v;
    else v = '+' + v;
  }
  return v;
}

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;
}

function validate(b: SignupBody): { ok: true; data: Required<Pick<SignupBody, 'prenom' | 'nom' | 'telephone' | 'ville'>> & SignupBody } | { ok: false; error: string } {
  const prenom = (b.prenom || '').trim();
  const nom = (b.nom || '').trim();
  const ville = (b.ville || '').trim();
  const telephone = normalizePhone(b.telephone || '');
  const email = (b.email || '').trim().toLowerCase();
  if (prenom.length < 2 || prenom.length > 60) return { ok: false, error: 'Prenom invalide' };
  if (nom.length < 2 || nom.length > 60) return { ok: false, error: 'Nom invalide' };
  if (!ville || ville.length > 60) return { ok: false, error: 'Ville invalide' };
  if (!telephone || telephone.length < 8 || telephone.length > 18) return { ok: false, error: 'Telephone invalide' };
  if (email && !isValidEmail(email)) return { ok: false, error: 'Email invalide' };
  const villes = Array.isArray(b.villes_desservies) ? b.villes_desservies.filter(v => typeof v === 'string' && v.length > 0 && v.length < 60).slice(0, 20) : [];
  return { ok: true, data: { prenom, nom, telephone, email, ville, villes_desservies: villes, frequence: b.frequence, source_decouverte: b.source_decouverte, ref_parrainage: b.ref_parrainage ?? null } };
}

/** Génère le prochain reference disponible (4 chiffres). */
async function nextReference(supa: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await supa.from('transporteurs').select('reference').order('reference', { ascending: false }).limit(1);
  const top = data?.[0]?.reference;
  const n = top && /^\d{4}$/.test(String(top)) ? parseInt(String(top), 10) : 1000;
  return String(Math.min(9999, n + 1)).padStart(4, '0');
}

async function sendWhatsapp(supaUrl: string, anonKey: string, payload: Record<string, unknown>) {
  try {
    await fetch(`${supaUrl}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error('KONNEKT_SIGNUP wa_error', e instanceof Error ? e.message : String(e));
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  let body: SignupBody;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const v = validate(body);
  if (!v.ok) {
    return new Response(JSON.stringify({ error: v.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const { prenom, nom, telephone, ville, villes_desservies, frequence, source_decouverte, ref_parrainage } = v.data;

  const supaUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supa = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // 1. Doublon ?
  const { data: existing } = await supa
    .from('transporteurs')
    .select('id, prenom, nom, actif')
    .or(`telephone_1.eq.${telephone},whatsapp.eq.${telephone},telephone_2.eq.${telephone}`)
    .maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({
      ok: false,
      already_registered: true,
      message: 'Vous etes deja partenaire Yobbante. Ecrivez-nous sur WhatsApp : ' + KONNEKT_GP_PHONE,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // 2. Insert
  const reference = await nextReference(supa);
  const notes = [
    `source:konnekt_beta`,
    frequence ? `frequence:${frequence}` : null,
    source_decouverte ? `decouverte:${source_decouverte}` : null,
    ref_parrainage ? `parrain:${ref_parrainage}` : null,
  ].filter(Boolean).join(' | ');

  const navettes = (villes_desservies && villes_desservies.length > 0)
    ? [{ villes: villes_desservies, frequence: frequence ?? null }]
    : [];

  const { data: inserted, error: insertErr } = await supa.from('transporteurs').insert({
    reference,
    prenom,
    nom: `${prenom} ${nom}`.trim(),
    telephone_1: telephone,
    whatsapp: telephone,
    ville,
    adresse_1: ville,
    actif: false,
    konnekt_registered: true,
    konnekt_registered_at: new Date().toISOString(),
    destinations: villes_desservies ?? [],
    navettes,
    notes,
  }).select('id, reference').single();

  if (insertErr) {
    console.error('KONNEKT_SIGNUP insert_error', insertErr.message);
    return new Response(JSON.stringify({ error: 'Erreur enregistrement', detail: insertErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 3. WhatsApp GP (free text — pas de template dédié, 24h non garanti mais on tente)
  const villesTxt = (villes_desservies || []).join(', ') || ville;
  const gpMsg = [
    `Salam ${prenom},`,
    `Merci pour votre inscription sur Konnekt !`,
    ``,
    `Votre demande est en cours d'examen. Nous vous contactons sous 24h.`,
    ``,
    `En attendant, enregistrez ce numero : ${KONNEKT_GP_PHONE}`,
    `Nom : Konnekt GP`,
    ``,
    `A bientot !`,
  ].join('\n');

  await sendWhatsapp(supaUrl, anonKey, {
    recipient_phone: telephone,
    recipient_type: 'gp',
    message: gpMsg,
    trigger_type: 'konnekt_beta_signup',
  });

  // 4. Notif admin
  const adminMsg = [
    `Nouvelle inscription Konnekt :`,
    `${prenom} ${nom}`,
    `Tel : ${telephone}`,
    `Ville : ${ville}`,
    `Villes desservies : ${villesTxt}`,
    `Frequence : ${frequence ?? 'n/c'}`,
    `Source : ${source_decouverte ?? 'n/c'}`,
    ref_parrainage ? `Parrain : ${ref_parrainage}` : null,
    `Ref GP : ${reference}`,
  ].filter(Boolean).join('\n');

  await sendWhatsapp(supaUrl, anonKey, {
    recipient_phone: ADMIN_PHONE,
    recipient_type: 'admin',
    message: adminMsg,
    client_name: `${prenom} ${nom}`,
    trigger_type: 'konnekt_beta_signup_admin',
  });

  return new Response(JSON.stringify({
    ok: true,
    transporteur_id: inserted.id,
    reference: inserted.reference,
    prenom,
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
