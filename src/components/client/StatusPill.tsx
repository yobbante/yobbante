import type { DossierStatus } from '@/lib/types';
import { DOSSIER_STATUS_LABELS } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Coloured status pill used on the client-side dashboard.
 * Maps real dossier_status enum + a few "virtual" intermediate states
 * to a palette the spec describes (NEW/CONFIRMED/ASSIGNED/.../DELIVERED).
 */
type ExtendedStatus =
  | DossierStatus
  | 'NEW' | 'CONFIRMED' | 'ASSIGNED' | 'COLLECTED' | 'WEIGHED'
  | 'ARRIVED_HUB' | 'OUT_FOR_DELIVERY';

const PALETTE: Record<string, { bg: string; fg: string; pulse?: boolean; label?: string }> = {
  // Real enum
  SUBMITTED:     { bg: 'bg-zinc-700/40',  fg: 'text-zinc-200',  label: 'Nouveau' },
  IN_REVIEW:     { bg: 'bg-blue-500/15',  fg: 'text-blue-300',  label: 'Confirmé' },
  SOURCING:      { bg: 'bg-blue-500/15',  fg: 'text-blue-300',  label: 'Sourcing' },
  PROCURED:      { bg: 'bg-orange-500/15',fg: 'text-orange-300',label: 'Collecté' },
  IN_TRANSIT:    { bg: 'bg-green-500/15', fg: 'text-green-300', label: 'En transit', pulse: true },
  CUSTOMS:       { bg: 'bg-green-600/15', fg: 'text-green-300', label: 'Douane' },
  DELIVERED:     { bg: 'bg-green-700/25', fg: 'text-green-200', label: 'Livré' },
  CLOSED:        { bg: 'bg-zinc-700/40',  fg: 'text-zinc-300',  label: 'Clôturé' },
  // Virtual / future
  NEW:           { bg: 'bg-zinc-700/40',  fg: 'text-zinc-200',  label: 'Nouveau' },
  CONFIRMED:     { bg: 'bg-blue-500/15',  fg: 'text-blue-300',  label: 'Confirmé' },
  ASSIGNED:      { bg: 'bg-blue-500/15',  fg: 'text-blue-300',  label: 'Assigné' },
  COLLECTED:     { bg: 'bg-orange-500/15',fg: 'text-orange-300',label: 'Collecté' },
  WEIGHED:       { bg: 'bg-orange-500/15',fg: 'text-orange-300',label: 'Pesé' },
  ARRIVED_HUB:   { bg: 'bg-green-500/15', fg: 'text-green-300', label: 'Arrivé au hub' },
  OUT_FOR_DELIVERY: { bg: 'bg-green-500/15', fg: 'text-green-300', label: 'En livraison', pulse: true },
};

export function StatusPill({ status, className }: { status: ExtendedStatus; className?: string }) {
  const cfg = PALETTE[status] ?? PALETTE.SUBMITTED;
  const label = cfg.label ?? DOSSIER_STATUS_LABELS[status as DossierStatus] ?? status;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold',
        cfg.bg, cfg.fg, className,
      )}
    >
      {cfg.pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-60 animate-ping" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
      )}
      {label}
    </span>
  );
}
