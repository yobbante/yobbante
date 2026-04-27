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
  priority?: 'normal' | 'urgent';
  origin_city?: string | null;
  destination_city?: string | null;
}

/**
 * Single source of truth for pricing.
 * Accepts either a shipment_id (loads inputs from DB) OR raw inputs.
 * Always returns a price — uses fallback messaging when no Konnekt departure exists.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as QuoteRequest;

    let input = {
      origin_country: body.origin_country,
      destination_country: body.destination_country,
      weight_kg: body.weight_kg,
      transport_type: body.transport_type ?? null,
      priority: body.priority ?? "normal",
      origin_city: body.origin_city ?? null,
      destination_city: body.destination_city ?? null,
    };

    // Hydrate from shipment if shipment_id provided
    if (body.shipment_id) {
      const { data: ship, error: shipErr } = await supabase
        .from("shipments")
        .select("origin_country, destination_country, weight_kg, transport_type, priority, origin_city, destination_city")
        .eq("id", body.shipment_id)
        .maybeSingle();
      if (shipErr) throw shipErr;
      if (ship) {
        input = {
          origin_country: input.origin_country ?? ship.origin_country,
          destination_country: input.destination_country ?? ship.destination_country,
          weight_kg: input.weight_kg ?? Number(ship.weight_kg ?? 1),
          transport_type: (input.transport_type ?? (ship.transport_type as any)) ?? null,
          priority: (input.priority ?? ship.priority) as 'normal' | 'urgent',
          origin_city: input.origin_city ?? ship.origin_city,
          destination_city: input.destination_city ?? ship.destination_city,
        };
      }
    }

    if (!input.origin_country || !input.destination_country || !input.weight_kg) {
      return new Response(
        JSON.stringify({ error: "origin_country, destination_country and weight_kg are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data, error } = await supabase.rpc("calculate_quote", {
      p_origin_country: input.origin_country,
      p_destination_country: input.destination_country,
      p_weight_kg: input.weight_kg,
      p_transport_type: input.transport_type ?? null,
      p_priority: input.priority ?? "normal",
      p_origin_city: input.origin_city ?? null,
      p_destination_city: input.destination_city ?? null,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return new Response(JSON.stringify({ error: "Pricing unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if any matching open departure exists → drives fallback message
    const { count: depCount } = await supabase
      .from("konnekt_departures")
      .select("id", { count: "exact", head: true })
      .eq("status", "OPEN")
      .gte("departure_date", new Date().toISOString().slice(0, 10))
      .ilike("origin_country", input.origin_country)
      .ilike("destination_country", input.destination_country);

    const hasDeparture = (depCount ?? 0) > 0;

    return new Response(
      JSON.stringify({
        price: Number(row.price_eur),
        currency: row.currency,
        eta_min_days: row.eta_min_days,
        eta_max_days: row.eta_max_days,
        eta_label: `${row.eta_min_days}-${row.eta_max_days} jours`,
        estimated_delivery: hasDeparture
          ? `${row.eta_min_days}-${row.eta_max_days} jours`
          : "Nous cherchons la meilleure option",
        transport_type: row.transport_type,
        confidence: row.confidence,
        has_departure: hasDeparture,
        breakdown: {
          base_price_eur: Number(row.base_price_eur),
          weight_cost_eur: Number(row.weight_cost_eur),
          urgency_multiplier: Number(row.urgency_multiplier),
          supply_adjustment_eur: Number(row.supply_adjustment_eur),
          margin_multiplier: Number(row.margin_multiplier),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("quote-shipment error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
