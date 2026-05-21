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
  const yesterday = todayDakarISO(-1);

  const [actifs, paiement, livresHier, nouveaux, msgs] = await Promise.all([
    safeCount(supa.from('dossiers').select('*', { count: 'exact', head: true })
      .not('status', 'in', '(DELIVERED,ARCHIVED,CANCELLED)')),
    safeCount(supa.from('dossiers').select('*', { count: 'exact', head: true })
      .eq('payment_status', 'pending')),
    safeCount(supa.from('dossiers').select('*', { count: 'exact', head: true })
      .eq('status', 'DELIVERED').gte('delivered_at', yesterday).lt('delivered_at', today)),
    safeCount(supa.from('dossiers').select('*', { count: 'exact', head: true })
      .gte('created_at', today)),
    safeCount(supa.from('whatsapp_inbound_messages').select('*', { count: 'exact', head: true })
      .eq('is_read', false).catch?.(() => ({ count: 0 })) ?? Promise.resolve({ count: 0 })),
  ]);

  return `Bonjour ! Resume Yobbante du jour :
Dossiers actifs : ${Math.round(actifs)}
En attente paiement : ${Math.round(paiement)}
Livres hier : ${Math.round(livresHier)}
Nouveaux aujourd'hui : ${Math.round(nouveaux)}
Messages non lus : ${Math.round(msgs)}
Bonne journee !`;
}

async function buildEveningReport(supa: any): Promise<string> {
  const today = todayDakarISO(0);

  const [nouvelles, confirmees, collectees, livrees, msgs] = await Promise.all([
    safeCount(supa.from('dossiers').select('*', { count: 'exact', head: true })
      .gte('created_at', today)),
    safeCount(supa.from('dossiers').select('*', { count: 'exact', head: true })
      .eq('status', 'CONFIRMED').gte('updated_at', today)),
    safeCount(supa.from('dossiers').select('*', { count: 'exact', head: true })
      .eq('status', 'COLLECTED').gte('collected_at', today)),
    safeCount(supa.from('dossiers').select('*', { count: 'exact', head: true })
      .eq('status', 'DELIVERED').gte('delivered_at', today)),
    safeCount(supa.from('whatsapp_inbound_messages').select('*', { count: 'exact', head: true })
      .eq('is_read', false)),
  ]);

  return `Bilan du ${formatDateFR()} :
Nouvelles commandes : ${Math.round(nouvelles)}
Confirmees : ${Math.round(confirmees)}
Collectees : ${Math.round(collectees)}
Livrees : ${Math.round(livrees)}
Messages non traites : ${Math.round(msgs)}
Bonne soiree !`;
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
Commandes recues : ${Math.round(recues)}
Livrees : ${Math.round(livrees)}
En cours : ${Math.round(actifs)}
GP actifs : ${gpActifs}
Routes les + actives : ${topRoutes}
Bonne semaine !`;
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
