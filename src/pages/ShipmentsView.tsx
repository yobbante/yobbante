import { motion } from 'framer-motion';
import { useShipments } from '@/hooks/useShipments';
import { usePackages } from '@/hooks/usePackages';
import { ShipmentCard } from '@/components/ShipmentCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { Package as PackageIcon, Truck } from 'lucide-react';
import { COUNTRY_FLAGS } from '@/lib/types';

export function ShipmentsView() {
  const { shipments, isLoading: shipmentsLoading } = useShipments();
  const { packages, isLoading: packagesLoading } = usePackages();

  return (
    <div className="space-y-8 pb-28 md:pb-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Shipments</h2>
        <p className="text-sm text-muted-foreground mt-1">Track your packages and shipments</p>
      </motion.div>

      {/* Packages */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <PackageIcon className="w-3.5 h-3.5" />
          Packages ({packages.length})
        </h3>
        {packagesLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : packages.length === 0 ? (
          <div className="text-center py-12">
            <PackageIcon className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No packages yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {packages.map((pkg, i) => (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:shadow-sm transition-shadow"
              >
                <span className="text-lg">{COUNTRY_FLAGS[pkg.warehouse_country]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {pkg.description || 'Package'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {pkg.weight ? `${pkg.weight} kg` : 'Weight pending'}
                  </p>
                </div>
                <StatusBadge status={pkg.status} />
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Shipments */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5" />
          Shipments ({shipments.length})
        </h3>
        {shipmentsLoading ? (
          <div className="space-y-3">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : shipments.length === 0 ? (
          <div className="text-center py-12">
            <Truck className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No shipments yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shipments.map(s => <ShipmentCard key={s.id} shipment={s} />)}
          </div>
        )}
      </section>
    </div>
  );
}
