// Edge function: list users + manage roles. Admin-only.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type AppRole = 'admin' | 'staff' | 'user';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdminRow } = await admin
      .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!isAdminRow) return json({ error: 'Forbidden — admin only' }, 403);

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action: string = body.action || 'list';

    if (action === 'list') {
      const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (error) throw error;
      const ids = list.users.map(u => u.id);
      const { data: roles } = await admin.from('user_roles').select('user_id, role').in('user_id', ids);
      const byUser = new Map<string, AppRole[]>();
      (roles || []).forEach(r => {
        const arr = byUser.get(r.user_id) || [];
        arr.push(r.role as AppRole);
        byUser.set(r.user_id, arr);
      });
      const users = list.users.map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        full_name: (u.user_metadata as any)?.full_name || null,
        roles: byUser.get(u.id) || [],
      }));
      return json({ users });
    }

    if (action === 'add_role' || action === 'remove_role') {
      const { user_id, role } = body as { user_id: string; role: AppRole };
      if (!user_id || !['admin', 'staff', 'user'].includes(role)) return json({ error: 'Invalid input' }, 400);
      if (action === 'add_role') {
        const { error } = await admin.from('user_roles').insert({ user_id, role });
        if (error && !error.message.includes('duplicate')) throw error;
      } else {
        if (user_id === user.id && role === 'admin') return json({ error: 'Vous ne pouvez pas retirer votre propre rôle admin.' }, 400);
        const { error } = await admin.from('user_roles').delete().eq('user_id', user_id).eq('role', role);
        if (error) throw error;
      }
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('admin-users error', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
