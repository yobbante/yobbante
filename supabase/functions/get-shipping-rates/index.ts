import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface ShippingRate {
  carrier: string;
  service: string;
  price_xof: number;
  price_eur: number;
  eta_days_min: number;
  eta_days_max: number;
  is_default?: boolean;
}

interface Body {
  destination_country: string;
  destination_city?: string;
  destination_postcode?: string;
  weight_kg: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
}

function yobbante(weight: number): ShippingRate {
  // Yobbanté Standard — simple, always available pricing.
  const base = 2500; // XOF
  const perKg = 800;
  const xof = Math.max(base, Math.round(base + Math.max(0, weight - 1) * perKg));
  return {
    carrier: 'Yobbanté',
    service: 'Standard',
    price_xof: xof,
    price_eur: Math.round((xof / 655.957) * 100) / 100,
    eta_days_min: 2,
    eta_days_max: 4,
    is_default: true,
  };
}

// Each carrier hook tries to call its API; on missing key or error → returns null (no crash).
async function dhl(_b: Body): Promise<ShippingRate | null> {
  const key = Deno.env.get('DHL_API_KEY');
  if (!key) return null;
  try {
    // stub: real DHL call would go here
    return null;
  } catch { return null; }
}
async function laposte(_b: Body): Promise<ShippingRate | null> {
  const key = Deno.env.get('LAPOSTE_API_KEY');
  if (!key) return null;
  try { return null; } catch { return null; }
}
async function fedex(_b: Body): Promise<ShippingRate | null> {
  const id = Deno.env.get('FEDEX_CLIENT_ID');
  const secret = Deno.env.get('FEDEX_CLIENT_SECRET');
  if (!id || !secret) return null;
  try { return null; } catch { return null; }
}
async function sendcloud(_b: Body): Promise<ShippingRate | null> {
  const key = Deno.env.get('SENDCLOUD_KEY');
  if (!key) return null;
  try { return null; } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    if (!body || typeof body.weight_kg !== 'number' || body.weight_kg <= 0 || !body.destination_country) {
      return new Response(
        JSON.stringify({ error: 'destination_country and weight_kg required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const rates: ShippingRate[] = [yobbante(body.weight_kg)];

    const carriers = await Promise.allSettled([
      dhl(body), laposte(body), fedex(body), sendcloud(body),
    ]);
    for (const r of carriers) {
      if (r.status === 'fulfilled' && r.value) rates.push(r.value);
    }

    rates.sort((a, b) => a.price_xof - b.price_xof);

    return new Response(JSON.stringify({ rates }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    // Never crash — always return Yobbanté default
    return new Response(
      JSON.stringify({ rates: [yobbante(1)], error: String((e as Error)?.message ?? e) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
