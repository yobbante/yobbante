import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RoutePricingRow {
  id: string;
  origin_country: string;
  destination_country: string;
  transport_type: string;
  base_price_eur: number;
  price_per_kg_eur: number;
  eta_min_days: number;
  eta_max_days: number;
}

export interface QuoteBreakdown {
  base_price_eur: number;
  weight_cost_eur: number;
  urgency_multiplier: number;
  supply_adjustment_eur: number;
  margin_multiplier: number;
  route_used?: RoutePricingRow | null;
  open_departures?: number;
}

export interface Quote {
  price: number;
  currency: 'EUR';
  eta_min_days: number;
  eta_max_days: number;
  eta_label: string;
  estimated_delivery: string;
  transport_type: 'AIR' | 'SEA' | 'ROAD' | 'GP';
  confidence: 'high' | 'medium' | 'low';
  has_departure: boolean;
  fallback?: boolean;
  breakdown: QuoteBreakdown;
}

export interface QuoteInput {
  shipment_id?: string | null;
  origin_country: string;
  destination_country: string;
  weight_kg: number;
  transport_type?: 'AIR' | 'SEA' | 'ROAD' | 'GP' | null;
  priority?: 'normal' | 'urgent';
  origin_city?: string | null;
  destination_city?: string | null;
}

interface QuoteState {
  quote: Quote | null;
  loading: boolean;
  error: string | null;
}

// 30s in-memory cache shared across hook instances. Keyed by canonical input hash.
const TTL_MS = 30_000;
const cache = new Map<string, { at: number; quote: Quote }>();

function cacheKey(i: QuoteInput): string {
  return [
    i.shipment_id ?? '',
    i.origin_country, i.destination_country,
    Math.round(i.weight_kg * 100),
    i.transport_type ?? '',
    i.priority ?? 'normal',
    i.origin_city ?? '', i.destination_city ?? '',
  ].join('|');
}

/** Clear the entire quote cache (useful for tests or after a pricing change). */
export function clearQuoteCache() {
  cache.clear();
}

/**
 * Real-time pricing engine. Debounced + race-safe + 30s cache.
 * Returns a quote whenever inputs are valid (origin, destination, weight > 0).
 */
export function useQuote(input: QuoteInput | null): QuoteState {
  const [state, setState] = useState<QuoteState>({ quote: null, loading: false, error: null });
  const reqId = useRef(0);

  useEffect(() => {
    if (!input || !input.origin_country || !input.destination_country || !input.weight_kg) {
      setState({ quote: null, loading: false, error: null });
      return;
    }

    const key = cacheKey(input);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) {
      setState({ quote: hit.quote, loading: false, error: null });
      return;
    }

    const myId = ++reqId.current;
    setState(s => ({ ...s, loading: true, error: null }));

    const t = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('quote-shipment', { body: input });
        if (myId !== reqId.current) return;
        if (error) throw error;
        const q = data as Quote;
        if (q && typeof q.price === 'number') {
          cache.set(key, { at: Date.now(), quote: q });
        }
        setState({ quote: q, loading: false, error: q?.fallback ? 'fallback' : null });
      } catch (e: any) {
        if (myId !== reqId.current) return;
        setState({ quote: null, loading: false, error: e?.message ?? 'Erreur de calcul' });
      }
    }, 300);

    return () => clearTimeout(t);
  }, [
    input?.shipment_id,
    input?.origin_country, input?.destination_country, input?.weight_kg,
    input?.transport_type, input?.priority, input?.origin_city, input?.destination_city,
  ]);

  return state;
}
