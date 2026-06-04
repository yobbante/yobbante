// livreur-bot — assistant WhatsApp pour les livreurs Dakar (926).
// Sans accents — caracteres simples uniquement.
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
  livreur_id?: string | null;
  message?: string | null;
  message_type?: string | null;
  media_url?: string | null;
}

function normalize(text: string): string {
  return (text ?? '').toString().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function parseTracking(input: string): string | null {
  if (!input) return null;
  const m = input.toUpperCase().match(/YOB[-\s]?([A-Z0-9]{6})/);
  if (m) return `YOB-${m[1]}`;
  const m2 = input.toUpperCase().match(/YBT[-\s]?(\d{4})[-\s]?(\d{4})/);
  if (m2) return `YBT-${m2[1]}-${m2[2]}`;
  return null;
}

function parseWeight(input: string): number | null {
  const m = normalize(input).match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|k)?/);
  if (!m) return null;
  const v = parseFloat(m[1].replace(',', '.'));
  return isNaN(v) || v <= 0 ? null : v;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

function helpText(prenom: string): string {
  return `Bonjour ${prenom} !

Commandes disponibles :

1 - Mes missions du jour
2 - Confirmer une prise en charge
3 - Confirmer un depot chez le GP
4 - Signaler un probleme
5 - Photo du colis

Ou tapez directement :
PRIS YOB-XXXXXX
POIDS YOB-XXXXXX 12kg
OK YOB-XXXXXX
PB YOB-XXXXXX description
DEPOSE YOB-XXXXXX
PHOTO YOB-XXXXXX`;
}

