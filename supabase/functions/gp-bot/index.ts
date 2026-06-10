// gp-bot — assistant WhatsApp tolerant pour transporteurs Konnekt (926).
// Parser tolérant + conversation guidée + onboarding + alertes admin.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { normalizePhoneDigits, warnIfInvalidPhone } from '../_shared/phone.ts';

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
  message_type?: string | null;
  media_url?: string | null;
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

const HELP_TEXT = `Bienvenue sur Konnekt !
Je suis votre assistant automatique.

Que voulez-vous faire ?

1 - Enregistrer un depart
2 - Confirmer une collecte
3 - Enregistrer un poids
4 - Confirmer une livraison
5 - Mes missions en cours
6 - Mes prochains departs

Autres commandes :
• STATUT [YOB-XXXXX] — statut d'un colis
• PAIEMENT — mes paiements
• ANNULER #ref — annuler un depart
• MODIFIER #ref [Xkg] — changer la capacite
• PROBLEME [YOB-XXXXX] [texte] — signaler un litige
• PHOTO (envoyer image + caption PHOTO YOB-XXXXX)
• PROFIL — voir votre fiche
• TARIFS — voir vos tarifs par ville
• TARIF [ville] [prix] — modifier un tarif
• MODIFIER TEL / ADRESSE / NAVETTE
• PAUSE [N] — suspendre les notifs N jours
• REPRENDRE — reactiver les notifs


Repondez avec le numero de votre choix
ou tapez directement votre commande.
Ex: DEP Dakar Paris 28/05 25kg
Ex: TARIF Paris 6500

Si vous voulez nous ecrire : +221789269756`;


const FALLBACK_TEXT = `Je n'ai pas compris.
Tapez AIDE pour le menu
ou choisissez :

1 - Depart
2 - Collecte
3 - Poids
4 - Livraison
5 - Mes missions
6 - Mes departs`;


