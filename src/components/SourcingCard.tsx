import { motion } from 'framer-motion';
import {
  ArrowRight, Sparkles, ChevronRight, Hourglass, CheckCircle2,
  Wallet, Package as PackageIcon, ExternalLink,
} from 'lucide-react';
import {
  type Dossier, COUNTRY_FLAGS, COUNTRY_NAMES, DOSSIER_STATUS_LABELS,
} from '@/lib/types';

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const SOURCING_PROGRESS: Record<string, number> = {
  SUBMITTED: 0.1, IN_REVIEW: 0.22, SOURCING: 0.4, PROCURED: 0.6,
  IN_TRANSIT: 0.78, CUSTOMS: 0.9, DELIVERED: 1, CLOSED: 1,
};

function flagOf(c?: string | null) {
  if (!c) return '🌍';
  return (COUNTRY_FLAGS as Record<string, string>)[c.toUpperCase()] || '🌍';
}
function nameOf(c?: string | null) {
  if (!c) return '—';
  return (COUNTRY_NAMES as Record<string, string>)[c.toUpperCase()] || c;
}

export function SourcingCard({
  dossier,
  onClick,
}: { dossier: Dossier; onClick: () => void }) {
  const status = dossier.status;
  const progress = SOURCING_PROGRESS[status] ?? 0.1;
  const statusLabel = DOSSIER_STATUS_LABELS[status] ?? status;
  const isDelivered = status === 'DELIVERED' || status === 'CLOSED';
  const isPending = status === 'SUBMITTED' || status === 'IN_REVIEW';

  const tone =
    isDelivered ? 'text-emerald-500 bg-emerald-500/10'
    : isPending ? 'text-amber-500 bg-amber-500/10'
    : 'text-primary bg-primary/10';

  const description = (dossier.product_description ?? '').trim();
  const price = dossier.estimated_cost ?? dossier.budget_eur ?? null;
  const priceLabel = dossier.estimated_cost ? 'Estimation' : 'Budget';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`group w-full text-left rounded-2xl p-4 sm:p-5 border transition-all
        focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
        bg-card border-border hover:border-primary/40 hover:shadow-[0_4px_30px_-8px_hsl(var(--primary)/0.25)]
        ${isDelivered ? 'opacity-75 hover:opacity-100' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate">
              {dossier.reference}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md whitespace-nowrap ${tone}`}>
          {isPending && <Hourglass className="w-3 h-3" />}
          {isDelivered && <CheckCircle2 className="w-3 h-3" />}
          {statusLabel}
        </span>
      </div>

      {/* Product */}
      {description && (
        <p className="text-sm font-semibold text-foreground line-clamp-2 mb-3">
          {description}
        </p>
      )}

      {/* Route */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Origine</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-base">{flagOf(dossier.origin_country)}</span>
            <span className="text-sm font-semibold text-foreground truncate">
              {nameOf(dossier.origin_country)}
            </span>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <div className="min-w-0 text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Livraison</p>
          <div className="flex items-center gap-1.5 mt-0.5 justify-end">
            <span className="text-sm font-semibold text-foreground truncate">
              {nameOf(dossier.destination_country)}
            </span>
            <span className="text-base">{flagOf(dossier.destination_country)}</span>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            isDelivered ? 'bg-emerald-500' : 'bg-gradient-to-r from-primary to-primary/70'
          }`}
          style={{ width: `${Math.max(2, Math.round(progress * 100))}%` }}
        />
      </div>

      {/* Chips */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        {dossier.estimated_weight != null && (
          <Chip>
            <PackageIcon className="w-3.5 h-3.5" />
            {dossier.estimated_weight} kg
          </Chip>
        )}
        {dossier.supplier_name && (
          <Chip className="max-w-[10rem]">
            <span className="truncate">Fournisseur · {dossier.supplier_name}</span>
          </Chip>
        )}
        {dossier.konnekt_order_id && (
          <Chip>
            <ExternalLink className="w-3 h-3" />
            Konnekt
          </Chip>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
        <div>
          {price != null ? (
            <>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Wallet className="w-3 h-3" />
                {priceLabel}
              </p>
              <p className="text-base font-bold text-foreground">{fmtEur(price)}</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic">Devis en cours…</p>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-1.5 transition-all">
          Voir le dossier <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </motion.button>
  );
}

function Chip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-secondary/60 px-2 py-1 rounded-md ${className}`}>
      {children}
    </span>
  );
}
