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
  'CENTRE DE COMMANDE YOBBANTE',
  '',
  'VUE :',
  '  STATUS        resume instantane',
  '  DEPARTS       departs actifs + capacites',
  '  DOSSIERS      dossiers actifs',
  '  PAIEMENTS     paiements en attente',
  '  URGENTS       dossiers a traiter',
  '  STATS         statistiques completes',
  '',
  'FICHES :',
  '  DOSSIER YOB-XXXXXX',
  '  GP GP0001',
  '  DEPART 5660',
  '',
  'ACTIONS :',
  '  ASSIGNE YOB-XXXXXX GP0001',
  '  MSG YOB-XXXXXX message libre',
  '  PAYE YOB-XXXXXX        client a paye',
  '  TRANSIT YOB-XXXXXX     passer en transit',
  '  RELANCE YOB-XXXXXX     relancer paiement',
  '  REASSIGNE YOB-XXXXXX GP0001',
  '  VALIDE 5660            valider depart GP',
  '  PAYER YOB-XXXXXX WAVE  payer le GP',
  '',
  'RACCOURCIS :',
  '  R YOB-XXXXXX  relance paiement',
  '  T YOB-XXXXXX  passer en transit',
  '  L YOB-XXXXXX  marquer livre',
  '  C YOB-XXXXXX  confirmer collecte',
  '',
  '1 - Nouveau dossier   STOP - quitter',
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

async function cmdUrgents(adminPhone?: string): Promise<string> {
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
  let gnMap = new Map<string, string>();
  if (gn.length === 0) lines.push('- Aucun');
  else {
    const refs = Array.from(new Set(gn.map((r: any) => r.assigned_transporteur_ref).filter(Boolean)));
    const { data: gps } = await sb.from('transporteurs').select('reference, prenom, nom').in('reference', refs);
    gnMap = new Map((gps ?? []).map((g: any) => [g.reference, `${g.prenom ?? ''} ${g.nom ?? ''}`.trim() || g.reference]));
    for (const r of gn) lines.push(`- ${gnMap.get(r.assigned_transporteur_ref) ?? r.assigned_transporteur_ref} · ${r.tracking_id} · ${r.gp_reminder_count} relances`);
  }

  const hs = hubStuck.data ?? [];
  lines.push('', `AU HUB +5J (${hs.length}) :`);
  if (hs.length === 0) lines.push('- Aucun');
  else for (const r of hs) lines.push(`- ${r.tracking_id} · ${daysAgo(r.updated_at)}j`);

  lines.push('', 'Repondez avec le tracking_id pour les infos completes.');

  // Send interactive list of all urgent tracking_ids
  if (adminPhone) {
    const sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }> = [];
    const mkRow = (tid: string, desc: string) => ({
      id: tid.slice(0, 200),
      title: tid.slice(0, 24),
      description: desc.slice(0, 72),
    });
    if (pg.length) sections.push({ title: 'En attente GP', rows: pg.slice(0, 5).map((r: any) => mkRow(r.tracking_id, `${r.origin_country}->${r.destination_country} ${hoursAgo(r.created_at)}h`)) });
    if (lp.length) sections.push({ title: 'Paiement retard', rows: lp.slice(0, 5).map((r: any) => mkRow(r.tracking_id, `${fmtXof(r.final_amount_xof)} XOF ${hoursAgo(r.weighed_at)}h`)) });
    if (gn.length) sections.push({ title: 'GP injoignable', rows: gn.slice(0, 5).map((r: any) => mkRow(r.tracking_id, `${gnMap.get(r.assigned_transporteur_ref) ?? r.assigned_transporteur_ref} ${r.gp_reminder_count} relances`)) });
    if (hs.length) sections.push({ title: 'Au hub +5j', rows: hs.slice(0, 5).map((r: any) => mkRow(r.tracking_id, `${daysAgo(r.updated_at)}j`)) });
    // Cap to 10 rows total
    let total = 0;
    const capped = sections.map((s) => {
      const take = Math.max(0, Math.min(s.rows.length, 10 - total));
      total += take;
      return { ...s, rows: s.rows.slice(0, take) };
    }).filter((s) => s.rows.length > 0);
    if (capped.length) {
      await sendWaList(
        adminPhone,
        'Selectionnez un dossier pour les infos completes.',
        'Voir dossiers',
        capped,
        'Repondez avec le tracking_id (ex: YOB-XXXXXX) pour les details.',
        'super_admin_urgents_list',
      );
    }
  }

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
//  ADMIN V2 — STATUS / DEPARTS / DOSSIERS / PAIEMENTS / actions
// =================================================================

