// push-send — envoie une notification Web Push à une cible.
// Cibles: { audience: 'admin' } | { chauffeur_id } | { endpoint }
// Auth: service-role (appels serveur) ou JWT d'un membre du staff.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendPush } from '../_shared/webpush.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID = {
  publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  privateKey: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
  subject: Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@yobbante.com',
};

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const STAFF_ROLES = ['admin', 'staff', 'agent_terrain', 'agent_support'];

async function isAuthorized(req: Request): Promise<boolean> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  if (token === SERVICE_KEY) return true;
  const { data } = await admin.auth.getUser(token);
  const uid = data.user?.id;
  if (!uid) return false;
  const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', uid);
  return (roles ?? []).some((r: { role: string }) => STAFF_ROLES.includes(r.role));
}

interface Body {
  audience?: 'admin' | 'chauffeur';
  chauffeur_id?: string;
  endpoint?: string;
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!VAPID.publicKey || !VAPID.privateKey) return json({ error: 'vapid_not_configured' }, 500);
  if (!(await isAuthorized(req))) return json({ error: 'unauthorized' }, 401);

  try {
    const b: Body = await req.json().catch(() => ({}));
    const title = (b.title ?? '').trim();
    if (!title) return json({ error: 'title_required' }, 400);

    let query = admin.from('push_subscriptions').select('id, endpoint, p256dh, auth');
    if (b.endpoint) query = query.eq('endpoint', b.endpoint);
    else if (b.chauffeur_id) query = query.eq('chauffeur_id', b.chauffeur_id);
    else query = query.eq('audience', b.audience ?? 'admin');

    const { data: subs, error } = await query.limit(200);
    if (error) return json({ error: error.message }, 500);
    if (!subs?.length) return json({ sent: 0, targets: 0 });

    const payload = {
      title,
      body: b.body ?? '',
      url: b.url ?? '/',
      tag: b.tag,
    };

    let sent = 0;
    const dead: string[] = [];
    for (const s of subs) {
      const res = await sendPush(s, payload, VAPID);
      if (res.ok) {
        sent++;
        await admin.from('push_subscriptions')
          .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
          .eq('id', s.id);
      } else if (res.gone) {
        dead.push(s.id);
      } else {
        console.error('push failed', res.status, res.error);
        await admin.rpc as unknown; // no-op typing guard
        await admin.from('push_subscriptions')
          .update({ failure_count: 1 })
          .eq('id', s.id);
      }
    }
    if (dead.length) await admin.from('push_subscriptions').delete().in('id', dead);

    return json({ sent, targets: subs.length, removed: dead.length });
  } catch (e) {
    console.error('push-send', e);
    return json({ error: (e as Error).message }, 500);
  }
});
