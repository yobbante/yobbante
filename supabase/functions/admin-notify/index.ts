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

    // 3) Send via send-whatsapp (607 → admin)
    const sendRes = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          recipient_type: 'admin',
          recipient_phone: phone,
          message: body.message,
          trigger_type: body.notification_type,
        }),
      },
    );
    const sendOk = sendRes.ok;

    // 4) Record
    await supa.from('admin_notifications_sent').insert({
      dedup_key: dedupKey,
      notification_type: body.notification_type,
      dossier_id: body.dossier_id ?? null,
      phone_sent_to: phone,
    });

    return new Response(JSON.stringify({ ok: sendOk, dedup_key: dedupKey }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('admin-notify error', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
