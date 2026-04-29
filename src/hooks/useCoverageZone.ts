import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type CoverageLevel = 'direct' | 'partner' | 'none';

export interface CoverageZone {
  id: string;
  country: string;
  city: string;
  coverage_level: CoverageLevel;
  min_lead_hours: number;
  currency_code: string;
  notes: string | null;
}

interface UseCoverageZoneInput {
  country: string | null | undefined;
  city: string | null | undefined;
}

interface CoverageState {
  loading: boolean;
  zone: CoverageZone | null;
  /** "none" if explicitly out of network OR if no zone matches at all. */
  level: CoverageLevel;
  minLeadHours: number;
}

const cache = new Map<string, CoverageZone | null>();

/**
 * Looks up a coverage zone for the given country/city.
 * Falls back to "partner" when nothing matches, so the flow can still progress
 * (operations team will route via WhatsApp).
 */
export function useCoverageZone({ country, city }: UseCoverageZoneInput): CoverageState {
  const key = country && city ? `${country.toUpperCase()}|${city.toLowerCase().trim()}` : '';
  const [state, setState] = useState<CoverageState>({
    loading: !!key, zone: null, level: 'partner', minLeadHours: 24,
  });

  useEffect(() => {
    let cancelled = false;
    if (!key) {
      setState({ loading: false, zone: null, level: 'partner', minLeadHours: 24 });
      return;
    }
    if (cache.has(key)) {
      const cached = cache.get(key) ?? null;
      setState({
        loading: false,
        zone: cached,
        level: cached?.coverage_level ?? 'partner',
        minLeadHours: cached?.min_lead_hours ?? 24,
      });
      return;
    }
    setState(s => ({ ...s, loading: true }));
    (async () => {
      const { data, error } = await supabase
        .from('coverage_zones')
        .select('id, country, city, coverage_level, min_lead_hours, currency_code, notes')
        .eq('country', country!.toUpperCase())
        .ilike('city', city!.trim())
        .eq('active', true)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        cache.set(key, null);
        setState({ loading: false, zone: null, level: 'partner', minLeadHours: 24 });
        return;
      }
      const zone = (data as CoverageZone | null) ?? null;
      cache.set(key, zone);
      setState({
        loading: false,
        zone,
        level: zone?.coverage_level ?? 'partner',
        minLeadHours: zone?.min_lead_hours ?? 24,
      });
    })();
    return () => { cancelled = true; };
  }, [key, country, city]);

  return state;
}
