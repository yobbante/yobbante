// Limitation d'appels IA (anti-abus / maîtrise des crédits).
// Utilise la fonction SQL public.ai_rate_limit_hit via la clé service role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface RateLimitResult {
  allowed: boolean;
  hits: number;
  max: number;
  retry_after: number;
}

/**
 * Incrémente le compteur et indique si l'appel est autorisé.
 * En cas d'erreur infra, on laisse passer (fail-open) pour ne jamais casser l'app.
 */
export async function checkRateLimit(
  bucket: string,
  subject: string,
  max: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await supa.rpc("ai_rate_limit_hit", {
      _bucket: bucket,
      _subject: subject || "anon",
      _max: max,
      _window_seconds: windowSeconds,
    });
    if (error || !data) return { allowed: true, hits: 0, max, retry_after: 0 };
    return data as RateLimitResult;
  } catch {
    return { allowed: true, hits: 0, max, retry_after: 0 };
  }
}

export function rateLimitResponse(res: RateLimitResult, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      error: "rate_limited",
      message: `Trop de requêtes. Réessayez dans ${res.retry_after}s.`,
      retry_after: res.retry_after,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(res.retry_after),
      },
    },
  );
}

/** Identifiant du demandeur : user id si connecté, sinon IP. */
export function subjectFromRequest(req: Request, userId?: string | null): string {
  if (userId) return `u:${userId}`;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip")
    || "unknown";
  return `ip:${ip}`;
}
