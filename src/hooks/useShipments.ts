import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Shipment, ShipmentStatus } from '@/lib/types';

/**
 * A normalized Konnekt option as returned by the `external-match-shipment`
 * edge function. Passing it to `createShipment` persists the full transport
 * choice (label, ETA, price, departure) on the resulting shipment.
 */
export interface KonnektMatchOption {
  id: 'fast' | 'economy' | 'volume';
  label: string;          // "Rapide" | "Économique" | "Volume"
  eta_days: string;
  price_eur: number;
  departure_date?: string | null;
  highlight?: string;
  meta?: Record<string, unknown>;
}

/** Parse "8–14 jours" / "3-6 jours" → upper bound in days, fallback 14. */
function maxEtaDays(eta: string | undefined, fallback = 14): number {
  if (!eta) return fallback;
  const nums = eta.match(/\d+/g)?.map(Number) ?? [];
  if (nums.length === 0) return fallback;
  return Math.max(...nums);
}

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
      // Konnekt departure (when client picks an existing one)
      konnekt_departure_id?: string | null;
      departure_date?: string | null;
      origin_city?: string | null;
      destination_city?: string | null;
      // Manual request (no matching Konnekt departure)
      manual_request?: boolean;
      client_note?: string | null;
      // Chosen Konnekt match option (Rapide / Économique / Volume) — persisted as
      // transport_type + transport_metadata + price + ETA on the new shipment.
      match_option?: KonnektMatchOption | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const isManual = !!shipment.manual_request;
      const opt = shipment.match_option ?? null;

      const departureDate = shipment.departure_date ?? opt?.departure_date ?? null;
      const etaBase = departureDate ? new Date(departureDate) : new Date();
      const etaDays = opt ? maxEtaDays(opt.eta_days, 14) : (departureDate ? 7 : 14);
      const eta = new Date(etaBase.getTime() + etaDays * 24 * 60 * 60 * 1000).toISOString();

      const transportType = opt?.id ?? shipment.transport_type ?? 'standard';
      const transportMetadata = opt
        ? {
            option_id: opt.id,
            label: opt.label,
            eta_days: opt.eta_days,
            price_eur: opt.price_eur,
            departure_date: opt.departure_date ?? null,
            highlight: opt.highlight ?? null,
            ...(opt.meta ?? {}),
          }
        : null;

      const { data, error } = await supabase
        .from('shipments')
        .insert({
          user_id: user.id,
          origin_country: shipment.origin_country,
          destination_country: shipment.destination_country,
          transport_type: transportType,
          konnekt_id: shipment.konnekt_departure_id || `KNK-${Date.now()}`,
          konnekt_departure_id: shipment.konnekt_departure_id ?? null,
          departure_date: departureDate,
          origin_city: shipment.origin_city ?? null,
          destination_city: shipment.destination_city ?? null,
          manual_request: isManual,
          pending_assignment: isManual,
          client_note: shipment.client_note ?? null,
          total_cost: opt?.price_eur ?? null,
          transport_metadata: transportMetadata,
          eta,
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
