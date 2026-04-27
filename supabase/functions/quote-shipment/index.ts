import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface QuoteRequest {
  origin_country: string;
  destination_country: string;
  weight_kg: number;
  transport_type?: 'AIR' | 'SEA' | 'ROAD' | 'GP' | null;
  priority?: 'normal' | 'urgent';
  origin_city?: string | null;
  destination_city?: string | null;
}

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
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as QuoteRequest;
    if (!body.origin_country || !body.destination_country || !body.weight_kg) {
      return new Response(
        JSON.stringify({ error: "origin_country, destination_country and weight_kg are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data, error } = await supabase.rpc("calculate_quote", {
      p_origin_country: body.origin_country,
      p_destination_country: body.destination_country,
      p_weight_kg: body.weight_kg,
      p_transport_type: body.transport_type ?? null,
      p_priority: body.priority ?? "normal",
      p_origin_city: body.origin_city ?? null,
      p_destination_city: body.destination_city ?? null,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return new Response(JSON.stringify({ error: "No quote available" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        price: Number(row.price_eur),
        currency: row.currency,
        eta_min_days: row.eta_min_days,
        eta_max_days: row.eta_max_days,
        eta_label: `${row.eta_min_days}-${row.eta_max_days} jours`,
        transport_type: row.transport_type,
        confidence: row.confidence,
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
