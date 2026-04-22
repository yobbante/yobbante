import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useShipments } from '@/hooks/useShipments';
import { usePackages } from '@/hooks/usePackages';
import { ShipmentCard } from '@/components/ShipmentCard';
import { ShipmentDetailDrawer } from '@/components/ShipmentDetailDrawer';
import { StatusBadge } from '@/components/StatusBadge';
import { ShipNowDialog } from '@/components/ShipNowDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Package, Truck, Send, X, Radar } from 'lucide-react';
import { COUNTRY_FLAGS, type Shipment } from '@/lib/types';

export function ShipmentsView() {
  const { shipments, isLoading: shipmentsLoading } = useShipments();
  const { packages, isLoading: packagesLoading } = usePackages();
  const [shipOpen, setShipOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const followOrigin = searchParams.get('origin')?.toUpperCase() || '';
  const followDestination = searchParams.get('destination')?.toUpperCase() || '';
  const isFollowing = Boolean(followOrigin || followDestination);

  const STATUS_COLORS: Record<string, string> = {
    CREATED: 'bg-muted-foreground',
    RECEIVED: 'bg-blue-500',
    IN_STORAGE: 'bg-amber-500',
    READY_TO_SHIP: 'bg-green-500',
    SHIPPED: 'bg-primary',
    DELIVERED: 'bg-green-600',
  };

  const matches = (origin?: string, destination?: string) => {
    if (followOrigin && origin?.toUpperCase() !== followOrigin) return false;
    if (followDestination && destination?.toUpperCase() !== followDestination) return false;
    return true;
  };

  const filteredShipments = useMemo(
    () => isFollowing
      ? shipments.filter(s => matches(s.origin_country, s.destination_country))
      : shipments,
    [shipments, isFollowing, followOrigin, followDestination],
  );

  const filteredPackages = useMemo(
    () => isFollowing
      ? packages.filter(p => matches(p.warehouse_country))
      : packages,
    [packages, isFollowing, followOrigin],
  );

  const shippableCount = packages.filter(
    p => !p.shipment_id && ['RECEIVED', 'IN_STORAGE', 'READY_TO_SHIP'].includes(p.status)
  ).length;

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
    <div className="space-y-6 pb-28 md:pb-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Expéditions</h2>
        <Button size="sm" onClick={() => setShipOpen(true)} disabled={shippableCount === 0}>
          <Send className="w-4 h-4" />
          Expédier
        </Button>
      </div>

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

      <Tabs defaultValue="packages">
        <TabsList className="w-full">
          <TabsTrigger value="packages" className="flex-1">Colis{isFollowing ? ` (${filteredPackages.length})` : ''}</TabsTrigger>
          <TabsTrigger value="shipments" className="flex-1">Envois{isFollowing ? ` (${filteredShipments.length})` : ''}</TabsTrigger>
        </TabsList>

        <TabsContent value="packages" className="mt-4">
          {packagesLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : filteredPackages.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-sm font-medium text-foreground">Aucun colis</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isFollowing ? 'Aucun colis ne correspond à ce filtre' : 'Vos colis apparaîtront ici'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPackages.map(pkg => (
                <div
                  key={pkg.id}
                  className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl"
                >
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[pkg.status] || 'bg-muted-foreground'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {COUNTRY_FLAGS[pkg.warehouse_country]} {pkg.description || 'Colis sans description'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {pkg.weight ? `${pkg.weight}kg` : 'Poids inconnu'}
                    </p>
                  </div>
                  <StatusBadge status={pkg.status} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="shipments" className="mt-4">
          {shipmentsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : filteredShipments.length === 0 ? (
            <div className="text-center py-16">
              <Truck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-sm font-medium text-foreground">Aucun envoi</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isFollowing ? 'Aucun envoi ne correspond à ce filtre' : 'Vos envois apparaîtront ici'}
              </p>
            </div>
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
      </Tabs>

      <ShipNowDialog open={shipOpen} onOpenChange={setShipOpen} />
      <ShipmentDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        shipment={selectedShipment}
        packages={packages}
      />
    </div>
  );
}
