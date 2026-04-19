import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = claims.claims.sub;

    // Staff only
    const { data: isStaffRes } = await supabase.rpc('is_staff', { _user_id: userId });
    if (!isStaffRes) return json({ error: 'Forbidden — staff only' }, 403);

    const body = await req.json().catch(() => ({}));
    const dossierId = body?.dossier_id;
    if (!dossierId || typeof dossierId !== 'string') {
      return json({ error: 'dossier_id required' }, 400);
    }

    // Service-role client to bypass RLS for the update
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: dossier, error: dErr } = await admin
      .from('dossiers')
      .select('*')
      .eq('id', dossierId)
      .single();
    if (dErr || !dossier) return json({ error: 'Dossier not found' }, 404);

    const KONNEKT_BASE_URL = Deno.env.get('KONNEKT_BASE_URL');
    const KONNEKT_API_KEY = Deno.env.get('KONNEKT_API_KEY');
    if (!KONNEKT_BASE_URL || !KONNEKT_API_KEY) {
      return json({ error: 'Konnekt integration not configured' }, 500);
    }

    // Normalize: accept base URL with or without /functions/v1, with or without trailing /external-create-order
    let baseUrl = KONNEKT_BASE_URL.trim().replace(/\/+$/, '');
    if (baseUrl.endsWith('/external-create-order')) {
      baseUrl = baseUrl.slice(0, -'/external-create-order'.length);
    }
    if (!/\/functions\/v\d+$/.test(baseUrl)) {
      baseUrl = `${baseUrl}/functions/v1`;
    }
    const endpoint = `${baseUrl}/external-create-order`;
    console.log('Konnekt endpoint resolved to:', endpoint);

    // Map Yobbanté dossier → Konnekt order schema
    const payload = {
      external_reference: dossier.reference,
      app_source: 'yobbante',
      origin_city: dossier.origin_country,
      origin_country: dossier.origin_country,
      destination_city: dossier.destination_country,
      destination_country: 'SN',
      weight: dossier.estimated_weight ?? 0,
      total_price: dossier.budget_eur ?? 0,
      currency: 'EUR',
      description: dossier.product_description,
      recipient_phone: dossier.contact_phone,
      metadata: {
        needs_sourcing: dossier.needs_sourcing,
        contact_email: dossier.contact_email,
        notes: dossier.notes,
        budget_eur: dossier.budget_eur,
      },
    };

    const konnektRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KONNEKT_API_KEY}`,
        'X-Yobbante-Api-Key': KONNEKT_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const konnektBody = await konnektRes.text();
    let konnektJson: Record<string, unknown> = {};
    try { konnektJson = JSON.parse(konnektBody); } catch { /* ignore */ }

    if (!konnektRes.ok) {
      console.error('Konnekt push failed', konnektRes.status, konnektBody);
      return json({
        error: 'Konnekt rejected the order',
        status: konnektRes.status,
        details: konnektJson || konnektBody,
      }, 502);
    }

    const konnektOrderId =
      (konnektJson.order_id as string | undefined) ||
      (konnektJson.id as string | undefined) ||
      (konnektJson.konnekt_order_id as string | undefined) ||
      null;

    const { error: upErr } = await admin
      .from('dossiers')
      .update({
        konnekt_order_id: konnektOrderId,
        konnekt_synced_at: new Date().toISOString(),
      })
      .eq('id', dossierId);
    if (upErr) console.error('Failed to persist konnekt_order_id', upErr);

    await admin.from('timeline_events').insert({
      user_id: dossier.user_id,
      event_type: 'KONNEKT_PUSHED',
      title: 'Dossier transmis à Konnekt',
      description: konnektOrderId ? `Konnekt order #${konnektOrderId}` : 'Synchronisation réussie',
      metadata: { konnekt_order_id: konnektOrderId, dossier_id: dossierId },
    });

    return json({ success: true, konnekt_order_id: konnektOrderId, konnekt: konnektJson });
  } catch (e) {
    console.error('push-to-konnekt error', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
