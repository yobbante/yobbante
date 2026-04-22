import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ActionBar } from '@/components/ActionBar';
import { TimelineItem } from '@/components/TimelineItem';
import { ShipmentCard } from '@/components/ShipmentCard';
import { AddressCard } from '@/components/AddressCard';
import { DossierCard } from '@/components/DossierCard';
import { ShipNowDialog } from '@/components/ShipNowDialog';
import { SmartImportDialog } from '@/components/SmartImportDialog';
import { IdleShipDialog } from '@/components/IdleShipDialog';
import { useTimeline } from '@/hooks/useTimeline';
import { useShipments } from '@/hooks/useShipments';
import { usePackages } from '@/hooks/usePackages';
import { useAddresses } from '@/hooks/useAddresses';
import { useProfile } from '@/hooks/useProfile';
import { useDossiers } from '@/hooks/useDossiers';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Clock, FolderPlus, ArrowRight, Layers } from 'lucide-react';
import { COUNTRY_FLAGS, type WarehouseCountry } from '@/lib/types';
import { Button } from '@/components/ui/button';

export function HomeView({ onNavigateShipments }: { onNavigateShipments?: () => void } = {}) {
  const navigate = useNavigate();
  // Realtime streaming lives inside useTimeline now — true subscription, not just cache invalidation.
  const { events, isLoading: eventsLoading } = useTimeline();
  const { shipments } = useShipments();
  const { packages, consolidationGroups, idlePackages } = usePackages();
  const { addresses, isLoading: addressesLoading } = useAddresses();
  const { profile } = useProfile();
  const { dossiers, isLoading: dossiersLoading } = useDossiers();

  const [shipOpen, setShipOpen] = useState(false);
  const [smartOpen, setSmartOpen] = useState(false);
  const [idleOpen, setIdleOpen] = useState(false);
  const [presetCountry, setPresetCountry] = useState<WarehouseCountry | undefined>();


  const activeShipments = shipments.filter(s => s.status !== 'DELIVERED');
  const activeDossiers = dossiers.filter(d => d.status !== 'CLOSED' && d.status !== 'DELIVERED');
  const waitingPackages = packages.filter(p => !p.shipment_id && p.status !== 'DELIVERED');

  const greeting = profile?.full_name
    ? `Bonjour, ${profile.full_name.split(' ')[0]}`
    : 'Bienvenue';

  const openShip = (country?: WarehouseCountry) => {
    setPresetCountry(country);
    setShipOpen(true);
  };

  const openDossier = () => {
    navigate('/acheter');
  };

  return (
    <div className="space-y-10 pb-28 md:pb-12">
      {/* Hero greeting — minimal, premium, aligned with new flow aesthetic */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-2"
      >
        <p className="text-[11px] uppercase tracking-[0.18em] font-medium text-muted-foreground">Mon espace</p>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight text-foreground text-balance">
          {greeting}.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          Un seul endroit pour vos envois, réceptions et sourcing.
        </p>

        {/* KPI rail — flat, no gradients */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {[
            { value: activeDossiers.length, label: 'Dossiers actifs' },
            { value: waitingPackages.length, label: 'Colis en attente' },
            { value: activeShipments.length, label: 'Expéditions' },
            { value: addresses.length, label: 'Hubs actifs' },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-border bg-card p-3">
              <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground">{kpi.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{kpi.label}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Action Bar — 2-CTA model + minimal trio, mirrors public landing */}
      <ActionBar
        onDossier={openDossier}
        onEstimate={() => setSmartOpen(true)}
        onShip={() => openShip()}
        onTrack={onNavigateShipments}
      />

      {/* Active Dossiers */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-foreground">Vos dossiers</h3>
          {activeDossiers.length > 0 && <span className="text-xs text-muted-foreground">{activeDossiers.length} actif{activeDossiers.length > 1 ? 's' : ''}</span>}
        </div>
        {dossiersLoading ? (
          <Skeleton className="h-28 rounded-2xl" />
        ) : activeDossiers.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-dashed border-border p-6 text-center"
          >
            <FolderPlus className="w-7 h-7 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">Aucun dossier en cours</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              Confiez votre premier achat. Nous trouvons, achetons et livrons pour vous.
            </p>
            <Button onClick={openDossier} size="sm" className="mt-4">
              Confier un dossier <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {activeDossiers.slice(0, 3).map(d => <DossierCard key={d.id} dossier={d} />)}
          </div>
        )}
      </section>

      {/* Conversion triggers */}
      {waitingPackages.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border"
        >
          <Package className="w-5 h-5 text-foreground flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {waitingPackages.length} colis en attente
            </p>
            <p className="text-xs text-muted-foreground">Groupez-les pour économiser</p>
          </div>
          <Button variant="link" size="sm" className="text-foreground p-0 h-auto" onClick={() => openShip()}>
            Expédier
          </Button>
        </motion.div>
      )}

      {/* 48h idle prompt — one-click ship-now */}
      {idlePackages.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30"
        >
          <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {idlePackages.length} colis en attente depuis +48h
            </p>
            <p className="text-xs text-muted-foreground">Expédiez maintenant pour éviter les frais de stockage.</p>
          </div>
          <Button size="sm" onClick={() => setIdleOpen(true)}>
            Expédier en 1 clic
          </Button>
        </motion.div>
      )}

      {/* Consolidation prompts — auto-grouping suggestions */}
      {Object.entries(consolidationGroups).map(([country, pkgs]) => (
        pkgs.length >= 2 && (
          <motion.div
            key={country}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border"
          >
            <Layers className="w-5 h-5 text-foreground flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {COUNTRY_FLAGS[country as keyof typeof COUNTRY_FLAGS]} {pkgs.length} colis prêts à grouper
              </p>
              <p className="text-xs text-muted-foreground">Une seule expédition, des frais réduits.</p>
            </div>
            <Button
              variant="link"
              size="sm"
              className="text-foreground p-0 h-auto"
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
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm font-medium text-foreground">Aucune activité</p>
            <p className="text-xs text-muted-foreground mt-1">Commencez à acheter dans le monde entier</p>
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
      <IdleShipDialog open={idleOpen} onOpenChange={setIdleOpen} idlePackages={idlePackages} />
      <SmartImportDialog
        open={smartOpen}
        onOpenChange={setSmartOpen}
        onConfideDossier={(p) => {
          setSmartOpen(false);
          navigate('/acheter', {
            state: {
              preset: { product: p.product, estimatedWeight: String(p.weight), origin: p.origin, destination: p.destination, estimatedCost: p.estimatedCost },
            },
          });
        }}
      />
    </div>
  );
}
