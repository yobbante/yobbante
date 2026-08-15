// fret-chauffeur — API publique du fret routier interne (PWA chauffeur + confirmation client)
// Actions: login | me | advance | confirm | course
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

const supa = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

function digits(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

const NEXT: Record<string, string | null> = {
  PENDING_ACCEPT: 'REMIS_CHAUFFEUR',
  REMIS_CHAUFFEUR: 'EN_ROUTE',
  EN_ROUTE: 'ARRIVE',
  ARRIVE: null, // seul le client confirme la livraison
  LIVRE: null,
  ANNULE: null,
};

const STAMP: Record<string, string> = {
  REMIS_CHAUFFEUR: 'accepted_at',
  EN_ROUTE: 'en_route_at',
  ARRIVE: 'arrived_at',
  LIVRE: 'delivered_at',
};

async function sendWa(phone: string, message: string, trigger: string) {
  if (digits(phone).length < 8) return;
  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        recipient_type: 'client',
        recipient_phone: phone,
        message,
        trigger_type: trigger,
      }),
    });
  } catch (e) {
    console.error('sendWa', e);
  }
}

async function resolveSession(token: string) {
  if (!token) return null;
  const { data } = await supa
    .from('chauffeur_sessions')
    .select('token, chauffeur_id, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  const { data: ch } = await supa
    .from('chauffeurs')
    .select('id, telephone, nom_complet, immatriculation, routes, is_active')
    .eq('id', data.chauffeur_id)
    .maybeSingle();
  if (!ch || ch.is_active === false) return null;
  return ch;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let body: Record<string, any> = {};
  try { body = await req.json(); } catch { /* noop */ }
  const action = String(body.action ?? '');

  try {
    if (action === 'login') {
      const phone = digits(body.phone);
      const pin = digits(body.pin);
      if (phone.length < 8 || pin.length !== 4) return json({ error: 'invalid_credentials' }, 400);
      const tail = phone.slice(-9);
      const { data: list } = await supa
        .from('chauffeurs')
        .select('id, telephone, pin_code, nom_complet, immatriculation, routes, is_active')
        .ilike('telephone', `%${tail}`)
        .limit(5);
      const ch = (list ?? []).find((c) => digits(c.telephone).slice(-9) === tail);
      if (!ch || ch.is_active === false || String(ch.pin_code) !== pin) {
        return json({ error: 'invalid_credentials' }, 401);
      }
      const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      await supa.from('chauffeur_sessions').insert({ token, chauffeur_id: ch.id });
      return json({
        token,
        chauffeur: {
          id: ch.id, telephone: ch.telephone, nom_complet: ch.nom_complet,
          immatriculation: ch.immatriculation, routes: ch.routes,
        },
      });
    }

    if (action === 'me') {
      const ch = await resolveSession(String(body.token ?? ''));
      if (!ch) return json({ error: 'unauthorized' }, 401);
      const { data: courses } = await supa
        .from('fret_courses')
        .select('id, ref, destination, client_nom, colis_description, photo_url, status, remis_at, accepted_at, en_route_at, arrived_at, delivered_at')
        .eq('chauffeur_id', ch.id)
        .neq('status', 'ANNULE')
        .order('created_at', { ascending: false })
        .limit(50);
      return json({ chauffeur: ch, courses: courses ?? [] });
    }

    if (action === 'advance') {
      const ch = await resolveSession(String(body.token ?? ''));
      if (!ch) return json({ error: 'unauthorized' }, 401);
      const courseId = String(body.course_id ?? '');
      const { data: course } = await supa
        .from('fret_courses')
        .select('*')
        .eq('id', courseId)
        .eq('chauffeur_id', ch.id)
        .maybeSingle();
      if (!course) return json({ error: 'not_found' }, 404);
      const next = NEXT[course.status];
      if (!next) return json({ error: 'no_next_step' }, 400);

      const patch: Record<string, unknown> = { status: next };
      if (STAMP[next]) patch[STAMP[next]] = new Date().toISOString();
      const { error } = await supa.from('fret_courses').update(patch).eq('id', course.id);
      if (error) return json({ error: error.message }, 400);

      if (next === 'ARRIVE' && course.client_phone) {
        const origin = String(body.origin || 'https://yobbante.com').replace(/\/$/, '');
        await sendWa(
          course.client_phone,
          `Bonjour ${course.client_nom || ''},\n\nVotre colis ${course.ref} vient d'arriver a ${course.destination}.\n\nDes que vous l'avez recupere, confirmez ici :\n${origin}/recu/${course.confirm_token}\n\nSuivi : ${origin}/suivre/${course.ref}\n\nYobbante`.replace(/\s+,/, ','),
          'fret_routier_arrive',
        );
      }
      return json({ ok: true, status: next });
    }

    if (action === 'course') {
      const token = String(body.confirm_token ?? '');
      if (!token) return json({ error: 'not_found' }, 404);
      const { data: c } = await supa
        .from('fret_courses')
        .select('ref, destination, client_nom, status, arrived_at, delivered_at')
        .eq('confirm_token', token)
        .maybeSingle();
      if (!c) return json({ error: 'not_found' }, 404);
      return json({ course: c });
    }

    if (action === 'track') {
      const ref = String(body.ref ?? '').trim().toUpperCase();
      if (!ref) return json({ error: 'not_found' }, 404);
      const { data: c } = await supa
        .from('fret_courses')
        .select('ref, destination, status, remis_at, accepted_at, en_route_at, arrived_at, delivered_at, chauffeur_id')
        .eq('ref', ref)
        .maybeSingle();
      if (!c) return json({ error: 'not_found' }, 404);
      let chauffeur: { nom_complet: string | null; immatriculation: string | null } | null = null;
      if (c.chauffeur_id) {
        const { data: ch } = await supa
          .from('chauffeurs')
          .select('nom_complet, immatriculation')
          .eq('id', c.chauffeur_id)
          .maybeSingle();
        chauffeur = ch ?? null;
      }
      const { chauffeur_id: _omit, ...rest } = c as Record<string, unknown>;
      return json({ course: rest, chauffeur });
    }

    if (action === 'confirm') {
      const token = String(body.confirm_token ?? '');
      const { data: c } = await supa
        .from('fret_courses')
        .select('id, ref, status, chauffeur_id')
        .eq('confirm_token', token)
        .maybeSingle();
      if (!c) return json({ error: 'not_found' }, 404);
      if (c.status === 'LIVRE') return json({ ok: true, status: 'LIVRE' });
      if (c.status !== 'ARRIVE') return json({ error: 'not_arrived' }, 400);
      const { error } = await supa
        .from('fret_courses')
        .update({ status: 'LIVRE', delivered_at: new Date().toISOString() })
        .eq('id', c.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, status: 'LIVRE' });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    console.error('fret-chauffeur', e);
    return json({ error: 'server_error' }, 500);
  }
});
