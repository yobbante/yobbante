import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SplitPart {
  description?: string;
  weight?: number | null;
  transporteur_ref?: string;
  departure_id?: string;
  notes?: string;
}

export interface SplitChild {
  id: string;
  reference: string;
  product_description: string | null;
  estimated_weight: number | null;
  actual_weight_kg: number | null;
  status: string;
  assigned_transporteur_ref: string | null;
  assigned_departure_id: string | null;
  final_amount_xof: number | null;
  carrier_cost_xof: number | null;
  gp_amount: number | null;
  split_index: number | null;
  split_count: number | null;
  parent_dossier_id: string | null;
}

const CHILD_COLS =
  'id, reference, product_description, estimated_weight, actual_weight_kg, status, ' +
  'assigned_transporteur_ref, assigned_departure_id, final_amount_xof, carrier_cost_xof, ' +
  'gp_amount, split_index, split_count, parent_dossier_id';

/** Sous-colis rattachés à un dossier parent. */
export function useDossierChildren(parentId?: string | null) {
  return useQuery({
    queryKey: ['dossier-children', parentId],
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossiers')
        .select(CHILD_COLS)
        .eq('parent_dossier_id', parentId!)
        .order('split_index', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SplitChild[];
    },
  });
}

/** Le dossier parent, quand on consulte un sous-colis. */
export function useDossierParent(parentId?: string | null) {
  return useQuery({
    queryKey: ['dossier-parent', parentId],
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('id, reference, product_description, split_count')
        .eq('id', parentId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Scinde un dossier en plusieurs sous-colis. */
export function useSplitDossier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dossierId, parts }: { dossierId: string; parts: SplitPart[] }) => {
      const { data, error } = await supabase.rpc('split_dossier', {
        p_dossier_id: dossierId,
        p_parts: parts as unknown as never,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['dossier-children', v.dossierId] });
      qc.invalidateQueries({ queryKey: ['admin-dossier', v.dossierId] });
      qc.invalidateQueries({ queryKey: ['admin-requests'] });
      qc.invalidateQueries({ queryKey: ['dossiers'] });
      qc.invalidateQueries({ queryKey: ['all-payments'] });
    },
  });
}
