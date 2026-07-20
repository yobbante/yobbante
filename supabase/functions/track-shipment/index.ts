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
  RETURN_REQUESTED: 'Retour demandé',
  RETURN_IN_PROGRESS: 'Retour en cours',
  RETURNED: 'Retourné',
  QUOTE_REQUESTED: 'Demande de devis reçue',
  QUOTE_SENT: 'Devis prêt à valider',
  QUOTE_ACCEPTED: 'Devis accepté',
  QUOTE_REFUSED: 'Devis refusé',
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

    const ref = trackingNumber.trim();
    let { data: shipment, error } = await sb
      .from('shipments')
      .select('id, tracking_number, status, origin_city, origin_country, destination_city, destination_country, weight_kg, departure_date, eta, konnekt_id, transport_type, priority, total_cost')
      .eq('tracking_number', ref)
      .maybeSingle();

    // Fallback: id lookup
    if (!shipment && /^[0-9a-f-]{36}$/i.test(ref)) {
      const r = await sb.from('shipments')
        .select('id, tracking_number, status, origin_city, origin_country, destination_city, destination_country, weight_kg, departure_date, eta, konnekt_id, transport_type, priority, total_cost')
        .eq('id', ref).maybeSingle();
      shipment = r.data;
    }

    // Fallback: lookup dossier by tracking_id (YOB-XXXXXX) or reference (YBT-YYYY-NNNN).
    // Allows a customer to /suivre/ either ref shown on the confirmation page.
    if (!shipment) {
      const { data: dossier } = await sb
        .from('dossiers')
        .select('id, tracking_id, reference, status, origin_country, destination_country, origin_city, destination_city, estimated_weight, actual_weight_kg, estimated_delivery_date, created_at, collected_at, weighed_at, delivered_at, payment_status, final_amount_xof, estimated_cost, quote_amount_xof, quote_currency, quote_valid_until, quote_notes_admin, quote_sent_at, quote_response')
        .or(`tracking_id.eq.${ref},reference.eq.${ref}`)
        .maybeSingle();

      if (dossier) {
        const DOSSIER_TO_PIPELINE: Record<string, string> = {
          CREATED: 'CONFIRMED', PENDING: 'CONFIRMED', IN_REVIEW: 'CONFIRMED',
          ASSIGNED: 'MATCHED', MATCHED: 'MATCHED',
          RECEIVED: 'IN_PREPARATION', IN_STORAGE: 'IN_PREPARATION',
          READY_TO_SHIP: 'IN_PREPARATION', COLLECTED: 'IN_PREPARATION',
          SHIPPED: 'IN_TRANSIT', IN_TRANSIT: 'IN_TRANSIT',
          CUSTOMS: 'CUSTOMS',
          ARRIVED: 'ARRIVED',
          OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
          DELIVERED: 'DELIVERED',
        };
        const dossierStatus = (dossier as any).status;
        const isQuote = ['QUOTE_REQUESTED', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'QUOTE_REFUSED'].includes(dossierStatus);
        const mapped = isQuote ? dossierStatus : (DOSSIER_TO_PIPELINE[dossierStatus] || 'CONFIRMED');
        // Synthesize pseudo-events from dossier timestamps
        const events: any[] = [
          { event_type: 'shipment_created', to_status: 'CONFIRMED', created_at: (dossier as any).created_at, note: null },
          (dossier as any).collected_at && { event_type: 'collected', to_status: 'IN_PREPARATION', created_at: (dossier as any).collected_at, note: null },
          (dossier as any).weighed_at && { event_type: 'weighed', to_status: 'IN_PREPARATION', created_at: (dossier as any).weighed_at, note: null },
          (dossier as any).delivered_at && { event_type: 'delivered', to_status: 'DELIVERED', created_at: (dossier as any).delivered_at, note: null },
        ].filter(Boolean);
        const timeline = isQuote ? [] : buildTimeline(mapped, events);
        return new Response(JSON.stringify({
          tracking_number: (dossier as any).tracking_id || (dossier as any).reference,
          status: mapped,
          status_label: STATUS_LABEL[mapped] || mapped,
          origin_city: (dossier as any).origin_city || (dossier as any).origin_country,
          destination_city: (dossier as any).destination_city || (dossier as any).destination_country,
          weight_kg: (dossier as any).actual_weight_kg ?? (dossier as any).estimated_weight,
          departure_date: null,
          eta: (dossier as any).estimated_delivery_date,
          transport_type: null,
          priority: null,
          total_cost: (dossier as any).quote_amount_xof ?? (dossier as any).final_amount_xof ?? (dossier as any).estimated_cost,
          quote_amount_xof: (dossier as any).quote_amount_xof,
          quote_currency: (dossier as any).quote_currency,
          quote_valid_until: (dossier as any).quote_valid_until,
          quote_notes_admin: (dossier as any).quote_notes_admin,
          quote_response: (dossier as any).quote_response,
          timeline,
          source: 'db' as const,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ error: 'Envoi introuvable', tracking_number: ref }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (error) {
      return new Response(JSON.stringify({ error: 'Envoi introuvable', tracking_number: ref }),
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
