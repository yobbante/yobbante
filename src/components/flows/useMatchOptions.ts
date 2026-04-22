import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { MatchOptionView } from './FlowPrimitives';

interface MatchInput {
  origin_city: string;
  destination_city: string;
  weight_kg: number;
  urgency?: 'normal' | 'fast' | 'flexible';
}

interface MatchResult {
  options: MatchOptionView[];
  next_departure_in_days: number | null;
  loading: boolean;
  error: string | null;
}

/**
 * Auto-fetch Konnekt match options whenever inputs are complete.
 * Debounced + race-safe.
 */
export function useMatchOptions(input: MatchInput | null): MatchResult {
  const [state, setState] = useState<MatchResult>({
    options: [], next_departure_in_days: null, loading: false, error: null,
  });
  const reqId = useRef(0);

  useEffect(() => {
    if (!input || !input.origin_city || !input.destination_city || !input.weight_kg) {
      setState({ options: [], next_departure_in_days: null, loading: false, error: null });
      return;
    }

    const myId = ++reqId.current;
    setState(s => ({ ...s, loading: true, error: null }));

    const t = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('external-match-shipment', {
          body: input,
        });
        if (myId !== reqId.current) return;
        if (error) throw error;
        setState({
          options: data?.options ?? [],
          next_departure_in_days: data?.next_departure_in_days ?? null,
          loading: false,
          error: null,
        });
      } catch (e: any) {
        if (myId !== reqId.current) return;
        setState({ options: [], next_departure_in_days: null, loading: false, error: e?.message ?? 'Erreur' });
      }
    }, 350);

    return () => clearTimeout(t);
  }, [input?.origin_city, input?.destination_city, input?.weight_kg, input?.urgency]);

  return state;
}
