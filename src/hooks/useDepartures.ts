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
    // Real-time-ish polling: refetch every 60s, on focus, and on reconnect.
    // Stale immediately so background refetches actually fire.
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}
