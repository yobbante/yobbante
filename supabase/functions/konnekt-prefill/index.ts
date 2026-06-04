// konnekt-prefill — Public endpoint that returns sanitized GP info for a phone.
// Used by /konnekt landing page to pre-fill the registration form when the
// visitor's number matches an existing transporteur (no auth required).
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
    return new Response(JSON.stringify({ found: false }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const last9 = phone.replace(/\D/g, '').slice(-9);

  let row: any = null;
  if (reference && /^\d{4}$/.test(reference)) {
    const { data } = await supa.from('transporteurs')
      .select('reference, prenom, nom, telephone_1, telephone_2, whatsapp, adresse_1, adresse_2, ville, zone, modes_transport, destinations')
      .eq('reference', reference)
      .maybeSingle();
    row = data;
  }
  if (!row && last9) {
    const { data } = await supa.from('transporteurs')
      .select('reference, prenom, nom, telephone_1, telephone_2, whatsapp, adresse_1, adresse_2, ville, zone, modes_transport, destinations')
      .or(`telephone_1.ilike.%${last9},telephone_2.ilike.%${last9},whatsapp.ilike.%${last9}`)
      .limit(1)
      .maybeSingle();
    row = data;
  }

  if (!row) {
    return new Response(JSON.stringify({ found: false }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    found: true,
    data: {
      reference: row.reference ?? null,
      prenom: row.prenom ?? '',
      nom: row.nom ?? '',
      telephone_1: row.telephone_1 ?? '',
      telephone_2: row.telephone_2 ?? '',
      whatsapp: row.whatsapp ?? '',
      adresse_1: row.adresse_1 ?? '',
      adresse_2: row.adresse_2 ?? '',
      ville: row.ville ?? '',
      zone: row.zone ?? '',
      modes_transport: Array.isArray(row.modes_transport) ? row.modes_transport : [],
      destinations: Array.isArray(row.destinations) ? row.destinations : [],
    },
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
