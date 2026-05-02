import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Inbox, Truck, Warehouse, ShoppingCart, CheckCircle2, ArrowUpRight, Plane, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { COUNTRY_FLAGS, DOSSIER_STATUS_LABELS, type Dossier } from '@/lib/types';
import { useDeparturesSummary } from '@/hooks/useManualDepartures';
import type { AdminSection } from './AdminSidebar';

type Kpi = { label: string; value: number; icon: typeof Inbox; tone: string; jump: AdminSection };

export function OverviewTab({ onJump }: { onJump: (s: AdminSection) => void }) {
  const { data: depSummary } = useDeparturesSummary();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-overview'],
    staleTime: 60_000,
    queryFn: async () => {
      const [dossiersR, shipmentsR, packagesR] = await Promise.all([
        supabase.from('dossiers')
          .select('id, status, reference, product_description, origin_country, created_at')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('shipments').select('id, status, eta').limit(1000),
        supabase.from('packages').select('id, status').limit(1000),
      ]);
      return {
        dossiers: (dossiersR.data || []) as Dossier[],
        shipments: shipmentsR.data || [],
        packages: packagesR.data || [],
      };
    },
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  const activeRequests = data.dossiers.filter(d => ['SUBMITTED', 'IN_REVIEW'].includes(d.status)).length;
  const inTransit = data.shipments.filter(s => s.status === 'IN_TRANSIT').length;
  const atHub = data.packages.filter(p => ['RECEIVED', 'IN_STORAGE'].includes(p.status as string)).length;
  const sourcing = data.dossiers.filter(d => d.status === 'SOURCING').length;
  const today = new Date().toISOString().slice(0, 10);
  const deliveriesToday = data.shipments.filter(s => s.eta && (s.eta as string).slice(0, 10) === today).length;

  const kpis: Kpi[] = [
    { label: 'Demandes actives',  value: activeRequests,    icon: Inbox,         tone: 'text-blue-500',    jump: 'requests' },
    { label: 'En transit',        value: inTransit,         icon: Truck,         tone: 'text-amber-500',   jump: 'orders' },
    { label: 'En attente hub',    value: atHub,             icon: Warehouse,     tone: 'text-violet-500',  jump: 'hubs' },
    { label: 'Sourcing en cours', value: sourcing,          icon: ShoppingCart,  tone: 'text-pink-500',    jump: 'sourcing' },
    { label: 'Livraisons jour',   value: deliveriesToday,   icon: CheckCircle2,  tone: 'text-emerald-500', jump: 'tracking' },
  ];

  const recent = data.dossiers.slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Vue temps réel de l'activité Yobbanté.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpis.map(({ label, value, icon: Icon, tone, jump }) => (
          <button
            key={label}
            onClick={() => onJump(jump)}
            className="group text-left bg-card border border-border rounded-xl p-4 hover:border-foreground/40 transition-colors"
          >
            <div className="flex items-center justify-between">
              <Icon className={cn('w-4 h-4', tone)} />
              <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground tabular-nums">{value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Departures widget */}
      {depSummary && (
        <section className="bg-card border border-border rounded-xl p-5">
          <header className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Plane className="w-4 h-4 text-foreground" />
              <h2 className="text-sm font-semibold">Départs actifs</h2>
              <span className="text-xs text-muted-foreground">· {depSummary.total} départs · {(depSummary.konnekt > 0 ? 1 : 0) + (depSummary.manual > 0 ? 1 : 0)} sources</span>
            </div>
            <button onClick={() => onJump('departures')} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Gérer les départs <ArrowUpRight className="w-3 h-3" />
            </button>
          </header>
          <div className="space-y-2.5">
            <DepartureBar label="Konnekt" value={depSummary.konnekt} total={Math.max(depSummary.total, 1)} tone="bg-blue-500" />
            <DepartureBar label="Manuel"  value={depSummary.manual}  total={Math.max(depSummary.total, 1)} tone="bg-emerald-500" />
          </div>
          {(depSummary.nearlyFull > 0 || depSummary.noCapacity > 0) && (
            <div className="mt-4 pt-3 border-t border-border space-y-1.5 text-xs">
              {depSummary.nearlyFull > 0 && (
                <p className="flex items-center gap-1.5 text-amber-600">
                  <AlertTriangle className="w-3.5 h-3.5" /> {depSummary.nearlyFull} départ{depSummary.nearlyFull > 1 ? 's' : ''} bientôt complet{depSummary.nearlyFull > 1 ? 's' : ''}
                </p>
              )}
              {depSummary.noCapacity > 0 && (
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <AlertTriangle className="w-3.5 h-3.5" /> {depSummary.noCapacity} départ{depSummary.noCapacity > 1 ? 's' : ''} sans capacité saisie
                </p>
              )}
            </div>
          )}
        </section>
      )}

      <section className="bg-card border border-border rounded-xl">
        <header className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Activité récente</h2>
          <button onClick={() => onJump('requests')} className="text-xs text-muted-foreground hover:text-foreground">
            Voir tout →
          </button>
        </header>
        {recent.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">Aucune activité récente.</div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map(d => (
              <li key={d.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                <span className="text-base">{COUNTRY_FLAGS[d.origin_country] || '🌍'}</span>
                <span className="font-mono text-xs text-muted-foreground w-32 truncate">{d.reference}</span>
                <span className="flex-1 truncate text-foreground">{d.product_description}</span>
                <span className="text-[11px] text-muted-foreground hidden sm:inline">{DOSSIER_STATUS_LABELS[d.status]}</span>
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

function DepartureBar({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const pct = Math.round((value / total) * 100);
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-16 text-muted-foreground">{label}</span>
      <span className="w-6 tabular-nums font-semibold">{value}</span>
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={cn('h-full', tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
