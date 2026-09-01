import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatXof } from '@/lib/gpFinance';
import {
  useAllPayments, KIND_LABEL, MODE_LABEL,
  type PaymentKind, type PaymentRow, type TransportMode,
} from '@/hooks/useAllPayments';
import { PaymentDetailSheet } from './PaymentDetailSheet';

const KIND_FILTERS: { id: PaymentKind | 'all'; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'client', label: 'Encaissements' },
  { id: 'gp', label: 'GP' },
  { id: 'carrier', label: 'Aérien / Maritime' },
  { id: 'road', label: 'Routier' },
];

const STATUS_FILTERS = [
  { id: 'paid', label: 'Réglés' },
  { id: 'pending', label: 'En attente' },
] as const;

/** Onglet unique regroupant tous les paiements, tous modes confondus. */
export function PaymentsAllTab() {
  const { data: rows = [], isLoading, refetch, isFetching } = useAllPayments(12);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<PaymentKind | 'all'>('all');
  const [status, setStatus] = useState<'all' | 'paid' | 'pending'>('all');
  const [selected, setSelected] = useState<PaymentRow | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (kind !== 'all' && r.kind !== kind) return false;
      if (status === 'paid' && !r.paid) return false;
      if (status === 'pending' && r.paid) return false;
      if (!needle) return true;
      return [r.ref, r.clientName, r.route, r.method ?? ''].join(' ').toLowerCase().includes(needle);
    });
  }, [rows, q, kind, status]);

  const totals = useMemo(() => {
    let inPaid = 0, inDue = 0, outPaid = 0, outDue = 0;
    filtered.forEach((r) => {
      if (r.direction === 'in') r.paid ? (inPaid += r.amountXof) : (inDue += r.amountXof);
      else r.paid ? (outPaid += r.amountXof) : (outDue += r.amountXof);
    });
    return { inPaid, inDue, outPaid, outDue };
  }, [filtered]);

  return (
    <div className="space-y-3">
      {/* Totaux du filtre courant */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Stat label="Encaissé" value={totals.inPaid} tone="success" />
        <Stat label="À encaisser" value={totals.inDue} tone="warn" />
        <Stat label="Reversé" value={totals.outPaid} tone="default" />
        <Stat label="À reverser" value={totals.outDue} tone="warn" />
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Réf, client, trajet…" className="pl-8 h-9 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-9">
          <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {KIND_FILTERS.map((f) => (
          <Chip key={f.id} active={kind === f.id} onClick={() => setKind(f.id)}>{f.label}</Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {MODE_FILTERS.map((f) => (
          <Chip key={f.id} active={mode === f.id} onClick={() => setMode(f.id)}>{f.label}</Chip>
        ))}
        {STATUS_FILTERS.map((f) => (
          <Chip key={f.id} active={status === f.id} onClick={() => setStatus(f.id)}>{f.label}</Chip>
        ))}
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Aucun paiement pour ces filtres.
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((r) => (
            <button
              key={r.key}
              onClick={() => setSelected(r)}
              className="w-full text-left rounded-xl border border-border bg-card p-3 hover:border-primary/50 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  'mt-0.5 rounded-lg p-1.5 shrink-0',
                  r.direction === 'in' ? 'bg-[hsl(var(--success)/0.12)]' : 'bg-muted',
                )}>
                  {r.direction === 'in'
                    ? <ArrowDownLeft className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
                    : <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium truncate">{r.ref}</span>
                    <Badge variant="outline" className="text-[10px]">{MODE_LABEL[r.mode]}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{KIND_LABEL[r.kind]}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{r.clientName} · {r.route}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(r.date).toLocaleDateString('fr-FR')}{r.method ? ` · ${r.method}` : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold tabular-nums">{formatXof(r.amountXof)}</div>
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full',
                    r.paid
                      ? 'bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]'
                      : 'bg-amber-500/10 text-amber-500',
                  )}>
                    {r.paid ? 'Réglé' : 'En attente'}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <PaymentDetailSheet
        payment={selected}
        open={!!selected}
        onOpenChange={(v) => { if (!v) setSelected(null); }}
      />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-xs px-2.5 py-1 rounded-full border transition-colors',
        active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'success' | 'warn' | 'default' }) {
  const text = tone === 'success' ? 'text-[hsl(var(--success))]' : tone === 'warn' ? 'text-amber-500' : 'text-foreground';
  return (
    <div className="rounded-xl border border-border bg-card p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-sm md:text-lg font-semibold tabular-nums', text)}>{formatXof(value)}</div>
    </div>
  );
}
