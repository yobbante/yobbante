import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Transporteur {
  id: string;
  reference: string;
  nom: string;
  telephone_1: string;
  telephone_2: string | null;
  adresse_1: string;
  adresse_2: string | null;
  ville: string;
  zone: string | null;
  notes: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export type TransporteurInput = Omit<Transporteur, 'id' | 'created_at' | 'updated_at' | 'actif'> & { actif?: boolean };

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
