import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Inbox, Truck, Warehouse, ShoppingCart, CheckCircle2, ArrowUpRight, Plane,
  AlertTriangle, MessageSquare, Building2, CreditCard, Star, Package,
  TrendingUp, TrendingDown, Activity, Clock, Users as UsersIcon,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { COUNTRY_FLAGS, DOSSIER_STATUS_LABELS, type Dossier } from '@/lib/types';
import { useDeparturesSummary } from '@/hooks/useManualDepartures';
import type { AdminSection } from './AdminSidebar';

/* ───────────────────────── helpers ───────────────────────── */
const fmtN = (n: number) => new Intl.NumberFormat('fr-FR').format(n);
const fmtXOF = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' FCFA';

function isWithin(d: string | Date | null | undefined, days: number) {
  if (!d) return false;
  const t = new Date(d).getTime();
  return Date.now() - t <= days * 86400_000;
}

/* ───────────────────────── component ─────────────────────── */
export function OverviewTab({ onJump }: { onJump: (s: AdminSection) => void }) {
  const { data: depSummary } = useDeparturesSummary();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-overview-v2'],
    staleTime: 60_000,
    queryFn: async () => {
      const [dossiersR, shipmentsR, packagesR, reviewsR, invoicesR, entR, inboxR] = await Promise.all([
        supabase.from('dossiers')
          .select('id, status, reference, product_description, origin_country, destination_country, created_at, payment_status, estimated_cost, tracking_id, business_id, dossier_type')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('shipments').select('id, status, eta, created_at').limit(1000),
        supabase.from('packages').select('id, status, created_at').limit(1000),
        supabase.from('customer_reviews').select('id, rating, would_recommend, created_at').limit(200),
        supabase.from('business_invoices').select('id, status, amount_xof, amount_eur, due_at').limit(500),
        supabase.from('enterprise_quotes').select('id, status, created_at').limit(200),
        supabase.from('dossiers').select('id').eq('status', 'SUBMITTED'),
      ]);
      return {
        dossiers: (dossiersR.data || []) as any[],
        shipments: shipmentsR.data || [],
        packages: packagesR.data || [],
        reviews: reviewsR.data || [],
        invoices: invoicesR.data || [],
        quotes: entR.data || [],
        inboxCount: (inboxR.data || []).length,
      };
    },
  });

  const metrics = useMemo(() => {
    if (!data) return null;
    const d = data.dossiers;
    const last7 = d.filter(x => isWithin(x.created_at, 7));
    const prev7 = d.filter(x => {
      const t = new Date(x.created_at).getTime();
      const now = Date.now();
      return t < now - 7 * 86400_000 && t >= now - 14 * 86400_000;
    });
    const delta = prev7.length === 0 ? null : Math.round(((last7.length - prev7.length) / prev7.length) * 100);

    const pipeline = {
      submitted: d.filter(x => x.status === 'SUBMITTED').length,
      review:    d.filter(x => x.status === 'IN_REVIEW').length,
      confirmed: d.filter(x => x.status === 'CONFIRMED').length,
      sourcing:  d.filter(x => x.status === 'SOURCING').length,
      transit:   data.shipments.filter(s => s.status === 'IN_TRANSIT').length,
      delivered: d.filter(x => x.status === 'DELIVERED').length,
    };

    const pendingPayments = d.filter(x => x.payment_status === 'pending' && x.estimated_cost).length;
    const revenuePending = d
      .filter(x => x.payment_status === 'pending')
      .reduce((s, x) => s + (Number(x.estimated_cost) || 0), 0);

    const business = d.filter(x => x.business_id).length;
    const individual = d.length - business;

    const avgRating = data.reviews.length
      ? data.reviews.reduce((s: number, r: any) => s + (r.rating || 0), 0) / data.reviews.length
      : null;
    const recommendPct = data.reviews.length
      ? Math.round((data.reviews.filter((r: any) => r.would_recommend).length / data.reviews.length) * 100)
      : null;

    const today = new Date().toISOString().slice(0, 10);
    const deliveriesToday = data.shipments.filter(s => s.eta && (s.eta as string).slice(0, 10) === today).length;

    const atHub = data.packages.filter(p => ['RECEIVED', 'IN_STORAGE'].includes(p.status as string)).length;

    const unpaidInvoices = data.invoices.filter((i: any) => i.status === 'unpaid').length;
    const newQuotes = data.quotes.filter((q: any) => q.status === 'NEW').length;

    return {
      last7: last7.length, delta, pipeline, pendingPayments, revenuePending,
      business, individual, avgRating, recommendPct, deliveriesToday, atHub,
      unpaidInvoices, newQuotes,
    };
  }, [data]);

  if (isLoading || !data || !metrics) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const recent = data.dossiers.slice(0, 10);

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-border">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
            Tableau de bord · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Vue d'ensemble Yobbanté
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {metrics.last7} nouveau{metrics.last7 > 1 ? 'x' : ''} dossier{metrics.last7 > 1 ? 's' : ''} sur 7 jours
            {metrics.delta !== null && (
              <span className={cn(
                'ml-2 inline-flex items-center gap-0.5 text-xs font-medium',
                metrics.delta >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]',
              )}>
                {metrics.delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {metrics.delta >= 0 ? '+' : ''}{metrics.delta}%
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <QuickAction icon={MessageSquare} label="Inbox" badge={data.inboxCount} onClick={() => onJump('inbox')} />
          <QuickAction icon={Plane}        label="Départs" onClick={() => onJump('departures')} />
          <QuickAction icon={UsersIcon}    label="Clients" onClick={() => onJump('clients')} />
        </div>
      </header>

      {/* ── KPI grid ───────────────────────────────────────── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          tone="default" icon={Inbox} label="Demandes ouvertes"
          value={metrics.pipeline.submitted + metrics.pipeline.review}
          hint={`${metrics.pipeline.submitted} à traiter`}
          onClick={() => onJump('requests')}
        />
        <Kpi
          tone="warning" icon={CreditCard} label="Paiements en attente"
          value={metrics.pendingPayments}
          hint={metrics.revenuePending > 0 ? fmtXOF(metrics.revenuePending) : '—'}
          onClick={() => onJump('orders')}
        />
        <Kpi
          tone="success" icon={Truck} label="En transit"
          value={metrics.pipeline.transit}
          hint={`${metrics.deliveriesToday} livraison${metrics.deliveriesToday > 1 ? 's' : ''} prévue${metrics.deliveriesToday > 1 ? 's' : ''} aujourd'hui`}
          onClick={() => onJump('tracking')}
        />
        <Kpi
          tone="default" icon={Warehouse} label="En hub"
          value={metrics.atHub}
          hint={`${metrics.pipeline.sourcing} en sourcing`}
          onClick={() => onJump('hubs')}
        />
      </section>

      {/* ── Pipeline funnel ────────────────────────────────── */}
      <section className="bg-card border border-border rounded-xl p-5">
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-foreground" />
            <h2 className="text-sm font-semibold">Pipeline opérationnel</h2>
          </div>
          <button onClick={() => onJump('shipments')} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            Workflow envois <ArrowUpRight className="w-3 h-3" />
          </button>
        </header>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {[
            { k: 'submitted', label: 'Soumis',    v: metrics.pipeline.submitted, tone: 'bg-muted' },
            { k: 'review',    label: 'En revue',  v: metrics.pipeline.review,    tone: 'bg-muted' },
            { k: 'confirmed', label: 'Confirmés', v: metrics.pipeline.confirmed, tone: 'bg-[hsl(var(--warning-soft))]' },
            { k: 'sourcing',  label: 'Sourcing',  v: metrics.pipeline.sourcing,  tone: 'bg-[hsl(var(--warning-soft))]' },
            { k: 'transit',   label: 'En transit',v: metrics.pipeline.transit,   tone: 'bg-[hsl(var(--success-soft))]' },
            { k: 'delivered', label: 'Livrés',    v: metrics.pipeline.delivered, tone: 'bg-[hsl(var(--success-soft))]' },
          ].map(step => (
            <div key={step.k} className={cn('rounded-lg p-3 border border-border', step.tone)}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{step.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{fmtN(step.v)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Two-column block: Départs + Satisfaction ──────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Départs */}
        {depSummary && (
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
            <header className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Plane className="w-4 h-4 text-foreground" />
                <h2 className="text-sm font-semibold">Départs actifs</h2>
                <span className="text-xs text-muted-foreground">· {depSummary.total} départ{depSummary.total > 1 ? 's' : ''}</span>
              </div>
              <button onClick={() => onJump('departures')} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                Gérer <ArrowUpRight className="w-3 h-3" />
              </button>
            </header>
            <div className="space-y-2.5">
              <DepartureBar label="Konnekt" value={depSummary.konnekt} total={Math.max(depSummary.total, 1)} tone="bg-[hsl(var(--success))]" />
              <DepartureBar label="Manuel"  value={depSummary.manual}  total={Math.max(depSummary.total, 1)} tone="bg-foreground" />
            </div>
            {(depSummary.nearlyFull > 0 || depSummary.noCapacity > 0) && (
              <div className="mt-4 pt-3 border-t border-border space-y-1.5 text-xs">
                {depSummary.nearlyFull > 0 && (
                  <p className="flex items-center gap-1.5 text-[hsl(var(--warning))]">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {depSummary.nearlyFull} départ{depSummary.nearlyFull > 1 ? 's' : ''} bientôt complet{depSummary.nearlyFull > 1 ? 's' : ''}
                  </p>
                )}
                {depSummary.noCapacity > 0 && (
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {depSummary.noCapacity} départ{depSummary.noCapacity > 1 ? 's' : ''} sans capacité saisie
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Satisfaction + mix */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <header className="flex items-center gap-2">
            <Star className="w-4 h-4 text-foreground" />
            <h2 className="text-sm font-semibold">Satisfaction client</h2>
          </header>
          {metrics.avgRating !== null ? (
            <div>
              <p className="text-3xl font-semibold tabular-nums">
                {metrics.avgRating.toFixed(1)}
                <span className="text-sm text-muted-foreground font-normal">/5</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.reviews.length} avis · {metrics.recommendPct}% recommandent
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Aucun avis client pour le moment.</p>
          )}
          <div className="pt-3 border-t border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Mix clientèle</p>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-foreground" />
                <span className="tabular-nums font-semibold">{metrics.individual}</span>
                <span className="text-muted-foreground">particuliers</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3 h-3 text-[hsl(var(--success))]" />
                <span className="tabular-nums font-semibold">{metrics.business}</span>
                <span className="text-muted-foreground">B2B</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Alerts row ─────────────────────────────────────── */}
      {(metrics.unpaidInvoices > 0 || metrics.newQuotes > 0 || data.inboxCount > 0) && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {data.inboxCount > 0 && (
            <AlertCard icon={MessageSquare} tone="default"
              label="Inbox" value={`${data.inboxCount} dossier${data.inboxCount > 1 ? 's' : ''} à traiter`}
              onClick={() => onJump('inbox')} />
          )}
          {metrics.newQuotes > 0 && (
            <AlertCard icon={Building2} tone="warning"
              label="Devis entreprises" value={`${metrics.newQuotes} demande${metrics.newQuotes > 1 ? 's' : ''} nouvelle${metrics.newQuotes > 1 ? 's' : ''}`}
              onClick={() => onJump('enterprise')} />
          )}
          {metrics.unpaidInvoices > 0 && (
            <AlertCard icon={CreditCard} tone="danger"
              label="Factures impayées" value={`${metrics.unpaidInvoices} en attente`}
              onClick={() => onJump('clients')} />
          )}
        </section>
      )}

      {/* ── Recent activity ────────────────────────────────── */}
      <section className="bg-card border border-border rounded-xl">
        <header className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Activité récente</h2>
          </div>
          <button onClick={() => onJump('requests')} className="text-xs text-muted-foreground hover:text-foreground">
            Voir tout →
          </button>
        </header>
        {recent.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">Aucune activité récente.</div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((d: any) => (
              <li key={d.id} className="px-5 py-3 flex items-center gap-3 text-sm hover:bg-secondary/40 transition-colors">
                <span className="text-base">{COUNTRY_FLAGS[d.origin_country] || '🌍'}</span>
                <span className="font-mono text-[11px] text-muted-foreground w-28 truncate">{d.tracking_id || d.reference}</span>
                <span className="flex-1 truncate text-foreground">{d.product_description}</span>
                {d.business_id && (
                  <span className="hidden md:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--success-soft))] text-[hsl(var(--success-soft-foreground))] font-medium">
                    <Building2 className="w-2.5 h-2.5" /> B2B
                  </span>
                )}
                {d.payment_status === 'pending' && d.estimated_cost && (
                  <span className="hidden md:inline text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning-soft-foreground))] font-medium">
                    À payer
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground hidden sm:inline">{DOSSIER_STATUS_LABELS[d.status as Dossier['status']]}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {new Date(d.created_at).toLocaleDateString('fr-FR')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ───────────────────────── sub-components ─────────────────── */
function Kpi({
  icon: Icon, label, value, hint, tone, onClick,
}: {
  icon: typeof Inbox; label: string; value: number; hint?: string;
  tone: 'default' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
}) {
  const toneStyles: Record<string, { ring: string; iconBg: string; iconColor: string }> = {
    default: { ring: 'hover:border-foreground/40', iconBg: 'bg-secondary',                       iconColor: 'text-foreground' },
    success: { ring: 'hover:border-foreground/40', iconBg: 'bg-[hsl(var(--success-soft))]',      iconColor: 'text-[hsl(var(--success))]' },
    warning: { ring: 'hover:border-foreground/40', iconBg: 'bg-[hsl(var(--warning-soft))]',      iconColor: 'text-[hsl(var(--warning))]' },
    danger:  { ring: 'hover:border-foreground/40', iconBg: 'bg-[hsl(var(--danger)/0.1)]',        iconColor: 'text-[hsl(var(--danger))]' },
  };
  const s = toneStyles[tone];
  return (
    <button
      onClick={onClick} disabled={!onClick}
      className={cn(
        'group text-left bg-card border border-border rounded-xl p-4 transition-colors disabled:cursor-default',
        onClick && s.ring,
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', s.iconBg)}>
          <Icon className={cn('w-4 h-4', s.iconColor)} />
        </div>
        {onClick && <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">{fmtN(value)}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-1.5 truncate">{hint}</p>}
    </button>
  );
}

function QuickAction({ icon: Icon, label, onClick, badge }: { icon: typeof Inbox; label: string; onClick: () => void; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className="relative inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-card border border-border rounded-lg hover:border-foreground/40 transition-colors"
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-foreground text-background tabular-nums">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

function AlertCard({ icon: Icon, label, value, tone, onClick }: {
  icon: typeof Inbox; label: string; value: string;
  tone: 'default' | 'warning' | 'danger'; onClick: () => void;
}) {
  const toneStyles: Record<string, string> = {
    default: 'border-border',
    warning: 'border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning-soft)/0.4)]',
    danger:  'border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.05)]',
  };
  const iconColor: Record<string, string> = {
    default: 'text-foreground',
    warning: 'text-[hsl(var(--warning))]',
    danger:  'text-[hsl(var(--danger))]',
  };
  return (
    <button
      onClick={onClick}
      className={cn('text-left rounded-xl p-3 border flex items-center gap-3 hover:border-foreground/40 transition-colors', toneStyles[tone])}
    >
      <Icon className={cn('w-4 h-4 flex-shrink-0', iconColor[tone])} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
    </button>
  );
}

function DepartureBar({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const pct = Math.round((value / total) * 100);
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-16 text-muted-foreground">{label}</span>
      <span className="w-6 tabular-nums font-semibold">{value}</span>
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={cn('h-full transition-all', tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}
