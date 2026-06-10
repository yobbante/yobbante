import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const dl = url.searchParams.get('download') === '1';
    if (!id || !/^[0-9A-Za-z_-]{5,100}$/.test(id)) {
      return new Response(JSON.stringify({ error: 'invalid id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = Deno.env.get('WHATSAPP_TOKEN');
    if (!token) {
      return new Response(JSON.stringify({ error: 'missing token' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) {
      return new Response(JSON.stringify({ error: 'meta failed', status: metaRes.status }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const meta = await metaRes.json();
    const mediaUrl: string | undefined = meta?.url;
    const mime: string = meta?.mime_type ?? 'application/octet-stream';
    if (!mediaUrl) {
      return new Response(JSON.stringify({ error: 'no url' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bin = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!bin.ok || !bin.body) {
      return new Response(JSON.stringify({ error: 'fetch failed', status: bin.status }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const headers: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=86400, immutable',
    };
    if (dl) headers['Content-Disposition'] = `attachment; filename="${id}"`;
    return new Response(bin.body, { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