const ONBOARDING_TEXT = `Bonjour ! 👋
Ce numero est reserve aux transporteurs partenaires de Konnekt.

Si vous etes transporteur et souhaitez rejoindre notre reseau :
👉 yobbante.com/rejoindre-konnekt

Si vous etes deja partenaire et avez un probleme d'acces, contactez-nous :
+221789269756

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

  const fromPhone = normalizePhoneDigits(warnIfInvalidPhone(input.from_phone, 'gp-bot.from'));
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
  // phone_id du 926 (bot GP) — toute reponse / notif du gp-bot doit partir du 926.
  const GP_BOT_PHONE_ID = Deno.env.get('WHATSAPP_GP_BOT_PHONE_ID')
    ?? Deno.env.get('WHATSAPP_PHONE_ID_GP')
    ?? '';

  async function sendWa(payload: Record<string, unknown>) {
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ phone_id: GP_BOT_PHONE_ID || undefined, ...payload }),
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

  // Menu principal GP en liste interactive (6 options). Le webhook renvoie
  // l'id de la row au gp-bot ("1".."6") qui les route via MENU_MAP.
  // Fallback texte automatique cote send-whatsapp si hors fenetre 24h.
  async function sendMainMenu(prefix?: string, intent = 'menu_main') {
    const body = (prefix ? `${prefix}\n\n` : '') + 'Choisissez une action :';
    await sendWa({
      recipient_phone: fromPhone,
      recipient_type: 'gp',
      interactive_type: 'list',
      interactive_body: body,
      list_button_label: 'Voir les options',
      sections: [{
        title: 'Mes actions',
        rows: [
          { id: '1', title: 'Depart',       description: 'Enregistrer un depart' },
          { id: '2', title: 'Collecte',     description: 'Confirmer une collecte' },
          { id: '3', title: 'Poids',        description: 'Enregistrer le poids' },
          { id: '4', title: 'Livraison',    description: 'Confirmer une livraison' },
          { id: '5', title: 'Mes missions', description: 'Voir mes missions actives' },
          { id: '6', title: 'Mes departs',  description: 'Voir mes prochains departs' },
        ],
      }],
      fallback_text: (prefix ? `${prefix}\n\n` : '') + HELP_TEXT,
      transporteur_id: transporteur?.id,
      trigger_type: intent,
    });
    if (input.inbound_id) {
      try {
        await supa
          .from('whatsapp_inbound_messages')
          .update({ bot_intent: intent, bot_response: '[interactive_menu]', replied_at: new Date().toISOString() })
          .eq('id', input.inbound_id);
      } catch (_) { /* noop */ }
    }
  }

  // Confirmation OUI / NON via boutons interactifs.
  async function sendConfirmButtons(text: string, intent: string, opts?: { yesId?: string; noId?: string; yesLabel?: string; noLabel?: string }) {
    await sendWa({
      recipient_phone: fromPhone,
      recipient_type: 'gp',
      interactive_type: 'button',
      interactive_body: text,
      buttons: [
        { id: opts?.yesId ?? 'oui', label: opts?.yesLabel ?? '✅ Confirmer' },
        { id: opts?.noId  ?? 'non', label: opts?.noLabel  ?? '❌ Annuler' },
      ],
      fallback_text: `${text}\n\nRepondez OUI ou NON.`,
      transporteur_id: transporteur?.id,
      trigger_type: intent,
    });
    if (input.inbound_id) {
      try {
        await supa
          .from('whatsapp_inbound_messages')
          .update({ bot_intent: intent, bot_response: '[interactive_confirm]', replied_at: new Date().toISOString() })
          .eq('id', input.inbound_id);
      } catch (_) { /* noop */ }
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

  function getPrimaryCity(t: any): string | null {
    const navettes = Array.isArray(t?.navettes) ? t.navettes : [];
    for (const n of navettes) {
      const villes = Array.isArray(n?.villes) ? n.villes : [];
      for (const v of villes) {
        const name = String(v?.ville ?? '').trim();
        if (name && name.toLowerCase() !== 'dakar') return name;
      }
    }
    return null;
  }

  async function bumpGpActivity(dossierId?: string | null) {

    const now = new Date().toISOString();
    try {
      if (dossierId) {
        await supa.from('dossiers').update({ gp_last_action_at: now }).eq('id', dossierId);
      }
      if (transporteur?.id) {
        await supa.from('transporteurs').update({ last_bot_activity_at: now }).eq('id', transporteur.id);
      }
    } catch (e) {
      console.error('bumpGpActivity', e);
    }
  }

  async function notifyClientFromYobbante(phone: string, message: string, dossierId?: string) {
    if (!phone || phone.replace(/\D/g, '').length < 6) return;
    await sendWa({
      recipient_phone: phone,
      recipient_type: 'client',
      message,
      dossier_id: dossierId,
      trigger_type: 'gp_departed_client_notify',
    });
  }


  // =================================================================
  //  SUPER ADMIN MODE — priorite absolue (+221784604003)
  // =================================================================
  const SUPER_ADMIN_PHONE = (
    Deno.env.get('SUPER_ADMIN_PHONE')
    || Deno.env.get('ADMIN_WHATSAPP_NUMBER')
    || '+221784604003'
  ).replace(/\D/g, '');
  const normalizedFrom = fromPhone.replace(/\D/g, '');
  const isSuperAdmin = !!SUPER_ADMIN_PHONE
    && (normalizedFrom === SUPER_ADMIN_PHONE
        || normalizedFrom.endsWith(SUPER_ADMIN_PHONE)
        || SUPER_ADMIN_PHONE.endsWith(normalizedFrom));

  if (isSuperAdmin) {
    const result = await handleSuperAdmin();
    if (result) return result;
  }

  // =================================================================
  //  KONNEKT ONBOARDING — message d'activation envoye depuis usekonnekt.com
  //  Detecte le message exact (ou variantes) :
  //  "Bonjour Konnekt, je viens de m'inscrire comme GP. Je souhaite
  //   activer mon compte et recevoir mes missions."
  // =================================================================
  {
    const msgNoApos = msg.replace(/[''`]/g, "'");
    const isKonnektOnboarding =
      /je viens de m'?inscrire/.test(msgNoApos) && /konnekt/.test(msgNoApos);

    if (isKonnektOnboarding) {
      const tail = fromPhone.slice(-9);
      const { data: gp } = await supa
        .from('transporteurs')
        .select('id, prenom, nom, reference, telephone_1, whatsapp')
        .or(`telephone_1.ilike.%${tail}%,whatsapp.ilike.%${tail}%`)
        .limit(1)
        .maybeSingle();

      if (!gp) {
        await reply(
          `Bonjour ! Votre numero n'est pas encore enregistre. Inscrivez-vous sur usekonnekt.com`,
          'konnekt_onboarding_unknown',
        );
        return new Response('ok', { headers: corsHeaders });
      }

      const ref = String(gp.reference ?? '').padStart(4, '0');
      const prenom = gp.prenom ?? '';
      const phoneDisp = gp.telephone_1 ?? fromPhone;

      try {
        await supa
          .from('transporteurs')
          .update({ whatsapp_confirmed_at: new Date().toISOString() })
          .eq('id', gp.id);
      } catch (e) {
        console.error('konnekt_onboarding update err', e);
      }

      await sendWa({
        recipient_phone: fromPhone,
        recipient_type: 'gp',
        message:
          `✅ Bienvenue sur Konnekt, ${prenom} !\n` +
          `Votre compte GP${ref} est bien active.\n\n` +
          `Pour commencer, declarez vos prochains departs :\n` +
          `DEP [ville_depart] [ville_arrivee] [date] [kg]\n` +
          `Ex : DEP Dakar Paris 15/07 25kg\n\n` +
          `Les autres commandes vous seront expliquees au fur et a mesure de vos premieres missions.\n` +
          `Tapez AIDE a tout moment pour revoir le menu.`,

        transporteur_id: gp.id,
        trigger_type: 'konnekt_onboarding_welcome',
      });

      if (input.inbound_id) {
        try {
          await supa
            .from('whatsapp_inbound_messages')
            .update({
              bot_intent: 'konnekt_onboarding_welcome',
              bot_response: '[konnekt_welcome]',
              replied_at: new Date().toISOString(),
            })
            .eq('id', input.inbound_id);
        } catch (_) { /* noop */ }
      }

      await sendWa({
        recipient_phone: '+221784604003',
        recipient_type: 'admin',
        message: `✅ GP active Konnekt\n${prenom} · GP${ref} · ${phoneDisp}`,
        trigger_type: 'konnekt_gp_activated',
      });

      return new Response('ok', { headers: corsHeaders });
    }
  }

  // =================================================================
  //  GATE : GP existant mais whatsapp_confirmed_at IS NULL
  //  Tout message (autre que le message d'activation onboarding ci-dessus)
  //  → renvoyer vers l'inscription Konnekt et notifier l'admin.
  //  Ne jamais afficher AIDE / menu tant que non active.
  // =================================================================
  if (transporteur && !transporteur.whatsapp_confirmed_at) {
    const ref = String(transporteur.reference ?? '').padStart(4, '0');
    const fullName = `${transporteur.prenom ?? ''} ${transporteur.nom ?? ''}`.trim() || '—';
    const tel = transporteur.telephone_1 ?? fromPhone;
    const userText = (rawMsg || '').slice(0, 300) || '[message vide]';

    await reply(
      `Bonjour ! Konnekt est votre espace GP pour declarer vos departs et recevoir des missions Yobbante.\n\n` +
      `Inscription gratuite en 2 min :\n` +
      `https://usekonnekt.com/onboarding/${ref}\n\n` +
      `Des questions ? Un conseiller vous repond sous 24h.`,
      'gp_not_activated_redirect',
    );

    await sendWa({
      recipient_phone: '+221784604003',
      recipient_type: 'admin',
      message: `Message GP avant activation : ${fullName} ${tel}\nMessage : ${userText}`,
      trigger_type: 'admin_gp_pre_activation_msg',
    });

    return new Response('ok', { headers: corsHeaders });
  }



  // =================================================================
  //  TEMPLATE BUTTON HANDLERS — mission_accepted / refused / departure_confirmed
  //  Detecte le texte exact des boutons template (msg.button.text) OU
  //  l'id/title d'un button_reply interactive transmis par le webhook.
  // =================================================================
  if (transporteur) {
    const btnText = rawMsg.trim();
    const isOuiAccept = /^OUI\s*-\s*Accepter$/i.test(btnText) || /^accept(er)?$/i.test(btnText);
    const isNonRefuse = /^NON\s*-\s*Refuser$/i.test(btnText) || /^refus(er)?$/i.test(btnText);
    const isOkPret = /^OK\s*-\s*Je\s*suis\s*pret/i.test(btnText) || /^pret$/i.test(btnText);

    const gpName = (transporteur.prenom || transporteur.nom || transporteur.reference || 'GP').toString();

    if (isOuiAccept || isNonRefuse) {
      const { data: dossier } = await supa
        .from('dossiers')
        .select('id, tracking_id, reference, destination_city, destination_country, assigned_transporteur_ref, status, mission_accepted')
        .eq('assigned_transporteur_ref', transporteur.reference)
        .eq('status', 'ASSIGNED')
        .is('mission_accepted', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!dossier) {
        await reply(
          `Aucune mission en attente de confirmation. Tapez MENU pour voir vos missions.`,
          'mission_no_pending',
        );
        return new Response('ok', { headers: corsHeaders });
      }

      const trk = dossier.tracking_id || dossier.reference;
      const dest = dossier.destination_city || dossier.destination_country || 'destination';

      if (isOuiAccept) {
        await supa.from('dossiers').update({
          mission_accepted: true,
          mission_decided_at: new Date().toISOString(),
        }).eq('id', dossier.id);

        await notifyAdmin(
          `✅ GP ${gpName} a accepte ${trk} Dakar -> ${dest}`,
        );

        // Progressive tutorial : 1er colis assigné → expliquer COLLECTE
        if (!transporteur.tutorial_collecte_sent) {
          await reply(
            `📦 Votre premiere mission ! Pour confirmer la collecte tapez :\nCOLLECTE ${trk}`,
            'tutorial_collecte',
          );
          await supa.from('transporteurs')
            .update({ tutorial_collecte_sent: true })
            .eq('id', transporteur.id);
        } else {
          await reply(
            `✅ Mission ${trk} confirmee.\nA la collecte tapez : COLLECTE ${trk}`,
            'mission_accepted',
          );
        }
        await bumpGpActivity(dossier.id);
        return new Response('ok', { headers: corsHeaders });
      }


      // NON - Refuser
      await supa.from('dossiers').update({
        mission_accepted: false,
        mission_decided_at: new Date().toISOString(),
        assigned_transporteur_ref: null,
        assigned_departure_id: null,
        status: 'SUBMITTED',
      }).eq('id', dossier.id);

      await notifyAdmin(
        `GP ${gpName} a refuse ${trk}\nREASSIGNE ${trk} [ref_gp]`,
      );
      await reply(
        `Compris ${gpName}.\nMission annulee.\nEnvoyez AIDE si besoin.`,
        'mission_refused',
      );
      await bumpGpActivity(dossier.id);
      return new Response('ok', { headers: corsHeaders });
    }

    if (isOkPret) {
      const nowIso = new Date().toISOString();
      const in3d = new Date(Date.now() + 3 * 86400 * 1000).toISOString();
      const { data: dep } = await supa
        .from('manual_departures')
        .select('id, short_ref, transporteur_ref, departure_date, destination_city, destination_country')
        .eq('transporteur_ref', transporteur.reference)
        .gte('departure_date', nowIso.slice(0, 10))
        .lte('departure_date', in3d.slice(0, 10))
        .order('departure_date', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!dep) {
        await reply(
          `Aucun depart prevu dans les 3 prochains jours. Envoyez DEPART pour declarer.`,
          'departure_none',
        );
        return new Response('ok', { headers: corsHeaders });
      }

      await supa.from('manual_departures').update({
        departure_confirmed: true,
        departure_confirmed_at: nowIso,
      }).eq('id', dep.id);

      const ref = dep.short_ref || dep.id.slice(0, 6);
      const dateLbl = formatDateFr(dep.departure_date as unknown as string);

      const { data: colis } = await supa
        .from('dossiers')
        .select('tracking_id, reference')
        .eq('assigned_departure_id', dep.id)
        .limit(20);
      const listColis = (colis ?? []).map((c: any) => c.tracking_id || c.reference).filter(Boolean).join(', ') || 'aucun colis lie';

      await notifyAdmin(`GP ${gpName} confirme depart #${ref} le ${dateLbl}`);
      await reply(
        `Parfait ! Bon voyage ${gpName}.\nVos colis : ${listColis}`,
        'departure_confirmed',
      );
      await bumpGpActivity();
      return new Response('ok', { headers: corsHeaders });
    }
  }



  async function handleSuperAdmin(): Promise<Response | null> {
    const SA_MENU = `Mode Admin actif.

1 - Nouveau dossier
2 - Stats du jour
3 - Dossiers urgents
4 - Assigner GP
5 - Changer statut
6 - Contacter un GP

— ADMIN KONNEKT —
K · Tableau de bord
BETA · GPs en attente validation
VALIDE {ref} · Valider GP beta
REJETTE {ref} · Rejeter GP beta
GPS · Derniers inscrits
DEPARTS926 · Departs de la semaine
SYNC {ref} · Synchroniser GP

Tapez la commande, ou STOP pour quitter.`;

    async function saReply(text: string) {
      await sendWa({
        recipient_phone: fromPhone,
        recipient_type: 'admin',
        message: text,
        trigger_type: 'super_admin_reply',
      });
      if (input.inbound_id) {
        try {
          await supa.from('whatsapp_inbound_messages').update({
            bot_intent: 'super_admin',
            bot_response: text,
            replied_at: new Date().toISOString(),
          }).eq('id', input.inbound_id);
        } catch (_) { /* noop */ }
      }
    }

    async function saButtons(text: string, buttons: Array<{ id: string; label: string }>, trigger = 'super_admin_buttons') {
      try {
        await sendWa({
          recipient_phone: fromPhone,
          recipient_type: 'admin',
          interactive_type: 'button',
          interactive_body: text,
          buttons: buttons.slice(0, 3).map(b => ({ id: b.id, label: b.label.slice(0, 20) })),
          fallback_text: text,
          trigger_type: trigger,
        });
      } catch (e) { console.error('saButtons err', e); }
    }

    async function saAudit(action: string, opts?: { gp_reference?: string | null; gp_id?: string | null; target_phone?: string | null; details?: any }) {
      try {
        await supa.from('super_admin_audit_log').insert({
          admin_phone: fromPhone,
          action,
          gp_reference: opts?.gp_reference ?? null,
          gp_id: opts?.gp_id ?? null,
          target_phone: opts?.target_phone ?? null,
          details: opts?.details ?? {},
        });
      } catch (e) { console.error('saAudit err', e); }
    }

    // PING/PONG — test rapide du routing super admin (926)
    if (/^ping$/i.test(msg)) {
      await saReply('pong ✓ Super admin OK (926)');
      await saAudit('PING');
      return new Response('ok', { headers: corsHeaders });
    }


    // Load existing super admin session
    const { data: saSession } = await supa
      .from('gp_bot_sessions')
      .select('*')
      .eq('from_phone', fromPhone)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const saActive = saSession
      && saSession.pending_intent?.startsWith('sa_')
      && (Date.now() - new Date(saSession.updated_at).getTime()) < 30 * 60 * 1000;

    async function saClear() {
      if (saSession?.id) await supa.from('gp_bot_sessions').delete().eq('id', saSession.id);
    }
    async function saSave(intent: string, data: Record<string, unknown>) {
      const payload = { ...data, is_super_admin: true };
      if (saSession?.id) {
        await supa.from('gp_bot_sessions').update({ pending_intent: intent, pending_data: payload }).eq('id', saSession.id);
      } else {
        await supa.from('gp_bot_sessions').insert({ from_phone: fromPhone, pending_intent: intent, pending_data: payload });
      }
    }

    // STOP/cancel
    if (/^(stop|annul|cancel|reset|quit)/i.test(msg)) {
      await saClear();
      await saReply('Mode Admin desactive.');
      return new Response('ok', { headers: corsHeaders });
    }

    // Menu / aide
    if (!saActive && (/^(menu|aide|help|admin|\?|0)$/i.test(msg) || msg === '')) {
      await saClear();
      await saReply(SA_MENU);
      return new Response('ok', { headers: corsHeaders });
    }

    // ============= ADMIN KONNEKT COMMANDS =============
    function normRef(s: string): string {
      return (s || '').trim().toUpperCase().replace(/^GP[-\s]?/, '').replace(/\D/g, '').padStart(4, '0').slice(0, 4);
    }
    function fmtDateFr(d: any): string {
      if (!d) return '—';
      try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return '—'; }
    }
    async function sendToGp(phone: string, message: string, transporteurId?: string) {
      if (!phone) return;
      await sendWa({
        recipient_phone: phone,
        recipient_type: 'gp',
        message,
        transporteur_id: transporteurId,
        trigger_type: 'admin_konnekt_notify',
      });
    }

    // K / KONNEKT — dashboard
    // K / KONNEKT — dashboard (+ boutons)
    if (!saActive && /^(k|konnekt|SA_K)$/i.test(msg)) {
      await saClear();
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
      const [{ count: total }, { count: valides }, { count: attente }, { count: departs }, { data: last }] = await Promise.all([
        supa.from('transporteurs').select('id', { count: 'exact', head: true }).eq('konnekt_registered', true),
        supa.from('transporteurs').select('id', { count: 'exact', head: true }).eq('konnekt_registered', true).eq('is_beta_validated', true),
        supa.from('transporteurs').select('id', { count: 'exact', head: true }).eq('konnekt_registered', true).eq('is_beta_validated', false).is('beta_rejected_at', null),
        supa.from('manual_departures').select('id', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString()),
        supa.from('transporteurs').select('prenom, nom, reference, konnekt_registered_at').eq('konnekt_registered', true).order('konnekt_registered_at', { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
      ]);
      const lastName = last ? `${(last.prenom ?? '').trim()} ${(last.nom ?? '').trim()}`.trim() || `GP${last.reference}` : '—';
      const lastDate = last?.konnekt_registered_at ? fmtDateFr(last.konnekt_registered_at) : '—';
      await saReply(`📊 Konnekt — Tableau de bord\n\nGPs inscrits : ${total ?? 0}\nBeta valides : ${valides ?? 0}\nEn attente : ${attente ?? 0}\nDeparts ce mois : ${departs ?? 0}\nDernier inscrit : ${lastName} · ${lastDate}`);
      await saButtons('Navigation rapide :', [
        { id: 'SA_BETA:1', label: `⏳ Beta (${attente ?? 0})` },
        { id: 'SA_GPS', label: '🆕 Derniers GPs' },
        { id: 'SA_DEPARTS', label: '🗓 Departs' },
      ], 'sa_konnekt_buttons');
      await saAudit('KONNEKT', { details: { total, valides, attente, departs } });
      return new Response('ok', { headers: corsHeaders });
    }

    // BETA [page] — list paginated GPs awaiting validation (10/page)
    {
      const mBeta = msg.match(/^beta(?:\s+(\d+))?$/i) || msg.match(/^SA_BETA(?::(\d+))?$/i);
      if (!saActive && mBeta) {
        await saClear();
        const page = Math.max(1, parseInt(mBeta[1] || '1', 10) || 1);
        const pageSize = 10;
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data: rows, count } = await supa
          .from('transporteurs')
          .select('reference, prenom, nom, telephone_1, konnekt_registered_at, created_at', { count: 'exact' })
          .eq('konnekt_registered', true)
          .eq('is_beta_validated', false)
          .is('beta_rejected_at', null)
          .order('konnekt_registered_at', { ascending: false, nullsFirst: false })
          .range(from, to);
        const totalCount = count ?? 0;
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        if (!rows || rows.length === 0) {
          await saReply(page === 1 ? 'Aucun GP en attente de validation beta. ✅' : `Aucun GP a la page ${page}.`);
          await saAudit('BETA_LIST', { details: { page, totalCount } });
          return new Response('ok', { headers: corsHeaders });
        }
        const lines = rows.map((r, i) => {
          const nm = `${(r.prenom ?? '').trim()} ${(r.nom ?? '').trim()}`.trim() || `GP${r.reference}`;
          const dt = fmtDateFr(r.konnekt_registered_at ?? r.created_at);
          return `${from + i + 1}. ${nm} · GP${r.reference} · ${r.telephone_1 ?? '—'} · ${dt}`;
        }).join('\n');
        await saReply(`👥 GPs en attente beta — page ${page}/${totalPages} (total : ${totalCount}) :\n\n${lines}\n\nValider : VALIDE GP{ref} · Rejeter : REJETTE GP{ref}`);
        // Boutons pagination + premier GP (validation rapide)
        const firstRef = String(rows[0].reference ?? '').padStart(4, '0');
        const btns: Array<{ id: string; label: string }> = [];
        if (page > 1) btns.push({ id: `SA_BETA:${page - 1}`, label: '⬅ Precedent' });
        if (page < totalPages) btns.push({ id: `SA_BETA:${page + 1}`, label: 'Suivant ➡' });
        btns.push({ id: `SA_VALIDE:${firstRef}`, label: `✅ Valider #1` });
        await saButtons(`Page ${page}/${totalPages}`, btns, 'sa_beta_pagination');
        await saAudit('BETA_LIST', { details: { page, totalPages, totalCount, returned: rows.length } });
        return new Response('ok', { headers: corsHeaders });
      }
    }

    // VALIDE {ref} (texte ou bouton SA_VALIDE:xxxx)
    {
      const mV = msg.match(/^valide\s+(.+)$/i) || msg.match(/^SA_VALIDE:(.+)$/i);
      if (!saActive && mV) {
        const ref = normRef(mV[1]);
        const { data: gp } = await supa.from('transporteurs')
          .select('id, reference, prenom, nom, telephone_1, is_beta_validated').eq('reference', ref).maybeSingle();
        if (!gp) { await saReply(`GP ${ref} introuvable.`); await saAudit('VALIDE_FAIL', { gp_reference: ref, details: { reason: 'not_found' } }); return new Response('ok', { headers: corsHeaders }); }
        const nm = `${(gp.prenom ?? '').trim()} ${(gp.nom ?? '').trim()}`.trim() || `GP${gp.reference}`;
        if (gp.is_beta_validated) {
          await saReply(`✅ ${nm} (GP${ref}) est deja valide.`);
          await saAudit('VALIDE_NOOP', { gp_reference: ref, gp_id: gp.id, target_phone: gp.telephone_1 });
          return new Response('ok', { headers: corsHeaders });
        }
        await supa.from('transporteurs').update({
          is_beta_validated: true,
          beta_validated_at: new Date().toISOString(),
          beta_rejected_at: null,
          beta_rejected_reason: null,
        }).eq('id', gp.id);
        await sendToGp(gp.telephone_1, `Felicitations ${gp.prenom ?? ''} ! 🎉\n\nVotre compte Konnekt GP est valide.\nVous pouvez maintenant declarer vos departs et accepter des missions.\n\nTapez AIDE pour voir vos commandes.\n\nReference : GP${gp.reference}`, gp.id);
        await saReply(`✅ GP ${nm} (GP${ref}) valide. Message envoye.`);
        await saButtons('Continuer :', [
          { id: 'SA_BETA:1', label: '⏳ Liste beta' },
          { id: 'SA_K', label: '📊 Tableau bord' },
        ], 'sa_after_valide');
        await saAudit('VALIDE', { gp_reference: ref, gp_id: gp.id, target_phone: gp.telephone_1 });
        return new Response('ok', { headers: corsHeaders });
      }
    }

    // REJETTE {ref} (texte ou bouton SA_REJETTE:xxxx)
    {
      const mR = msg.match(/^rejette\s+(.+)$/i) || msg.match(/^SA_REJETTE:(.+)$/i);
      if (!saActive && mR) {
        const ref = normRef(mR[1]);
        const { data: gp } = await supa.from('transporteurs')
          .select('id, reference, prenom, nom, telephone_1').eq('reference', ref).maybeSingle();
        if (!gp) { await saReply(`GP ${ref} introuvable.`); await saAudit('REJETTE_FAIL', { gp_reference: ref, details: { reason: 'not_found' } }); return new Response('ok', { headers: corsHeaders }); }
        const nm = `${(gp.prenom ?? '').trim()} ${(gp.nom ?? '').trim()}`.trim() || `GP${gp.reference}`;
        await supa.from('transporteurs').update({
          is_beta_validated: false,
          beta_rejected_at: new Date().toISOString(),
          beta_rejected_reason: 'Rejected by admin via WhatsApp',
        }).eq('id', gp.id);
        await sendToGp(gp.telephone_1, `Bonjour ${gp.prenom ?? ''},\n\nVotre demande d'acces beta Konnekt n'a pas pu etre validee pour le moment.\nNotre equipe vous recontactera prochainement.\n\nMerci de votre comprehension.\n— Konnekt`, gp.id);
        await saReply(`❌ GP ${nm} (GP${ref}) rejete. Message envoye.`);
        await saAudit('REJETTE', { gp_reference: ref, gp_id: gp.id, target_phone: gp.telephone_1 });
        return new Response('ok', { headers: corsHeaders });
      }
    }

    // GPS — 10 latest Konnekt signups
    if (!saActive && /^(gps|SA_GPS)$/i.test(msg)) {
      await saClear();
      const { data: rows } = await supa
        .from('transporteurs')
        .select('reference, prenom, nom, telephone_1, is_beta_validated, beta_rejected_at, konnekt_registered_at')
        .eq('konnekt_registered', true)
        .order('konnekt_registered_at', { ascending: false, nullsFirst: false })
        .limit(10);
      if (!rows || rows.length === 0) {
        await saReply('Aucun GP inscrit sur Konnekt.');
        await saAudit('GPS_LIST', { details: { count: 0 } });
        return new Response('ok', { headers: corsHeaders });
      }
      const lines = rows.map((r, i) => {
        const nm = `${(r.prenom ?? '').trim()} ${(r.nom ?? '').trim()}`.trim() || `GP${r.reference}`;
        const st = r.is_beta_validated ? '✅' : (r.beta_rejected_at ? '❌' : '⏳');
        return `${i + 1}. ${st} ${nm} · GP${r.reference} · ${fmtDateFr(r.konnekt_registered_at)}`;
      }).join('\n');
      await saReply(`🆕 Derniers inscrits Konnekt :\n\n${lines}\n\n✅ valide · ⏳ attente · ❌ rejete`);
      await saAudit('GPS_LIST', { details: { count: rows.length } });
      return new Response('ok', { headers: corsHeaders });
    }

    // DEPARTS926 — departures of the week
    if (!saActive && (/^departs?926$/i.test(msg) || /^SA_DEPARTS$/i.test(msg))) {
      await saClear();
      const now = new Date();
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
      const { data: deps } = await supa
        .from('manual_departures')
        .select('short_ref, transporteur_ref, departure_date, destination_city, destination_country, total_capacity_kg, available_capacity_kg, created_at')
        .gte('created_at', weekStart.toISOString())
        .order('departure_date', { ascending: true })
        .limit(20);
      if (!deps || deps.length === 0) {
        await saReply('Aucun depart cree cette semaine.');
        await saAudit('DEPARTS_LIST', { details: { count: 0 } });
        return new Response('ok', { headers: corsHeaders });
      }
      const lines = deps.map((d: any) => {
        const cap = d.available_capacity_kg != null && d.total_capacity_kg != null
          ? `${d.available_capacity_kg}/${d.total_capacity_kg}kg`
          : '—';
        const dest = d.destination_city || d.destination_country || '—';
        return `#${d.short_ref ?? '—'} · GP${d.transporteur_ref ?? '—'} · ${fmtDateFr(d.departure_date)} · → ${dest} · ${cap}`;
      }).join('\n');
      await saReply(`🗓 Departs semaine (${deps.length}) :\n\n${lines}`);
      await saAudit('DEPARTS_LIST', { details: { count: deps.length } });
      return new Response('ok', { headers: corsHeaders });
    }

    // SYNC {ref} (texte ou bouton SA_SYNC:xxxx)
    {
      const mS = msg.match(/^sync\s+(.+)$/i) || msg.match(/^SA_SYNC:(.+)$/i);
      if (!saActive && mS) {
        const ref = normRef(mS[1]);
        const { data: gp } = await supa.from('transporteurs')
          .select('id, reference, prenom, nom, telephone_1, konnekt_registered, profile_complete, is_beta_validated')
          .eq('reference', ref).maybeSingle();
        if (!gp) { await saReply(`GP ${ref} introuvable.`); await saAudit('SYNC_FAIL', { gp_reference: ref, details: { reason: 'not_found' } }); return new Response('ok', { headers: corsHeaders }); }
        await supa.from('transporteurs').update({
          konnekt_registered: true,
          konnekt_registered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', gp.id);
        const nm = `${(gp.prenom ?? '').trim()} ${(gp.nom ?? '').trim()}`.trim() || `GP${gp.reference}`;
        await saReply(`✅ GP${ref} (${nm}) synchronise.\nProfil complet : ${gp.profile_complete ? 'oui' : 'non'}\nBeta valide : ${gp.is_beta_validated ? 'oui' : 'non'}`);
        await saAudit('SYNC', { gp_reference: ref, gp_id: gp.id, target_phone: gp.telephone_1 });
        return new Response('ok', { headers: corsHeaders });
      }
    }



    // Top-level command dispatch
    if (!saActive && /^[1-6]$/.test(msg)) {
      const cmd = msg;
      if (cmd === '1') {
        await saSave('sa_new_type', {});
        await saReply('Type ? (1=Expedier 2=Recevoir 3=Sourcing)');
        return new Response('ok', { headers: corsHeaders });
      }
      if (cmd === '2') return await saStats();
      if (cmd === '3') return await saUrgents();
      if (cmd === '4') {
        await saSave('sa_assign_tracking', {});
        await saReply('Quel tracking ID ? (ex: YOB-K7M9P2)');
        return new Response('ok', { headers: corsHeaders });
      }
      if (cmd === '5') {
        await saSave('sa_status_tracking', {});
        await saReply('Quel tracking ID ?');
        return new Response('ok', { headers: corsHeaders });
      }
      if (cmd === '6') {
        await saSave('sa_contact_ref', {});
        await saReply('Quelle ref GP ? (ex: GP0001)');
        return new Response('ok', { headers: corsHeaders });
      }
    }

    // ===== Command 2: stats du jour =====
    async function saStats(): Promise<Response> {
      await saClear();
      const today = new Date().toISOString().slice(0, 10);
      const { count: cNew } = await supa.from('dossiers').select('id', { count: 'exact', head: true })
        .gte('created_at', today);
      const { count: cActive } = await supa.from('dossiers').select('id', { count: 'exact', head: true })
        .not('status', 'in', '(DELIVERED,ARCHIVED,CANCELLED)');
      const { count: cDeliv } = await supa.from('dossiers').select('id', { count: 'exact', head: true })
        .eq('status', 'DELIVERED').gte('delivered_at', today);
      const { count: cPay } = await supa.from('dossiers').select('id', { count: 'exact', head: true })
        .eq('payment_status', 'pending').eq('status', 'WEIGHED');
      const { count: cMsg } = await supa.from('whatsapp_inbound_messages').select('id', { count: 'exact', head: true })
        .eq('is_read', false);
      const dStr = new Date().toLocaleDateString('fr-FR');
      await saReply(`Stats du ${dStr} :

Nouveaux : ${cNew ?? 0}
En cours : ${cActive ?? 0}
Livres : ${cDeliv ?? 0}
Paiements en attente : ${cPay ?? 0}
Messages non lus : ${cMsg ?? 0}`);
      return new Response('ok', { headers: corsHeaders });
    }

    // ===== Command 3: dossiers urgents =====
    async function saUrgents(): Promise<Response> {
      await saClear();
      const now = Date.now();
      const h24 = new Date(now - 24 * 3600 * 1000).toISOString();
      const h48 = new Date(now - 48 * 3600 * 1000).toISOString();
      const d5 = new Date(now - 5 * 24 * 3600 * 1000).toISOString();

      const { data: weighed } = await supa.from('dossiers')
        .select('tracking_id, status, weighed_at, buyer_name')
        .eq('status', 'WEIGHED').eq('payment_status', 'pending')
        .lte('weighed_at', h24).limit(10);
      const { data: arrived } = await supa.from('dossiers')
        .select('tracking_id, status, updated_at, buyer_name')
        .eq('status', 'ARRIVED_HUB').lte('updated_at', d5).limit(10);
      const { data: awaiting } = await supa.from('dossiers')
        .select('tracking_id, status, updated_at, buyer_name')
        .eq('status', 'AWAITING_CLIENT').lte('updated_at', h48).limit(10);

      const fmt = (d: any, ref: string) => {
        const days = Math.floor((now - new Date(d.weighed_at ?? d.updated_at).getTime()) / (24 * 3600 * 1000));
        return `${d.tracking_id ?? '—'} (${d.status}) - ${days}j - ${d.buyer_name ?? '?'}`;
      };
      const lines: string[] = [];
      (weighed ?? []).forEach((d) => lines.push(fmt(d, 'WEIGHED')));
      (arrived ?? []).forEach((d) => lines.push(fmt(d, 'ARRIVED_HUB')));
      (awaiting ?? []).forEach((d) => lines.push(fmt(d, 'AWAITING_CLIENT')));

      if (lines.length === 0) {
        await saReply('Aucun dossier urgent. Top !');
      } else {
        await saReply(`Dossiers urgents (${lines.length}) :\n\n${lines.join('\n')}`);
      }
      return new Response('ok', { headers: corsHeaders });
    }

    // ===== Active session handlers =====
    if (saActive) {
      const intent = saSession!.pending_intent as string;
      const data = (saSession!.pending_data ?? {}) as Record<string, any>;

      // -- Command 1: new dossier (guided) --
      if (intent === 'sa_new_type') {
        const tMap: Record<string, string> = { '1': 'expedier', '2': 'recevoir', '3': 'sourcing' };
        const t = tMap[msg];
        if (!t) { await saReply('Tapez 1, 2 ou 3.'); return new Response('ok', { headers: corsHeaders }); }
        await saSave('sa_new_name', { ...data, service_type: t });
        await saReply('Nom du client ?');
        return new Response('ok', { headers: corsHeaders });
      }
      if (intent === 'sa_new_name') {
        await saSave('sa_new_phone', { ...data, buyer_name: rawMsg });
        await saReply('Telephone client ?');
        return new Response('ok', { headers: corsHeaders });
      }
      if (intent === 'sa_new_phone') {
        await saSave('sa_new_origin', { ...data, contact_phone: rawMsg });
        await saReply('Origine ? (pays ou ville)');
        return new Response('ok', { headers: corsHeaders });
      }
      if (intent === 'sa_new_origin') {
        await saSave('sa_new_dest', { ...data, origin_country: rawMsg.toUpperCase().slice(0, 3) });
        await saReply('Destination ?');
        return new Response('ok', { headers: corsHeaders });
      }
      if (intent === 'sa_new_dest') {
        await saSave('sa_new_weight', { ...data, destination_country: rawMsg.toUpperCase().slice(0, 3) });
        await saReply('Poids estime (kg) ?');
        return new Response('ok', { headers: corsHeaders });
      }
      if (intent === 'sa_new_weight') {
        const w = parseWeight(rawMsg);
        if (!w) { await saReply('Poids invalide. Donnez un nombre en kg.'); return new Response('ok', { headers: corsHeaders }); }
        await saSave('sa_new_canal', { ...data, estimated_weight: w });
        await saReply('Canal ? (1=WhatsApp 2=Appel 3=Email)');
        return new Response('ok', { headers: corsHeaders });
      }
      if (intent === 'sa_new_canal') {
        const cMap: Record<string, string> = { '1': 'whatsapp', '2': 'telephone', '3': 'email' };
        const c = cMap[msg];
        if (!c) { await saReply('Tapez 1, 2 ou 3.'); return new Response('ok', { headers: corsHeaders }); }
        await saSave('sa_new_notes', { ...data, source: c });
        await saReply('Notes ? (0 pour skip)');
        return new Response('ok', { headers: corsHeaders });
      }
      if (intent === 'sa_new_notes') {
        const notes = rawMsg.trim() === '0' ? null : rawMsg;
        const payload = {
          buyer_name: data.buyer_name,
          contact_phone: data.contact_phone,
          origin_country: data.origin_country,
          destination_country: data.destination_country,
          estimated_weight: data.estimated_weight,
          service_type: data.service_type,
          source: data.source,
          intake_method: 'manual_intake',
          status: 'NEW',
          notes,
        };
        const { data: dossier, error } = await supa.from('dossiers')
          .insert(payload).select('tracking_id, reference').maybeSingle();
        await saClear();
        if (error) {
          await saReply(`Erreur creation : ${error.message}`);
        } else {
          await saReply(`Dossier cree !
Ref : ${dossier?.tracking_id ?? dossier?.reference ?? '—'}
Client : ${data.buyer_name} - ${data.contact_phone}
Route : ${data.origin_country} > ${data.destination_country}

Voir : yobbante.com/admin`);
        }
        return new Response('ok', { headers: corsHeaders });
      }

      // -- Command 4: assign GP --
      if (intent === 'sa_assign_tracking') {
        const tk = parseTracking(rawMsg) ?? rawMsg.trim().toUpperCase();
        const { data: d } = await supa.from('dossiers')
          .select('id, tracking_id, destination_country, estimated_weight')
          .or(`tracking_id.eq.${tk},reference.eq.${tk}`).maybeSingle();
        if (!d) { await saClear(); await saReply(`Dossier ${tk} introuvable.`); return new Response('ok', { headers: corsHeaders }); }
        const { data: gps } = await supa.from('transporteurs')
          .select('id, reference, prenom, nom, telephone_1').eq('actif', true).limit(5);
        if (!gps || gps.length === 0) { await saClear(); await saReply('Aucun GP disponible.'); return new Response('ok', { headers: corsHeaders }); }
        const list = gps.map((g, i) => `${i + 1}. ${g.reference} - ${g.prenom ?? ''} ${g.nom ?? ''}`.trim()).join('\n');
        await saSave('sa_assign_pick', { dossier_id: d.id, tracking: d.tracking_id, gp_ids: gps.map((g) => g.id), gp_refs: gps.map((g) => g.reference) });
        await saReply(`Top 5 GP :\n${list}\n\nChoisissez le numero (1-${gps.length})`);
        return new Response('ok', { headers: corsHeaders });
      }
      if (intent === 'sa_assign_pick') {
        const n = parseInt(msg, 10);
        if (!n || n < 1 || n > (data.gp_ids?.length ?? 0)) { await saReply('Numero invalide.'); return new Response('ok', { headers: corsHeaders }); }
        const gpRef = data.gp_refs[n - 1];
        const { error } = await supa.from('dossiers')
          .update({ status: 'ASSIGNED', assigned_transporteur_ref: gpRef })
          .eq('id', data.dossier_id);
        await saClear();
        if (error) { await saReply(`Erreur : ${error.message}`); }
        else { await saReply(`OK : dossier ${data.tracking} assigne a ${gpRef}. Notifications envoyees.`); }
        return new Response('ok', { headers: corsHeaders });
      }

      // -- Command 5: change status --
      if (intent === 'sa_status_tracking') {
        const tk = parseTracking(rawMsg) ?? rawMsg.trim().toUpperCase();
        const { data: d } = await supa.from('dossiers')
          .select('id, tracking_id, status').or(`tracking_id.eq.${tk},reference.eq.${tk}`).maybeSingle();
        if (!d) { await saClear(); await saReply(`Dossier ${tk} introuvable.`); return new Response('ok', { headers: corsHeaders }); }
        const STATUSES = ['NEW','CONFIRMED','ASSIGNED','COLLECTED','WEIGHED','IN_TRANSIT','ARRIVED_HUB','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'];
        const list = STATUSES.map((s, i) => `${i + 1}. ${s}`).join('\n');
        await saSave('sa_status_pick', { dossier_id: d.id, tracking: d.tracking_id, statuses: STATUSES });
        await saReply(`Statut actuel : ${d.status}\n\n${list}\n\nQuel statut ?`);
        return new Response('ok', { headers: corsHeaders });
      }
      if (intent === 'sa_status_pick') {
        const n = parseInt(msg, 10);
        const statuses: string[] = data.statuses ?? [];
        if (!n || n < 1 || n > statuses.length) { await saReply('Numero invalide.'); return new Response('ok', { headers: corsHeaders }); }
        const newStatus = statuses[n - 1];
        const { error } = await supa.from('dossiers').update({ status: newStatus }).eq('id', data.dossier_id);
        await saClear();
        if (error) { await saReply(`Erreur : ${error.message}`); }
        else { await saReply(`OK : ${data.tracking} -> ${newStatus}. Client notifie.`); }
        return new Response('ok', { headers: corsHeaders });
      }

      // -- Command 6: contact GP --
      if (intent === 'sa_contact_ref') {
        const ref = rawMsg.trim().toUpperCase().replace(/^GP[-\s]?/i, '').padStart(4, '0').slice(0, 4);
        const { data: gp } = await supa.from('transporteurs')
          .select('id, reference, prenom, nom, telephone_1').eq('reference', ref).maybeSingle();
        if (!gp || !gp.telephone_1) { await saClear(); await saReply(`GP ${ref} introuvable ou sans telephone.`); return new Response('ok', { headers: corsHeaders }); }
        await saSave('sa_contact_msg', { gp_id: gp.id, gp_phone: gp.telephone_1, gp_ref: gp.reference });
        await saReply(`GP : ${gp.prenom ?? ''} ${gp.nom ?? ''} (${gp.telephone_1})\n\nVotre message ?`);
        return new Response('ok', { headers: corsHeaders });
      }
      if (intent === 'sa_contact_msg') {
        await sendWa({
          recipient_phone: data.gp_phone,
          recipient_type: 'gp',
          message: rawMsg,
          transporteur_id: data.gp_id,
          trigger_type: 'super_admin_contact',
        });
        await saClear();
        await saReply(`Message envoye a ${data.gp_ref}.`);
        return new Response('ok', { headers: corsHeaders });
      }
    }

    // Super admin without active session and message not matching menu -> show menu
    if (!saActive) {
      await saReply(`Commande non reconnue.\n\n${SA_MENU}`);
      return new Response('ok', { headers: corsHeaders });
    }

    return null;
  }

  if (!transporteur) {
    // -----------------------------------------------------------------
    // ONBOARDING bot 926 — guidé, crée un transporteur partenaire
    // -----------------------------------------------------------------
    const { data: onbSession } = await supa
      .from('gp_bot_sessions')
      .select('*')
      .eq('from_phone', fromPhone)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const onbActive = onbSession
      && (onbSession.pending_intent ?? '').startsWith('onb_')
      && (Date.now() - new Date(onbSession.updated_at).getTime()) < 60 * 60 * 1000;

    async function onbSave(intent: string, data: Record<string, unknown>) {
      if (onbSession?.id) {
        await supa.from('gp_bot_sessions').update({ pending_intent: intent, pending_data: data }).eq('id', onbSession.id);
      } else {
        await supa.from('gp_bot_sessions').insert({ from_phone: fromPhone, pending_intent: intent, pending_data: data });
      }
    }
    async function onbClear() {
      if (onbSession?.id) await supa.from('gp_bot_sessions').delete().eq('id', onbSession.id);
    }

    // STOP — abandon
    if (onbActive && /^(stop|annul|cancel|quit)/i.test(msg)) {
      await onbClear();
      await reply(`Inscription annulee. Tapez START pour reprendre.`, 'onb_cancel');
      return new Response('ok', { headers: corsHeaders });
    }

    // Bootstrap : premier message → demande prénom
    if (!onbActive) {
      try {
        await supa.from('gp_unknown_contacts').insert({
          phone: fromPhone, from_name: input.from_name ?? null, message: rawMsg.slice(0, 500),
        });
      } catch (_) { /* noop */ }
      await onbSave('onb_prenom', {});
      await reply(
        `Bienvenue sur Konnekt ! 👋\n\nPour vous inscrire en tant que transporteur partenaire, j'ai besoin de quelques infos.\n\nQuel est votre PRENOM ?`,
        'onb_start',
      );
      await notifyAdmin(`Nouveau contact sur le 926 (Konnekt GP) — onboarding lance :\n${fromPhone}${input.from_name ? ` (${input.from_name})` : ''}`);
      return new Response('ok', { headers: corsHeaders });
    }

    // Étapes guidées
    const intent = onbSession!.pending_intent as string;
    const data = (onbSession!.pending_data ?? {}) as Record<string, any>;

    if (intent === 'onb_prenom') {
      const v = rawMsg.trim();
      if (v.length < 2) { await reply(`Prenom trop court. Donnez votre prenom.`, 'onb_prenom_retry'); return new Response('ok', { headers: corsHeaders }); }
      await onbSave('onb_nom', { ...data, prenom: v });
      await reply(`Merci ${v} !\n\nQuel est votre NOM de famille ?`, 'onb_ask_nom');
      return new Response('ok', { headers: corsHeaders });
    }
    if (intent === 'onb_nom') {
      const v = rawMsg.trim();
      if (v.length < 2) { await reply(`Nom trop court.`, 'onb_nom_retry'); return new Response('ok', { headers: corsHeaders }); }
      await onbSave('onb_adresse', { ...data, nom: v });
      await reply(`Quelle est votre ADRESSE de collecte a Dakar ?\n(Ex : Villa 123, Sacre-Coeur 3)`, 'onb_ask_adresse');
      return new Response('ok', { headers: corsHeaders });
    }
    if (intent === 'onb_adresse') {
      const v = rawMsg.trim();
      if (v.length < 5) { await reply(`Adresse trop courte. Soyez precis.`, 'onb_adresse_retry'); return new Response('ok', { headers: corsHeaders }); }
      await onbSave('onb_zone', { ...data, adresse_dakar: v });
      await reply(
        `Quelle ZONE de Dakar ?\n\n1 - Plateau / Medina\n2 - HLM / Liberte / Point E\n3 - Sacre-Coeur / Mermoz\n4 - Almadies / Ngor / Yoff\n5 - Pikine / Guediawaye\n6 - Rufisque / Bargny\n\nTapez le numero.`,
        'onb_ask_zone',
      );
      return new Response('ok', { headers: corsHeaders });
    }
    if (intent === 'onb_zone') {
      const zMap: Record<string, string> = {
        '1': 'Plateau', '2': 'HLM', '3': 'Sacre-Coeur', '4': 'Almadies', '5': 'Pikine', '6': 'Rufisque',
      };
      const z = zMap[msg];
      if (!z) { await reply(`Tapez 1, 2, 3, 4, 5 ou 6.`, 'onb_zone_retry'); return new Response('ok', { headers: corsHeaders }); }
      await onbSave('onb_villes', { ...data, zone_dakar: z });
      await reply(
        `Vers quelles VILLES voyagez-vous ?\n\nListez les villes separees par une virgule.\nEx : Paris, Lyon, Marseille\n\n(Ce sera votre navette principale.)`,
        'onb_ask_villes',
      );
      return new Response('ok', { headers: corsHeaders });
    }
    if (intent === 'onb_villes') {
      const villes = rawMsg.split(/[,;\n]+/).map(s => s.trim()).filter(s => s.length >= 2).slice(0, 8);
      if (villes.length === 0) { await reply(`Listez au moins une ville. Ex : Paris, Lyon`, 'onb_villes_retry'); return new Response('ok', { headers: corsHeaders }); }
      await onbSave('onb_adresses_villes', { ...data, villes, ville_idx: 0, adresses_villes: {} });
      await reply(
        `Super ! Vous desservez : ${villes.join(', ')}\n\nMaintenant, donnez votre adresse de remise a ${villes[0]} ?\n(ou tapez SKIP pour passer)`,
        'onb_ask_addr_first',
      );
      return new Response('ok', { headers: corsHeaders });
    }
    if (intent === 'onb_adresses_villes') {
      const villes = (data.villes ?? []) as string[];
      const idx = (data.ville_idx ?? 0) as number;
      const adresses = (data.adresses_villes ?? {}) as Record<string, string>;
      const currentVille = villes[idx];
      const v = rawMsg.trim();
      if (!/^skip$/i.test(v) && v.length >= 5) adresses[currentVille] = v;
      const nextIdx = idx + 1;
      if (nextIdx < villes.length) {
        await onbSave('onb_adresses_villes', { ...data, ville_idx: nextIdx, adresses_villes: adresses });
        await reply(`Adresse de remise a ${villes[nextIdx]} ?\n(ou SKIP)`, 'onb_ask_addr_next');
        return new Response('ok', { headers: corsHeaders });
      }
      // ----- Passage aux TARIFS par ville -----
      await onbSave('onb_tarifs', { ...data, adresses_villes: adresses, tarif_idx: 0, rates_per_city: {} });
      await reply(
        `Super ! Maintenant vos TARIFS.\n\nPour chaque ville, donnez votre prix par kg en FCFA.\n(ou tapez SKIP pour utiliser le tarif par defaut)\n\nTarif par kg pour ${villes[0]} ?`,
        'onb_ask_tarif_first',
      );
      return new Response('ok', { headers: corsHeaders });
    }
    if (intent === 'onb_tarifs') {
      const villes = (data.villes ?? []) as string[];
      const adresses = (data.adresses_villes ?? {}) as Record<string, string>;
      const idx = (data.tarif_idx ?? 0) as number;
      const rates = (data.rates_per_city ?? {}) as Record<string, number>;
      const currentVille = villes[idx];
      const raw = rawMsg.trim();
      if (!/^skip$/i.test(raw)) {
        const num = parseInt(raw.replace(/[^\d]/g, ''), 10);
        if (!Number.isFinite(num) || num < 500 || num > 50000) {
          await reply(`Prix invalide. Donnez un montant en FCFA (ex: 6500), ou SKIP.`, 'onb_tarif_retry');
          return new Response('ok', { headers: corsHeaders });
        }
        rates[currentVille] = num;
      }
      const nextIdx = idx + 1;
      if (nextIdx < villes.length) {
        await onbSave('onb_tarifs', { ...data, tarif_idx: nextIdx, rates_per_city: rates });
        await reply(`Tarif par kg pour ${villes[nextIdx]} ?\n(ou SKIP)`, 'onb_ask_tarif_next');
        return new Response('ok', { headers: corsHeaders });
      }
      // ----- Finalisation : creer le transporteur -----
      let reference = String(Math.floor(1000 + Math.random() * 9000));
      for (let i = 0; i < 5; i++) {
        const { data: exists } = await supa.from('transporteurs').select('id').eq('reference', reference).maybeSingle();
        if (!exists) break;
        reference = String(Math.floor(1000 + Math.random() * 9000));
      }
      const navettes = [{
        id: `nav_${Date.now().toString(36)}`,
        villes: [
          { ville: 'Dakar', adresse: data.adresse_dakar, creneau: undefined },
          ...villes.map((vName: string) => ({ ville: vName, adresse: adresses[vName] || undefined })),
        ],
      }];
      const { data: created, error: cErr } = await supa.from('transporteurs').insert({
        reference,
        prenom: data.prenom,
        nom: data.nom,
        telephone_1: fromPhone,
        whatsapp: fromPhone,
        adresse_1: data.adresse_dakar,
        adresse_collecte_dakar: data.adresse_dakar,
        ville: 'Dakar',
        zone: data.zone_dakar,
        adresses_remise: adresses,
        navettes,
        rates_per_city: rates,
        actif: true,
        konnekt_registered: false,
        notes: 'Inscrit via WhatsApp 926',
        last_bot_activity_at: new Date().toISOString(),
      }).select('id, reference').single();

      await onbClear();

      if (cErr || !created) {
        console.error('ONB insert error', cErr);
        await reply(`Erreur technique. Un agent va vous recontacter.`, 'onb_error');
        await notifyAdmin(`ECHEC onboarding GP ${fromPhone} :\n${cErr?.message ?? 'unknown'}\nDonnees : ${JSON.stringify(data).slice(0, 300)}`);
        return new Response('ok', { headers: corsHeaders });
      }

      const tarifsLines = Object.entries(rates).map(([v, p]) => `• ${v}: ${p} FCFA/kg`).join('\n') || '(aucun — tarifs par defaut)';
      await reply(
        `Felicitations ! 🎉\nVotre profil est cree.\n\nReference : GP${created.reference}\n\nVos tarifs :\n${tarifsLines}\n\nVous recevrez bientot des missions correspondant a vos navettes.\n\nTapez AIDE pour voir vos commandes.`,
        'onb_done',
      );
      await notifyAdmin(
        `✅ Nouveau GP inscrit via le bot :\nGP${created.reference} — ${data.prenom} ${data.nom}\nTel : ${fromPhone}\nNavette : Dakar → ${villes.join(', ')}\nTarifs : ${Object.keys(rates).length}/${villes.length} renseignes`,
      );
      return new Response('ok', { headers: corsHeaders });
    }

    // Sécurité : intent inconnu → reset
    await onbClear();
    await reply(`Tapez START pour commencer votre inscription.`, 'onb_reset');
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

  // Session vieille de plus de 2h → expirée (annulation propre)
  const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
  const sessionAgeMs = session ? Date.now() - new Date(session.updated_at).getTime() : 0;
  const sessionExpired = !!(session && session.pending_intent && sessionAgeMs >= SESSION_TTL_MS);
  const sessionActive = !!(session && session.pending_intent && sessionAgeMs < SESSION_TTL_MS);

  async function clearSession() {
    if (session?.id) {
      await supa.from('gp_bot_sessions').delete().eq('id', session.id);
    }
  }

  // Notify expired session before continuing (only if the user looks like he's
  // trying to continue a flow, not starting fresh with AIDE/MENU/greeting)
  if (sessionExpired) {
    await clearSession();
    const looksFresh = msg === '' || /^(aide|help|menu|start|bonjour|hello|salam|salut|hi|hey|\?|0)\b/i.test(rawMsg);
    if (!looksFresh) {
      await reply(`Session expiree. Tapez AIDE pour recommencer.`, 'session_expired');
      return new Response('ok', { headers: corsHeaders });
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
    const prefix = isStart && !isAide ? `Bonjour ${prenom} !` : undefined;
    await sendMainMenu(prefix, isStart && !isAide ? 'start' : 'help');
    return new Response('ok', { headers: corsHeaders });
  }

  // ---------- MES DEPARTS ----------
  async function runMesDeparts() {
    await clearSession();
    const { data } = await supa
      .from('manual_departures')
      .select('short_ref, destination, departure_date, total_capacity_kg, available_capacity_kg')
      .eq('transporteur_ref', transporteur.reference)
      .gte('departure_date', new Date().toISOString().slice(0, 10))
      .order('departure_date', { ascending: true })
      .limit(20);
    if (!data || data.length === 0) {
      await reply(`Aucun depart programme.\nTapez DEP [ville_depart] [ville_arrivee] [date] [kg] pour en creer un.\nEx : DEP Dakar Paris 15/06 30kg`, 'mes_departs');
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
  if (isMesDeparts) return await runMesDeparts();

  // ---------- MES MISSIONS ----------
  async function runMesMissions() {
    await clearSession();
    const { data } = await supa
      .from('dossiers')
      .select('tracking_id, buyer_name, contact_phone, estimated_weight, actual_weight_kg, status')
      .eq('assigned_transporteur_ref', transporteur.reference)
      .not('status', 'in', '(DELIVERED,ARCHIVED,CANCELLED)')
      .order('updated_at', { ascending: false })
      .limit(10);
    if (!data || data.length === 0) {
      await reply(`Aucune mission active.`, 'mes_missions');
    } else {
      const lines = data.map((d) => {
        const w = d.actual_weight_kg ?? d.estimated_weight ?? '?';
        return `${d.tracking_id ?? '—'} - ${d.buyer_name ?? '?'} - ${w}kg - ${d.status}`;
      }).join('\n');
      const textFallback = `📦 Vos missions actives :\n${lines}\n\nTapez le tracking pour agir (ex: COLLECTE YOB-XXXXXX).`;

      // Liste interactive : a collecter vs en transit
      const toCollect = data.filter((d: any) => ['ASSIGNED', 'COLLECTING'].includes(d.status));
      const inTransit = data.filter((d: any) => !['ASSIGNED', 'COLLECTING'].includes(d.status));
      const buildRow = (d: any) => {
        const w = d.actual_weight_kg ?? d.estimated_weight ?? '?';
        return {
          id: `mission:${d.tracking_id}`,
          title: `${d.tracking_id ?? '—'} · ${w}kg`.slice(0, 24),
          description: `${d.buyer_name ?? '?'} · ${d.status}`.slice(0, 72),
        };
      };
      const sections = [
        toCollect.length ? { title: 'A collecter', rows: toCollect.map(buildRow) } : null,
        inTransit.length ? { title: 'En transit', rows: inTransit.map(buildRow) } : null,
      ].filter(Boolean) as Array<{ title: string; rows: any[] }>;

      // Envoi interactif (fallback texte automatique si hors 24h)
      await sendWa({
        recipient_phone: fromPhone,
        recipient_type: 'gp',
        interactive_type: 'list',
        interactive_body: 'Vos missions actives — choisissez pour voir les actions :',
        list_button_label: 'Voir missions',
        sections,
        fallback_text: textFallback,
        transporteur_id: transporteur?.id,
        trigger_type: 'gp_mes_missions_list',
      });
    }
    return new Response('ok', { headers: corsHeaders });
  }
  if (isMesMissions) return await runMesMissions();

  // Sélection d'une mission via liste interactive : "mission:YOB-XXXXXX"
  const missionMatch = rawMsg.match(/^mission:([A-Z0-9-]+)$/i);
  if (missionMatch) {
    const trk = missionMatch[1].toUpperCase();
    await sendWa({
      recipient_phone: fromPhone,
      recipient_type: 'gp',
      interactive_type: 'button',
      interactive_body: `Action pour ${trk} :`,
      buttons: [
        { id: `COLLECTE ${trk}`, label: 'Collecte OK' },
        { id: `POIDS ${trk}`, label: 'Enregistrer poids' },
        { id: `LIVRE ${trk}`, label: 'Confirmer livraison' },
      ],
      fallback_text: `Pour ${trk} tapez :\nCOLLECTE ${trk}\nPOIDS ${trk} 3.5\nLIVRE ${trk}`,
      transporteur_id: transporteur?.id,
      trigger_type: 'gp_mission_actions',
    });
    return new Response('ok', { headers: corsHeaders });
  }

  // =================================================================
  //  TARIFS — consultation & modification
  // =================================================================
  const DEFAULT_ZONE_RATES: Record<string, number> = {
    europe: 6000, amerique_nord: 8000, amerique_canada: 7500,
    asie: 9000, afrique: 3500, moyen_orient: 7000,
  };

  function stripDiacritics(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  async function runTarifs() {
    await clearSession();
    const rates = (transporteur.rates_per_city ?? {}) as Record<string, number>;
    const keys = Object.keys(rates);
    if (keys.length === 0) {
      await reply(
        `Aucun tarif renseigne.\n\nPour ajouter un tarif :\nTARIF [ville] [prix_par_kg]\nEx: TARIF Paris 6500`,
        'tarifs_empty',
      );
    } else {
      const lines = keys
        .sort()
        .map((k) => `${k} : ${Number(rates[k]).toLocaleString('fr-FR')} FCFA/kg`)
        .join('\n');
      await reply(
        `Vos tarifs actuels :\n${lines}\n\nPour modifier :\nTARIF [ville] [nouveau_prix]\nEx: TARIF Paris 7000`,
        'tarifs_list',
      );
    }
    return new Response('ok', { headers: corsHeaders });
  }
  if (/^tarifs?$/i.test(msg)) return await runTarifs();

  // TARIF Paris 6500
  const mTarif = rawMsg.match(/^tarif\s+([a-zA-ZÀ-ÿ' \-]+?)\s+(\d{3,6})\s*$/i);
  if (mTarif) {
    await clearSession();
    const ville = mTarif[1].trim().replace(/\b\w/g, (c) => c.toUpperCase());
    const prix = parseInt(mTarif[2], 10);
    if (prix < 1000 || prix > 50000) {
      await reply(`Prix invalide. Donnez un montant entre 1000 et 50000 FCFA/kg.`, 'tarif_invalid');
      return new Response('ok', { headers: corsHeaders });
    }
    const current = (transporteur.rates_per_city ?? {}) as Record<string, number>;
    const updated = { ...current, [ville]: prix };
    const { error } = await supa
      .from('transporteurs')
      .update({ rates_per_city: updated, rates_collected_at: new Date().toISOString() })
      .eq('id', transporteur.id);
    if (error) {
      await reply(`Erreur technique. Reessayez plus tard.`, 'tarif_error');
    } else {
      await reply(
        `Tarif ${ville} mis a jour :\n${prix.toLocaleString('fr-FR')} FCFA/kg`,
        'tarif_ok',
      );
      // Notify super admin
      try {
        const adminPhone = '+221784604003';
        await supa.functions.invoke('send-whatsapp', {
          body: {
            phone_id: GP_BOT_PHONE_ID || undefined,
            recipient_phone: adminPhone,
            recipient_type: 'admin',
            message: `Tarif GP mis a jour\n${transporteur.prenom ?? ''} ${transporteur.nom ?? ''} (${transporteur.reference})\n${ville} : ${prix.toLocaleString('fr-FR')} FCFA/kg`,
            transporteur_id: transporteur.id,
            trigger_type: 'gp_rate_updated',
          },
        });

      } catch { /* best effort */ }
    }
    return new Response('ok', { headers: corsHeaders });
  }

  // =================================================================
  //  FEEDBACK post-livraison : reponse 1/2/3 a la session 'feedback'
  // =================================================================
  if (sessionActive && session!.pending_intent === 'feedback') {
    const data = (session!.pending_data ?? {}) as Record<string, any>;
    const choice = msg.trim();
    if (!/^[123]$/.test(choice)) {
      await reply(`Repondez 1, 2 ou 3 :\n1 → Parfait\n2 → Probleme mineur\n3 → Probleme serieux`, 'feedback_retry');
      return new Response('ok', { headers: corsHeaders });
    }
    const rating = parseInt(choice, 10);
    if (data.dossier_id) {
      await supa.from('dossiers').update({
        feedback_rating: rating,
        feedback_at: new Date().toISOString(),
      }).eq('id', data.dossier_id);
    }
    await clearSession();
    if (rating === 3) {
      await sendWa({
        recipient_phone: '+221784604003',
        recipient_type: 'admin',
        message: `⚠️ Probleme serieux signale par ${prenom} (GP${transporteur.reference})\nColis : ${data.tracking_id ?? '—'}\nMerci de prendre contact.`,
        trigger_type: 'gp_feedback_serious',
        dossier_id: data.dossier_id,
      });
      await reply(`Merci. Notre equipe vous contacte rapidement.`, 'feedback_serious');
    } else if (rating === 2) {
      await reply(`Merci pour votre retour. Nous prenons note.`, 'feedback_minor');
    } else {
      await reply(`🎉 Merci ! Au plaisir pour la prochaine mission.`, 'feedback_great');
    }
    return new Response('ok', { headers: corsHeaders });
  }

  // =================================================================
  //  Menu numerote : 1..6 (ou "un", "deux", ...)
  // =================================================================

  const MENU_MAP: Record<string, string> = {

    '1': '1', 'un': '1', 'une': '1',
    '2': '2', 'deux': '2',
    '3': '3', 'trois': '3',
    '4': '4', 'quatre': '4',
    '5': '5', 'cinq': '5',
    '6': '6', 'six': '6',
  };
  if (!sessionActive && MENU_MAP[msg]) {
    const choice = MENU_MAP[msg];
    await clearSession();
    if (choice === '1') {
      const primaryCity = getPrimaryCity(transporteur);
      if (primaryCity) {
        await saveSession('dep', { default_city: primaryCity });
        await reply(
          `Prochain depart pour ${primaryCity} ?\nRepondez : [date] [kg]\nEx : 15/07 25kg\n(ou tapez une autre ville si different)`,
          'menu_dep_smart',
        );
      } else {
        await saveSession('dep', {});
        await reply(`Pour quelle ville partez-vous ?`, 'menu_dep');
      }
      return new Response('ok', { headers: corsHeaders });
    }

    if (choice === '2') {
      await saveSession('collecte', {});
      await reply(`Quel est le numero de suivi du colis ?\n(Exemple : YOB-K7M9P2)`, 'menu_collecte');
      return new Response('ok', { headers: corsHeaders });
    }
    if (choice === '3') {
      await saveSession('poids', {});
      await reply(`Quel est le numero de suivi du colis ?\n(Exemple : YOB-K7M9P2)`, 'menu_poids');
      return new Response('ok', { headers: corsHeaders });
    }
    if (choice === '4') {
      await saveSession('livre', {});
      await reply(`Quel est le numero de suivi du colis livre ?\n(Exemple : YOB-K7M9P2)`, 'menu_livre');
      return new Response('ok', { headers: corsHeaders });
    }
    if (choice === '5') {
      return await runMesMissions();
    }
    if (choice === '6') {
      return await runMesDeparts();
    }
  }

  // =================================================================
  //  PROFIL : affiche la fiche complete du transporteur
  // =================================================================
  if (/^(profil|profile|mon\s+profil|ma\s+fiche)$/i.test(msg)) {
    await clearSession();
    const navettes = Array.isArray(transporteur.navettes) ? transporteur.navettes : [];
    const villesSet = new Set<string>();
    navettes.forEach((n: any) => (n.villes ?? []).forEach((v: any) => v.ville && villesSet.add(v.ville)));
    const villes = Array.from(villesSet).filter(v => v.toLowerCase() !== 'dakar');
    const lines = [
      `📇 Votre profil Konnekt`,
      ``,
      `Ref : GP${transporteur.reference}`,
      `Nom : ${transporteur.prenom ?? ''} ${transporteur.nom ?? ''}`.trim(),
      `Tel : ${transporteur.telephone_1 ?? '—'}`,
      `Adresse Dakar : ${transporteur.adresse_collecte_dakar ?? transporteur.adresse_1 ?? '—'}`,
      `Zone : ${transporteur.zone ?? '—'}`,
      `Navettes : ${villes.length ? villes.join(', ') : '—'}`,
      ``,
      transporteur.profile_complete ? `✅ Profil complet` : `⚠️ Profil incomplet`,
      ``,
      `Pour modifier :`,
      `• MODIFIER TEL`,
      `• MODIFIER ADRESSE`,
      `• MODIFIER NAVETTE`,
      `• MODIFIER (tout)`,
    ];
    await reply(lines.join('\n'), 'profil');
    return new Response('ok', { headers: corsHeaders });
  }

  // =================================================================
  //  PAUSE / REPRENDRE : suspendre ou reactiver les notifications
  // =================================================================
  if (/^pause\b/i.test(msg)) {
    if (!transporteur) {
      await reply(`Numero inconnu. Ecrivez-nous au +221 78 926 97 56`, 'pause_unknown');
      return new Response('ok', { headers: corsHeaders });
    }
    const m = msg.match(/pause\s+(\d{1,3})/i);
    const days = m ? Math.min(180, Math.max(1, parseInt(m[1], 10))) : 30;
    const until = new Date(Date.now() + days * 24 * 3600 * 1000);
    await supa.from('transporteurs')
      .update({ bot_paused_until: until.toISOString() })
      .eq('id', transporteur.id);
    await clearSession();
    await reply(
      `OK, vos notifications sont suspendues pendant ${days} jour${days > 1 ? 's' : ''}.\n` +
      `Reprise prevue le ${until.toLocaleDateString('fr-FR')}.\n\n` +
      `Tapez REPRENDRE a tout moment pour reactiver.`,
      'pause_set',
    );
    return new Response('ok', { headers: corsHeaders });
  }
  if (/^(reprendre|reprise|resume|reactiver|on)$/i.test(msg)) {
    if (!transporteur) {
      await reply(`Numero inconnu. Ecrivez-nous au +221 78 926 97 56`, 'resume_unknown');
      return new Response('ok', { headers: corsHeaders });
    }
    await supa.from('transporteurs')
      .update({ bot_paused_until: null })
      .eq('id', transporteur.id);
    await clearSession();
    await reply(`Bon retour ! Vos notifications sont reactivees.`, 'pause_cleared');
    return new Response('ok', { headers: corsHeaders });
  }

  // =================================================================
  //  MODIFIER [TEL|ADRESSE|NAVETTE] : génère un lien public
  // =================================================================
  if (/^modifier\b/.test(msg) && !/^\s*modifier\s+#?[a-z0-9]+\s+\d+(?:[.,]\d+)?\s*kg\s*$/i.test(rawMsg)) {
    if (!transporteur) {
      await reply(`Numero inconnu. Ecrivez-nous au +221 78 926 97 56`, 'modifier_unknown');
      return new Response('ok', { headers: corsHeaders });
    }
    // Sous-commandes
    let fields: string[] = ['telephone_1', 'adresse_collecte_dakar', 'adresses_remise', 'navettes'];
    let scope = 'tout';
    if (/\btel\b|telephone|phone/.test(msg))         { fields = ['telephone_1']; scope = 'le telephone'; }
    else if (/\badresse\b|addr/.test(msg))           { fields = ['adresse_collecte_dakar', 'adresse_dakar_2']; scope = "l'adresse Dakar"; }
    else if (/\bnavette\b|trajet|ville/.test(msg))   { fields = ['navettes', 'adresses_remise']; scope = 'vos navettes'; }

    const { data: tok, error } = await supa
      .from('edit_tokens')
      .insert({
        entity_type: 'transporteur',
        entity_id: transporteur.id,
        fields_allowed: fields,
      })
      .select('token')
      .single();
    if (error || !tok) {
      await reply(`Erreur technique. Reessayez plus tard.`, 'modifier_error');
      return new Response('ok', { headers: corsHeaders });
    }
    const link = `https://yobbante.com/modifier/${tok.token}`;
    await reply(
      `Pour modifier ${scope}, ouvrez ce lien (valide 24h) :\n${link}\n\nSi vous avez des questions, tapez AIDE.`,
      'modifier_link',
    );
    return new Response('ok', { headers: corsHeaders });
  }

  // =================================================================
  //  Détection intent DEP / COLLECTE / POIDS / LIVRE (tolérant)
  // =================================================================



  // Liste de villes connues pour detecter une intention DEP même sans le mot-clé
  const KNOWN_DEP_CITIES = ['paris','marseille','lyon','toulouse','nice','nantes','bordeaux','lille','rennes','montpellier','strasbourg','new york','newark','brooklyn','manhattan','washington','atlanta','boston','miami','chicago','houston','los angeles','bruxelles','liege','geneve','lausanne','zurich','montreal','toronto','london','londres','madrid','barcelona','barcelone','roma','rome','milano','milan','berlin','frankfurt','francfort','casablanca','rabat','abidjan','bamako','cotonou','lome','conakry','nouakchott','libreville','douala','yaounde','dubai','dubaï','istanbul','beijing','pekin','shanghai','guangzhou','canton'];
  const mentionsKnownCity = KNOWN_DEP_CITIES.some((c) => msg.includes(c));

  const hasDepKeyword = /\b(dep|depart|departure|trajet)\b/.test(msg)
    || (/\bje\s+pars\b/.test(msg) && mentionsKnownCity)
    || (/\bje\s+vais\s+a\b/.test(msg) && mentionsKnownCity);
  const hasCollectKeyword = /\b(collect|pris|recup|recupere|prise)\b/.test(msg) || /\bok\s+collect/.test(msg);
  const hasPoidsKeyword = /\b(poids|pese|weight|fait\s+\d|pesant)\b/.test(msg);
  const hasLivreKeyword = /\b(livr|delivered|remis|livraison)\b/.test(msg);
  const hasDeposeKeyword = /\b(depose|depot|deposer|relais)\b/.test(msg);
  const hasEnRouteKeyword = !hasDepKeyword && (/\b(en\s*route|enroute|departe|on\s+part)\b/.test(msg));

  // =================================================================
  //  NOUVELLES COMMANDES — STATUT / PAIEMENT / ANNULER / MODIFIER /
  //  PROBLEME / PHOTO (image avec caption)
  // =================================================================
  const SUPER_ADMIN_NOTIFY = '+221784604003';
  const isValidated = transporteur?.is_beta_validated !== false;

  async function gateValidated(): Promise<Response | null> {
    if (isValidated) return null;
    await reply(`⚠️ Compte en attente de verification. Notre equipe vous contacte sous 24h.`, 'not_validated');
    return new Response('ok', { headers: corsHeaders });
  }

  // ---------- PHOTO : image entrante avec caption "PHOTO YOB-XXXXX" ----------
  if ((input.message_type === 'image' || input.message_type === 'document') && input.media_url) {
    const tracking = parseTracking(rawMsg);
    if (tracking) {
      const { data: dossier } = await supa
        .from('dossiers')
        .select('id, tracking_id, collecte_photos, gp_id')
        .eq('tracking_id', tracking)
        .maybeSingle();
      if (!dossier) {
        await reply(`❌ Colis ${tracking} introuvable.`, 'photo_not_found');
        return new Response('ok', { headers: corsHeaders });
      }
      const photos = Array.isArray(dossier.collecte_photos) ? [...dossier.collecte_photos] : [];
      photos.push(input.media_url);
      await supa.from('dossiers').update({ collecte_photos: photos }).eq('id', dossier.id);
      await reply(`✅ Photo enregistree pour 📦 ${tracking}.`, 'photo_saved');
      await notifyAdmin(`📸 Nouvelle photo de ${prenom} (Ref ${transporteur.reference}) sur ${tracking}`);
      return new Response('ok', { headers: corsHeaders });
    }
  }

  // ---------- IMAGE flyer GP : extraction IA Claude ----------
  if (input.message_type === 'image' && input.media_url) {
    try {
      const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
      const waToken = Deno.env.get('WHATSAPP_TOKEN');
      if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY missing');

      // Télécharger l'image (avec auth WhatsApp si nécessaire)
      const imgRes = await fetch(input.media_url, {
        headers: waToken ? { Authorization: `Bearer ${waToken}` } : {},
      });
      if (!imgRes.ok) throw new Error(`image fetch ${imgRes.status}`);
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      const buf = new Uint8Array(await imgRes.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      const b64 = btoa(bin);

      const demain = new Date(Date.now() + 86400 * 1000);
      const ddmmyyyy = (d: Date) =>
        `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      const dateDemain = ddmmyyyy(demain);

      const systemPrompt = `Tu analyses des flyers de GP (transporteurs voyageurs) qui transportent des colis entre des villes internationales.

Règles d'extraction :
- ville_depart : ville de départ explicite sur le flyer. Ne pas supposer Dakar par défaut.
- ville_arrivee : destination principale du trajet. Si plusieurs villes (ex: Marseille + Avignon), prendre la première. Mettre les autres dans destinations_secondaires.
- FILTRE OBLIGATOIRE : si ni ville_depart ni ville_arrivee n'est Dakar ou une ville d'Afrique de l'Ouest → répondre {hors_zone: true}. Ce service opère depuis/vers l'Afrique de l'Ouest.
- date_depart : convertir en DD/MM/YYYY. Si 'demain' → ${dateDemain}. Si 'mercredi 10 juin' → 10/06/2026. Si '10/06/26' → 10/06/2026.
- Ne jamais extraire le prix/tarif du flyer.
- multi_trajets : true si flyer contient aller + retour.
- date_retour : ville et date du retour si présents.

Réponds UNIQUEMENT en JSON valide :
{
  "hors_zone": boolean,
  "ville_depart": string,
  "ville_arrivee": string,
  "destinations_secondaires": string[] | null,
  "date_depart": "DD/MM/YYYY" | null,
  "date_depot_limite": "DD/MM/YYYY" | null,
  "multi_trajets": boolean,
  "ville_retour": string | null,
  "date_retour": "DD/MM/YYYY" | null,
  "telephone_gp": string | null,
  "confiance": "haute" | "moyenne" | "basse"
}
Si ville_arrivee ET date_depart absents → {"confiance": "basse"}`;

      const anthRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: contentType, data: b64 } },
              { type: 'text', text: 'Analyse ce flyer GP et réponds uniquement en JSON.' },
            ],
          }],
        }),
      });

      if (!anthRes.ok) throw new Error(`anthropic ${anthRes.status}: ${await anthRes.text()}`);
      const anthJson = await anthRes.json();
      const rawText: string = anthJson?.content?.[0]?.text ?? '';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('no json');
      const parsed = JSON.parse(jsonMatch[0]);

      // CAS A — hors zone
      if (parsed.hors_zone === true) {
        await reply(
          `Ce trajet ne correspond pas a nos corridors actuels (Afrique de l'Ouest <-> monde).\n\nPour declarer un depart valide :\nDEP [ville_depart] [ville_arrivee] [date] [kg]\nEx : DEP Dakar Paris 15/06 30kg`,
          'image_ia_hors_zone',
        );
        return new Response('ok', { headers: corsHeaders });
      }

      // CAS B — confiance basse / champs manquants
      if (
        parsed.confiance === 'basse' ||
        !parsed.ville_arrivee ||
        !parsed.date_depart
      ) {
        await reply(
          `Je n'ai pas pu lire les infos de depart 🙏\n\nTapez : DEP [ville_depart] [ville_arrivee] [date] [kg]\nEx : DEP Dakar Paris 15/06 30kg`,
          'image_ia_low_confidence',
        );
        return new Response('ok', { headers: corsHeaders });
      }

      // CAS C — proposer création
      const dest2 = Array.isArray(parsed.destinations_secondaires)
        ? parsed.destinations_secondaires.filter(Boolean) as string[]
        : [];
      const lines: string[] = [
        `J'ai lu votre annonce 👀`,
        ``,
        `🛫 ${parsed.ville_depart} → ${parsed.ville_arrivee}`,
      ];
      if (dest2.length) lines.push(`Via : ${dest2.join(', ')}`);
      lines.push(`📅 Depart : ${parsed.date_depart}`);
      if (parsed.date_depot_limite) lines.push(`📦 Depot limite : ${parsed.date_depot_limite}`);
      if (parsed.multi_trajets && parsed.ville_retour && parsed.date_retour) {
        lines.push(`🔄 Retour : ${parsed.ville_retour} ${parsed.date_retour}`);
      }
      lines.push(``, `Je cree ce depart sur Konnekt ?`, `Repondez OUI pour confirmer.`);

      await saveSession('image_dep_confirm', {
        ville_depart: parsed.ville_depart,
        ville_arrivee: parsed.ville_arrivee,
        destinations_secondaires: dest2,
        date_depart: parsed.date_depart,
        date_depot_limite: parsed.date_depot_limite ?? null,
        multi_trajets: !!parsed.multi_trajets,
        ville_retour: parsed.ville_retour ?? null,
        date_retour: parsed.date_retour ?? null,
        confiance: parsed.confiance,
      });

      await reply(lines.join('\n'), 'image_ia_propose');
      return new Response('ok', { headers: corsHeaders });
    } catch (e) {
      console.error('IMAGE_IA error', (e as Error).message);
      // Fallback vers le message média générique
    }
  }


  // ---------- MEDIA générique (image sans tracking, audio, vidéo, document) ----------
  {
    const mediaTypes = new Set(['image', 'audio', 'voice', 'document', 'video', 'sticker']);
    if (input.message_type && mediaTypes.has(input.message_type)) {
      await reply(
        `Merci pour votre envoi 📎\nNotre equipe l'a bien recu et reviendra vers vous.\n\nPour declarer un depart tapez DEP [ville_depart] [ville_arrivee] [date] [kg]\nEx : DEP Dakar Paris 15/06 30kg\nou envoyez AIDE pour le menu complet.`,
        'media_received',
      );
      const ref = transporteur?.reference ?? '—';
      const senderName = (transporteur?.prenom || transporteur?.nom || prenom || 'GP').toString();
      await sendWa({
        recipient_phone: Deno.env.get('ADMIN_WHATSAPP_NUMBER') || '+221784604003',
        recipient_type: 'admin',
        message: `📎 Media recu de ${senderName} (Ref ${ref}) : ${input.message_type}\nA traiter manuellement.`,
        trigger_type: 'admin_media_received',
      });
      return new Response('ok', { headers: corsHeaders });
    }
  }

  // ---------- STATUT [YOB-XXXXX] ----------
  {
    const m = msg.match(/^statut\s+(.+)$/i) || msg.match(/^status\s+(.+)$/i);
    if (m) {
      const tracking = parseTracking(m[1]);
      if (!tracking) {
        await reply(`❌ Format invalide. Ex : STATUT YOB-K7M9P2`, 'statut_bad');
        return new Response('ok', { headers: corsHeaders });
      }
      const { data: d } = await supa
        .from('dossiers')
        .select('tracking_id, status, updated_at, destination_city, destination_country')
        .eq('tracking_id', tracking)
        .maybeSingle();
      if (!d) {
        await reply(`❌ Colis ${tracking} introuvable.`, 'statut_not_found');
        return new Response('ok', { headers: corsHeaders });
      }
      const upd = d.updated_at ? formatDateFr(d.updated_at) : '—';
      await reply(
        `📦 ${d.tracking_id}\nStatut : ${d.status ?? '—'}\nDestination : ${d.destination_city ?? d.destination_country ?? '—'}\nMaj : ${upd}`,
        'statut',
      );
      return new Response('ok', { headers: corsHeaders });
    }
  }

  // ---------- PAIEMENT ----------
  if (/^(paiement|paiements|paie|payment|payments)$/i.test(msg)) {
    const { data: rows } = await supa
      .from('dossiers')
      .select('tracking_id, gp_amount, gp_paid, gp_paid_at')
      .eq('gp_id', transporteur.id)
      .not('gp_amount', 'is', null)
      .order('gp_paid_at', { ascending: false, nullsFirst: false })
      .limit(20);
    const list = rows ?? [];
    if (list.length === 0) {
      await reply(`💰 Aucun paiement enregistre.`, 'paiement_empty');
      return new Response('ok', { headers: corsHeaders });
    }
    const fmtAmt = (n: any) => n != null ? `${Number(n).toLocaleString('fr-FR')} FCFA` : '—';
    const paid = list.filter((r: any) => r.gp_paid);
    const pend = list.filter((r: any) => !r.gp_paid);
    const lines: string[] = [`💰 Paiements`];
    if (pend.length) {
      lines.push(`\nEn attente :`);
      pend.slice(0, 5).forEach((r: any) => lines.push(`• ${r.tracking_id} · ${fmtAmt(r.gp_amount)}`));
    }
    if (paid.length) {
      lines.push(`\nRecus :`);
      paid.slice(0, 5).forEach((r: any) => lines.push(`✅ ${r.tracking_id} · ${fmtAmt(r.gp_amount)} · ${formatDateFr(r.gp_paid_at)}`));
    }
    await reply(lines.join('\n'), 'paiement');
    return new Response('ok', { headers: corsHeaders });
  }

  // ---------- PROBLEME [YOB-XXXXX] [description] ----------
  {
    const m = rawMsg.match(/^\s*(?:probleme|problème|issue|litige)\s+(YOB[-\s]?[A-Za-z0-9]+)\s+(.{3,500})$/i);
    if (m) {
      const tracking = parseTracking(m[1]);
      const desc = m[2].trim();
      if (!tracking) {
        await reply(`❌ Format invalide. Ex : PROBLEME YOB-K7M9P2 colis abime`, 'probleme_bad');
        return new Response('ok', { headers: corsHeaders });
      }
      const { data: d } = await supa
        .from('dossiers')
        .select('id, tracking_id, admin_notes')
        .eq('tracking_id', tracking)
        .maybeSingle();
      if (!d) {
        await reply(`❌ Colis ${tracking} introuvable.`, 'probleme_not_found');
        return new Response('ok', { headers: corsHeaders });
      }
      const tag = `[LITIGE ${new Date().toISOString()}] GP${transporteur.reference}: ${desc}`;
      const newNotes = d.admin_notes ? `${d.admin_notes}\n${tag}` : tag;
      await supa.from('dossiers').update({ admin_notes: newNotes }).eq('id', d.id);
      await sendWa({
        recipient_phone: SUPER_ADMIN_NOTIFY,
        recipient_type: 'admin',
        message: `⚠️ LITIGE signale\n${prenom} (GP${transporteur.reference}) sur 📦 ${tracking}\n"${desc.slice(0, 200)}"`,
        trigger_type: 'gp_probleme_signale',
        dossier_id: d.id,
      });
      await reply(`✅ Probleme signale sur 📦 ${tracking}.\nNotre equipe revient vers vous rapidement.`, 'probleme_ok');
      return new Response('ok', { headers: corsHeaders });
    }
  }

  // ---------- ANNULER [#ref-depart] ----------
  {
    const m = msg.match(/^annuler\s+#?([a-z0-9]+)$/i) || msg.match(/^cancel\s+#?([a-z0-9]+)$/i);
    if (m && m[1] !== 'depart' && m[1] !== 'mission') {
      const gate = await gateValidated(); if (gate) return gate;
      const ref = m[1].replace(/^#/, '');
      const { data: dep } = await supa
        .from('manual_departures')
        .select('id, short_ref, destination, departure_date, status, transporteur_ref')
        .ilike('short_ref', ref)
        .maybeSingle();
      if (!dep || String(dep.transporteur_ref) !== String(transporteur.reference)) {
        await reply(`❌ Depart #${ref} introuvable ou pas a vous.`, 'annuler_not_found');
        return new Response('ok', { headers: corsHeaders });
      }
      if (dep.status === 'cancelled') {
        await reply(`Depart #${dep.short_ref} deja annule.`, 'annuler_already');
        return new Response('ok', { headers: corsHeaders });
      }
      await saveSession('annuler_dep', { dep_id: dep.id, short_ref: dep.short_ref });
      await reply(
        `✈️ Annuler ce depart ?\n#${dep.short_ref} · ${dep.destination} · ${formatDateFr(dep.departure_date)}\nRepondez OUI pour confirmer ou NON.`,
        'annuler_confirm',
      );
      return new Response('ok', { headers: corsHeaders });
    }
    if (sessionActive && session!.pending_intent === 'annuler_dep') {
      const data = (session!.pending_data ?? {}) as Record<string, any>;
      if (isNo(rawMsg)) {
        await clearSession();
        await reply(`Annulation abandonnee.`, 'annuler_abort');
        return new Response('ok', { headers: corsHeaders });
      }
      if (!isYes(rawMsg)) {
        await reply(`Repondez OUI pour confirmer l'annulation ou NON.`, 'annuler_retry');
        return new Response('ok', { headers: corsHeaders });
      }
      const { count: assigned } = await supa
        .from('dossiers')
        .select('id', { count: 'exact', head: true })
        .eq('gp_id', transporteur.id)
        .eq('assigned_transporteur_ref', String(transporteur.reference))
        .in('status', ['ASSIGNED', 'COLLECTING', 'COLLECTED', 'WEIGHED', 'DEPARTURE_CONFIRMED']);
      await supa.from('manual_departures').update({ status: 'cancelled' }).eq('id', data.dep_id);
      await clearSession();
      await reply(`✅ Depart #${data.short_ref} annule.`, 'annuler_ok');
      if ((assigned ?? 0) > 0) {
        await sendWa({
          recipient_phone: SUPER_ADMIN_NOTIFY, recipient_type: 'admin',
          message: `⚠️ GP${transporteur.reference} a annule depart #${data.short_ref} avec ${assigned} colis assigne(s).`,
          trigger_type: 'gp_depart_cancel_with_dossiers',
        });
      } else {
        await notifyAdmin(`Depart #${data.short_ref} annule par ${prenom} (GP${transporteur.reference}).`);
      }
      return new Response('ok', { headers: corsHeaders });
    }
  }

  // ---------- MODIFIER [#ref] [Xkg] ----------
  {
    const m = rawMsg.match(/^\s*modifier\s+#?([a-z0-9]+)\s+(\d+(?:[.,]\d+)?)\s*kg\s*$/i);
    if (m) {
      const gate = await gateValidated(); if (gate) return gate;
      const ref = m[1].replace(/^#/, '');
      const newCap = Math.max(1, Math.round(parseFloat(m[2].replace(',', '.'))));
      const { data: dep } = await supa
        .from('manual_departures')
        .select('id, short_ref, total_capacity_kg, available_capacity_kg, transporteur_ref')
        .ilike('short_ref', ref)
        .maybeSingle();
      if (!dep || String(dep.transporteur_ref) !== String(transporteur.reference)) {
        await reply(`❌ Depart #${ref} introuvable ou pas a vous.`, 'modifier_not_found');
        return new Response('ok', { headers: corsHeaders });
      }
      const used = (dep.total_capacity_kg ?? 0) - (dep.available_capacity_kg ?? 0);
      if (newCap < used) {
        await reply(
          `⚠️ Vous avez deja ${used}kg reserves sur ce depart.\nCapacite minimum : ${used}kg.`,
          'modifier_too_low',
        );
        return new Response('ok', { headers: corsHeaders });
      }
      const newAvail = newCap - used;
      await supa.from('manual_departures').update({
        total_capacity_kg: newCap, available_capacity_kg: newAvail,
      }).eq('id', dep.id);
      await reply(`✅ Depart #${dep.short_ref} mis a jour.\nCapacite : ${newCap}kg (restant ${newAvail}kg).`, 'modifier_ok');
      return new Response('ok', { headers: corsHeaders });
    }
  }

  // ---------- DEPOSE (point relais) ----------

  if (hasDeposeKeyword) {
    const tracking = parseTracking(rawMsg);
    if (!tracking) {
      await reply(`Indiquez le numero de suivi.
Exemple : DEPOSE YOB-K7M9P2`, 'depose_ask_tracking');
      return new Response('ok', { headers: corsHeaders });
    }
    const { data: dossier } = await supa
      .from('dossiers')
      .select('id, assigned_transporteur_ref, tracking_id, relay_point_name, relay_point_address, recipient_phone, contact_phone')
      .or(`tracking_id.eq.${tracking},reference.eq.${tracking}`)
      .maybeSingle();
    if (!dossier) {
      await reply(`Tracking ${tracking} non trouve.`, 'depose_notfound');
      return new Response('ok', { headers: corsHeaders });
    }
    if (dossier.assigned_transporteur_ref !== transporteur.reference) {
      await reply(`Ce dossier ne vous est pas assigne.`, 'depose_unauthorized');
      return new Response('ok', { headers: corsHeaders });
    }
    await supa.from('dossier_events').insert({
      dossier_id: dossier.id,
      event_type: 'relay_deposit',
      event_data: { relay_name: dossier.relay_point_name, relay_address: dossier.relay_point_address },
      visible_to_client: true,
    });
    await bumpGpActivity(dossier.id);
    const clientPhone = dossier.recipient_phone || dossier.contact_phone;
    if (clientPhone) {
      await notifyClientFromYobbante(clientPhone,
        `Votre colis ${dossier.tracking_id} a ete depose au point relais ${dossier.relay_point_name || ''}.
Recuperez-le sous 5 jours.`,
        dossier.id);
    }
    await notifyAdmin(`${prenom} (Ref ${transporteur.reference}) a depose ${dossier.tracking_id} au point relais.`);
    await reply(`Depot confirme pour ${dossier.tracking_id}. Le client est notifie.`, 'depose_ok');
    return new Response('ok', { headers: corsHeaders });
  }


  // ---------- EN ROUTE ----------
  if (hasEnRouteKeyword) {
    return await handleEnRoute(rawMsg, {});
  }
  if (sessionActive && session!.pending_intent === 'enroute') {
    return await handleEnRoute(rawMsg, (session!.pending_data ?? {}) as Record<string, any>);
  }

  // ---------- DEP : enregistrer un départ ----------
  if (hasDepKeyword || (!sessionActive && /\d{1,2}[\/.\-]\d{1,2}/.test(rawMsg) && /\d+\s*kg/i.test(rawMsg))) {
    const gate = await gateValidated(); if (gate) return gate;
    return await handleDep(rawMsg, {});
  }
  if (sessionActive && session!.pending_intent === 'dep') {
    return await handleDep(rawMsg, (session!.pending_data ?? {}) as Record<string, any>);
  }

  // ---------- IMAGE IA : confirmation OUI/NON pour créer le départ ----------
  if (sessionActive && session!.pending_intent === 'image_dep_confirm') {
    const data = (session!.pending_data ?? {}) as Record<string, any>;

    if (isNo(rawMsg) || (!isYes(rawMsg) && /^(non|stop|annul|cancel|pas)/i.test(msg))) {
      await clearSession();
      await reply(
        `Pas de probleme !\nDEP [ville_depart] [ville_arrivee] [date] [kg]`,
        'image_ia_declined',
      );
      return new Response('ok', { headers: corsHeaders });
    }
    if (!isYes(rawMsg)) {
      await reply(`Repondez OUI pour confirmer la creation du depart, ou NON pour annuler.`, 'image_ia_await');
      return new Response('ok', { headers: corsHeaders });
    }

    // OUI → créer manual_departures
    const parseDate = (s: string | null | undefined): string | null => {
      if (!s) return null;
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (!m) return null;
      const d = m[1].padStart(2, '0');
      const mo = m[2].padStart(2, '0');
      let y = m[3];
      if (y.length === 2) y = '20' + y;
      return `${y}-${mo}-${d}`;
    };

    const depDate = parseDate(data.date_depart);
    const limitDate = parseDate(data.date_depot_limite);
    if (!depDate) {
      await clearSession();
      await reply(`Date invalide, recommencez avec DEP.`, 'image_ia_bad_date');
      return new Response('ok', { headers: corsHeaders });
    }

    const dest2: string[] = Array.isArray(data.destinations_secondaires) ? data.destinations_secondaires : [];
    const notes = dest2.length ? dest2.join(' / ') : null;
    const baseRow = {
      transporteur_ref: transporteur.reference,
      origin_city: data.ville_depart,
      destination_city: data.ville_arrivee,
      transport_mode: 'air',
      departure_date: depDate,
      arrival_estimate: limitDate,
      total_capacity_kg: 20,
      available_capacity_kg: 20,
      status: 'active',
      source: 'image_ia',
      created_via: 'bot',
      notes,
    };

    const inserts: any[] = [baseRow];
    if (data.multi_trajets && data.ville_retour && data.date_retour) {
      const retDate = parseDate(data.date_retour);
      if (retDate) {
        inserts.push({
          ...baseRow,
          origin_city: data.ville_arrivee,
          destination_city: data.ville_retour,
          departure_date: retDate,
          arrival_estimate: null,
        });
      }
    }

    const { data: created, error } = await supa
      .from('manual_departures')
      .insert(inserts)
      .select('short_ref, origin_city, destination_city, departure_date');

    await clearSession();

    if (error || !created?.length) {
      console.error('IMAGE_IA insert error', error?.message);
      await reply(`Desole, impossible d'enregistrer ce depart : ${error?.message ?? 'erreur'}`, 'image_ia_insert_error');
      return new Response('ok', { headers: corsHeaders });
    }

    const first = created[0];
    const ref = first.short_ref || '—';
    await reply(
      `✅ Depart enregistre !\n${first.origin_city} → ${first.destination_city} 📅 ${data.date_depart}\nRef : #${ref}\nVos clients pourront reserver via Yobbante 🛫`,
      'image_ia_created',
    );

    await sendWa({
      recipient_phone: Deno.env.get('ADMIN_WHATSAPP_NUMBER') || '+221784604003',
      recipient_type: 'admin',
      message: `Depart cree via image IA :\n${prenom} (${transporteur.reference})\n${first.origin_city} → ${first.destination_city} ${data.date_depart}\nConfiance : ${data.confiance}`,
      trigger_type: 'admin_image_ia_created',
    });
    return new Response('ok', { headers: corsHeaders });
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

  // ---------- Confirmation d'adresse detectee (session) ----------
  if (sessionActive && session!.pending_intent === 'confirm_address') {
    const prior = (session!.pending_data ?? {}) as Record<string, any>;
    const addr = String(prior.address ?? '').trim();
    const kind = String(prior.kind ?? 'collecte') as 'collecte' | 'remise';
    const city = String(prior.city ?? '').trim();
    if (/^(oui|ok|yes|confirm|c'est ca|cest ca|exact|valide|valider)/i.test(msg)) {
      if (kind === 'collecte') {
        await supa.from('transporteurs').update({ adresse_collecte_dakar: addr }).eq('id', transporteur.id);
        await reply(`Adresse sauvegardee ✓\nVotre adresse de collecte Dakar : ${addr}`, 'address_saved_collecte');
        await notifyAdmin(`Adresse Dakar mise a jour pour ${prenom} (Ref ${transporteur.reference}) :\n${addr}`);
      } else {
        const current = (transporteur.adresses_remise ?? {}) as Record<string, string>;
        const next = { ...current, [city || 'Autre']: addr };
        await supa.from('transporteurs').update({ adresses_remise: next }).eq('id', transporteur.id);
        await reply(`Adresse sauvegardee ✓\nAdresse remise ${city || ''} : ${addr}`, 'address_saved_remise');
        await notifyAdmin(`Adresse remise ${city || ''} mise a jour pour ${prenom} (Ref ${transporteur.reference}) :\n${addr}`);
      }
      await clearSession();
    } else if (/^(non|no|annul|cancel)/i.test(msg)) {
      await clearSession();
      await reply(`OK, adresse non sauvegardee. Tapez AIDE pour les commandes.`, 'address_canceled');
    } else {
      await clearSession();
      // tomber dans le flux normal
    }
    if (msg && /^(oui|ok|yes|confirm|non|no|annul|cancel|c'est ca|cest ca|exact|valide|valider)/i.test(msg)) {
      return new Response('ok', { headers: corsHeaders });
    }
  }

  // ---------- Detection d'adresse (avant fallback) ----------
  const ADDR_KEYWORDS = /\b(villa|rue|avenue|av\.?|bd\.?|boulevard|cite|quartier|hlm|sacre\s*coeur|liberte|parcelles?|sicap|fann|mermoz|ouakam|yoff|almadies|plateau|medina|grand\s*dakar|point\s*e|grand\s*yoff|guediawaye|pikine|rufisque|thies|saly|mbour|n°|numero|appt|app|immeuble|residence|cite\s+\w+)\b/i;
  const FOREIGN_CITIES = ['paris', 'marseille', 'lyon', 'toulouse', 'nice', 'nantes', 'strasbourg', 'bordeaux', 'lille', 'rennes', 'montpellier', 'new york', 'newark', 'brooklyn', 'manhattan', 'bruxelles', 'liege', 'geneve', 'lausanne', 'zurich', 'montreal', 'toronto', 'london', 'londres', 'madrid', 'barcelona', 'roma', 'milano', 'berlin', 'frankfurt', 'casablanca', 'rabat', 'abidjan', 'bamako', 'cotonou', 'lome', 'conakry', 'nouakchott', 'libreville', 'douala', 'yaounde'];

  const hasAddrKeyword = ADDR_KEYWORDS.test(msg);
  const foreignCity = FOREIGN_CITIES.find((c) => msg.includes(c));

  if (hasAddrKeyword && rawMsg.length >= 8) {
    const addrCandidate = rawMsg.trim().slice(0, 200);
    if (foreignCity) {
      const city = foreignCity.replace(/\b\w/g, (c) => c.toUpperCase());
      await saveSession('confirm_address', { address: addrCandidate, kind: 'remise', city });
      await sendConfirmButtons(
        `J'ai note cette adresse :\n"${addrCandidate}"\nC'est votre adresse de remise a ${city} ?`,
        'address_detected_remise',
      );
    } else {
      await saveSession('confirm_address', { address: addrCandidate, kind: 'collecte', city: 'Dakar' });
      await sendConfirmButtons(
        `J'ai note cette adresse :\n"${addrCandidate}"\nC'est votre adresse de collecte a Dakar ?`,
        'address_detected_collecte',
      );
    }
    return new Response('ok', { headers: corsHeaders });
  }

  // ---------- Fallback : intent inconnu ----------
  await notifyAdmin(`Commande non comprise de ${prenom} (Ref ${transporteur.reference}) :
"${rawMsg.slice(0, 150)}"
A traiter manuellement.`);
  await sendMainMenu(FALLBACK_TEXT, 'unknown');
  return new Response('ok', { headers: corsHeaders });

  // =================================================================
  //  Handlers d'intent
  // =================================================================

  function isYes(t: string) { return /^(oui|ok|yes|valider?|valide|confirm(e|er)?|c'est ca|cest ca|exact)\b/i.test(t.trim()); }
  function isNo(t: string)  { return /^(non|no|annul(e|er)?|cancel|stop)\b/i.test(t.trim()); }


  async function handleDep(text: string, prior: Record<string, any>) {
    // Strip keyword
    const cleaned = text.replace(/\b(dep|depart|départ|departure|trajet)\b\s*/i, '').trim();

    // Extract weight first
    let weight = prior.weight as number | null | undefined;
    const wMatch = cleaned.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|k)\b/i);
    if (!weight && wMatch) weight = parseFloat(wMatch[1].replace(',', '.'));

    // Extract date
    let dateIso = prior.date as string | null | undefined;
    if (!dateIso) dateIso = parseDateLoose(cleaned);

    // Extract city/cities from what remains after stripping date + weight
    let origin = prior.origin as string | undefined;
    let destination = prior.destination as string | undefined;

    if (!origin || !destination) {
      let rest = cleaned
        .replace(/\d+(?:[.,]\d+)?\s*(?:kg|kilos?|k)\b/gi, ' ')
        .replace(/\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?/g, ' ')
        .replace(/\b\d{1,2}\s?[a-zA-Zéû]+\.?\s?\d{0,4}\b/g, (m) => /\d/.test(m) && /[a-z]/i.test(m) ? ' ' : m)
        .replace(/[,;]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Remove connectors: "de X a/vers/pour Y", "depuis X a Y", "X -> Y", "X > Y"
      rest = rest
        .replace(/^\s*(depuis|de|au\s+depart\s+de)\s+/i, '')
        .replace(/\s+(a|vers|pour|->|>|-)\s+/i, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const tokens = rest.split(/\s+/).filter((t) => t.length >= 2 && /[a-z]/i.test(t));

      // Single token = destination only (origin must be asked)
      if (tokens.length === 1) {
        if (!destination) destination = tokens[0];
      } else if (tokens.length >= 2) {
        // Heuristic: "Ville1 Ville2" → origin=Ville1, destination=Ville2
        // If a token is a multi-word city we lose it; keep simple split.
        if (!origin) origin = tokens[0];
        if (!destination) destination = tokens.slice(1).join(' ');
      }
    }

    const collected = { origin, destination, date: dateIso, weight };

    // Demande progressive : origine
    if (!origin) {
      await saveSession('dep', collected);
      await reply(`De quelle ville partez-vous ?`, 'dep_ask_origin');
      return new Response('ok', { headers: corsHeaders });
    }
    // Demande progressive : destination
    if (!destination) {
      await saveSession('dep', collected);
      await reply(`Vers quelle ville allez-vous ?`, 'dep_ask_destination');
      return new Response('ok', { headers: corsHeaders });
    }
    // Demande progressive : date
    if (!dateIso) {
      await saveSession('dep', collected);
      await reply(`Quelle est la date de depart ? (ex: 15/06)`, 'dep_ask_date');
      return new Response('ok', { headers: corsHeaders });
    }
    // Demande progressive : poids
    if (!weight) {
      await saveSession('dep', collected);
      await reply(`Quelle capacite disponible en kg ?`, 'dep_ask_weight');
      return new Response('ok', { headers: corsHeaders });
    }

    // Date passée → proposer +7j
    if (dateIso && !prior.date_confirmed) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const d = new Date(dateIso); d.setHours(0, 0, 0, 0);
      if (d.getTime() < today.getTime()) {
        const sugg = new Date(d.getTime()); sugg.setDate(sugg.getDate() + 7);
        const suggIso = sugg.toISOString().slice(0, 10);
        await saveSession('dep', { ...collected, suggested_date: suggIso, awaiting_date_fix: true });
        await reply(
          `⚠️ Cette date est passee.\nVoulez-vous dire le ${formatDateFr(suggIso)} ? Repondez OUI ou donnez une autre date.`,
          'dep_date_past',
        );
        return new Response('ok', { headers: corsHeaders });
      }
    }
    if (prior.awaiting_date_fix) {
      if (isYes(text) && prior.suggested_date) {
        dateIso = String(prior.suggested_date);
      }
    }

    // Skip OUI/NON si tous les params ont ete fournis d'un coup
    const oneShot = !prior.awaiting_confirm
      && !prior.awaiting_date_fix
      && !prior.origin && !prior.destination && !prior.date && !prior.weight;

    if (!oneShot && !prior.awaiting_confirm) {
      await saveSession('dep', { ...collected, awaiting_confirm: true, date_confirmed: true });
      const dStr = formatDateFr(dateIso);
      await reply(`Confirmer ce depart ?
Trajet : ${origin} → ${destination}
Date : ${dStr}
Capacite : ${Math.max(1, Math.round(weight))}kg

Repondez OUI pour valider ou NON pour annuler.`, 'dep_confirm');
      return new Response('ok', { headers: corsHeaders });
    }
    if (prior.awaiting_confirm && isNo(text)) {
      await clearSession();
      await reply(`Annule. Tapez AIDE pour recommencer.`, 'dep_cancel');
      return new Response('ok', { headers: corsHeaders });
    }
    if (prior.awaiting_confirm && !isYes(text)) {
      await reply(`Repondez OUI pour valider ce depart ou NON pour annuler.`, 'dep_confirm');
      return new Response('ok', { headers: corsHeaders });
    }

    // OUI → on cree
    const capacity = Math.max(1, Math.round(weight));
    const { data: dep, error } = await supa
      .from('manual_departures')
      .insert({
        transporteur_ref: transporteur.reference,
        origin_city: origin,
        destination_city: destination,
        transport_mode: 'air',
        departure_date: dateIso,
        total_capacity_kg: capacity,
        available_capacity_kg: capacity,
        status: 'active',
        created_via: 'bot',
        source: 'gp_self',
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
Ref #${dep?.short_ref} - ${origin} → ${destination} - ${dStr} - ${capacity}kg
Visible sur yobbante.com sous 1h.
Tapez AIDE pour toutes les commandes.`, 'dep_ok');

    await notifyAdmin(`Nouveau depart enregistre par ${prenom} (Ref ${transporteur.reference}) :
Ref #${dep?.short_ref} - ${origin} → ${destination} - ${dStr} - ${capacity}kg`);
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
      .select('id, assigned_transporteur_ref, status, tracking_id, contact_phone, buyer_name, estimated_weight')
      .or(`tracking_id.eq.${tracking},reference.eq.${tracking}`)
      .maybeSingle();

    if (!dossier) {
      await clearSession();
      await reply(`Numero ${tracking} non trouve. Verifiez et reessayez.`, 'collecte_notfound');
      return new Response('ok', { headers: corsHeaders });
    }
    if (dossier.assigned_transporteur_ref !== transporteur.reference) {
      await clearSession();
      await reply(`Ce dossier ne vous est pas assigne.`, 'collecte_unauthorized');
      return new Response('ok', { headers: corsHeaders });
    }

    // Confirmation OUI/NON
    if (!prior.awaiting_confirm) {
      await saveSession('collecte', { tracking, awaiting_confirm: true });
      await reply(`Confirmer la collecte de ${dossier.tracking_id} ?
Client : ${dossier.buyer_name ?? '—'}
Poids estime : ${dossier.estimated_weight ?? '—'}kg

Repondez OUI pour valider ou NON pour annuler.`, 'collecte_confirm');
      return new Response('ok', { headers: corsHeaders });
    }
    if (isNo(text)) {
      await clearSession();
      await reply(`Annule. Tapez AIDE pour recommencer.`, 'collecte_cancel');
      return new Response('ok', { headers: corsHeaders });
    }
    if (!isYes(text)) {
      await reply(`Repondez OUI pour valider la collecte ou NON pour annuler.`, 'collecte_confirm');
      return new Response('ok', { headers: corsHeaders });
    }

    const { error } = await supa
      .from('dossiers')
      .update({ status: 'COLLECTED', collected_at: new Date().toISOString(), gp_last_action_at: new Date().toISOString() })
      .eq('id', dossier.id);
    await bumpGpActivity(dossier.id);

    await clearSession();

    if (error) {
      await reply(`Erreur : ${error.message}`, 'collecte_error');
    } else {
      if (!transporteur.tutorial_poids_sent) {
        await reply(
          `Super ! Pesez le colis et tapez :\nPOIDS ${dossier.tracking_id} [kg]`,
          'tutorial_poids',
        );
        await supa.from('transporteurs').update({ tutorial_poids_sent: true }).eq('id', transporteur.id);
      } else {
        await reply(`✅ Collecte confirmee pour ${dossier.tracking_id}.
Pesez le colis et envoyez :
POIDS ${dossier.tracking_id} X.Xkg`, 'collecte_ok');
      }
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

    let amountXof: number | null = (prior.amountXof as number | undefined) ?? null;
    if (amountXof === null) {
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
    }

    // Confirmation OUI/NON
    if (!prior.awaiting_confirm) {
      await saveSession('poids', { tracking, weight, amountXof, awaiting_confirm: true });
      await reply(`Poids ${weight}kg pour ${dossier.tracking_id}.
${amountXof ? `Montant final : ${amountXof.toLocaleString('fr-FR')} XOF` : `Montant final en cours de calcul.`}

Repondez OUI pour valider et notifier le client, NON pour annuler.`, 'poids_confirm');
      return new Response('ok', { headers: corsHeaders });
    }
    if (isNo(text)) {
      await clearSession();
      await reply(`Annule. Tapez AIDE pour recommencer.`, 'poids_cancel');
      return new Response('ok', { headers: corsHeaders });
    }
    if (!isYes(text)) {
      await reply(`Repondez OUI pour valider le poids ou NON pour annuler.`, 'poids_confirm');
      return new Response('ok', { headers: corsHeaders });
    }

    const updates: Record<string, any> = {
      status: 'WEIGHED',
      actual_weight_kg: weight,
      weighed_at: new Date().toISOString(),
      payment_status: 'pending',
      gp_last_action_at: new Date().toISOString(),
    };
    if (amountXof) updates.final_amount_xof = amountXof;

    const { error } = await supa.from('dossiers').update(updates).eq('id', dossier.id);
    await bumpGpActivity(dossier.id);

    await clearSession();

    if (error) {
      await reply(`Erreur : ${error.message}`, 'poids_error');
    } else {
      if (!transporteur.tutorial_livre_sent) {
        await reply(
          `Parfait ! A la livraison tapez :\nLIVRE ${dossier.tracking_id}`,
          'tutorial_livre',
        );
        await supa.from('transporteurs').update({ tutorial_livre_sent: true }).eq('id', transporteur.id);
      } else {
        await reply(`✅ Poids ${weight}kg enregistre pour ${dossier.tracking_id}.
${amountXof ? `Montant final : ${amountXof.toLocaleString('fr-FR')} XOF.` : `Montant final en cours de calcul.`}
Client notifie pour paiement.`, 'poids_ok');
      }
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

    const destLabel = dossier.destination_city ?? dossier.destination_country ?? '—';

    // Confirmation OUI/NON
    if (!prior.awaiting_confirm) {
      await saveSession('livre', { tracking, awaiting_confirm: true });
      await reply(`Confirmer la livraison de ${dossier.tracking_id} a ${destLabel} ?

Repondez OUI pour valider ou NON pour annuler.`, 'livre_confirm');
      return new Response('ok', { headers: corsHeaders });
    }
    if (isNo(text)) {
      await clearSession();
      await reply(`Annule. Tapez AIDE pour recommencer.`, 'livre_cancel');
      return new Response('ok', { headers: corsHeaders });
    }
    if (!isYes(text)) {
      await reply(`Repondez OUI pour valider la livraison ou NON pour annuler.`, 'livre_confirm');
      return new Response('ok', { headers: corsHeaders });
    }

    const { error } = await supa
      .from('dossiers')
      .update({ status: 'DELIVERED', delivered_at: new Date().toISOString(), gp_last_action_at: new Date().toISOString() })
      .eq('id', dossier.id);
    await bumpGpActivity(dossier.id);

    await clearSession();

    if (error) {
      await reply(`Erreur : ${error.message}`, 'livre_error');
    } else {
      if (!transporteur.tutorial_paiement_sent) {
        await reply(
          `🎉 Premiere mission accomplie !\nPaiement sous 48h.\nTapez PAIEMENT pour voir vos gains.`,
          'tutorial_paiement',
        );
        await supa.from('transporteurs').update({ tutorial_paiement_sent: true }).eq('id', transporteur.id);
      } else {
        await reply(`✅ Livraison confirmee pour ${dossier.tracking_id}. Merci !`, 'livre_ok');
      }
      await notifyAdmin(`${prenom} (Ref ${transporteur.reference}) a confirme la livraison de ${dossier.tracking_id} a ${dossier.destination_city ?? dossier.destination_country ?? '—'}`);
    }
    return new Response('ok', { headers: corsHeaders });
  }


  async function handleEnRoute(text: string, prior: Record<string, any>) {
    const tracking = (prior.tracking as string | undefined) ?? parseTracking(text);
    if (!tracking) {
      await saveSession('enroute', {});
      await reply(`Quel est le numero de suivi du colis ?
(Exemple : EN ROUTE YOB-K7M9P2)`, 'enroute_ask_tracking');
      return new Response('ok', { headers: corsHeaders });
    }

    const { data: dossier } = await supa
      .from('dossiers')
      .select('id, assigned_transporteur_ref, tracking_id, contact_phone, buyer_name, estimated_delivery_date, destination_city, destination_country')
      .or(`tracking_id.eq.${tracking},reference.eq.${tracking}`)
      .maybeSingle();

    if (!dossier) {
      await clearSession();
      await reply(`Tracking ${tracking} non trouve.

Que souhaitez-vous faire ?
Tapez AIDE pour les commandes.`, 'enroute_notfound');
      return new Response('ok', { headers: corsHeaders });
    }
    if (dossier.assigned_transporteur_ref !== transporteur.reference) {
      await clearSession();
      await reply(`Ce dossier ne vous est pas assigne.`, 'enroute_unauthorized');
      return new Response('ok', { headers: corsHeaders });
    }

    // Log event (status unchanged)
    try {
      await supa.from('dossier_events').insert({
        dossier_id: dossier.id,
        event_type: 'gp_departed',
        event_data: { transporteur_ref: transporteur.reference, at: new Date().toISOString() },
        visible_to_client: false,
      });
    } catch (e) { console.error('gp_departed event', e); }

    await supa.from('dossiers').update({ gp_last_action_at: new Date().toISOString() }).eq('id', dossier.id);
    await bumpGpActivity(dossier.id);
    await clearSession();

    const eta = dossier.estimated_delivery_date
      ? new Date(dossier.estimated_delivery_date).toLocaleDateString('fr-FR')
      : 'a venir';
    const destLabel = dossier.destination_city ?? dossier.destination_country ?? '';

    if (dossier.contact_phone) {
      await notifyClientFromYobbante(
        dossier.contact_phone,
        `Votre colis ${dossier.tracking_id} est en route ! Arrivee estimee : ${eta}.

Suivez sur yobbante.com`,
        dossier.id,
      );
    }

    await reply(`Bon voyage ! On suit votre trajet vers ${destLabel}.
A la livraison, confirmez :
LIVRE ${dossier.tracking_id}`, 'enroute_ok');
    await notifyAdmin(`${prenom} (Ref ${transporteur.reference}) est EN ROUTE avec ${dossier.tracking_id}`);

    return new Response('ok', { headers: corsHeaders });
  }
});
