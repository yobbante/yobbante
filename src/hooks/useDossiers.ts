import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Dossier, WarehouseCountry } from '@/lib/types';

export interface CreateDossierInput {
  product_description: string;
  estimated_weight?: number | null;
  origin_country: WarehouseCountry;
  destination_country?: string;
  origin_city?: string | null;
  destination_city?: string | null;
  budget_eur?: number | null;
  needs_sourcing?: boolean;
  contact_phone?: string | null;
  contact_email?: string | null;
  notes?: string | null;
  estimated_cost?: number | null;
  app_source?: string;
  delivery_mode?: 'pickup_gp' | 'relay_point' | 'home_delivery';
  relay_point_name?: string | null;
  relay_point_address?: string | null;
  delivery_carrier?: string | null;
  delivery_cost_xof?: number | null;
  pickup_quartier?: string | null;
  pickup_zone?: string | null;
  enlevement_surcharge?: number;
  is_outside_dakar?: boolean;
  is_gift?: boolean;
  price_volatility_coefficient?: number | null;
  sender_name?: string | null;
  sender_phone?: string | null;
  sender_address?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  recipient_address?: string | null;
  pickup_date?: string | null;
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
          ...(input.app_source ? { app_source: input.app_source } : {}),
          ...(input.delivery_mode ? { delivery_mode: input.delivery_mode } : {}),
          ...(input.relay_point_name !== undefined ? { relay_point_name: input.relay_point_name } : {}),
          ...(input.relay_point_address !== undefined ? { relay_point_address: input.relay_point_address } : {}),
          ...(input.delivery_carrier !== undefined ? { delivery_carrier: input.delivery_carrier } : {}),
          ...(input.delivery_cost_xof !== undefined ? { delivery_cost_xof: input.delivery_cost_xof } : {}),
          ...(input.pickup_quartier !== undefined ? { pickup_quartier: input.pickup_quartier } : {}),
          ...(input.pickup_zone !== undefined ? { pickup_zone: input.pickup_zone } : {}),
          ...(input.enlevement_surcharge !== undefined ? { enlevement_surcharge: input.enlevement_surcharge } : {}),
          ...(input.is_outside_dakar !== undefined ? { is_outside_dakar: input.is_outside_dakar } : {}),
          ...(input.is_gift !== undefined ? { is_gift: input.is_gift } : {}),
          ...(input.price_volatility_coefficient !== undefined ? { price_volatility_coefficient: input.price_volatility_coefficient } : {}),
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
