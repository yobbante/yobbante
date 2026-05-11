// Twilio WhatsApp inbound/status webhook
// Endpoint: /functions/v1/whatsapp-notify
// Configure this URL in Twilio Console → Messaging → Sender → Webhook (later)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

async function validateTwilioSignature(req: Request, rawBody: string): Promise<boolean> {
  if (!TWILIO_AUTH_TOKEN) return false;
  const signature = req.headers.get("x-twilio-signature");
  if (!signature) return false;
  // Twilio signs: url + sorted concat of param key+value (form-encoded body)
  const params = Object.fromEntries(new URLSearchParams(rawBody));
  const sortedKeys = Object.keys(params).sort();
  const data = req.url + sortedKeys.map(k => k + params[k]).join("");
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(TWILIO_AUTH_TOKEN),
    { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return expected === signature;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const ct = req.headers.get("content-type") ?? "";

  let payload: Record<string, string> = {};
  let rawBody = "";
  try {
    if (ct.includes("application/x-www-form-urlencoded")) {
      rawBody = await req.text();
      payload = Object.fromEntries(new URLSearchParams(rawBody));
    } else if (ct.includes("application/json")) {
      const j = await req.json();
      payload = j;
      rawBody = new URLSearchParams(j as Record<string, string>).toString();
    } else {
      payload = Object.fromEntries(new URL(req.url).searchParams);
    }
  } catch (_) { /* ignore */ }

  // Validate Twilio webhook signature
  const valid = await validateTwilioSignature(req, rawBody);
  if (!valid) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Twilio sends MessageSid, MessageStatus (delivered, failed, read), From, Body, etc.
  const messageSid = payload.MessageSid ?? payload.SmsSid ?? null;
  const status = payload.MessageStatus ?? payload.SmsStatus ?? null;
  const from = payload.From ?? null;
  const body = payload.Body ?? null;

  // Log inbound event
  await supabase.from("shipment_events").insert({
    shipment_id: "00000000-0000-0000-0000-000000000000", // placeholder; real linking needs mapping
    event_type: "whatsapp_webhook",
    triggered_by: "twilio",
    note: `WhatsApp inbound: status=${status ?? "n/a"} from=${from ?? "n/a"}`,
    metadata: { messageSid, status, from, body, raw: payload },
  }).then(() => {}, () => {});

  // Update notifications_log if we can match by message text + recipient
  if (messageSid && status === "delivered") {
    await supabase
      .from("notifications_log")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("recipient", from)
      .eq("channel", "whatsapp")
      .eq("status", "pending");
  }

  // Twilio expects a 200 with empty TwiML
  return new Response("<Response/>", {
    headers: { "Content-Type": "text/xml" },
    status: 200,
  });
});
