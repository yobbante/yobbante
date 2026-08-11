// Liste les templates WhatsApp approuvés (nom, statut, variables) — usage admin/debug.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const auth = req.headers.get('authorization') ?? '';
  if (!SR || auth !== `Bearer ${SR}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? Deno.env.get('WHATSAPP_TOKEN') ?? '';
  const wabaId = Deno.env.get('WHATSAPP_WABA_ID') ?? Deno.env.get('WHATSAPP_BUSINESS_ACCOUNT_ID') ?? '';
  if (!token || !wabaId) {
    return new Response(JSON.stringify({ error: 'missing_config', has_token: !!token, has_waba: !!wabaId }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${wabaId}/message_templates?limit=200&fields=name,status,language,components`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const json = await res.json();
  return new Response(JSON.stringify(json), {
    status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
