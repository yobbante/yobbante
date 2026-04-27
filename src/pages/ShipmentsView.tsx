import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useShipments } from '@/hooks/useShipments';
import { usePackages } from '@/hooks/usePackages';
import { ShipmentCard } from '@/components/ShipmentCard';
import { ShipmentDetailDrawer } from '@/components/ShipmentDetailDrawer';
import { StatusBadge } from '@/components/StatusBadge';
import { ShipNowDialog } from '@/components/ShipNowDialog';
import { PackageTimelineDialog } from '@/components/PackageTimelineDialog';
import { SearchFilterBar } from '@/components/SearchFilterBar';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Package, Truck, Send, X, Radar, Activity, Zap, Sparkles, ChevronDown } from 'lucide-react';
import { COUNTRY_FLAGS, type Shipment, type Package as PackageType, type WarehouseCountry } from '@/lib/types';
import { getHubRoute, transportToKeyword } from '@/lib/hubMapping';

type StatusFilter = 'all' | 'active' | 'transit' | 'delivered';

export function ShipmentsView() {
  const { shipments, isLoading: shipmentsLoading } = useShipments();
  const { packages, isLoading: packagesLoading } = usePackages();
  const [shipOpen, setShipOpen] = useState(false);
  const [shipPreset, setShipPreset] = useState<WarehouseCountry | undefined>();
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [trackPkg, setTrackPkg] = useState<PackageType | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const openShipForPackage = (pkg: PackageType) => {
    setShipPreset(pkg.warehouse_country);
    setShipOpen(true);
  };

  const followOrigin = searchParams.get('origin')?.toUpperCase() || '';
  const followDestination = searchParams.get('destination')?.toUpperCase() || '';
  const isFollowing = Boolean(followOrigin || followDestination);

  const STATUS_COLORS: Record<string, string> = {
    CREATED: 'bg-muted-foreground',
    RECEIVED: 'bg-blue-500',
    IN_STORAGE: 'bg-amber-500',
    READY_TO_SHIP: 'bg-emerald-500',
    SHIPPED: 'bg-primary',
    DELIVERED: 'bg-emerald-600',
  };

  const matches = (origin?: string, destination?: string) => {
    if (followOrigin && origin?.toUpperCase() !== followOrigin) return false;
    if (followDestination && destination?.toUpperCase() !== followDestination) return false;
    return true;
  };

  const filteredShipments = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shipments.filter(s => {
      if (!matches(s.origin_country, s.destination_country)) return false;
      if (statusFilter === 'active' && s.status === 'DELIVERED') return false;
      if (statusFilter === 'transit' && s.status !== 'IN_TRANSIT' && s.status !== 'CUSTOMS') return false;
      if (statusFilter === 'delivered' && s.status !== 'DELIVERED') return false;
      if (!q) return true;
      return (
        s.origin_country.toLowerCase().includes(q) ||
        s.destination_country.toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q) ||
        (s.transport_type?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [shipments, isFollowing, followOrigin, followDestination, query, statusFilter]);

  const filteredPackages = useMemo(() => {
    const q = query.trim().toLowerCase();
    return packages.filter(p => {
      if (!matches(p.warehouse_country)) return false;
      if (!q) return true;
      return (
        (p.description?.toLowerCase().includes(q) ?? false) ||
        p.warehouse_country.toLowerCase().includes(q) ||
        p.status.toLowerCase().includes(q)
      );
    });
  }, [packages, isFollowing, followOrigin, query]);

  const shippableCount = packages.filter(
    p => !p.shipment_id && ['RECEIVED', 'IN_STORAGE', 'READY_TO_SHIP'].includes(p.status)
  ).length;

  const counts = useMemo(() => ({
    all: shipments.length,
    active: shipments.filter(s => s.status !== 'DELIVERED').length,
    transit: shipments.filter(s => s.status === 'IN_TRANSIT' || s.status === 'CUSTOMS').length,
    delivered: shipments.filter(s => s.status === 'DELIVERED').length,
  }), [shipments]);

  const openDetail = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setDrawerOpen(true);
  };

  const clearFollow = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('origin');
    next.delete('destination');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-28 md:pb-8">
      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between gap-3"
      >
        <div>
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] font-medium text-muted-foreground">Logistique</p>
          <h2 className="mt-1.5 text-[1.5rem] sm:text-3xl font-bold tracking-tight text-foreground">Expéditions</h2>
        </div>
        <Button size="sm" onClick={() => setShipOpen(true)} disabled={shippableCount === 0} className="gap-1 shrink-0">
          <Send className="w-3.5 h-3.5" /> Expédier
        </Button>
      </motion.header>

      {isFollowing && (
        <div className="flex items-center justify-between gap-3 bg-primary/8 border border-primary/30 rounded-xl px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-foreground min-w-0">
            <Radar className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate">
              <span className="font-semibold">Suivi actif</span>
              {followOrigin && <> · origine <span className="font-mono">{COUNTRY_FLAGS[followOrigin as keyof typeof COUNTRY_FLAGS] || ''} {followOrigin}</span></>}
              {followDestination && <> · destination <span className="font-mono">{COUNTRY_FLAGS[followDestination as keyof typeof COUNTRY_FLAGS] || ''} {followDestination}</span></>}
            </span>
          </div>
          <button
            type="button"
            onClick={clearFollow}
            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80"
          >
            <X className="w-3 h-3" /> Effacer
          </button>
        </div>
      )}

      <SearchFilterBar
        query={query}
        onQueryChange={setQuery}
        placeholder="Pays, statut, transport…"
        activeChip={statusFilter}
        onChipChange={(v) => setStatusFilter(v as StatusFilter)}
        chips={[
          { value: 'all', label: 'Tous', count: counts.all },
          { value: 'active', label: 'Actifs', count: counts.active },
          { value: 'transit', label: 'En transit', count: counts.transit },
          { value: 'delivered', label: 'Livrés', count: counts.delivered },
        ]}
      />

      <Tabs defaultValue="shipments">
        <TabsList className="w-full">
          <TabsTrigger value="shipments" className="flex-1">Envois{(query || statusFilter !== 'all' || isFollowing) ? ` (${filteredShipments.length})` : ''}</TabsTrigger>
          <TabsTrigger value="packages" className="flex-1">Colis{(query || isFollowing) ? ` (${filteredPackages.length})` : ''}</TabsTrigger>
        </TabsList>

        <TabsContent value="shipments" className="mt-4">
          {shipmentsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : shipments.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="Aucun envoi pour l'instant"
              description="Vos expéditions apparaîtront ici dès qu'elles seront créées. Commencez par envoyer ou recevoir un colis."
              ctaLabel="Expédier maintenant"
              onCta={() => setShipOpen(true)}
            />
          ) : filteredShipments.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="Aucun envoi ne correspond"
              description="Essayez d'élargir votre recherche ou de retirer un filtre."
              secondaryLabel="Effacer les filtres"
              onSecondary={() => { setQuery(''); setStatusFilter('all'); clearFollow(); }}
            />
          ) : (
            <div className="space-y-3">
              {filteredShipments.map(s => (
                <div key={s.id} onClick={() => openDetail(s)} className="cursor-pointer">
                  <ShipmentCard shipment={s} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="packages" className="mt-4">
          {packagesLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : packages.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Pas de colis enregistré"
              description="Faites livrer vos commandes en ligne dans nos hubs et nous les regrouperons pour vous."
            />
          ) : filteredPackages.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Aucun colis ne correspond"
              description="Essayez d'élargir votre recherche."
              secondaryLabel="Effacer les filtres"
              onSecondary={() => { setQuery(''); clearFollow(); }}
            />
          ) : (
            <div className="space-y-2">
              {filteredPackages.map(pkg => {
                const canShipNow = pkg.status === 'READY_TO_SHIP' && !pkg.shipment_id;
                return (
                  <div
                    key={pkg.id}
                    className="flex items-center gap-3 p-3.5 bg-card border border-border rounded-xl hover:border-foreground/20 transition-colors"
                  >
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[pkg.status] || 'bg-muted-foreground'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {COUNTRY_FLAGS[pkg.warehouse_country]} {pkg.description || 'Colis sans description'}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {pkg.weight ? `${pkg.weight} kg` : 'Poids inconnu'}
                      </p>
                    </div>
                    <StatusBadge status={pkg.status} />
                    <div className="flex items-center gap-1 ml-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setTrackPkg(pkg)}
                        className="h-8 px-2 text-[11px]"
                        aria-label="Suivre ce colis"
                      >
                        <Activity className="w-3.5 h-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">Suivre</span>
                      </Button>
                      {canShipNow && (
                        <Button
                          size="sm"
                          onClick={() => openShipForPackage(pkg)}
                          className="h-8 px-2.5 text-[11px] gap-1"
                          aria-label="Expédier ce colis maintenant"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Expédier</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ShipNowDialog
        open={shipOpen}
        onOpenChange={(o) => { setShipOpen(o); if (!o) setShipPreset(undefined); }}
        presetCountry={shipPreset}
      />
      <PackageTimelineDialog
        open={Boolean(trackPkg)}
        onOpenChange={(o) => { if (!o) setTrackPkg(null); }}
        pkg={trackPkg}
      />
      <ShipmentDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        shipment={selectedShipment}
        packages={packages}
      />
    </div>
  );
}
