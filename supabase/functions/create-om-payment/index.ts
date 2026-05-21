// create-om-payment — initialise une session de paiement Orange Money Web Payment
// Secrets requis (à ajouter quand disponibles) :
//   OM_ACCESS_TOKEN  → token Orange Money (OAuth)
//   OM_MERCHANT_KEY  → clé marchand Orange Money
// Tant que OM_ACCESS_TOKEN est absent, la fonction retourne { available: false }
// et la page /pay affiche un message "bientôt disponible".
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SITE = 'https://yobbante.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { tracking_id } = await req.json().catch(() => ({}));
    if (!tracking_id || typeof tracking_id !== 'string') {
      return json({ error: 'tracking_id requis' }, 400);
    }

    const token = Deno.env.get('OM_ACCESS_TOKEN');
    const merchantKey = Deno.env.get('OM_MERCHANT_KEY');
    if (!token || !merchantKey) {
      return json({ available: false, reason: 'om_not_configured' }, 200);
    }

    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const { data: dossier, error } = await supa
      .from('dossiers')
      .select('id, tracking_id, reference, payment_status, final_amount_xof, estimated_cost')
      .or(`tracking_id.eq.${tracking_id},reference.eq.${tracking_id}`)
      .maybeSingle();

    if (error || !dossier) return json({ error: 'Dossier introuvable' }, 404);
    if (dossier.payment_status === 'paid') return json({ error: 'Déjà payé' }, 409);

    const amount = dossier.final_amount_xof
      ?? (dossier.estimated_cost ? Math.round(Number(dossier.estimated_cost) * 655.957) : null);
    if (!amount || amount <= 0) return json({ error: 'Montant invalide' }, 400);

    const ref = dossier.tracking_id || dossier.reference;
    const om = await fetch(
      'https://api.orange.com/orange-money-webpay/dev/v1/webpayment',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchant_key: merchantKey,
          currency: 'XOF',
          order_id: ref,
          amount,
          return_url: `${SITE}/pay/${ref}?success=1`,
          cancel_url: `${SITE}/pay/${ref}?error=1`,
          notif_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-orange-money`,
          lang: 'fr',
          reference: ref,
        }),
      },
    );

    const data = await om.json().catch(() => ({}));
    if (!om.ok) {
      console.error('OM_API_ERROR', om.status, data);
      return json({ error: 'Orange Money API error', details: data }, 502);
    }

    return json({
      available: true,
      url: data.payment_url,
      pay_token: data.pay_token,
      notif_token: data.notif_token,
    });
  } catch (e) {
    console.error('create-om-payment fatal', e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
