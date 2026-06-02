// cron-daily-report — Sends WhatsApp summary reports to admin
// Triggered by pg_cron 2x/day (8h, 20h Dakar) + weekly Sunday 20h
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_PHONE = '+221784604003';

function safeCount(p: Promise<{ count: number | null }>): Promise<number> {
  return p.then((r) => r.count ?? 0).catch((e) => {
    console.error('count error', e);
    return 0;
  });
}

function todayDakarISO(offsetDays = 0): string {
  // Dakar = UTC+0
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function formatDateFR(): string {
  const d = new Date();
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

async function sendMessage(supa: any, message: string) {
  try {
    const { data, error } = await supa.functions.invoke('send-whatsapp', {
      body: {
        recipient_phone: ADMIN_PHONE,
        recipient_type: 'admin',
        message,
        trigger_type: 'cron_report',
      },
    });
    if (error) console.error('send-whatsapp error', error);
    return { ok: !error, data, error };
  } catch (e) {
    console.error('invoke failed', e);
    return { ok: false, error: String(e) };
  }
}

async function buildMorningReport(supa: any): Promise<string> {
  const today = todayDakarISO(0);
  const weekEnd = new Date(Date.now() + 7 * 86400 * 1000).toISOString().slice(0, 10);
  const todayYmd = today.slice(0, 10);
  const weekStart = todayDakarISO(-7);

  const [actifs, paiement, blocHub, msgs, gpActifs] = await Promise.all([
    safeCount(supa.from('dossiers').select('*', { count: 'exact', head: true })
      .not('status', 'in', '(DELIVERED,ARCHIVED,CANCELLED)')),
    safeCount(supa.from('dossiers').select('*', { count: 'exact', head: true })
      .eq('payment_status', 'pending').not('status', 'in', '(CANCELLED,DELIVERED)')),
    safeCount(supa.from('dossiers').select('*', { count: 'exact', head: true })
      .eq('status', 'ARRIVED_HUB').lt('updated_at', new Date(Date.now() - 5 * 86400 * 1000).toISOString())),
    safeCount(supa.from('whatsapp_inbound_messages').select('*', { count: 'exact', head: true })
      .eq('is_read', false)),
    safeCount(supa.from('transporteurs').select('*', { count: 'exact', head: true }).eq('actif', true)),
  ]);

  // Departs semaine
  const { data: deps } = await supa.from('manual_departures')
    .select('short_ref, destination_city, destination_country, departure_date, available_capacity_kg, max_capacity_kg, total_capacity_kg')
    .gte('departure_date', todayYmd).lte('departure_date', weekEnd)
    .in('status', ['active', 'OPEN', 'open']).order('departure_date').limit(10);
  const depLines = (deps ?? []).length
    ? (deps as any[]).map((d) => {
        const dt = String(d.departure_date).split('-').reverse().slice(0, 2).join('/');
        const dispo = Math.round(Number(d.available_capacity_kg ?? d.max_capacity_kg ?? d.total_capacity_kg ?? 0));
        return `. ${d.destination_city || d.destination_country} ${dt} . ${dispo}kg dispo`;
      }).join('\n')
    : '. Aucun';

  // Finances
  const { data: pendingRows } = await supa.from('dossiers')
    .select('final_amount_xof').eq('payment_status', 'pending').not('status', 'in', '(CANCELLED,DELIVERED)');
  const pendingAmt = (pendingRows ?? []).reduce((s: number, r: any) => s + (Number(r.final_amount_xof) || 0), 0);
  const { data: paidWeek } = await supa.from('dossiers')
    .select('final_amount_xof').eq('payment_status', 'paid').gte('paid_at', weekStart);
  const paidAmt = (paidWeek ?? []).reduce((s: number, r: any) => s + (Number(r.final_amount_xof) || 0), 0);

  // Action requise : 1er dossier en attente paiement
  const { data: topPay } = await supa.from('dossiers')
    .select('tracking_id, reference').eq('payment_status', 'pending')
    .not('status', 'in', '(CANCELLED,DELIVERED)').order('created_at').limit(1);
  const topAction = (topPay ?? [])[0]
    ? `. ${(topPay as any[])[0].tracking_id || (topPay as any[])[0].reference} . Paiement pending\n  Action : RELANCE ${(topPay as any[])[0].tracking_id || (topPay as any[])[0].reference}`
    : '. Aucune action prioritaire';

  const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');
  const now = new Date();
  const day = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][now.getDay()];

  return [
    `YOBBANTE . ${day} ${formatDateFR()} . 08h00`,
    '',
    'DOSSIERS :',
    `. ${actifs} actifs`,
    `. ${paiement} en attente paiement`,
    `. ${blocHub} bloque au hub`,
    '',
    'DEPARTS SEMAINE :',
    depLines,
    '',
    `GP ACTIFS : ${gpActifs}`,
    '',
    'FINANCES :',
    `. En attente : ${fmt(pendingAmt)} FCFA`,
    `. Encaisse semaine : ${fmt(paidAmt)} FCFA`,
    '',
    'MESSAGES :',
    `. ${msgs} conversations non traitees`,
    '',
    'ACTION REQUISE :',
    topAction,
    '',
    'Commandes : STATUS . DEPARTS . DOSSIERS . PAIEMENTS',
  ].join('\n');
}


async function buildEveningReport(supa: any): Promise<string> {
  const today = todayDakarISO(0);

  const [nouvelles, collectees, livrees, msgs, paidRows] = await Promise.all([
    safeCount(supa.from('dossiers').select('*', { count: 'exact', head: true })
      .gte('created_at', today)),
    safeCount(supa.from('dossiers').select('*', { count: 'exact', head: true })
      .eq('status', 'COLLECTED').gte('collected_at', today)),
    safeCount(supa.from('dossiers').select('*', { count: 'exact', head: true })
      .eq('status', 'DELIVERED').gte('delivered_at', today)),
    safeCount(supa.from('whatsapp_inbound_messages').select('*', { count: 'exact', head: true })
      .eq('is_read', false)),
    supa.from('dossiers').select('final_amount_xof')
      .eq('payment_status', 'paid').gte('paid_at', today),
  ]);

  const paid = (paidRows?.data ?? []) as any[];
  const paidCount = paid.length;
  const paidAmt = paid.reduce((s, r) => s + (Number(r.final_amount_xof) || 0), 0);
  const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');

  return [
    `BILAN YOBBANTE . ${formatDateFR()} . 20h`,
    '',
    `Commandes aujourd hui : ${Math.round(nouvelles)}`,
    `Collectes confirmees : ${Math.round(collectees)}`,
    `Livraisons : ${Math.round(livrees)}`,
    `Paiements recus : ${paidCount} . ${fmt(paidAmt)} FCFA`,
    `Messages non traites : ${Math.round(msgs)}`,
    '',
    'Bonne soiree !',
  ].join('\n');
}


async function buildWeeklyReport(supa: any): Promise<string> {
  const weekStart = todayDakarISO(-7);

  const [recues, livrees, actifs] = await Promise.all([
    safeCount(supa.from('dossiers').select('*', { count: 'exact', head: true })
      .gte('created_at', weekStart)),
    safeCount(supa.from('dossiers').select('*', { count: 'exact', head: true })
      .eq('status', 'DELIVERED').gte('delivered_at', weekStart)),
    safeCount(supa.from('dossiers').select('*', { count: 'exact', head: true })
      .not('status', 'in', '(DELIVERED,ARCHIVED,CANCELLED)')),
  ]);

  // GP actifs cette semaine (messages entrants depuis GP)
  let gpActifs = 0;
  try {
    const { data } = await supa
      .from('gp_bot_sessions')
      .select('transporteur_id')
      .gte('updated_at', weekStart);
    const unique = new Set((data ?? []).map((r: any) => r.transporteur_id).filter(Boolean));
    gpActifs = unique.size;
  } catch (e) {
    console.error('gp count error', e);
  }

  // Top 3 routes cette semaine
  let topRoutes = 'N/A';
  try {
    const { data } = await supa
      .from('dossiers')
      .select('origin_country,destination_country')
      .gte('created_at', weekStart);
    const counts = new Map<string, number>();
    for (const r of data ?? []) {
      const k = `${r.origin_country}->${r.destination_country}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (top.length) topRoutes = top.map(([k, n]) => `${k} (${n})`).join(', ');
  } catch (e) {
    console.error('routes error', e);
  }

  return `Bilan semaine Yobbante :
Commandes : ${Math.round(recues)}
Livrees : ${Math.round(livrees)}
En cours : ${Math.round(actifs)}
GP actifs : ${gpActifs}
Routes top 3 : ${topRoutes}
Bonne semaine !`;
}

async function sendKeepaliveTemplate(supa: any) {
  // Verifie la derniere reception entrante de la part du super admin sur le 607.
  // Si > 20h, envoie un template UTILITY pour rouvrir la fenetre 24h.
  const adminTail = ADMIN_PHONE.replace(/\D/g, '').slice(-9);
  const since = new Date(Date.now() - 20 * 3600 * 1000).toISOString();
  let recent = 0;
  try {
    const { count } = await supa.from('whatsapp_inbound_messages')
      .select('id', { count: 'exact', head: true })
      .gte('received_at', since)
      .ilike('from_phone', `%${adminTail}%`);
    recent = count ?? 0;
  } catch (e) {
    console.error('keepalive check failed', e);
  }
  if (recent > 0) {
    return { ok: true, skipped: true, reason: 'window_still_open' };
  }
  try {
    const { data, error } = await supa.functions.invoke('send-whatsapp', {
      body: {
        recipient_phone: ADMIN_PHONE,
        recipient_type: 'admin',
        template_name: 'admin_window_keepalive',
        template_language: 'fr',
        // Fallback texte au cas ou le template n est pas approuve
        fallback_text: 'Yobbante . Systeme actif. Envoyez MENU pour les commandes.',
        message: 'Yobbante . Systeme actif. Envoyez MENU pour les commandes.',
        trigger_type: 'admin_window_keepalive',
      },
    });
    if (error) console.error('keepalive send error', error);
    return { ok: !error, data };
  } catch (e) {
    console.error('keepalive invoke failed', e);
    return { ok: false, error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  let kind = 'morning';
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.kind) kind = body.kind;
    else {
      const url = new URL(req.url);
      kind = url.searchParams.get('kind') ?? 'morning';
    }
  } catch {}

  // Keepalive : ne genere pas de message lisible, juste un template UTILITY.
  if (kind === 'keepalive') {
    const r = await sendKeepaliveTemplate(supa);
    return new Response(JSON.stringify({ ok: r.ok, kind, ...r }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let message = '';
  try {
    if (kind === 'morning') message = await buildMorningReport(supa);
    else if (kind === 'evening') message = await buildEveningReport(supa);
    else if (kind === 'weekly') message = await buildWeeklyReport(supa);
    else {
      return new Response(JSON.stringify({ error: 'unknown kind' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (e) {
    console.error('build report failed', e);
    message = `Rapport ${kind} : erreur generation. Verifier les logs.`;
  }

  const res = await sendMessage(supa, message);

  return new Response(JSON.stringify({ ok: res.ok, kind, message }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

