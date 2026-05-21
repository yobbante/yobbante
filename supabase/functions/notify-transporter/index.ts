// notify-transporter — fire-and-forget WhatsApp notification to a transporter.
// Tries to send via Twilio if env vars are present, otherwise returns wa.me fallback link.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM"); // e.g. "whatsapp:+14155238886"

function normalizePhone(p: string): string {
  // Keep digits and + only
  const t = p.trim().replace(/[^\d+]/g, "");
  if (t.startsWith("+")) return t;
  // Default to Senegal if no country code
  if (t.length === 9 && (t.startsWith("7") || t.startsWith("3"))) return "+221" + t;
  return "+" + t;
}

function buildMessage({ prenom, dossierRef, collecteAddress, destinationCity, dateDepart, poids, transporteurRef, konnektRegistered }: {
  prenom: string;
  dossierRef: string;
  collecteAddress: string;
  destinationCity: string;
  dateDepart: string;
  poids: number | string;
  transporteurRef?: string | null;
  konnektRegistered?: boolean;
}) {
  const base = `Bonjour ${prenom},

Un nouveau départ vous est assigné sur Yobbanté.

📦 Référence dossier : ${dossierRef}
📍 Collecte : ${collecteAddress}
🎯 Destination : ${destinationCity}
📅 Date : ${dateDepart}
⚖️ Poids estimé : ${poids} kg

Confirmez votre disponibilité en répondant à ce message.`;

  const beta = (!konnektRegistered && transporteurRef)
    ? `

────────────────────────────
🚀 Nouveau : Rejoignez Konnekt
Recevez encore plus de missions directement sur votre téléphone.
👉 yobbante.com/rejoindre-konnekt?ref=GP${transporteurRef}`
    : '';

  return `${base}${beta}

— Équipe Yobbanté`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth: require staff JWT
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const authedClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await authedClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: isStaff } = await adminClient.rpc("is_staff", { _user_id: claims.claims.sub });
  if (!isStaff) {
    return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const {
      transporteur_ref,
      telephone,
      prenom = "",
      dossierRef = "",
      collecteAddress = "",
      destinationCity = "",
      dateDepart = "",
      poids = "",
    } = body ?? {};

    if (!telephone) {
      return new Response(JSON.stringify({ ok: false, error: "telephone required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = normalizePhone(String(telephone));
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Lookup GP konnekt registration status
    let konnektRegistered = false;
    if (transporteur_ref) {
      const { data: gp } = await supabase
        .from("transporteurs")
        .select("konnekt_registered")
        .eq("reference", String(transporteur_ref))
        .maybeSingle();
      konnektRegistered = !!gp?.konnekt_registered;
    }

    const message = buildMessage({ prenom, dossierRef, collecteAddress, destinationCity, dateDepart, poids, transporteurRef: transporteur_ref ?? null, konnektRegistered });
    const waLink = `https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(message)}`;

    // Try Twilio if configured
    let sent = false;
    let providerError: string | null = null;
    if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
      try {
        const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
        const form = new URLSearchParams({
          To: `whatsapp:${phone}`,
          From: TWILIO_FROM,
          Body: message,
        });
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        });
        if (r.ok) sent = true;
        else providerError = `Twilio ${r.status}: ${await r.text()}`;
      } catch (e) {
        providerError = (e as Error).message;
      }
    } else {
      providerError = "Twilio not configured";
    }

    // Log notification (best effort)
    await supabase.from("notifications_log").insert({
      channel: "whatsapp",
      recipient: phone,
      message,
      status: sent ? "sent" : "pending",
      sent_at: sent ? new Date().toISOString() : null,
      error: sent ? null : providerError,
    }).then(() => {}, () => {});

    return new Response(JSON.stringify({
      ok: true,
      sent,
      wa_link: waLink,
      transporteur_ref: transporteur_ref ?? null,
      provider_error: providerError,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
