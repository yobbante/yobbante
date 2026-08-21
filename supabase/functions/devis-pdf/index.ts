// devis-pdf — génère un PDF Yobbanté pour un devis et renvoie une URL signée.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

const BRAND = rgb(0.96, 0.77, 0.09);   // #F5C518
const INK = rgb(0.07, 0.09, 0.12);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.85, 0.86, 0.88);

type Line = { label: string; amountFcfa: number };

function fcfa(n: number): string {
  return `${Math.round(n || 0).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')} FCFA`;
}

function frDate(iso: string): string {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const { devis_id } = await req.json().catch(() => ({}));
    if (!devis_id || typeof devis_id !== 'string') {
      return json({ error: 'devis_id requis' }, 400);
    }

    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: d, error } = await supa
      .from('devis')
      .select('id, reference, version, origin, destination, weight_kg, colis_size, mode, breakdown, total_fcfa, valid_until, created_at, notes, engine')
      .eq('id', devis_id)
      .maybeSingle();
    if (error) throw error;
    if (!d) return json({ error: 'devis introuvable' }, 404);

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const reg = await pdf.embedFont(StandardFonts.Helvetica);

    const M = 48;
    const text = (
      s: string,
      x: number,
      y: number,
      size = 10,
      font = reg,
      color = INK,
    ) => page.drawText(s, { x, y, size, font, color });
    const right = (s: string, xEnd: number, y: number, size = 10, font = reg, color = INK) =>
      text(s, xEnd - font.widthOfTextAtSize(s, size), y, size, font, color);

    // Bandeau
    page.drawRectangle({ x: 0, y: height - 110, width, height: 110, color: INK });
    page.drawRectangle({ x: 0, y: height - 116, width, height: 6, color: BRAND });
    text('YOBBANTÉ', M, height - 58, 24, bold, BRAND);
    text('Logistique & expédition — Sénégal / International', M, height - 78, 10, reg, rgb(0.85, 0.86, 0.88));
    right('DEVIS', width - M, height - 58, 20, bold, rgb(1, 1, 1));
    right(`${d.reference}${d.version > 1 ? ` · v${d.version}` : ''}`, width - M, height - 78, 11, reg, BRAND);

    let y = height - 150;

    // Infos
    text('Émis le', M, y, 8, bold, MUTED);
    text(frDate(String(d.created_at).slice(0, 10)), M, y - 14, 11, reg);
    text('Valable jusqu’au', M + 190, y, 8, bold, MUTED);
    text(frDate(d.valid_until), M + 190, y - 14, 11, reg);
    text('Mode', M + 380, y, 8, bold, MUTED);
    text(String(d.mode || '—'), M + 380, y - 14, 11, reg);
    y -= 46;

    // Trajet
    page.drawRectangle({ x: M, y: y - 46, width: width - 2 * M, height: 52, color: rgb(0.97, 0.97, 0.98) });
    text('Trajet', M + 14, y - 8, 8, bold, MUTED);
    text(`${d.origin || '—'}  →  ${d.destination || '—'}`, M + 14, y - 28, 14, bold);
    const measure = d.colis_size
      ? `Colis ${d.colis_size}`
      : d.weight_kg
        ? `${Number(d.weight_kg)} kg`
        : '';
    if (measure) right(measure, width - M - 14, y - 28, 12, bold, MUTED);
    y -= 78;

    // Tableau
    text('DÉTAIL DE LA PRESTATION', M, y, 9, bold, MUTED);
    y -= 12;
    page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 1, color: LINE });
    y -= 22;

    const lines: Line[] = Array.isArray(d.breakdown) ? (d.breakdown as Line[]) : [];
    for (const l of lines) {
      text(String(l.label ?? ''), M, y, 10.5);
      right(fcfa(Number(l.amountFcfa) || 0), width - M, y, 10.5);
      y -= 20;
      page.drawLine({ start: { x: M, y + 6 }, end: { x: width - M, y + 6 }, thickness: 0.5, color: LINE });
    }

    y -= 12;
    page.drawRectangle({ x: M, y: y - 24, width: width - 2 * M, height: 38, color: INK });
    text('TOTAL', M + 14, y - 10, 12, bold, BRAND);
    right(fcfa(Number(d.total_fcfa) || 0), width - M - 14, y - 12, 16, bold, rgb(1, 1, 1));
    y -= 56;

    if (d.notes) {
      text('Notes', M, y, 8, bold, MUTED);
      y -= 14;
      for (const chunk of String(d.notes).match(/.{1,95}/g) ?? []) {
        text(chunk, M, y, 9.5, reg, MUTED);
        y -= 13;
      }
      y -= 8;
    }

    // Conditions
    text('CONDITIONS', M, y, 9, bold, MUTED);
    y -= 16;
    const conds = [
      `Ce devis est valable jusqu’au ${frDate(d.valid_until)}. Passé ce délai, les tarifs peuvent être révisés.`,
      'Le tarif comprend la prise en charge et l’acheminement. Droits et taxes éventuels à destination restent dus.',
      'Marchandises interdites : produits dangereux, périssables non conditionnés, contrefaçons.',
      'Confirmation par retour WhatsApp ou par e-mail avant enlèvement.',
    ];
    for (const c of conds) {
      for (const chunk of c.match(/.{1,105}(\s|$)/g) ?? [c]) {
        text(chunk.trim(), M, y, 9, reg, MUTED);
        y -= 12;
      }
      y -= 2;
    }

    // Pied de page
    page.drawRectangle({ x: 0, y: 0, width, height: 56, color: rgb(0.97, 0.97, 0.98) });
    page.drawRectangle({ x: 0, y: 53, width, height: 3, color: BRAND });
    text('Yobbanté — Dakar, Sénégal', M, 32, 9, bold, INK);
    text('WhatsApp +221 78 460 40 03 · contact@yobbante.com · yobbante.com', M, 18, 9, reg, MUTED);
    right('Merci de votre confiance.', width - M, 25, 9, reg, MUTED);

    const bytes = await pdf.save();
    const path = `${d.reference}/${d.reference}-v${d.version}-${Date.now()}.pdf`;

    const { error: upErr } = await supa.storage
      .from('devis-pdf')
      .upload(path, bytes, { contentType: 'application/pdf', upsert: true });
    if (upErr) throw upErr;

    const { data: signed, error: signErr } = await supa.storage
      .from('devis-pdf')
      .createSignedUrl(path, 60 * 60 * 24 * 30);
    if (signErr) throw signErr;

    return json({
      url: signed?.signedUrl,
      path,
      filename: `Devis-${d.reference}${d.version > 1 ? `-v${d.version}` : ''}.pdf`,
    });
  } catch (e) {
    console.error('devis-pdf error', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
