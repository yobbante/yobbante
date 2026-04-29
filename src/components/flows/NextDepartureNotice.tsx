import { useEffect, useMemo, useState } from 'react';
import { Sparkles, ShieldCheck, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDepartureCountdown, formatDepartureDate } from '@/lib/departureTime';

interface Props {
  date: string | null | undefined;
  /** Short trailing tag like "Suivi inclus" or "contrôle qualité inclus". */
  trailing?: string;
  className?: string;
}

/**
 * Unified "next departure" notice — used by SendFlow & SourcingFlow.
 * Shows the exact date (warehouse TZ), live countdown, and a discreet
 * urgency alert when departure is < 48h or < 24h away.
 *
 * Mobile-first: stacks vertically on small screens, inline on ≥sm.
 */
export function NextDepartureNotice({ date, trailing, className }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const countdown = useMemo(() => getDepartureCountdown(date, now), [date, now]);

  if (!date) return null;

  const urgency = countdown?.under24h
    ? { tone: 'warn' as const, icon: AlertTriangle, label: 'Départ dans moins de 24 h — confirmez vite pour réserver une place.' }
    : countdown?.under48h
      ? { tone: 'soft' as const, icon: Clock, label: 'Départ dans moins de 48 h — places limitées.' }
      : null;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>
            <span className="text-foreground font-medium">Prochain départ :</span>{' '}
            {formatDepartureDate(date)}
          </span>
        </span>
        {countdown && !countdown.isPast && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <span className="text-muted-foreground/40">·</span>
            <Clock className="w-3.5 h-3.5 shrink-0" />
            {countdown.label}
          </span>
        )}
        {trailing && (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-muted-foreground/40">·</span>
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            {trailing}
          </span>
        )}
      </div>

      {urgency && (
        <div
          role="status"
          className={cn(
            'flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] font-medium',
            urgency.tone === 'warn'
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : 'border-border bg-secondary/60 text-muted-foreground',
          )}
        >
          <urgency.icon className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span className="leading-snug">{urgency.label}</span>
        </div>
      )}
    </div>
  );
}
