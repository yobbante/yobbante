import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type FreightPartnerMode = 'air' | 'sea' | 'both';

export interface FreightPartner {
  id: string;
  reference: string;
  company_name: string;
  mode: FreightPartnerMode;
  contact_name: string | null;
  phone: string;
  email: string | null;
  city: string | null;
  country: string | null;
  hubs: string[];
  default_price_per_kg_xof: number | null;
  default_price_per_cbm_xof: number | null;
  default_transit_days: number | null;
  status: 'active' | 'suspended';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type FreightPartnerInput = Partial<FreightPartner>;

export const FP_MODE_LABEL: Record<FreightPartnerMode, string> = {
  air: 'Aérien',
  sea: 'Maritime',
  both: 'Aérien + Maritime',
};

export function useFreightPartners() {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['freight_partners'],
    queryFn: async (): Promise<FreightPartner[]> => {
      const { data, error } = await supabase
        .from('freight_partners' as any)
        .select('*')
        .order('company_name');
      if (error) throw error;
      return (data ?? []) as unknown as FreightPartner[];
    },
  });

  const save = useMutation({
    mutationFn: async (input: FreightPartnerInput) => {
      const payload: Record<string, unknown> = {
        company_name: (input.company_name ?? '').trim(),
        mode: input.mode ?? 'air',
        contact_name: input.contact_name || null,
        phone: (input.phone ?? '').trim(),
        email: input.email || null,
        city: input.city || null,
        country: input.country || null,
        hubs: input.hubs ?? [],
        default_price_per_kg_xof: input.default_price_per_kg_xof ?? null,
        default_price_per_cbm_xof: input.default_price_per_cbm_xof ?? null,
        default_transit_days: input.default_transit_days ?? null,
        status: input.status ?? 'active',
        notes: input.notes || null,
      };
      if (input.id) {
        const { error } = await supabase.from('freight_partners' as any).update(payload).eq('id', input.id);
        if (error) throw error;
        return input.id;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('freight_partners' as any)
        .insert({ ...payload, created_by: user?.id ?? null })
        .select('id')
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['freight_partners'] }); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('freight_partners' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['freight_partners'] }); },
  });

  /** Génère un lien d'accès (7 jours) pour l'espace partenaire. */
  const createAccessLink = useMutation({
    mutationFn: async (partnerId: string) => {
      const { data, error } = await supabase.rpc('fp_admin_create_token' as any, { p_partner_id: partnerId });
      if (error) throw error;
      const r = data as any;
      if (!r?.ok) throw new Error("Impossible de générer le lien d'accès");
      return {
        url: `${window.location.origin}/partenaire/auth?token=${r.token}`,
        phone: String(r.phone ?? '').replace(/\D/g, ''),
        company_name: r.company_name as string,
      };
    },
  });

  return { list, save, remove, createAccessLink };
}
