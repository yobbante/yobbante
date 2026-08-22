// admin-notify — Central dispatcher for super-admin notifications.
// Applies dedup + suspend-while-window-open + sends from 607 to +221784604003.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_PHONE = '+221784604003';

type Body = {
  notification_type: string;
  message: string;
  dedup_key?: string;
  dossier_id?: string | null;
  window_minutes?: number;
  bypass_suspend?: boolean;
  recipient_phone?: string;
  /** Rendu propre de la notification push (sinon derive du message). */
  push_title?: string;
  push_body?: string;
  push_url?: string;
};


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // --- Auth: service-role bearer OR internal token (DB triggers) ---
  const __SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const __auth = req.headers.get('authorization') ?? '';
  const __tok = Deno.env.get('INTERNAL_NOTIFY_TOKEN') ?? '';
  const __hdrTok = req.headers.get('x-internal-token') ?? '';
  const authorized = (!!__SR && __auth === `Bearer ${__SR}`) || (!!__tok && __hdrTok === __tok);
  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...(typeof corsHeaders !== 'undefined' ? corsHeaders : {}), 'Content-Type': 'application/json' },
    });
  }

  let body: Body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!body?.notification_type || !body?.message) {
    return new Response(JSON.stringify({ error: 'missing_fields' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const phone = body.recipient_phone || ADMIN_PHONE;
  const windowMin = Math.max(1, Number(body.window_minutes) || 240); // default 4h
  const dedupKey = body.dedup_key
    || `${body.notification_type}:${body.dossier_id || 'global'}`;

  try {
    // 1) Dedup
    const since = new Date(Date.now() - windowMin * 60 * 1000).toISOString();
    const { data: prior } = await supa
      .from('admin_notifications_sent')
      .select('id, sent_at')
      .eq('dedup_key', dedupKey)
      .gte('sent_at', since)
      .limit(1);
    if (prior && prior.length > 0) {
      return new Response(JSON.stringify({ ok: true, skipped: 'dedup' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Suspend if admin recently replied (window open last 2h)
    if (!body.bypass_suspend) {
      const adminTail = ADMIN_PHONE.replace(/\D/g, '').slice(-9);
      const since2h = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
      const { count } = await supa.from('whatsapp_inbound_messages')
        .select('id', { count: 'exact', head: true })
        .gte('received_at', since2h)
        .ilike('from_phone', `%${adminTail}%`);
      if ((count ?? 0) > 0 && /low|info/i.test(body.notification_type)) {
        // Soft-suspend only low-priority types
        return new Response(JSON.stringify({ ok: true, skipped: 'suspend_active_window' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 3) Push Web (VAPID) — arrive même téléphone verrouillé / app fermée.
    //    Envoyé systématiquement, indépendamment du sort du WhatsApp.
    const firstLine = body.message.split('\n').find((l) => l.trim()) ?? 'Yobbanté';
    const pushTitle = (body.push_title?.trim() || firstLine).slice(0, 60);
    const pushBody = (body.push_body?.trim()
      || body.message.split('\n').slice(1).join(' ').trim()
      || body.message.replace(/\n+/g, ' · ')).slice(0, 140);
    const pushUrl = body.push_url || (body.dossier_id ? '/admin/dossiers' : '/admin');
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/push-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          audience: 'admin',
          title: pushTitle,
          body: pushBody,
          url: pushUrl,
          tag: dedupKey,
        }),
      });

    } catch (e) {
      console.error('admin-notify push failed', e);
    }

    // 4) Send via send-whatsapp (607 → admin)
    const callWa = (payload: Record<string, unknown>) =>
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify(payload),
      });

    // 4a) Fenêtre 24h WhatsApp : Meta accepte l'appel API (wamid) puis échoue en
    //     livraison (131047) si l'admin n'a pas écrit depuis 24h. On vérifie donc
    //     la fenêtre AVANT d'envoyer, et on part directement en template sinon.
    const adminTail24 = phone.replace(/\D/g, '').slice(-9);
    const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: inboundCount } = await supa.from('whatsapp_inbound_messages')
      .select('id', { count: 'exact', head: true })
      .gte('received_at', since24h)
      .ilike('from_phone', `%${adminTail24}%`);
    const windowOpen = (inboundCount ?? 0) > 0;


    let sendOk = false;
    if (windowOpen) {
      const sendRes = await callWa({
        recipient_type: 'admin',
        recipient_phone: phone,
        message: body.message,
        trigger_type: body.notification_type,
      });
      sendOk = sendRes.ok;
      console.log('admin-notify freeform', { status: sendRes.status, type: body.notification_type });

    } else {
      // Hors fenêtre : seul un template approuvé est délivrable.
      const tplRes = await callWa({
        recipient_type: 'admin',
        recipient_phone: phone,
        template_name: 'admin_window_keepalive',
        template_language: 'fr',
        message: body.message,
        fallback_text: body.message,
        trigger_type: `${body.notification_type}_template`,
      });
      sendOk = tplRes.ok;
      console.log('admin-notify template', { status: tplRes.status, type: body.notification_type });
    }


    // 4) Record
    await supa.from('admin_notifications_sent').insert({
      dedup_key: dedupKey,
      notification_type: body.notification_type,
      dossier_id: body.dossier_id ?? null,
      phone_sent_to: phone,
    });

    return new Response(JSON.stringify({ ok: sendOk, dedup_key: dedupKey, window_open: windowOpen }), {

      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('admin-notify error', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
