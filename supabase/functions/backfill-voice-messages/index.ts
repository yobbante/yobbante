// backfill-voice-messages
// Pour chaque message audio dont media_url n'est ni une URL http ni un chemin
// de storage, telecharge depuis WhatsApp Cloud API et upload dans le bucket
// voice-messages, puis met a jour media_url avec l'URL publique.
// Note: les media IDs WhatsApp expirent rapidement (~5 jours). Les ID trop
// vieux retourneront une 404 et seront marques en echec.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // --- Auth: service-role bearer OR authenticated user required ---
  const __SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const __auth = req.headers.get('authorization') ?? '';
  {
    let __ok = !!__SR && __auth === `Bearer ${__SR}`;
    if (!__ok && __auth.toLowerCase().startsWith('bearer ')) {
      try {
        const { createClient: __cc } = await import('https://esm.sh/@supabase/supabase-js@2.45.0');
        const __sb = __cc(Deno.env.get('SUPABASE_URL')!, __SR, {
          global: { headers: { Authorization: __auth } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: { user: __u } } = await __sb.auth.getUser();
        __ok = !!__u;
      } catch { /* ignore */ }
    }
    if (!__ok) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...(typeof corsHeaders !== 'undefined' ? corsHeaders : {}), 'Content-Type': 'application/json' },
      });
    }
  }

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  const waToken = Deno.env.get('WHATSAPP_TOKEN');
  if (!waToken) {
    return new Response(JSON.stringify({ ok: false, error: 'WHATSAPP_TOKEN missing' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* ok */ }
  const limit = Math.min(50, Number(body.limit) || 20);

  const { data: rows, error } = await supa
    .from('whatsapp_inbound_messages')
    .select('id, wamid, media_url')
    .eq('message_type', 'audio')
    .not('media_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Garder uniquement les rows dont media_url ressemble a un id WhatsApp brut
  const candidates = (rows ?? []).filter((r: any) =>
    r.media_url && !r.media_url.startsWith('http') && !r.media_url.includes('/') && !r.media_url.includes('.')
  ).slice(0, limit);

  let migrated = 0, failed = 0;
  const errors: string[] = [];

  for (const row of candidates) {
    const mediaId = row.media_url as string;
    try {
      const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
        headers: { Authorization: `Bearer ${waToken}` },
      });
      if (!metaRes.ok) { failed++; errors.push(`${row.id}: meta ${metaRes.status}`); continue; }
      const meta = await metaRes.json();
      const mediaTempUrl = meta?.url;
      const mimeType: string = meta?.mime_type ?? 'audio/ogg';
      if (!mediaTempUrl) { failed++; errors.push(`${row.id}: no url`); continue; }

      const audioRes = await fetch(mediaTempUrl, {
        headers: { Authorization: `Bearer ${waToken}` },
      });
      if (!audioRes.ok) { failed++; errors.push(`${row.id}: dl ${audioRes.status}`); continue; }
      const bytes = new Uint8Array(await audioRes.arrayBuffer());
      const ext = mimeType.includes('mpeg') ? 'mp3' : mimeType.includes('mp4') ? 'm4a' : 'ogg';
      const path = `${row.wamid ?? mediaId}.${ext}`;

      const { error: upErr } = await supa.storage
        .from('voice-messages')
        .upload(path, bytes, { contentType: mimeType, upsert: true });
      if (upErr) { failed++; errors.push(`${row.id}: upload ${upErr.message}`); continue; }

      const { data: pub } = supa.storage.from('voice-messages').getPublicUrl(path);
      const publicUrl = pub?.publicUrl ?? path;

      await supa.from('whatsapp_inbound_messages')
        .update({ media_url: publicUrl })
        .eq('id', row.id);
      migrated++;
    } catch (e) {
      failed++;
      errors.push(`${row.id}: ${(e as Error).message}`);
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    scanned: candidates.length,
    migrated,
    failed,
    errors: errors.slice(0, 20),
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
