import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Shipment, ShipmentStatus } from '@/lib/types';

export function useShipments() {
  const queryClient = useQueryClient();

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ['shipments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Shipment[];
    },
  });

  const createShipment = useMutation({
    mutationFn: async (shipment: {
      origin_country: 'FR' | 'CN' | 'US';
      destination_country: string;
      transport_type?: string;
      package_ids?: string[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('shipments')
        .insert({
          user_id: user.id,
          origin_country: shipment.origin_country,
          destination_country: shipment.destination_country,
          transport_type: shipment.transport_type || 'standard',
          konnekt_id: `KNK-${Date.now()}`,
          eta: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();
      if (error) throw error;

      if (shipment.package_ids?.length) {
        await supabase
          .from('packages')
          .update({ shipment_id: data.id, status: 'SHIPPED' })
          .in('id', shipment.package_ids);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ShipmentStatus }) => {
      const { error } = await supabase
        .from('shipments')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
  });

  return { shipments, isLoading, createShipment, updateStatus };
}
