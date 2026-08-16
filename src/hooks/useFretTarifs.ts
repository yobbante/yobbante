import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FretDestination, FretZone } from '@/lib/fretPricing';

/** Charge la grille tarifaire fret routier (zones + rattachement villes/pays). */
export function useFretTarifs() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['fret-tarifs'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [zonesRes, destRes] = await Promise.all([
        supabase
          .from('fret_tarif_zones')
          .select('id, scope, code, label, price_s_fcfa, price_m_fcfa, price_l_fcfa, price_per_kg_fcfa, min_billable_kg')
          .eq('active', true)
          .order('sort_order'),
        supabase
          .from('fret_tarif_destinations')
          .select('id, zone_id, scope, name, country_code')
          .eq('active', true)
          .order('name'),
      ]);
      if (zonesRes.error) throw zonesRes.error;
      if (destRes.error) throw destRes.error;
      return {
        zones: (zonesRes.data ?? []).map(z => ({
          ...z,
          min_billable_kg: z.min_billable_kg == null ? null : Number(z.min_billable_kg),
        })) as FretZone[],
        destinations: (destRes.data ?? []) as FretDestination[],
      };
    },
  });

  return {
    zones: data?.zones ?? [],
    destinations: data?.destinations ?? [],
    isLoading,
    error,
  };
}
