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

const HELP_TEXT = `Bienvenue sur Yobbante GP !
Je suis votre assistant automatique.

Que voulez-vous faire ?

1 - Enregistrer un depart
2 - Confirmer une collecte
3 - Enregistrer un poids
4 - Confirmer une livraison
5 - Mes missions en cours
6 - Mes prochains departs

Repondez avec le numero de votre choix
ou tapez directement votre commande.
Ex: DEP Paris 28/05 25kg

Pour toute urgence : +221784604003`;

const FALLBACK_TEXT = `Je n'ai pas compris.
Tapez AIDE pour voir le menu
ou choisissez :
1-Depart  2-Collecte  3-Poids
4-Livraison  5-Missions  6-Departs`;

const ONBOARDING_TEXT = `Bonjour ! 👋
Ce numero est reserve aux transporteurs partenaires de Yobbante.

Si vous etes transporteur et souhaitez rejoindre notre reseau :
👉 yobbante.com/rejoindre-konnekt

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

  async function handleSuperAdmin(): Promise<Response | null> {
    const SA_MENU = `Mode Admin actif.

1 - Nouveau dossier
2 - Stats du jour
3 - Dossiers urgents
4 - Assigner GP
5 - Changer statut
6 - Contacter un GP

Tapez le numero, ou STOP pour quitter.`;

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

  // Session vieille de plus de 30 min → expirée
  const sessionActive = session
    && session.pending_intent
    && (Date.now() - new Date(session.updated_at).getTime()) < 30 * 60 * 1000;

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
      await reply(`Bonjour ${prenom} !\n\n${HELP_TEXT}`, 'start');
    } else {
      await reply(HELP_TEXT, 'help');
    }
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
  if (isMesMissions) return await runMesMissions();

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
      await saveSession('dep', {});
      await reply(`Pour quelle ville partez-vous ?`, 'menu_dep');
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
  //  Détection intent DEP / COLLECTE / POIDS / LIVRE (tolérant)
  // =================================================================



  const hasDepKeyword = /\b(dep|depart|departure|trajet)\b/.test(msg);
  const hasCollectKeyword = /\b(collect|pris|recup|recupere|prise)\b/.test(msg) || /\bok\s+collect/.test(msg);
  const hasPoidsKeyword = /\b(poids|pese|weight|fait\s+\d|pesant)\b/.test(msg);
  const hasLivreKeyword = /\b(livr|delivered|remis|depose|livraison)\b/.test(msg);
  const hasEnRouteKeyword = /\b(en\s*route|enroute|departe|je\s+pars|on\s+part)\b/.test(msg);

  // ---------- EN ROUTE ----------
  if (hasEnRouteKeyword) {
    return await handleEnRoute(rawMsg, {});
  }
  if (sessionActive && session!.pending_intent === 'enroute') {
    return await handleEnRoute(rawMsg, (session!.pending_data ?? {}) as Record<string, any>);
  }

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
      await saveSession('confirm_address', { address: addrCandidate, kind: 'remise', city: foreignCity.replace(/\b\w/g, (c) => c.toUpperCase()) });
      await reply(`J'ai note cette adresse :\n"${addrCandidate}"\nC'est votre adresse de remise a ${foreignCity.replace(/\b\w/g, (c) => c.toUpperCase())} ?\nRepondez OUI pour sauvegarder, NON pour annuler.`, 'address_detected_remise');
    } else {
      await saveSession('confirm_address', { address: addrCandidate, kind: 'collecte', city: 'Dakar' });
      await reply(`J'ai note cette adresse :\n"${addrCandidate}"\nC'est votre adresse de collecte a Dakar ?\nRepondez OUI pour sauvegarder, NON pour annuler.`, 'address_detected_collecte');
    }
    return new Response('ok', { headers: corsHeaders });
  }

  // ---------- Fallback : intent inconnu ----------
  await notifyAdmin(`Commande non comprise de ${prenom} (Ref ${transporteur.reference}) :
"${rawMsg.slice(0, 150)}"
A traiter manuellement.`);
  await reply(FALLBACK_TEXT, 'unknown');
  return new Response('ok', { headers: corsHeaders });

  // =================================================================
  //  Handlers d'intent
  // =================================================================

  function isYes(t: string) { return /^(oui|ok|yes|valider?|valide|confirm(e|er)?|c'est ca|cest ca|exact)\b/i.test(t.trim()); }
  function isNo(t: string)  { return /^(non|no|annul(e|er)?|cancel|stop)\b/i.test(t.trim()); }


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

    // Confirmation OUI/NON avant creation
    if (!prior.awaiting_confirm) {
      await saveSession('dep', { ...collected, awaiting_confirm: true });
      const dStr = formatDateFr(dateIso);
      await reply(`Confirmer ce depart ?
Destination : ${city}
Date : ${dStr}
Capacite : ${Math.max(1, Math.round(weight))}kg

Repondez OUI pour valider ou NON pour annuler.`, 'dep_confirm');
      return new Response('ok', { headers: corsHeaders });
    }
    if (isNo(text)) {
      await clearSession();
      await reply(`Annule. Tapez AIDE pour recommencer.`, 'dep_cancel');
      return new Response('ok', { headers: corsHeaders });
    }
    if (!isYes(text)) {
      await reply(`Repondez OUI pour valider ce depart ou NON pour annuler.`, 'dep_confirm');
      return new Response('ok', { headers: corsHeaders });
    }

    // OUI → on cree
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
      await reply(`✅ Collecte confirmee pour ${dossier.tracking_id}.
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
      await reply(`✅ Livraison confirmee pour ${dossier.tracking_id}. Merci !`, 'livre_ok');
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
