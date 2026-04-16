import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Address } from '@/lib/types';

export function useAddresses() {
  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .order('country');
      if (error) throw error;
      return data as Address[];
    },
  });

  return { addresses, isLoading };
}
