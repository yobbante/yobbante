// create-wave-payment — initialise une session de paiement Wave
// Secrets requis (à ajouter quand disponibles) :
//   WAVE_API_KEY        → clé API Wave Business
//   WAVE_WEBHOOK_SECRET → secret pour vérifier les webhooks Wave
// Tant que WAVE_API_KEY est absent, la fonction retourne { available: false }
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

    const apiKey = Deno.env.get('WAVE_API_KEY');
    if (!apiKey) {
      return json({ available: false, reason: 'wave_not_configured' }, 200);
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
    const wave = await fetch('https://api.wave.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(amount),
        currency: 'XOF',
        error_url: `${SITE}/pay/${ref}?error=1`,
        success_url: `${SITE}/pay/${ref}?success=1`,
        client_reference: ref,
      }),
    });

    const data = await wave.json().catch(() => ({}));
    if (!wave.ok) {
      console.error('WAVE_API_ERROR', wave.status, data);
      return json({ error: 'Wave API error', details: data }, 502);
    }

    return json({ available: true, url: data.wave_launch_url || data.url, session_id: data.id });
  } catch (e) {
    console.error('create-wave-payment fatal', e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
