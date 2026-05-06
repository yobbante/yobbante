// Public edge function — fetches a shipment + canonical timeline.
// Strategy:
//  1. Look up shipment by tracking_number (or id) using the service client.
//  2. Fetch shipment_events for the canonical timeline.
//  3. Best-effort: try to enrich from Konnekt (status + tracking events) if the
//     shipment has a konnekt_id. Failure is silent — local timeline always returned.
// Always returns { tracking_number, status, events[], source: 'db'|'db+konnekt' }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Demande reçue',
  CONFIRMED: 'Envoi confirmé',
  WAITING_FOR_MATCH: 'En recherche d\'un départ',
  MATCHED: 'Départ assigné',
  IN_PREPARATION: 'En préparation',
  IN_TRANSIT: 'En transit',
  CUSTOMS: 'Dédouanement en cours',
  ARRIVED: 'Arrivé à destination',
  OUT_FOR_DELIVERY: 'En cours de livraison',
  DELIVERED: 'Livré',
  ON_HOLD: 'En attente',
  CANCELLED: 'Annulé',
};

const PIPELINE = [
  'CONFIRMED', 'MATCHED', 'IN_PREPARATION', 'IN_TRANSIT', 'CUSTOMS',
  'ARRIVED', 'OUT_FOR_DELIVERY', 'DELIVERED',
];

interface TimelineEvent {
  status: 'done' | 'current' | 'pending';
  label: string;
  date: string | null;
  note?: string | null;
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return null; }
}

async function fetchKonnektStatus(konnektId: string): Promise<{ status?: string; events?: any[] } | null> {
  const base = (Deno.env.get('KONNEKT_BASE_URL') || '').trim();
  const key = (Deno.env.get('KONNEKT_API_KEY') || '').trim();
  if (!base || !/^https:\/\//i.test(base) || !konnektId) return null;
  let url = base.replace(/\/+$/, '');
  if (!/\/functions\/v\d+$/.test(url)) url = `${url}/functions/v1`;
  const endpoint = `${url}/external-shipment-status?shipment_id=${encodeURIComponent(konnektId)}`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'Authorization': `Bearer ${key}`, 'X-Yobbante-Api-Key': key } : {}),
      },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('Konnekt status fetch failed', (e as Error).message);
    return null;
  }
}

function buildTimeline(currentStatus: string, events: { event_type: string; to_status: string | null; created_at: string; note: string | null }[]): TimelineEvent[] {
  // Map status → first event date
  const byStatus = new Map<string, { date: string; note: string | null }>();
  for (const e of events) {
    const s = e.to_status || (e.event_type === 'shipment_created' ? 'CONFIRMED' : null);
    if (!s) continue;
    if (!byStatus.has(s)) byStatus.set(s, { date: e.created_at, note: e.note });
  }
  const currentIndex = Math.max(0, PIPELINE.indexOf(currentStatus));
  return PIPELINE.map((status, i) => {
    const found = byStatus.get(status);
    const state: TimelineEvent['status'] =
      i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'pending';
    return {
      status: state,
      label: STATUS_LABEL[status] || status,
      date: fmtDate(found?.date ?? null),
      note: found?.note ?? null,
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const trackingNumber = url.searchParams.get('tracking_number') || url.searchParams.get('id');
    if (!trackingNumber) {
      return new Response(JSON.stringify({ error: 'tracking_number required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    let { data: shipment, error } = await sb
      .from('shipments')
      .select('id, tracking_number, status, origin_city, origin_country, destination_city, destination_country, weight_kg, departure_date, eta, konnekt_id, transport_type, priority, total_cost')
      .eq('tracking_number', trackingNumber)
      .maybeSingle();

    // Fallback: id lookup
    if (!shipment && /^[0-9a-f-]{36}$/i.test(trackingNumber)) {
      const r = await sb.from('shipments')
        .select('id, tracking_number, status, origin_city, origin_country, destination_city, destination_country, weight_kg, departure_date, eta, konnekt_id, transport_type, priority, total_cost')
        .eq('id', trackingNumber).maybeSingle();
      shipment = r.data;
    }

    if (error || !shipment) {
      return new Response(JSON.stringify({ error: 'Envoi introuvable', tracking_number: trackingNumber }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: events } = await sb
      .from('shipment_events')
      .select('event_type, to_status, created_at, note')
      .eq('shipment_id', shipment.id)
      .order('created_at', { ascending: true });

    let source: 'db' | 'db+konnekt' = 'db';
    let liveStatus: string | null = null;
    if (shipment.konnekt_id) {
      const k = await fetchKonnektStatus(shipment.konnekt_id);
      if (k && k.status) {
        liveStatus = k.status;
        source = 'db+konnekt';
      }
    }

    const timeline = buildTimeline(liveStatus || shipment.status, events || []);

    return new Response(JSON.stringify({
      tracking_number: shipment.tracking_number,
      status: liveStatus || shipment.status,
      status_label: STATUS_LABEL[liveStatus || shipment.status] || shipment.status,
      origin_city: shipment.origin_city,
      destination_city: shipment.destination_city,
      weight_kg: shipment.weight_kg,
      departure_date: shipment.departure_date,
      eta: shipment.eta,
      transport_type: shipment.transport_type,
      priority: shipment.priority,
      total_cost: shipment.total_cost,
      timeline,
      source,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('track-shipment error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
