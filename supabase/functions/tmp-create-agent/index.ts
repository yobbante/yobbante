import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

Deno.serve(async (req) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { email, password } = await req.json();

  let userId: string | null = null;
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: 'Agent Support (test)' },
  });
  if (created?.user) userId = created.user.id;
  if (error) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = list?.users?.find((u) => u.email === email);
    if (found) {
      userId = found.id;
      await admin.auth.admin.updateUserById(found.id, { password, email_confirm: true });
    }
  }
  if (!userId) return new Response(JSON.stringify({ ok: false, error: error?.message }), { status: 500 });

  await admin.from('user_roles').delete().eq('user_id', userId);
  const { error: rErr } = await admin.from('user_roles').insert({ user_id: userId, role: 'agent_support' });

  return new Response(JSON.stringify({ ok: !rErr, userId, role_error: rErr?.message }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
