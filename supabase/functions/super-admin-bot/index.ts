// deno-lint-ignore-file no-explicit-any
// SUPER ADMIN BOT (+221784604003) — pouvoirs etendus depuis WhatsApp.
// Commandes : INFO, GP, STATS, URGENTS, DEPART, ASSIGN, MSG, PAYER + wizard "1".
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPER_ADMIN_PHONE = Deno.env.get('SUPER_ADMIN_PHONE')
  || Deno.env.get('ADMIN_WHATSAPP_NUMBER')
  || '+221784604003';

function isSuperAdminPhone(from: string): boolean {
  const n = (from || '').replace(/\D/g, '');
  const sa = SUPER_ADMIN_PHONE.replace(/\D/g, '');
  if (!n || !sa) return false;
  return n === sa || n.endsWith(sa) || sa.endsWith(n);
}

function supa() { return createClient(SUPABASE_URL, SERVICE_ROLE); }

async function sendWa(phone: string, body: string, opts?: { recipient_type?: string; trigger?: string }) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE}` },
      body: JSON.stringify({
        recipient_type: opts?.recipient_type || 'admin',
        recipient_phone: phone,
        text_body: body,
        message: body,
        trigger_type: opts?.trigger || 'super_admin_bot',
      }),
    });
  } catch (e) { console.error('SUPER_ADMIN_BOT send-wa failed', e); }
}

async function sendWaList(
  phone: string,
  bodyText: string,
  listButtonLabel: string,
  sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>,
  fallbackText: string,
  trigger: string,
) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE}` },
      body: JSON.stringify({
        recipient_type: 'admin',
        recipient_phone: phone,
        interactive_type: 'list',
        interactive_body: bodyText,
        list_button_label: listButtonLabel,
        sections,
        fallback_text: fallbackText,
        trigger_type: trigger,
      }),
    });
  } catch (e) { console.error('SUPER_ADMIN_BOT send-list failed', e); }
}

async function logEvent(dossierId: string | null, type: string, data: any) {
  if (!dossierId) return;
  try {
    await supa().from('dossier_events').insert({
      dossier_id: dossierId,
      event_type: type,
      event_data: data,
      visible_to_client: false,
    });
  } catch (e) { console.error('log event err', e); }
}

// =================================================================
//  MENU
// =================================================================

const MENU = [
  'MODE ADMIN YOBBANTE',
  '',
  'INFO : infos completes d un dossier',
  '  Ex: INFO YOB-B4LDWP',
  'GP : infos d un transporteur',
  '  Ex: GP GP0001',
  'STATS : statistiques completes',
  'URGENTS : dossiers a traiter',
  'DEPART : infos d un depart',
  '  Ex: DEPART 5660',
  'ASSIGN : assigner GP a dossier',
  '  Ex: ASSIGN YOB-XXXXXX GP0001',
  'MSG : envoyer message a client/GP',
  '  Ex: MSG 221776916125 votre message',
  'PAYER : marquer paiement GP',
  '  Ex: PAYER YOB-XXXXXX WAVE',
  '',
  '1 - Nouveau dossier',
  '2 - Stats jour',
  '3 - Dossiers urgents',
  'STOP - quitter',
].join('\n');

// =================================================================
//  HELPERS
// =================================================================

function parseTracking(text: string): string | null {
  const m = text.toUpperCase().match(/YOB[-\s]?([A-Z0-9]{6})/);
  if (m) return `YOB-${m[1]}`;
  const m2 = text.toUpperCase().match(/YBT[-\s]?(\d{4})[-\s]?(\d{4})/);
  if (m2) return `YBT-${m2[1]}-${m2[2]}`;
  return null;
}

function parseGpRef(text: string): string | null {
  const m = text.toUpperCase().match(/GP\s*0?(\d{1,5})/);
  if (m) return `GP${m[1].padStart(4, '0')}`;
  return null;
}

function fmtXof(n: any): string {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return '0';
  return Math.round(v).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');
}

function fmtDate(iso: any): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return String(iso); }
}

function hoursAgo(iso: any): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3600_000);
}

function daysAgo(iso: any): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// =================================================================
//  COMMAND: INFO {tracking}
// =================================================================

