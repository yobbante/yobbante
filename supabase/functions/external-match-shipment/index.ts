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
  note?: string;
}

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (base: Date, n: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
};

// Distinct multipliers per option. Each option transforms the SAME base
// calculation differently so prices must always differ.
const BUCKETS: Array<{
  id: OptionId;
  label: string;
  transport: 'AIR' | 'ROAD' | 'SEA';
  highlight: string;
  multiplier: number;   // applied on base price
  eta_days: string;
  eta_offset: number;   // for fallback departure_date
  note?: string;
}> = [
  { id: "fast",    label: "Express",    transport: "AIR",  highlight: "Le plus rapide",                  multiplier: 1.35, eta_days: "1-2 jours", eta_offset: 1 },
  { id: "economy", label: "Économique", transport: "ROAD", highlight: "Meilleur rapport qualité-prix",   multiplier: 1.00, eta_days: "3-5 jours", eta_offset: 4 },
  { id: "volume",  label: "Volume",     transport: "SEA",  highlight: "Pour les gros envois",            multiplier: 0.85, eta_days: "5-7 jours", eta_offset: 7, note: "Tarif dégressif pour gros envois" },
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

    // Compute ONE base price (no urgency, no transport-specific markup) using
    // the economy/road quote as our neutral reference. Then we apply distinct
    // multipliers per option so the three prices are guaranteed to differ.
    const { data: baseData, error: baseErr } = await supabase.rpc("calculate_quote", {
      p_origin_country: origin_country,
      p_destination_country: destination_country,
      p_weight_kg: body.weight_kg,
      p_transport_type: "ROAD",
      p_priority: "normal",
      p_origin_city: body.origin_city,
      p_destination_city: body.destination_city,
    });
    if (baseErr) {
      console.warn("base calculate_quote failed:", baseErr.message);
    }
    const baseRow = Array.isArray(baseData) ? baseData[0] : baseData;
    const basePrice = baseRow ? Number(baseRow.price_eur) : 0;
    const baseConfidence = baseRow?.confidence ?? "medium";

    // Volume option only makes sense for heavier shipments.
    const showVolume = body.weight_kg >= 30;

    // Map our bucket transport vocabulary to the values stored in
    // konnekt_departures.transport (UPPER) and manual_departures.transport_mode (lower).
    const transportKeys = (t: 'AIR' | 'ROAD' | 'SEA') => ({
      konnekt: t,
      manual: t === 'AIR' ? 'air' : t === 'SEA' ? 'sea_lcl' : 'road',
    });

    for (const b of BUCKETS) {
      if (b.id === "volume" && !showVolume) continue;
      if (basePrice <= 0) continue;

      const keys = transportKeys(b.transport);

      // Look up a REAL departure (Konnekt OR manual) for this transport.
      // Without a real departure we don't surface this option — the UI then
      // shows the "Aucun départ disponible" fallback card.
      const [{ data: konDep }, { data: manDep }] = await Promise.all([
        supabase
          .from("konnekt_departures")
          .select("departure_date")
          .eq("status", "OPEN")
          .ilike("origin_country", origin_country)
          .ilike("destination_country", destination_country)
          .eq("transport", keys.konnekt)
          .gte("departure_date", fmt(today))
          .gte("available_capacity_kg", body.weight_kg)
          .order("departure_date", { ascending: b.id === "fast" })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("manual_departures")
          .select("departure_date")
          .eq("status", "active")
          .ilike("origin_country", origin_country)
          .ilike("destination_country", destination_country)
          .eq("transport_mode", keys.manual)
          .gte("departure_date", fmt(today))
          .gte("available_capacity_kg", body.weight_kg)
          .order("departure_date", { ascending: b.id === "fast" })
          .limit(1)
          .maybeSingle(),
      ]);

      const dep = konDep ?? manDep;
      if (!dep) continue; // ← key change: no real departure → no option

      options.push({
        id: b.id,
        label: b.label,
        transport_type: b.transport,
        eta_days: b.eta_days,
        price_eur: Math.round(basePrice * b.multiplier),
        departure_date: dep.departure_date,
        highlight: b.highlight,
        confidence: baseConfidence,
        note: b.note,
      });
    }

    // Next departure across both sources (any transport)
    const [{ data: nextKon }, { data: nextMan }] = await Promise.all([
      supabase
        .from("konnekt_departures")
        .select("departure_date")
        .eq("status", "OPEN")
        .ilike("origin_country", origin_country)
        .ilike("destination_country", destination_country)
        .gte("departure_date", fmt(today))
        .order("departure_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("manual_departures")
        .select("departure_date")
        .eq("status", "active")
        .ilike("origin_country", origin_country)
        .ilike("destination_country", destination_country)
        .gte("departure_date", fmt(today))
        .order("departure_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    const candidates = [nextKon?.departure_date, nextMan?.departure_date].filter(Boolean) as string[];
    const nextDep = candidates.length
      ? { departure_date: candidates.sort()[0] }
      : null;

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
