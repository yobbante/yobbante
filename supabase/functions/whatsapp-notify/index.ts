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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const ct = req.headers.get("content-type") ?? "";

  let payload: Record<string, string> = {};
  try {
    if (ct.includes("application/x-www-form-urlencoded")) {
      const txt = await req.text();
      payload = Object.fromEntries(new URLSearchParams(txt));
    } else if (ct.includes("application/json")) {
      payload = await req.json();
    } else {
      payload = Object.fromEntries(new URL(req.url).searchParams);
    }
  } catch (_) { /* ignore */ }

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
