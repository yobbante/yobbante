// konnekt-missions — Public endpoint that returns Yobbanté missions assigned to a GP.
// Only returns missions when the matched transporteur is beta-validated.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function normalizePhone(input: string): string {
  let v = (input || '').toString().trim().replace(/[^\d+]/g, '');
  if (!v) return '';
  if (v.startsWith('00')) v = '+' + v.slice(2);
  if (!v.startsWith('+')) v = v.length === 9 ? '+221' + v : '+' + v;
  return v;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { phone?: string; reference?: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const phone = normalizePhone(body.phone ?? '');
  const reference = (body.reference ?? '').replace(/\D/g, '').slice(0, 4);
  if (!phone && !reference) {
    return new Response(JSON.stringify({ ok: true, beta_validated: false, missions: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const last9 = phone.replace(/\D/g, '').slice(-9);

  let gp: any = null;
  if (reference && /^\d{4}$/.test(reference)) {
    const { data } = await supa.from('transporteurs')
      .select('id, reference, prenom, nom, telephone_1, is_beta_validated')
      .eq('reference', reference)
      .maybeSingle();
    gp = data;
  }
  if (!gp && last9) {
    const { data } = await supa.from('transporteurs')
      .select('id, reference, prenom, nom, telephone_1, is_beta_validated')
      .or(`telephone_1.ilike.%${last9},telephone_2.ilike.%${last9},whatsapp.ilike.%${last9}`)
      .limit(1)
      .maybeSingle();
    gp = data;
  }

  if (!gp) {
    return new Response(JSON.stringify({ ok: true, found: false, beta_validated: false, missions: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!gp.is_beta_validated) {
    return new Response(JSON.stringify({ ok: true, found: true, beta_validated: false, missions: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fetch dossiers assigned to this GP via assigned_transporteur_ref (text === reference)
  // or via gp_id (text). Include planned departure date via assigned_departure_id.
  const orParts: string[] = [];
  if (gp.reference) orParts.push(`assigned_transporteur_ref.eq.${gp.reference}`);
  if (gp.reference) orParts.push(`gp_id.eq.${gp.reference}`);

  let dossiers: any[] = [];
  if (orParts.length) {
    const { data } = await supa.from('dossiers')
      .select('id, tracking_id, reference, status, destination_country, destination_city, estimated_weight, actual_weight_kg, assigned_departure_id, created_at')
      .or(orParts.join(','))
      .not('status', 'in', '(DELIVERED,CLOSED,CANCELLED,ARCHIVED)')
      .order('created_at', { ascending: false })
      .limit(50);
    dossiers = data || [];
  }

  // Load planned departure dates
  const depIds = Array.from(new Set(dossiers.map((d) => d.assigned_departure_id).filter(Boolean)));
  const depMap = new Map<string, string>();
  if (depIds.length) {
    const { data } = await supa.from('manual_departures')
      .select('id, departure_date')
      .in('id', depIds);
    (data || []).forEach((d: any) => depMap.set(d.id, d.departure_date));
  }

  const missions = dossiers.map((d) => ({
    id: d.id,
    tracking_id: d.tracking_id || d.reference || null,
    status: d.status,
    destination_country: d.destination_country || null,
    destination_city: d.destination_city || null,
    weight_kg: d.actual_weight_kg ?? d.estimated_weight ?? null,
    departure_date: d.assigned_departure_id ? depMap.get(d.assigned_departure_id) ?? null : null,
  }));

  return new Response(JSON.stringify({
    ok: true,
    found: true,
    beta_validated: true,
    gp: { reference: gp.reference, prenom: gp.prenom, nom: gp.nom },
    missions,
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
