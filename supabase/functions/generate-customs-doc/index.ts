import { corsHeaders } from '@supabase/supabase-js/cors';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

type Kind = 'proforma_invoice' | 'packing_list' | 'bill_of_lading' | 'customs_declaration' | 'commercial_invoice' | 'certificate_of_origin';

const KIND_LABELS: Record<Kind, string> = {
  proforma_invoice: 'FACTURE PRO FORMA',
  commercial_invoice: 'FACTURE COMMERCIALE',
  packing_list: 'LISTE DE COLISAGE',
  bill_of_lading: 'CONNAISSEMENT',
  customs_declaration: 'DÉCLARATION DOUANIÈRE',
  certificate_of_origin: 'CERTIFICAT D\'ORIGINE',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { dossier_id, kind } = body as { dossier_id: string; kind: Kind };

    if (!dossier_id || !kind || !KIND_LABELS[kind]) {
      return new Response(JSON.stringify({ error: 'invalid_input' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch dossier (RLS will filter)
    const { data: dossier, error: dErr } = await supabase
      .from('dossiers')
      .select('*, business:business_accounts(legal_name, ninea, headquarters_address, admin_email, admin_phone)')
      .eq('id', dossier_id)
      .maybeSingle();

    if (dErr || !dossier) {
      return new Response(JSON.stringify({ error: 'dossier_not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate PDF
    const pdfBytes = await buildPdf(kind, dossier);

    // Upload
    const reference = `${kind.toUpperCase().slice(0, 3)}-${dossier.reference}-${Date.now().toString(36)}`;
    const fileName = `${reference}.pdf`;
    const filePath = `${dossier_id}/customs/${fileName}`;

    const { error: upErr } = await supabase.storage
      .from('dossier-documents')
      .upload(filePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (upErr) {
      console.error('upload error', upErr);
      return new Response(JSON.stringify({ error: 'upload_failed', detail: upErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Record
    const { data: doc, error: insErr } = await supabase
      .from('dossier_customs_documents')
      .insert({
        dossier_id,
        kind,
        file_path: filePath,
        file_name: fileName,
        reference,
        generated_by: user.id,
        metadata: { incoterm: dossier.incoterm, hs_code: dossier.hs_code },
      })
      .select()
      .single();

    if (insErr) {
      console.error('insert error', insErr);
      return new Response(JSON.stringify({ error: 'insert_failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Signed URL
    const { data: signed } = await supabase.storage
      .from('dossier-documents')
      .createSignedUrl(filePath, 3600);

    return new Response(JSON.stringify({ document: doc, url: signed?.signedUrl }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('generate-customs-doc error', err);
    return new Response(JSON.stringify({ error: 'internal', detail: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function buildPdf(kind: Kind, d: any): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const navy = rgb(0.04, 0.06, 0.10);
  const blue = rgb(0.23, 0.51, 0.96);
  const gray = rgb(0.4, 0.4, 0.4);
  const line = rgb(0.85, 0.85, 0.9);

  // Header band
  page.drawRectangle({ x: 0, y: 782, width: 595, height: 60, color: navy });
  page.drawText('YOBBANTÉ', {
    x: 40, y: 810, size: 22, font: bold, color: rgb(1, 1, 1),
  });
  page.drawText('Logistics & Customs', {
    x: 40, y: 793, size: 9, font, color: rgb(0.7, 0.78, 0.95),
  });
  page.drawText(KIND_LABELS[kind], {
    x: 595 - 40 - bold.widthOfTextAtSize(KIND_LABELS[kind], 12),
    y: 810, size: 12, font: bold, color: blue,
  });
  const refText = `Réf. ${d.reference}`;
  page.drawText(refText, {
    x: 595 - 40 - font.widthOfTextAtSize(refText, 9),
    y: 793, size: 9, font, color: rgb(0.7, 0.78, 0.95),
  });

  let y = 750;

  // Issuer / business
  const biz = d.business;
  if (biz) {
    page.drawText('ÉMETTEUR', { x: 40, y, size: 8, font: bold, color: gray });
    y -= 14;
    page.drawText(biz.legal_name ?? '', { x: 40, y, size: 11, font: bold, color: navy });
    y -= 13;
    if (biz.ninea) { page.drawText(`NINEA : ${biz.ninea}`, { x: 40, y, size: 9, font, color: navy }); y -= 12; }
    if (biz.headquarters_address) { page.drawText(biz.headquarters_address, { x: 40, y, size: 9, font, color: navy }); y -= 12; }
    if (biz.admin_email) { page.drawText(biz.admin_email, { x: 40, y, size: 9, font, color: navy }); y -= 12; }
  } else {
    page.drawText('ÉMETTEUR', { x: 40, y, size: 8, font: bold, color: gray });
    y -= 14;
    page.drawText('Particulier', { x: 40, y, size: 11, font: bold, color: navy });
    y -= 12;
  }
  y -= 6;

  // Counterparty box
  const isExport = d.dossier_type === 'business_export';
  const cpLabel = isExport ? 'ACHETEUR' : 'FOURNISSEUR';
  const cpName = isExport ? d.buyer_name : d.supplier_name;
  const cpCountry = isExport ? d.buyer_country : d.supplier_country;
  const cpContact = isExport ? d.buyer_contact : d.supplier_contact;

  page.drawText(cpLabel, { x: 320, y: 750, size: 8, font: bold, color: gray });
  page.drawText(cpName ?? '—', { x: 320, y: 736, size: 11, font: bold, color: navy });
  if (cpCountry) page.drawText(cpCountry, { x: 320, y: 723, size: 9, font, color: navy });
  if (cpContact) page.drawText(cpContact, { x: 320, y: 711, size: 9, font, color: navy });

  // Separator
  page.drawLine({ start: { x: 40, y: y - 8 }, end: { x: 555, y: y - 8 }, thickness: 0.6, color: line });
  y -= 24;

  // Shipment info table
  const rows: [string, string][] = [
    ['Type de dossier', kindToFr(d.dossier_type)],
    ['Origine', `${d.origin_country ?? '—'}`],
    ['Destination', `${d.destination_country ?? '—'}`],
    ['Incoterm', d.incoterm ?? '—'],
    ['Code HS', d.hs_code ?? '—'],
    ['Quantité', d.quantity ? `${d.quantity} ${d.unit ?? ''}`.trim() : '—'],
    ['Poids estimé', d.estimated_weight ? `${d.estimated_weight} kg` : '—'],
    ['Valeur déclarée', d.declared_value ? `${Number(d.declared_value).toFixed(2)} ${d.currency ?? 'EUR'}` : '—'],
  ];
  for (const [k, v] of rows) {
    page.drawText(k, { x: 40, y, size: 9, font, color: gray });
    page.drawText(String(v), { x: 200, y, size: 10, font: bold, color: navy });
    y -= 16;
  }

  y -= 8;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.6, color: line });
  y -= 18;

  // Description
  page.drawText('DESCRIPTION DE LA MARCHANDISE', { x: 40, y, size: 8, font: bold, color: gray });
  y -= 14;
  const desc = (d.product_description ?? '').toString();
  for (const chunk of wrapText(desc, 90)) {
    if (y < 120) break;
    page.drawText(chunk, { x: 40, y, size: 10, font, color: navy });
    y -= 14;
  }

  // Footer block per kind
  if (kind === 'proforma_invoice' || kind === 'commercial_invoice') {
    const total = Number(d.declared_value ?? 0);
    page.drawRectangle({ x: 40, y: 100, width: 515, height: 50, color: rgb(0.96, 0.97, 1) });
    page.drawText('TOTAL HT', { x: 50, y: 128, size: 10, font: bold, color: navy });
    const totalStr = `${total.toFixed(2)} ${d.currency ?? 'EUR'}`;
    page.drawText(totalStr, {
      x: 555 - 10 - bold.widthOfTextAtSize(totalStr, 14),
      y: 124, size: 14, font: bold, color: blue,
    });
    page.drawText('Conditions : paiement avant expédition. Document sans valeur fiscale tant que non signé.', {
      x: 50, y: 108, size: 7, font, color: gray,
    });
  }

  // Footer
  page.drawText(
    `Document généré par Yobbanté · ${new Date().toLocaleString('fr-FR')}`,
    { x: 40, y: 30, size: 8, font, color: gray },
  );
  page.drawText('yobbante.com', {
    x: 555 - font.widthOfTextAtSize('yobbante.com', 8), y: 30, size: 8, font, color: gray,
  });

  return await pdf.save();
}

function kindToFr(t: string): string {
  switch (t) {
    case 'business_import': return 'Import';
    case 'business_export': return 'Export';
    case 'business_sourcing': return 'Sourcing';
    default: return 'Particulier';
  }
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}