function clientPhoneOf(d: any): string | null {
  return d?.contact_phone || d?.sender_phone || d?.recipient_phone || null;
}

function clientFirstName(d: any): string {
  const full = d?.sender_name || d?.buyer_name || d?.recipient_name || 'Client';
  return String(full).split(/\s+/)[0];
}

async function notifyClientFromBot(dossier: any, msg: string, trigger: string) {
  const phone = clientPhoneOf(dossier);
  if (!phone) return false;
  await sendWa(phone, msg, { recipient_type: 'client', trigger });
  return true;
}

async function fetchDossier(tracking: string) {
  const { data } = await supa().from('dossiers').select('*')
    .or(`tracking_id.eq.${tracking},reference.eq.${tracking}`).maybeSingle();
  return data;
}

async function cmdStatus(): Promise<string> {
  const sb = supa();
  const monday = new Date(); monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const sundayIso = new Date(monday.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const mondayYmd = monday.toISOString().slice(0, 10);

  const [actifs, pendingPay, gpActifs, departsWeek, unread, top] = await Promise.all([
    sb.from('dossiers').select('id', { count: 'exact', head: true }).not('status', 'in', '(DELIVERED,CANCELLED,ARCHIVED)'),
    sb.from('dossiers').select('final_amount_xof').eq('payment_status', 'pending').not('status', 'in', '(CANCELLED)'),
    sb.from('transporteurs').select('id', { count: 'exact', head: true }).eq('actif', true),
    sb.from('manual_departures').select('id', { count: 'exact', head: true }).gte('departure_date', mondayYmd).lte('departure_date', sundayIso),
    sb.from('whatsapp_inbound_messages').select('id', { count: 'exact', head: true }).eq('is_read', false),
    sb.from('dossiers').select('tracking_id, sender_name, buyer_name, payment_status, status')
      .eq('payment_status', 'pending').not('status', 'in', '(CANCELLED,DELIVERED)')
      .order('created_at').limit(1),
  ]);

  const pendingCount = (pendingPay.data ?? []).length;
  const pendingAmount = (pendingPay.data ?? []).reduce((s, r: any) => s + (Number(r.final_amount_xof) || 0), 0);
  const topRow = (top.data ?? [])[0] as any;
  const topLine = topRow
    ? `${topRow.tracking_id} . ${(topRow.sender_name || topRow.buyer_name || 'Client')} . Paiement en attente`
    : 'Aucun';

  const now = new Date();
  const day = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][now.getDay()];
  return [
    `YOBBANTE . ${day} ${now.toLocaleDateString('fr-FR')} . ${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`,
    '',
    `Dossiers actifs : ${actifs.count ?? 0}`,
    `En attente paiement : ${pendingCount} (${fmtXof(pendingAmount)} FCFA)`,
    `GP actifs : ${gpActifs.count ?? 0}`,
    `Departs semaine : ${departsWeek.count ?? 0}`,
    `Messages non traites : ${unread.count ?? 0}`,
    '',
    `Top priorite : ${topLine}`,
  ].join('\n');
}

