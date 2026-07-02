// generate-invoice — génère un PDF de facture client, le stocke dans le
// bucket privé `invoices` et envoie le lien au client par WhatsApp.
//
// POST { dossier_id?: string, tracking_id?: string, regenerate?: boolean }
//
// Déclenchée automatiquement par le trigger Postgres
// `dossiers_generate_invoice` quand payment_status passe à 'paid'.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { jsPDF } from 'https://esm.sh/jspdf@2.5.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const NINEA = Deno.env.get('YOBBANTE_NINEA') ?? '—';
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 5; // 5 ans

function stripAccents(s: string) { return (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function fmtXof(n: number | null | undefined) {
  return `${Math.round(Number(n ?? 0)).toLocaleString('fr-FR')} XOF`;
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' }); }
  catch { return '—'; }
}

function buildPdf(d: any, client: any): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = M;

  // Header
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
  doc.text('YOBBANTE', M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Logistique mondiale simplifiee', M, y + 14);
  doc.setTextColor(0);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
  doc.text('FACTURE', W - M, y, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(`N° ${d.invoice_number}`, W - M, y + 16, { align: 'right' });
  doc.text(`Date : ${fmtDate(d.paid_at ?? d.invoice_generated_at)}`, W - M, y + 30, { align: 'right' });

  y += 60;
  doc.setDrawColor(220); doc.line(M, y, W - M, y); y += 18;

  // Émetteur / Client
  const colW = (W - 2 * M) / 2 - 12;
  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.text('EMETTEUR', M, y);
  doc.text('CLIENT', M + colW + 24, y);
  y += 14;
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  const emetteur = [
    'Yobbante', 'Dakar, Senegal', 'contact@yobbante.com',
    '+221 78 607 80 80', `NINEA : ${stripAccents(NINEA)}`,
  ];
  const clientLines = [
    stripAccents(client.name || '—'),
    client.phone || '—',
    client.email || '',
  ].filter(Boolean);

  const lh = 13;
  emetteur.forEach((l, i) => doc.text(l, M, y + i * lh));
  clientLines.forEach((l, i) => doc.text(l, M + colW + 24, y + i * lh));
  y += Math.max(emetteur.length, clientLines.length) * lh + 12;

  // Détails mission
  doc.setDrawColor(220); doc.line(M, y, W - M, y); y += 18;
  doc.setFont('helvetica','bold'); doc.text('DETAILS DE LA MISSION', M, y); y += 14;
  doc.setFont('helvetica','normal');
  const route = `${d.origin_country ?? '—'} → ${d.destination_country ?? '—'}`
    + (d.destination_city ? ` (${stripAccents(d.destination_city)})` : '');
  const details: [string, string][] = [
    ['Reference', d.tracking_id || d.reference || '—'],
    ['Service', stripAccents(d.service_type || 'Envoi de colis')],
    ['Route', route],
    ['Poids estime', d.estimated_weight ? `${d.estimated_weight} kg` : '—'],
    ['Poids reel', d.actual_weight_kg ? `${d.actual_weight_kg} kg` : '—'],
    ['Mode', stripAccents(d.transport_mode || 'Standard')],
  ];
  details.forEach(([k, v]) => {
    doc.setTextColor(120); doc.text(k, M, y);
    doc.setTextColor(0); doc.text(String(v), M + 130, y);
    y += lh;
  });
  y += 6;

  // Tableau montants
  doc.setDrawColor(220); doc.line(M, y, W - M, y); y += 18;
  doc.setFont('helvetica','bold'); doc.text('MONTANTS', M, y); y += 14;
  doc.setFont('helvetica','normal');

  const total = Number(d.final_amount_xof ?? 0)
    || (d.estimated_cost ? Math.round(Number(d.estimated_cost) * 655.957) : 0);
  const base = total; // pas de ventilation détaillée pour l'instant

  const rows: [string, string][] = [
    ['Fret Yobbante', fmtXof(base)],
    ['Enlevement Dakar', 'inclus'],
    [`Livraison ${stripAccents(d.destination_country || '')}`, 'inclus'],
  ];
  rows.forEach(([k, v]) => {
    doc.text(k, M, y);
    doc.text(v, W - M, y, { align: 'right' });
    y += lh;
  });
  doc.setDrawColor(180); doc.line(M, y + 2, W - M, y + 2); y += 16;
  doc.setFont('helvetica','bold');
  doc.text('TOTAL', M, y);
  doc.text(fmtXof(total), W - M, y, { align: 'right' });
  y += 24;

  // Paiement
  doc.setDrawColor(220); doc.line(M, y, W - M, y); y += 18;
  doc.setFont('helvetica','bold'); doc.text('PAIEMENT', M, y); y += 14;
  doc.setFont('helvetica','normal');
  const methodLabel: Record<string,string> = { wave:'Wave', orange_money:'Orange Money', cash:'Especes', card:'Carte bancaire' };
  const pay: [string,string][] = [
    ['Methode', methodLabel[d.payment_method] || stripAccents(d.payment_method || '—')],
    ['Reference', d.payment_provider_ref || '—'],
    ['Date', fmtDate(d.paid_at)],
  ];
  pay.forEach(([k,v]) => {
    doc.setTextColor(120); doc.text(k, M, y);
    doc.setTextColor(0); doc.text(String(v), M + 130, y);
    y += lh;
  });

  // Pied de page
  doc.setTextColor(120); doc.setFontSize(9);
  const footer = [
    'Merci de votre confiance.',
    'Yobbante — Logistique mondiale simplifiee',
    'yobbante.com',
  ];
  let fy = doc.internal.pageSize.getHeight() - M - footer.length * 12;
  footer.forEach((l, i) => doc.text(l, W / 2, fy + i * 12, { align: 'center' }));

  return new Uint8Array(doc.output('arraybuffer'));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

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
    const body = await req.json().catch(() => ({}));
    const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // Resolve dossier
    let q = supa.from('dossiers').select('*').limit(1);
    if (body.dossier_id) q = q.eq('id', body.dossier_id);
    else if (body.tracking_id) q = q.or(`tracking_id.eq.${body.tracking_id},reference.eq.${body.tracking_id}`);
    else return json({ error: 'dossier_id ou tracking_id requis' }, 400);

    const { data: dossier, error } = await q.maybeSingle();
    if (error || !dossier) return json({ error: 'Dossier introuvable' }, 404);

    if (dossier.payment_status !== 'paid') {
      return json({ error: 'Dossier non payé' }, 409);
    }
    if (dossier.invoice_url && !body.regenerate) {
      return json({ ok: true, invoice_url: dossier.invoice_url, invoice_number: dossier.invoice_number, already: true });
    }

    // Resolve client info
    let clientName = dossier.buyer_name || 'Client';
    let clientPhone = dossier.contact_phone || '';
    let clientEmail = '';
    if (dossier.user_id) {
      const { data: prof } = await supa.from('profiles')
        .select('full_name, phone, email').eq('user_id', dossier.user_id).maybeSingle();
      if (prof?.full_name) clientName = prof.full_name;
      if (!clientPhone && prof?.phone) clientPhone = prof.phone;
      if (prof?.email) clientEmail = prof.email;
    }

    // Invoice number (reuse if regenerating)
    let invoiceNumber = dossier.invoice_number;
    if (!invoiceNumber) {
      const { data: numRow } = await supa.rpc('generate_invoice_number');
      invoiceNumber = numRow as unknown as string;
    }

    const dossierForPdf = { ...dossier, invoice_number: invoiceNumber };
    const pdf = buildPdf(dossierForPdf, { name: clientName, phone: clientPhone, email: clientEmail });

    const ref = dossier.tracking_id || dossier.reference || dossier.id;
    const path = `${ref}.pdf`;

    const { error: upErr } = await supa.storage.from('invoices').upload(path, pdf, {
      contentType: 'application/pdf', upsert: true,
    });
    if (upErr) throw upErr;

    const { data: signed, error: signErr } = await supa.storage
      .from('invoices').createSignedUrl(path, SIGNED_URL_TTL);
    if (signErr) throw signErr;
    const invoiceUrl = signed.signedUrl;

    await supa.from('dossiers').update({
      invoice_url: invoiceUrl,
      invoice_number: invoiceNumber,
      invoice_generated_at: new Date().toISOString(),
    }).eq('id', dossier.id);

    // WhatsApp client
    if (clientPhone) {
      const prenom = stripAccents(String(clientName).split(' ')[0] || 'Client');
      const msg = `Bonjour ${prenom},\nVotre facture pour ${ref} est disponible :\n${invoiceUrl}\n\nMerci de votre confiance !`;
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({
            recipient_type: 'client', recipient_phone: clientPhone, message: msg,
            dossier_id: dossier.id, trigger_type: 'invoice_generated',
          }),
        });
      } catch (e) { console.error('send-whatsapp failed', e); }
    }

    return json({ ok: true, invoice_url: invoiceUrl, invoice_number: invoiceNumber });
  } catch (e) {
    console.error('generate-invoice fatal', e);
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
