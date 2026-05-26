// E2E tests for gp-smart-invite — vérifie que la bascule wa.me se fait
// correctement selon que le GP a (ou non) un historique WhatsApp dans
// la fenêtre 24h Meta.
//
// On teste la fonction déployée via HTTP. Aucun GP réel n'est utilisé :
// on génère un numéro de test unique pour la simulation.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const FN = `${SUPABASE_URL}/functions/v1/gp-smart-invite`;

function uniqueTestPhone(): string {
  // +221 7XX XXX XXX — numéro fictif, ne sera pas appelé réellement parce
  // que (a) sans historique → on log seulement, (b) si on insère un inbound
  // via service role on garde le numéro éphémère.
  const tail = String(Math.floor(100000000 + Math.random() * 899999999)).slice(0, 9);
  return `+2217${tail.slice(1)}`;
}

async function callSmartInvite(body: Record<string, unknown>) {
  const res = await fetch(FN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { res, json };
}

Deno.test("GP SANS historique → bascule wa.me obligatoire", async () => {
  const phone = uniqueTestPhone();
  const { res, json } = await callSmartInvite({
    phone,
    message: "Salam, test sans historique. Repondez OK pour confirmer.",
    gp_name: "Test GP NoHistory",
    gp_ref: "GP9999",
    trigger_type: "e2e_no_history",
  });

  assertEquals(res.status, 200, "200 expected even when blocked");
  assertEquals(json.ok, false, "ok must be false when no inbound history");
  assertEquals(json.has_history, false, "has_history must be false");
  assertEquals(json.fallback_required, true, "fallback_required must be true");
  assertEquals(json.blocked_reason, "no_inbound_history_24h");
  assert(
    typeof json.wa_link === "string" && json.wa_link.startsWith("https://wa.me/"),
    "wa_link must be a valid wa.me URL",
  );
  assert(json.wa_link.includes(phone.replace(/\D/g, "")), "wa_link must target the GP phone");
});

Deno.test({
  name: "GP AVEC historique 24h → API tentée (has_history=true)",
  ignore: !SERVICE_ROLE, // requires service role to insert inbound row
  async fn() {
    const phone = uniqueTestPhone();
    const digits = phone.replace(/\D/g, "");
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Seed : insère un message inbound récent sur le canal GP.
    const { error: insErr } = await supa.from("whatsapp_inbound_messages").insert({
      from_phone: digits,
      from_name: "E2E Test",
      to_number: "221781221891",
      message_body: "AIDE",
      message_type: "text",
      channel: "gp",
      wamid: `e2e-${crypto.randomUUID()}`,
    });
    assertEquals(insErr, null);

    try {
      const { json } = await callSmartInvite({
        phone,
        message: "Salam, test avec historique. Bienvenue.",
        gp_name: "Test GP WithHistory",
        gp_ref: "GP8888",
        trigger_type: "e2e_with_history",
      });

      assertEquals(json.has_history, true, "has_history must be true after seeding inbound");
      // L'envoi peut échouer côté Meta (numéro fictif) → fallback attendu, mais
      // ce qui compte ici c'est que has_history soit bien détecté.
      assert(typeof json.wa_link === "string" && json.wa_link.includes(digits));
    } finally {
      await supa.from("whatsapp_inbound_messages").delete().eq("from_phone", digits);
    }
  },
});

Deno.test("Validation : phone manquant → 400", async () => {
  const { res, json } = await callSmartInvite({ message: "Salam test" });
  assertEquals(res.status, 400);
  assert(typeof json.error === "string");
});

Deno.test("Validation : message trop court → 400", async () => {
  const { res, json } = await callSmartInvite({ phone: "+221771234567", message: "x" });
  assertEquals(res.status, 400);
  assert(typeof json.error === "string");
});
