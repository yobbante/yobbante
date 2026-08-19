import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Données « colis confiés à un transporteur GP » pour l'agent terrain.
 * Un colis GP = un dossier dont assigned_transporteur_ref est renseigné.
 */

export type GpColisStep = 'A_ENLEVER' | 'REMIS_GP' | 'EN_VOL' | 'ARRIVE' | 'RECUPERE';

export const GP_STEPS: { id: GpColisStep; label: string; status: string }[] = [
  { id: 'A_ENLEVER', label: 'À enlever',   status: 'ASSIGNED' },
  { id: 'REMIS_GP',  label: 'Remis au GP', status: 'COLLECTED' },
  { id: 'EN_VOL',    label: 'En vol',      status: 'IN_TRANSIT' },
  { id: 'ARRIVE',    label: 'Arrivé',      status: 'ARRIVED_HUB' },
  { id: 'RECUPERE',  label: 'Récupéré',    status: 'DELIVERED' },
];

export const GP_STEP_TONE: Record<GpColisStep, string> = {
  A_ENLEVER: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  REMIS_GP:  'bg-blue-500/10 text-blue-600 border-blue-500/20',
  EN_VOL:    'bg-violet-500/10 text-violet-600 border-violet-500/20',
  ARRIVE:    'bg-amber-500/10 text-amber-600 border-amber-500/20',
  RECUPERE:  'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
};

export interface GpColis {
  id: string;
  reference: string | null;
  status: string;
  assigned_transporteur_ref: string | null;
  assigned_departure_id: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_address: string | null;
  contact_phone: string | null;
  origin_city: string | null;
  destination_city: string | null;
  destination_country: string | null;
  product_description: string | null;
  estimated_weight: number | null;
  actual_weight_kg: number | null;
  pickup_zone: string | null;
  pickup_quartier: string | null;
  pickup_date: string | null;
  client_requested_pickup_date: string | null;
  dernier_km_adresse: string | null;
  delivery_mode: string | null;
  collected_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string | null;
  notes: string | null;
}

/** Retourne l'étape GP à partir du statut dossier. */
export function stepOf(status: string): GpColisStep {
  switch (status) {
    case 'COLLECTED':
    case 'WEIGHED':
      return 'REMIS_GP';
    case 'IN_TRANSIT':
    case 'CUSTOMS':
      return 'EN_VOL';
    case 'ARRIVED_HUB':
    case 'OUT_FOR_DELIVERY':
      return 'ARRIVE';
    case 'DELIVERED':
    case 'CLOSED':
      return 'RECUPERE';
    default:
      return 'A_ENLEVER';
  }
}

const SELECT_COLS = `id, reference, status, assigned_transporteur_ref, assigned_departure_id,
  sender_name, sender_phone, recipient_name, recipient_phone, recipient_address, contact_phone,
  origin_city, destination_city, destination_country, product_description,
  estimated_weight, actual_weight_kg, pickup_zone, pickup_quartier, pickup_date,
  client_requested_pickup_date, dernier_km_adresse, delivery_mode,
  collected_at, delivered_at, created_at, updated_at, notes`;

export function useGpColis(enabled = true) {
  return useQuery({
    queryKey: ['gp-colis'],
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<GpColis[]> => {
      const { data, error } = await supabase
        .from('dossiers' as any)
        .select(SELECT_COLS)
        .not('assigned_transporteur_ref', 'is', null)
        .order('created_at', { ascending: false })
        .limit(400);
      if (error) throw error;
      return (data ?? []) as unknown as GpColis[];
    },
  });
}

export interface GpDeparture {
  id: string;
  short_ref: string | null;
  transporteur_ref: string | null;
  origin_city: string | null;
  destination_city: string | null;
  destination_country: string | null;
  departure_date: string | null;
  arrival_estimate: string | null;
  max_capacity_kg: number | null;
  reserved_capacity_kg: number | null;
  status: string | null;
  transport_mode: string | null;
  carrier_name: string | null;
  carrier_contact: string | null;
}

export function useGpDepartures(enabled = true) {
  return useQuery({
    queryKey: ['gp-departures-terrain'],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<GpDeparture[]> => {
      const { data, error } = await supabase
        .from('manual_departures' as any)
        .select(`id, short_ref, transporteur_ref, origin_city, destination_city, destination_country,
                 departure_date, arrival_estimate, max_capacity_kg, reserved_capacity_kg, status,
                 transport_mode, carrier_name, carrier_contact`)
        .order('departure_date', { ascending: false })
        .limit(400);
      if (error) throw error;
      return (data ?? []) as unknown as GpDeparture[];
    },
  });
}

/** Mise à jour d'un colis GP (statut + champs dernier kilomètre). */
export function useUpdateGpColis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await supabase.from('dossiers' as any).update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gp-colis'] });
      qc.invalidateQueries({ queryKey: ['dossiers'] });
    },
  });
}

/** Heures écoulées depuis la dernière évolution connue du colis. */
export function stalledHours(c: GpColis): number {
  const ref = c.updated_at ?? c.created_at;
  return (Date.now() - new Date(ref).getTime()) / 3_600_000;
}
