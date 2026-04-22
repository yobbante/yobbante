import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type KonnektDeparture = {
  id: string;
  origin_country: string;
  origin_city: string;
  destination_country: string;
  destination_city: string;
  departure_date: string;
  transport: 'AIR' | 'SEA' | 'ROAD';
};

export type DeparturesResponse = {
  departures: KonnektDeparture[];
  source: 'konnekt' | 'cache' | 'mock';
  count: number;
  partner_authenticated: boolean;
  generated_at: string;
  lkg_updated_at: string | null;
  error_message?: string;
};

export function useDepartures() {
  return useQuery({
    queryKey: ['konnekt-departures'],
    queryFn: async (): Promise<DeparturesResponse> => {
      const { data, error } = await supabase.functions.invoke('list-departures');
      if (error) throw error;
      return data as DeparturesResponse;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
