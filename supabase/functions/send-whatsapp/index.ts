// send-whatsapp — 2-numbers WhatsApp sender (clients + GP)
// Accepts both the new payload schema and the legacy one for back-compat.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type RecipientType = 'client' | 'gp' | 'admin';

interface InteractiveButton { id: string; label: string }
interface InteractiveRow { id: string; title: string; description?: string }
interface InteractiveSection { title: string; rows: InteractiveRow[] }

interface SendPayload {
  recipient_phone: string;
  recipient_type?: RecipientType;
  template_name?: string;
  template_params?: string[];
  template_language?: string;
  template_fallback_name?: string;
  message?: string;
  /** Interactive (boutons / liste). Si fourni, on envoie un message interactif. */
  interactive_type?: 'button' | 'list';
  /** Corps de texte du message interactif. */
  interactive_body?: string;
  /** Mode 'button' : 1 à 3 boutons (label max 20 char). */
  buttons?: InteractiveButton[];
  /** Mode 'list' : label du bouton qui ouvre la liste (max 20 char). */
  list_button_label?: string;
  /** Mode 'list' : sections (rows: title max 24, description max 72). */
  sections?: InteractiveSection[];
  /** Texte fallback envoyé en clair si l'envoi interactif est refusé (hors 24h). */
  fallback_text?: string;
  dossier_id?: string;
  transporteur_id?: string;
  trigger_type?: string;
  /** Override explicite du phone_number_id Meta utilise pour l'envoi. */
  phone_id?: string;

  // legacy
  client_name?: string;
  service_type?: string;
  origin?: string;
  destination?: string;
  weight?: string | number;
}

// Mapping serveur (miroir de src/lib/whatsappTemplates.ts) — utilisé quand
// l'appelant n'envoie pas explicitement `template_fallback_name`.
const TEMPLATE_FALLBACKS: Record<string, string> = {
  order_confirmation_v2: 'order_confirmation',
  departure_assigned_v2: 'departure_assigned',
  package_collected_v2: 'package_collected',
  package_in_transit_v2: 'package_in_transit',
  package_arrived_v2: 'package_arrived',
  package_delivered_v2: 'package_delivered',
  weight_confirmation_v2: 'weight_confirmation',
  payment_reminder_48h_v2: 'payment_reminder_48h',
  mission_assigned_gp_v2: 'mission_assigned_gp',
  gp_mission_recap_j1_v2: 'gp_mission_recap_j1',
};

import { normalizePhoneDigits, warnIfInvalidPhone } from '../_shared/phone.ts';
import { renderTemplateBody, GP_PRENOM_TEMPLATES } from '../_shared/whatsappTemplates.ts';

function normalizePhone(input: string): string {
  // Normalisation SN-aware puis chiffres seuls (format attendu par l'API Meta).
  return normalizePhoneDigits(warnIfInvalidPhone(input, 'send-whatsapp.recipient'));
}

function hasRealClientName(input?: string | null): boolean {
  const value = (input || '').trim();
  return value.length > 0 && value.toUpperCase() !== 'N/A';
}

