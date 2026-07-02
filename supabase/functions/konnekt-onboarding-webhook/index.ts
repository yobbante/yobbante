// Konnekt → Yobbanté webhook : suivi onboarding GP.
//
// Public endpoint (no JWT). Konnekt POSTs onboarding events here.
//
// Body:
//   { ref_gp: "GP1234" | "1234", timestamp: ISO, event: "link_opened" | "registered", konnekt_user_id?: string }
//
// Updates public.transporteurs:
//   - link_opened  → konnekt_link_opened_at
//   - registered   → konnekt_registered=true, konnekt_registered_at, konnekt_user_id

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-konnekt-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeRef(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  if (!/^\d{1,4}$/.test(digits)) return null;
  return digits.padStart(4, '0');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  // --- Auth: shared secret required (fail closed) ---
  const KONNEKT_KEY = Deno.env.get('KONNEKT_SHARED_KEY') ?? '';
  if (!KONNEKT_KEY) {
    console.error('konnekt-onboarding-webhook: KONNEKT_SHARED_KEY missing');
    return jsonResponse({ error: 'Webhook secret not configured' }, 500);
  }
  const gotKey = req.headers.get('x-konnekt-key') ?? req.headers.get('x-konnekt-signature') ?? '';
  if (gotKey !== KONNEKT_KEY) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }


  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE) return jsonResponse({ error: 'Server misconfigured' }, 500);

  let payload: any;
  try { payload = await req.json(); }
  catch { return jsonResponse({ error: 'Invalid JSON' }, 400); }

  const ref = normalizeRef(payload?.ref_gp);
  const event = String(payload?.event ?? '');
  if (!ref) return jsonResponse({ error: 'Missing or invalid ref_gp' }, 400);
  if (!event) return jsonResponse({ error: 'Missing event' }, 400);

  const ts = (() => {
    const t = payload?.timestamp;
    if (typeof t === 'string') {
      const d = new Date(t);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    return new Date().toISOString();
  })();

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: gp, error: findErr } = await supabase
    .from('transporteurs')
    .select('id, reference, konnekt_link_opened_at, konnekt_registered, konnekt_registered_at')
    .eq('reference', ref)
    .maybeSingle();

  if (findErr) return jsonResponse({ error: 'DB error', details: findErr.message }, 500);
  if (!gp) return jsonResponse({ ok: true, ignored: 'gp_not_found', ref_gp: ref }, 200);

  const patch: Record<string, unknown> = {};

  if (event === 'link_opened') {
    // First open wins (don't overwrite)
    if (!gp.konnekt_link_opened_at) patch.konnekt_link_opened_at = ts;
  } else if (event === 'registered') {
    if (!gp.konnekt_registered) {
      patch.konnekt_registered = true;
      patch.konnekt_registered_at = ts;
    }
    if (typeof payload?.konnekt_user_id === 'string' && payload.konnekt_user_id) {
      patch.konnekt_user_id = payload.konnekt_user_id;
    }
    // If they registered without ever firing link_opened, backfill it.
    if (!gp.konnekt_link_opened_at) patch.konnekt_link_opened_at = ts;
  } else {
    return jsonResponse({ error: 'Unknown event', event }, 400);
  }

  if (Object.keys(patch).length === 0) {
    return jsonResponse({ ok: true, ref_gp: ref, event, applied: false });
  }

  const { error: updErr } = await supabase
    .from('transporteurs')
    .update(patch)
    .eq('id', gp.id);

  if (updErr) return jsonResponse({ error: 'Update failed', details: updErr.message }, 500);
  return jsonResponse({ ok: true, ref_gp: ref, event, applied: true, patch });
});
