import { motion } from 'framer-motion';
import { ArrowRight, Clock, Plane, Ship, Truck, Package as PackageIcon, ChevronRight } from 'lucide-react';
import { Shipment, COUNTRY_FLAGS, COUNTRY_NAMES } from '@/lib/types';
import { StatusBadge, StatusProgress } from './StatusBadge';

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

function transportIcon(mode?: string | null) {
  const m = (mode ?? '').toUpperCase();
  if (m.includes('SEA') || m === 'VOLUME') return <Ship className="w-3.5 h-3.5" />;
  if (m.includes('ROAD') || m === 'ECONOMY') return <Truck className="w-3.5 h-3.5" />;
  return <Plane className="w-3.5 h-3.5" />;
}

function transportLabel(mode?: string | null) {
  const m = (mode ?? '').toUpperCase();
  if (m.includes('SEA') || m === 'VOLUME') return 'Maritime';
  if (m.includes('ROAD') || m === 'ECONOMY') return 'Routier';
  if (m.includes('AIR') || m === 'FAST') return 'Aérien';
  return mode ?? 'Standard';
}

export function ShipmentCard({ shipment }: { shipment: Shipment }) {
  const flag = COUNTRY_FLAGS[shipment.origin_country] || '🌍';
  const destFlag = shipment.destination_country === 'SN' ? '🇸🇳' : '🌍';
  const destName = shipment.destination_country === 'SN' ? 'Sénégal' : shipment.destination_country;
  const meta = (shipment.transport_metadata ?? {}) as Record<string, any>;
  const innerMeta = (meta.meta ?? {}) as Record<string, any>;
  const originCity = shipment.origin_city ?? innerMeta?.true_direction?.origin_city;
  const destCity = shipment.destination_city ?? innerMeta?.true_direction?.destination_city;
  const transport = innerMeta?.transport_mode ?? shipment.transport_type ?? meta.label;
  const weight = innerMeta?.weight_kg ?? shipment.weight_kg;
  const parcels = innerMeta?.parcel_count;
  const reference = innerMeta?.dossier_reference;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="group bg-card rounded-2xl p-4 sm:p-5 border border-border hover:border-foreground/20 hover:shadow-md transition-all cursor-pointer"
    >
      {/* Top row: route + status */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          {reference && (
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
              {reference}
            </p>
          )}
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-base">{flag}</span>
            <span className="font-semibold text-foreground truncate">
              {originCity || COUNTRY_NAMES[shipment.origin_country]}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-base">{destFlag}</span>
            <span className="font-semibold text-foreground truncate">
              {destCity || destName}
            </span>
          </div>
        </div>
        <StatusBadge status={shipment.status} />
      </div>

      {/* Progress */}
      <StatusProgress status={shipment.status} type="shipment" />

      {/* Meta chips */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-secondary/60 px-2 py-1 rounded-md">
          {transportIcon(transport)}
          {transportLabel(transport)}
        </span>
        {weight != null && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-secondary/60 px-2 py-1 rounded-md">
            <PackageIcon className="w-3.5 h-3.5" />
            {weight} kg{parcels && parcels > 1 ? ` · ${parcels} colis` : ''}
          </span>
        )}
        {shipment.eta && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-secondary/60 px-2 py-1 rounded-md">
            <Clock className="w-3.5 h-3.5" />
            {new Date(shipment.eta).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
          </span>
        )}
      </div>

      {/* Bottom row: price + CTA */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
        <div>
          {shipment.total_cost != null ? (
            <>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
              <p className="text-base font-bold text-foreground">{fmtEur(Number(shipment.total_cost))}</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Devis en cours…</p>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-1.5 transition-all">
          Voir détails <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </motion.div>
  );
}
