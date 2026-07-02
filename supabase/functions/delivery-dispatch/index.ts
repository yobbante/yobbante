// delivery-dispatch — Routage initial du colis arrive au hub final (ARRIVED_HUB)
// Envoie la bonne notification selon delivery_mode (pickup_gp | relay_point | home_delivery)
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_PHONE = '+221784604003';

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

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  let body: { dossier_id?: string } = {};
  try { body = await req.json(); } catch {}
  const dossierId = body.dossier_id;
  if (!dossierId) {
    return new Response(JSON.stringify({ error: 'dossier_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  async function sendWa(payload: Record<string, unknown>) {
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (e) { console.error('sendWa', e); }
  }

  const { data: d, error } = await supa
    .from('dossiers')
    .select('id, tracking_id, reference, status, delivery_mode, delivery_notified_at, sender_name, sender_phone, recipient_name, recipient_phone, contact_phone, relay_point_name, relay_point_address, delivery_carrier, assigned_transporteur_ref')
    .eq('id', dossierId)
    .maybeSingle();

  if (error || !d) {
    return new Response(JSON.stringify({ error: 'dossier_not_found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (d.delivery_notified_at) {
    return new Response(JSON.stringify({ ok: true, skipped: 'already_notified' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const clientPhone = d.recipient_phone || d.contact_phone || null;
  const tracking = d.tracking_id || d.reference;
  const mode = (d.delivery_mode || 'pickup_gp') as 'pickup_gp' | 'relay_point' | 'home_delivery';

  // Charger GP si dispo
  let gpName = '', gpPhone = '', gpAdresseRemise = '';
  if (d.assigned_transporteur_ref) {
    const { data: gp } = await supa
      .from('transporteurs')
      .select('id, prenom, nom, telephone_1, adresses_remise')
      .eq('reference', d.assigned_transporteur_ref)
      .maybeSingle();
    if (gp) {
      gpName = `${gp.prenom ?? ''} ${gp.nom ?? ''}`.trim();
      gpPhone = gp.telephone_1 ?? '';
      try {
        const remises = gp.adresses_remise as any;
        if (Array.isArray(remises) && remises.length > 0) {
          gpAdresseRemise = String(remises[0]?.adresse ?? remises[0] ?? '');
        }
      } catch {}
    }
  }

  if (mode === 'pickup_gp' && clientPhone) {
    const msg = `Bonjour, votre colis ${tracking} est arrive a Dakar.

Contactez notre partenaire pour le recuperer :
${gpName || 'GP Yobbante'}${gpPhone ? ` - ${gpPhone}` : ''}
${gpAdresseRemise ? `Adresse : ${gpAdresseRemise}` : ''}

Merci de retirer sous 48h.`;
    await sendWa({ recipient_type: 'client', recipient_phone: clientPhone, message: msg, dossier_id: d.id, trigger_type: 'delivery_pickup_gp' });
  }

  if (mode === 'relay_point') {
    // 1) Avertir le GP (bot 926)
    if (gpPhone) {
      const gpMsg = `Bonjour ${gpName.split(' ')[0] || ''}.

Livrez le colis ${tracking} au point relais :
${d.relay_point_name || ''}
${d.relay_point_address || ''}

Confirmez avec : DEPOSE ${tracking}`;
      await sendWa({ recipient_type: 'gp', recipient_phone: gpPhone, message: gpMsg, dossier_id: d.id, trigger_type: 'delivery_relay_gp' });
    }
    // 2) Avertir le client
    if (clientPhone) {
      const cMsg = `Bonjour, votre colis ${tracking} arrive au point relais :
${d.relay_point_name || ''}
${d.relay_point_address || ''}

Recuperez-le sous 5 jours.`;
      await sendWa({ recipient_type: 'client', recipient_phone: clientPhone, message: cMsg, dossier_id: d.id, trigger_type: 'delivery_relay_client' });
    }
  }

  if (mode === 'home_delivery') {
    if (clientPhone) {
      const carrier = d.delivery_carrier || 'notre livreur';
      const cMsg = `Bonjour, votre colis ${tracking} est arrive a Dakar.

Livraison a domicile via ${carrier}. Vous serez contacte pour le rendez-vous.`;
      await sendWa({ recipient_type: 'client', recipient_phone: clientPhone, message: cMsg, dossier_id: d.id, trigger_type: 'delivery_home_client' });
    }
    await sendWa({
      recipient_type: 'admin', recipient_phone: ADMIN_PHONE,
      message: `Livraison domicile a organiser pour ${tracking} (${d.delivery_carrier || 'Yobbante'}).`,
      dossier_id: d.id, trigger_type: 'delivery_home_admin_alert',
    });
  }

  await supa.from('dossiers').update({
    delivery_notified_at: new Date().toISOString(),
  }).eq('id', d.id);

  await supa.from('dossier_events').insert({
    dossier_id: d.id,
    event_type: 'delivery_dispatch_sent',
    event_data: { mode, client_phone: clientPhone, gp_phone: gpPhone || null },
    visible_to_client: false,
  });

  return new Response(JSON.stringify({ ok: true, mode }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
