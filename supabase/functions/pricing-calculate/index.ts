import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * POST /functions/v1/pricing-calculate
 *
 * Body shape matches the public pricing API spec (XOF native, EUR/USD converted).
 * Always returns 200 (never blocks the user).
 */
interface CalcBody {
  origin_city?: string;
  destination_city?: string;
  destination_country: string;
  real_weight_kg: number;
  dimensions_cm?: { length?: number; width?: number; height?: number };
  transport_mode?: 'air' | 'sea_lcl' | 'road';
  priority?: 'standard' | 'express' | 'same_day';
  goods_type?: 'standard' | 'fragile' | 'food' | 'hazardous' | 'high_value';
  departure_id?: string;
}

const XOF_PER_EUR = 655.957;
const EUR_TO_USD = 1.08;
const round100 = (n: number) => Math.round(n / 100) * 100;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = (await req.json().catch(() => ({}))) as CalcBody;
    if (!body.destination_country || !body.real_weight_kg) {
      return json(400, { error: 'destination_country and real_weight_kg are required' });
    }

    const dim = body.dimensions_cm ?? {};
    const mode = body.transport_mode ?? 'air';
    const priority = body.priority ?? 'standard';
    const goods = body.goods_type ?? 'standard';

    const { data, error } = await supabase.rpc('calculate_quote_v2', {
      p_destination_country: body.destination_country,
      p_real_weight_kg: body.real_weight_kg,
      p_length_cm: dim.length ?? null,
      p_width_cm: dim.width ?? null,
      p_height_cm: dim.height ?? null,
      p_transport_mode: mode,
      p_priority: priority,
      p_goods_type: goods,
    });

    if (error) {
      console.error('calculate_quote_v2 error:', error);
      return json(200, {
        fallback_mode: true,
        message: 'Nous recherchons la meilleure option disponible',
      });
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return json(200, {
        fallback_mode: true,
        message: 'Nous recherchons la meilleure option disponible',
      });
    }

    // Validation messages (don't block — return alongside the price)
    const validation: string[] = [];
    if (mode === 'air' && goods === 'hazardous') {
      validation.push('Les marchandises dangereuses ne sont pas autorisées par avion.');
    }
    if (priority === 'same_day' && row.zone_id !== 'Z1') {
      validation.push("La livraison express le jour même n'est disponible que pour la zone Afrique de l'Ouest.");
    }

    const priceXof = round100(Number(row.price_xof));
    const priceEurExact = priceXof / XOF_PER_EUR;

    // Optional context
    const departureAvailable = !row.fallback_mode;
    const supplyStatus =
      row.supply_mult <= 0.95 ? 'high' :
      row.supply_mult >= 1.05 ? 'low'  :
      row.supply_mult === 1.0 && row.fallback_mode ? 'none' :
      'normal';

    return json(200, {
      price_xof: priceXof,
      price_eur: Math.round(priceEurExact),
      price_usd: Math.round(priceEurExact * EUR_TO_USD),
      currency_main: 'XOF',
      transport_mode: row.transport_mode,
      zone: `${row.zone_id} — ${row.zone_name}`,
      zone_id: row.zone_id,
      real_weight_kg: Number(body.real_weight_kg),
      volumetric_weight_kg: Number(row.volumetric_weight_kg),
      taxable_weight_kg: Number(row.taxable_weight_kg),
      min_taxable_applied: Number(row.taxable_weight_kg) > Math.max(Number(body.real_weight_kg), Number(row.volumetric_weight_kg)),
      estimated_delivery: `${row.delivery_days_min}-${row.delivery_days_max} jours`,
      delivery_days_min: row.delivery_days_min,
      delivery_days_max: row.delivery_days_max,
      departure_available: departureAvailable,
      supply_status: supplyStatus,
      confidence: row.confidence,
      requires_manual_quote: !!row.requires_manual_quote,
      insurance_required: !!row.insurance_required,
      fallback_mode: !!row.fallback_mode,
      validation_messages: validation,
      breakdown: {
        base_price: Number(row.base_price_xof),
        additional_weight_cost: Number(row.weight_cost_xof),
        weight_bracket_adj: Number(row.weight_bracket_mult),
        goods_type_adj: Number(row.goods_mult),
        urgency_adj: Number(row.urgency_mult),
        supply_adj: Number(row.supply_mult),
        platform_margin: Number(row.margin_mult),
        raw_price_before_margin: Number(row.raw_price_xof),
      },
    });
  } catch (e) {
    console.error('pricing-calculate error:', e);
    return json(200, {
      fallback_mode: true,
      message: 'Nous recherchons la meilleure option disponible',
    });
  }
});