function resolvePhoneId(recipientType: RecipientType): { phoneId?: string; fromNumber?: string } {
  // 607 = numero client (et admin). Le 926 (GP) est gere via WHATSAPP_GP_BOT_PHONE_ID pour les notifs admin.
  const clientPhoneId = Deno.env.get('WHATSAPP_CLIENT_PHONE_ID')
    ?? Deno.env.get('WHATSAPP_PHONE_ID_CLIENTS')
    ?? Deno.env.get('WHATSAPP_PHONE_ID');

  if (recipientType === 'admin') {
    // Admin : TOUJOURS depuis le 607, jamais de fallback GP.
    return { phoneId: clientPhoneId, fromNumber: '+221786078080' };
  }
  if (recipientType === 'gp') {
    // Numero GP bot : +221 78 926 97 56
    return {
      phoneId: Deno.env.get('WHATSAPP_GP_BOT_PHONE_ID')
        ?? Deno.env.get('WHATSAPP_PHONE_ID_GP')
        ?? Deno.env.get('WHATSAPP_PHONE_ID'),
      fromNumber: '+' + (Deno.env.get('WHATSAPP_GP_BOT_NUMBER') ?? '221789269756'),
    };
  }
  return { phoneId: clientPhoneId, fromNumber: '+221786078080' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supaUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supa = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });
  const token = Deno.env.get('WHATSAPP_TOKEN');

  let body: SendPayload;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log('WA_TRIGGER', JSON.stringify({
    type: body.recipient_type,
    template: body.template_name,
    to: body.recipient_phone?.slice(-4),
    trigger: body.trigger_type,
  }));

  if (!token) {
    console.error('WA_ERROR: missing WHATSAPP_TOKEN');
    return new Response(JSON.stringify({ error: 'Missing WHATSAPP_TOKEN' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let recipientType: RecipientType = body.recipient_type ?? 'client';

  const recipient = normalizePhone(body.recipient_phone || '');
  if (!recipient || recipient.length < 6) {
    return new Response(JSON.stringify({ error: 'recipient_phone is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // SAFETY: si un numero "client" appartient en fait a un GP (numero present dans les deux tables),
  // forcer le routage GP → 926. Toute notif GP doit partir du 926, jamais du 607.
  if (recipientType === 'client') {
    try {
      const tail = recipient.slice(-9);
      const { data: gpHit } = await supa
        .from('transporteurs')
        .select('id')
        .or(`telephone_1.ilike.%${tail}%,whatsapp.ilike.%${tail}%`)
        .eq('actif', true)
        .limit(1)
        .maybeSingle();
      if (gpHit?.id) {
        console.log('WA_ROUTE forcing gp for client-routed message to known GP', recipient.slice(-4));
        recipientType = 'gp';
      }
    } catch (e) {
      console.error('WA_ROUTE gp lookup failed', e instanceof Error ? e.message : String(e));
    }
  }

  const resolved = resolvePhoneId(recipientType);
  // Si l'appelant fournit explicitement un phone_id, on l'utilise TEL QUEL
  // (pas de fallback sur WHATSAPP_PHONE_ID). C'est indispensable pour que
  // gp-bot puisse forcer une reponse depuis le 926 meme pour recipient_type=admin.
  const phoneId = (body.phone_id && body.phone_id.trim()) || resolved.phoneId;
  const fromNumber = (body.phone_id && body.phone_id.trim()) ? undefined : resolved.fromNumber;
  if (!phoneId) {
    console.error('WA_ERROR: missing phone id for', recipientType);
    return new Response(JSON.stringify({ error: `Missing phone id for ${recipientType}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  console.log('WA_PHONE_ID', { recipientType, phoneId, override: !!body.phone_id });


  if (recipientType === 'admin' && !body.message && !hasRealClientName(body.client_name)) {
    console.log('WA_SKIP admin notification without real client name');
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'missing_client_name' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // BUG 3 — Resolve GP prenom server-side for any GP-prenom-first template
  // to make sure clients never receive "Bienvenue, Awa !" sent to the wrong GP.
  // Caller-provided prenom is kept ONLY if it matches the actual GP for this phone.
  if (body.template_name && GP_PRENOM_TEMPLATES.has(body.template_name)) {
    try {
      const tail = normalizePhone(body.recipient_phone || '').slice(-9);
      if (tail) {
        const { data: gp } = await supa
          .from('transporteurs')
          .select('prenom, nom')
          .or(`telephone_1.ilike.%${tail}%,whatsapp.ilike.%${tail}%`)
          .limit(1)
          .maybeSingle();
        const resolved = (gp?.prenom?.trim()
          || (gp?.nom ? gp.nom.split(/\s+/)[0] : '')
          || 'ami(e)').trim();
        body.template_params = body.template_params ? [...body.template_params] : [];
        body.template_params[0] = resolved;
        console.log('WA_GP_PRENOM resolved', { template: body.template_name, tail, prenom: resolved });
      }
    } catch (e) {
      console.error('WA_GP_PRENOM resolution failed', e instanceof Error ? e.message : String(e));
      body.template_params = body.template_params ? [...body.template_params] : [];
      if (!body.template_params[0]?.trim()) body.template_params[0] = 'ami(e)';
    }
  }

  // Build Meta payload
  const useTemplate = !!body.template_name;
  const useInteractive = !!body.interactive_type
    && (body.interactive_type === 'button' || body.interactive_type === 'list');
  let metaBody: Record<string, unknown>;
  let messageBody: string | null = null;
  let activeTemplateName: string | null = body.template_name ?? null;
  let messageType: 'text' | 'template' | 'interactive' = 'text';
  let interactivePayloadSnapshot: any = null;

  const truncate = (s: string, n: number) => (s ?? '').toString().slice(0, n);

  const buildTemplateBody = (templateName: string): Record<string, unknown> => {
    const params = (body.template_params || []).map((p) => ({ type: 'text', text: String(p ?? '') }));
    const langCode = body.template_language
      ?? (templateName === 'hello_world' ? 'en_US' : 'fr');
    return {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'template',
      template: {
        name: templateName,
        language: { code: langCode },
        ...(params.length > 0 && {
          components: [{ type: 'body', parameters: params }],
        }),
      },
    };
  };

  const buildInteractiveBody = (): Record<string, unknown> | null => {
    const bodyText = truncate(body.interactive_body ?? body.message ?? '', 1024);
    if (!bodyText) return null;
    if (body.interactive_type === 'button') {
      const btns = (body.buttons ?? []).slice(0, 3).map((b) => ({
        type: 'reply',
        reply: { id: truncate(b.id, 256), title: truncate(b.label, 20) },
      }));
      if (btns.length === 0) return null;
      return {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: { buttons: btns },
        },
      };
    }
    // list
    const sections = (body.sections ?? []).map((s) => ({
      title: truncate(s.title, 24),
      rows: (s.rows ?? []).map((r) => ({
        id: truncate(r.id, 200),
        title: truncate(r.title, 24),
        ...(r.description ? { description: truncate(r.description, 72) } : {}),
      })),
    })).filter((s) => s.rows.length > 0);
    const totalRows = sections.reduce((n, s) => n + s.rows.length, 0);
    if (totalRows === 0 || totalRows > 10) return null;
    return {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: truncate(body.list_button_label || 'Voir les options', 20),
          sections,
        },
      },
    };
  };

  if (useTemplate) {
    metaBody = buildTemplateBody(body.template_name!);
    messageType = 'template';
  } else if (useInteractive) {
    const built = buildInteractiveBody();
    if (built) {
      metaBody = built;
      messageType = 'interactive';
      interactivePayloadSnapshot = (built as any).interactive;
      messageBody = body.interactive_body ?? body.message ?? null;
    } else {
      // Pas de boutons valides → tomber en texte
      messageBody = body.fallback_text ?? body.interactive_body ?? body.message ?? '';
      metaBody = {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'text',
        text: { body: messageBody },
      };
    }
  } else {
    // Free text fallback (24h window or admin notif)
    messageBody = body.message
      ? String(body.message)
      : `🚀 Nouvelle demande Yobbanté

Client : ${body.client_name || 'N/A'}
Service : ${body.service_type || 'N/A'}
De : ${body.origin || 'N/A'}
Vers : ${body.destination || 'N/A'}
Poids : ${body.weight ?? 'N/A'}kg

Voir → https://yobbante.com/admin`;
    metaBody = {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'text',
      text: { body: messageBody },
    };
  }

  // Send
  let status = 'sent';
  let wamid: string | null = null;
  let errorMessage: string | null = null;
  let metaResult: any = null;
  let httpOk = false;
  let usedFallback = false;

  const callMeta = async (payload: Record<string, unknown>) => {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const json: any = await res.json();
    return { res, json };
  };

  // Retry transient errors (5xx, rate-limit) once with small backoff before
  // declaring the call failed. Keeps the interactive-list pipeline reliable.
  const TRANSIENT_WA_CODES = new Set([130429, 131048, 131056, 368]);
  const isTransient = (res: Response, json: any): boolean => {
    if (res.status >= 500) return true;
    const c = json?.error?.code;
    return typeof c === 'number' && TRANSIENT_WA_CODES.has(c);
  };
  const callMetaWithRetry = async (payload: Record<string, unknown>) => {
    let attempt;
    try {
      attempt = await callMeta(payload);
    } catch (e) {
      console.warn('WA_RETRY network error on first attempt, retrying once');
      await new Promise((r) => setTimeout(r, 600));
      attempt = await callMeta(payload);
      return attempt;
    }
    if (!attempt.res.ok && isTransient(attempt.res, attempt.json)) {
      console.warn('WA_RETRY transient error, retrying once', attempt.json?.error?.code);
      await new Promise((r) => setTimeout(r, 600));
      attempt = await callMeta(payload);
    }
    return attempt;
  };

  const isTemplateNotApproved = (json: any, res: Response): boolean => {
    if (res.ok) return false;
    const code = json?.error?.code;
    const msg: string = json?.error?.message ?? '';
    return code === 132000 || code === 132001 || code === 132005 || /template/i.test(msg);
  };

  try {
    let { res, json } = await callMetaWithRetry(metaBody);
    metaResult = json;
    httpOk = res.ok;

    // Retry avec le fallback si template _v2 non approuvé
    if (!res.ok && useTemplate && isTemplateNotApproved(json, res)) {
      const fb = body.template_fallback_name
        ?? TEMPLATE_FALLBACKS[body.template_name!]
        ?? null;
      if (fb && fb !== body.template_name) {
        console.warn('WA_FALLBACK', JSON.stringify({ from: body.template_name, to: fb }));
        const retry = await callMetaWithRetry(buildTemplateBody(fb));
        res = retry.res;
        json = retry.json;
        metaResult = json;
        httpOk = res.ok;
        if (res.ok) {
          usedFallback = true;
          activeTemplateName = fb;
        }
      }
    }

    if (res.ok) {
      wamid = metaResult?.messages?.[0]?.id ?? null;
    } else {
      const code = metaResult?.error?.code;
      const sub = metaResult?.error?.error_subcode;
      const msg: string = metaResult?.error?.message ?? `HTTP ${res.status}`;
      errorMessage = msg;
      status = isTemplateNotApproved(metaResult, res) ? 'template_not_approved' : 'failed';
      console.error('WA_ERROR', JSON.stringify({ code, sub, msg }));

      // Interactive : retry transient déjà fait. On bascule en TEXTE (avec son
      // propre retry) pour garantir la délivrance même hors fenêtre 24h.
      if (messageType === 'interactive') {
        const fbText = body.fallback_text ?? body.interactive_body ?? body.message ?? null;
        if (fbText) {
          console.warn('WA_INTERACTIVE_FALLBACK_TEXT', JSON.stringify({ code, sub }));
          const fbRes = await callMetaWithRetry({
            messaging_product: 'whatsapp',
            to: recipient,
            type: 'text',
            text: { body: fbText },
          });
          if (fbRes.res.ok) {
            metaResult = fbRes.json;
            httpOk = true;
            status = 'sent';
            wamid = fbRes.json?.messages?.[0]?.id ?? null;
            messageBody = fbText;
            messageType = 'text';
            interactivePayloadSnapshot = null;
            usedFallback = true;
            errorMessage = null;
          } else {
            errorMessage = `interactive_failed:${msg}; text_fallback_failed:${fbRes.json?.error?.message ?? 'unknown'}`;
          }
        }
      }
    }
  } catch (err) {
    status = 'failed';
    errorMessage = err instanceof Error ? err.message : String(err);
    console.error('WA_ERROR fetch', errorMessage);
  }

  // Log outbound — never block the response on logging
  try {
    await supa.from('whatsapp_outbound_messages').insert({
      to_phone: recipient,
      from_number: fromNumber,
      recipient_type: recipientType,
      template_name: activeTemplateName,
      template_params: body.template_params ? body.template_params : null,
      message_body: messageBody,
      message_type: messageType,
      interactive_payload: interactivePayloadSnapshot,
      dossier_id: body.dossier_id ?? null,
      transporteur_id: body.transporteur_id ?? null,
      status,
      wamid,
      error_message: errorMessage,
      trigger_type: usedFallback
        ? `${body.trigger_type ?? 'unknown'}::fallback`
        : (body.trigger_type ?? null),
    });
  } catch (logErr) {
    console.error('WA_ERROR log', logErr instanceof Error ? logErr.message : String(logErr));
  }

  // Mirror outbound client WhatsApp messages into the dossier chat so staff
  // can see in the conversation what was sent automatically (assignment,
  // departure notifications, etc.).
  try {
    if (
      status === 'sent' &&
      body.dossier_id &&
      recipientType === 'client' &&
      messageBody &&
      messageBody.trim().length > 0
    ) {
      const sourceKey = wamid
        ? `wa_out:${wamid}`
        : `wa_out_local:${body.dossier_id}:${Date.now()}`;
      // Idempotent insert — unique partial index on dossier_messages(source)
      const { error: mirrorInsertErr } = await supa.from('dossier_messages').insert({
        dossier_id: body.dossier_id,
        author_id: null,
        author_role: 'staff',
        body: `📲 WhatsApp → client\n\n${messageBody}`,
        internal_note: false,
        source: sourceKey,
      });
      if (mirrorInsertErr && !/duplicate key|unique constraint/i.test(mirrorInsertErr.message)) {
        console.error('WA_ERROR mirror_chat insert', mirrorInsertErr.message);
      }
    }
  } catch (mirrorErr) {
    console.error('WA_ERROR mirror_chat', mirrorErr instanceof Error ? mirrorErr.message : String(mirrorErr));
  }

  // Return 200 even on template_not_approved (so callers don't crash)
  const responseStatus = status === 'sent' || status === 'template_not_approved' ? 200 : 400;
  return new Response(
    JSON.stringify({ ok: httpOk, status, wamid, result: metaResult }),
    {
      status: responseStatus,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
});
