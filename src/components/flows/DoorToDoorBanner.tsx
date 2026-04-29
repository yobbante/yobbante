import { CheckCircle2, AlertTriangle, Info, PackageCheck } from 'lucide-react';
import {
  DOOR_TO_DOOR_TAGLINE,
  DOOR_TO_DOOR_HEADLINE,
  INCLUDED_PERKS,
  DOOR_TO_DOOR_EXCEPTIONS,
  type CoverageCheck,
} from '@/lib/doorToDoor';

interface Props {
  origin?: CoverageCheck;
  destination?: CoverageCheck;
  /** When true (recap/payment), show the full "Ce qui est inclus" section. */
  detailed?: boolean;
  /** Tone — 'subtle' for inline use on cards, 'card' for boxed display. */
  variant?: 'subtle' | 'card';
}

/**
 * Centralized banner that communicates the door-to-door promise
 * and surfaces any zone exceptions detected for the chosen addresses.
 */
export function DoorToDoorBanner({
  origin,
  destination,
  detailed = false,
  variant = 'card',
}: Props) {
  const checks = [origin, destination].filter(Boolean) as CoverageCheck[];
  const worstAvailability =
    checks.find(c => c.availability === 'unavailable')?.availability ??
    checks.find(c => c.availability === 'partner')?.availability ??
    'direct';

  const tone =
    worstAvailability === 'unavailable'
      ? {
          border: 'border-amber-500/40',
          bg: 'bg-amber-500/5',
          text: 'text-amber-700 dark:text-amber-300',
          Icon: AlertTriangle,
        }
      : worstAvailability === 'partner'
      ? {
          border: 'border-sky-500/30',
          bg: 'bg-sky-500/5',
          text: 'text-sky-700 dark:text-sky-300',
          Icon: Info,
        }
      : {
          border: 'border-emerald-500/30',
          bg: 'bg-emerald-500/5',
          text: 'text-emerald-700 dark:text-emerald-300',
          Icon: CheckCircle2,
        };

  if (variant === 'subtle' && !detailed) {
    return (
      <div
        className={`rounded-xl border ${tone.border} ${tone.bg} px-3 py-2 text-[11px] ${tone.text} flex items-start gap-2`}
      >
        <tone.Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          <strong>{DOOR_TO_DOOR_TAGLINE}</strong> — {DOOR_TO_DOOR_HEADLINE}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border ${tone.border} ${tone.bg} p-4 sm:p-5 space-y-3`}
    >
      <div className={`flex items-start gap-2 text-sm ${tone.text}`}>
        <tone.Icon className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-semibold">{DOOR_TO_DOOR_TAGLINE}</p>
          <p className="text-[12px] opacity-90">{DOOR_TO_DOOR_HEADLINE}</p>
        </div>
      </div>

      {detailed && (
        <>
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <PackageCheck className="w-3.5 h-3.5" /> Ce qui est inclus
            </p>
            <ul className="space-y-1 text-xs text-foreground">
              {INCLUDED_PERKS.map(p => (
                <li key={p} className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>

          {checks.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Vérification de votre zone
              </p>
              <ul className="space-y-1.5 text-xs">
                {origin && (
                  <CoverageLine label="Enlèvement" check={origin} />
                )}
                {destination && (
                  <CoverageLine label="Livraison" check={destination} />
                )}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Exceptions / non inclus
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {DOOR_TO_DOOR_EXCEPTIONS.map(p => (
                <li key={p} className="flex items-start gap-1.5">
                  <span className="mt-1 w-1 h-1 rounded-full bg-current opacity-60 shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function CoverageLine({ label, check }: { label: string; check: CoverageCheck }) {
  const ok = check.availability !== 'unavailable';
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  return (
    <li className="flex items-start gap-1.5">
      <Icon
        className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
          ok ? 'text-emerald-500' : 'text-amber-500'
        }`}
      />
      <div className="min-w-0">
        <span className="font-medium">{label} :</span>{' '}
        <span className="text-muted-foreground">{check.message}</span>
        {check.alternative && (
          <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">
            ↳ {check.alternative}
          </p>
        )}
      </div>
    </li>
  );
}
