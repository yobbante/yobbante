import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type DossierType = 'business_import' | 'business_export' | 'business_sourcing';

export interface BusinessDossier {
  id: string;
  reference: string;
  business_id: string;
  user_id: string;
  dossier_type: DossierType;
  status: string;
  product_description: string;
  origin_country: string;
  destination_country: string;
  incoterm: string | null;
  hs_code: string | null;
  currency: string | null;
  declared_value: number | null;
  supplier_name: string | null;
  supplier_country: string | null;
  buyer_name: string | null;
  buyer_country: string | null;
  quantity: number | null;
  unit: string | null;
  estimated_weight: number | null;
  budget_eur: number | null;
  notes: string | null;
  created_at: string;
}

export function useBusinessDossiers(businessId: string | undefined) {
  const [dossiers, setDossiers] = useState<BusinessDossier[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!businessId) {
      setDossiers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('dossiers')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    if (error) console.error('useBusinessDossiers', error);
    setDossiers((data as BusinessDossier[]) ?? []);
    setLoading(false);
  }, [businessId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { dossiers, loading, refresh };
}
