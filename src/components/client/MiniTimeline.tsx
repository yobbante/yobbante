import { cn } from '@/lib/utils';
import { DOSSIER_STATUS_ORDER, type DossierStatus } from '@/lib/types';

/** Compact 5-dot timeline summarising dossier progress on a card. */
const STEPS: { key: DossierStatus; label: string }[] = [
  { key: 'SUBMITTED',  label: 'Nouveau' },
  { key: 'IN_REVIEW',  label: 'Confirmé' },
  { key: 'PROCURED',   label: 'Collecté' },
  { key: 'IN_TRANSIT', label: 'Transit' },
  { key: 'DELIVERED',  label: 'Livré' },
];

/**
 * Rang de progression pour TOUS les statuts dossier (y compris ceux hors du
 * pipeline "sourcing" : ASSIGNED, COLLECTED, WEIGHED…). Sans cette table, un
 * statut inconnu retombait à -1 et la timeline paraissait remise à zéro.
 */
const STATUS_RANK: Record<string, number> = {
  QUOTE_REQUESTED: 0, QUOTE_SENT: 0, QUOTE_REFUSED: 0, QUOTE_ACCEPTED: 1,
  SUBMITTED: 0, STALE: 0, AWAITING_CLIENT: 0,
  IN_REVIEW: 1, CONFIRMED: 1, EN_RECHERCHE_DEPART: 1,
  SOURCING: 2, ASSIGNED: 2, DEPARTURE_CONFIRMED: 2, COLLECTING: 2,
  PROCURED: 3, COLLECTED: 3, WEIGHED: 3,
  IN_TRANSIT: 4,
  CUSTOMS: 5, ARRIVED_HUB: 5, OUT_FOR_DELIVERY: 5,
  DELIVERED: 6, CLOSED: 7, ARCHIVED: 7,
  // États terminaux hors pipeline : on fige au stade transit atteint.
  CANCELLED: 0, RETURN_REQUESTED: 4, RETURN_IN_PROGRESS: 4, RETURNED: 4,
};

export function MiniTimeline({ status }: { status: DossierStatus }) {
  const currentIdx = STATUS_RANK[status] ?? DOSSIER_STATUS_ORDER.indexOf(status);

  return (
    <div className="flex items-center gap-1.5 w-full">
      {STEPS.map((step, i) => {
        const stepIdx = DOSSIER_STATUS_ORDER.indexOf(step.key);
        const reached = currentIdx >= stepIdx;
        const isLast = i === STEPS.length - 1;
        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1 min-w-0">
              <span
                className={cn(
                  'h-2 w-2 rounded-full transition-colors',
                  reached ? 'bg-[#F5C518]' : 'bg-border',
                )}
              />
              <span
                className={cn(
                  'text-[9px] uppercase tracking-wider truncate',
                  reached ? 'text-foreground' : 'text-muted-foreground/60',
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={cn(
                  'flex-1 h-px mx-1 -mt-3',
                  reached && currentIdx > stepIdx ? 'bg-[#F5C518]/60' : 'bg-border',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
