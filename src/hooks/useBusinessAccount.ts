import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type BusinessAccountStatus = 'pending' | 'active' | 'suspended';

export interface BusinessAccount {
  id: string;
  user_id: string;
  ninea: string;
  legal_name: string;
  legal_form: string;
  sector: string;
  headquarters_address: string;
  website: string | null;
  admin_full_name: string;
  admin_role: string;
  admin_phone: string;
  admin_email: string;
  status: BusinessAccountStatus;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useBusinessAccount() {
  const { user, loading: authLoading } = useAuth();
  const [account, setAccount] = useState<BusinessAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setAccount(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('business_accounts')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) console.error('useBusinessAccount', error);
    setAccount((data as BusinessAccount) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, refresh]);

  return { account, loading: loading || authLoading, refresh };
}
