import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FretStatus } from '@/lib/fretApi';

export interface AdminFretCourse {
  id: string;
  ref: string;
  destination: string;
  client_nom: string | null;
  client_phone: string | null;
  colis_description: string | null;
  photo_url: string | null;
  status: FretStatus;
  confirm_token: string;
  remis_at: string | null;
  accepted_at: string | null;
  en_route_at: string | null;
  arrived_at: string | null;
  delivered_at: string | null;
  created_at: string;
  chauffeur_id: string | null;
  pickup_address: string | null;
  pickup_zone: string | null;
  pickup_fee_fcfa: number | null;
  expediteur_nom: string | null;
  expediteur_phone: string | null;
  colis_size: string | null;
  weight_kg: number | null;
  scope: string | null;
  total_fcfa: number | null;
  source: string | null;
}

export interface AdminChauffeur {
  id: string;
  telephone: string;
  pin_code: string;
  nom_complet: string | null;
  immatriculation: string | null;
  routes: string[] | null;
  is_active: boolean;
  created_at?: string;
}

/** Statuts considérés comme « course active » (ni livrée, ni annulée). */
export const FRET_ACTIVE_STATUSES: FretStatus[] = [
  'A_ENLEVER', 'PENDING_ACCEPT', 'REMIS_CHAUFFEUR', 'EN_ROUTE', 'ARRIVE',
];

export function useFretCourses(enabled = true) {
  return useQuery({
    queryKey: ['fret-courses'],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<AdminFretCourse[]> => {
      const { data, error } = await supabase
        .from('fret_courses' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(400);
      if (error) throw error;
      return (data ?? []) as unknown as AdminFretCourse[];
    },
    refetchInterval: 60_000,
  });
}

export function useChauffeurs(enabled = true) {
  return useQuery({
    queryKey: ['chauffeurs'],
    enabled,
    queryFn: async (): Promise<AdminChauffeur[]> => {
      const { data, error } = await supabase
        .from('chauffeurs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as AdminChauffeur[];
    },
  });
}
