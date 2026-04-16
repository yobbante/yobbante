import { motion } from 'framer-motion';
import { ActionBar } from '@/components/ActionBar';
import { TimelineItem } from '@/components/TimelineItem';
import { ShipmentCard } from '@/components/ShipmentCard';
import { AddressCard } from '@/components/AddressCard';
import { useTimeline } from '@/hooks/useTimeline';
import { useShipments } from '@/hooks/useShipments';
import { usePackages } from '@/hooks/usePackages';
import { useAddresses } from '@/hooks/useAddresses';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, AlertTriangle } from 'lucide-react';
import { COUNTRY_FLAGS } from '@/lib/types';

export function HomeView() {
  const { events, isLoading: eventsLoading } = useTimeline();
  const { shipments, isLoading: shipmentsLoading } = useShipments();
  const { packages, consolidationGroups } = usePackages();
  const { addresses, isLoading: addressesLoading } = useAddresses();

  const activeShipments = shipments.filter(s => s.status !== 'DELIVERED');
  const waitingPackages = packages.filter(p => !p.shipment_id && p.status !== 'DELIVERED');

  return (
    <div className="space-y-8 pb-28 md:pb-8">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h2>
        <p className="text-sm text-muted-foreground mt-1">Your logistics, simplified.</p>
      </motion.div>

      {/* Action Bar */}
      <ActionBar />

      {/* Conversion triggers */}
      {waitingPackages.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100"
        >
          <Package className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{waitingPackages.length} package{waitingPackages.length > 1 ? 's' : ''} waiting</p>
            <p className="text-xs text-muted-foreground">Group them to save on shipping</p>
          </div>
          <button className="text-xs font-semibold text-primary hover:underline">Ship Now</button>
        </motion.div>
      )}

      {/* Consolidation prompts */}
      {Object.entries(consolidationGroups).map(([country, pkgs]) => (
        pkgs.length >= 2 && (
          <motion.div
            key={country}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100"
          >
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {COUNTRY_FLAGS[country as keyof typeof COUNTRY_FLAGS]} {pkgs.length} packages in {country}
              </p>
              <p className="text-xs text-muted-foreground">Save money by grouping shipments</p>
            </div>
            <button className="text-xs font-semibold text-amber-600 hover:underline">Consolidate</button>
          </motion.div>
        )
      ))}

      {/* Active Shipments */}
      {activeShipments.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active Shipments</h3>
          <div className="space-y-3">
            {activeShipments.map(s => <ShipmentCard key={s.id} shipment={s} />)}
          </div>
        </section>
      )}

      {/* Timeline */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Activity</h3>
        {eventsLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-4 p-4">
                <Skeleton className="w-9 h-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground mt-1">Start shopping worldwide!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {events.map((event, i) => <TimelineItem key={event.id} event={event} index={i} />)}
          </div>
        )}
      </section>

      {/* Addresses */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Your Warehouses</h3>
        {addressesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {addresses.map(addr => <AddressCard key={addr.id} address={addr} />)}
          </div>
        )}
      </section>
    </div>
  );
}
