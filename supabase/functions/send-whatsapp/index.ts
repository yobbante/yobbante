import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const body = await req.json();
    console.log('WA_TRIGGER received:', JSON.stringify(body));
    const token = Deno.env.get('WHATSAPP_TOKEN');
    const phoneId = Deno.env.get('WHATSAPP_PHONE_ID');
    if (!token || !phoneId) {
      console.error('WA_ERROR: Missing env vars');
      return new Response(JSON.stringify({ error: 'Missing config' }), {
        status: 500, headers: corsHeaders
      });
    }
    const recipient = (body.recipient_phone || '').replace(/\D/g, '');
    const message = `🚀 Nouvelle demande Yobbanté\n\nClient : ${body.client_name || 'N/A'}\nService : ${body.service_type || 'N/A'}\nDe : ${body.origin || 'N/A'}\nVers : ${body.destination || 'N/A'}\nPoids : ${body.weight || 'N/A'}kg\n\nVoir le dossier → https://yobbante.com/admin`;
    console.log('WA_SENDING to:', recipient);
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'text',
          text: { body: message },
        }),
      }
    );
    const result = await res.json();
    console.log('WA_RESULT:', JSON.stringify(result));
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: res.ok ? 200 : 400,
    });
  } catch (err) {
    console.error('WA_FUNCTION_ERROR:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders
    });
  }
});
