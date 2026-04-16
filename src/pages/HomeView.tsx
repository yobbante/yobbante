import { useState } from 'react';
import { motion } from 'framer-motion';
import { ActionBar } from '@/components/ActionBar';
import { TimelineItem } from '@/components/TimelineItem';
import { ShipmentCard } from '@/components/ShipmentCard';
import { AddressCard } from '@/components/AddressCard';
import { ShipNowDialog } from '@/components/ShipNowDialog';
import { SmartImportDialog } from '@/components/SmartImportDialog';
import { useTimeline } from '@/hooks/useTimeline';
import { useShipments } from '@/hooks/useShipments';
import { usePackages } from '@/hooks/usePackages';
import { useAddresses } from '@/hooks/useAddresses';
import { useProfile } from '@/hooks/useProfile';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, AlertTriangle, Sparkles } from 'lucide-react';
import { COUNTRY_FLAGS, type WarehouseCountry } from '@/lib/types';
import { Button } from '@/components/ui/button';

export function HomeView({ onNavigateShipments }: { onNavigateShipments?: () => void } = {}) {
  const { events, isLoading: eventsLoading } = useTimeline();
  const { shipments } = useShipments();
  const { packages, consolidationGroups } = usePackages();
  const { addresses, isLoading: addressesLoading } = useAddresses();
  const { profile } = useProfile();

  const [shipOpen, setShipOpen] = useState(false);
  const [smartOpen, setSmartOpen] = useState(false);
  const [presetCountry, setPresetCountry] = useState<WarehouseCountry | undefined>();

  const activeShipments = shipments.filter(s => s.status !== 'DELIVERED');
  const waitingPackages = packages.filter(p => !p.shipment_id && p.status !== 'DELIVERED');

  const greeting = profile?.full_name
    ? `Bonjour, ${profile.full_name.split(' ')[0]}`
    : 'Bienvenue';

  const openShip = (country?: WarehouseCountry) => {
    setPresetCountry(country);
    setShipOpen(true);
  };

  return (
    <div className="space-y-8 pb-28 md:pb-8">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{greeting}</h2>
        <p className="text-sm text-muted-foreground mt-1">Votre logistique, simplifiée.</p>
      </motion.div>

      {/* Action Bar */}
      <ActionBar
        onShip={() => openShip()}
        onTrack={onNavigateShipments}
        onBuy={() => setSmartOpen(true)}
      />

      {/* Smart Import banner */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => setSmartOpen(true)}
        className="w-full flex items-center gap-3 p-4 rounded-xl bg-foreground text-background hover:opacity-90 transition-opacity text-left"
      >
        <Sparkles className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Smart Import Assistant</p>
          <p className="text-xs opacity-70">Estimation instantanée de votre import</p>
        </div>
        <span className="text-xs opacity-70">Essayer →</span>
      </motion.button>

      {/* Conversion triggers */}
      {waitingPackages.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border"
        >
          <Package className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {waitingPackages.length} colis en attente
            </p>
            <p className="text-xs text-muted-foreground">Groupez-les pour économiser</p>
          </div>
          <Button variant="link" size="sm" className="text-primary p-0 h-auto" onClick={() => openShip()}>
            Expédier
          </Button>
        </motion.div>
      )}

      {/* Consolidation prompts */}
      {Object.entries(consolidationGroups).map(([country, pkgs]) => (
        pkgs.length >= 2 && (
          <motion.div
            key={country}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border"
          >
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {COUNTRY_FLAGS[country as keyof typeof COUNTRY_FLAGS]} {pkgs.length} colis en {country}
              </p>
              <p className="text-xs text-muted-foreground">Économisez en groupant</p>
            </div>
            <Button
              variant="link"
              size="sm"
              className="text-amber-600 p-0 h-auto"
              onClick={() => openShip(country as WarehouseCountry)}
            >
              Consolider
            </Button>
          </motion.div>
        )
      ))}

      {/* Active Shipments */}
      {activeShipments.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-foreground">Expéditions actives</h3>
            <span className="text-xs text-muted-foreground">{activeShipments.length}</span>
          </div>
          <div className="space-y-3">
            {activeShipments.map(s => <ShipmentCard key={s.id} shipment={s} />)}
          </div>
        </section>
      )}

      {/* Timeline */}
      <section>
        <h3 className="text-base font-semibold text-foreground mb-3">Activité</h3>
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
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm font-medium text-foreground">Aucune activité</p>
            <p className="text-xs text-muted-foreground mt-1">Commencez à acheter dans le monde entier</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setSmartOpen(true)}>
              Estimer un import
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {events.map((event, i) => <TimelineItem key={event.id} event={event} index={i} />)}
          </div>
        )}
      </section>

      {/* Addresses */}
      <section>
        <h3 className="text-base font-semibold text-foreground mb-3">Vos entrepôts</h3>
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

      <ShipNowDialog open={shipOpen} onOpenChange={setShipOpen} presetCountry={presetCountry} />
      <SmartImportDialog open={smartOpen} onOpenChange={setSmartOpen} />
    </div>
  );
}
