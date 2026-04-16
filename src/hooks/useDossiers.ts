import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Dossier, WarehouseCountry } from '@/lib/types';

export interface CreateDossierInput {
  product_description: string;
  estimated_weight?: number | null;
  origin_country: WarehouseCountry;
  destination_country?: string;
  budget_eur?: number | null;
  needs_sourcing?: boolean;
  contact_phone?: string | null;
  contact_email?: string | null;
  notes?: string | null;
  estimated_cost?: number | null;
}

export function useDossiers() {
  const queryClient = useQueryClient();

  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['dossiers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Dossier[];
    },
  });

  const createDossier = useMutation({
    mutationFn: async (input: CreateDossierInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('dossiers')
        .insert({
          user_id: user.id,
          product_description: input.product_description,
          estimated_weight: input.estimated_weight ?? null,
          origin_country: input.origin_country,
          destination_country: input.destination_country ?? 'SN',
          budget_eur: input.budget_eur ?? null,
          needs_sourcing: input.needs_sourcing ?? false,
          contact_phone: input.contact_phone ?? null,
          contact_email: input.contact_email ?? null,
          notes: input.notes ?? null,
          estimated_cost: input.estimated_cost ?? null,
        })
        .select()
        .single();
      if (error) throw error;

      // Timeline event
      await supabase.from('timeline_events').insert({
        user_id: user.id,
        event_type: 'DOSSIER_SUBMITTED',
        title: `Dossier ${data.reference} soumis`,
        description: input.product_description.slice(0, 140),
      });

      return data as Dossier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dossiers'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
  });

  return { dossiers, isLoading, createDossier };
}
