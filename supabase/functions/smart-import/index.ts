import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL = {
  type: "function",
  function: {
    name: "recommend_routes",
    description: "Return 3 import route options (fast, balanced, economy) and the recommended one.",
    parameters: {
      type: "object",
      properties: {
        recommended: { type: "string", enum: ["fast", "balanced", "economy"] },
        reasoning: { type: "string", description: "Explication détaillée en français (3-4 phrases)" },
        options: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string", enum: ["fast", "balanced", "economy"] },
              label: { type: "string", description: "Nom court (ex: Express aérien)" },
              transport: { type: "string", enum: ["air", "sea", "road"] },
              transportLabel: { type: "string" },
              estimatedCost: { type: "number", description: "Coût total en euros" },
              estimatedDays: { type: "string", description: "Ex: 5–8 jours" },
              highlight: { type: "string", description: "Avantage clé (ex: Le plus rapide)" },
            },
            required: ["key", "label", "transport", "transportLabel", "estimatedCost", "estimatedDays", "highlight"],
            additionalProperties: false,
          },
        },
      },
      required: ["recommended", "reasoning", "options"],
      additionalProperties: false,
    },
  },
};

function fallback(weight: number) {
  return {
    recommended: weight > 30 ? "economy" : "balanced" as const,
    reasoning: "Recommandation basée sur des règles standards (IA indisponible).",
    options: [
      { key: "fast", label: "Express aérien", transport: "air", transportLabel: "Aérien express",
        estimatedCost: Math.round(weight * 14 + 30), estimatedDays: "3–5 jours", highlight: "Le plus rapide" },
      { key: "balanced", label: "Aérien standard", transport: "air", transportLabel: "Aérien standard",
        estimatedCost: Math.round(weight * 9 + 25), estimatedDays: "6–9 jours", highlight: "Meilleur rapport" },
      { key: "economy", label: "Maritime LCL", transport: "sea", transportLabel: "Maritime (LCL)",
        estimatedCost: Math.round(weight * 3.5 + 30), estimatedDays: "25–35 jours", highlight: "Le moins cher" },
    ],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { product, weight, origin, destination, budget } = await req.json();

    if (!product || !weight || !origin || !destination) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Tu es un expert en logistique internationale (Yobbanté). Tu fournis 3 options de route pour un import: rapide (air express), équilibrée (air standard ou route), économique (maritime LCL).
Tarifs réalistes 2026:
- Aérien express: 12-18€/kg, 3-5j
- Aérien standard: 7-12€/kg, 6-10j
- Routier: 4-8€/kg, 8-15j (Europe/MENA uniquement)
- Maritime LCL: 2-5€/kg, 25-40j
- Frais fixes (manutention + douane + livraison finale): 25-50€

Recommande l'option la plus adaptée au produit, poids${budget ? `, et budget (${budget}€)` : ''}. Réponds en français via l'outil recommend_routes.`;

    const userPrompt = `Produit: ${product}
Poids: ${weight} kg
Origine: ${origin}
Destination: ${destination}${budget ? `\nBudget cible: ${budget} €` : ''}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "recommend_routes" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please retry." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      const fb = fallback(Number(weight));
      return new Response(JSON.stringify({ route: `${origin} → ${destination}`, ...fb }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let parsed;
    try {
      parsed = JSON.parse(toolCall?.function?.arguments || "{}");
      if (!parsed.options || !Array.isArray(parsed.options) || parsed.options.length === 0) {
        throw new Error("invalid");
      }
    } catch {
      parsed = fallback(Number(weight));
    }

    return new Response(JSON.stringify({
      route: `${origin} → ${destination}`,
      ...parsed,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("smart-import error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
