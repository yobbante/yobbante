import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Wallet, TrendingUp, TrendingDown, Receipt, FileDown, Bell, Check, ShoppingBag, Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatXof } from '@/lib/gpFinance';
import { PaytechTransactionsPanel } from './PaytechTransactionsPanel';

const YELLOW = '#F5C518';

type PaidDossier = {
  id: string;
  reference: string;
  tracking_id: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  destination_city: string | null;
  destination_country: string | null;
  final_amount_xof: number | null;
  payment_method: string | null;
  payment_provider_ref: string | null;
  paid_at: string | null;
  invoice_url: string | null;
  invoice_number: string | null;
};

type PendingDossier = {
  id: string;
  reference: string;
  tracking_id: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  destination_city: string | null;
  destination_country: string | null;
  final_amount_xof: number | null;
  weighed_at: string | null;
  payment_reminders_count: number;
  last_payment_reminder_at: string | null;
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  free_money: 'Free Money',
  cash: 'Espèces',
  bank_transfer: 'Virement',
  stripe: 'Carte (Stripe)',
  paypal: 'PayPal',
};

function startOfMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfPrevMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}

export function RevenusTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const now = useMemo(() => new Date(), []);
  const som = useMemo(() => startOfMonth(now).toISOString(), [now]);
  const sopm = useMemo(() => startOfPrevMonth(now).toISOString(), [now]);

  // ---- KPI : mois courant + mois précédent ----
  const { data: kpiData, isLoading: kpiLoading } = useQuery({
    queryKey: ['revenus-kpis', som, sopm],
    queryFn: async () => {
      const [{ data: cur }, { data: prev }, { data: pendingCount }] = await Promise.all([
        supabase
          .from('dossiers')
          .select('final_amount_xof, payment_status, paid_at')
          .gte('paid_at', som)
          .eq('payment_status', 'paid'),
        supabase
          .from('dossiers')
          .select('final_amount_xof, paid_at')
          .gte('paid_at', sopm)
          .lt('paid_at', som)
          .eq('payment_status', 'paid'),
        supabase
          .from('dossiers')
          .select('id', { count: 'exact', head: true })
          .eq('payment_status', 'pending')
          .eq('status', 'WEIGHED'),
      ]);

      const revenuMois = (cur ?? []).reduce((s: number, r: any) => s + Number(r.final_amount_xof ?? 0), 0);
      const revenuPrev = (prev ?? []).reduce((s: number, r: any) => s + Number(r.final_amount_xof ?? 0), 0);
      const nbPayes = (cur ?? []).length;
      const panierMoyen = nbPayes > 0 ? Math.round(revenuMois / nbPayes) : 0;
      const variation = revenuPrev > 0 ? ((revenuMois - revenuPrev) / revenuPrev) * 100 : null;
      return { revenuMois, revenuPrev, panierMoyen, nbPayes, variation };
    },
  });

  // ---- Liste paiements reçus (mois courant) ----
  const { data: paid = [], isLoading: paidLoading } = useQuery({
    queryKey: ['revenus-paid', som],
    queryFn: async (): Promise<PaidDossier[]> => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('id, reference, tracking_id, contact_phone, contact_email, destination_city, destination_country, final_amount_xof, payment_method, payment_provider_ref, paid_at, invoice_url, invoice_number')
        .eq('payment_status', 'paid')
        .gte('paid_at', som)
        .order('paid_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as PaidDossier[];
    },
  });

  // ---- Liste paiements en attente ----
  const { data: pending = [], isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ['revenus-pending'],
    queryFn: async (): Promise<PendingDossier[]> => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('id, reference, tracking_id, contact_phone, contact_email, destination_city, destination_country, final_amount_xof, weighed_at, payment_reminders_count, last_payment_reminder_at')
        .eq('payment_status', 'pending')
        .eq('status', 'WEIGHED')
        .order('weighed_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as PendingDossier[];
    },
  });

  // ---- Mutations ----
  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('dossiers')
        .update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: 'cash',
        } as any)
        .eq('id', id);
      if (error) throw error;
      await supabase.from('dossier_events').insert({
        dossier_id: id,
        event_type: 'payment_marked_paid',
        event_data: { method: 'cash', source: 'admin_revenus' },
        visible_to_client: false,
      } as any);
    },
    onSuccess: () => {
      toast.success('Paiement marqué comme reçu');
      qc.invalidateQueries({ queryKey: ['revenus-pending'] });
      qc.invalidateQueries({ queryKey: ['revenus-paid'] });
      qc.invalidateQueries({ queryKey: ['revenus-kpis'] });
    },
    onError: (e: Error) => toast.error('Échec : ' + e.message),
  });

  const sendReminder = useMutation({
    mutationFn: async (d: PendingDossier) => {
      const { error } = await supabase.functions.invoke('payment-reminder', {
        body: { dossier_id: d.id },
      });
      if (error) {
        // Fallback : juste incrémenter
        const { error: e2 } = await supabase
          .from('dossiers')
          .update({
            payment_reminders_count: (d.payment_reminders_count ?? 0) + 1,
            last_payment_reminder_at: new Date().toISOString(),
          } as any)
          .eq('id', d.id);
        if (e2) throw e2;
        await supabase.from('dossier_events').insert({
          dossier_id: d.id,
          event_type: 'payment_reminder_sent',
          event_data: { channel: 'manual', source: 'admin_revenus' },
          visible_to_client: false,
        } as any);
      }
    },
    onSuccess: () => {
      toast.success('Relance enregistrée');
      refetchPending();
    },
    onError: (e: Error) => toast.error('Échec : ' + e.message),
  });

  // ---- CSV Export ----
  function exportCsv() {
    const rows = paid;
    if (rows.length === 0) {
      toast.error('Aucun paiement à exporter pour ce mois');
      return;
    }
    const header = ['Référence', 'Tracking', 'Destination', 'Montant XOF', 'Méthode', 'Référence paiement', 'Numéro facture', 'Payé le'];
    const lines = rows.map(r => [
      r.reference,
      r.tracking_id ?? '',
      `${r.destination_city ?? ''} ${r.destination_country ?? ''}`.trim(),
      String(r.final_amount_xof ?? 0),
      r.payment_method ? PAYMENT_METHOD_LABEL[r.payment_method] ?? r.payment_method : '',
      r.payment_provider_ref ?? '',
      r.invoice_number ?? '',
      r.paid_at ? new Date(r.paid_at).toLocaleString('fr-FR') : '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const monthLabel = now.toLocaleDateString('fr-FR', { month: '2-digit', year: 'numeric' }).replace('/', '-');
    a.href = url;
    a.download = `revenus-yobbante-${monthLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} ligne(s) exportée(s)`);
  }

  // ---- Search filters ----
  const filteredPaid = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return paid;
    return paid.filter(r =>
      r.reference?.toLowerCase().includes(q) ||
      r.tracking_id?.toLowerCase().includes(q) ||
      r.contact_phone?.toLowerCase().includes(q) ||
      r.contact_email?.toLowerCase().includes(q),
    );
  }, [paid, search]);

  const filteredPending = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pending;
    return pending.filter(r =>
      r.reference?.toLowerCase().includes(q) ||
      r.tracking_id?.toLowerCase().includes(q) ||
      r.contact_phone?.toLowerCase().includes(q) ||
      r.contact_email?.toLowerCase().includes(q),
    );
  }, [pending, search]);

  const totalPendingXof = useMemo(
    () => pending.reduce((s, r) => s + Number(r.final_amount_xof ?? 0), 0),
    [pending],
  );

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Wallet className="w-5 h-5" style={{ color: YELLOW }} />
            Revenus
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Vue financière clients · paiements reçus et relances · réservé admin
          </p>
        </div>
        <Button
          onClick={exportCsv}
          size="sm"
          variant="outline"
          className="gap-2"
        >
          <FileDown className="w-4 h-4" />
          Export CSV du mois
        </Button>
      </header>

      {/* ============ Section 1 : KPIs ============ */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <KpiCard
              label="Revenus ce mois"
              value={formatXof(kpiData?.revenuMois ?? 0)}
              icon={TrendingUp}
              accent
              extra={`${kpiData?.nbPayes ?? 0} paiement(s)`}
            />
            <KpiCard
              label="Mois précédent"
              value={formatXof(kpiData?.revenuPrev ?? 0)}
              icon={Receipt}
              extra={
                kpiData?.variation == null
                  ? '—'
                  : `${kpiData.variation >= 0 ? '+' : ''}${kpiData.variation.toFixed(1)}% vs N-1`
              }
              extraColor={
                kpiData?.variation == null
                  ? undefined
                  : kpiData.variation >= 0
                    ? 'text-emerald-500'
                    : 'text-destructive'
              }
            />
            <KpiCard
              label="Panier moyen"
              value={formatXof(kpiData?.panierMoyen ?? 0)}
              icon={ShoppingBag}
            />
            <KpiCard
              label="En attente paiement"
              value={formatXof(totalPendingXof)}
              icon={TrendingDown}
              extra={`${pending.length} dossier(s)`}
              warn
            />
          </>
        )}
      </section>

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher (réf, tracking, téléphone, email)…"
          className="pl-9 h-9"
        />
      </div>

      {/* ============ Section 2 : Paiements reçus ============ */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Paiements reçus ce mois
          </h2>
          <Badge variant="outline" className="text-xs">
            {filteredPaid.length} / {paid.length}
          </Badge>
        </div>

        {paidLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : filteredPaid.length === 0 ? (
          <EmptyState text={search ? 'Aucun résultat.' : 'Aucun paiement reçu ce mois.'} />
        ) : (
          <div className="border border-border rounded-xl overflow-hidden bg-card divide-y divide-border">
            {filteredPaid.map(r => (
              <div key={r.id} className="px-4 py-3 grid md:grid-cols-[1fr_auto] gap-2 items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.tracking_id || r.reference}
                    </span>
                    {r.payment_method && (
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {PAYMENT_METHOD_LABEL[r.payment_method] ?? r.payment_method}
                      </Badge>
                    )}
                    {r.invoice_number && (
                      <Badge variant="outline" className="text-[10px]">
                        F° {r.invoice_number}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-foreground mt-0.5 truncate">
                    {r.destination_city ?? '—'} · {r.contact_phone || r.contact_email || 'Contact ?'}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Payé le {r.paid_at ? new Date(r.paid_at).toLocaleString('fr-FR') : '—'}
                    {r.payment_provider_ref && <> · Réf {r.payment_provider_ref}</>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-[#F5C518]">{formatXof(r.final_amount_xof ?? 0)}</div>
                  {r.invoice_url && (
                    <a
                      href={r.invoice_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-muted-foreground hover:text-foreground underline"
                    >
                      Voir facture
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ============ Section 3 : Paiements en attente ============ */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
            En attente paiement (pesés non payés)
          </h2>
          <Badge variant="outline" className="text-xs">
            {filteredPending.length} / {pending.length}
          </Badge>
        </div>

        {pendingLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : filteredPending.length === 0 ? (
          <EmptyState text={search ? 'Aucun résultat.' : '🎉 Aucun paiement en attente.'} />
        ) : (
          <div className="border border-border rounded-xl overflow-hidden bg-card divide-y divide-border">
            {filteredPending.map(r => (
              <div key={r.id} className="px-4 py-3 grid md:grid-cols-[1fr_auto] gap-2 items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.tracking_id || r.reference}
                    </span>
                    {(r.payment_reminders_count ?? 0) > 0 && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Bell className="w-3 h-3" />
                        {r.payment_reminders_count} relance(s)
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-foreground mt-0.5 truncate">
                    {r.destination_city ?? '—'} · {r.contact_phone || r.contact_email || 'Contact ?'}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Pesé le {r.weighed_at ? new Date(r.weighed_at).toLocaleDateString('fr-FR') : '—'}
                    {r.last_payment_reminder_at && (
                      <> · Dernière relance {new Date(r.last_payment_reminder_at).toLocaleDateString('fr-FR')}</>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right mr-2">
                    <div className="font-bold text-foreground">{formatXof(r.final_amount_xof ?? 0)}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendReminder.mutate(r)}
                    disabled={sendReminder.isPending}
                    className="gap-1"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    Relancer
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => markPaid.mutate(r.id)}
                    disabled={markPaid.isPending}
                    style={{ background: YELLOW, color: '#000' }}
                    className="gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Marquer payé
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <PaytechTransactionsPanel />
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, accent, warn, extra, extraColor }: {
  label: string; value: string; icon?: any; accent?: boolean; warn?: boolean;
  extra?: string; extraColor?: string;
}) {
  const ring = accent
    ? 'border-[#F5C518]/40 bg-[#F5C518]/5'
    : warn
      ? 'border-amber-500/30 bg-amber-500/5'
      : 'border-border bg-card';
  const valueClr = accent ? 'text-[#F5C518]' : warn ? 'text-amber-500' : 'text-foreground';
  return (
    <div className={`rounded-xl border px-4 py-3 ${ring}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className={`text-lg font-bold mt-1.5 ${valueClr}`}>{value}</div>
      {extra && <div className={`text-[11px] mt-0.5 ${extraColor ?? 'text-muted-foreground'}`}>{extra}</div>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
