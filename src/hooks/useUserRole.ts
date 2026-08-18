import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AppRole = 'admin' | 'staff' | 'user' | 'agent_support' | 'agent_terrain';

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['user-roles', user?.id ?? 'anon'],
    enabled: !authLoading,
    queryFn: async () => {
      if (!user) return [] as AppRole[];
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      if (error) {
        console.error('[useUserRole] fetch error', error);
        return [] as AppRole[];
      }
      return (data || []).map((r) => r.role as AppRole);
    },
  });

  // Invalidate cache on any auth change (sign-in / sign-out / refresh)
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  const isLoading = authLoading || rolesLoading;

  return {
    roles,
    isLoading,
    isAdmin: roles.includes('admin'),
    isStaff:
      roles.includes('admin') || roles.includes('staff') ||
      roles.includes('agent_support') || roles.includes('agent_terrain'),
    // Agent service client : accès restreint (dossiers, messages, clients)
    isAgentSupport:
      roles.includes('agent_support') &&
      !roles.includes('admin') &&
      !roles.includes('staff'),
    // Agent terrain : accès restreint au module Fret routier (Terminal D)
    isAgentTerrain:
      roles.includes('agent_terrain') &&
      !roles.includes('admin') &&
      !roles.includes('staff') &&
      !roles.includes('agent_support'),
  };
}
