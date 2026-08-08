import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Search, CheckCircle2, CreditCard } from 'lucide-react';

type PayOrder = {
  id: string;
  reference: string;
  customer_name: string;
  customer_phone: string;
  total_fcfa: number;
  payment_method: string;
  payment_status: string;
  payment_external_id: string | null;
  payment_provider_ref: string | null;
  paid_at: string | null;
  status: string;
  created_at: string;
};

type Filter = 'all' | 'pending' | 'paid' | 'failed';

const PAY_LABEL: Record<string, string> = {
  wave: 'Wave', om: 'Orange Money', card: 'Carte', cash: 'À la livraison',
};

const fmtXof = (n: number) => `${(n ?? 0).toLocaleString('fr-FR')} FCFA`;
const fmtDate = (s: string) => new Date(s).toLocaleString('fr-FR');

export function DekkPaymentsPanel() {
  const [rows, setRows] = useState<PayOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('dekk_orders' as any)
      .select('id, reference, customer_name, customer_phone, total_fcfa, payment_method, payment_status, payment_external_id, payment_provider_ref, paid_at, status, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) { toast.error('Erreur chargement paiements'); return; }
    setRows((data ?? []) as unknown as PayOrder[]);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter(r => {
    const okFilter =
      filter === 'all' ? true :
      filter === 'paid' ? r.payment_status === 'paid' :
      filter === 'pending' ? r.payment_status === 'pending' :
      !['paid', 'pending'].includes(r.payment_status);
    if (!okFilter) return false;
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return [r.reference, r.customer_name, r.customer_phone, r.payment_external_id ?? '']
      .some(v => v.toLowerCase().includes(needle));
  }), [rows, filter, q]);

  const kpis = useMemo(() => {
    const paid = rows.filter(r => r.payment_status === 'paid');
    const pending = rows.filter(r => r.payment_status === 'pending' && r.payment_method !== 'cash');
    return {
      encaisse: paid.reduce((s, r) => s + (r.total_fcfa ?? 0), 0),
      nbPaid: paid.length,
      enAttente: pending.reduce((s, r) => s + (r.total_fcfa ?? 0), 0),
      nbPending: pending.length,
    };
  }, [rows]);

  async function checkStatus(o: PayOrder) {
    setBusyId(o.id);
    try {
      const { data, error } = await supabase.functions.invoke('paytech-check-status', {
        body: { ref_command: o.payment_external_id },
      });
      if (error) throw error;
      if (data?.available === false) toast.info('PayTech non configuré');
      else toast.success(`PayTech: ${JSON.stringify(data?.data ?? data).slice(0, 140)}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur vérification');
    } finally { setBusyId(null); }
  }

  async function markPaid(o: PayOrder) {
    if (!confirm(`Marquer la commande ${o.reference} comme payée (${fmtXof(o.total_fcfa)}) ?`)) return;
    setBusyId(o.id);
    const { error } = await supabase
      .from('dekk_orders' as any)
      .update({ payment_status: 'paid', paid_at: new Date().toISOString(), status: 'paid' })
      .eq('id', o.id);
    setBusyId(null);
    if (error) { toast.error('Échec mise à jour'); return; }
    toast.success('Paiement confirmé manuellement');
    load();
  }

  return (
    <section>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Kpi label="Encaissé" value={fmtXof(kpis.encaisse)} sub={`${kpis.nbPaid} commande(s)`} tone="ok" />
        <Kpi label="En attente" value={fmtXof(kpis.enAttente)} sub={`${kpis.nbPending} commande(s)`} tone="warn" />
        <Kpi label="Commandes" value={String(rows.length)} sub="200 dernières" />
        <Kpi label="Taux de paiement" value={rows.length ? `${Math.round((kpis.nbPaid / rows.length) * 100)}%` : '—'} sub="payées / total" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {(['all', 'pending', 'paid', 'failed'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded-full border ${filter === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-secondary'}`}
          >
            {f === 'all' ? 'Tous' : f === 'pending' ? 'En attente' : f === 'paid' ? 'Payés' : 'Échoués'}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Référence, client, DEKK-PAY…"
            className="text-xs pl-8 pr-3 py-1.5 rounded-full border border-border bg-background w-56"
          />
        </div>
        <button onClick={load} disabled={loading} className="p-1.5 rounded-full border border-border text-muted-foreground hover:bg-secondary">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          <CreditCard className="w-5 h-5 mx-auto mb-2 opacity-60" />
          Aucun paiement pour ce filtre.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="py-2 pr-3">Commande</th>
                <th className="py-2 pr-3">Client</th>
                <th className="py-2 pr-3">Montant</th>
                <th className="py-2 pr-3">Moyen</th>
                <th className="py-2 pr-3">Paiement</th>
                <th className="py-2 pr-3">Réf. DEKK-PAY</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id} className="border-t border-border/40">
                  <td className="py-2 pr-3 font-mono">{o.reference}</td>
                  <td className="py-2 pr-3">
                    <div className="font-medium text-foreground">{o.customer_name}</div>
                    <div className="text-muted-foreground">{o.customer_phone}</div>
                  </td>
                  <td className="py-2 pr-3 font-medium">{fmtXof(o.total_fcfa)}</td>
                  <td className="py-2 pr-3">{PAY_LABEL[o.payment_method] ?? o.payment_method}</td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                      o.payment_status === 'paid' ? 'bg-emerald-500/15 text-emerald-500'
                        : o.payment_status === 'pending' ? 'bg-amber-500/15 text-amber-500'
                        : 'bg-red-500/15 text-red-500'}`}>
                      {o.payment_status}
                    </span>
                  </td>
                  <td className="py-2 pr-3 font-mono text-[10px] text-muted-foreground truncate max-w-[180px]">
                    {o.payment_external_id ?? '—'}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{fmtDate(o.paid_at ?? o.created_at)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {o.payment_external_id && (
                      <button onClick={() => checkStatus(o)} disabled={busyId === o.id}
                        title="Vérifier chez PayTech"
                        className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
                        {busyId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    {o.payment_status !== 'paid' && (
                      <button onClick={() => markPaid(o)} disabled={busyId === o.id}
                        title="Marquer comme payé"
                        className="p-1.5 rounded hover:bg-secondary text-emerald-500">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    )}
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

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-base font-semibold ${tone === 'ok' ? 'text-emerald-500' : tone === 'warn' ? 'text-amber-500' : 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
