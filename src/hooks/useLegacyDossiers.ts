import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type LegacyDossier = {
  id: string;
  legacy_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  type: string | null;
  origin: string | null;
  destination: string | null;
  weight_kg: number | null;
  description: string | null;
  status_legacy: string | null;
  amount: number | null;
  currency: string | null;
  source: string | null;
  notes: string | null;
  created_at: string | null;
  imported_at: string;
  promoted_to_dossier_id: string | null;
};

export function useLegacyDossiers() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['legacy-dossiers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('legacy_dossiers')
        .select('*')
        .order('imported_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as LegacyDossier[];
    },
  });

  const reactivate = useMutation({
    mutationFn: async (legacy: LegacyDossier) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');
      const desc = legacy.description || legacy.type || 'Dossier réactivé (historique)';
      const originIso = (legacy.origin || 'FR').slice(0, 2).toUpperCase();
      const insertRow: any = {
        user_id: user.id,
        product_description: desc,
        origin_country: ['FR', 'CN', 'US'].includes(originIso) ? originIso : 'FR',
        destination_country: (legacy.destination || 'SN').slice(0, 2).toUpperCase(),
        contact_phone: legacy.client_phone,
        contact_email: legacy.client_email,
        estimated_weight: legacy.weight_kg,
        estimated_cost: legacy.currency === 'EUR' ? legacy.amount : (legacy.amount ? legacy.amount / 655.957 : null),
        buyer_name: legacy.client_name,
        buyer_contact: legacy.client_phone,
        source: (legacy.source as any) || 'autre',
        source_reference: legacy.legacy_id,
        intake_method: 'manual_intake',
        intake_by: user.id,
        intake_notes: `Réactivé depuis l'historique. ${legacy.notes || ''}`.trim(),
        status: 'SUBMITTED' as any,
      };
      const { data: created, error } = await supabase
        .from('dossiers')
        .insert(insertRow)
        .select('id, reference')
        .single();
      if (error) throw error;
      await supabase
        .from('legacy_dossiers')
        .update({ promoted_to_dossier_id: created.id })
        .eq('id', legacy.id);
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['legacy-dossiers'] });
      qc.invalidateQueries({ queryKey: ['inbox-dossiers'] });
    },
  });

  const bulkInsert = useMutation({
    mutationFn: async (rows: Omit<LegacyDossier, 'id' | 'imported_at' | 'promoted_to_dossier_id'>[]) => {
      const { error, data } = await supabase
        .from('legacy_dossiers')
        .insert(rows as any)
        .select('id');
      if (error) throw error;
      return data?.length ?? 0;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['legacy-dossiers'] }),
  });

  return { ...query, reactivate, bulkInsert };
}
