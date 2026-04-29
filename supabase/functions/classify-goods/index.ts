// Classify a free-text package description into a Yobbanté goods type.
// Returns { goods_type: GoodsId | null, confidence: 'high'|'medium'|'low', rationale: string }
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const GOODS_IDS = [
  "standard","electronics","fragile","fashion","cosmetics",
  "food","high_value","documents","auto_parts",
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { description, declared_value_eur } = await req.json();
    if (!description || typeof description !== "string" || description.trim().length < 3) {
      return new Response(JSON.stringify({ goods_type: null, confidence: "low", rationale: "description trop courte" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `Tu es un classificateur logistique pour Yobbanté.
Catégories autorisées :
- standard      : articles courants (ustensiles, livres, jouets génériques)
- electronics   : téléphones, ordinateurs, écouteurs, accessoires électroniques
- fragile       : verre, céramique, écrans, objets délicats
- fashion       : vêtements, chaussures, sacs, textile
- cosmetics     : maquillage, parfum, crèmes, produits de beauté
- food          : nourriture, boissons, épices, produits alimentaires
- high_value    : bijoux, montres luxe, ou tout article > 500 EUR
- documents     : papiers, contrats, courrier
- auto_parts    : pièces détachées automobiles, mécanique

Règle : si la valeur déclarée dépasse 500 EUR -> high_value (sauf documents).
Réponds UNIQUEMENT en appelant l'outil classify.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s hard cap

    let resp: Response;
    try {
      resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Description: ${description}\nValeur déclarée: ${declared_value_eur ?? "inconnue"} EUR` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "classify",
            description: "Renvoie la catégorie la plus probable.",
            parameters: {
              type: "object",
              properties: {
                goods_type: { type: "string", enum: [...GOODS_IDS] },
                confidence: { type: "string", enum: ["high","medium","low"] },
                rationale: { type: "string" },
              },
              required: ["goods_type","confidence","rationale"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "classify" } },
      }),
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!resp.ok) {
      if (resp.status === 429) return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "credits_exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "ai_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return new Response(JSON.stringify({ goods_type: null, confidence: "low", rationale: "no_tool_call" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const args = JSON.parse(call.function.arguments);
    return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("classify-goods error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
