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

  // --- Auth: service-role bearer required (internal call only) ---
  const __SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const __auth = req.headers.get('authorization') ?? '';
  if (!__SR || __auth !== `Bearer ${__SR}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...(typeof corsHeaders !== 'undefined' ? corsHeaders : {}), 'Content-Type': 'application/json' },
    });
  }

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  try {
    // Pull all pending notifications
    const { data: pending, error } = await supa
      .from('admin_notifications')
      .select('id, event_type, message, created_at, dossier_id, payload')
      .is('notified_at', null)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;
    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch tracking_ids for dossier-linked notifications
    const dossierIds = Array.from(new Set(pending.map((p: any) => p.dossier_id).filter(Boolean)));
    const trackingMap = new Map<string, string>();
    if (dossierIds.length) {
      const { data: ds } = await supa.from('dossiers')
        .select('id, tracking_id, reference').in('id', dossierIds);
      for (const d of (ds ?? []) as any[]) {
        trackingMap.set(d.id, d.tracking_id || d.reference || '');
      }
    }

    function actionHintFor(p: any): string | null {
      const tid = p.dossier_id ? trackingMap.get(p.dossier_id) : null;
      const t = p.event_type || '';
      if (t === 'new_dossier' || t === 'dossier_created') {
        return tid ? `Actions :\nASSIGNE ${tid} GP0001\nMSG ${tid} votre message` : null;
      }
      if (t === 'payment_received' || (t === 'dossier_status_changed' && (p.payload?.to === 'WEIGHED'))) {
        return tid ? `Actions :\nTRANSIT ${tid}\nMSG ${tid} message` : null;
      }
      if (t === 'gp_departure_declared' || t === 'new_departure') {
        const sr = p.payload?.short_ref;
        return sr ? `Actions :\nVALIDE ${sr}\nDEPART ${sr}` : null;
      }
      if (t === 'dossier_status_changed' && tid) {
        return `Action : DOSSIER ${tid}`;
      }
      return null;
    }

    // Build message
    let messageText: string;
    if (pending.length === 1) {
      const p = pending[0] as any;
      const hint = actionHintFor(p);
      messageText = hint ? `${p.message}\n\n${hint}` : p.message;
    } else {
      const summaries = pending.map((p: any) => {
        const firstLine = (p.message || '').split('\n')[0];
        return `- ${firstLine}`;
      }).join('\n');
      messageText = `${pending.length} evenements recents :\n${summaries}\n\nTapez STATUS pour le resume.`;
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
