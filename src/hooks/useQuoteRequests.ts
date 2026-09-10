import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface QuoteRequestRow {
  id: string;
  reference: string | null;
  tracking_id: string | null;
  status: string;
  buyer_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  origin_city: string | null;
  destination_city: string | null;
  origin_country: string | null;
  destination_country: string | null;
  estimated_weight: number | null;
  transport_mode: string | null;
  product_description: string | null;
  intake_notes: string | null;
  source: string | null;
  created_at: string;
}

const SELECT =
  'id, reference, tracking_id, status, buyer_name, contact_phone, contact_email, origin_city, destination_city, origin_country, destination_country, estimated_weight, transport_mode, product_description, intake_notes, source, created_at';

/** Toutes les demandes de devis entrantes (formulaire unique /demande-devis + WhatsApp). */
export function useQuoteRequests(opts: { limit?: number } = {}) {
  const { limit = 200 } = opts;
  return useQuery({
    queryKey: ['quote-requests', limit],
    staleTime: 20_000,
    queryFn: async (): Promise<QuoteRequestRow[]> => {
      const { data, error } = await supabase
        .from('dossiers')
        .select(SELECT)
        .in('status', ['QUOTE_REQUESTED', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'QUOTE_REFUSED'])
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as QuoteRequestRow[];
    },
  });
}

export function useQuoteRequestActions() {
  const qc = useQueryClient();
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('dossiers')
        .update({ status: status as never })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quote-requests'] });
      qc.invalidateQueries({ queryKey: ['dossiers'] });
    },
  });
  return { setStatus };
}
