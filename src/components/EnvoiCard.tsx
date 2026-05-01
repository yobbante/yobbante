import { motion } from 'framer-motion';
import {
  ArrowRight, Plane, Ship, Truck, Package as PackageIcon,
  Clock, ChevronRight, Send, Hourglass,
} from 'lucide-react';
import {
  type Shipment, type Dossier,
  COUNTRY_FLAGS, COUNTRY_NAMES, SHIPMENT_STATUS_LABELS, DOSSIER_STATUS_LABELS,
  type WarehouseCountry,
} from '@/lib/types';

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

function transportVisual(mode?: string | null) {
  const m = (mode ?? '').toUpperCase();
  if (m.includes('SEA') || m === 'VOLUME') return { Icon: Ship, label: 'Maritime', tone: 'text-sky-400' };
  if (m.includes('ROAD') || m === 'ECONOMY') return { Icon: Truck, label: 'Routier', tone: 'text-amber-400' };
  if (m.includes('AIR') || m === 'FAST') return { Icon: Plane, label: 'Aérien', tone: 'text-primary' };
  return { Icon: Plane, label: 'Standard', tone: 'text-primary' };
}

function flagOf(country?: string | null) {
  if (!country) return '🌍';
  return (COUNTRY_FLAGS as Record<string, string>)[country.toUpperCase()] || '🌍';
}
function nameOf(country?: string | null) {
  if (!country) return '—';
  return (COUNTRY_NAMES as Record<string, string>)[country.toUpperCase()] || country;
}

/** Heuristic progress for a shipment status (0..1) on the customer-facing scale. */
const SHIPMENT_PROGRESS: Record<string, number> = {
  PENDING: 0.05, WAITING_FOR_MATCH: 0.1, CONFIRMED: 0.2, MATCHED: 0.3, IN_PREPARATION: 0.4,
  IN_TRANSIT: 0.6, CUSTOMS: 0.75, ARRIVED: 0.85, OUT_FOR_DELIVERY: 0.92,
  DELIVERED: 1, ON_HOLD: 0.5, CANCELLED: 0,
};

const DOSSIER_PROGRESS: Record<string, number> = {
  SUBMITTED: 0.1, IN_REVIEW: 0.2, SOURCING: 0.3, PROCURED: 0.45,
  IN_TRANSIT: 0.65, CUSTOMS: 0.8, DELIVERED: 1, CLOSED: 1,
};

type Props =
  | { kind: 'shipment'; shipment: Shipment; onClick: () => void }
  | { kind: 'dossier'; dossier: Dossier; onClick: () => void };

export function EnvoiCard(props: Props) {
  if (props.kind === 'shipment') return <ShipmentVariant shipment={props.shipment} onClick={props.onClick} />;
  return <DossierVariant dossier={props.dossier} onClick={props.onClick} />;
}

function ShipmentVariant({ shipment, onClick }: { shipment: Shipment; onClick: () => void }) {
  const meta = (shipment.transport_metadata ?? {}) as Record<string, any>;
  const inner = (meta.meta ?? {}) as Record<string, any>;

  const originCountry = shipment.origin_country;
  const destCountry = shipment.destination_country;
  const originCity = shipment.origin_city ?? inner?.true_direction?.origin_city ?? nameOf(originCountry);
  const destCity = shipment.destination_city ?? inner?.true_direction?.destination_city ?? nameOf(destCountry);
  const transport = transportVisual(inner?.transport_mode ?? shipment.transport_type ?? meta.label);
  const weight = inner?.weight_kg ?? shipment.weight_kg;
  const parcels = inner?.parcel_count ?? 1;
  const reference = inner?.dossier_reference ?? shipment.tracking_number;
  const progress = SHIPMENT_PROGRESS[shipment.status] ?? 0.1;
  const statusLabel = SHIPMENT_STATUS_LABELS[shipment.status] ?? shipment.status;
  const isDelivered = shipment.status === 'DELIVERED';
  const isOnHold = shipment.status === 'ON_HOLD' || shipment.status === 'WAITING_FOR_MATCH';

  return (
    <Shell onClick={onClick} dimmed={isDelivered}>
      <Header
        reference={reference}
        statusLabel={statusLabel}
        statusTone={isOnHold ? 'amber' : isDelivered ? 'emerald' : 'primary'}
      />
      <Route
        originFlag={flagOf(originCountry)} originCity={originCity}
        destFlag={flagOf(destCountry)} destCity={destCity}
        transport={transport}
      />
      <ProgressBar value={progress} dimmed={isDelivered} />
      <Chips
        transportLabel={transport.label}
        TransportIcon={transport.Icon}
        weight={weight ?? null}
        parcels={parcels}
        eta={shipment.eta ?? shipment.departure_date ?? null}
      />
      <Footer
        priceEur={shipment.total_cost != null ? Number(shipment.total_cost) : null}
        ctaLabel="Voir détails"
      />
    </Shell>
  );
}

