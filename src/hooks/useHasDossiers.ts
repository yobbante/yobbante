import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Returns `true` when the authenticated user already has at least one dossier.
 * Used to redirect repeat clients straight to /app instead of the landing page.
 */
export function useHasDossiers(): { hasDossiers: boolean; loading: boolean } {
  const { user } = useAuth();
  const [hasDossiers, setHasDossiers] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setHasDossiers(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const { count } = await supabase
          .from('dossiers')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);
        if (!cancelled) setHasDossiers((count ?? 0) > 0);
      } catch {
        if (!cancelled) setHasDossiers(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return { hasDossiers, loading };
}
