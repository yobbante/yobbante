// send-whatsapp — 2-numbers WhatsApp sender (clients + GP)
// Accepts both the new payload schema and the legacy one for back-compat.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type RecipientType = 'client' | 'gp' | 'admin';

interface SendPayload {
  recipient_phone: string;
  recipient_type?: RecipientType;
  template_name?: string;
  template_params?: string[];
  /** Code langue du template (par défaut 'fr'). hello_world doit utiliser 'en_US'. */
  template_language?: string;
  /** Ancien nom Meta — utilisé en repli si `template_name` n'est pas approuvé. */
  template_fallback_name?: string;
  message?: string;
  dossier_id?: string;
  transporteur_id?: string;
  trigger_type?: string;
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

function normalizePhone(input: string): string {
  return (input || '').toString().replace(/\D/g, '');
}

function hasRealClientName(input?: string | null): boolean {
  const value = (input || '').trim();
  return value.length > 0 && value.toUpperCase() !== 'N/A';
}

function resolvePhoneId(recipientType: RecipientType): { phoneId?: string; fromNumber?: string } {
  if (recipientType === 'gp') {
    return {
      phoneId: Deno.env.get('WHATSAPP_PHONE_ID_GP') ?? Deno.env.get('WHATSAPP_PHONE_ID'),
      fromNumber: '+221781221891',
    };
  }
  // client + admin both sent from 607
  return {
    phoneId: Deno.env.get('WHATSAPP_PHONE_ID_CLIENTS') ?? Deno.env.get('WHATSAPP_PHONE_ID'),
    fromNumber: '+221786078080',
  };
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

  const recipientType: RecipientType = body.recipient_type ?? 'client';
  const { phoneId, fromNumber } = resolvePhoneId(recipientType);

  if (!phoneId) {
    console.error('WA_ERROR: missing phone id for', recipientType);
    return new Response(JSON.stringify({ error: `Missing phone id for ${recipientType}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const recipient = normalizePhone(body.recipient_phone || '');
  if (!recipient || recipient.length < 6) {
    return new Response(JSON.stringify({ error: 'recipient_phone is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (recipientType === 'admin' && !body.message && !hasRealClientName(body.client_name)) {
    console.log('WA_SKIP admin notification without real client name');
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'missing_client_name' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Build Meta payload
  const useTemplate = !!body.template_name;
  let metaBody: Record<string, unknown>;
  let messageBody: string | null = null;
  let activeTemplateName: string | null = body.template_name ?? null;

  const buildTemplateBody = (templateName: string): Record<string, unknown> => {
    const params = (body.template_params || []).map((p) => ({ type: 'text', text: String(p ?? '') }));
    return {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'fr' },
        ...(params.length > 0 && {
          components: [{ type: 'body', parameters: params }],
        }),
      },
    };
  };

  if (useTemplate) {
    metaBody = buildTemplateBody(body.template_name!);
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

  const isTemplateNotApproved = (json: any, res: Response): boolean => {
    if (res.ok) return false;
    const code = json?.error?.code;
    const msg: string = json?.error?.message ?? '';
    return code === 132000 || code === 132001 || code === 132005 || /template/i.test(msg);
  };

  try {
    let { res, json } = await callMeta(metaBody);
    metaResult = json;
    httpOk = res.ok;

    // Retry avec le fallback si template _v2 non approuvé
    if (!res.ok && useTemplate && isTemplateNotApproved(json, res)) {
      const fb = body.template_fallback_name
        ?? TEMPLATE_FALLBACKS[body.template_name!]
        ?? null;
      if (fb && fb !== body.template_name) {
        console.warn('WA_FALLBACK', JSON.stringify({ from: body.template_name, to: fb }));
        const retry = await callMeta(buildTemplateBody(fb));
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
