import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Sparkles, Inbox, Send, Search } from 'lucide-react';
import { useDossiers } from '@/hooks/useDossiers';
import { useShipments } from '@/hooks/useShipments';
import { usePackages } from '@/hooks/usePackages';
import { DossierCard } from '@/components/DossierCard';
import { ShipmentCard } from '@/components/ShipmentCard';
import { ShipmentDetailDrawer } from '@/components/ShipmentDetailDrawer';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { PackageTimelineDialog } from '@/components/PackageTimelineDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  COUNTRY_FLAGS,
  type Dossier, type Shipment, type Package as PackageType,
} from '@/lib/types';

/** A user-facing "kind of order" — the only 3 buckets a customer ever has. */
type Kind = 'sourcing' | 'receive' | 'send';

const KIND_TABS: ReadonlyArray<{
  id: Kind;
  label: string;
  short: string;
  hint: string;
  Icon: typeof Sparkles;
  ctaLabel: string;
  ctaHref: string;
}> = [
  {
    id: 'sourcing',
    label: 'Sourcing',
    short: 'Sourcing',
    hint: 'On trouve, on achète, on livre.',
    Icon: Sparkles,
    ctaLabel: 'Confier un sourcing',
    ctaHref: '/acheter',
  },
  {
    id: 'receive',
    label: 'Réceptions',
    short: 'Réceptions',
    hint: 'Vos achats en ligne arrivent dans nos hubs.',
    Icon: Inbox,
    ctaLabel: 'Recevoir un colis',
    ctaHref: '/expedier/recevoir',
  },
  {
    id: 'send',
    label: 'Envois',
    short: 'Envois',
    hint: 'Vous expédiez un colis dans le monde.',
    Icon: Send,
    ctaLabel: 'Expédier un colis',
    ctaHref: '/expedier/envoyer',
  },
];

/** Classify a dossier into one of the 3 user buckets. Mirror of admin/RequestsTab.tsx. */
function dossierKind(d: Dossier): Kind {
  if (d.needs_sourcing) return 'sourcing';
  if (d.app_source === 'expedier') return 'send';
  return 'receive';
}

