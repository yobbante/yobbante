import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type DepartureStatus = 'active' | 'full' | 'cancelled' | 'draft';
export type TransportMode = 'air' | 'sea_lcl' | 'road';

export interface ManualDeparture {
  id: string;
  origin_country: string | null;
  origin_city: string;
  destination_country: string | null;
  destination_city: string;
  transport_mode: TransportMode;
  departure_date: string;
  arrival_estimate: string | null;
  total_capacity_kg: number;
  available_capacity_kg: number;
  price_override_xof: number | null;
  carrier_name: string | null;
  carrier_contact: string | null;
  notes: string | null;
  source: string;
  status: DepartureStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ManualDepartureInput = Omit<ManualDeparture, 'id' | 'source' | 'created_at' | 'updated_at' | 'created_by'>;

export function useManualDepartures() {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['manual_departures'],
    queryFn: async (): Promise<ManualDeparture[]> => {
      const { data, error } = await supabase
        .from('manual_departures')
        .select('*')
        .order('departure_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ManualDeparture[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: ManualDepartureInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('manual_departures').insert({
        ...input,
        created_by: user?.id ?? null,
      }).select().single();
      if (error) throw error;
      return data as ManualDeparture;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manual_departures'] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ManualDepartureInput> }) => {
      const { data, error } = await supabase
        .from('manual_departures')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ManualDeparture;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manual_departures'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Block deletion if shipments are confirmed on this departure
      // (manual departures aren't yet linked to shipments by FK; treat full as warning)
      const { error } = await supabase.from('manual_departures').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manual_departures'] }),
  });

  return { list, create, update, remove };
}

export function useDeparturesSummary() {
  return useQuery({
    queryKey: ['departures_summary'],
    queryFn: async () => {
      const [konnekt, manual] = await Promise.all([
        supabase.from('konnekt_departures').select('id, available_capacity_kg, total_capacity_kg, status').eq('status', 'OPEN'),
        supabase.from('manual_departures').select('id, available_capacity_kg, total_capacity_kg, status'),
      ]);
      const konnektOpen = konnekt.data ?? [];
      const manualAll = manual.data ?? [];
      const manualActive = manualAll.filter((d: any) => d.status === 'active');

      const all = [
        ...konnektOpen.map((d: any) => ({ ...d, _src: 'konnekt' })),
        ...manualActive.map((d: any) => ({ ...d, _src: 'manual' })),
      ];

      const nearlyFull = all.filter((d: any) =>
        d.total_capacity_kg > 0 && (d.available_capacity_kg / d.total_capacity_kg) <= 0.2
      ).length;

      const noCapacity = manualAll.filter((d: any) => !d.total_capacity_kg).length;

      return {
        konnekt: konnektOpen.length,
        manual: manualActive.length,
        total: all.length,
        nearlyFull,
        noCapacity,
      };
    },
  });
}
