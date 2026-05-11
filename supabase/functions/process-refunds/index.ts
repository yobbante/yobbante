import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Refund worker — picks pending refund_requests and "fires" the refund.
 * Payment provider is stubbed for now: we mark the refund as `sent` with a
 * synthetic provider_ref. When a real Stripe/Paddle integration lands, swap
 * the stub block with the real API call.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Worker auth: require service-role bearer token (used by cron / scheduler)
  const SERVICE_KEY_ENV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${SERVICE_KEY_ENV}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: pending, error } = await supabase
      .from("refund_requests")
      .select("*")
      .eq("status", "pending")
      .lt("attempts", 5)
      .order("created_at", { ascending: true })
      .limit(20);

    if (error) throw error;

    let processed = 0;
    for (const r of pending ?? []) {
      try {
        // === STUB: replace with real Stripe/Paddle refund call ===
        const providerRef = `stub_refund_${crypto.randomUUID().slice(0, 8)}`;
        // ==========================================================

        await supabase
          .from("refund_requests")
          .update({
            status: "sent",
            provider_ref: providerRef,
            attempts: (r.attempts ?? 0) + 1,
            processed_at: new Date().toISOString(),
          })
          .eq("id", r.id);

        await supabase
          .from("shipments")
          .update({ payment_status: "refunded" })
          .eq("id", r.shipment_id);

        await supabase.from("shipment_events").insert({
          shipment_id: r.shipment_id,
          event_type: "refund_sent",
          triggered_by: "system",
          note: `💸 Remboursement émis (${r.amount_eur} EUR) — réf ${providerRef}`,
          metadata: { provider_ref: providerRef, amount_eur: r.amount_eur },
        });
        processed++;
      } catch (e) {
        await supabase
          .from("refund_requests")
          .update({
            attempts: (r.attempts ?? 0) + 1,
            error: e instanceof Error ? e.message : String(e),
            status: (r.attempts ?? 0) + 1 >= 5 ? "failed" : "pending",
          })
          .eq("id", r.id);
      }
    }

    return new Response(
      JSON.stringify({ processed, scanned: pending?.length ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("process-refunds error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