export function OrdersView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { dossiers, isLoading: dossiersLoading } = useDossiers();
  const { shipments, isLoading: shipmentsLoading } = useShipments();
  const { packages } = usePackages();

  const initialKind = (searchParams.get('kind') as Kind) || 'sourcing';
  const [kind, setKindState] = useState<Kind>(
    KIND_TABS.some(t => t.id === initialKind) ? initialKind : 'sourcing'
  );
  const [query, setQuery] = useState('');

  // Detail drawers
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [trackPkg, setTrackPkg] = useState<PackageType | null>(null);

  const setKind = (next: Kind) => {
    setKindState(next);
    const sp = new URLSearchParams(searchParams);
    sp.set('kind', next);
    setSearchParams(sp, { replace: true });
  };

  // Bucket dossiers by kind once.
  const grouped = useMemo(() => {
    const out: Record<Kind, Dossier[]> = { sourcing: [], receive: [], send: [] };
    for (const d of dossiers) out[dossierKind(d)].push(d);
    return out;
  }, [dossiers]);

  const counts = {
    sourcing: grouped.sourcing.length,
    receive: grouped.receive.length,
    send: grouped.send.length,
  };

  const activeTab = KIND_TABS.find(t => t.id === kind)!;
  const visibleDossiers = useMemo(() => {
    const list = grouped[kind];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(d =>
      d.reference.toLowerCase().includes(q) ||
      d.product_description.toLowerCase().includes(q)
    );
  }, [grouped, kind, query]);

  // For "Envois" we also surface live shipments + active packages, since they're
  // the operational counterpart of a "send" dossier (the truck/airplane leg).
  const activeShipments = useMemo(
    () => shipments.filter(s => s.status !== 'DELIVERED'),
    [shipments]
  );
  const inHubPackages = useMemo(
    () => packages.filter(p => !p.shipment_id && p.status !== 'DELIVERED'),
    [packages]
  );

  const isLoading = dossiersLoading || shipmentsLoading;

  return (
    <div className="space-y-5 sm:space-y-6 pb-28 md:pb-12">
      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between gap-3"
      >
        <div>
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] font-medium text-muted-foreground">Mes envois</p>
          <h2 className="mt-1.5 text-[1.5rem] sm:text-3xl font-bold tracking-tight text-foreground">
            Tout en un seul endroit
          </h2>
          <p className="mt-1.5 text-[13px] sm:text-sm text-muted-foreground max-w-md">
            Sourcing, réceptions et envois — vos commandes regroupées par type.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => navigate(activeTab.ctaHref)}
          className="gap-1 shrink-0"
          aria-label={activeTab.ctaLabel}
        >
          <Plus className="w-3.5 h-3.5" /> Nouveau
        </Button>
      </motion.header>

      {/* Segmented tabs — 3 user-facing buckets */}
      <div
        role="tablist"
        aria-label="Type de commande"
        className="grid grid-cols-3 gap-1.5 p-1 bg-secondary/60 rounded-xl"
      >
        {KIND_TABS.map(t => {
          const isActive = t.id === kind;
          const count = counts[t.id];
          const Icon = t.Icon;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${t.id}`}
              id={`tab-${t.id}`}
              onClick={() => setKind(t.id)}
              className={cn(
                'relative flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-lg text-[12px] sm:text-[13px] font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isActive
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={isActive ? 2.4 : 1.8} />
              <span className="leading-none">{t.short}</span>
              {count > 0 && (
                <span
                  className={cn(
                    'tabular-nums text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none',
                    isActive ? 'bg-foreground/10 text-foreground' : 'bg-foreground/5 text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Hint line + search */}
      <div className="space-y-3">
        <p className="text-[12px] text-muted-foreground" aria-live="polite">
          {activeTab.hint}
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Rechercher dans ${activeTab.short.toLowerCase()}…`}
            aria-label={`Rechercher dans ${activeTab.short.toLowerCase()}`}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-card border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground/40 transition-colors"
          />
        </div>
      </div>

      {/* Panel */}
      <section
        role="tabpanel"
        id={`panel-${kind}`}
        aria-labelledby={`tab-${kind}`}
        className="space-y-3"
      >
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : visibleDossiers.length === 0 && (kind !== 'send' || activeShipments.length === 0) ? (
          <EmptyState
            icon={activeTab.Icon}
            title={emptyTitle(kind)}
            description={emptyDescription(kind)}
            ctaLabel={activeTab.ctaLabel}
            onCta={() => navigate(activeTab.ctaHref)}
          />
        ) : (
          <>
            {visibleDossiers.map(d => <DossierCard key={d.id} dossier={d} />)}

            {/* For "Envois" tab, also surface shipments & in-hub packages. */}
            {kind === 'send' && (
              <>
                {activeShipments.length > 0 && (
                  <div className="pt-3">
                    <h3 className="text-[11px] uppercase tracking-[0.18em] font-medium text-muted-foreground mb-3">
                      Expéditions en cours
                    </h3>
                    <div className="space-y-3">
                      {activeShipments.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedShipment(s)}
                          className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
                        >
                          <ShipmentCard shipment={s} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {inHubPackages.length > 0 && (
                  <div className="pt-3">
                    <h3 className="text-[11px] uppercase tracking-[0.18em] font-medium text-muted-foreground mb-3">
                      Colis en hub ({inHubPackages.length})
                    </h3>
                    <div className="space-y-2">
                      {inHubPackages.map(pkg => (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => setTrackPkg(pkg)}
                          className="w-full flex items-center gap-3 p-3.5 bg-card border border-border rounded-xl hover:border-foreground/20 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Suivre colis ${pkg.description ?? pkg.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {COUNTRY_FLAGS[pkg.warehouse_country]} {pkg.description || 'Colis sans description'}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {pkg.weight ? `${pkg.weight} kg` : 'Poids inconnu'}
                            </p>
                          </div>
                          <StatusBadge status={pkg.status} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>

      <ShipmentDetailDrawer
        open={!!selectedShipment}
        onOpenChange={(o) => { if (!o) setSelectedShipment(null); }}
        shipment={selectedShipment}
        packages={packages}
      />
      <PackageTimelineDialog
        open={!!trackPkg}
        onOpenChange={(o) => { if (!o) setTrackPkg(null); }}
        pkg={trackPkg}
      />
    </div>
  );
}

function emptyTitle(kind: Kind) {
  if (kind === 'sourcing') return 'Aucun sourcing pour l\'instant';
  if (kind === 'receive') return 'Aucune réception en cours';
  return 'Aucun envoi pour l\'instant';
}
function emptyDescription(kind: Kind) {
  if (kind === 'sourcing') return 'Confiez-nous un produit à trouver. On sélectionne le bon fournisseur, on vérifie, on achète et on livre.';
  if (kind === 'receive') return 'Faites livrer vos commandes en ligne dans nos hubs. Nous regroupons et expédions chez vous.';
  return 'Commencez par expédier un colis : dites-nous d\'où ça part et où ça arrive.';
}
