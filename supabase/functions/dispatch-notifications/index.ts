// Dispatches pending notifications from notifications_log
// Channels: whatsapp (Twilio - stubbed until connected), email (stub), in_app (no-op marked sent)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM"); // e.g. whatsapp:+14155238886

const TWILIO_GATEWAY = "https://connector-gateway.lovable.dev/twilio";
const MAX_ATTEMPTS = 5;

async function sendWhatsApp(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!TWILIO_API_KEY || !LOVABLE_API_KEY || !TWILIO_WHATSAPP_FROM) {
    return { ok: false, error: "twilio_not_configured" };
  }
  try {
    const formattedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
    const r = await fetch(`${TWILIO_GATEWAY}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: formattedTo,
        From: TWILIO_WHATSAPP_FROM,
        Body: body,
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return { ok: false, error: `twilio_${r.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 200) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Pull up to 50 pending notifications
  const { data: pending, error } = await supabase
    .from("notifications_log")
    .select("*")
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0, failed = 0, skipped = 0;

  for (const n of pending ?? []) {
    let result: { ok: boolean; error?: string } = { ok: false, error: "unknown_channel" };

    if (n.channel === "in_app") {
      result = { ok: true }; // surfaced via realtime/UI directly
    } else if (n.channel === "whatsapp") {
      result = await sendWhatsApp(n.recipient, n.message);
    } else if (n.channel === "email") {
      // Email not yet wired — keep pending if no provider configured
      result = { ok: false, error: "email_provider_not_configured" };
    } else if (n.channel === "sms") {
      result = { ok: false, error: "sms_not_configured" };
    }

    const newAttempts = (n.attempts ?? 0) + 1;
    if (result.ok) {
      await supabase.from("notifications_log").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        attempts: newAttempts,
      }).eq("id", n.id);
      sent++;
    } else {
      const finalFail = newAttempts >= MAX_ATTEMPTS;
      await supabase.from("notifications_log").update({
        status: finalFail ? "failed" : "pending",
        error: result.error ?? "error",
        attempts: newAttempts,
      }).eq("id", n.id);
      if (finalFail) failed++; else skipped++;
    }
  }

  return new Response(
    JSON.stringify({ processed: pending?.length ?? 0, sent, failed, skipped }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
