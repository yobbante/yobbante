// gp-smart-invite — Envoie un message GP en respectant la fenetre 24h Meta.
// Meta bloque les templates "hello_world" sur les numeros de production
// (erreur #131058). On tente donc directement le texte libre :
//   - si le GP a deja ecrit au 926 dans les 24h -> message envoye via API
//   - sinon -> echec attendu, on bascule sur wa.me et on notifie l'admin
//     en lui rappelant d'envoyer depuis le compte 926 (+221 78 926 97 56).
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPER_ADMIN_PHONE = '+221784604003';
const GP_LINE_DISPLAY = '+221 78 926 97 56';

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

  // --- Auth: service-role bearer required (internal call only) ---
  const __SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const __auth = req.headers.get('authorization') ?? '';
  if (!__SR || __auth !== `Bearer ${__SR}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...(typeof corsHeaders !== 'undefined' ? corsHeaders : {}), 'Content-Type': 'application/json' },
    });
  }
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

  // 1. Verifier historique WhatsApp GP dans les 24 dernieres heures
  let hasHistory = false;
  try {
    const phoneVariants = [phoneDigits, `+${phoneDigits}`, body.phone];
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supa
      .from('whatsapp_inbound_messages')
      .select('id', { count: 'exact', head: true })
      .eq('channel', 'gp')
      .in('from_phone', phoneVariants)
      .gte('received_at', cutoff);
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

  let messageOk = false;
  let blockedReason: string | null = null;

  // 2. Tenter directement le texte libre — seul moyen fiable en production.
  //    Si le GP n'a pas ecrit dans les 24h, Meta refusera (#131047) et on
  //    bascule sur wa.me cote admin.
  if (hasHistory) {
    const main = await callWa({
      recipient_phone: body.phone,
      recipient_type: 'gp',
      message: body.message,
      transporteur_id: body.transporteur_id,
      trigger_type: body.trigger_type ?? 'gp_smart_invite',
    });
    messageOk = main.ok;
    if (!messageOk) {
      blockedReason = main.json?.error?.message ?? main.status ?? 'message_failed';
    }
  } else {
    blockedReason = 'no_inbound_history_24h';
  }

  const overallOk = messageOk;
  const fallbackLink = waLink(body.phone, body.message);

  // Journal : on log toujours une trace cote outbound, meme quand on n'a pas
  // tente l'envoi (fenetre 24h fermee). Cela alimente l'historique GP cote admin
  // avec la cause exacte et le wa.me de secours.
  if (!overallOk) {
    try {
      await supa.from('whatsapp_outbound_messages').insert({
        to_phone: body.phone,
        recipient_type: 'gp',
        message_body: body.message,
        transporteur_id: body.transporteur_id ?? null,
        status: hasHistory ? 'failed' : 'blocked_24h_window',
        error_message: [
          hasHistory
            ? `Meta a refuse l'envoi : ${blockedReason ?? 'inconnu'}`
            : `Hors fenetre 24h Meta (aucun message recu du GP depuis 24h)`,
          `Fallback wa.me : ${fallbackLink}`,
        ].join(' — '),
        trigger_type: `${body.trigger_type ?? 'gp_smart_invite'}::${hasHistory ? 'meta_error' : 'window_closed'}`,
      });
    } catch (e) {
      console.warn('gp-smart-invite log fallback failed', e instanceof Error ? e.message : String(e));
    }
  }

  // 3. Notif super admin (depuis le 607)
  const gpLabel = `${body.gp_name ?? 'GP'}${body.gp_ref ? ` (${body.gp_ref})` : ''}`;
  let adminMsg: string;
  if (overallOk) {
    adminMsg = [
      `GP onboarde via API :`,
      gpLabel,
      `Tel : ${body.phone}`,
    ].join('\n');
  } else {
    adminMsg = [
      `Invitation GP a envoyer manuellement :`,
      `${gpLabel} - ${body.phone}`,
      hasHistory
        ? (blockedReason ? `Cause Meta : ${blockedReason}` : `Echec API`)
        : `Cause : pas d'historique WhatsApp 24h (fenetre Meta fermee)`,
      ``,
      `Ouvrir WhatsApp depuis le compte ${GP_LINE_DISPLAY} (926),`,
      `pas depuis votre numero personnel :`,
      `wa.me/${phoneDigits}`,
    ].join('\n');
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
    has_history: hasHistory,
    message_ok: messageOk,
    wa_link: fallbackLink,
    blocked_reason: blockedReason,
    fallback_required: !overallOk,
    gp_line: GP_LINE_DISPLAY,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
