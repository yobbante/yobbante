import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals, assertAlmostEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

interface QuoteResp {
  price: number;
  currency: string;
  estimated_delivery: string;
  transport_type: string;
  confidence: 'high' | 'medium' | 'low';
  has_departure: boolean;
  fallback?: boolean;
  breakdown: {
    base_price_eur: number;
    weight_cost_eur: number;
    urgency_multiplier: number;
    supply_adjustment_eur: number;
    margin_multiplier: number;
    open_departures?: number;
    route_used?: { origin_country: string; destination_country: string; transport_type: string } | null;
  };
}

async function callQuote(body: Record<string, unknown>): Promise<QuoteResp> {
  // Direct fetch — avoids supabase-js realtime/auth timers that leak in Deno test sandbox.
  const res = await fetch(`${SUPABASE_URL}/functions/v1/quote-shipment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON}`,
      "apikey": SUPABASE_ANON,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return data as QuoteResp;
}

Deno.test("returns price + 20% margin for FR→SN known route, 5kg normal", async () => {
  const q = await callQuote({
    origin_country: "FR", destination_country: "SN", weight_kg: 5,
    transport_type: "AIR", priority: "normal",
    origin_city: "Paris", destination_city: "Dakar",
  });
  assert(q.price > 0, "price must be positive");
  assertEquals(q.currency, "EUR");
  assertEquals(q.breakdown.margin_multiplier, 1.2);
  assertEquals(q.breakdown.urgency_multiplier, 1);
  // Final = (base + weight_cost) * urgency * 1 + supply_adj, then * 1.2
  // Verify reconstruction within 1 cent.
  const raw = (q.breakdown.base_price_eur + q.breakdown.weight_cost_eur) * q.breakdown.urgency_multiplier;
  const final = (raw + q.breakdown.supply_adjustment_eur) * q.breakdown.margin_multiplier;
  assertAlmostEquals(q.price, Math.round(final * 100) / 100, 0.05);
});

Deno.test("urgency multiplier = 1.3 when priority=urgent", async () => {
  const q = await callQuote({
    origin_country: "FR", destination_country: "SN", weight_kg: 10,
    transport_type: "AIR", priority: "urgent",
    origin_city: "Paris", destination_city: "Dakar",
  });
  assertEquals(q.breakdown.urgency_multiplier, 1.3);
  assert(q.price > 0);
});

Deno.test("heavier shipment yields higher price (same route)", async () => {
  const light = await callQuote({
    origin_country: "FR", destination_country: "SN", weight_kg: 2,
    transport_type: "AIR", priority: "normal",
  });
  const heavy = await callQuote({
    origin_country: "FR", destination_country: "SN", weight_kg: 30,
    transport_type: "AIR", priority: "normal",
  });
  assert(heavy.price > light.price, `heavy(${heavy.price}) should > light(${light.price})`);
});

Deno.test("unknown route → fallback pricing with low confidence + fallback message", async () => {
  const q = await callQuote({
    origin_country: "ZZ", destination_country: "QQ", weight_kg: 5,
    transport_type: "AIR", priority: "normal",
  });
  assert(q.price > 0, "fallback should still yield a price");
  assertEquals(q.confidence, "low");
  assertEquals(q.has_departure, false);
  assertEquals(q.estimated_delivery, "Nous cherchons la meilleure option");
});

Deno.test("returns confidence + estimated_delivery on every successful response", async () => {
  const q = await callQuote({
    origin_country: "CN", destination_country: "SN", weight_kg: 25,
    transport_type: "SEA", priority: "normal",
    origin_city: "Shenzhen", destination_city: "Dakar",
  });
  assert(["high", "medium", "low"].includes(q.confidence));
  assert(typeof q.estimated_delivery === "string" && q.estimated_delivery.length > 0);
});

Deno.test("missing inputs returns 400-style error in body", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/quote-shipment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON}`, "apikey": SUPABASE_ANON },
    body: JSON.stringify({ origin_country: "FR" }),
  });
  const data = await res.json();
  assert(data.error, "should signal validation error");
});
