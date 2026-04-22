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

type OptionId = "fast" | "economy" | "volume";

interface KonnektOption {
  id: OptionId;
  label: string;
  eta_days: string;
  price_eur: number;
  departure_date?: string | null;
  highlight?: string;
  // Anything extra from upstream is preserved here for the client.
  meta?: Record<string, unknown>;
}

interface KonnektResponse {
  options: KonnektOption[];
  next_departure_in_days?: number | null;
}

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (base: Date, n: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
};

/**
 * Mock structuré : 3 options réalistes basées sur le poids.
 */
function buildOptionsFallback(req: MatchRequest): KonnektResponse {
  const w = Math.max(0.5, Number(req.weight_kg) || 1);
  const today = new Date();
  const fast = Math.round(w * 14 + 35);
  const eco = Math.round(w * 6 + 25);
  const volume = Math.round(w * 2.5 + 30);

  return {
    next_departure_in_days: 2,
    options: [
      { id: "fast", label: "Rapide", eta_days: "3–6 jours", price_eur: fast, departure_date: fmt(addDays(today, 2)), highlight: "Le plus rapide" },
      { id: "economy", label: "Économique", eta_days: "8–14 jours", price_eur: eco, departure_date: fmt(addDays(today, 4)), highlight: "Meilleur rapport qualité-prix" },
      { id: "volume", label: "Volume", eta_days: "25–40 jours", price_eur: volume, departure_date: fmt(addDays(today, 7)), highlight: "Pour les gros envois" },
    ],
  };
}

/**
 * Normalise une réponse upstream hétérogène en 3 buckets fixes
 * (Rapide / Économique / Volume). Si une catégorie manque, on la
 * complète depuis le fallback pour garantir un UX uniforme.
 */
function normalizeToThree(upstream: unknown, req: MatchRequest): KonnektResponse {
  const fallback = buildOptionsFallback(req);
  const byId = new Map<OptionId, KonnektOption>();
  for (const o of fallback.options) byId.set(o.id, o);

  const rawOptions: any[] =
    Array.isArray((upstream as any)?.options) ? (upstream as any).options :
    Array.isArray(upstream) ? (upstream as any) : [];

  const classify = (raw: any): OptionId => {
    const explicit = String(raw?.id ?? raw?.tier ?? raw?.category ?? "").toLowerCase();
    if (["fast", "express", "rapide", "air"].some(k => explicit.includes(k))) return "fast";
    if (["volume", "sea", "bateau", "maritime"].some(k => explicit.includes(k))) return "volume";
    if (["eco", "economy", "standard", "économique"].some(k => explicit.includes(k))) return "economy";
    // Heuristique de secours sur l'ETA si présente.
    const eta = String(raw?.eta_days ?? raw?.eta ?? "");
    const days = parseInt(eta, 10);
    if (!isNaN(days)) {
      if (days <= 7) return "fast";
      if (days >= 20) return "volume";
    }
    return "economy";
  };

  for (const raw of rawOptions) {
    const id = classify(raw);
    const base = byId.get(id)!;
    byId.set(id, {
      id,
      label: base.label,
      eta_days: String(raw?.eta_days ?? raw?.eta ?? base.eta_days),
      price_eur: Number(raw?.price_eur ?? raw?.price ?? base.price_eur),
      departure_date: raw?.departure_date ?? base.departure_date ?? null,
      highlight: raw?.highlight ?? base.highlight,
      meta: { upstream: raw },
    });
  }

  return {
    next_departure_in_days: (upstream as any)?.next_departure_in_days ?? fallback.next_departure_in_days ?? null,
    options: [byId.get("fast")!, byId.get("economy")!, byId.get("volume")!],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as MatchRequest;

    if (!body.origin_city || !body.destination_city || !body.weight_kg) {
      return new Response(
        JSON.stringify({ error: "origin_city, destination_city et weight_kg sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const KONNEKT_BASE_URL = Deno.env.get("KONNEKT_BASE_URL");
    const YOBBANTE_API_KEY = Deno.env.get("YOBBANTE_API_KEY");

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
          const data = await r.json();
          const normalized = normalizeToThree(data, body);
          return new Response(JSON.stringify(normalized), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.warn("Konnekt /match non disponible:", r.status, await r.text().catch(() => ""));
      } catch (e) {
        console.warn("Konnekt call failed, using fallback:", e instanceof Error ? e.message : e);
      }
    }

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
