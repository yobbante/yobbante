import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MatchRequest {
  origin_city: string;
  destination_city: string;
  weight_kg: number;
  origin_country?: string;
  destination_country?: string;
  urgency?: "normal" | "fast" | "flexible";
  declared_value_eur?: number;
}

type OptionId = "fast" | "economy" | "volume";

interface MatchOption {
  id: OptionId;
  label: string;
  eta_days: string;
  price_eur: number;
  departure_date?: string | null;
  highlight?: string;
  transport_type: string;
  confidence: string;
}

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (base: Date, n: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
};

const BUCKETS: Array<{ id: OptionId; label: string; transport: 'AIR' | 'ROAD' | 'SEA'; highlight: string }> = [
  { id: "fast",    label: "Rapide",     transport: "AIR",  highlight: "Le plus rapide" },
  { id: "economy", label: "Économique", transport: "ROAD", highlight: "Meilleur rapport qualité-prix" },
  { id: "volume",  label: "Volume",     transport: "SEA",  highlight: "Pour les gros envois" },
];

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

    const body = (await req.json()) as MatchRequest;
    if (!body.origin_city || !body.destination_city || !body.weight_kg) {
      return json(400, { error: "origin_city, destination_city et weight_kg sont requis" });
    }

    const origin_country = (body.origin_country ?? "FR").toUpperCase();
    const destination_country = (body.destination_country ?? "SN").toUpperCase();

    const today = new Date();
    const options: MatchOption[] = [];

    for (const b of BUCKETS) {
      const { data, error } = await supabase.rpc("calculate_quote", {
        p_origin_country: origin_country,
        p_destination_country: destination_country,
        p_weight_kg: body.weight_kg,
        p_transport_type: b.transport,
        p_priority: body.urgency === "fast" ? "urgent" : "normal",
        p_origin_city: body.origin_city,
        p_destination_city: body.destination_city,
      });
      if (error) {
        console.warn(`calculate_quote failed for ${b.transport}:`, error.message);
        continue;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) continue;

      const { data: dep } = await supabase
        .from("konnekt_departures")
        .select("departure_date")
        .eq("status", "OPEN")
        .ilike("origin_country", origin_country)
        .ilike("destination_country", destination_country)
        .eq("transport", b.transport)
        .gte("departure_date", fmt(today))
        .gte("available_capacity_kg", body.weight_kg)
        .order("departure_date", { ascending: true })
        .limit(1)
        .maybeSingle();

      options.push({
        id: b.id,
        label: b.label,
        transport_type: b.transport,
        eta_days: `${row.eta_min_days}–${row.eta_max_days} jours`,
        price_eur: Number(row.price_eur),
        departure_date: dep?.departure_date ?? fmt(addDays(today, b.id === "fast" ? 2 : b.id === "economy" ? 4 : 7)),
        highlight: b.highlight,
        confidence: row.confidence,
      });
    }

    const { data: nextDep } = await supabase
      .from("konnekt_departures")
      .select("departure_date")
      .eq("status", "OPEN")
      .ilike("origin_country", origin_country)
      .ilike("destination_country", destination_country)
      .gte("departure_date", fmt(today))
      .order("departure_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    const next_departure_in_days = nextDep
      ? Math.max(0, Math.ceil((new Date(nextDep.departure_date).getTime() - today.getTime()) / 86400000))
      : null;

    return json(200, { options, next_departure_in_days, fallback: options.length === 0 });
  } catch (e) {
    console.error("external-match-shipment error:", e);
    // Never 5xx — return empty options so UI can fall back gracefully.
    return json(200, { options: [], next_departure_in_days: null, fallback: true });
  }
});
