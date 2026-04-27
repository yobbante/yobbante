// Konnekt → Yobbanté webhook receiver.
//
// Public endpoint (no JWT). Konnekt POSTs shipment status events here.
// We validate an HMAC-SHA256 signature using KONNEKT_WEBHOOK_SECRET, then:
//   1. Update shipments.status (forward-only via shipment state machine)
//   2. Insert a timeline_events row so the user sees the change in realtime
//
// Expected request:
//   POST /functions/v1/konnekt-webhook
//   Headers:
//     X-Konnekt-Signature: hex(hmac_sha256(KONNEKT_WEBHOOK_SECRET, raw_body))
//   Body (JSON):
//     {
//       "event": "shipment.status_changed" | "shipment.delivered" | "shipment.in_transit" | "shipment.customs",
//       "konnekt_id": "KNK-12345",
//       "status": "IN_TRANSIT" | "CUSTOMS" | "DELIVERED",   // optional if event implies it
//       "occurred_at": "2026-04-27T10:00:00Z",
//       "metadata": { ... }
//     }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-konnekt-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ShipmentStatus = 'PENDING' | 'IN_TRANSIT' | 'CUSTOMS' | 'DELIVERED';
const SHIPMENT_RANK: Record<ShipmentStatus, number> = {
  PENDING: 0,
  IN_TRANSIT: 1,
  CUSTOMS: 2,
  DELIVERED: 3,
};

const EVENT_TO_STATUS: Record<string, ShipmentStatus | null> = {
  'shipment.in_transit': 'IN_TRANSIT',
  'shipment.customs': 'CUSTOMS',
  'shipment.delivered': 'DELIVERED',
  'shipment.status_changed': null, // status taken from body.status
};

async function verifySignature(
  rawBody: string,
  signatureHex: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHex) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  // Constant-time-ish compare
  if (expected.length !== signatureHex.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHex.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const SECRET = Deno.env.get('KONNEKT_WEBHOOK_SECRET');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SECRET || !SUPABASE_URL || !SERVICE_ROLE) {
    console.error('Missing env: KONNEKT_WEBHOOK_SECRET / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-konnekt-signature');
  const ok = await verifySignature(rawBody, signature, SECRET);
  if (!ok) {
    console.warn('Invalid Konnekt webhook signature');
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload: {
    event?: string;
    konnekt_id?: string;
    status?: ShipmentStatus;
    occurred_at?: string;
    metadata?: Record<string, unknown>;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { event, konnekt_id, status: bodyStatus, metadata } = payload;
  if (!event || !konnekt_id) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: event, konnekt_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const targetStatus: ShipmentStatus | null =
    EVENT_TO_STATUS[event] ?? bodyStatus ?? null;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Find the shipment by konnekt_id
  const { data: shipment, error: findErr } = await supabase
    .from('shipments')
    .select('id, user_id, status, origin_country, destination_country')
    .eq('konnekt_id', konnekt_id)
    .maybeSingle();

  if (findErr) {
    console.error('DB lookup failed', findErr);
    return new Response(JSON.stringify({ error: 'DB error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!shipment) {
    // Acknowledge without action so Konnekt does not retry forever.
    console.warn(`No shipment found for konnekt_id=${konnekt_id}`);
    return new Response(
      JSON.stringify({ ok: true, ignored: 'shipment_not_found' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Forward-only update
  let appliedStatus: ShipmentStatus | null = null;
  if (
    targetStatus &&
    SHIPMENT_RANK[targetStatus] > SHIPMENT_RANK[shipment.status as ShipmentStatus]
  ) {
    const { error: updErr } = await supabase
      .from('shipments')
      .update({ status: targetStatus })
      .eq('id', shipment.id);
    if (updErr) {
      console.error('Shipment update failed', updErr);
      return new Response(JSON.stringify({ error: 'Update failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    appliedStatus = targetStatus;
  }

  // Always log a timeline event so the user sees Konnekt activity in realtime
  const title =
    appliedStatus === 'DELIVERED'
      ? '🎉 Colis livré'
      : appliedStatus === 'CUSTOMS'
        ? 'En douane'
        : appliedStatus === 'IN_TRANSIT'
          ? 'Expédition en transit'
          : `Mise à jour Konnekt — ${event}`;

  const description = `${shipment.origin_country} → ${shipment.destination_country}${appliedStatus ? ` · ${appliedStatus}` : ''}`;

  const { error: tlErr } = await supabase.from('timeline_events').insert({
    user_id: shipment.user_id,
    event_type: appliedStatus ? 'SHIPMENT_STATUS' : 'SHIPMENT_UPDATE',
    title,
    description,
    related_shipment_id: shipment.id,
    metadata: { konnekt_id, event, ...(metadata ?? {}) },
  });
  if (tlErr) {
    // Non-fatal — status is already updated.
    console.error('Timeline insert failed', tlErr);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      shipment_id: shipment.id,
      previous_status: shipment.status,
      new_status: appliedStatus ?? shipment.status,
      timeline_logged: !tlErr,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
