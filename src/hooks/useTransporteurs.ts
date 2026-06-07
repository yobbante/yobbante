import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Navette } from '@/lib/dakarZones';

export interface Transporteur {
  id: string;
  reference: string;
  nom: string;
  prenom?: string | null;
  telephone_1: string;
  telephone_2: string | null;
  adresse_1: string;
  adresse_2: string | null;
  ville: string;
  zone: string | null;
  notes: string | null;
  actif: boolean;
  konnekt_registered?: boolean;
  konnekt_registered_at?: string | null;
  konnekt_invited_at?: string | null;
  konnekt_link_opened_at?: string | null;
  konnekt_user_id?: string | null;
  beta_invite_sent_at?: string | null;
  invitation_bot_sent_at?: string | null;
  default_rate_per_kg?: number | null;
  default_routes?: Record<string, number> | null;
  // GP profile extension
  adresse_collecte_dakar?: string | null;
  adresse_dakar_2?: string | null;
  creneau_dakar?: string[] | null;
  navettes?: Navette[] | null;
  photo_url?: string | null;
  profile_complete?: boolean;
  created_at: string;
  updated_at: string;
}

export type TransporteurInput = Omit<Transporteur, 'id' | 'created_at' | 'updated_at' | 'actif' | 'profile_complete'> & { actif?: boolean };

export function useTransporteurs() {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['transporteurs'],
    queryFn: async (): Promise<Transporteur[]> => {
      const { data, error } = await supabase
        .from('transporteurs' as any)
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Transporteur[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: TransporteurInput) => {
      const { data, error } = await supabase
        .from('transporteurs' as any)
        .upsert(input, { onConflict: 'reference' })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Transporteur;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transporteurs'] }),
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transporteurs' as any).update({ actif: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transporteurs'] }),
  });

  return { list, upsert, deactivate };
}

export async function fetchTransporteurByRef(reference: string): Promise<Transporteur | null> {
  if (!/^[0-9]{4}$/.test(reference)) return null;
  const { data, error } = await supabase
    .from('transporteurs' as any)
    .select('*')
    .eq('reference', reference)
    .maybeSingle();
  if (error) return null;
  return (data as unknown as Transporteur) ?? null;
}
