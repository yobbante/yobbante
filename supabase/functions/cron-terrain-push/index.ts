// cron-terrain-push — surveille le fret routier et pousse des alertes push à l'équipe terrain.
// Cas couverts : colis bloqué >24h, chauffeur sans réponse (>2h sans acceptation),
// demande d'enlèvement non assignée >12h. Anti-spam : 1 alerte / course / 12h.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendPush } from '../_shared/webpush.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID = {
  publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  privateKey: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
  subject: Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@yobbante.com',
};
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const H = 3600_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!VAPID.privateKey) {
    return new Response(JSON.stringify({ error: 'vapid_not_configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const since = new Date(Date.now() - 7 * 24 * H).toISOString();
  const { data: courses } = await admin
    .from('fret_courses')
    .select('id, ref, status, destination, chauffeur_id, created_at, remis_at, arrived_at')
    .gte('created_at', since)
    .neq('status', 'LIVRE')
    .neq('status', 'ANNULE')
    .limit(300);

  const now = Date.now();
  const alerts: { title: string; body: string; tag: string }[] = [];

  for (const c of courses ?? []) {
    const ref = c.ref ?? c.id.slice(0, 8);
    if (c.status === 'A_ENLEVER' && !c.chauffeur_id && now - new Date(c.created_at).getTime() > 12 * H) {
      alerts.push({
        title: 'Enlèvement non assigné',
        body: `${ref} — ${c.destination} en attente depuis plus de 12h`,
        tag: `stale-pickup-${c.id}`,
      });
    }
    if (c.status === 'PENDING_ACCEPT' && c.remis_at && now - new Date(c.remis_at).getTime() > 2 * H) {
      alerts.push({
        title: 'Chauffeur sans réponse',
        body: `${ref} — course non acceptée depuis plus de 2h`,
        tag: `no-answer-${c.id}`,
      });
    }
    const lastMove = new Date(c.arrived_at ?? c.remis_at ?? c.created_at).getTime();
    if (['REMIS_CHAUFFEUR', 'EN_ROUTE', 'ARRIVE'].includes(c.status) && now - lastMove > 24 * H) {
      alerts.push({
        title: 'Colis bloqué +24h',
        body: `${ref} — ${c.destination} sans évolution depuis plus de 24h`,
        tag: `stalled-${c.id}`,
      });
    }
  }

  if (!alerts.length) return json({ alerts: 0, sent: 0 });

  // Anti-spam : on ne renvoie pas un tag déjà notifié il y a moins de 12h.
  const tags = alerts.map((a) => a.tag);
  const { data: recent } = await admin
    .from('admin_notifications_sent')
    .select('dedupe_key')
    .in('dedupe_key', tags)
    .gte('created_at', new Date(now - 12 * H).toISOString());
  const already = new Set((recent ?? []).map((r: { dedupe_key: string }) => r.dedupe_key));
  const todo = alerts.filter((a) => !already.has(a.tag));
  if (!todo.length) return json({ alerts: alerts.length, sent: 0 });

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('audience', 'admin')
    .limit(100);

  let sent = 0;
  const dead: string[] = [];
  for (const a of todo) {
    for (const s of subs ?? []) {
      const res = await sendPush(s, { ...a, url: '/admin/terrain?tab=fret' }, VAPID);
      if (res.ok) sent++;
      else if (res.gone) dead.push(s.id);
    }
    await admin.from('admin_notifications_sent').insert({ dedupe_key: a.tag }).select().maybeSingle();
  }
  if (dead.length) await admin.from('push_subscriptions').delete().in('id', dead);

  return json({ alerts: alerts.length, notified: todo.length, sent });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
