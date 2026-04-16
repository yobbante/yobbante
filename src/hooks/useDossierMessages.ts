import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DossierMessage {
  id: string;
  dossier_id: string;
  author_id: string;
  author_role: 'client' | 'staff';
  body: string;
  internal_note: boolean;
  created_at: string;
}

export function useDossierMessages(dossierId: string | undefined) {
  const qc = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['dossier-messages', dossierId],
    enabled: !!dossierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossier_messages')
        .select('*')
        .eq('dossier_id', dossierId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as DossierMessage[];
    },
  });

  const sendMessage = useMutation({
    mutationFn: async ({ body, asStaff, internal }: { body: string; asStaff: boolean; internal?: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !dossierId) throw new Error('Not authenticated');
      const { error } = await supabase.from('dossier_messages').insert({
        dossier_id: dossierId,
        author_id: user.id,
        author_role: asStaff ? 'staff' : 'client',
        body,
        internal_note: !!internal,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dossier-messages', dossierId] }),
  });

  return { messages, isLoading, sendMessage };
}
