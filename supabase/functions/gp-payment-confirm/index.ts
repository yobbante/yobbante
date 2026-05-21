// gp-payment-confirm — staff confirms a GP payment for one or many dossiers
// at once. Updates each dossier, generates a PDF receipt stored in
// `gp-receipts`, sends a WhatsApp summary to the GP, and a notif to admin.
//
// POST body:
//   {
//     transporteur_id: string,
//     dossier_ids: string[],
//     method: 'wave' | 'orange_money' | 'cash',
//     reference: string,
//     note?: string
//   }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ADMIN_NOTIF_PHONE = "+221784604003";

const METHOD_LABEL: Record<string, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
  cash: "Cash",
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatXof(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} XOF`;
}

async function sendWhatsapp(opts: {
  to: string;
  message: string;
  recipient_type: "gp" | "admin";
  transporteur_id?: string | null;
  trigger_type: string;
}) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        recipient_type: opts.recipient_type,
        recipient_phone: opts.to,
        message: opts.message,
        transporteur_id: opts.transporteur_id ?? null,
        trigger_type: opts.trigger_type,
      }),
    });
  } catch (_) {
    // best-effort; never block payment confirmation on notif failure
  }
}

function buildReceiptPdf(input: {
  gpName: string;
  gpPhone: string;
  dateLabel: string;
  method: string;
  reference: string;
  note?: string | null;
  lines: { tracking: string; route: string; weight: string; amount: number }[];
  total: number;
}): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("RECU DE PAIEMENT YOBBANTE", margin, y);
  y += 26;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Date : ${input.dateLabel}`, margin, y); y += 16;
  doc.text(`Transporteur : ${stripAccents(input.gpName)}`, margin, y); y += 16;
  doc.text(`Telephone : ${input.gpPhone}`, margin, y); y += 24;

  doc.setFont("helvetica", "bold");
  doc.text("Missions :", margin, y); y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const l of input.lines) {
    if (y > 760) { doc.addPage(); y = margin; }
    const line = `${l.tracking}  |  ${stripAccents(l.route)}  |  ${l.weight}kg  |  ${formatXof(l.amount)}`;
    doc.text(line, margin, y);
    y += 14;
  }
  y += 12;

  doc.setDrawColor(0); doc.line(margin, y, 547, y); y += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`TOTAL : ${formatXof(input.total)}`, margin, y); y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Methode : ${input.method}`, margin, y); y += 16;
  doc.text(`Reference : ${input.reference}`, margin, y); y += 16;
  if (input.note && input.note.trim().length > 0) {
    doc.text(`Note : ${stripAccents(input.note.trim())}`, margin, y); y += 16;
  }

  y += 32;
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Yobbante - contact@yobbante.com", margin, y);

  const buf = doc.output("arraybuffer");
  return new Uint8Array(buf);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // -------- auth: staff only --------
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

  // -------- input --------
  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const transporteur_id: string = body.transporteur_id;
  const dossier_ids: string[] = Array.isArray(body.dossier_ids) ? body.dossier_ids : [];
  const method: string = body.method;
  const reference: string = String(body.reference ?? "").trim();
  const note: string | null = body.note ? String(body.note) : null;

  if (!transporteur_id || dossier_ids.length === 0 || !METHOD_LABEL[method] || !reference) {
    return new Response(JSON.stringify({ ok: false, error: "Missing fields" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // -------- fetch GP + dossiers --------
  const { data: gp, error: gpErr } = await admin
    .from("transporteurs")
    .select("id, reference, nom, prenom, telephone_1")
    .eq("id", transporteur_id)
    .single();
  if (gpErr || !gp) {
    return new Response(JSON.stringify({ ok: false, error: "GP not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: dossiers, error: dErr } = await admin
    .from("dossiers")
    .select("id, tracking_id, reference, gp_amount, actual_weight_kg, estimated_weight, destination_city, destination_country, origin_country, status, gp_paid")
    .in("id", dossier_ids)
    .eq("assigned_transporteur_ref", gp.reference);
  if (dErr) {
    return new Response(JSON.stringify({ ok: false, error: dErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const valid = (dossiers ?? []).filter(d => !d.gp_paid && d.status === "DELIVERED" && Number(d.gp_amount) > 0);
  if (valid.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: "Aucun dossier eligible" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = new Date();
  const total = valid.reduce((s, d) => s + Number(d.gp_amount ?? 0), 0);
  const methodLabel = METHOD_LABEL[method];

  // -------- generate PDF --------
  const dateLabel = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const gpDisplay = `${gp.prenom ?? ""} ${gp.nom ?? ""}`.trim() || gp.reference;
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = buildReceiptPdf({
      gpName: gpDisplay,
      gpPhone: gp.telephone_1 ?? "",
      dateLabel,
      method: methodLabel,
      reference,
      note,
      lines: valid.map(d => ({
        tracking: d.tracking_id || d.reference || d.id.slice(0, 8),
        route: `${d.origin_country ?? "—"} -> ${d.destination_city ?? d.destination_country ?? "—"}`,
        weight: String(d.actual_weight_kg ?? d.estimated_weight ?? "—"),
        amount: Number(d.gp_amount),
      })),
      total,
    });
  } catch (e) {
    pdfBytes = new Uint8Array();
    console.error("pdf-error", e);
  }

  // -------- upload PDF --------
  const fileName = `${gp.reference}/${now.toISOString().slice(0, 10)}-${reference.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`;
  let receiptPath: string | null = null;
  if (pdfBytes.byteLength > 0) {
    const { error: upErr } = await admin.storage.from("gp-receipts").upload(fileName, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (!upErr) receiptPath = fileName;
    else console.error("storage-upload-error", upErr);
  }

  // -------- mark dossiers as paid --------
  const updatePayload: Record<string, any> = {
    gp_paid: true,
    gp_paid_at: now.toISOString(),
    gp_payment_method: method,
    gp_payment_ref: reference,
    gp_payment_note: note,
  };
  if (receiptPath) updatePayload.gp_receipt_path = receiptPath;

  const { error: updErr } = await admin
    .from("dossiers")
    .update(updatePayload)
    .in("id", valid.map(d => d.id));
  if (updErr) {
    return new Response(JSON.stringify({ ok: false, error: updErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // -------- WhatsApp notifs (best-effort) --------
  const prenom = stripAccents(gp.prenom ?? gp.nom ?? "cher partenaire").split(" ")[0];
  const linesText = valid
    .map(d => `- ${d.tracking_id || d.reference}: ${formatXof(Number(d.gp_amount))}`)
    .join("\n");
  const gpMsg = valid.length === 1
    ? `Salam ${prenom},\nVotre paiement pour la mission ${valid[0].tracking_id || valid[0].reference} a ete envoye.\nMontant : ${formatXof(total)}\nMethode : ${methodLabel}\nRef : ${reference}\nMerci pour votre service !`
    : `Salam ${prenom},\nPaiement recu pour vos ${valid.length} missions :\n${linesText}\nTotal : ${formatXof(total)}\nMethode : ${methodLabel} - Ref : ${reference}\nMerci !`;

  if (gp.telephone_1) {
    await sendWhatsapp({
      to: gp.telephone_1,
      message: gpMsg,
      recipient_type: "gp",
      transporteur_id: gp.id,
      trigger_type: "gp_payment_confirmed",
    });
  }
  await sendWhatsapp({
    to: ADMIN_NOTIF_PHONE,
    message: `Paiement GP envoye :\n${stripAccents(gpDisplay)} - ${formatXof(total)}\nPour ${valid.length === 1 ? `mission ${valid[0].tracking_id || valid[0].reference}` : `${valid.length} missions`}\nMethode : ${methodLabel} - Ref : ${reference}`,
    recipient_type: "admin",
    trigger_type: "gp_payment_admin_notif",
  });

  return new Response(JSON.stringify({
    ok: true,
    paid_count: valid.length,
    total_xof: total,
    receipt_path: receiptPath,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
