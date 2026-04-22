import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MatchRequest {
  origin_city: string;
  destination_city: string;
  weight_kg: number;
  urgency?: "normal" | "fast" | "flexible";
  declared_value_eur?: number;
}

interface KonnektOption {
  id: string;
  label: string;
  eta_days: string;
  price_eur: number;
  departure_date?: string | null;
  highlight?: string;
}

interface KonnektResponse {
  options: KonnektOption[];
  next_departure_in_days?: number | null;
}

/**
 * Mock structuré : reproduit la signature finale du futur endpoint Konnekt.
 * Calcule 3 options réalistes (Rapide / Économique / Volume) basées sur le poids.
 * Switch d'1 ligne quand l'API réelle sera prête : remplacer ce bloc par l'appel HTTP.
 */
function buildOptionsFallback(req: MatchRequest): KonnektResponse {
  const w = Math.max(0.5, Number(req.weight_kg) || 1);
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const addDays = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d;
  };

  // Tarification Yobbanté (réaliste, marges incluses)
  const fast = Math.round(w * 14 + 35);
  const eco = Math.round(w * 6 + 25);
  const volume = Math.round(w * 2.5 + 30);

  return {
    next_departure_in_days: 2,
    options: [
      {
        id: "fast",
        label: "Rapide",
        eta_days: "3–6 jours",
        price_eur: fast,
        departure_date: fmt(addDays(2)),
        highlight: "Le plus rapide",
      },
      {
        id: "economy",
        label: "Économique",
        eta_days: "8–14 jours",
        price_eur: eco,
        departure_date: fmt(addDays(4)),
        highlight: "Meilleur rapport qualité-prix",
      },
      {
        id: "volume",
        label: "Volume",
        eta_days: "25–40 jours",
        price_eur: volume,
        departure_date: fmt(addDays(7)),
        highlight: "Pour les gros envois",
      },
    ],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as MatchRequest;

    // Validation
    if (!body.origin_city || !body.destination_city || !body.weight_kg) {
      return new Response(
        JSON.stringify({ error: "origin_city, destination_city et weight_kg sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const KONNEKT_BASE_URL = Deno.env.get("KONNEKT_BASE_URL");
    const YOBBANTE_API_KEY = Deno.env.get("YOBBANTE_API_KEY");

    // Si Konnekt est configuré, on tente l'appel réel
    if (KONNEKT_BASE_URL && YOBBANTE_API_KEY) {
      try {
        const url = `${KONNEKT_BASE_URL.replace(/\/$/, "")}/match`;
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 8000);
        const r = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Yobbante-Api-Key": YOBBANTE_API_KEY,
          },
          body: JSON.stringify({
            origin_city: body.origin_city,
            destination_city: body.destination_city,
            weight_kg: body.weight_kg,
            urgency: body.urgency ?? "normal",
            declared_value_eur: body.declared_value_eur ?? null,
          }),
          signal: ctrl.signal,
        });
        clearTimeout(tid);

        if (r.ok) {
          const data = (await r.json()) as KonnektResponse;
          if (Array.isArray(data?.options) && data.options.length > 0) {
            return new Response(JSON.stringify(data), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else {
          console.warn("Konnekt /match non disponible:", r.status, await r.text().catch(() => ""));
        }
      } catch (e) {
        console.warn("Konnekt call failed, using fallback:", e instanceof Error ? e.message : e);
      }
    }

    // Fallback : mock structuré (signature finale prête)
    return new Response(JSON.stringify(buildOptionsFallback(body)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("external-match-shipment error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
