import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type DepartMode = 'gp' | 'air' | 'sea' | 'road';

export interface PublicDeparture {
  id: string;
  origin_city: string;
  origin_country: string | null;
  destination_city: string;
  destination_country: string | null;
  departure_date: string;
  arrival_estimate: string | null;
  available_capacity_kg: number | null;
  short_ref: string | null;
  carrier_name: string | null;
  mode: DepartMode;
}

export function normalizeMode(raw?: string | null): DepartMode {
  const v = (raw || '').trim().toLowerCase();
  if (!v) return 'gp';
  if (v.includes('road') || v.includes('rout') || v.includes('terminal') || v.includes('truck')) return 'road';
  if (v.includes('sea') || v.includes('mar') || v.includes('bateau') || v.includes('lcl') || v.includes('fcl')) return 'sea';
  if (v === 'gp' || v.includes('bagage') || v.includes('accompagn')) return 'gp';
  if (v.includes('air') || v.includes('aer') || v.includes('aér') || v.includes('avion') || v.includes('fret')) return 'air';
  return 'gp';
}

export const MODE_LABEL: Record<DepartMode, string> = {
  gp: 'GP (bagage accompagné)',
  air: 'Cargo aérien',
  sea: 'Maritime',
  road: 'Routier',
};

async function fetchDepartures(): Promise<PublicDeparture[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('public_active_departures' as any)
    .select(
      'id, origin_city, origin_country, destination_city, destination_country, departure_date, arrival_estimate, available_capacity_kg, short_ref, carrier_name, transport_mode',
    )
    .gte('departure_date', today)
    .order('departure_date', { ascending: true })
    .limit(300);

  if (error) throw error;

  return ((data as any[]) || [])
    .filter(d => d?.origin_city && d?.destination_city && d?.departure_date)
    .map(d => ({
      id: d.id,
      origin_city: d.origin_city,
      origin_country: d.origin_country ?? null,
      destination_city: d.destination_city,
      destination_country: d.destination_country ?? null,
      departure_date: String(d.departure_date).slice(0, 10),
      arrival_estimate: d.arrival_estimate ? String(d.arrival_estimate).slice(0, 10) : null,
      available_capacity_kg: d.available_capacity_kg ?? null,
      short_ref: d.short_ref ?? null,
      carrier_name: d.carrier_name ?? null,
      mode: normalizeMode(d.transport_mode),
    }));
}

export function usePublicDepartures() {
  return useQuery({
    queryKey: ['public-departures-page'],
    queryFn: fetchDepartures,
    staleTime: 60_000,
    refetchInterval: 300_000,
  });
}

export interface FretZoneRow {
  id: string;
  scope: 'national' | 'international';
  code: string;
  label: string;
  price_s_fcfa: number | null;
  price_m_fcfa: number | null;
  price_l_fcfa: number | null;
  price_per_kg_fcfa: number | null;
  min_billable_kg: number | null;
  destinations: string[];
}

export function useFretTarifZones() {
  return useQuery({
    queryKey: ['fret-tarif-zones-public'],
    queryFn: async (): Promise<FretZoneRow[]> => {
      const [{ data: zones }, { data: dests }] = await Promise.all([
        supabase.from('fret_tarif_zones' as any).select('*').eq('active', true).order('sort_order'),
        supabase.from('fret_tarif_destinations' as any).select('zone_id, name, active').eq('active', true),
      ]);
      const byZone = new Map<string, string[]>();
      for (const d of ((dests as any[]) || [])) {
        const list = byZone.get(d.zone_id) || [];
        list.push(d.name);
        byZone.set(d.zone_id, list);
      }
      return ((zones as any[]) || []).map(z => ({
        ...z,
        destinations: (byZone.get(z.id) || []).sort((a, b) => a.localeCompare(b, 'fr')),
      })) as FretZoneRow[];
    },
    staleTime: 600_000,
  });
}
