// Public edge function — create a shipment draft from the quote flow.
// Requires authenticated user (anon JWT from supabase.functions.invoke).
// Returns { id, tracking_number, status } or { error }.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const WAREHOUSE_COUNTRIES = new Set(['FR', 'CN', 'US', 'CA', 'AE', 'DE', 'SN']);

function inferCountry(text: string | undefined, fallback: string): string {
  if (!text) return fallback;
  const t = text.toLowerCase();
  if (/(france|paris|lyon|marseille|bordeaux)/.test(t)) return 'FR';
  if (/(belgique|belgium|bruxelles|antwerp)/.test(t)) return 'FR'; // closest warehouse
  if (/(china|chine|shanghai|guangzhou|shenzhen|hong)/.test(t)) return 'CN';
  if (/(united states|usa|new york|miami|los angeles|new\s*jersey|étatsfuni|etats-unis)/.test(t)) return 'US';
  if (/(canada|montreal|toronto)/.test(t)) return 'CA';
  if (/(uae|emirates|emirats|dubai|abu dhabi)/.test(t)) return 'AE';
  if (/(germany|allemagne|berlin|munich)/.test(t)) return 'DE';
  if (/(senegal|sénégal|dakar|thies|saint-louis)/.test(t)) return 'SN';
  return fallback;
}

function inferDestCountry(text: string | undefined, fallback = 'SN'): string {
  if (!text) return fallback;
  const t = text.toLowerCase();
  if (/(france|paris|lyon|marseille)/.test(t)) return 'FR';
  if (/(usa|new york|miami|états|etats)/.test(t)) return 'US';
  if (/(uae|dubai|emirates|emirats)/.test(t)) return 'AE';
  if (/(côte|cote.*ivoire|abidjan)/.test(t)) return 'CI';
  if (/(senegal|sénégal|dakar)/.test(t)) return 'SN';
  return fallback;
}

function pickCity(text: string | undefined): string | null {
  if (!text) return null;
  const first = text.split(',')[0].trim();
  return first.length > 0 ? first : null;
}

interface Body {
  origin?: string;
  destination?: string;
  weight_kg?: number;
  transport_mode?: 'air' | 'sea' | 'road';
  goods_type?: string;
  selected_option?: 'express' | 'eco' | 'volume';
  total_eur?: number;
  sender?: { name?: string; phone?: string; email?: string };
  receiver?: {
    name?: string; address?: string; city?: string; zip?: string; country?: string;
  };
  description?: string;
  declared_value_eur?: number;
  departure_date?: string; // ISO
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const user = userData.user;

    const body: Body = await req.json().catch(() => ({}));
    const weight = Math.max(0.5, Number(body.weight_kg) || 1);
    const originCountry = inferCountry(body.origin, 'FR');
    if (!WAREHOUSE_COUNTRIES.has(originCountry)) {
      return new Response(JSON.stringify({ error: 'Origin country unsupported' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const destCountry = inferDestCountry(body.receiver?.country || body.destination, 'SN');

    const transportMap: Record<string, string> = { air: 'AIR', sea: 'SEA', road: 'ROAD' };
    const transportType = transportMap[body.transport_mode || 'air'] || 'AIR';

    const totalCost = body.total_eur && body.total_eur > 0 ? Math.round(body.total_eur) : null;

    // departure_date must be ISO YYYY-MM-DD or null — never accept a French label.
    const isoDate = (s?: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) ? s : null;

    const insertPayload = {
      user_id: user.id,
      origin_country: originCountry as 'FR' | 'CN' | 'US' | 'CA' | 'AE' | 'DE' | 'SN',
      destination_country: destCountry,
      origin_city: pickCity(body.origin),
      destination_city: pickCity(body.receiver?.city || body.destination),
      weight_kg: weight,
      transport_type: transportType,
      priority: body.selected_option === 'express' ? 'express' : 'normal',
      total_cost: totalCost,
      status: 'CONFIRMED' as const,
      payment_status: 'unpaid',
      departure_date: isoDate(body.departure_date),
      client_note: body.description || null,
      transport_metadata: {
        sender: body.sender || null,
        receiver: body.receiver || null,
        declared_value_eur: body.declared_value_eur || null,
        selected_option: body.selected_option || null,
        goods_type: body.goods_type || null,
        source: 'public-quote-flow',
      },
    };

    const { data: shipment, error } = await supabase
      .from('shipments')
      .insert(insertPayload)
      .select('id, tracking_number, status')
      .single();

    if (error || !shipment) {
      console.error('insert shipment failed', error);
      return new Response(JSON.stringify({ error: error?.message || 'Insert failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(shipment),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('create-shipment-from-quote error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
