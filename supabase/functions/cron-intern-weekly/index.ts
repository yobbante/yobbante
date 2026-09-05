// cron-intern-weekly — Rapport hebdomadaire (vendredi 16h Dakar) sur l'activite
// de l'espace interne (stagiaire partenariats). Envoi WhatsApp a l'admin.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_PHONE = '+221784604003';

function weekStartISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 7);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function fmtDateFR(d = new Date()): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const auth = req.headers.get('authorization') ?? '';
  const apikey = req.headers.get('apikey') ?? '';
  if (!SR || (auth !== `Bearer ${SR}` && apikey !== SR)) {

    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supa = createClient(Deno.env.get('SUPABASE_URL')!, SR, { auth: { persistSession: false } });
  const since = weekStartISO();
  const todayYmd = new Date().toISOString().slice(0, 10);

  let dryRun = false;
  try {
    const body = await req.json().catch(() => ({}));
    dryRun = !!body?.dry_run;
  } catch { /* ignore */ }

  // Taches
  const { data: tasks } = await supa
    .from('internal_tasks')
    .select('id, title, status, due_date, completed_at, updated_at');
  const rows = tasks ?? [];
  const done = rows.filter((t: any) => t.status === 'termine' && t.completed_at && t.completed_at >= since);
  const inProgress = rows.filter((t: any) => t.status === 'en_cours');
  const todo = rows.filter((t: any) => t.status === 'a_faire');
  const late = rows.filter((t: any) => t.status !== 'termine' && t.due_date && t.due_date < todayYmd);

  // Partenaires
  const { data: partners } = await supa
    .from('partenaires_logistique')
    .select('chantier, statut, tarif_montant, created_at, updated_at');
  const pRows = partners ?? [];
  const newPartners = pRows.filter((p: any) => p.created_at >= since);
  const byChantier = new Map<string, number>();
  for (const p of pRows) byChantier.set(p.chantier ?? 'autre', (byChantier.get(p.chantier ?? 'autre') ?? 0) + 1);
  const withTarif = pRows.filter((p: any) => p.tarif_montant != null).length;

  // Activite
  const { count: actions } = await supa
    .from('staff_activity_log')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since);

  const chantierLine = byChantier.size
    ? [...byChantier.entries()].map(([k, n]) => `. ${k} : ${n}`).join('\n')
    : '. Aucun partenaire';

  const lateLine = late.length
    ? late.slice(0, 5).map((t: any) => `. ${t.title} (echeance ${t.due_date})`).join('\n')
    : '. Aucune tache en retard';

  const message = [
    `YOBBANTE . Rapport interne . Vendredi ${fmtDateFR()} 16h`,
    '',
    'TACHES :',
    `. Terminees cette semaine : ${done.length}`,
    `. En cours : ${inProgress.length}`,
    `. A faire : ${todo.length}`,
    '',
    'PARTENAIRES :',
    `. Nouveaux cette semaine : ${newPartners.length}`,
    `. Total en base : ${pRows.length} (dont ${withTarif} avec tarif)`,
    chantierLine,
    '',
    'RETARDS :',
    lateLine,
    '',
    `ACTIONS ENREGISTREES : ${actions ?? 0}`,
    '',
    'Bon week-end !',
  ].join('\n');

  if (dryRun) {
    return new Response(JSON.stringify({ ok: true, dry_run: true, message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { error } = await supa.functions.invoke('send-whatsapp', {
    body: {
      recipient_phone: ADMIN_PHONE,
      recipient_type: 'admin',
      message,
      trigger_type: 'cron_intern_weekly',
    },
  });
  if (error) console.error('send-whatsapp error', error);

  return new Response(JSON.stringify({ ok: !error, message }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