async function cmdDeparts(): Promise<string> {
  const sb = supa();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await sb.from('manual_departures')
    .select('short_ref, origin_city, destination_city, origin_country, destination_country, departure_date, max_capacity_kg, total_capacity_kg, available_capacity_kg, transporteur_ref, status')
    .gte('departure_date', today).in('status', ['active', 'OPEN', 'open'])
    .order('departure_date').limit(20);
  const list = (data ?? []);
  if (!list.length) return 'DEPARTS ACTIFS\n\nAucun depart actif a venir.';
  const lines = ['DEPARTS ACTIFS', ''];
  for (const d of list as any[]) {
    const cap = Number(d.max_capacity_kg ?? d.total_capacity_kg ?? 0);
    const dispo = Number(d.available_capacity_kg ?? cap);
    const dt = String(d.departure_date).slice(0, 10).split('-').reverse().slice(0, 2).join('/');
    lines.push(`#${d.short_ref ?? '?'} . ${d.origin_city || d.origin_country} -> ${d.destination_city || d.destination_country}`);
    lines.push(`  ${dt} . ${Math.round(dispo)}kg / ${Math.round(cap)}kg`);
  }
  lines.push('', 'Action : VALIDE [short_ref] . DEPART [short_ref]');
  return lines.join('\n');
}

async function cmdDossiers(): Promise<string> {
  const { data } = await supa().from('dossiers')
    .select('tracking_id, reference, sender_name, buyer_name, status, payment_status, origin_country, destination_country, assigned_transporteur_ref, created_at')
    .not('status', 'in', '(DELIVERED,CANCELLED,ARCHIVED)')
    .order('created_at', { ascending: false }).limit(20);
  const list = (data ?? []);
  if (!list.length) return 'DOSSIERS ACTIFS\n\nAucun.';
  const lines = ['DOSSIERS ACTIFS', ''];
  for (const d of list as any[]) {
    const name = (d.sender_name || d.buyer_name || '—').split(/\s+/).slice(0, 2).join(' ');
    const gp = d.assigned_transporteur_ref ? `[${d.assigned_transporteur_ref}]` : '[sans GP]';
    lines.push(`${d.tracking_id ?? d.reference} . ${name}`);
    lines.push(`  ${d.origin_country}->${d.destination_country} . ${d.status} . ${d.payment_status} ${gp}`);
  }
  lines.push('', 'DOSSIER [tracking] pour la fiche complete');
  return lines.join('\n');
}

async function cmdPaiements(): Promise<string> {
  const { data } = await supa().from('dossiers')
    .select('tracking_id, reference, sender_name, buyer_name, final_amount_xof, status, weighed_at, created_at')
    .eq('payment_status', 'pending').not('status', 'in', '(CANCELLED,DELIVERED)')
    .order('weighed_at', { ascending: true, nullsFirst: false }).limit(20);
  const list = (data ?? []);
  if (!list.length) return 'PAIEMENTS EN ATTENTE\n\nAucun.';
  const lines = ['PAIEMENTS EN ATTENTE', ''];
  let total = 0;
  for (const d of list as any[]) {
    const name = (d.sender_name || d.buyer_name || '—').split(/\s+/).slice(0, 2).join(' ');
    const amt = Number(d.final_amount_xof) || 0;
    total += amt;
    const since = d.weighed_at ? `${hoursAgo(d.weighed_at)}h` : `${hoursAgo(d.created_at)}h`;
    lines.push(`${d.tracking_id ?? d.reference} . ${name} . ${fmtXof(amt)} FCFA . ${since}`);
  }
  lines.push('', `TOTAL : ${fmtXof(total)} FCFA`);
  lines.push('Actions : RELANCE [tracking] . PAYE [tracking]');
  return lines.join('\n');
}

// ----- Action: free message to a dossier client from 607
async function cmdMsgDossier(tracking: string, message: string): Promise<string> {
  const d = await fetchDossier(tracking);
  if (!d) return `Dossier ${tracking} introuvable.`;
  const ok = await notifyClientFromBot(d, message, 'super_admin_msg_to_client');
  if (!ok) return `Aucun numero client pour ${tracking}.`;
  await logEvent(d.id, 'admin_message_to_client', { message });
  return `Message envoye a ${clientFirstName(d)} (${d.tracking_id ?? d.reference}).`;
}

