import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOOL = {
  type: "function",
  function: {
    name: "extract_product",
    description: "Extract product info from a marketplace URL or text description.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Concise product title (max 80 chars)" },
        platform: { type: "string", description: "Detected platform (Alibaba, Amazon, etc.) or 'unknown'" },
        estimatedPriceEur: { type: "number", description: "Estimated unit price in EUR (best guess based on category)" },
        estimatedWeightKg: { type: "number", description: "Estimated weight per unit in kg" },
        category: { type: "string", description: "Product category (electronics, textile, food, etc.)" },
        imageUrl: { type: "string", description: "Likely image URL or empty string" },
        suggestedQuantity: { type: "number", description: "Typical order quantity, default 1" },
      },
      required: ["title", "platform", "estimatedPriceEur", "estimatedWeightKg", "category", "imageUrl", "suggestedQuantity"],
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
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const isUrl = /^https?:\/\//i.test(input.trim());
    let scrapedSnippet = "";

    // Best-effort fetch to extract title/meta from URL
    if (isUrl) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 5000);
        const r = await fetch(input.trim(), {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; YobbanteBot/1.0)" },
          signal: ctrl.signal,
        });
        clearTimeout(tid);
        if (r.ok) {
          const html = (await r.text()).slice(0, 60000);
          const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "";
          const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1] ?? "";
          const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1] ?? "";
          const ogPrice = html.match(/<meta[^>]+(?:property|name)=["'](?:product:price:amount|og:price:amount)["'][^>]+content=["']([^"']+)/i)?.[1] ?? "";
          scrapedSnippet = `Title: ${ogTitle || title}\nImage: ${ogImage}\nPrice: ${ogPrice}`;
        }
      } catch (e) {
        console.warn("scrape failed:", e instanceof Error ? e.message : e);
      }
    }

    const systemPrompt = `Tu es un expert en e-commerce international (Alibaba, Amazon, AliExpress, etc.).
À partir d'une URL produit ou d'une description, extrais les informations clés.
Si tu n'as pas de données précises, fais une estimation réaliste basée sur la catégorie.
Réponds toujours via l'outil extract_product.`;

    const userPrompt = `Input: ${input}${scrapedSnippet ? `\n\nDonnées scrapées:\n${scrapedSnippet}` : ""}`;

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
      return new Response(JSON.stringify(fallback(input)), {
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
      parsed = fallback(input);
    }

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
