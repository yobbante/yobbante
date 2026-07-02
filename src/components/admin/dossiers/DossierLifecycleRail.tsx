/**
 * Mini rail visualisant l'avancement d'un dossier dans son lifecycle
 * (Soumis → Analyse → Sourcing → Transit → Douane → Livré) avec branche
 * dédiée en cas d'annulation ou de retour.
 */
import { Check, XCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LIFECYCLE_BADGE, RETURN_FLOW_STATUSES } from '@/lib/dossierLifecycle';

const MAIN_STOPS = [
  { id: 'SUBMITTED',  label: 'Soumis' },
  { id: 'IN_REVIEW',  label: 'Analyse' },
  { id: 'SOURCING',   label: 'Sourcing' },
  { id: 'IN_TRANSIT', label: 'Transit' },
  { id: 'CUSTOMS',    label: 'Douane' },
  { id: 'DELIVERED',  label: 'Livré' },
];

// Buckets that indicate "past" each stop
const REACHED: Record<string, string[]> = {
  SUBMITTED:  ['SUBMITTED', 'AWAITING_CLIENT', 'CONFIRMED', 'IN_REVIEW', 'SOURCING', 'PROCURED', 'IN_TRANSIT', 'CUSTOMS', 'ARRIVED_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CLOSED'],
  IN_REVIEW:  ['IN_REVIEW', 'SOURCING', 'PROCURED', 'ASSIGNED', 'IN_TRANSIT', 'CUSTOMS', 'ARRIVED_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CLOSED'],
  SOURCING:   ['SOURCING', 'PROCURED', 'IN_TRANSIT', 'CUSTOMS', 'ARRIVED_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CLOSED'],
  IN_TRANSIT: ['IN_TRANSIT', 'CUSTOMS', 'ARRIVED_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CLOSED'],
  CUSTOMS:    ['CUSTOMS', 'ARRIVED_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CLOSED'],
  DELIVERED:  ['DELIVERED', 'CLOSED'],
};

function currentIndex(status: string) {
  for (let i = MAIN_STOPS.length - 1; i >= 0; i--) {
    if (REACHED[MAIN_STOPS[i].id].includes(status)) return i;
  }
  return 0;
}

export function DossierLifecycleRail({
  status,
  size = 'md',
  className,
}: {
  status: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  // Branche annulation / retour : rail spécial 3 stops
  if (status === 'CANCELLED') {
    return (
      <div className={cn('flex items-center gap-2 text-[10px] font-medium text-red-500', className)}>
        <XCircle className="w-3.5 h-3.5" />
        <span className="uppercase tracking-wider">Annulé — flux stoppé</span>
        <div className="flex-1 h-1 rounded-full bg-red-500/20 overflow-hidden">
          <div className="h-full bg-red-500 animate-rail-fill origin-left" />
        </div>
      </div>
    );
  }

  if (RETURN_FLOW_STATUSES.has(status)) {
    const stops = [
      { id: 'RETURN_REQUESTED',   label: 'Demandé' },
      { id: 'RETURN_IN_PROGRESS', label: 'En cours' },
      { id: 'RETURNED',           label: 'Retourné' },
    ];
    const idx = stops.findIndex(s => s.id === status);
    const tone = LIFECYCLE_BADGE[status];
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <RotateCcw className={cn('w-3.5 h-3.5', 'text-orange-500')} />
        <div className="flex-1 flex items-center gap-1">
          {stops.map((s, i) => (
            <div key={s.id} className="flex-1 flex items-center gap-1">
              <div
                className={cn(
                  'flex-1 h-1 rounded-full transition-colors duration-500',
                  i <= idx ? tone.dot : 'bg-orange-500/15',
                )}
              />
              {i < stops.length - 1 && <div className="w-0.5" />}
            </div>
          ))}
        </div>
        <span className={cn('text-[10px] font-semibold uppercase tracking-wider', tone.tone.split(' ')[1])}>
          {tone.label}
        </span>
      </div>
    );
  }

  const idx = currentIndex(status);
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';
  const barH = size === 'sm' ? 'h-0.5' : 'h-1';

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {MAIN_STOPS.map((s, i) => {
        const reached = i <= idx;
        const current = i === idx;
        return (
          <div key={s.id} className="flex-1 flex items-center gap-1 group">
            <div className="flex flex-col items-center gap-0.5 relative">
              <div
                title={s.label}
                className={cn(
                  'rounded-full transition-all duration-500',
                  dotSize,
                  reached ? 'bg-primary' : 'bg-muted-foreground/25',
                  current && 'ring-2 ring-primary/40 scale-125 animate-glow-pulse',
                )}
              />
            </div>
            {i < MAIN_STOPS.length - 1 && (
              <div className={cn('flex-1 rounded-full overflow-hidden bg-muted-foreground/15', barH)}>
                <div
                  className={cn(
                    'h-full bg-primary origin-left',
                    reached && i < idx ? 'animate-rail-fill' : 'scale-x-0',
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
      {status === 'CLOSED' && <Check className="w-3 h-3 text-primary ml-1" />}
    </div>
  );
}
