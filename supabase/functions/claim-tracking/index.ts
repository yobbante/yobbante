// Rattachement d'un colis suivi publiquement au compte du client qui vient
// de s'inscrire : /suivre/YBR-XXXXXX → « Créer mon compte » → le dossier
// apparaît dans son espace client avec toutes ses infos.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

    const anon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await anon.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const ref = String(body?.ref || '').trim().toUpperCase();
    if (!ref || ref.length < 6) return json({ error: 'invalid_ref' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Résolution de la référence → dossier
    let dossierId: string | null = null;
    let contact: { name?: string | null; phone?: string | null } = {};

    if (ref.startsWith('YBR')) {
      const { data: course } = await admin
        .from('fret_courses')
        .select('dossier_id, client_nom, client_phone, expediteur_nom, expediteur_phone')
        .eq('ref', ref)
        .maybeSingle();
      if (!course) return json({ error: 'not_found' }, 404);
      dossierId = (course as any).dossier_id;
      contact = {
        name: (course as any).client_nom || (course as any).expediteur_nom,
        phone: (course as any).client_phone || (course as any).expediteur_phone,
      };
      if (!dossierId) return json({ error: 'no_dossier' }, 404);
    } else {
      const { data: d } = await admin
        .from('dossiers')
        .select('id, sender_name, recipient_name, contact_phone')
        .or(`tracking_id.eq.${ref},reference.eq.${ref}`)
        .maybeSingle();
      if (!d) return json({ error: 'not_found' }, 404);
      dossierId = (d as any).id;
      contact = {
        name: (d as any).recipient_name || (d as any).sender_name,
        phone: (d as any).contact_phone,
      };
    }

    // 2. Propriétaire actuel : on ne vole jamais le dossier d'un vrai client.
    const { data: dossier } = await admin
      .from('dossiers')
      .select('id, reference, tracking_id, user_id, contact_phone, contact_email')
      .eq('id', dossierId)
      .maybeSingle();
    if (!dossier) return json({ error: 'not_found' }, 404);

    const ownerId = (dossier as any).user_id as string | null;
    if (ownerId && ownerId !== user.id) {
      const { data: roles } = await admin
        .from('user_roles')
        .select('role')
        .eq('user_id', ownerId);
      const ownerIsStaff = (roles || []).some((r: any) =>
        ['admin', 'staff', 'agent_support', 'agent_terrain'].includes(r.role));
      if (!ownerIsStaff) return json({ error: 'already_claimed' }, 409);
    }

    // 3. Rattachement
    if (ownerId !== user.id) {
      const { error: upErr } = await admin
        .from('dossiers')
        .update({ user_id: user.id })
        .eq('id', dossierId);
      if (upErr) return json({ error: upErr.message }, 400);
    }

    // 4. Complète la fiche client (sans écraser ce que l'utilisateur a saisi)
    const { data: profile } = await admin
      .from('profiles')
      .select('id, full_name, phone, email')
      .eq('user_id', user.id)
      .maybeSingle();

    const patch: Record<string, unknown> = {};
    if (profile && !profile.full_name && contact.name) patch.full_name = contact.name;
    if (profile && !profile.phone && (contact.phone || (dossier as any).contact_phone)) {
      patch.phone = contact.phone || (dossier as any).contact_phone;
    }
    if (profile && !profile.email && user.email) patch.email = user.email;
    if (profile && Object.keys(patch).length > 0) {
      await admin.from('profiles').update(patch).eq('id', profile.id);
    }

    // Le dossier garde un contact joignable pour les notifications.
    const dossierPatch: Record<string, unknown> = {};
    if (!(dossier as any).contact_email && user.email) dossierPatch.contact_email = user.email;
    if (Object.keys(dossierPatch).length > 0) {
      await admin.from('dossiers').update(dossierPatch).eq('id', dossierId);
    }

    return json({
      ok: true,
      dossier_id: dossierId,
      reference: (dossier as any).reference,
      tracking_id: (dossier as any).tracking_id,
    });
  } catch (e) {
    return json({ error: (e as Error).message || 'unexpected_error' }, 500);
  }
});