async function cmdInfo(tracking: string): Promise<string> {
  const sb = supa();
  const { data: d } = await sb
    .from('dossiers')
    .select('*')
    .or(`tracking_id.eq.${tracking},reference.eq.${tracking}`)
    .maybeSingle();
  if (!d) return `Dossier ${tracking} introuvable.`;

  // GP
  let gpLine = 'Non assigne';
  let gpPhone = '—';
  if (d.assigned_transporteur_ref) {
    const { data: gp } = await sb
      .from('transporteurs')
      .select('reference, prenom, nom, telephone_1, whatsapp')
      .eq('reference', d.assigned_transporteur_ref)
      .maybeSingle();
    if (gp) {
      gpLine = `${gp.prenom ?? ''} ${gp.nom ?? ''}`.trim() + ` (Ref ${gp.reference})`;
      gpPhone = gp.telephone_1 || gp.whatsapp || '—';
    } else {
      gpLine = `Ref ${d.assigned_transporteur_ref}`;
    }
  }

  // Depart
  let depLine = '—';
  if (d.assigned_departure_id) {
    const { data: dep } = await sb
      .from('manual_departures')
      .select('short_ref, departure_date, origin_city, destination_city')
      .eq('id', d.assigned_departure_id)
      .maybeSingle();
    if (dep) depLine = `Ref #${dep.short_ref ?? '—'} - ${fmtDate(dep.departure_date).split(' ')[0]}`;
  }

  const margin = (Number(d.final_amount_xof) || 0) - (Number(d.gp_amount) || 0);

  return [
    `DOSSIER ${d.tracking_id ?? d.reference}`,
    '',
    'CLIENT :',
    `Nom : ${d.sender_name ?? d.buyer_name ?? '—'}`,
    `Tel : ${d.sender_phone ?? d.contact_phone ?? '—'}`,
    `Adresse collecte : ${d.sender_address ?? '—'}`,
    `Quartier : ${d.pickup_quartier ?? '—'} (${d.pickup_zone ?? '—'})`,
    '',
    'DESTINATAIRE :',
    `Nom : ${d.recipient_name ?? '—'}`,
    `Tel : ${d.recipient_phone ?? '—'}`,
    `Adresse : ${d.recipient_address ?? '—'}`,
    `Ville : ${d.destination_country ?? '—'}`,
    '',
    'COLIS :',
    `Poids estime : ${d.estimated_weight ?? '—'} kg`,
    `Poids reel : ${d.actual_weight_kg ?? '—'} kg`,
    `Description : ${d.product_description ?? '—'}`,
    `Valeur : ${fmtXof(d.declared_value)} ${d.currency ?? 'XOF'}`,
    '',
    'TRANSPORT :',
    `Statut : ${d.status}`,
    `GP : ${gpLine}`,
    `Tel GP : ${gpPhone}`,
    `Depart : ${depLine}`,
    `Navette : ${d.origin_country ?? '—'} -> ${d.destination_country ?? '—'}`,
    `Mode livraison : ${d.delivery_mode ?? '—'}`,
    '',
    'FINANCES :',
    `Montant client : ${fmtXof(d.final_amount_xof)} XOF`,
    `Tarif GP : ${fmtXof(d.gp_amount)} XOF (paye: ${d.gp_paid ? 'OUI' : 'NON'})`,
    `Marge : ${fmtXof(margin)} XOF`,
    `Paiement : ${d.payment_status}`,
    '',
    'TIMELINE :',
    `Derniere maj : ${fmtDate(d.updated_at)}`,
    `Creee le : ${fmtDate(d.created_at)}`,
    `Source : ${d.source ?? '—'}`,
  ].join('\n');
}

// =================================================================
//  COMMAND: GP {ref}
// =================================================================

async function cmdGp(ref: string): Promise<string> {
  const sb = supa();
  const { data: gp } = await sb
    .from('transporteurs')
    .select('*')
    .or(`reference.eq.${ref},nom.ilike.%${ref}%,prenom.ilike.%${ref}%`)
    .limit(1)
    .maybeSingle();
  if (!gp) return `GP "${ref}" introuvable.`;

  const navettes = Array.isArray(gp.navettes) ? gp.navettes : [];
  const navList = navettes.length
    ? navettes.map((n: any) => `- ${n?.from ?? n?.origin ?? '?'} -> ${n?.to ?? n?.destination ?? '?'}`).join('\n')
    : '- Aucune';

  const rates = (gp.rates_per_city ?? {}) as Record<string, any>;
  const ratesList = Object.keys(rates).length
    ? Object.entries(rates).map(([k, v]) => `${k} : ${fmtXof((v as any)?.rate ?? v)} FCFA/kg`).join('\n')
    : 'Aucun tarif renseigne';

  const { count: activeCount } = await sb
    .from('dossiers')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_transporteur_ref', gp.reference)
    .not('status', 'in', '(DELIVERED,CANCELLED)');

  const { data: missions } = await sb
    .from('dossiers')
    .select('tracking_id, status')
    .eq('assigned_transporteur_ref', gp.reference)
    .not('status', 'in', '(DELIVERED,CANCELLED)')
    .order('created_at', { ascending: false })
    .limit(15);

  const missionsList = (missions ?? []).length
    ? (missions ?? []).map((m: any) => `- ${m.tracking_id} (${m.status})`).join('\n')
    : '- Aucune mission active';

  return [
    `GP : ${gp.prenom ?? ''} ${gp.nom ?? ''} (Ref ${gp.reference})`.trim(),
    `Tel : ${gp.telephone_1 ?? gp.whatsapp ?? '—'}`,
    `Zone Dakar : ${gp.zone ?? '—'}`,
    `Adresse Dakar : ${gp.adresse_collecte_dakar ?? gp.adresse_1 ?? '—'}`,
    `Profil complet : ${gp.profile_complete ? 'OUI' : 'NON'}`,
    `Bot pause : ${gp.bot_paused_until ? `jusqu au ${fmtDate(gp.bot_paused_until)}` : 'non'}`,
    '',
    'NAVETTES :',
    navList,
    '',
    'TARIFS :',
    ratesList,
    '',
    'ACTIVITE :',
    `Dossiers actifs : ${activeCount ?? 0}`,
    `Derniere activite bot : ${fmtDate(gp.last_bot_activity_at)}`,
    '',
    `MISSIONS EN COURS (${(missions ?? []).length}) :`,
    missionsList,
  ].join('\n');
}

