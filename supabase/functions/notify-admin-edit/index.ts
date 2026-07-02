import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const ADMIN_PHONE = "+221784604003";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://tlvuextleczdsqxoguyq.supabase.co";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // --- Auth: service-role bearer required (internal call only) ---
  const __SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const __auth = req.headers.get('authorization') ?? '';
  if (!__SR || __auth !== `Bearer ${__SR}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...(typeof corsHeaders !== 'undefined' ? corsHeaders : {}), 'Content-Type': 'application/json' },
    });
  }
  try {
    const body = await req.json();
    const { entity_type, label, changes } = body ?? {};
    const list = Array.isArray(changes) ? changes : [];
    if (list.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lines = list.map((c: any) => {
      const f = String(c.field || "");
      const oldV = c.old == null ? "(vide)" : String(c.old);
      const newV = c.new == null ? "(vide)" : String(c.new);
      return `${f} : ${oldV} -> ${newV}`;
    });

    const who = entity_type === "transporteur" ? "GP" : "client";
    const msg = stripAccents(
      `Infos modifiees par ${who} pour ${label || "-"} :\n` + lines.join("\n")
    );

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({
        recipient_phone: ADMIN_PHONE,
        recipient_type: "admin",
        message: msg,
        trigger_type: "edit_notification",
      }),
    });

    return new Response(JSON.stringify({ ok: resp.ok }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
