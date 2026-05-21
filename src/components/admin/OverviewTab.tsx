import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Inbox, Truck, ShoppingCart, ArrowUpRight, Plane, AlertTriangle,
  MessageSquare, Building2, CreditCard, Star, Package, PackageOpen,
  TrendingUp, TrendingDown, Clock, Users as UsersIcon, ShieldAlert, Hourglass,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { COUNTRY_FLAGS } from '@/lib/types';
import { useDeparturesSummary } from '@/hooks/useManualDepartures';
import type { AdminSection } from './AdminSidebar';

/* ───────────────────────── helpers ───────────────────────── */
const fmtN = (n: number) => new Intl.NumberFormat('fr-FR').format(n);
const fmtXOF = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' FCFA';

const inDays = (d: string | Date | null | undefined, days: number) => {
  if (!d) return false;
  return Date.now() - new Date(d).getTime() <= days * 86400_000;
};

const TERMINAL = new Set(['DELIVERED', 'CLOSED', 'CANCELLED', 'delivered', 'cancelled']);

/* ───────────────────────── component ─────────────────────── */
export function OverviewTab({ onJump }: { onJump: (s: AdminSection) => void }) {
  const { data: depSummary } = useDeparturesSummary();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-overview-v3'],
    staleTime: 60_000,
    queryFn: async () => {
      const [dossiersR, shipmentsR, packagesR, reviewsR, invoicesR, entR, receptionR] = await Promise.all([
        supabase.from('dossiers')
          .select('id, status, reference, product_description, origin_country, destination_country, created_at, updated_at, payment_status, estimated_cost, tracking_id, business_id, dossier_type, needs_sourcing, intake_method, source, last_client_contact, reminder_count, user_id')
          .order('created_at', { ascending: false })
          .limit(800),
        supabase.from('shipments').select('id, status, eta, created_at, updated_at, user_id').limit(1000),
        supabase.from('packages').select('id, status, created_at, updated_at, user_id').limit(1000),
        supabase.from('customer_reviews').select('id, rating, would_recommend, created_at').limit(200),
        supabase.from('business_invoices').select('id, status, amount_xof, amount_eur, due_at').limit(500),
        supabase.from('enterprise_quotes').select('id, status, company, full_name, created_at').order('created_at', { ascending: false }).limit(200),
        supabase.from('reception_orders').select('id, status, reference, merchant_name, order_description, created_at, updated_at, estimated_value_eur, payment_status').order('created_at', { ascending: false }).limit(500),
      ]);
      return {
        dossiers: (dossiersR.data || []) as any[],
        shipments: (shipmentsR.data || []) as any[],
        packages: (packagesR.data || []) as any[],
        reviews: reviewsR.data || [],
        invoices: invoicesR.data || [],
        quotes: (entR.data || []) as any[],
        receptions: (receptionR.data || []) as any[],
      };
    },
  });

  const m = useMemo(() => {
    if (!data) return null;

    /* ── Service splits ─────────────────────────────────── */
    const sourcingDossiers = data.dossiers.filter(d =>
      d.needs_sourcing === true || d.dossier_type === 'business_sourcing'
        || ['SOURCING', 'PROCURED'].includes(d.status)
    );
    const expedierDossiers = data.dossiers.filter(d =>
      !sourcingDossiers.includes(d)
    );

    /* ── Pipelines ──────────────────────────────────────── */
    const shipPipeline = {
      pending:    data.shipments.filter(s => ['PENDING', 'WAITING_FOR_MATCH', 'ON_HOLD'].includes(s.status)).length,
      matched:    data.shipments.filter(s => ['CONFIRMED', 'MATCHED', 'IN_PREPARATION'].includes(s.status)).length,
      transit:    data.shipments.filter(s => ['IN_TRANSIT', 'CUSTOMS', 'ARRIVED', 'OUT_FOR_DELIVERY'].includes(s.status)).length,
      delivered7: data.shipments.filter(s => s.status === 'DELIVERED' && inDays(s.updated_at, 7)).length,
    };
    const shipActive = shipPipeline.pending + shipPipeline.matched + shipPipeline.transit;

    const sourcingPipeline = {
      submitted: sourcingDossiers.filter(d => ['SUBMITTED', 'IN_REVIEW'].includes(d.status)).length,
      sourcing:  sourcingDossiers.filter(d => d.status === 'SOURCING').length,
      procured:  sourcingDossiers.filter(d => d.status === 'PROCURED').length,
      transit:   sourcingDossiers.filter(d => ['IN_TRANSIT', 'CUSTOMS'].includes(d.status)).length,
      delivered7:sourcingDossiers.filter(d => d.status === 'DELIVERED' && inDays(d.updated_at, 7)).length,
    };
    const sourcingActive = sourcingPipeline.submitted + sourcingPipeline.sourcing + sourcingPipeline.procured + sourcingPipeline.transit;

    const recPipeline = {
      pending:    data.receptions.filter(r => r.status === 'pending_arrival').length,
      received:   data.receptions.filter(r => ['received', 'inspected'].includes(r.status)).length,
      consolidated: data.receptions.filter(r => r.status === 'consolidated').length,
      transit:    data.receptions.filter(r => r.status === 'in_transit').length,
      delivered7: data.receptions.filter(r => r.status === 'delivered' && inDays(r.updated_at, 7)).length,
    };
    const recActive = recPipeline.pending + recPipeline.received + recPipeline.consolidated + recPipeline.transit;

    /* ── Demandes clients ──────────────────────────────── */
    const reqNew      = data.dossiers.filter(d => d.status === 'SUBMITTED').length;
    const reqReview   = data.dossiers.filter(d => d.status === 'IN_REVIEW').length;
    const reqAwaiting = data.dossiers.filter(d => d.status === 'AWAITING_CLIENT').length;
    const reqStale    = data.dossiers.filter(d => d.status === 'STALE' || (d.reminder_count || 0) >= 2).length;
    const newQuotes   = data.quotes.filter(q => q.status === 'NEW').length;

    const reqBySource = data.dossiers
      .filter(d => ['SUBMITTED', 'IN_REVIEW'].includes(d.status))
      .reduce((acc: Record<string, number>, d) => {
        const src = d.source || 'site_web';
        acc[src] = (acc[src] || 0) + 1;
        return acc;
      }, {});

    /* ── Trend last 7d vs prev 7d ──────────────────────── */
    const last7 = data.dossiers.filter(d => inDays(d.created_at, 7)).length;
    const prev7 = data.dossiers.filter(d => {
      const t = new Date(d.created_at).getTime();
      const now = Date.now();
      return t < now - 7 * 86400_000 && t >= now - 14 * 86400_000;
    }).length;
    const trend = prev7 === 0 ? null : Math.round(((last7 - prev7) / prev7) * 100);

    /* ── Misc ──────────────────────────────────────────── */
    const pendingPayments = data.dossiers.filter(d => d.payment_status === 'pending' && d.estimated_cost).length;
    const revenuePending  = data.dossiers
      .filter(d => d.payment_status === 'pending' && !TERMINAL.has(d.status))
      .reduce((s, d) => s + (Number(d.estimated_cost) || 0), 0);

    const business = data.dossiers.filter(d => d.business_id).length;
    const individual = data.dossiers.length - business;

    const avgRating = data.reviews.length
      ? data.reviews.reduce((s: number, r: any) => s + (r.rating || 0), 0) / data.reviews.length
      : null;
    const recommendPct = data.reviews.length
      ? Math.round((data.reviews.filter((r: any) => r.would_recommend).length / data.reviews.length) * 100)
      : null;

    const unpaidInvoices = data.invoices.filter((i: any) => i.status === 'unpaid').length;

    return {
      shipPipeline, shipActive,
      sourcingPipeline, sourcingActive,
      recPipeline, recActive,
      reqNew, reqReview, reqAwaiting, reqStale, newQuotes, reqBySource,
      last7, trend,
      pendingPayments, revenuePending, business, individual,
      avgRating, recommendPct, unpaidInvoices,
    };
  }, [data]);

  /* ── Unified activity feed ────────────────────────────── */
  const activity = useMemo(() => {
    if (!data) return [];
    type Row = {
      id: string; service: 'expedier' | 'sourcing' | 'reception';
      ref: string; title: string; status: string; statusLabel: string;
      ts: string; flag?: string; meta?: string;
    };
    const rows: Row[] = [];

    for (const d of data.dossiers) {
      const isSourcing = d.needs_sourcing || d.dossier_type === 'business_sourcing' || ['SOURCING', 'PROCURED'].includes(d.status);
      rows.push({
        id: `d-${d.id}`,
        service: isSourcing ? 'sourcing' : 'expedier',
        ref: d.tracking_id || d.reference,
        title: d.product_description || '—',
        status: d.status,
        statusLabel: DOSSIER_LABEL[d.status] || d.status,
        ts: d.updated_at || d.created_at,
        flag: COUNTRY_FLAGS[d.origin_country] || '🌍',
        meta: d.business_id ? 'B2B' : undefined,
      });
    }
    for (const r of data.receptions) {
      rows.push({
        id: `r-${r.id}`,
        service: 'reception',
        ref: r.reference,
        title: `${r.merchant_name} · ${r.order_description || ''}`.trim(),
        status: r.status,
        statusLabel: RECEPTION_LABEL[r.status] || r.status,
        ts: r.updated_at || r.created_at,
      });
    }
    return rows.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 12);
  }, [data]);

  if (isLoading || !data || !m) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-border">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
            Tableau de bord · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Vue d'ensemble Yobbanté</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {m.last7} nouveau{m.last7 > 1 ? 'x' : ''} dossier{m.last7 > 1 ? 's' : ''} sur 7 jours
            {m.trend !== null && (
              <span className={cn('ml-2 inline-flex items-center gap-0.5 text-xs font-medium',
                m.trend >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]')}>
                {m.trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {m.trend >= 0 ? '+' : ''}{m.trend}%
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <QuickAction icon={MessageSquare} label="Inbox" badge={m.reqNew} onClick={() => onJump('inbox')} />
          <QuickAction icon={Plane} label="Départs" onClick={() => onJump('departures')} />
          <QuickAction icon={UsersIcon} label="Clients" onClick={() => onJump('clients')} />
        </div>
      </header>

      {/* ── Top alerts ─────────────────────────────────────── */}
      {(m.reqNew > 0 || m.newQuotes > 0 || m.unpaidInvoices > 0 || m.reqStale > 0) && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {m.reqNew > 0 && (
            <AlertCard icon={Inbox} tone="default"
              label="Nouvelles demandes" value={`${m.reqNew} à traiter`} onClick={() => onJump('requests')} />
          )}
          {m.newQuotes > 0 && (
            <AlertCard icon={Building2} tone="warning"
              label="Devis B2B" value={`${m.newQuotes} nouveau${m.newQuotes > 1 ? 'x' : ''}`} onClick={() => onJump('enterprise')} />
          )}
          {m.unpaidInvoices > 0 && (
            <AlertCard icon={CreditCard} tone="danger"
              label="Factures impayées" value={`${m.unpaidInvoices} en attente`} onClick={() => onJump('clients')} />
          )}
          {m.reqStale > 0 && (
            <AlertCard icon={ShieldAlert} tone="warning"
              label="Dossiers à relancer" value={`${m.reqStale} sans réponse`} onClick={() => onJump('requests')} />
          )}
        </section>
      )}

      {/* ── 3 SERVICES — Expédier / Sourcing / Réception ──── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ServiceCard
          icon={Truck} title="Expédier" tone="success"
          activeCount={m.shipActive}
          delivered7={m.shipPipeline.delivered7}
          onJump={() => onJump('shipments')}
          steps={[
            { label: 'À assigner',  value: m.shipPipeline.pending,  tone: 'muted' },
            { label: 'Assignés',    value: m.shipPipeline.matched,  tone: 'warning' },
            { label: 'En transit',  value: m.shipPipeline.transit,  tone: 'success' },
          ]}
        />
        <ServiceCard
          icon={ShoppingCart} title="Sourcing" tone="warning"
          activeCount={m.sourcingActive}
          delivered7={m.sourcingPipeline.delivered7}
          onJump={() => onJump('sourcing')}
          steps={[
            { label: 'À qualifier', value: m.sourcingPipeline.submitted, tone: 'muted' },
            { label: 'Sourcing',    value: m.sourcingPipeline.sourcing,  tone: 'warning' },
            { label: 'Acheté',      value: m.sourcingPipeline.procured,  tone: 'warning' },
            { label: 'En transit',  value: m.sourcingPipeline.transit,   tone: 'success' },
          ]}
        />
        <ServiceCard
          icon={PackageOpen} title="Réception" tone="default"
          activeCount={m.recActive}
          delivered7={m.recPipeline.delivered7}
          onJump={() => onJump('reception')}
          steps={[
            { label: 'En attente',  value: m.recPipeline.pending,      tone: 'muted' },
            { label: 'Reçu / inspecté', value: m.recPipeline.received, tone: 'warning' },
            { label: 'Consolidé',   value: m.recPipeline.consolidated, tone: 'warning' },
            { label: 'En transit',  value: m.recPipeline.transit,      tone: 'success' },
          ]}
        />
      </section>

      {/* ── Départs + Satisfaction + Mix ──────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                    {depSummary.noCapacity} sans capacité saisie
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <header className="flex items-center gap-2">
            <Star className="w-4 h-4 text-foreground" />
            <h2 className="text-sm font-semibold">Satisfaction & Mix</h2>
          </header>
          {m.avgRating !== null ? (
            <div>
              <p className="text-3xl font-semibold tabular-nums">
                {m.avgRating.toFixed(1)}<span className="text-sm text-muted-foreground font-normal">/5</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.reviews.length} avis · {m.recommendPct}% recommandent
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Aucun avis client pour le moment.</p>
          )}
          <div className="pt-3 border-t border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Mix clientèle</p>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-foreground" />
                <span className="tabular-nums font-semibold">{m.individual}</span>
                <span className="text-muted-foreground">particuliers</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3 h-3 text-[hsl(var(--success))]" />
                <span className="tabular-nums font-semibold">{m.business}</span>
                <span className="text-muted-foreground">B2B</span>
              </div>
            </div>
          </div>
          {m.revenuePending > 0 && (
            <div className="pt-3 border-t border-border">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Encaissements en attente</p>
              <p className="text-base font-semibold tabular-nums text-foreground mt-1">{fmtXOF(m.revenuePending)}</p>
              <p className="text-[11px] text-muted-foreground">sur {m.pendingPayments} dossier{m.pendingPayments > 1 ? 's' : ''}</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Demandes clients + Activité récente ──────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Demandes clients */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl">
          <header className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-foreground" />
              <h2 className="text-sm font-semibold">Demandes clients</h2>
            </div>
            <button onClick={() => onJump('requests')} className="text-xs text-muted-foreground hover:text-foreground">
              Voir tout →
            </button>
          </header>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <StatTile icon={Inbox}      label="Nouvelles"        value={m.reqNew}      tone="muted" />
              <StatTile icon={Hourglass}  label="En analyse"       value={m.reqReview}   tone="warning" />
              <StatTile icon={Clock}      label="Attente client"   value={m.reqAwaiting} tone="muted" />
              <StatTile icon={ShieldAlert} label="À relancer"      value={m.reqStale}    tone="danger" />
            </div>
            {Object.keys(m.reqBySource).length > 0 && (
              <div className="pt-3 border-t border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Par source</p>
                <ul className="space-y-1.5 text-xs">
                  {(Object.entries(m.reqBySource) as [string, number][])
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([src, count]) => (
                      <li key={src} className="flex items-center justify-between">
                        <span className="text-muted-foreground capitalize">{src.replace(/_/g, ' ')}</span>
                        <span className="tabular-nums font-medium">{count}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Activité récente unifiée */}
        <div className="lg:col-span-3 bg-card border border-border rounded-xl">
          <header className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-foreground" />
              <h2 className="text-sm font-semibold">Activité récente</h2>
              <span className="text-xs text-muted-foreground">· tous services</span>
            </div>
            <button onClick={() => onJump('inbox')} className="text-xs text-muted-foreground hover:text-foreground">
              Voir l'inbox →
            </button>
          </header>
          {activity.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">Aucune activité récente.</div>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map(row => (
                <li key={row.id} className="px-5 py-2.5 flex items-center gap-3 text-sm hover:bg-secondary/40 transition-colors">
                  <ServiceBadge service={row.service} />
                  {row.flag && <span className="text-sm">{row.flag}</span>}
                  <span className="font-mono text-[10.5px] text-muted-foreground w-24 truncate">{row.ref}</span>
                  <span className="flex-1 truncate text-foreground text-[13px]">{row.title}</span>
                  {row.meta && (
                    <span className="hidden md:inline text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--success-soft))] text-[hsl(var(--success-soft-foreground))] font-medium">
                      {row.meta}
                    </span>
                  )}
                  <span className="hidden sm:inline text-[10.5px] px-2 py-0.5 rounded-full bg-secondary text-foreground font-medium">
                    {row.statusLabel}
                  </span>
                  <span className="text-[10.5px] text-muted-foreground tabular-nums">
                    {new Date(row.ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

/* ───────────────────────── status labels ─────────────────── */
const DOSSIER_LABEL: Record<string, string> = {
  SUBMITTED: 'Soumis', IN_REVIEW: 'En analyse', SOURCING: 'Sourcing', PROCURED: 'Acheté',
  IN_TRANSIT: 'En transit', CUSTOMS: 'Douane', DELIVERED: 'Livré', CLOSED: 'Clôturé',
  AWAITING_CLIENT: 'Attente client', CONFIRMED: 'Confirmé', STALE: 'À relancer',
  EN_RECHERCHE_DEPART: 'Recherche départ',
};
const RECEPTION_LABEL: Record<string, string> = {
  pending_arrival: 'En attente', received: 'Reçu', inspected: 'Inspecté',
  consolidated: 'Consolidé', in_transit: 'En transit', delivered: 'Livré',
  cancelled: 'Annulé', awaiting_payment: 'À payer', paid: 'Payé', shipped: 'Expédié',
  measured: 'Mesuré',
};

/* ───────────────────────── sub-components ────────────────── */
type Tone = 'default' | 'success' | 'warning' | 'danger' | 'muted';
const toneBg: Record<Tone, string> = {
  default: 'bg-secondary',
  muted:   'bg-secondary',
  success: 'bg-[hsl(var(--success-soft))]',
  warning: 'bg-[hsl(var(--warning-soft))]',
  danger:  'bg-[hsl(var(--danger)/0.1)]',
};
const toneText: Record<Tone, string> = {
  default: 'text-foreground',
  muted:   'text-muted-foreground',
  success: 'text-[hsl(var(--success))]',
  warning: 'text-[hsl(var(--warning))]',
  danger:  'text-[hsl(var(--danger))]',
};

function ServiceCard({
  icon: Icon, title, tone, activeCount, delivered7, steps, onJump,
}: {
  icon: typeof Truck; title: string; tone: Tone; activeCount: number; delivered7: number;
  steps: { label: string; value: number; tone: Tone }[];
  onJump: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col">
      <header className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', toneBg[tone])}>
            <Icon className={cn('w-4.5 h-4.5', toneText[tone])} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <p className="text-[11px] text-muted-foreground">{activeCount} dossier{activeCount > 1 ? 's' : ''} actif{activeCount > 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={onJump} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </header>

      <div className="space-y-1.5 flex-1">
        {steps.map(s => (
          <div key={s.label} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{s.label}</span>
            <span className={cn(
              'inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-md text-[11px] font-semibold tabular-nums',
              toneBg[s.tone], toneText[s.tone],
            )}>
              {s.value}
            </span>
          </div>
        ))}
      </div>

      <footer className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Livrés 7j</span>
        <span className="tabular-nums font-semibold text-[hsl(var(--success))]">{delivered7}</span>
      </footer>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, tone }: { icon: typeof Inbox; label: string; value: number; tone: Tone }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5">
        <Icon className={cn('w-3.5 h-3.5', toneText[tone])} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">{fmtN(value)}</p>
    </div>
  );
}

function ServiceBadge({ service }: { service: 'expedier' | 'sourcing' | 'reception' }) {
  const map = {
    expedier:  { icon: Truck,        label: 'Expé', tone: 'success' as Tone },
    sourcing:  { icon: ShoppingCart, label: 'Src',  tone: 'warning' as Tone },
    reception: { icon: PackageOpen,  label: 'Rec',  tone: 'default' as Tone },
  };
  const cfg = map[service];
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-wider',
      toneBg[cfg.tone], toneText[cfg.tone])}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

function QuickAction({ icon: Icon, label, onClick, badge }: { icon: typeof Inbox; label: string; onClick: () => void; badge?: number }) {
  return (
    <button onClick={onClick}
      className="relative inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-card border border-border rounded-lg hover:border-foreground/40 transition-colors">
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
  const styles: Record<string, string> = {
    default: 'border-border bg-card',
    warning: 'border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning-soft)/0.4)]',
    danger:  'border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.05)]',
  };
  const iconColor: Record<string, string> = {
    default: 'text-foreground',
    warning: 'text-[hsl(var(--warning))]',
    danger:  'text-[hsl(var(--danger))]',
  };
  return (
    <button onClick={onClick}
      className={cn('text-left rounded-xl p-3 border flex items-center gap-3 hover:border-foreground/40 transition-colors', styles[tone])}>
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
