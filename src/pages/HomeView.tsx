import { useMemo, useState } from 'react';
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
import { EmptyState } from '@/components/EmptyState';
import { useTimeline } from '@/hooks/useTimeline';
import { useShipments } from '@/hooks/useShipments';
import { usePackages } from '@/hooks/usePackages';
import { useAddresses } from '@/hooks/useAddresses';
import { useProfile } from '@/hooks/useProfile';
import { useDossiers } from '@/hooks/useDossiers';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Clock, Sparkles, Layers, ArrowRight } from 'lucide-react';
import { COUNTRY_FLAGS, type WarehouseCountry } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface HomeViewProps {
  /** Navigate to the unified Mes envois screen, optionally pre-selecting a tab. */
  onNavigateOrders?: (kind?: 'sourcing' | 'receive' | 'send') => void;
}

export function HomeView({ onNavigateOrders }: HomeViewProps = {}) {
  const navigate = useNavigate();
  const { events, isLoading: eventsLoading } = useTimeline();
  const { shipments } = useShipments();
  const { packages, consolidationGroups, idlePackages } = usePackages();
  const { addresses, isLoading: addressesLoading } = useAddresses();
  const { profile } = useProfile();
  const { dossiers, isLoading: dossiersLoading } = useDossiers();
  const goOrders = (kind?: 'sourcing' | 'receive' | 'send') => onNavigateOrders?.(kind);

  const [shipOpen, setShipOpen] = useState(false);
  const [smartOpen, setSmartOpen] = useState(false);
  const [idleOpen, setIdleOpen] = useState(false);
  const [presetCountry, setPresetCountry] = useState<WarehouseCountry | undefined>();

  const activeShipments = shipments.filter(s => s.status !== 'DELIVERED');
  const activeDossiers = dossiers.filter(d => d.status !== 'CLOSED' && d.status !== 'DELIVERED');
  const waitingPackages = packages.filter(p => !p.shipment_id && p.status !== 'DELIVERED');

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const period = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
    if (profile?.full_name) return `${period}, ${profile.full_name.split(' ')[0]}`;
    return `${period}`;
  }, [profile?.full_name]);

  const openShip = (country?: WarehouseCountry) => {
    setPresetCountry(country);
    setShipOpen(true);
  };

  const recentEvents = events.slice(0, 5);

  return (
    <div className="space-y-6 sm:space-y-8 pb-28 md:pb-12">
      {/* Hero — typographie editorial, ultra-épuré */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-1"
      >
        <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] font-medium text-muted-foreground">Mon espace</p>
        <h2 className="mt-1.5 text-[1.625rem] sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground leading-[1.1]">
          {greeting}.
        </h2>
        <p className="mt-1.5 text-[13px] sm:text-sm text-muted-foreground max-w-md">
          Un seul endroit pour vos envois, réceptions et sourcing.
        </p>

        {/* KPI rail — cliquable, navigue vers la vue dédiée */}
        <div className="mt-5 sm:mt-6 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2.5">
          {[
            { value: activeDossiers.length, label: 'Sourcing', onClick: () => goOrders('sourcing') },
            { value: waitingPackages.length, label: 'Réceptions', onClick: () => goOrders('receive') },
            { value: activeShipments.length, label: 'Envois', onClick: () => goOrders('send') },
            { value: addresses.length, label: 'Hubs', onClick: undefined as (() => void) | undefined },
          ].map((kpi) => (
            <button
              key={kpi.label}
              type="button"
              onClick={kpi.onClick}
              disabled={!kpi.onClick}
              className="text-left rounded-xl border border-border bg-card p-2.5 sm:p-3 hover:border-foreground/30 transition-colors disabled:cursor-default disabled:hover:border-border"
            >
              <p className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums text-foreground">{kpi.value}</p>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 leading-tight">{kpi.label}</p>
            </button>
          ))}
        </div>
      </motion.section>

      {/* Action Bar — 2-CTA model + secondary trio */}
      <ActionBar
        onEstimate={() => setSmartOpen(true)}
        onTrack={() => goOrders('send')}
      />

      {/* Smart prompts — alertes contextuelles uniquement */}
      <div className="space-y-2.5">
        {idlePackages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30"
          >
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground leading-snug">
                {idlePackages.length} colis en attente +48h
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Expédiez maintenant pour éviter le stockage.</p>
            </div>
            <Button size="sm" onClick={() => setIdleOpen(true)} className="shrink-0">
              1 clic
            </Button>
          </motion.div>
        )}

        {Object.entries(consolidationGroups).map(([country, pkgs]) => (
          pkgs.length >= 2 && (
            <motion.div
              key={country}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border"
            >
              <Layers className="w-4 h-4 text-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground leading-snug">
                  {COUNTRY_FLAGS[country as keyof typeof COUNTRY_FLAGS]} {pkgs.length} colis prêts à grouper
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Une seule expédition, frais réduits.</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-foreground"
                onClick={() => openShip(country as WarehouseCountry)}
              >
                Consolider
              </Button>
            </motion.div>
          )
        ))}
      </div>

      {/* Active Dossiers — top 2 + see all */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-semibold text-foreground tracking-tight">Vos dossiers</h3>
          {activeDossiers.length > 2 && (
            <button
              type="button"
              onClick={() => goOrders('sourcing')}
              className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              Tout voir <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
        {dossiersLoading ? (
          <Skeleton className="h-28 rounded-2xl" />
        ) : activeDossiers.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Confiez votre premier dossier"
            description="Un produit en tête ? On trouve le bon fournisseur, on vérifie, on achète et on livre."
            ctaLabel="Démarrer"
            onCta={() => navigate('/acheter')}
          />
        ) : (
          <div className="space-y-3">
            {activeDossiers.slice(0, 2).map(d => <DossierCard key={d.id} dossier={d} />)}
          </div>
        )}
      </section>

      {/* Active Shipments */}
      {activeShipments.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-semibold text-foreground tracking-tight">Expéditions actives</h3>
            <button
              type="button"
              onClick={() => goOrders('send')}
              className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              Tout voir <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {activeShipments.slice(0, 2).map(s => <ShipmentCard key={s.id} shipment={s} />)}
          </div>
        </section>
      )}

      {/* Activité — feed récent */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-semibold text-foreground tracking-tight">Activité récente</h3>
        </div>
        {eventsLoading ? (
          <div className="space-y-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-3 p-3">
                <Skeleton className="w-9 h-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : recentEvents.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Pas encore d'activité"
            description="Dès qu'un colis bouge ou qu'un dossier avance, vous le verrez ici en direct."
          />
        ) : (
          <div className="space-y-1 -mx-2">
            {recentEvents.map((event, i) => <TimelineItem key={event.id} event={event} index={i} />)}
          </div>
        )}
      </section>

      {/* Hubs — adresses */}
      <section>
        <h3 className="text-[15px] font-semibold text-foreground tracking-tight mb-3">Vos entrepôts</h3>
        {addressesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {addresses.slice(0, 6).map(addr => <AddressCard key={addr.id} address={addr} />)}
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