// ----- Action: mark dossier as paid (client paid)
async function cmdPaye(tracking: string): Promise<string> {
  const sb = supa();
  const d = await fetchDossier(tracking);
  if (!d) return `Dossier ${tracking} introuvable.`;
  if (d.payment_status === 'paid') return `${d.tracking_id ?? tracking} deja marque comme paye.`;
  await sb.from('dossiers').update({
    payment_status: 'paid',
    paid_at: new Date().toISOString(),
  }).eq('id', d.id);
  await logEvent(d.id, 'payment_marked_paid_by_super_admin', {});
  const ref = d.tracking_id ?? d.reference;
  await notifyClientFromBot(d,
    `Bonjour ${clientFirstName(d)},\n\nNous confirmons la reception de votre paiement pour le dossier ${ref}.\nMerci de votre confiance.\n\n— Equipe Yobbante`,
    'client_payment_confirmed_admin');
  return `OK ${ref} marque comme paye. Client notifie.`;
}

// ----- Action: move to IN_TRANSIT
async function cmdTransit(tracking: string): Promise<string> {
  const sb = supa();
  const d = await fetchDossier(tracking);
  if (!d) return `Dossier ${tracking} introuvable.`;
  if (d.status === 'IN_TRANSIT') return `${d.tracking_id ?? tracking} deja en transit.`;
  if (d.payment_status !== 'paid' && !d.cash_on_delivery) {
    return `Impossible : paiement non recu pour ${d.tracking_id ?? tracking}.\nUtilisez PAYE ${d.tracking_id ?? tracking} si le client a paye.`;
  }
  const { error } = await sb.from('dossiers').update({
    status: 'IN_TRANSIT',
    departed_at: new Date().toISOString(),
  }).eq('id', d.id);
  if (error) return `Erreur : ${error.message}`;
  await logEvent(d.id, 'status_in_transit_by_super_admin', {});
  const ref = d.tracking_id ?? d.reference;
  await notifyClientFromBot(d,
    `Bonjour ${clientFirstName(d)},\n\nVotre colis ${ref} vient de partir vers ${d.destination_country}.\nVous serez notifie a l arrivee.\n\nSuivi : yobbante.com/suivre/${ref}\n— Yobbante`,
    'client_in_transit_admin');
  return `OK ${ref} passe en IN_TRANSIT. Client notifie.`;
}

// ----- Action: mark delivered
async function cmdLivre(tracking: string): Promise<string> {
  const sb = supa();
  const d = await fetchDossier(tracking);
  if (!d) return `Dossier ${tracking} introuvable.`;
  if (d.status === 'DELIVERED') return `${d.tracking_id ?? tracking} deja livre.`;
  await sb.from('dossiers').update({
    status: 'DELIVERED',
    delivered_at: new Date().toISOString(),
  }).eq('id', d.id);
  await logEvent(d.id, 'status_delivered_by_super_admin', {});
  const ref = d.tracking_id ?? d.reference;
  await notifyClientFromBot(d,
    `Bonjour ${clientFirstName(d)},\n\nVotre colis ${ref} a ete livre.\nMerci de votre confiance.\n\n— Yobbante`,
    'client_delivered_admin');
  return `OK ${ref} marque LIVRE. Client notifie.`;
}

// ----- Action: confirm pickup/collected
async function cmdCollecte(tracking: string): Promise<string> {
  const sb = supa();
  const d = await fetchDossier(tracking);
  if (!d) return `Dossier ${tracking} introuvable.`;
  await sb.from('dossiers').update({
    status: 'COLLECTED',
    collected_at: new Date().toISOString(),
  }).eq('id', d.id);
  await logEvent(d.id, 'status_collected_by_super_admin', {});
  const ref = d.tracking_id ?? d.reference;
  await notifyClientFromBot(d,
    `Bonjour ${clientFirstName(d)},\n\nVotre colis ${ref} a ete collecte.\nProchaine etape : pesee et facturation.\n\n— Yobbante`,
    'client_collected_admin');
  return `OK ${ref} marque COLLECTE. Client notifie.`;
}

