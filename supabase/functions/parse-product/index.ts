import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL = {
  type: "function",
  function: {
    name: "extract_product",
    description: "Extract structured product info from scraped marketplace page or text description.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Concise product title (max 80 chars)" },
        platform: { type: "string", description: "Detected platform (Alibaba, Amazon, Shein, etc.) or 'unknown'" },
        estimatedPriceEur: { type: "number", description: "Unit price in EUR (use scraped data if available)" },
        estimatedWeightKg: { type: "number", description: "Estimated weight per unit in kg" },
        category: { type: "string", description: "Product category (electronics, textile, food, etc.)" },
        imageUrl: { type: "string", description: "Best product image URL or empty string" },
        suggestedQuantity: { type: "number", description: "Typical order quantity, default 1" },
        dimensions: { type: "string", description: "Approx dimensions if available (e.g. '30x20x10 cm') or empty" },
      },
      required: [
        "title",
        "platform",
        "estimatedPriceEur",
        "estimatedWeightKg",
        "category",
        "imageUrl",
        "suggestedQuantity",
        "dimensions",
      ],
      additionalProperties: false,
    },
  },
};

function detectPlatform(input: string): string {
  const u = input.toLowerCase();
  if (u.includes("alibaba") || u.includes("1688")) return "Alibaba";
  if (u.includes("amazon")) return "Amazon";
  if (u.includes("aliexpress")) return "AliExpress";
  if (u.includes("shein")) return "Shein";
  if (u.includes("temu")) return "Temu";
  if (u.includes("ebay")) return "eBay";
  return "unknown";
}

function fallback(input: string) {
  return {
    title: input.slice(0, 80),
    platform: detectPlatform(input),
    estimatedPriceEur: 0,
    estimatedWeightKg: 1,
    category: "general",
    imageUrl: "",
    suggestedQuantity: 1,
    dimensions: "",
  };
}

/**
 * Scrape une page produit via Firecrawl.
 * Renvoie markdown + meta + image principale.
 */
async function firecrawlScrape(url: string): Promise<{
  markdown: string;
  title: string;
  image: string;
} | null> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) return null;

  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 1500,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(tid);

    if (!r.ok) {
      console.warn("Firecrawl status:", r.status, await r.text().catch(() => ""));
      return null;
    }
    const data = await r.json();
    // v2 SDK shape: data.data.markdown / data.data.metadata
    const payload = data?.data ?? data;
    const md: string = (payload?.markdown ?? "").slice(0, 8000);
    const meta = payload?.metadata ?? {};
    const title: string = meta?.title ?? meta?.ogTitle ?? "";
    const image: string = meta?.ogImage ?? meta?.image ?? "";
    if (!md && !title) return null;
    return { markdown: md, title, image };
  } catch (e) {
    console.warn("Firecrawl failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require authenticated user
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: claims, error: claimsErr } = await sb.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (claimsErr || !claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { input } = await req.json();
    if (!input || typeof input !== "string" || input.trim().length < 3) {
      return new Response(JSON.stringify({ error: "input required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify(fallback(input)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmed = input.trim();
    const isUrl = /^https?:\/\//i.test(trimmed);

    let scrapeContext = "";
    let prefilledImage = "";
    let prefilledTitle = "";

    if (isUrl) {
      const scraped = await firecrawlScrape(trimmed);
      if (scraped) {
        prefilledImage = scraped.image;
        prefilledTitle = scraped.title;
        scrapeContext = `\n\n--- Page scrapée (Firecrawl) ---\nTitre: ${scraped.title}\nImage principale: ${scraped.image}\n\nContenu:\n${scraped.markdown}`;
      }
    }

    const systemPrompt = `Tu es un expert en e-commerce international (Alibaba, Amazon, AliExpress, Shein, Temu, eBay).
À partir d'une URL produit (avec contenu scrapé) ou d'une description, extrais les informations structurées.
- Si le prix est clairement visible dans le scrape, utilise-le. Sinon, estime intelligemment.
- Pour le poids et les dimensions, base-toi sur la catégorie et le type de produit.
- Pour l'image, utilise celle fournie par le scrape si disponible.
Réponds toujours via l'outil extract_product.`;

    const userPrompt = `Input utilisateur: ${trimmed}${scrapeContext}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "extract_product" } },
      }),
    });

    if (!response.ok) {
      console.error("AI error:", response.status, await response.text());
      const fb = fallback(trimmed);
      if (prefilledImage) fb.imageUrl = prefilledImage;
      if (prefilledTitle) fb.title = prefilledTitle;
      return new Response(JSON.stringify(fb), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ai = await response.json();
    const args = ai.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed;
    try {
      parsed = JSON.parse(args ?? "{}");
      if (!parsed.title) throw new Error("invalid");
    } catch {
      parsed = fallback(trimmed);
    }

    // Privilégier les données réelles scrapées si l'IA n'a rien retourné de mieux
    if (!parsed.imageUrl && prefilledImage) parsed.imageUrl = prefilledImage;

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-product error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
