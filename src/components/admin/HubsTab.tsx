import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { COUNTRY_FLAGS, COUNTRY_NAMES, type WarehouseCountry } from '@/lib/types';
import { ArrowDownRight, ArrowUpRight, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateFR } from '@/lib/statusLabels';

const HUBS: WarehouseCountry[] = ['CN', 'FR', 'US', 'AE', 'DE', 'CA'];

export function HubsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-hubs'],
    queryFn: async () => {
      const todayIso = new Date().toISOString().slice(0, 10);
      const [pkgR, shipR, depR] = await Promise.all([
        supabase.from('packages').select('warehouse_country, status'),
        supabase.from('shipments').select('origin_country, destination_country, status, departure_date'),
        supabase
          .from('manual_departures')
          .select('origin_country, departure_date, status')
          .gte('departure_date', todayIso)
          .eq('status', 'active')
          .order('departure_date', { ascending: true }),
      ]);
      return {
        packages: pkgR.data || [],
        shipments: shipR.data || [],
        departures: depR.data || [],
      };
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
          // Mapping shipments → hub flux (origine du hub = pays de stockage international) :
          // ENTRANTS  : envois rattachés au hub d'origine, en attente avant départ
          // STOCKÉS   : envois en préparation / assignés au hub
          // SORTANTS  : envois ayant quitté le hub (en transit / douane)
          const INCOMING_STATUSES = new Set(['PENDING', 'WAITING_FOR_MATCH', 'CONFIRMED', 'MATCHED']);
          const STORED_STATUSES = new Set(['IN_PREPARATION']);
          const OUTGOING_STATUSES = new Set(['IN_TRANSIT', 'CUSTOMS', 'ARRIVED', 'OUT_FOR_DELIVERY']);

          const hubShipments = data.shipments.filter(s => s.origin_country === hub);
          const hubPackages = data.packages.filter(p => p.warehouse_country === hub);

          const incoming =
            hubShipments.filter(s => INCOMING_STATUSES.has(s.status as string)).length +
            hubPackages.filter(p => ['CREATED', 'RECEIVED'].includes(p.status as string)).length;
          const stored =
            hubShipments.filter(s => STORED_STATUSES.has(s.status as string)).length +
            hubPackages.filter(p => p.status === 'IN_STORAGE').length;
          const outgoing = hubShipments.filter(s => OUTGOING_STATUSES.has(s.status as string)).length;

          const todayMs = new Date().setHours(0, 0, 0, 0);
          const futureDates: number[] = [
            ...data.departures
              .filter(d => d.origin_country === hub && d.departure_date)
              .map(d => +new Date(d.departure_date as string)),
            ...data.shipments
              .filter(s => s.origin_country === hub && s.departure_date && +new Date(s.departure_date as string) >= todayMs && !['DELIVERED', 'CANCELLED'].includes(s.status as string))
              .map(s => +new Date(s.departure_date as string)),
          ].filter(t => t >= todayMs).sort((a, b) => a - b);
          const nextDepartureTs = futureDates[0];
          const total = incoming + stored;
          const HUB_MAX_CAPACITY = 100;
          const capacityPct = Math.min(100, Math.round((stored / HUB_MAX_CAPACITY) * 100));
          const showCapacity = stored > 0 || total > 0;

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

              {showCapacity && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Capacité</span><span>{capacityPct}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-foreground/70" style={{ width: `${capacityPct}%` }} />
                  </div>
                </div>
              )}

              <p className={cn(
                'mt-3 text-[11px]',
                nextDepartureTs ? 'text-muted-foreground' : 'text-muted-foreground/60 italic'
              )}>
                Prochain départ : {nextDepartureTs ? formatDateFR(nextDepartureTs) : 'Aucun départ prévu'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
