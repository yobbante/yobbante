import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { product, weight, origin, destination } = await req.json();

    if (!product || !weight || !origin || !destination) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Tu es un expert en logistique internationale spécialisé dans l'import/export entre l'Asie, l'Europe, l'Amérique et l'Afrique.
Analyse la demande d'import et fournis une recommandation détaillée.

IMPORTANT: Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans backticks. Le format exact:
{
  "transport": "air" | "sea" | "road",
  "transportLabel": "label en français",
  "estimatedCost": number (en euros),
  "estimatedDays": "X–Y jours",
  "reasoning": "explication détaillée en français (2-3 phrases)"
}

Prends en compte:
- Le type de produit (fragile, périssable, valeur, volume)
- Le poids et les seuils économiques par mode
- La route géographique et les hubs logistiques
- Les tarifs réalistes 2026 (aérien: ~8-15€/kg, maritime LCL: ~2-5€/kg, routier: ~4-8€/kg)
- Frais de manutention, dédouanement, livraison finale (~15-30€ fixes)`;

    const userPrompt = `Produit: ${product}
Poids: ${weight} kg
Origine: ${origin}
Destination: ${destination}

Recommande le mode de transport optimal.`;

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
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please retry." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response
    let recommendation;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      recommendation = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      // Fallback to static logic
      recommendation = {
        transport: weight > 30 ? "sea" : "air",
        transportLabel: weight > 30 ? "Maritime (LCL)" : "Aérien standard",
        estimatedCost: Math.round(weight * (weight > 30 ? 4 : 12) + 25),
        estimatedDays: weight > 30 ? "25–35 jours" : "5–8 jours",
        reasoning: "Recommandation basée sur le poids et la route standard.",
      };
    }

    return new Response(JSON.stringify({
      route: `${origin} → ${destination}`,
      ...recommendation,
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