function DossierVariant({ dossier, onClick }: { dossier: Dossier; onClick: () => void }) {
  // Pull lightweight hints from notes (SendFlow stores structured-ish text there).
  const get = (re: RegExp) => dossier.notes?.match(re)?.[1]?.trim() ?? null;
  const transportRaw = get(/Transport:\s*([^·\n]+)/);
  const transport = transportVisual(transportRaw);
  const parcelsStr = get(/Poids:\s*[\d.,]+\s*kg\s*·\s*(\d+)\s*colis/);
  const parcels = parcelsStr ? Number(parcelsStr) : 1;

  const description = (dossier.product_description ?? '')
    .replace(/^Expéd(it)?ion\s+/i, '')
    .split('—')[0]
    .trim();

  const progress = DOSSIER_PROGRESS[dossier.status] ?? 0.1;
  const statusLabel = DOSSIER_STATUS_LABELS[dossier.status] ?? dossier.status;
  const isDelivered = dossier.status === 'DELIVERED' || dossier.status === 'CLOSED';

  // Try to recover origin/dest cities from product_description "X → Y"
  const arrowMatch = dossier.product_description?.match(/—\s*([^→]+)→\s*(.+)$/);
  const originCity = arrowMatch?.[1]?.trim() || nameOf(dossier.origin_country);
  const destCity = arrowMatch?.[2]?.trim() || nameOf(dossier.destination_country);

  return (
    <Shell onClick={onClick} dimmed={isDelivered}>
      <Header reference={dossier.reference} statusLabel={statusLabel} statusTone={isDelivered ? 'emerald' : 'primary'} pending />
      <Route
        originFlag={flagOf(dossier.origin_country)} originCity={originCity}
        destFlag={flagOf(dossier.destination_country)} destCity={destCity}
        transport={transport}
      />
      <ProgressBar value={progress} dimmed={isDelivered} />
      <Chips
        transportLabel={transport.label}
        TransportIcon={transport.Icon}
        weight={dossier.estimated_weight ?? null}
        parcels={parcels}
        eta={dossier.estimated_delivery_date ?? null}
        descriptor={description || null}
      />
      <Footer
        priceEur={dossier.estimated_cost ?? dossier.budget_eur ?? null}
        priceLabel={dossier.estimated_cost ? 'Estimation' : 'Budget'}
        ctaLabel="Voir détails"
      />
    </Shell>
  );
}

/* ------------------------------- Primitives ------------------------------- */

function Shell({ onClick, children, dimmed }: { onClick: () => void; children: React.ReactNode; dimmed?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`group w-full text-left rounded-2xl p-4 sm:p-5 border transition-all
        focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
        bg-card border-border hover:border-primary/40 hover:shadow-[0_4px_30px_-8px_hsl(var(--primary)/0.25)]
        ${dimmed ? 'opacity-75 hover:opacity-100' : ''}`}
    >
      {children}
    </motion.button>
  );
}

function Header({
  reference, statusLabel, statusTone, pending,
}: {
  reference?: string | null;
  statusLabel: string;
  statusTone: 'primary' | 'amber' | 'emerald';
  pending?: boolean;
}) {
  const toneClass =
    statusTone === 'amber' ? 'text-amber-500 bg-amber-500/10'
    : statusTone === 'emerald' ? 'text-emerald-500 bg-emerald-500/10'
    : 'text-primary bg-primary/10';

  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Send className="w-3.5 h-3.5 text-primary" />
          </div>
          {reference && (
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate">
              {reference}
            </p>
          )}
        </div>
      </div>
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md whitespace-nowrap ${toneClass}`}>
        {pending && <Hourglass className="w-3 h-3" />}
        {statusLabel}
      </span>
    </div>
  );
}

function Route({
  originFlag, originCity, destFlag, destCity, transport,
}: {
  originFlag: string; originCity: string;
  destFlag: string; destCity: string;
  transport: { Icon: typeof Plane; label: string; tone: string };
}) {
  const T = transport.Icon;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-3">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Départ</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-base">{originFlag}</span>
          <span className="text-sm font-semibold text-foreground truncate">{originCity}</span>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center px-1">
        <T className={`w-4 h-4 ${transport.tone}`} />
        <ArrowRight className="w-3 h-3 text-muted-foreground mt-0.5" />
      </div>
      <div className="min-w-0 text-right">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Arrivée</p>
        <div className="flex items-center gap-1.5 mt-0.5 justify-end">
          <span className="text-sm font-semibold text-foreground truncate">{destCity}</span>
          <span className="text-base">{destFlag}</span>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ value, dimmed }: { value: number; dimmed?: boolean }) {
  const pct = Math.max(2, Math.min(100, Math.round(value * 100)));
  return (
    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${dimmed ? 'bg-emerald-500' : 'bg-gradient-to-r from-primary to-primary/70'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Chips({
  transportLabel, TransportIcon, weight, parcels, eta, descriptor,
}: {
  transportLabel: string;
  TransportIcon: typeof Plane;
  weight: number | null;
  parcels: number;
  eta: string | null;
  descriptor?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-3">
      <Chip>
        <TransportIcon className="w-3.5 h-3.5" />
        {transportLabel}
      </Chip>
      <Chip>
        <PackageIcon className="w-3.5 h-3.5" />
        {weight != null ? `${weight} kg` : '—'}{parcels > 1 ? ` · ${parcels} colis` : ''}
      </Chip>
      {eta && (
        <Chip>
          <Clock className="w-3.5 h-3.5" />
          {new Date(eta).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
        </Chip>
      )}
      {descriptor && (
        <Chip className="max-w-[14rem]">
          <span className="truncate">{descriptor}</span>
        </Chip>
      )}
    </div>
  );
}

function Chip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-secondary/60 px-2 py-1 rounded-md ${className}`}>
      {children}
    </span>
  );
}

function Footer({
  priceEur, priceLabel = 'Total', ctaLabel,
}: {
  priceEur: number | null;
  priceLabel?: string;
  ctaLabel: string;
}) {
  return (
    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
      <div>
        {priceEur != null ? (
          <>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{priceLabel}</p>
            <p className="text-base font-bold text-foreground">{fmtEur(priceEur)}</p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground italic">Devis en cours…</p>
        )}
      </div>
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-1.5 transition-all">
        {ctaLabel} <ChevronRight className="w-3.5 h-3.5" />
      </span>
    </div>
  );
}

// Re-export country helpers in case other modules want them
export type { WarehouseCountry };
