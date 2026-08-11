// Liste les templates WhatsApp approuvés (nom, statut, variables) — usage admin/debug.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });


  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? Deno.env.get('WHATSAPP_TOKEN') ?? '';
  const phoneId = Deno.env.get('WHATSAPP_CLIENT_PHONE_ID')
    ?? Deno.env.get('WHATSAPP_PHONE_ID_CLIENTS')
    ?? Deno.env.get('WHATSAPP_PHONE_ID') ?? '';
  let wabaId = Deno.env.get('WHATSAPP_WABA_ID') ?? Deno.env.get('WHATSAPP_BUSINESS_ACCOUNT_ID') ?? '';
  if (!wabaId && phoneId) {
    const r = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}?fields=id,display_phone_number,whatsapp_business_account`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const j = await r.json();
    wabaId = j?.whatsapp_business_account?.id ?? '';
    if (!wabaId) {
      return new Response(JSON.stringify({ step: 'phone_lookup', phoneId, result: j }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
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
