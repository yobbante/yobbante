// notify-partner-pickup
// Envoie un WhatsApp au client quand son dossier arrive au hub
// et que le mode de réception choisi est "partner_pickup".
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // --- Auth: service-role bearer required (internal call only) ---
  const __SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const __auth = req.headers.get('authorization') ?? '';
  if (!__SR || __auth !== `Bearer ${__SR}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...(typeof corsHeaders !== 'undefined' ? corsHeaders : {}), 'Content-Type': 'application/json' },
    });
  }

  try {
    const { dossier_id } = await req.json();
    if (!dossier_id) {
      return new Response(JSON.stringify({ error: 'dossier_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: dossier, error: dErr } = await admin
      .from('dossiers')
      .select('id, tracking_id, reference, status, delivery_mode, destination_country, user_id, recipient_name, recipient_phone')
      .eq('id', dossier_id)
      .maybeSingle();

    if (dErr || !dossier) {
      return new Response(JSON.stringify({ error: 'dossier_not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (dossier.delivery_mode !== 'partner_pickup') {
      return new Response(JSON.stringify({ skipped: 'not_partner_pickup' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Profil client (téléphone + prénom)
    let firstName = '';
    let phone = dossier.recipient_phone ?? '';
    if (dossier.user_id) {
      const { data: profile } = await admin
        .from('profiles')
        .select('full_name, phone')
        .eq('user_id', dossier.user_id)
        .maybeSingle();
      if (profile) {
        firstName = (profile.full_name ?? '').split(' ')[0] || firstName;
        if (!phone) phone = profile.phone ?? '';
      }
    }
    if (!firstName && dossier.recipient_name) firstName = dossier.recipient_name.split(' ')[0];

    if (!phone) {
      return new Response(JSON.stringify({ skipped: 'no_phone' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Partenaire de livraison pour ce pays
    const country = (dossier.destination_country || '').toUpperCase();
    const { data: partner } = await admin
      .from('delivery_partners')
      .select('name, address, phone, opening_hours')
      .eq('is_active', true)
      .ilike('destination_country', country)
      .maybeSingle();

    if (!partner) {
      return new Response(JSON.stringify({ skipped: 'no_partner', country }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tracking = dossier.tracking_id || dossier.reference || '';
    const hours = partner.opening_hours || 'Sur rendez-vous';

    const message =
`Bonjour ${firstName || 'cher client'},

Votre colis ${tracking} est arrive a destination.

Pour le recuperer :
${partner.name}
${partner.address}
Contact : ${partner.phone}
Horaires : ${hours}

Munissez-vous de votre tracking ID : ${tracking}

Questions : +221786078080`;

    // Appel send-whatsapp (depuis le 607 = client)
    const waUrl = `${supabaseUrl}/functions/v1/send-whatsapp`;
    const waRes = await fetch(waUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        recipient_phone: phone,
        recipient_type: 'client',
        message,
        dossier_id,
        trigger_type: 'partner_pickup_arrived_hub',
      }),
    });

    const waBody = await waRes.text();

    return new Response(JSON.stringify({ ok: waRes.ok, wa_status: waRes.status, wa_body: waBody }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
