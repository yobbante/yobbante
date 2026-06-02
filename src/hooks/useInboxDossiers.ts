import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type InboxDossier = {
  id: string;
  reference: string;
  status: string;
  product_description: string;
  origin_country: string;
  destination_country: string;
  origin_city: string | null;
  destination_city: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  estimated_cost: number | null;
  estimated_weight: number | null;
  needs_sourcing: boolean;
  source: string;
  source_reference: string | null;
  intake_method: string;
  intake_by: string | null;
  intake_notes: string | null;
  created_at: string;
  user_id: string;
  buyer_name: string | null;
  buyer_country: string | null;
  delivery_mode: string | null;
  relay_point_name: string | null;
  relay_point_address: string | null;
  delivery_carrier: string | null;
  delivery_cost_xof: number | null;
  delivery_notified_at: string | null;
  delivery_reminder_count: number | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_address: string | null;
};

export function useInboxDossiers() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['inbox-dossiers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossiers')
        .select(
          'id, reference, status, product_description, origin_country, destination_country, origin_city, destination_city, contact_phone, contact_email, estimated_cost, estimated_weight, needs_sourcing, source, source_reference, intake_method, intake_by, intake_notes, created_at, user_id, buyer_name, buyer_country, delivery_mode, relay_point_name, relay_point_address, delivery_carrier, delivery_cost_xof, delivery_notified_at, delivery_reminder_count, recipient_name, recipient_phone, recipient_address',
        )
        .in('status', ['SUBMITTED', 'IN_REVIEW', 'AWAITING_CLIENT', 'CONFIRMED', 'ARRIVED_HUB', 'DELIVERED'])
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as InboxDossier[];
    },
    refetchInterval: 30_000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('dossiers').update({ status: status as any }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox-dossiers'] }),
  });

  return { ...query, updateStatus };
}