// =================================================================
//  COMMAND: STATS
// =================================================================

async function cmdStats(): Promise<string> {
  const sb = supa();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const last7 = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [
    activeC, newC, pendingPayC, noGpC, transitC, deliveredMonth,
    revenueRows, gpToPayRows,
    gpActiveC, gpNoRatesC, livreurC, depMonth,
    unreadC, clients7Rows,
  ] = await Promise.all([
    sb.from('dossiers').select('id', { count: 'exact', head: true }).not('status', 'in', '(DELIVERED,CANCELLED,ARCHIVED)'),
    sb.from('dossiers').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
    sb.from('dossiers').select('id', { count: 'exact', head: true }).eq('payment_status', 'pending').not('status', 'in', '(CANCELLED)'),
    sb.from('dossiers').select('id', { count: 'exact', head: true }).is('assigned_transporteur_ref', null).not('status', 'in', '(DELIVERED,CANCELLED)'),
    sb.from('dossiers').select('id', { count: 'exact', head: true }).eq('status', 'IN_TRANSIT'),
    sb.from('dossiers').select('id', { count: 'exact', head: true }).eq('status', 'DELIVERED').gte('delivered_at', monthStart.toISOString()),
    sb.from('dossiers').select('final_amount_xof, gp_amount, payment_status, gp_paid').gte('created_at', monthStart.toISOString()),
    sb.from('dossiers').select('gp_amount').eq('gp_paid', false).not('gp_amount', 'is', null).gt('gp_amount', 0).in('status', ['DELIVERED', 'IN_TRANSIT', 'ARRIVED']),
    sb.from('transporteurs').select('id', { count: 'exact', head: true }).eq('actif', true),
    sb.from('transporteurs').select('id, rates_per_city').eq('actif', true),
    sb.from('livreurs').select('id', { count: 'exact', head: true }).eq('is_active', true),
    sb.from('manual_departures').select('id', { count: 'exact', head: true }).gte('departure_date', monthStart.toISOString().slice(0, 10)),
    sb.from('whatsapp_inbound_messages').select('id', { count: 'exact', head: true }).eq('is_read', false),
    sb.from('whatsapp_inbound_messages').select('from_phone').eq('channel', 'client').gte('received_at', last7),
  ]);

  let caMonth = 0, marginMonth = 0, pendingAmount = 0;
  for (const r of (revenueRows.data ?? [])) {
    const amt = Number(r.final_amount_xof) || 0;
    const gpa = Number(r.gp_amount) || 0;
    if (r.payment_status === 'paid') { caMonth += amt; marginMonth += amt - gpa; }
    else pendingAmount += amt;
  }
  const gpToPay = (gpToPayRows.data ?? []).reduce((s, r) => s + (Number(r.gp_amount) || 0), 0);
  const gpNoRates = (gpNoRatesC.data ?? []).filter((g: any) => !g.rates_per_city || Object.keys(g.rates_per_city).length === 0).length;
  const clients7 = new Set((clients7Rows.data ?? []).map((r: any) => r.from_phone)).size;

  const today_label = new Date().toLocaleDateString('fr-FR');
  return [
    `STATS YOBBANTE - ${today_label}`,
    '',
    'DOSSIERS :',
    `Total actifs : ${activeC.count ?? 0}`,
    `Nouveaux aujourd hui : ${newC.count ?? 0}`,
    `En attente paiement : ${pendingPayC.count ?? 0}`,
    `GP non assigne : ${noGpC.count ?? 0}`,
    `En transit : ${transitC.count ?? 0}`,
    `Livres ce mois : ${deliveredMonth.count ?? 0}`,
    '',
    'FINANCES :',
    `CA ce mois : ${fmtXof(caMonth)} XOF`,
    `En attente : ${fmtXof(pendingAmount)} XOF`,
    `Marge nette : ${fmtXof(marginMonth)} XOF`,
    `GP a payer : ${fmtXof(gpToPay)} XOF`,
    '',
    'RESEAU :',
    `GP actifs : ${gpActiveC.count ?? 0}`,
    `GP sans tarifs : ${gpNoRates}`,
    `Livreurs actifs : ${livreurC.count ?? 0}`,
    `Departs ce mois : ${depMonth.count ?? 0}`,
    '',
    'MESSAGES :',
    `Non lus : ${unreadC.count ?? 0}`,
    `Clients actifs 7j : ${clients7}`,
  ].join('\n');
}

