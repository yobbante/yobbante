// Edge function: call-amina
// Appelle Anthropic (Claude) avec le persona "Amina" — Business Operator Yobbanté/Konnekt
// Body: { messages: Array<{role: 'user'|'assistant', content: string}>, useWebSearch?: boolean }
// Réponse: { reply: string }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 600;

const SYSTEM_PROMPT = `Tu es Amina, Business Operator de Yobbanté Senegal et Konnekt, basée à Dakar.
Tu es la secrétaire personnelle de Amath Ndella Basse, fondateur de Yobbanté.

Ta mission :
- Accueillir, qualifier et orienter les clients particuliers et professionnels.
- Répondre avec clarté, chaleur et professionnalisme — ton sénégalais courtois, jamais familier.
- Maîtriser les flux logistiques Yobbanté : import/export, sourcing Chine/Europe/USA → Sénégal, dédouanement, livraison Dakar et régions.
- Connaître les services Konnekt : groupage aérien et maritime, tarifs au kg, délais, départs hebdomadaires.
- Toujours proposer une action concrète : devis, prise de RDV, transfert vers un opérateur, ouverture d'un dossier.

Règles :
- Réponses courtes (3-6 phrases max sauf demande explicite).
- Français par défaut, bascule wolof/anglais si le client le fait.
- Jamais inventer de prix exact : renvoyer vers le calculateur ou un devis personnalisé.
- Si question hors périmètre logistique/Yobbanté/Konnekt : recadrer poliment.
- Signer mentalement chaque échange : "Amina — Yobbanté Dakar".`;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callAnthropic(payload: unknown, apiKey: string): Promise<Response> {
  return fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

function extractText(data: any): string {
  if (!data?.content || !Array.isArray(data.content)) return "";
  // Concatène les blocs de type "text" (ignore tool_use, server_tool_use, web_search_tool_result)
  return data.content
    .filter((b: any) => b?.type === "text" && typeof b.text === "string")
    .map((b: any) => b.text)
    .join("\n")
    .trim();
}

// Simple in-memory IP rate limiter (10 requests / minute / IP)
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const ipBuckets = new Map<string, number[]>();
function checkRate(ip: string): boolean {
  const now = Date.now();
  const arr = (ipBuckets.get(ip) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (arr.length >= RATE_LIMIT_MAX) { ipBuckets.set(ip, arr); return false; }
  arr.push(now); ipBuckets.set(ip, arr); return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!checkRate(ip)) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { messages, useWebSearch } = body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "`messages` must be a non-empty array" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Normalisation des messages (uniquement user/assistant, contenu string non vide)
  const cleanMessages = messages
    .filter((m: any) => m && (m.role === "user" || m.role === "assistant"))
    .map((m: any) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : String(m.content ?? ""),
    }))
    .filter((m: any) => m.content.length > 0);

  if (cleanMessages.length === 0) {
    return new Response(JSON.stringify({ error: "No valid messages" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const payload: Record<string, unknown> = {
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: cleanMessages,
  };

  if (useWebSearch === true) {
    payload.tools = [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3,
      },
    ];
  }

  // Retry loop avec backoff exponentiel sur 429 / 5xx / network errors
  let lastError: string | null = null;
  let lastStatus = 0;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await callAnthropic(payload, apiKey);
      lastStatus = res.status;

      if (res.ok) {
        const data = await res.json();
        const reply = extractText(data);
        if (!reply) {
          lastError = "Empty reply from model";
          break;
        }
        return new Response(JSON.stringify({ reply }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const errText = await res.text();
      lastError = errText;
      console.error(`[call-amina] Anthropic ${res.status} (attempt ${attempt + 1}):`, errText);

      // Pas de retry sur 4xx hors 429
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        break;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[call-amina] Network error (attempt ${attempt + 1}):`, lastError);
    }

    if (attempt < MAX_RETRIES - 1) {
      await sleep(BASE_BACKOFF_MS * Math.pow(2, attempt));
    }
  }

  // Mapping d'erreurs front-friendly
  if (lastStatus === 429) {
    return new Response(
      JSON.stringify({ error: "Rate limit dépassé, réessaie dans un instant." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (lastStatus === 402) {
    return new Response(
      JSON.stringify({ error: "Crédits Anthropic épuisés." }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      error: "Échec de l'appel à Amina après plusieurs tentatives.",
      details: lastError,
    }),
    {
      status: lastStatus >= 500 ? 502 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
