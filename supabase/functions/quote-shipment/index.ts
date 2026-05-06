import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface QuoteRequest {
  shipment_id?: string | null;
  origin_country?: string;
  destination_country?: string;
  weight_kg?: number;
  transport_type?: 'AIR' | 'SEA' | 'ROAD' | 'GP' | null;
  priority?: 'normal' | 'urgent' | 'standard' | 'express' | 'same_day';
  origin_city?: string | null;
  destination_city?: string | null;
  // v2 fields (optional, backward compatible)
  goods_type?: 'standard' | 'fragile' | 'food' | 'hazardous' | 'high_value';
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
}

const XOF_PER_EUR = 655.957;
const round100 = (n: number) => Math.round(n / 100) * 100;

/**
 * Yobbanté pricing engine v2 — XOF native, EUR converted.
 *
 * Always returns 200. Calls `calculate_quote_v2` (zone-based, 22% margin,
 * supply-aware, volumetric weight). Frontend gets:
 *  - price_xof (principal)
 *  - price_eur (équivalent)
 *  - breakdown détaillé pour debug
 *  - flags : fallback_mode, requires_manual_quote, insurance_required
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = (await req.json().catch(() => ({}))) as QuoteRequest;

    let input = {
      origin_country: body.origin_country,
      destination_country: body.destination_country,
      weight_kg: body.weight_kg,
      transport_type: body.transport_type ?? null,
      priority: body.priority ?? "standard",
      origin_city: body.origin_city ?? null,
      destination_city: body.destination_city ?? null,
      goods_type: body.goods_type ?? "standard",
      length_cm: body.length_cm ?? null,
      width_cm: body.width_cm ?? null,
      height_cm: body.height_cm ?? null,
    };

    // Hydrate from shipment if shipment_id provided
    if (body.shipment_id) {
      const { data: ship } = await supabase
        .from("shipments")
        .select("origin_country, destination_country, weight_kg, transport_type, priority, origin_city, destination_city")
        .eq("id", body.shipment_id)
        .maybeSingle();
      if (ship) {
        input = {
          ...input,
          origin_country: input.origin_country ?? ship.origin_country,
          destination_country: input.destination_country ?? ship.destination_country,
          weight_kg: input.weight_kg ?? Number(ship.weight_kg ?? 1),
          transport_type: (input.transport_type ?? (ship.transport_type as any)) ?? null,
          priority: (input.priority ?? ship.priority) as any,
          origin_city: input.origin_city ?? ship.origin_city,
          destination_city: input.destination_city ?? ship.destination_city,
        };
      }
    }

    if (!input.destination_country || !input.weight_kg) {
      return json(400, { error: "destination_country and weight_kg are required" });
    }

    // Map legacy values → v2 vocabulary
    const v2Mode =
      input.transport_type === 'SEA' ? 'sea_lcl' :
      input.transport_type === 'ROAD' ? 'road' :
      'air';
    const v2Priority =
      input.priority === 'urgent' ? 'express' :
      input.priority === 'normal' ? 'standard' :
      String(input.priority);

    const { data, error } = await supabase.rpc("calculate_quote_v2", {
      p_destination_country: input.destination_country,
      p_real_weight_kg: input.weight_kg,
      p_length_cm: input.length_cm,
      p_width_cm: input.width_cm,
      p_height_cm: input.height_cm,
      p_transport_mode: v2Mode,
      p_priority: v2Priority,
      p_goods_type: input.goods_type,
    });
    if (error) {
      console.error("calculate_quote_v2 error:", error);
      return json(200, { fallback: true, error: "PRICING_UNAVAILABLE", message: "Nous cherchons la meilleure option" });
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return json(200, { fallback: true, error: "NO_PRICE_ROW", message: "Nous cherchons la meilleure option" });

    // Edge-case validations
    const errorsArr: string[] = [];
    if (v2Mode === 'air' && input.goods_type === 'hazardous') {
      errorsArr.push("Les marchandises dangereuses ne sont pas autorisées par avion.");
    }
    if (v2Priority === 'same_day' && row.zone_id !== 'Z1') {
      errorsArr.push("La livraison express le jour même n'est disponible que pour la zone Afrique de l'Ouest.");
    }

    // Departure availability — UNION across konnekt + manual sources
    const today = new Date().toISOString().slice(0, 10);
    const [{ count: kCount }, { count: mCount }] = await Promise.all([
      supabase.from('konnekt_departures')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'OPEN')
        .gte('departure_date', today)
        .ilike('destination_country', input.destination_country),
      supabase.from('manual_departures')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .gte('departure_date', today)
        .ilike('destination_country', input.destination_country),
    ]);
    const depCount = (kCount ?? 0) + (mCount ?? 0);
    const hasDeparture = depCount > 0 && !row.fallback_mode;
    const priceXof = Number(row.price_xof);
    const priceEur = Number(row.price_eur);

    return json(200, {
      // ───── v2 fields ─────
      price_xof: round100(priceXof),
      price_eur: Math.round(priceEur),
      currency_main: 'XOF',
      zone_id: row.zone_id,
      zone_name: row.zone_name,
      transport_mode: row.transport_mode,
      taxable_weight_kg: Number(row.taxable_weight_kg),
      volumetric_weight_kg: Number(row.volumetric_weight_kg),
      delivery_days_min: row.delivery_days_min,
      delivery_days_max: row.delivery_days_max,
      requires_manual_quote: !!row.requires_manual_quote,
      insurance_required: !!row.insurance_required,
      fallback_mode: !!row.fallback_mode,
      validation_errors: errorsArr,

      // ───── Backward-compat (kept so existing UI doesn't break) ─────
      price: Math.round(priceEur),                    // alias EUR rounded
      currency: 'EUR',
      eta_min_days: row.delivery_days_min,
      eta_max_days: row.delivery_days_max,
      eta_label: `${row.delivery_days_min}-${row.delivery_days_max} jours`,
      estimated_delivery: hasDeparture
        ? `${row.delivery_days_min}-${row.delivery_days_max} jours`
        : "Nous cherchons la meilleure option",
      transport_type: String(row.transport_mode).toUpperCase(),
      confidence: row.confidence,
      has_departure: hasDeparture,
      fallback: !!row.fallback_mode,

      // ───── Detailed breakdown (debug) ─────
      breakdown: {
        // v2 native (XOF)
        base_price_xof: Number(row.base_price_xof),
        weight_cost_xof: Number(row.weight_cost_xof),
        raw_price_xof: Number(row.raw_price_xof),
        weight_bracket_mult: Number(row.weight_bracket_mult),
        goods_mult: Number(row.goods_mult),
        urgency_mult: Number(row.urgency_mult),
        supply_mult: Number(row.supply_mult),
        margin_mult: Number(row.margin_mult),
        open_departures: depCount ?? 0,
        // EUR equivalents (rétro-compat)
        base_price_eur: Math.round(Number(row.base_price_xof) / XOF_PER_EUR),
        weight_cost_eur: Math.round(Number(row.weight_cost_xof) / XOF_PER_EUR),
        urgency_multiplier: Number(row.urgency_mult),
        supply_adjustment_eur: Math.round(((Number(row.supply_mult) - 1) * Number(row.raw_price_xof)) / XOF_PER_EUR),
        margin_multiplier: Number(row.margin_mult),
      },
    });
  } catch (e) {
    console.error("quote-shipment error:", e);
    return json(200, {
      fallback: true,
      error: "SERVICE_FAILED",
      message: "Nous cherchons la meilleure option",
    });
  }
});
