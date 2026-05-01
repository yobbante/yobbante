import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AccountManager {
  id: string;
  business_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  photo_url: string | null;
}

export function useAccountManager(businessId: string | undefined) {
  const [manager, setManager] = useState<AccountManager | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!businessId) {
      setManager(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('business_account_managers')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();
    setManager((data as AccountManager) ?? null);
    setLoading(false);
  }, [businessId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { manager, loading, refresh };
}