// =================================================================
//  COMMAND: URGENTS
// =================================================================

async function cmdUrgents(): Promise<string> {
  const sb = supa();
  const now = Date.now();
  const [pendingGp, latePayment, gpNoResp, hubStuck] = await Promise.all([
    sb.from('dossiers').select('tracking_id, origin_country, destination_country, created_at')
      .is('assigned_transporteur_ref', null)
      .in('status', ['SUBMITTED', 'IN_REVIEW', 'AWAITING_CLIENT'])
      .order('created_at').limit(10),
    sb.from('dossiers').select('tracking_id, final_amount_xof, weighed_at')
      .eq('payment_status', 'pending').eq('status', 'WEIGHED')
      .lt('weighed_at', new Date(now - 24 * 3600_000).toISOString())
      .order('weighed_at').limit(10),
    sb.from('dossiers').select('tracking_id, assigned_transporteur_ref, gp_reminder_count')
      .gte('gp_reminder_count', 2).eq('gp_no_response_alert_sent', false)
      .not('assigned_transporteur_ref', 'is', null).limit(10),
    sb.from('dossiers').select('tracking_id, updated_at, status')
      .eq('status', 'ARRIVED_HUB')
      .lt('updated_at', new Date(now - 5 * 86_400_000).toISOString())
      .order('updated_at').limit(10),
  ]);

  const lines: string[] = ['DOSSIERS URGENTS', ''];

  const pg = pendingGp.data ?? [];
  lines.push(`EN ATTENTE GP (${pg.length}) :`);
  if (pg.length === 0) lines.push('- Aucun');
  else for (const r of pg) lines.push(`- ${r.tracking_id} · ${r.origin_country}->${r.destination_country} · ${hoursAgo(r.created_at)}h`);

  const lp = latePayment.data ?? [];
  lines.push('', `PAIEMENT EN RETARD (${lp.length}) :`);
  if (lp.length === 0) lines.push('- Aucun');
  else for (const r of lp) lines.push(`- ${r.tracking_id} · ${fmtXof(r.final_amount_xof)} XOF · ${hoursAgo(r.weighed_at)}h`);

  // GP injoignable : enrich with GP name
  const gn = gpNoResp.data ?? [];
  lines.push('', `GP INJOIGNABLE (${gn.length}) :`);
  if (gn.length === 0) lines.push('- Aucun');
  else {
    const refs = Array.from(new Set(gn.map((r: any) => r.assigned_transporteur_ref).filter(Boolean)));
    const { data: gps } = await sb.from('transporteurs').select('reference, prenom, nom').in('reference', refs);
    const map = new Map((gps ?? []).map((g: any) => [g.reference, `${g.prenom ?? ''} ${g.nom ?? ''}`.trim() || g.reference]));
    for (const r of gn) lines.push(`- ${map.get(r.assigned_transporteur_ref) ?? r.assigned_transporteur_ref} · ${r.tracking_id} · ${r.gp_reminder_count} relances`);
  }

  const hs = hubStuck.data ?? [];
  lines.push('', `AU HUB +5J (${hs.length}) :`);
  if (hs.length === 0) lines.push('- Aucun');
  else for (const r of hs) lines.push(`- ${r.tracking_id} · ${daysAgo(r.updated_at)}j`);

  lines.push('', 'Repondez avec le tracking_id pour les infos completes.');
  return lines.join('\n');
}

// =================================================================
//  COMMAND: DEPART {short_ref}
// =================================================================

async function cmdDepart(ref: string): Promise<string> {
  const sb = supa();
  const refClean = ref.replace(/\D/g, '');
  const { data: dep } = await sb
    .from('manual_departures')
    .select('*')
    .or(`short_ref.eq.${refClean},id.eq.${ref}`)
    .maybeSingle();
  if (!dep) return `Depart "${ref}" introuvable.`;

  let gpInfo = '—';
  let gpPhone = '—';
  if (dep.transporteur_ref) {
    const { data: gp } = await sb.from('transporteurs').select('prenom, nom, telephone_1, whatsapp').eq('reference', dep.transporteur_ref).maybeSingle();
    if (gp) { gpInfo = `${gp.prenom ?? ''} ${gp.nom ?? ''}`.trim() || dep.transporteur_ref; gpPhone = gp.telephone_1 || gp.whatsapp || '—'; }
  }

  const { data: dossiers } = await sb
    .from('dossiers')
    .select('tracking_id, sender_name, buyer_name, actual_weight_kg, estimated_weight, status')
    .eq('assigned_departure_id', dep.id)
    .order('created_at');

  const cap = Number(dep.max_capacity_kg ?? dep.total_capacity_kg ?? 0);
  const used = (dossiers ?? []).reduce((s, d: any) => s + (Number(d.actual_weight_kg) || Number(d.estimated_weight) || 0), 0);
  const list = (dossiers ?? []).length
    ? (dossiers ?? []).map((d: any) => `- ${d.tracking_id} · ${d.sender_name ?? d.buyer_name ?? '—'} · ${(d.actual_weight_kg ?? d.estimated_weight ?? '?')}kg · ${d.status}`).join('\n')
    : '- Aucun colis';

  return [
    `DEPART Ref #${dep.short_ref ?? dep.id.slice(0, 8)}`,
    `Route : ${dep.origin_city ?? dep.origin_country} -> ${dep.destination_city ?? dep.destination_country}`,
    `Date : ${fmtDate(dep.departure_date).split(' ')[0]}`,
    `GP : ${gpInfo} (${gpPhone})`,
    `Capacite : ${cap}kg`,
    `Utilise : ${used}kg`,
    `Disponible : ${Math.max(0, cap - used)}kg`,
    `Statut : ${dep.status}`,
    '',
    `COLIS ASSIGNES (${(dossiers ?? []).length}) :`,
    list,
    '',
    `Total : ${used}kg`,
  ].join('\n');
}

