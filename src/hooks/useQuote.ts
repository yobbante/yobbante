import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface QuoteBreakdown {
  base_price_eur: number;
  weight_cost_eur: number;
  urgency_multiplier: number;
  supply_adjustment_eur: number;
  margin_multiplier: number;
}

export interface Quote {
  price: number;
  currency: 'EUR';
  eta_min_days: number;
  eta_max_days: number;
  eta_label: string;
  transport_type: 'AIR' | 'SEA' | 'ROAD' | 'GP';
  confidence: 'high' | 'medium' | 'low';
  breakdown: QuoteBreakdown;
}

export interface QuoteInput {
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

/**
 * Real-time pricing engine. Debounced + race-safe.
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
    const myId = ++reqId.current;
    setState(s => ({ ...s, loading: true, error: null }));

    const t = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('quote-shipment', { body: input });
        if (myId !== reqId.current) return;
        if (error) throw error;
        setState({ quote: data as Quote, loading: false, error: null });
      } catch (e: any) {
        if (myId !== reqId.current) return;
        setState({ quote: null, loading: false, error: e?.message ?? 'Erreur de calcul' });
      }
    }, 300);

    return () => clearTimeout(t);
  }, [
    input?.origin_country, input?.destination_country, input?.weight_kg,
    input?.transport_type, input?.priority, input?.origin_city, input?.destination_city,
  ]);

  return state;
}
