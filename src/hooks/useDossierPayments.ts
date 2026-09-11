import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type PaymentDirection = 'client' | 'carrier';

export interface DossierPayment {
  id: string;
  dossier_id: string;
  direction: PaymentDirection;
  amount_xof: number;
  method: string | null;
  paid_at: string;
  payee: string | null;
  note: string | null;
  created_at: string;
}

export const PAYMENT_METHODS = ['wave', 'orange_money', 'cash', 'virement', 'paytech', 'autre'] as const;

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  cash: 'Espèces',
  virement: 'Virement',
  paytech: 'PayTech',
  autre: 'Autre',
};

/**
 * Journal des règlements d'un envoi : acomptes/soldes du client sur le dossier
 * parent, reversements transporteurs sur chacun des colis.
 * `ids` accepte le dossier et ses colis pour tout afficher au même endroit.
 */
export function useDossierPayments(ids: (string | null | undefined)[]) {
  const list = ids.filter(Boolean) as string[];
  return useQuery({
    queryKey: ['dossier-payments', [...list].sort().join(',')],
    enabled: list.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossier_payments')
        .select('id, dossier_id, direction, amount_xof, method, paid_at, payee, note, created_at')
        .in('dossier_id', list)
        .order('paid_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DossierPayment[];
    },
  });
}

export function useAddDossierPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: {
      dossier_id: string;
      direction: PaymentDirection;
      amount_xof: number;
      method?: string | null;
      paid_at?: string | null;
      payee?: string | null;
      note?: string | null;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('dossier_payments').insert({
        ...row,
        paid_at: row.paid_at ?? new Date().toISOString(),
        created_by: auth?.user?.id ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => invalidatePayments(qc),
  });
}

export function useDeleteDossierPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('dossier_payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidatePayments(qc),
  });
}

function invalidatePayments(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['dossier-payments'] });
  qc.invalidateQueries({ queryKey: ['all-payments'] });
  qc.invalidateQueries({ queryKey: ['finance-ledger'] });
}

/** Totaux : encaissé côté client, reversé côté transporteurs. */
export function sumPayments(rows: DossierPayment[] | undefined, direction: PaymentDirection): number {
  return (rows ?? [])
    .filter((r) => r.direction === direction)
    .reduce((s, r) => s + Number(r.amount_xof || 0), 0);
}