// =================================================================
//  COMMAND: ASSIGN {tracking} {gp_ref}
// =================================================================

async function cmdAssign(tracking: string, gpRef: string): Promise<string> {
  const sb = supa();
  const { data: d } = await sb.from('dossiers').select('id, tracking_id, reference, sender_name, recipient_name, buyer_name, contact_phone, sender_phone, recipient_phone, sender_address, origin_country, destination_country, estimated_weight, pickup_date')
    .or(`tracking_id.eq.${tracking},reference.eq.${tracking}`).maybeSingle();
  if (!d) return `Dossier ${tracking} introuvable.`;

  const { data: gp } = await sb.from('transporteurs').select('id, reference, prenom, nom, telephone_1, whatsapp').eq('reference', gpRef).maybeSingle();
  if (!gp) return `GP ${gpRef} introuvable.`;

  await sb.from('dossiers').update({
    assigned_transporteur_ref: gp.reference,
    status: 'ASSIGNED',
    gp_reminded_at: new Date().toISOString(),
  }).eq('id', d.id);

  await logEvent(d.id, 'gp_assigned_by_super_admin', { gp_ref: gp.reference });

  // Notif GP
  const gpPhone = gp.telephone_1 || gp.whatsapp;
  const clientPhone = d.contact_phone || d.sender_phone || d.recipient_phone || '—';
  const ref = d.tracking_id || d.reference;
  if (gpPhone) {
    const gpMsg = [
      `Salam ${gp.prenom ?? ''},`.trim(),
      ``,
      `Nouveau colis assigne.`,
      `Ref : ${ref}`,
      `Route : ${d.origin_country} -> ${d.destination_country}`,
      `Client : ${d.sender_name ?? d.buyer_name ?? '—'}`,
      `Tel client : ${clientPhone}`,
      d.sender_address ? `Adresse collecte client : ${d.sender_address}` : null,
      ``,
      `(Notre livreur deposera le colis a votre adresse Dakar avant le depart.)`,
      ``,
      `Poids : ${d.estimated_weight ?? '?'}kg`,
      `Date depart : ${d.pickup_date ? fmtDate(d.pickup_date).split(' ')[0] : 'a confirmer'}`,
      ``,
      `Confirmez reception : RECU ${ref}`,
    ].filter(Boolean).join('\n');
    await sendWa(gpPhone, gpMsg, { recipient_type: 'gp', trigger: 'gp_assignment_super_admin' });
  }

  // Notif client
  if (clientPhone && clientPhone !== '—') {
    const prenom = (d.sender_name || d.buyer_name || d.recipient_name || 'Client').split(/\s+/)[0];
    const clientMsg = [
      `Bonjour ${prenom},`,
      ``,
      `Votre dossier ${ref} a ete confie a notre transporteur ${(gp.prenom ?? '') + ' ' + (gp.nom ?? '')}.`,
      `Route : ${d.origin_country} -> ${d.destination_country}`,
      ``,
      `Notre equipe passera collecter votre colis a votre adresse.`,
      `Suivi : yobbante.com/suivre/${ref}`,
      ``,
      `— Equipe Yobbante`,
    ].join('\n');
    await sendWa(clientPhone, clientMsg, { recipient_type: 'client', trigger: 'client_gp_assigned_super_admin' });
  }

  return `GP ${(gp.prenom ?? '') + ' ' + (gp.nom ?? '')} assigne a ${ref}.\nGP et client notifies.`;
}

// =================================================================
//  COMMAND: MSG {phone} {texte}
// =================================================================

