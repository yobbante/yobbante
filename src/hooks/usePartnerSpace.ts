import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { readFpSession } from '@/lib/fpSession';

export type PartnerDeparture = {
  id: string;
  transport_mode: 'air' | 'sea_lcl';
  origin_city: string;
  origin_country: string | null;
  destination_city: string;
  destination_country: string | null;
  departure_date: string;
  arrival_estimate: string | null;
  cutoff_date: string | null;
  total_capacity_kg: number;
  available_capacity_kg: number;
  reserved_capacity_kg: number;
  carrier_company: string | null;
  flight_or_vessel: string | null;
  port_origin: string | null;
  port_destination: string | null;
  container_type: string | null;
  capacity_cbm: number | null;
  price_per_kg_xof: number | null;
  price_per_cbm_xof: number | null;
  transit_days: number | null;
  notes: string | null;
  status: string;
  short_ref: string | null;
};

export type PartnerProfile = {
  id: string;
  reference: string;
  company_name: string;
  mode: 'air' | 'sea' | 'both';
  phone: string;
  default_price_per_kg_xof: number | null;
  default_price_per_cbm_xof: number | null;
  default_transit_days: number | null;
};

function session(): string {
  return readFpSession()?.session ?? '';
}

export function usePartnerProfile() {
  return useQuery({
    queryKey: ['fp_me', session()],
    enabled: !!session(),
    queryFn: async (): Promise<PartnerProfile | null> => {
      const { data, error } = await supabase.rpc('fp_me' as any, { p_session: session() });
      if (error) throw error;
      const r = data as any;
      return r?.ok ? (r.partner as PartnerProfile) : null;
    },
  });
}

export function usePartnerDepartures() {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['fp_departures', session()],
    enabled: !!session(),
    queryFn: async (): Promise<PartnerDeparture[]> => {
      const { data, error } = await supabase.rpc('fp_departures' as any, { p_session: session() });
      if (error) throw error;
      const r = data as any;
      return r?.ok ? (r.departures as PartnerDeparture[]) : [];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.rpc('fp_save_departure' as any, {
        p_session: session(),
        p_payload: payload,
      });
      if (error) throw error;
      const r = data as any;
      if (!r?.ok) throw new Error(r?.reason === 'unauthorized' ? 'Session expirée' : 'Enregistrement impossible');
      return r.id as string;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fp_departures'] }); },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('fp_cancel_departure' as any, { p_session: session(), p_id: id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fp_departures'] }); },
  });

  return { list, save, cancel };
}
