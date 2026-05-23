// intech-cashout — STUB pour future intégration Intech CashOut V2
// Pour payer les GP via Wave (WAVE_SN_API_CASH_OUT) ou Orange Money (ORANGE_SN_API_CASH_OUT).
//
// Activation future :
// 1) Ajouter le secret INTECH_API_KEY
// 2) Implémenter l'appel POST vers Intech V2 :
//    POST https://api.intech.sn/api-services/operation
//    Headers : Authorization: Bearer {INTECH_API_KEY}, Content-Type: application/json
//    Body : {
//      "phoneNumber": "+221XXXXXXXXX",
//      "amount": 50000,
//      "codeService": "WAVE_SN_API_CASH_OUT" | "ORANGE_SN_API_CASH_OUT",
//      "externalTransactionId": "YOB-GP-PAY-{gp_ref}-{timestamp}",
//      "callbackUrl": "{SUPABASE_URL}/functions/v1/intech-cashout-webhook"
//    }
// 3) Persister dans une table gp_payouts avec status pending/paid/failed
// 4) Logger sur whatsapp_outbound_messages comme les autres flux

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const hasKey = !!Deno.env.get('INTECH_API_KEY');

  return new Response(JSON.stringify({
    available: false,
    enabled: hasKey,
    message: 'Intech CashOut sera activé prochainement pour payer les GP via Wave / Orange Money.',
  }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