const ONBOARDING_TEXT = `Bonjour ! Ce numero est reserve aux livreurs partenaires Yobbante.

Pour rejoindre notre reseau : +221784604003

Merci !`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  let input: BotInput;
  try { input = await req.json(); }
  catch { return new Response('Invalid JSON', { status: 400 }); }

  const fromPhone = input.from_phone;
  const rawMsg = (input.message ?? '').trim();
  const msg = normalize(rawMsg);
  const messageType = input.message_type ?? 'text';

  console.log('LIV_BOT', JSON.stringify({ from: fromPhone.slice(-4), msg: msg.slice(0, 80), type: messageType }));

  // Resolve livreur
  let livreur: any = null;
  if (input.livreur_id) {
    const { data } = await supa.from('livreurs').select('*').eq('id', input.livreur_id).maybeSingle();
    livreur = data;
  }
  if (!livreur) {
    const tail = fromPhone.slice(-9);
    const { data } = await supa
      .from('livreurs')
      .select('*')
      .ilike('telephone', `%${tail}%`)
      .limit(1)
      .maybeSingle();
    livreur = data;
  }

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
    } catch (e) { console.error('LIV_BOT send', e); }
  }

  async function reply(text: string, intent?: string) {
    await sendWa({
      recipient_phone: fromPhone,
      recipient_type: 'livreur',
      message: text,
      trigger_type: intent ?? 'livreur_bot_reply',
    });
    if (input.inbound_id) {
      try {
        await supa.from('whatsapp_inbound_messages')
          .update({ bot_intent: intent ?? null, bot_response: text, replied_at: new Date().toISOString() })
          .eq('id', input.inbound_id);
      } catch (e) { console.error('LIV_BOT inbound update', e); }
    }
  }

  async function notifyAdmin(text: string) {
    const adminPhone = Deno.env.get('ADMIN_WHATSAPP_NUMBER');
    if (!adminPhone) return;
    await sendWa({ recipient_phone: adminPhone, recipient_type: 'admin', message: text, trigger_type: 'admin_livreur_alert' });
  }

  function ok(body: unknown = { ok: true }) {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Not registered
  if (!livreur) {
    await reply(ONBOARDING_TEXT, 'livreur_onboarding');
    return ok({ ok: true, unknown: true });
  }

  if (!livreur.is_active) {
    await reply(`Compte livreur desactive. Contactez l equipe : +221784604003`, 'livreur_inactive');
    return ok({ ok: true, inactive: true });
  }

  const prenom = (livreur.prenom?.trim() || livreur.nom?.split(' ')[0] || 'cher partenaire');

  // ========== Session (for PHOTO follow-up) ==========
  const { data: session } = await supa
    .from('livreur_bot_sessions')
    .select('*')
    .eq('from_phone', fromPhone)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  async function clearSession() {
    if (session?.id) await supa.from('livreur_bot_sessions').delete().eq('id', session.id);
  }
  async function saveSession(intent: string, data: Record<string, unknown>) {
    if (session?.id) {
      await supa.from('livreur_bot_sessions').update({
        livreur_id: livreur.id, pending_intent: intent, pending_data: data, updated_at: new Date().toISOString(),
      }).eq('id', session.id);
    } else {
      await supa.from('livreur_bot_sessions').insert({
        from_phone: fromPhone, livreur_id: livreur.id, pending_intent: intent, pending_data: data,
      });
    }
  }

  // ========== Photo follow-up (image after PHOTO YOB-XXXXXX) ==========
  if ((messageType === 'image' || messageType === 'document') && session?.pending_intent === 'awaiting_photo') {
    const trackingId = (session.pending_data as any)?.tracking_id as string | undefined;
    const mediaUrl = input.media_url;
    if (!trackingId || !mediaUrl) {
      await reply('Photo recue mais dossier introuvable. Renvoyez : PHOTO YOB-XXXXXX', 'photo_error');
      return ok();
    }
    const { data: dossier } = await supa.from('dossiers').select('id, collecte_photos').eq('tracking_id', trackingId).maybeSingle();
    if (!dossier) {
      await reply(`Dossier ${trackingId} introuvable.`, 'photo_not_found');
      return ok();
    }
    const existing = (dossier.collecte_photos ?? []) as string[];
    await supa.from('dossiers').update({ collecte_photos: [...existing, mediaUrl] }).eq('id', dossier.id);
    await clearSession();
    await reply(`Photo enregistree pour ${trackingId}. Merci !`, 'photo_saved');
    return ok();
  }

  // Non-text messages without a pending intent
  if (messageType !== 'text' && messageType !== 'button' && messageType !== 'interactive') {
    await reply('Envoyez une commande texte. Tapez AIDE pour le menu.', 'unsupported_type');
    return ok();
  }

  // ========== Routing ==========
  // Numeric menu shortcuts
  const trimmed = msg.replace(/[^a-z0-9 -]/g, ' ').trim();

  if (trimmed === '1' || /\bmissions?\b/.test(trimmed) || /^aide$|^bonjour$|^salut$|^menu$|^help$/.test(trimmed)) {
    if (/^aide$|^bonjour$|^salut$|^menu$|^help$/.test(trimmed)) {
      await reply(helpText(prenom), 'help');
      return ok();
    }
    return await runMissions();
  }

  if (trimmed === '2') {
    await reply(`Pour confirmer une prise en charge, tapez :\nPRIS YOB-XXXXXX\n(remplacez par le code de votre mission)`, 'menu_pris');
    return ok();
  }
  if (trimmed === '3') {
    await reply(`Pour confirmer un depot chez le GP, tapez :\nDEPOSE YOB-XXXXXX`, 'menu_depose');
    return ok();
  }
  if (trimmed === '4') {
    await reply(`Pour signaler un probleme, tapez :\nPB YOB-XXXXXX description du probleme`, 'menu_pb');
    return ok();
  }
  if (trimmed === '5') {
    await reply(`Pour envoyer une photo, tapez d abord :\nPHOTO YOB-XXXXXX\nPuis envoyez la photo en image.`, 'menu_photo');
    return ok();
  }

  // Command keyword detection
  const cmd = trimmed.split(/\s+/)[0];
  const tracking = parseTracking(rawMsg);

  try {
    if (cmd === 'pris') return await runPris(tracking);
    if (cmd === 'poids') return await runPoids(tracking, rawMsg);
    if (cmd === 'ok') return await runOk(tracking);
    if (cmd === 'pb' || cmd === 'probleme') return await runPb(tracking, rawMsg);
    if (cmd === 'depose' || cmd === 'depot') return await runDepose(tracking);
    if (cmd === 'photo') return await runPhoto(tracking);
  } catch (e) {
    console.error('LIV_BOT cmd error', e);
    await reply('Erreur technique. Reessayez ou contactez +221784604003', 'error');
    return ok({ ok: false });
  }

  await reply(`Je n ai pas compris. Tapez AIDE pour le menu.`, 'fallback');
  return ok();

  // ============== Handlers ==============

  async function runMissions() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data: missions } = await supa
      .from('dossiers')
      .select('id, tracking_id, reference, buyer_name, contact_phone, collecte_creneau, estimated_weight, product_description, assigned_transporteur_ref, intake_notes')
      .eq('livreur_collecte_id', livreur.id)
      .is('collecte_confirmee_at', null)
      .gte('collecte_creneau', today.toISOString())
      .order('collecte_creneau', { ascending: true })
      .limit(20);

    if (!missions || missions.length === 0) {
      await reply(`Aucune mission a venir pour vous. Bonne journee !`, 'missions_empty');
      return ok();
    }

    const dateLabel = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(new Date());
    const lines: string[] = [`Vos missions du ${dateLabel} :`, ''];
    missions.forEach((m: any, i: number) => {
      lines.push(`COLLECTE ${i + 1} - ${m.tracking_id ?? m.reference}`);
      if (m.buyer_name) lines.push(`Client : ${m.buyer_name}`);
      if (m.contact_phone) lines.push(`Tel : ${m.contact_phone}`);
      lines.push(`Creneau : ${fmtDate(m.collecte_creneau)}`);
      lines.push(`Colis : ${m.estimated_weight ?? '-'}kg - ${m.product_description ?? '-'}`);
      if (m.assigned_transporteur_ref) lines.push(`Deposer chez : GP ${m.assigned_transporteur_ref}`);
      if (m.intake_notes) lines.push(`Note : ${m.intake_notes.slice(0, 100)}`);
      lines.push('');
    });
    lines.push('Confirmez : PRIS YOB-XXXXXX');
    await reply(lines.join('\n'), 'missions_list');
    return ok();
  }

  async function loadDossier(trackingId: string | null) {
    if (!trackingId) return null;
    const { data } = await supa
      .from('dossiers')
      .select('*')
      .or(`tracking_id.eq.${trackingId},reference.eq.${trackingId}`)
      .maybeSingle();
    return data;
  }

  async function runPris(trackingId: string | null) {
    if (!trackingId) {
      await reply('Format : PRIS YOB-XXXXXX', 'pris_format');
      return ok();
    }
    const d = await loadDossier(trackingId);
    if (!d) { await reply(`Dossier ${trackingId} introuvable.`, 'pris_not_found'); return ok(); }
    if (d.livreur_collecte_id && d.livreur_collecte_id !== livreur.id) {
      await reply(`Cette mission est assignee a un autre livreur.`, 'pris_wrong_livreur'); return ok();
    }

    await supa.from('dossiers').update({
      status: 'COLLECTING',
      livreur_collecte_id: livreur.id,
    }).eq('id', d.id);

    // Notifier client depuis 607 (free-text — uses default sender)
    if (d.contact_phone) {
      await sendWa({
        recipient_phone: d.contact_phone,
        recipient_type: 'client',
        message: `Votre colis est en cours de collecte. Notre livreur est en chemin.`,
        dossier_id: d.id,
        trigger_type: 'livreur_pris_client',
      });
    }
    await notifyAdmin(`Collecte demarree ${d.tracking_id ?? d.reference}\nLivreur : ${prenom}`);

    await reply(`Prise en charge confirmee ${d.tracking_id ?? d.reference}.\n\nPesez le colis et envoyez :\nPOIDS ${d.tracking_id ?? d.reference} {poids}kg`, 'pris_ok');
    return ok();
  }

  async function runPoids(trackingId: string | null, raw: string) {
    if (!trackingId) { await reply('Format : POIDS YOB-XXXXXX 12kg', 'poids_format'); return ok(); }
    const w = parseWeight(raw.replace(/YOB[-\s]?[A-Z0-9]{6}/i, ''));
    if (!w) { await reply('Poids invalide. Ex: POIDS YOB-ABC123 12kg', 'poids_invalid'); return ok(); }
    const d = await loadDossier(trackingId);
    if (!d) { await reply(`Dossier ${trackingId} introuvable.`, 'poids_not_found'); return ok(); }

    await supa.from('dossiers').update({ poids_livreur: w }).eq('id', d.id);

    const estimated = Number(d.estimated_weight ?? 0);
    if (estimated > 0 && Math.abs(w - estimated) / estimated > 0.2) {
      await notifyAdmin(`Ecart poids ${d.tracking_id ?? d.reference}\nEstime: ${estimated}kg / Reel: ${w}kg\nLivreur: ${prenom}\nAjustement tarif requis.`);
    }

    await reply(`Poids ${w}kg enregistre.\n\nConfirmez conformite :\nOK ${d.tracking_id ?? d.reference} - si colis conforme\nPB ${d.tracking_id ?? d.reference} description - si probleme`, 'poids_ok');
    return ok();
  }

  async function runOk(trackingId: string | null) {
    if (!trackingId) { await reply('Format : OK YOB-XXXXXX', 'ok_format'); return ok(); }
    const d = await loadDossier(trackingId);
    if (!d) { await reply(`Dossier ${trackingId} introuvable.`, 'ok_not_found'); return ok(); }

    await supa.from('dossiers').update({ conformite_ok: true }).eq('id', d.id);
    await reply(`Conformite validee.\n\nDeposez chez le GP et confirmez :\nDEPOSE ${d.tracking_id ?? d.reference}`, 'ok_ok');
    return ok();
  }

  async function runPb(trackingId: string | null, raw: string) {
    if (!trackingId) { await reply('Format : PB YOB-XXXXXX description', 'pb_format'); return ok(); }
    const description = raw.replace(/^pb\s+|^probleme\s+/i, '').replace(/YOB[-\s]?[A-Z0-9]{6}/i, '').trim() || 'Non specifie';
    const d = await loadDossier(trackingId);
    if (!d) { await reply(`Dossier ${trackingId} introuvable.`, 'pb_not_found'); return ok(); }

    await supa.from('dossiers').update({
      conformite_ok: false,
      conformite_notes: description,
    }).eq('id', d.id);

    await notifyAdmin(`PROBLEME COLIS ${d.tracking_id ?? d.reference}\n${description}\nLivreur: ${prenom}`);
    await reply(`Probleme signale. Attendez les instructions de l equipe.`, 'pb_ok');
    return ok();
  }

  async function runDepose(trackingId: string | null) {
    if (!trackingId) { await reply('Format : DEPOSE YOB-XXXXXX', 'depose_format'); return ok(); }
    const d = await loadDossier(trackingId);
    if (!d) { await reply(`Dossier ${trackingId} introuvable.`, 'depose_not_found'); return ok(); }

    const now = new Date().toISOString();
    await supa.from('dossiers').update({
      status: 'COLLECTED',
      collected_at: now,
      collecte_confirmee_at: now,
    }).eq('id', d.id);

    // Notif client (template package_collected)
    if (d.contact_phone) {
      await sendWa({
        recipient_phone: d.contact_phone,
        recipient_type: 'client',
        template_name: 'package_collected',
        template_params: [
          (d.buyer_name?.split(' ')[0] ?? 'Client'),
          d.tracking_id ?? d.reference,
        ],
        dossier_id: d.id,
        trigger_type: 'livreur_depose_client',
      });
    }

    // Notif GP depuis 926
    if (d.assigned_transporteur_ref) {
      const { data: gp } = await supa
        .from('transporteurs')
        .select('telephone_1, id')
        .eq('reference', d.assigned_transporteur_ref)
        .maybeSingle();
      if (gp?.telephone_1) {
        await sendWa({
          recipient_phone: gp.telephone_1,
          recipient_type: 'gp',
          message: `Colis ${d.tracking_id ?? d.reference} depose chez vous par notre livreur. Verifiez et confirmez.`,
          transporteur_id: gp.id,
          dossier_id: d.id,
          trigger_type: 'livreur_depose_gp',
        });
      }
    }

    await reply(`Super ! Depot confirme ${d.tracking_id ?? d.reference}.\nMission terminee.`, 'depose_ok');
    return ok();
  }

  async function runPhoto(trackingId: string | null) {
    if (!trackingId) { await reply('Format : PHOTO YOB-XXXXXX', 'photo_format'); return ok(); }
    const d = await loadDossier(trackingId);
    if (!d) { await reply(`Dossier ${trackingId} introuvable.`, 'photo_not_found'); return ok(); }
    await saveSession('awaiting_photo', { tracking_id: d.tracking_id ?? d.reference });
    await reply(`Envoyez la photo du colis maintenant.`, 'photo_await');
    return ok();
  }
});
