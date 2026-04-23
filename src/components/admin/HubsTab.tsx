import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { COUNTRY_FLAGS, COUNTRY_NAMES, type WarehouseCountry } from '@/lib/types';
import { ArrowDownRight, ArrowUpRight, Package } from 'lucide-react';

const HUBS: WarehouseCountry[] = ['CN', 'FR', 'US', 'AE', 'DE', 'CA'];

export function HubsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-hubs'],
    queryFn: async () => {
      const [pkgR, shipR] = await Promise.all([
        supabase.from('packages').select('warehouse_country, status'),
        supabase.from('shipments').select('origin_country, status, eta').order('created_at', { ascending: false }),
      ]);
      return { packages: pkgR.data || [], shipments: shipR.data || [] };
    },
  });

  if (isLoading || !data) {
    return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Hubs internationaux</h1>
        <p className="text-sm text-muted-foreground">Capacité, flux entrants et départs prévus.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {HUBS.map(hub => {
          const incoming = data.packages.filter(p => p.warehouse_country === hub && ['CREATED', 'RECEIVED'].includes(p.status as string)).length;
          const stored = data.packages.filter(p => p.warehouse_country === hub && p.status === 'IN_STORAGE').length;
          const outgoing = data.shipments.filter(s => s.origin_country === hub && ['PENDING', 'IN_TRANSIT'].includes(s.status as string)).length;
          const nextDeparture = data.shipments
            .filter(s => s.origin_country === hub && s.eta)
            .sort((a, b) => +new Date(a.eta as string) - +new Date(b.eta as string))[0];
          const total = incoming + stored;
          const capacityPct = Math.min(100, total * 4);

          return (
            <div key={hub} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{COUNTRY_FLAGS[hub]}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{COUNTRY_NAMES[hub]}</p>
                    <p className="text-[11px] text-muted-foreground uppercase">{hub}</p>
                  </div>
                </div>
                <Package className="w-4 h-4 text-muted-foreground" />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-semibold text-foreground tabular-nums">{incoming}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center justify-center gap-0.5">
                    <ArrowDownRight className="w-3 h-3" /> entrants
                  </p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground tabular-nums">{stored}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">stockés</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground tabular-nums">{outgoing}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center justify-center gap-0.5">
                    <ArrowUpRight className="w-3 h-3" /> sortants
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Capacité</span><span>{capacityPct}%</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-foreground/70" style={{ width: `${capacityPct}%` }} />
                </div>
              </div>

              <p className="mt-3 text-[11px] text-muted-foreground">
                Prochain départ : {nextDeparture ? new Date(nextDeparture.eta as string).toLocaleDateString('fr-FR') : '—'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
