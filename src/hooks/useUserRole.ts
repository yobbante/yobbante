import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'staff' | 'user';

export function useUserRole() {
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['user-roles'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [] as AppRole[];
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      if (error) return [] as AppRole[];
      return (data || []).map(r => r.role as AppRole);
    },
  });

  return {
    roles,
    isLoading,
    isAdmin: roles.includes('admin'),
    isStaff: roles.includes('admin') || roles.includes('staff'),
  };
}
