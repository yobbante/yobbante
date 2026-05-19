// Send WhatsApp messages via Meta Cloud API
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID");
const ADMIN_RECIPIENT = "221786078080"; // +221 78 607 80 80 (digits only)

interface Payload {
  recipient_phone?: string;
  client_name?: string;
  service_type?: string; // "Expédition" | "Réception" | "Sourcing"
  origin?: string;
  destination?: string;
  weight?: string | number;
  custom_message?: string; // optional override
}

function buildMessage(p: Payload): string {
  if (p.custom_message) return p.custom_message;
  return [
    "🚀 Nouvelle demande Yobbanté",
    "",
    `Client : ${p.client_name ?? "—"}`,
    `Service : ${p.service_type ?? "—"}`,
    `De : ${p.origin ?? "—"}`,
    `Vers : ${p.destination ?? "—"}`,
    `Poids : ${p.weight ?? "—"}kg`,
    "",
    "Voir le dossier → https://yobbante.com/admin",
  ].join("\n");
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    return new Response(
      JSON.stringify({ error: "WhatsApp not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let payload: Payload = {};
  try {
    payload = await req.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const to = normalizePhone(payload.recipient_phone || ADMIN_RECIPIENT);
  const body = buildMessage(payload);

  try {
    const r = await fetch(
      `https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body },
        }),
      },
    );

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("WhatsApp API error", r.status, data);
      return new Response(
        JSON.stringify({ ok: false, status: r.status, error: data }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-whatsapp failed", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
