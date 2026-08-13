import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

Deno.serve(async () => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!);

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'agent.test@yobbante.com',
  });
  if (error) return new Response(JSON.stringify({ ok: false, step: 'link', error: error.message }), { status: 200 });

  const { data: sess, error: vErr } = await anon.auth.verifyOtp({
    type: 'email',
    token_hash: data.properties.hashed_token,
  });
  return new Response(JSON.stringify({
    ok: !vErr,
    error: vErr?.message,
    session: sess?.session ?? null,
  }), { headers: { 'Content-Type': 'application/json' } });
});
