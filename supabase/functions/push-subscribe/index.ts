// push-subscribe — enregistre / supprime un abonnement Web Push.
// Public visé: 'chauffeur' (auth par token de session chauffeur) ou 'admin' (JWT Supabase).
import { createClient } from 'npm:@supabase/supabase-js@2';

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
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

interface Body {
  action?: 'subscribe' | 'unsubscribe';
  audience?: 'admin' | 'chauffeur';
  chauffeur_token?: string;
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  endpoint?: string;
  user_agent?: string;
}

async function chauffeurFromToken(token: string): Promise<string | null> {
  if (!token) return null;
  const { data } = await admin
    .from('chauffeur_sessions')
    .select('chauffeur_id, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.chauffeur_id as string;
}

async function userFromJwt(authHeader: string): Promise<string | null> {
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data.user?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const b: Body = await req.json().catch(() => ({}));
    const action = b.action ?? 'subscribe';
    const audience = b.audience === 'chauffeur' ? 'chauffeur' : 'admin';

    let chauffeurId: string | null = null;
    let userId: string | null = null;

    if (audience === 'chauffeur') {
      chauffeurId = await chauffeurFromToken(b.chauffeur_token ?? '');
      if (!chauffeurId) return json({ error: 'unauthorized' }, 401);
    } else {
      userId = await userFromJwt(req.headers.get('authorization') ?? '');
      if (!userId) return json({ error: 'unauthorized' }, 401);
    }

    if (action === 'unsubscribe') {
      const endpoint = b.endpoint || b.subscription?.endpoint;
      if (!endpoint) return json({ error: 'endpoint_required' }, 400);
      await admin.from('push_subscriptions').delete().eq('endpoint', endpoint);
      return json({ ok: true });
    }

    const endpoint = b.subscription?.endpoint;
    const p256dh = b.subscription?.keys?.p256dh;
    const auth = b.subscription?.keys?.auth;
    if (!endpoint || !p256dh || !auth) return json({ error: 'invalid_subscription' }, 400);

    const { error } = await admin
      .from('push_subscriptions')
      .upsert(
        {
          endpoint,
          p256dh,
          auth,
          audience,
          user_id: userId,
          chauffeur_id: chauffeurId,
          user_agent: (b.user_agent ?? '').slice(0, 300) || null,
          failure_count: 0,
        },
        { onConflict: 'endpoint' },
      );

    if (error) {
      console.error('push_subscriptions upsert', error);
      return json({ error: error.message }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error('push-subscribe', e);
    return json({ error: (e as Error).message }, 500);
  }
});
