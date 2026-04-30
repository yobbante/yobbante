import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ActionBar } from '@/components/ActionBar';
import { ShipNowDialog } from '@/components/ShipNowDialog';
import { SmartImportDialog } from '@/components/SmartImportDialog';
import { IdleShipDialog } from '@/components/IdleShipDialog';
import { useShipments } from '@/hooks/useShipments';
import { usePackages } from '@/hooks/usePackages';
import { useAddresses } from '@/hooks/useAddresses';
import { useProfile } from '@/hooks/useProfile';
import { useDossiers } from '@/hooks/useDossiers';
import type { WarehouseCountry } from '@/lib/types';

interface HomeViewProps {
  /** Navigate to the unified Mes envois screen, optionally pre-selecting a tab. */
  onNavigateOrders?: (kind?: 'sourcing' | 'receive' | 'send') => void;
}

export function HomeView({ onNavigateOrders }: HomeViewProps = {}) {
  const navigate = useNavigate();
  const { shipments } = useShipments();
  const { packages, idlePackages } = usePackages();
  const { addresses } = useAddresses();
  const { profile } = useProfile();
  const { dossiers } = useDossiers();
  const goOrders = (kind?: 'sourcing' | 'receive' | 'send') => onNavigateOrders?.(kind);

  const [shipOpen, setShipOpen] = useState(false);
  const [smartOpen, setSmartOpen] = useState(false);
  const [idleOpen, setIdleOpen] = useState(false);
  const [presetCountry] = useState<WarehouseCountry | undefined>();

  const activeShipments = shipments.filter(s => s.status !== 'DELIVERED');
  const activeDossiers = dossiers.filter(d => d.status !== 'CLOSED' && d.status !== 'DELIVERED');
  const waitingPackages = packages.filter(p => !p.shipment_id && p.status !== 'DELIVERED');

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const period = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
    if (profile?.full_name) return `${period}, ${profile.full_name.split(' ')[0]}`;
    return `${period}`;
  }, [profile?.full_name]);

  return (
    <div className="space-y-5 pb-24 md:pb-12">
      {/* Hero compact */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-1"
      >
        <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] font-medium text-muted-foreground">Mon espace</p>
        <h2 className="mt-1.5 text-[1.5rem] sm:text-3xl font-bold tracking-tight text-foreground leading-[1.1]">
          {greeting}.
        </h2>

        {/* KPI rail compact */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { value: activeDossiers.length, label: 'Sourcing',   onClick: () => goOrders('sourcing') },
            { value: waitingPackages.length, label: 'Réceptions', onClick: () => goOrders('receive') },
            { value: activeShipments.length, label: 'Envois',     onClick: () => goOrders('send') },
            { value: addresses.length,       label: 'Hubs',       onClick: undefined as (() => void) | undefined },
          ].map((kpi) => (
            <button
              key={kpi.label}
              type="button"
              onClick={kpi.onClick}
              disabled={!kpi.onClick}
              className="text-left rounded-xl border border-border bg-card p-2.5 hover:border-foreground/30 transition-colors disabled:cursor-default disabled:hover:border-border"
            >
              <p className="text-xl font-bold tracking-tight tabular-nums text-foreground">{kpi.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{kpi.label}</p>
            </button>
          ))}
        </div>
      </motion.section>

      {/* Action Bar — 2-CTA + trio Sourcing / Estimer / Suivre */}
      <ActionBar
        onEstimate={() => setSmartOpen(true)}
        onTrack={() => goOrders('send')}
      />

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
