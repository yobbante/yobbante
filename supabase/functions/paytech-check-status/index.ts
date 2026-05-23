// paytech-check-status — Admin: refresh transaction status from PayTech
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const API_KEY = Deno.env.get('PAYTECH_API_KEY');
  const API_SECRET = Deno.env.get('PAYTECH_API_SECRET');
  if (!API_KEY || !API_SECRET) {
    return new Response(JSON.stringify({ available: false }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { tracking_id?: string; ref_command?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  let refCommand = body.ref_command ?? '';
  if (!refCommand && body.tracking_id) {
    const { data: d } = await supa
      .from('dossiers')
      .select('payment_external_id')
      .or(`tracking_id.eq.${body.tracking_id},reference.eq.${body.tracking_id}`)
      .maybeSingle();
    refCommand = d?.payment_external_id ?? '';
  }

  if (!refCommand) {
    return new Response(JSON.stringify({ error: 'no_ref_command' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const res = await fetch(`https://paytech.sn/api/payment/get/${encodeURIComponent(refCommand)}`, {
      method: 'GET',
      headers: { API_KEY, API_SECRET },
    });
    const data = await res.json().catch(() => ({}));
    return new Response(JSON.stringify({ ok: res.ok, data }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'paytech_status_error', message: (e as Error).message }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
