// notify-admin-flush — agrège les notifications admin en attente et envoie 1 WhatsApp groupé.
// Tourne en cron (par ex. toutes les minutes). Regroupe par fenêtres de 5 minutes max.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_PHONE = '+221784604003';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  try {
    // Pull all pending notifications
    const { data: pending, error } = await supa
      .from('admin_notifications')
      .select('id, event_type, message, created_at')
      .is('notified_at', null)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;
    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build message
    let messageText: string;
    if (pending.length === 1) {
      messageText = pending[0].message;
    } else {
      const summaries = pending.map((p) => {
        const firstLine = (p.message || '').split('\n')[0];
        return `- ${firstLine}`;
      }).join('\n');
      messageText = `${pending.length} evenements recents :\n${summaries}`;
    }

    // Send via send-whatsapp
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          recipient_type: 'admin',
          recipient_phone: ADMIN_PHONE,
          message: messageText,
          trigger_type: 'admin_notification',
        }),
      });
    } catch (e) {
      console.error('send-whatsapp failed', e);
      // continue: do NOT mark as sent so we retry next run
      return new Response(JSON.stringify({ ok: false, error: String(e) }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark all as notified
    const ids = pending.map((p) => p.id);
    await supa
      .from('admin_notifications')
      .update({ notified_at: new Date().toISOString() })
      .in('id', ids);

    return new Response(JSON.stringify({ ok: true, sent: ids.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('notify-admin-flush error', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