async function cmdMsg(phone: string, message: string): Promise<string> {
  const sb = supa();
  const tail = phone.replace(/\D/g, '').slice(-9);
  if (tail.length < 6) return `Numero invalide.`;

  // GP ?
  const { data: gp } = await sb.from('transporteurs')
    .select('id, prenom, nom, telephone_1, whatsapp')
    .or(`telephone_1.ilike.%${tail}%,whatsapp.ilike.%${tail}%`).limit(1).maybeSingle();

  if (gp) {
    await sendWa(phone, message, { recipient_type: 'gp', trigger: 'super_admin_manual_msg' });
    return `Message envoye a ${(gp.prenom ?? '') + ' ' + (gp.nom ?? '')} depuis le numero GP (122).`;
  }

  // Client (par defaut)
  let clientName = phone;
  const { data: cli } = await sb.from('dossiers').select('sender_name, buyer_name')
    .or(`contact_phone.ilike.%${tail}%,sender_phone.ilike.%${tail}%,recipient_phone.ilike.%${tail}%`)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (cli) clientName = (cli.sender_name || cli.buyer_name || phone);

  await sendWa(phone, message, { recipient_type: 'client', trigger: 'super_admin_manual_msg' });
  return `Message envoye a ${clientName} depuis le numero client (607).`;
}

// =================================================================
//  COMMAND: PAYER {tracking} {methode}
// =================================================================

async function cmdPayerConfirm(tracking: string, method: string): Promise<{ reply: string; data?: any }> {
  const sb = supa();
  const m = method.toUpperCase();
  if (!['WAVE', 'OM', 'ORANGE', 'CASH', 'ESPECES', 'VIREMENT'].includes(m)) {
    return { reply: `Methode invalide. Utilisez WAVE, OM, CASH, VIREMENT.` };
  }
  const { data: d } = await sb.from('dossiers').select('id, tracking_id, reference, gp_amount, gp_paid, assigned_transporteur_ref')
    .or(`tracking_id.eq.${tracking},reference.eq.${tracking}`).maybeSingle();
  if (!d) return { reply: `Dossier ${tracking} introuvable.` };
  if (!d.gp_amount || Number(d.gp_amount) <= 0) return { reply: `Aucun tarif GP defini pour ${tracking}.` };
  if (d.gp_paid) return { reply: `GP deja paye pour ${tracking}.` };
  if (!d.assigned_transporteur_ref) return { reply: `Aucun GP assigne a ${tracking}.` };

  const { data: gp } = await sb.from('transporteurs').select('prenom, nom').eq('reference', d.assigned_transporteur_ref).maybeSingle();
  const gpName = gp ? `${gp.prenom ?? ''} ${gp.nom ?? ''}`.trim() : d.assigned_transporteur_ref;
  const methodLabel = m === 'OM' || m === 'ORANGE' ? 'Orange Money' : m === 'CASH' || m === 'ESPECES' ? 'Cash' : m === 'VIREMENT' ? 'Virement' : 'Wave';

  return {
    reply: `Confirmer paiement ${fmtXof(d.gp_amount)} XOF a ${gpName} via ${methodLabel} pour ${d.tracking_id ?? d.reference} ?\nOUI pour valider, NON pour annuler.`,
    data: { dossier_id: d.id, tracking: d.tracking_id ?? d.reference, method: m, methodLabel, amount: Number(d.gp_amount), gpName, gpRef: d.assigned_transporteur_ref },
  };
}

async function cmdPayerExecute(payload: any): Promise<string> {
  const sb = supa();
  const m = payload.method;
  const methodColMap: Record<string, string> = { WAVE: 'wave', OM: 'orange_money', ORANGE: 'orange_money', CASH: 'cash', ESPECES: 'cash', VIREMENT: 'bank' };
  await sb.from('dossiers').update({
    gp_paid: true,
    gp_paid_at: new Date().toISOString(),
    gp_payment_method: methodColMap[m] ?? m.toLowerCase(),
  }).eq('id', payload.dossier_id);

  await logEvent(payload.dossier_id, 'gp_paid_by_super_admin', { method: payload.method, amount: payload.amount });

  // Notifier GP
  const { data: gp } = await sb.from('transporteurs').select('telephone_1, whatsapp, prenom').eq('reference', payload.gpRef).maybeSingle();
  const phone = gp?.telephone_1 || gp?.whatsapp;
  if (phone) {
    const msg = `Salam ${gp?.prenom ?? ''},\n\nVotre paiement de ${fmtXof(payload.amount)} XOF pour ${payload.tracking} a ete effectue via ${payload.methodLabel}.\n\nMerci de votre partenariat.\n— Yobbante`;
    await sendWa(phone, msg, { recipient_type: 'gp', trigger: 'gp_payment_confirmed_super_admin' });
  }

  return `Paiement ${fmtXof(payload.amount)} XOF a ${payload.gpName} valide (${payload.methodLabel}).\nGP notifie.`;
}

// =================================================================
//  WIZARD "1 - Nouveau dossier"
// =================================================================

const TYPE_PROMPT = [
  'Quel type de demande ?',
  '',
  '1 - Expedition (envoi depuis Dakar)',
  '2 - Reception (colis depuis l etranger)',
  '3 - Sourcing (achat a l etranger)',
].join('\n');

