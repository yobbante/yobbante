// konnekt-invite-blast — sends Konnekt beta invite WhatsApp messages to all
// non-registered GPs (transporteurs). Returns per-GP wa.me links + Twilio
// send results when Twilio is configured.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");

function normalizePhone(p: string): string {
  const t = p.trim().replace(/[^\d+]/g, "");
  if (t.startsWith("+")) return t;
  if (t.length === 9 && (t.startsWith("7") || t.startsWith("3"))) return "+221" + t;
  return "+" + t;
}

function buildInvite(prenom: string, ref: string) {
  return `Salam ${prenom},

Yobbante vous invite a rejoindre Konnekt, la plateforme officielle de nos transporteurs.

Votre profil est deja cree. Activez votre compte ici :
yobbante.com/rejoindre-konnekt?ref=GP${ref}

Une fois inscrit, vous recevrez vos missions directement sur votre telephone.

Questions ? Repondez a ce message.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const authedClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await authedClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: isStaff } = await admin.rpc("is_staff", { _user_id: claims.claims.sub });
  if (!isStaff) {
    return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { data: gps, error } = await admin
      .from("transporteurs")
      .select("id, reference, nom, telephone_1, konnekt_registered, actif")
      .eq("actif", true)
      .eq("konnekt_registered", false);
    if (error) throw error;

    const results: Array<{ ref: string; nom: string; phone: string; sent: boolean; wa_link: string; error?: string }> = [];
    let sentCount = 0;

    for (const gp of (gps ?? [])) {
      const prenom = (gp.nom || "").split(" ")[0] || gp.nom || "";
      const message = buildInvite(prenom, gp.reference);
      const phone = normalizePhone(String(gp.telephone_1 || ""));
      const waLink = `https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(message)}`;
      let sent = false;
      let providerError: string | undefined;

      if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM && phone.length > 4) {
        try {
          const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
          const form = new URLSearchParams({
            To: `whatsapp:${phone}`,
            From: TWILIO_FROM,
            Body: message,
          });
          const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
            method: "POST",
            headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
            body: form.toString(),
          });
          if (r.ok) { sent = true; sentCount++; }
          else providerError = `Twilio ${r.status}`;
        } catch (e) {
          providerError = (e as Error).message;
        }
      } else {
        providerError = "Twilio not configured";
      }

      await admin.from("notifications_log").insert({
        channel: "whatsapp",
        recipient: phone,
        message,
        status: sent ? "sent" : "pending",
        sent_at: sent ? new Date().toISOString() : null,
        error: sent ? null : providerError,
      }).then(() => {}, () => {});

      results.push({ ref: gp.reference, nom: gp.nom, phone, sent, wa_link: waLink, error: providerError });
    }

    return new Response(JSON.stringify({
      ok: true,
      total: results.length,
      sent: sentCount,
      results,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
