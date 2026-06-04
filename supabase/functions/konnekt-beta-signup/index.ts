// konnekt-beta-signup — Inscription publique à la beta Konnekt.
// Insère un transporteur (actif=false), notifie le GP et l'admin via WhatsApp.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_PHONE = '+221784604003';
const KONNEKT_GP_PHONE = '+221789269756';

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
  const { prenom, nom, telephone, email, ville, villes_desservies, frequence, source_decouverte, ref_parrainage } = v.data;

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
    email: email || null,
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

  // 3. WhatsApp GP (texte libre court — depuis le 926, via gp-smart-invite pour gerer la fenetre 24h)
  const gpMsg = [
    `Salam ${prenom} !`,
    ``,
    `Merci pour votre inscription sur Konnekt.`,
    `Votre demande est en cours d'examen.`,
    `Nous activons votre compte sous 24h.`,
    ``,
    `En attendant, enregistrez ce numero :`,
    `${KONNEKT_GP_PHONE}`,
    `Nom : Konnekt GP`,
    ``,
    `Pour toute question :`,
    `${ADMIN_PHONE}`,
  ].join('\n');

  try {
    await fetch(`${supaUrl}/functions/v1/gp-smart-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({
        phone: telephone,
        message: gpMsg,
        gp_name: `${prenom} ${nom}`,
        gp_ref: reference,
        kind: 'konnekt_signup',
        trigger_type: 'konnekt_beta_signup',
      }),
    });
  } catch (e) {
    console.error('KONNEKT_SIGNUP smart_invite_error', e instanceof Error ? e.message : String(e));
  }

  // 4. Notif admin (+221784604003)
  const adminMsg = [
    `Nouvelle inscription Konnekt :`,
    `${prenom} ${nom}`,
    `Tel : ${telephone}`,
    `Role : GP`,
    `Ville : ${ville}`,
    `Ref : ${reference}`,
    `A valider : yobbante.com/admin/terrain`,
  ].join('\n');


  await sendWhatsapp(supaUrl, anonKey, {
    recipient_phone: ADMIN_PHONE,
    recipient_type: 'admin',
    message: adminMsg,
    client_name: `${prenom} ${nom}`,
    trigger_type: 'konnekt_beta_signup_admin',
  });

  // 5. Email Resend (optionnel, ne crash jamais)
  let emailSent = false;
  if (email) {
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.warn('KONNEKT_SIGNUP email_skipped: RESEND_API_KEY manquant', { email });
    } else {
      try {
        const html = renderKonnektEmail(prenom, telephone);
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: 'Konnekt <noreply@usekonnekt.com>',
            to: [email],
            subject: 'Bienvenue dans la beta Konnekt !',
            html,
            reply_to: 'contact@usekonnekt.com',
          }),
        });
        if (r.ok) {
          emailSent = true;
        } else {
          const errText = await r.text();
          console.error('KONNEKT_SIGNUP resend_error', r.status, errText);
        }
      } catch (e) {
        console.error('KONNEKT_SIGNUP resend_exception', e instanceof Error ? e.message : String(e));
      }
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    transporteur_id: inserted.id,
    reference: inserted.reference,
    prenom,
    email_sent: emailSent,
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function renderKonnektEmail(prenom: string, telephone: string): string {
  const safePrenom = escapeHtml(prenom);
  const safeTel = escapeHtml(telephone);
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A1A2E;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#1A1A2E;color:#F5C518;padding:14px 22px;border-radius:12px;font-weight:900;letter-spacing:1px;font-size:22px;">KONNEKT</div>
      <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">by Yobbanté</p>
    </div>

    <h1 style="font-size:22px;font-weight:800;margin:0 0 18px;color:#1A1A2E;">Bonjour ${safePrenom},</h1>

    <p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
      Votre inscription à la beta Konnekt a bien été reçue.
    </p>

    <p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 24px;">
      Nous examinons votre profil sous 24h. Vous serez contacté sur WhatsApp au <strong>${safeTel}</strong>.
    </p>

    <div style="background:#F8FAFC;border:1px solid #E5E7EB;border-radius:12px;padding:18px;margin:0 0 28px;">
      <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">En attendant, enregistrez notre numéro :</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#1A1A2E;">+221 78 926 97 56</p>
      <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Nom : <strong>Konnekt GP</strong></p>
    </div>

    <div style="text-align:center;margin:0 0 32px;">
      <a href="https://usekonnekt.com" style="display:inline-block;background:#F5C518;color:#1A1A2E;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;">
        Découvrir Konnekt →
      </a>
    </div>

    <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">

    <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">L'équipe Konnekt by Yobbanté</p>
    <p style="font-size:12px;color:#9ca3af;margin:0;">
      <a href="mailto:contact@usekonnekt.com" style="color:#9ca3af;text-decoration:underline;">contact@usekonnekt.com</a>
    </p>
  </div>
</body>
</html>`;
}
