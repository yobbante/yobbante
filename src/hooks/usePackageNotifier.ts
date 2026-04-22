import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Package } from '@/lib/types';

/**
 * Listens to packages UPDATEs in realtime for the current user and fires an
 * instant toast notification when a package transitions to RECEIVED.
 * Mounted once at the app root so notifications fire on every route.
 */
export function usePackageNotifier() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      channel = supabase
        .channel(`packages-notifier-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'packages', filter: `user_id=eq.${user.id}` },
          (payload) => {
            const next = payload.new as Package;
            const prev = payload.old as Partial<Package>;
            if (next.status === 'RECEIVED' && prev?.status !== 'RECEIVED') {
              const label = next.description?.trim() || `Colis ${next.id.slice(0, 6).toUpperCase()}`;
              toast.success('Colis reçu en entrepôt', {
                description: `${label} vient d'être réceptionné.`,
              });
              queryClient.invalidateQueries({ queryKey: ['packages'] });
            }
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
