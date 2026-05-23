// gp-smart-invite — Envoie une invitation/onboarding GP en respectant la fenetre 24h Meta.
// Si le GP n'a jamais ecrit, ouvre la conversation avec le template hello_world,
// puis envoie le message libre. Notifie systematiquement le super admin.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPER_ADMIN_PHONE = '+221784604003';

type InviteKind = 'bot_onboard' | 'konnekt_invite' | 'konnekt_signup';

interface Payload {
  phone: string;
  message: string;
  gp_name?: string;
  gp_ref?: string;
  transporteur_id?: string;
  kind?: InviteKind;
  trigger_type?: string;
}

function normalize(p: string): string {
  return (p || '').toString().replace(/\D/g, '');
}

function waLink(phone: string, message: string): string {
  return `https://wa.me/${normalize(phone)}?text=${encodeURIComponent(message)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: Payload;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const phoneDigits = normalize(body.phone);
  if (!phoneDigits || phoneDigits.length < 6) {
    return new Response(JSON.stringify({ error: 'phone invalid' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!body.message || body.message.length < 5) {
    return new Response(JSON.stringify({ error: 'message required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supaUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supa = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // 1. Verifier historique WhatsApp GP
  let hasHistory = false;
  try {
    const phoneVariants = [
      phoneDigits,
      `+${phoneDigits}`,
      body.phone,
    ];
    const { count } = await supa
      .from('whatsapp_inbound_messages')
      .select('id', { count: 'exact', head: true })
      .eq('channel', 'gp')
      .in('from_phone', phoneVariants);
    hasHistory = (count ?? 0) > 0;
  } catch (e) {
    console.warn('gp-smart-invite history check failed', e instanceof Error ? e.message : String(e));
  }

  const callWa = async (payload: Record<string, unknown>) => {
    try {
      const r = await fetch(`${supaUrl}/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify(payload),
      });
      const json = await r.json().catch(() => ({}));
      return { ok: r.ok && json?.status === 'sent', status: json?.status, json };
    } catch (e) {
      return { ok: false, status: 'failed', json: { error: e instanceof Error ? e.message : String(e) } };
    }
  };

  let mode: 'free_text' | 'template_then_text' = hasHistory ? 'free_text' : 'template_then_text';
  let templateOk = true;
  let messageOk = false;
  let blockedReason: string | null = null;

  // 2. Premier contact si pas d'historique
  if (!hasHistory) {
    const tpl = await callWa({
      recipient_phone: body.phone,
      recipient_type: 'gp',
      template_name: 'hello_world',
      template_language: 'en_US',
      transporteur_id: body.transporteur_id,
      trigger_type: `${body.trigger_type ?? 'gp_smart_invite'}::open_window`,
    });
    templateOk = tpl.ok;
    if (!templateOk) {
      blockedReason = tpl.json?.error?.message ?? tpl.status ?? 'template_failed';
      console.warn('gp-smart-invite hello_world failed', tpl.status);
    } else {
      // Laisser Meta enregistrer la conversation avant le 2eme envoi
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // 3. Envoyer le message principal
  if (hasHistory || templateOk) {
    const main = await callWa({
      recipient_phone: body.phone,
      recipient_type: 'gp',
      message: body.message,
      transporteur_id: body.transporteur_id,
      trigger_type: body.trigger_type ?? 'gp_smart_invite',
    });
    messageOk = main.ok;
    if (!messageOk && !blockedReason) {
      blockedReason = main.json?.error?.message ?? main.status ?? 'message_failed';
    }
  }

  const overallOk = messageOk;
  const fallbackLink = waLink(body.phone, body.message);

  // 4. Notif super admin
  const gpLabel = `${body.gp_name ?? 'GP'}${body.gp_ref ? ` (${body.gp_ref})` : ''}`;
  let adminMsg: string;
  if (overallOk) {
    adminMsg = [
      `GP onboarde via API :`,
      gpLabel,
      `Tel : ${body.phone}`,
      `Statut bot : ${hasHistory ? 'Relance' : 'Premier contact'}`,
    ].join('\n');
  } else {
    adminMsg = [
      `Invitation GP echouee (hors fenetre) :`,
      `${gpLabel} - ${body.phone}`,
      blockedReason ? `Cause Meta : ${blockedReason}` : null,
      `Action requise : envoyer manuellement`,
      `wa.me/${phoneDigits}`,
    ].filter(Boolean).join('\n');
  }
  await callWa({
    recipient_phone: SUPER_ADMIN_PHONE,
    recipient_type: 'admin',
    message: adminMsg,
    client_name: gpLabel,
    trigger_type: `gp_smart_invite_admin::${overallOk ? 'ok' : 'fail'}`,
  });

  return new Response(JSON.stringify({
    ok: overallOk,
    mode,
    template_ok: templateOk,
    message_ok: messageOk,
    has_history: hasHistory,
    wa_link: fallbackLink,
    blocked_reason: blockedReason,
    fallback_required: !overallOk,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
