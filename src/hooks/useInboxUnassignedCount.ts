import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { detectServiceKind } from '@/lib/intakeSources';

/**
 * Compte les dossiers "Envoi" à traiter (SUBMITTED + IN_REVIEW).
 * Utilisé pour le badge sur l'onglet "Demandes entrantes".
 */
export function useInboxUnassignedCount() {
  return useQuery({
    queryKey: ['inbox-unassigned-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('id, needs_sourcing, product_description, status')
        .in('status', ['SUBMITTED', 'IN_REVIEW'])
        .limit(500);
      if (error) throw error;
      return (data || []).filter(d => detectServiceKind(d as any) === 'envoi').length;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
