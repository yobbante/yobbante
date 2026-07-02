// Public Edge Function: writes scoped to a GP identified by his "reference" (4 chars).
// The dashboard at /gp/:ref calls this function for profile, departure, rates updates.
// No auth required — the GP reference itself is the access key (matches existing model
// for /gp/depart/:ref and the onboarding link).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function bad(msg: string, status = 400) {
  return ok({ error: msg }, status);
}

function normalizeRef(input: unknown): string | null {
  const digits = String(input ?? '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.padStart(4, '0').slice(-4);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const op = String(body?.op ?? '');
    const ref = normalizeRef(body?.ref);
    if (!ref) return bad('ref invalide');

    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    // --- Auth: require a server-verifiable session token that was minted for
    //     this GP via gp_request_auth() (magic link) and stored client-side. ---
    const sessionToken =
      String(body?.session_token ?? '') ||
      String(req.headers.get('x-gp-token') ?? '');
    if (!sessionToken || sessionToken.length < 32) {
      return bad('Unauthorized: missing GP session token', 401);
    }
    const { data: tok } = await supa
      .from('gp_auth_tokens')
      .select('ref_gp, expires_at, used_at, created_at')
      .eq('token', sessionToken)
      .eq('ref_gp', ref)
      .maybeSingle();
    if (!tok) {
      return bad('Unauthorized: invalid GP session token', 401);
    }
    // Accept either an unused token still within its expiry window, or a
    // previously consumed magic-link token used within the last 30 days.
    const now = Date.now();
    const expiresAt = tok.expires_at ? new Date(tok.expires_at).getTime() : 0;
    const usedAt = tok.used_at ? new Date(tok.used_at).getTime() : 0;
    const stillValid =
      (usedAt === 0 && expiresAt > now) ||
      (usedAt > 0 && now - usedAt < 30 * 24 * 60 * 60 * 1000);
    if (!stillValid) {
      return bad('Unauthorized: GP session expired', 401);
    }

    const { data: gp, error: gpErr } = await supa
      .from('transporteurs')
      .select('id, reference')
      .eq('reference', ref)
      .maybeSingle();
    if (gpErr) throw gpErr;
    if (!gp) return bad('GP introuvable', 404);


    switch (op) {
      case 'update_profile': {
        const patch: Record<string, unknown> = {};
        if (typeof body.prenom === 'string') patch.prenom = body.prenom.trim();
        if (typeof body.nom === 'string') patch.nom = body.nom.trim();
        if (typeof body.ville === 'string') patch.ville = body.ville.trim();
        if (typeof body.photo_url === 'string') patch.photo_url = body.photo_url;
        if (typeof body.wizard_step === 'number') patch.wizard_step = body.wizard_step;
        if (body.beta_tarif_defaut !== undefined)
          patch.beta_tarif_defaut = body.beta_tarif_defaut === null ? null : Number(body.beta_tarif_defaut);
        if (typeof body.beta_notes_conditions === 'string')
          patch.beta_notes_conditions = body.beta_notes_conditions;
        if (body.beta_wizard_completed === true)
          patch.beta_wizard_completed_at = new Date().toISOString();
        if (body.profile_completed === true) patch.profile_completed_at = new Date().toISOString();
        const { error } = await supa.from('transporteurs').update(patch).eq('id', gp.id);
        if (error) throw error;
        return ok({ ok: true });
      }


      case 'add_departure': {
        const origin = String(body.origin_city ?? '').trim();
        const destination = String(body.destination_city ?? '').trim();
        const date = String(body.departure_date ?? '').trim();
        const kg = Number(body.total_capacity_kg);
        if (!origin || !destination || !date || !kg || kg <= 0)
          return bad('Champs requis manquants');
        const priceXof = body.price_override_xof != null ? Number(body.price_override_xof) : null;
        const transportMode = String(body.transport_mode ?? 'air');
        const { data, error } = await supa
          .from('manual_departures')
          .insert({
            transporteur_ref: ref,
            origin_city: origin,
            destination_city: destination,
            departure_date: date,
            total_capacity_kg: kg,
            available_capacity_kg: kg,
            price_override_xof: priceXof,
            transport_mode: transportMode,
            status: 'active',
            publication_status: 'published',
            published_at: new Date().toISOString(),
            source: 'gp_dashboard_beta',
            created_via: 'gp_self',

          })
          .select('id, short_ref')
          .single();
        if (error) throw error;
        return ok({ ok: true, departure: data });
      }

      case 'cancel_departure':
      case 'delete_departure': {
        const id = String(body.departure_id ?? '');
        if (!id) return bad('departure_id requis');
        const { error } = await supa
          .from('manual_departures')
          .update({ status: 'cancelled' })
          .eq('id', id)
          .eq('transporteur_ref', ref);
        if (error) throw error;
        return ok({ ok: true });
      }

      case 'update_departure': {
        const id = String(body.departure_id ?? '');
        if (!id) return bad('departure_id requis');
        const patch: Record<string, unknown> = {};
        if (typeof body.origin_city === 'string') patch.origin_city = body.origin_city.trim();
        if (typeof body.destination_city === 'string') patch.destination_city = body.destination_city.trim();
        if (typeof body.departure_date === 'string') patch.departure_date = body.departure_date;
        if (body.total_capacity_kg != null) {
          const kg = Number(body.total_capacity_kg);
          patch.total_capacity_kg = kg;
          patch.available_capacity_kg = kg;
        }
        if (body.price_override_xof !== undefined)
          patch.price_override_xof = body.price_override_xof === null ? null : Number(body.price_override_xof);
        const { error } = await supa
          .from('manual_departures')
          .update(patch)
          .eq('id', id)
          .eq('transporteur_ref', ref);
        if (error) throw error;
        return ok({ ok: true });
      }


      case 'update_rates': {
        const patch: Record<string, unknown> = {};
        if (body.default_rate_per_kg != null) patch.default_rate_per_kg = Number(body.default_rate_per_kg);
        if (body.rates_per_city && typeof body.rates_per_city === 'object') patch.rates_per_city = body.rates_per_city;
        if (typeof body.gp_notes === 'string') patch.gp_notes = body.gp_notes;
        patch.rates_collected_at = new Date().toISOString();
        const { error } = await supa.from('transporteurs').update(patch).eq('id', gp.id);
        if (error) throw error;
        return ok({ ok: true });
      }

      default:
        return bad(`op inconnu: ${op}`);
    }
  } catch (e) {
    return bad(e instanceof Error ? e.message : String(e), 500);
  }
});
