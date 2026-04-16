import { useShipments } from '@/hooks/useShipments';
import { usePackages } from '@/hooks/usePackages';
import { ShipmentCard } from '@/components/ShipmentCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Truck } from 'lucide-react';
import { COUNTRY_FLAGS } from '@/lib/types';

export function ShipmentsView() {
  const { shipments, isLoading: shipmentsLoading } = useShipments();
  const { packages, isLoading: packagesLoading } = usePackages();

  const STATUS_COLORS: Record<string, string> = {
    CREATED: 'bg-muted-foreground',
    RECEIVED: 'bg-blue-500',
    IN_STORAGE: 'bg-amber-500',
    READY_TO_SHIP: 'bg-green-500',
    SHIPPED: 'bg-primary',
    DELIVERED: 'bg-green-600',
  };

  return (
    <div className="space-y-6 pb-28 md:pb-8">
      <h2 className="text-2xl font-bold tracking-tight text-foreground">Expéditions</h2>

      <Tabs defaultValue="packages">
        <TabsList className="w-full">
          <TabsTrigger value="packages" className="flex-1">Colis</TabsTrigger>
          <TabsTrigger value="shipments" className="flex-1">Envois</TabsTrigger>
        </TabsList>

        <TabsContent value="packages" className="mt-4">
          {packagesLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : packages.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-sm font-medium text-foreground">Aucun colis</p>
              <p className="text-xs text-muted-foreground mt-1">Vos colis apparaîtront ici</p>
            </div>
          ) : (
            <div className="space-y-2">
              {packages.map(pkg => (
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
                  <StatusBadge status={pkg.status} type="package" />
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
          ) : shipments.length === 0 ? (
            <div className="text-center py-16">
              <Truck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-sm font-medium text-foreground">Aucun envoi</p>
              <p className="text-xs text-muted-foreground mt-1">Vos envois apparaîtront ici</p>
            </div>
          ) : (
            <div className="space-y-3">
              {shipments.map(s => <ShipmentCard key={s.id} shipment={s} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
