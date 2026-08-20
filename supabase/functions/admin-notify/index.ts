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
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/push-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          audience: 'admin',
          title: firstLine.slice(0, 60),
          body: body.message.replace(/\n+/g, ' · ').slice(0, 160),
          url: body.dossier_id ? `/admin/dossiers` : '/admin',
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

    const sendRes = await callWa({
      recipient_type: 'admin',
      recipient_phone: phone,
      message: body.message,
      trigger_type: body.notification_type,
    });
    let sendOk = sendRes.ok;
    let waJson: any = null;
    try { waJson = await sendRes.json(); } catch { /* ignore */ }
    const __dbg: Record<string, unknown> = { freeform_status: sendRes.status };

    // 4b) Fenêtre 24h fermée (erreur Meta 131047) → on repasse par un template
    //     autorisé pour rouvrir la conversation avec le super admin.
    const metaCode = waJson?.result?.error?.code ?? waJson?.result?.error?.error_data?.code;
    const waFailed = waJson?.ok === false || (waJson?.status && waJson.status !== 'sent' && !waJson?.skipped);
    const closedWindow = !sendOk || waFailed || metaCode === 131047
      || /24 hours/i.test(JSON.stringify(waJson?.result?.error ?? ''));
    __dbg.closed_window = closedWindow;
    __dbg.wa = JSON.stringify(waJson).slice(0, 300);
    if (closedWindow) {
      try {
        const tplRes = await callWa({
          recipient_type: 'admin',
          recipient_phone: phone,
          template_name: 'admin_window_keepalive',
          template_language: 'fr',
          message: body.message,
          fallback_text: body.message,
          trigger_type: `${body.notification_type}_reopen`,
        });
        sendOk = tplRes.ok;
        const tplTxt = await tplRes.text().catch(() => '');
        __dbg.keepalive_status = tplRes.status;
        __dbg.keepalive_body = tplTxt.slice(0, 300);
        console.log('admin-notify keepalive', tplRes.status, tplTxt.slice(0, 300));
      } catch (e) {
        console.error('admin-notify template fallback failed', e);
      }
    }

    // 4) Record
    await supa.from('admin_notifications_sent').insert({
      dedup_key: dedupKey,
      notification_type: body.notification_type,
      dossier_id: body.dossier_id ?? null,
      phone_sent_to: phone,
    });

    return new Response(JSON.stringify({ ok: sendOk, dedup_key: dedupKey, debug: __dbg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('admin-notify error', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