function parseType(input: string): 'expedier' | 'recevoir' | 'sourcing' | null {
  const t = input.trim().toLowerCase();
  if (t === '1' || t.startsWith('exp')) return 'expedier';
  if (t === '2' || t.startsWith('rec')) return 'recevoir';
  if (t === '3' || t.startsWith('sour')) return 'sourcing';
  return null;
}

function nextStepPrompt(type: string, step: string): string {
  if (type === 'sourcing') {
    if (step === 'client_name') return 'Nom du client ?';
    if (step === 'client_phone') return 'Telephone du client ?';
    if (step === 'product') return 'Quel produit ?';
    if (step === 'sourcing_country') return 'Pays d achat ? (ex: CN, FR, US)';
    if (step === 'budget') return 'Budget en EUR ? (- pour ignorer)';
  } else if (type === 'recevoir') {
    if (step === 'client_name') return 'Nom du destinataire a Dakar ?';
    if (step === 'client_phone') return 'Telephone du destinataire ?';
    if (step === 'origin_country') return 'Pays d origine ? (ex: CN, FR)';
    if (step === 'product') return 'Description du colis ?';
    if (step === 'weight') return 'Poids estime en kg ? (- pour ignorer)';
  } else {
    if (step === 'client_name') return 'Nom de l expediteur ?';
    if (step === 'client_phone') return 'Telephone de l expediteur ?';
    if (step === 'destination') return 'Pays de destination ? (ex: FR, US)';
    if (step === 'product') return 'Description du colis ?';
    if (step === 'weight') return 'Poids estime en kg ?';
  }
  return '';
}

function stepsFor(type: string): string[] {
  if (type === 'sourcing') return ['client_name', 'client_phone', 'product', 'sourcing_country', 'budget'];
  if (type === 'recevoir') return ['client_name', 'client_phone', 'origin_country', 'product', 'weight'];
  return ['client_name', 'client_phone', 'destination', 'product', 'weight'];
}

async function findAdminUserId(): Promise<string | null> {
  const { data } = await supa().from('user_roles').select('user_id').eq('role', 'admin').limit(1).maybeSingle();
  return (data as any)?.user_id || null;
}

async function createDossierFromSession(phone: string, dataObj: any): Promise<string | null> {
  const sb = supa();
  const type = dataObj.type as string;
  const adminId = await findAdminUserId();
  if (!adminId) return null;
  const insertRow: any = {
    user_id: adminId, intake_by: adminId, intake_method: 'manual_intake',
    source: 'whatsapp', app_source: type, needs_sourcing: type === 'sourcing',
    contact_phone: dataObj.client_phone || null,
    buyer_name: dataObj.client_name || null,
    buyer_contact: dataObj.client_phone || null,
    origin_country: type === 'recevoir' ? (dataObj.origin_country || 'FR').slice(0, 2).toUpperCase() : 'SN',
    destination_country: type === 'expedier' ? (dataObj.destination || 'FR').slice(0, 2).toUpperCase() : 'SN',
    product_description: dataObj.product || `Demande ${type} via super-admin bot`,
    estimated_weight: dataObj.weight ? Number(dataObj.weight) : null,
    budget_eur: dataObj.budget ? Number(dataObj.budget) : null,
    notes: `Source: bot super-admin (${phone})\nClient: ${dataObj.client_name || '—'}`,
    status: 'SUBMITTED' as any,
  };
  const { data, error } = await sb.from('dossiers').insert(insertRow).select('id, reference').single();
  if (error) { console.error('SUPER_ADMIN_BOT insert dossier failed', error); return null; }
  return (data as any).reference;
}

// =================================================================
//  SESSION
// =================================================================

async function getSession(phone: string) {
  const { data } = await supa().from('super_admin_sessions').select('*').eq('from_phone', phone).maybeSingle();
  return data;
}

async function saveSession(phone: string, intent: string | null, step: string | null, dataObj: any) {
  const sb = supa();
  const { data: existing } = await sb.from('super_admin_sessions').select('id').eq('from_phone', phone).maybeSingle();
  const payload: any = {
    from_phone: phone, pending_intent: intent, pending_step: step,
    pending_data: dataObj, updated_at: new Date().toISOString(),
  };
  if (existing) await sb.from('super_admin_sessions').update(payload).eq('id', (existing as any).id);
  else await sb.from('super_admin_sessions').insert(payload);
}

async function clearSession(phone: string) {
  await supa().from('super_admin_sessions').delete().eq('from_phone', phone);
}

// =================================================================
//  MAIN DISPATCH
// =================================================================

