import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';

type Tx = {
  id: string;
  tracking_id: string | null;
  reference: string | null;
  final_amount_xof: number | null;
  payment_status: string | null;
  payment_method: string | null;
  payment_external_id: string | null;
  payment_provider_ref: string | null;
  paid_at: string | null;
  updated_at: string;
};

type Filter = 'all' | 'paid' | 'pending' | 'canceled';

export function PaytechTransactionsPanel() {
  const [rows, setRows] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [checkingId, setCheckingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('dossiers')
      .select('id, tracking_id, reference, final_amount_xof, payment_status, payment_method, payment_external_id, payment_provider_ref, paid_at, updated_at')
      .or('payment_method.eq.paytech,payment_external_id.like.YOB-PAY-%')
      .order('updated_at', { ascending: false })
      .limit(100);
    setLoading(false);
    if (error) { toast.error('Erreur chargement transactions'); return; }
    setRows((data ?? []) as Tx[]);
  }

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'paid') return r.payment_status === 'paid';
    if (filter === 'pending') return r.payment_status === 'pending';
    if (filter === 'canceled') return r.payment_status === 'canceled' || r.payment_status === 'cancelled';
    return true;
  });

  async function checkStatus(tx: Tx) {
    setCheckingId(tx.id);
    try {
      const { data, error } = await supabase.functions.invoke('paytech-check-status', {
        body: { ref_command: tx.payment_external_id, tracking_id: tx.tracking_id },
      });
      if (error) throw error;
      if (data?.available === false) {
        toast.info('PayTech non configuré');
      } else {
        toast.success(`PayTech: ${JSON.stringify(data?.data ?? data).slice(0, 120)}`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur vérification');
    } finally {
      setCheckingId(null);
    }
  }

  return (
    <section className="surface-card mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Transactions PayTech
          </h3>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {(['all', 'paid', 'pending', 'canceled'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded-full border ${filter === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-secondary'}`}
          >
            {f === 'all' ? 'Tous' : f === 'paid' ? 'Payés' : f === 'pending' ? 'En attente' : 'Annulés'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
          Aucune transaction PayTech.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="py-2 pr-3">Tracking</th>
                <th className="py-2 pr-3">Montant</th>
                <th className="py-2 pr-3">Statut</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Ref PayTech</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx => (
                <tr key={tx.id} className="border-t border-border/40">
                  <td className="py-2 pr-3 font-mono">{tx.tracking_id ?? tx.reference}</td>
                  <td className="py-2 pr-3">{tx.final_amount_xof?.toLocaleString('fr-FR') ?? '—'} XOF</td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${tx.payment_status === 'paid'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : tx.payment_status === 'pending'
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-red-500/15 text-red-400'}`}>
                      {tx.payment_status ?? '—'}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {tx.paid_at ? new Date(tx.paid_at).toLocaleString('fr-FR') : new Date(tx.updated_at).toLocaleString('fr-FR')}
                  </td>
                  <td className="py-2 pr-3 font-mono text-[10px] text-muted-foreground truncate max-w-[180px]">
                    {tx.payment_external_id ?? tx.payment_provider_ref ?? '—'}
                  </td>
                  <td className="py-2 pr-3">
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => checkStatus(tx)}
                      disabled={checkingId === tx.id}
                    >
                      {checkingId === tx.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Search className="w-3 h-3" />
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
