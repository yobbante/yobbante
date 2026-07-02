import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // --- Auth: staff JWT (or service-role bearer) required ---
  {
    const __SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const __auth = req.headers.get('authorization') ?? '';
    let __ok = !!__SR && __auth === `Bearer ${__SR}`;
    if (!__ok && __auth.toLowerCase().startsWith('bearer ')) {
      try {
        const { createClient: __cc } = await import('https://esm.sh/@supabase/supabase-js@2.45.0');
        const __sb = __cc(Deno.env.get('SUPABASE_URL')!, __SR, {
          global: { headers: { Authorization: __auth } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: { user: __u } } = await __sb.auth.getUser();
        if (__u) {
          const { data: __roles } = await __sb.from('user_roles').select('role').eq('user_id', __u.id);
          __ok = !!(__roles ?? []).find((r: any) => r.role === 'admin' || r.role === 'staff');
        }
      } catch { /* ignore */ }
    }
    if (!__ok) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...(typeof corsHeaders !== 'undefined' ? corsHeaders : {}), 'Content-Type': 'application/json' },
      });
    }
  }

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
