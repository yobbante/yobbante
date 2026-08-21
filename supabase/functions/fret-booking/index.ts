// Réservation publique fret routier "Terminal D".
// Crée (1) un devis et (2) une course fret en attente d'enlèvement,
// directement visible dans l'admin Équipe terrain → Fret routier.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface Body {
  scope?: 'national' | 'international';
  destination?: string;
  colis_size?: string | null;
  weight_kg?: number | null;
  base_fcfa?: number;
  pickup_fee_fcfa?: number;
  total_fcfa?: number;
  pickup_address?: string;
  pickup_zone?: string;
  expediteur_nom?: string;
  expediteur_phone?: string;
  client_nom?: string;
  client_phone?: string;
  zone_label?: string;
}

/** Sync d'un dossier admin vers le fret routier Terminal D (staff only). */
async function handleDossierSync(req: Request, dossierId: string, action: 'attach' | 'detach') {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // Vérification staff via le JWT de l'appelant
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
  const { data: userData } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
  const uid = userData?.user?.id;
  if (!uid) return json({ error: 'unauthorized' }, 401);
  const { data: isStaff } = await admin.rpc('is_staff', { _user_id: uid });
  if (!isStaff) return json({ error: 'forbidden' }, 403);

  const { data: d } = await admin.from('dossiers').select('*').eq('id', dossierId).maybeSingle();
  if (!d) return json({ error: 'dossier_not_found' }, 404);

  const { data: existing } = await admin
    .from('fret_courses')
    .select('id, ref, status')
    .eq('dossier_id', dossierId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (action === 'detach') {
    if (existing && !['LIVRE', 'ANNULE'].includes(existing.status)) {
      await admin.from('fret_courses').update({ status: 'ANNULE' }).eq('id', existing.id);
      return json({ cancelled: true, ref: existing.ref });
    }
    return json({ cancelled: false });
  }

  if (existing && existing.status !== 'ANNULE') {
    return json({ created: false, ref: existing.ref, course_id: existing.id });
  }

  const destination = (d.destination_city || d.destination_country || 'À préciser').toString().trim();
  const weight = d.actual_weight_kg ?? d.estimated_weight ?? null;
  const scope = (d.destination_country || 'SN') === 'SN' ? 'national' : 'international';

  const { data: course, error: courseErr } = await admin
    .from('fret_courses')
    .insert({
      dossier_id: dossierId,
      destination,
      status: 'A_ENLEVER',
      client_nom: d.recipient_name || d.sender_name || null,
      client_phone: d.recipient_phone || d.contact_phone || null,
      expediteur_nom: d.sender_name || null,
      expediteur_phone: d.sender_phone || d.contact_phone || null,
      pickup_address: d.sender_address || d.pickup_quartier || null,
      pickup_zone: d.pickup_zone || null,
      pickup_fee_fcfa: 0,
      weight_kg: weight,
      scope,
      total_fcfa: d.total_displayed_price ? Math.round(Number(d.total_displayed_price)) : null,
      source: 'dossier-admin',
      colis_description: [d.product_description, weight ? `${weight} kg` : null]
        .filter(Boolean).join(' · ') || null,
    })
    .select('id, ref')
    .maybeSingle();

  if (courseErr || !course) {
    console.error('dossier->fret insert failed', courseErr);
    return json({ error: courseErr?.message || 'course_insert_failed' }, 500);
  }

  await admin.from('dossier_events').insert({
    dossier_id: dossierId,
    event_type: 'fret_course_created',
    event_data: { ref: course.ref, course_id: course.id },
    visible_to_client: false,
  });

  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/push-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        audience: 'admin',
        title: 'Dossier routier à enlever',
        body: `${d.reference} → ${destination} · course ${course.ref}`,
        url: '/admin/terrain?tab=fret',
        tag: `pickup-${course.id}`,
      }),
    });
  } catch (_) { /* non bloquant */ }

  try {
    await admin.functions.invoke('notify-admin-flush', { body: { reason: 'fret_pickup_request' } });
  } catch (_) { /* non bloquant */ }

  return json({ created: true, ref: course.ref, course_id: course.id });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const b: Body & { dossier_id?: string; action?: 'attach' | 'detach' } =
      await req.json().catch(() => ({} as Body));

    if (b.dossier_id) {
      return await handleDossierSync(req, b.dossier_id, b.action === 'detach' ? 'detach' : 'attach');
    }

    const destination = (b.destination || '').trim();
    if (!destination) return json({ error: 'destination_required' }, 400);

    const base = Math.max(0, Math.round(Number(b.base_fcfa) || 0));
    const fee = Math.max(0, Math.round(Number(b.pickup_fee_fcfa) || 0));
    const total = Math.round(Number(b.total_fcfa) || base + fee);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const breakdown = [
      {
        label: `Transport routier — ${b.zone_label || destination}`,
        amountFcfa: base,
      },
      ...(fee > 0
        ? [{ label: `Enlèvement Dakar (${b.pickup_zone || 'zone élargie'})`, amountFcfa: fee }]
        : []),
    ];

    // 1. Devis (historique / module devis transversal)
    const { data: devis, error: devisErr } = await admin
      .from('devis')
      .insert({
        conversation_phone: b.client_phone || b.expediteur_phone || null,
        engine: b.scope === 'international' ? 'fret_international' : 'fret_national',
        origin: 'Dakar',
        destination,
        weight_kg: b.weight_kg ?? null,
        colis_size: b.colis_size ?? null,
        mode: 'Terminal D — fret routier (enlèvement)',
        breakdown,
        total_fcfa: total,
        status: 'pending_send',
        notes: b.pickup_address ? `Enlèvement : ${b.pickup_address}` : null,
      })
      .select('id, reference')
      .maybeSingle();
    if (devisErr) console.error('devis insert failed', devisErr);

    // 2. Course fret en attente d'enlèvement
    const { data: course, error: courseErr } = await admin
      .from('fret_courses')
      .insert({
        destination,
        status: 'A_ENLEVER',
        client_nom: b.client_nom || null,
        client_phone: b.client_phone || null,
        expediteur_nom: b.expediteur_nom || null,
        expediteur_phone: b.expediteur_phone || null,
        pickup_address: b.pickup_address || null,
        pickup_zone: b.pickup_zone || null,
        pickup_fee_fcfa: fee,
        colis_size: b.colis_size || null,
        weight_kg: b.weight_kg ?? null,
        scope: b.scope || 'national',
        total_fcfa: total,
        source: 'terminal-d',
        colis_description: [
          b.colis_size ? `Colis ${b.colis_size}` : null,
          b.weight_kg ? `${b.weight_kg} kg` : null,
        ].filter(Boolean).join(' · ') || null,
      })
      .select('id, ref, status')
      .maybeSingle();

    if (courseErr || !course) {
      console.error('fret_courses insert failed', courseErr);
      return json({ error: courseErr?.message || 'course_insert_failed' }, 500);
    }

    // 3. Alerte admin (best effort)
    try {
      await admin.functions.invoke('notify-admin-flush', { body: { reason: 'fret_pickup_request' } });
    } catch (_) { /* non bloquant */ }

    // 3b. Notification push à l'équipe terrain (téléphone verrouillé / app fermée)
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/push-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          audience: 'admin',
          title: "Nouvelle demande d'enlèvement",
          body: `${course.ref} — ${destination}${b.pickup_zone ? ` · ${b.pickup_zone}` : ''}`,
          url: '/admin/terrain?tab=fret',
          tag: `pickup-${course.id}`,
        }),
      });
    } catch (_) { /* non bloquant */ }

    return json({ ref: course.ref, course_id: course.id, devis_reference: devis?.reference ?? null });
  } catch (e) {
    console.error('fret-booking error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
