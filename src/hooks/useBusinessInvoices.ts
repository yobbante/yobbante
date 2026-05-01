import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type InvoiceStatus = 'draft' | 'unpaid' | 'paid' | 'overdue' | 'cancelled';

export interface BusinessInvoice {
  id: string;
  business_id: string;
  reference: string;
  amount_eur: number;
  amount_xof: number | null;
  status: InvoiceStatus;
  issued_at: string;
  due_at: string;
  paid_at: string | null;
  description: string | null;
  shipment_id: string | null;
  dossier_id: string | null;
  last_reminder_at: string | null;
  reminder_count: number;
  created_at: string;
}

export function useBusinessInvoices(businessId: string | undefined) {
  const [invoices, setInvoices] = useState<BusinessInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!businessId) {
      setInvoices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('business_invoices')
      .select('*')
      .eq('business_id', businessId)
      .order('issued_at', { ascending: false });
    if (error) console.error('useBusinessInvoices', error);
    setInvoices((data as BusinessInvoice[]) ?? []);
    setLoading(false);
  }, [businessId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { invoices, loading, refresh };
}

export function exportInvoicesCSV(invoices: BusinessInvoice[]): string {
  const headers = ['Référence', 'Émise le', 'Échéance', 'Statut', 'Montant EUR', 'Montant XOF', 'Description', 'Payée le'];
  const rows = invoices.map(i => [
    i.reference,
    i.issued_at,
    i.due_at,
    i.status,
    i.amount_eur.toFixed(2),
    i.amount_xof?.toString() ?? '',
    (i.description ?? '').replace(/"/g, '""'),
    i.paid_at ?? '',
  ]);
  return [headers, ...rows]
    .map(r => r.map(v => `"${v}"`).join(','))
    .join('\n');
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
