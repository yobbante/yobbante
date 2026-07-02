// Shared auth helpers for Lovable-managed edge functions.
//
// Most Lovable-managed functions deploy with verify_jwt = false, so authenticated-
// caller enforcement has to happen in code. Two helpers are exposed:
//   - requireServiceRole(req): reject anything that isn't the service-role bearer.
//     Used for internal-only endpoints called by other edge functions, cron jobs
//     (pg_cron sends `Authorization: Bearer <SERVICE_ROLE_KEY>`), or Postgres
//     `net.http_post` triggers.
//   - requireStaff(req): reject anything that isn't a signed-in admin/staff user.
//     Also accepts a service-role bearer so cron / trigger calls keep working.
//
// Both functions return a Response object when the request must be rejected, or
// null when the caller is authorized. This lets call sites early-return with a
// single `if (unauth) return unauth;` line.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

export const sharedCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...sharedCors, "Content-Type": "application/json", ...extraHeaders },
  });
}

/** Returns a 401 Response when the caller does NOT present the service-role bearer. */
export function requireServiceRole(req: Request): Response | null {
  if (!SERVICE_ROLE) {
    return json({ error: "Server misconfigured: SUPABASE_SERVICE_ROLE_KEY missing" }, 500);
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${SERVICE_ROLE}`) {
    return json({ error: "Unauthorized" }, 401);
  }
  return null;
}

/**
 * Returns a 401/403 Response when the caller is not an authenticated staff/admin.
 * A service-role bearer is accepted (for server-to-server calls).
 */
export async function requireStaff(req: Request): Promise<Response | null> {
  const auth = req.headers.get("authorization") ?? "";
  if (SERVICE_ROLE && auth === `Bearer ${SERVICE_ROLE}`) return null;

  if (!auth.toLowerCase().startsWith("bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ error: "Unauthorized" }, 401);
    const { data: roles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (rolesErr) return json({ error: "Unauthorized" }, 401);
    const ok = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "staff");
    if (!ok) return json({ error: "Forbidden" }, 403);
    return null;
  } catch {
    return json({ error: "Unauthorized" }, 401);
  }
}

/** Constant-time HMAC-SHA256 comparison. */
export async function verifyHmacSha256(
  rawBody: string,
  signatureHex: string,
  secret: string,
): Promise<boolean> {
  if (!signatureHex || !secret) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    const expected = Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const a = expected.toLowerCase();
    const b = signatureHex.toLowerCase().replace(/^sha256=/, "");
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}
