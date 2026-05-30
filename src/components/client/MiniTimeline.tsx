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

export function MiniTimeline({ status }: { status: DossierStatus }) {
  const currentIdx = DOSSIER_STATUS_ORDER.indexOf(status);
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
