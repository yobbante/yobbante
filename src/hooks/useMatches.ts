import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MatchRow {
  id: string;
  shipment_id: string;
  departure_id: string;
  transporter_id: string | null;
  score: number;
  route_score: number;
  date_score: number;
  status: 'matched' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
}

/** All matches for the current user (RLS enforced). */
export function useMatches() {
  return useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MatchRow[];
    },
  });
}

/** Latest match for one shipment, or null if shipment is still waiting. */
export function useShipmentMatch(shipmentId: string | null | undefined) {
  return useQuery({
    queryKey: ['match', shipmentId],
    enabled: !!shipmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('shipment_id', shipmentId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as MatchRow) ?? null;
    },
  });
}