// ----- Action: relance paiement
async function cmdRelance(tracking: string): Promise<string> {
  const d = await fetchDossier(tracking);
  if (!d) return `Dossier ${tracking} introuvable.`;
  const ref = d.tracking_id ?? d.reference;
  const amt = Number(d.final_amount_xof) || 0;
  const ok = await notifyClientFromBot(d,
    `Bonjour ${clientFirstName(d)},\n\nRappel amical : votre dossier ${ref} est en attente de paiement.\nMontant : ${fmtXof(amt)} FCFA\n\nReglez en ligne : yobbante.com/payer/${ref}\nOu repondez ici pour Wave / Orange Money.\n\n— Yobbante`,
    'client_payment_reminder_admin');
  if (!ok) return `Aucun numero client pour ${tracking}.`;
  await logEvent(d.id, 'payment_reminder_by_super_admin', { amount: amt });
  return `Relance envoyee a ${clientFirstName(d)} pour ${ref} (${fmtXof(amt)} FCFA).`;
}

// ----- Action: validate GP departure
async function cmdValideDepart(shortRef: string): Promise<string> {
  const sb = supa();
  const refClean = shortRef.replace(/\D/g, '');
  const { data: dep } = await sb.from('manual_departures').select('*').eq('short_ref', refClean).maybeSingle();
  if (!dep) return `Depart #${shortRef} introuvable.`;
  if ((dep as any).status === 'active') return `Depart #${refClean} deja actif.`;
  await sb.from('manual_departures').update({ status: 'active' }).eq('id', (dep as any).id);
  // Notify GP if linked
  if ((dep as any).transporteur_ref) {
    const { data: gp } = await sb.from('transporteurs')
      .select('prenom, telephone_1, whatsapp')
      .eq('reference', (dep as any).transporteur_ref).maybeSingle();
    const phone = (gp as any)?.telephone_1 || (gp as any)?.whatsapp;
    if (phone) {
      await sendWa(phone,
        `Salam ${(gp as any).prenom ?? ''},\n\nVotre depart #${refClean} est valide.\nRoute : ${(dep as any).origin_city ?? (dep as any).origin_country} -> ${(dep as any).destination_city ?? (dep as any).destination_country}\n\nMerci !\n— Yobbante`,
        { recipient_type: 'gp', trigger: 'gp_departure_validated_admin' });
    }
  }
  return `Depart #${refClean} valide. GP notifie.`;
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

  // ----- Tap depuis une liste interactive (list_reply.id = tracking_id pur)
  // Court-circuite toute session pour renvoyer immediatement la fiche du dossier.
  const compact = text.replace(/\s+/g, '');
  const tapped = parseTracking(text);
  if (tapped && compact.length <= 16 && compact.toUpperCase() === tapped) {
    // Memorise le dernier tracking consulte, sans casser une eventuelle session
    try {
      const s = await getSession(phone);
      if (s?.pending_intent && s.pending_intent !== 'confirm_payer') {
        await clearSession(phone);
      }
    } catch (_) { /* noop */ }
    return await cmdInfo(tapped);
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

  // ===== V2 commands: STATUS / DEPARTS / DOSSIERS / PAIEMENTS
  if (upper === 'STATUS') return await cmdStatus();
  if (upper === 'DEPARTS') return await cmdDeparts();
  if (upper === 'DOSSIERS') return await cmdDossiers();
  if (upper === 'PAIEMENTS' || upper === 'PAIEMENT') return await cmdPaiements();

  // DOSSIER {tracking} (alias of INFO)
  if (/^dossier\s+/i.test(text)) {
    const t = parseTracking(text);
    if (!t) return 'Format: DOSSIER YOB-XXXXXX';
    return await cmdInfo(t);
  }

  // ----- Shortcuts: R/T/L/C YOB-XXXXXX
  const sc = text.match(/^([RTLC])\s+([A-Z0-9-]+)$/i);
  if (sc) {
    const t = parseTracking(sc[2]);
    if (!t) return `Format: ${sc[1].toUpperCase()} YOB-XXXXXX`;
    const k = sc[1].toUpperCase();
    if (k === 'R') return await cmdRelance(t);
    if (k === 'T') return await cmdTransit(t);
    if (k === 'L') return await cmdLivre(t);
    if (k === 'C') return await cmdCollecte(t);
  }

  // RELANCE / TRANSIT / LIVRE / COLLECTE / PAYE
  if (/^relance\s+/i.test(text)) {
    const t = parseTracking(text); if (!t) return 'Format: RELANCE YOB-XXXXXX';
    return await cmdRelance(t);
  }
  if (/^transit\s+/i.test(text)) {
    const t = parseTracking(text); if (!t) return 'Format: TRANSIT YOB-XXXXXX';
    return await cmdTransit(t);
  }
  if (/^(livre|livree|delivered)\s+/i.test(text)) {
    const t = parseTracking(text); if (!t) return 'Format: LIVRE YOB-XXXXXX';
    return await cmdLivre(t);
  }
  if (/^(collecte|collected|collecter)\s+/i.test(text)) {
    const t = parseTracking(text); if (!t) return 'Format: COLLECTE YOB-XXXXXX';
    return await cmdCollecte(t);
  }
  if (/^paye\s+/i.test(text)) {
    const t = parseTracking(text); if (!t) return 'Format: PAYE YOB-XXXXXX';
    return await cmdPaye(t);
  }
  if (/^valide\s+/i.test(text)) {
    const arg = text.replace(/^valide\s+/i, '').trim();
    return await cmdValideDepart(arg);
  }

  // INFO {tracking} ou tracking seul
  if (upper.startsWith('INFO')) {
    const t = parseTracking(text) ?? parseTracking(session?.pending_data?.last_tracking ?? '');
    if (!t) return 'Format: INFO YOB-XXXXXX';
    return await cmdInfo(t);
  }
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
  if (upper === 'URGENTS' || text === '3') return await cmdUrgents(phone);

  // DEPART {ref}  (singular = fiche)
  if (/^depart\s+\S+/i.test(text)) {
    const ref = text.replace(/^depart\s+/i, '').trim();
    return await cmdDepart(ref);
  }

  // ASSIGN / ASSIGNE / REASSIGNE {tracking} {gp_ref}
  if (/^(assign|assigne|reassigne)\s+/i.test(text)) {
    const parts = text.split(/\s+/);
    const t = parseTracking(parts[1] ?? '');
    const g = parseGpRef(parts[2] ?? '');
    if (!t || !g) return 'Format: ASSIGNE YOB-XXXXXX GP0001';
    return await cmdAssign(t, g);
  }

  // MSG {tracking|phone} {texte}
  if (/^msg\s+/i.test(text)) {
    const rest = text.replace(/^msg\s+/i, '');
    const tTok = rest.split(/\s+/, 1)[0] ?? '';
    const t = parseTracking(tTok);
    if (t) {
      const msg = rest.slice(tTok.length).trim();
      if (!msg) return 'Format: MSG YOB-XXXXXX votre message';
      return await cmdMsgDossier(t, msg);
    }
    const m = text.match(/^msg\s+(\+?\d[\d\s-]{5,})\s+([\s\S]+)$/i);
    if (!m) return 'Format: MSG YOB-XXXXXX message  ou  MSG 221XXXXXXXXX message';
    return await cmdMsg(m[1].trim(), m[2].trim());
  }

  // PAYER {tracking} {methode} (paiement du GP)
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
