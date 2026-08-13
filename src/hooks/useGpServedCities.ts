import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Villes desservies par un transporteur, déduites intelligemment de son
 * historique de départs (manual_departures). La ville étrangère est celle
 * qui n'est pas Dakar, quel que soit le sens du trajet.
 * Résultat trié par fréquence puis récence.
 */
export function useGpServedCities(reference: string | null | undefined) {
  const ref = (reference ?? '').trim();
  const enabled = /^[0-9]{4}$/.test(ref);

  return useQuery({
    queryKey: ['gp-served-cities', ref],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('manual_departures' as any)
        .select('origin_city, destination_city, departure_date')
        .eq('transporteur_ref', ref)
        .order('departure_date', { ascending: false })
        .limit(200);
      if (error) throw error;

      const score = new Map<string, { city: string; n: number; rank: number }>();
      (data ?? []).forEach((row: any, i: number) => {
        const o = (row.origin_city ?? '').trim();
        const d = (row.destination_city ?? '').trim();
        const city = o.toLowerCase() === 'dakar' ? d : o;
        if (!city || city.toLowerCase() === 'dakar') return;
        const k = city.toLowerCase();
        const prev = score.get(k);
        if (prev) prev.n += 1;
        else score.set(k, { city, n: 1, rank: i });
      });

      return [...score.values()]
        .sort((a, b) => (b.n - a.n) || (a.rank - b.rank))
        .map((v) => v.city);
    },
  });
}
