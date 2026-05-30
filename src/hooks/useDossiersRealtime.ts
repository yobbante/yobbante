import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DOSSIER_STATUS_LABELS, type DossierStatus } from '@/lib/types';

/**
 * Subscribe to realtime status changes on the user's dossiers.
 * Invalidates react-query cache + toasts the new status in French.
 */
export function useDossiersRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const seenRef = useRef<Map<string, DossierStatus>>(new Map());

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`dossiers-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'dossiers', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const next = payload.new as { id: string; reference?: string; status: DossierStatus };
          const prev = seenRef.current.get(next.id);
          seenRef.current.set(next.id, next.status);
          if (prev && prev !== next.status) {
            const label = DOSSIER_STATUS_LABELS[next.status] ?? next.status;
            toast.success(`Votre colis ${next.reference ?? ''} est maintenant ${label.toLowerCase()}`);
          }
          qc.invalidateQueries({ queryKey: ['dossiers'] });
          qc.invalidateQueries({ queryKey: ['dossier', next.id] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc]);
}