async function handleMessage(phone: string, raw: string): Promise<string> {
  const text = (raw || '').trim();
  const lower = text.toLowerCase();
  const upper = text.toUpperCase();

  if (['menu', 'aide', 'help', 'bonjour', 'salut', 'start'].includes(lower)) {
    await clearSession(phone); return MENU;
  }
  if (['stop', 'annuler', 'cancel', 'sortir'].includes(lower)) {
    await clearSession(phone); return 'OK, session terminee. Tape MENU pour revenir.';
  }

  const session = await getSession(phone);

  // ----- Session: confirmation paiement
  if (session?.pending_intent === 'confirm_payer') {
    if (['oui', 'yes', 'ok', 'y', 'o'].includes(lower)) {
      const r = await cmdPayerExecute(session.pending_data);
      await clearSession(phone); return r;
    }
    if (['non', 'no', 'n', 'cancel', 'annuler'].includes(lower)) {
      await clearSession(phone); return 'Paiement annule.';
    }
    return 'Repondez OUI pour valider ou NON pour annuler.';
  }

  // ----- Commandes directes (avant wizard)
  // INFO {tracking}  ou tracking seul
  if (upper.startsWith('INFO')) {
    const t = parseTracking(text) ?? parseTracking(session?.pending_data?.last_tracking ?? '');
    if (!t) return 'Format: INFO YOB-XXXXXX';
    return await cmdInfo(t);
  }
  // Tracking seul = INFO
  const trackingAlone = parseTracking(text);
  if (trackingAlone && text.replace(/\s+/g, '').length <= 16) {
    return await cmdInfo(trackingAlone);
  }

  // GP {ref|nom}
  if (/^gp\s+\S+/i.test(text)) {
    const arg = text.replace(/^gp\s+/i, '').trim();
    const ref = parseGpRef(arg) ?? arg;
    return await cmdGp(ref);
  }

  if (upper === 'STATS') return await cmdStats();
  if (upper === 'URGENTS' || text === '3') return await cmdUrgents();

  // DEPART {ref}
  if (/^depart\s+\S+/i.test(text)) {
    const ref = text.replace(/^depart\s+/i, '').trim();
    return await cmdDepart(ref);
  }

  // ASSIGN {tracking} {gp_ref}
  if (/^assign\s+/i.test(text)) {
    const parts = text.split(/\s+/);
    const t = parseTracking(parts[1] ?? '');
    const g = parseGpRef(parts[2] ?? '');
    if (!t || !g) return 'Format: ASSIGN YOB-XXXXXX GP0001';
    return await cmdAssign(t, g);
  }

  // MSG {phone} {texte}
  if (/^msg\s+/i.test(text)) {
    const m = text.match(/^msg\s+(\+?\d[\d\s-]{5,})\s+([\s\S]+)$/i);
    if (!m) return 'Format: MSG 221776916125 votre message';
    return await cmdMsg(m[1].trim(), m[2].trim());
  }

  // PAYER {tracking} {methode}
  if (/^payer\s+/i.test(text)) {
    const parts = text.split(/\s+/);
    const t = parseTracking(parts[1] ?? '');
    const method = (parts[2] ?? '').toUpperCase();
    if (!t || !method) return 'Format: PAYER YOB-XXXXXX WAVE';
    const r = await cmdPayerConfirm(t, method);
    if (r.data) await saveSession(phone, 'confirm_payer', null, r.data);
    return r.reply;
  }

  // ----- Wizard new_dossier
  if (!session?.pending_intent) {
    if (text === '1') {
      await saveSession(phone, 'new_dossier', 'type', {});
      return TYPE_PROMPT;
    }
    if (text === '2') {
      return await cmdStats();
    }
    return MENU;
  }

  if (session.pending_intent === 'new_dossier') {
    const dataObj = (session.pending_data || {}) as any;
    const step = session.pending_step as string;
    if (step === 'type') {
      const t = parseType(text);
      if (!t) return 'Choix invalide.\n' + TYPE_PROMPT;
      dataObj.type = t;
      const steps = stepsFor(t);
      await saveSession(phone, 'new_dossier', steps[0], dataObj);
      return nextStepPrompt(t, steps[0]);
    }
    if (text && text !== '-') dataObj[step] = text;
    const type = dataObj.type as string;
    const steps = stepsFor(type);
    const idx = steps.indexOf(step);
    if (idx === -1 || idx === steps.length - 1) {
      const ref = await createDossierFromSession(phone, dataObj);
      await clearSession(phone);
      if (!ref) return 'Echec creation dossier.';
      return `Dossier ${ref} cree (${type}).\nTape MENU pour une autre action.`;
    }
    const nextStep = steps[idx + 1];
    await saveSession(phone, 'new_dossier', nextStep, dataObj);
    return nextStepPrompt(type, nextStep);
  }

  return MENU;
}

// =================================================================
//  SERVE
// =================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const fromPhone = body.from_phone || '';

    if (!isSuperAdminPhone(fromPhone)) {
      console.warn('SUPER_ADMIN_BOT rejected non-admin', fromPhone);
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    const message = body.message || '';
    console.log('SUPER_ADMIN_BOT IN', fromPhone, message);
    const reply = await handleMessage(fromPhone, message);
    if (reply) await sendWa(fromPhone, reply);
    return new Response(JSON.stringify({ ok: true, reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('SUPER_ADMIN_BOT error', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
