import { Luggage, Plane, Ship, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Sélecteur de mode de transport — PREMIÈRE question du parcours "Envoyer un colis".
 *
 * 4 modes, dans l'ordre :
 *  - gp    : bagage accompagné (opérationnel, présélectionné) — ex-"Aérien"
 *  - air   : fret aérien classique (bientôt disponible)
 *  - sea   : maritime (bientôt disponible)
 *  - road  : Terminal D (opérationnel, page dédiée /terminal-d)
 */
export type SendTransportMode = 'gp' | 'air' | 'sea' | 'road';

export const SEND_TRANSPORT_MODES: {
  id: SendTransportMode;
  label: string;
  desc: string;
  Icon: typeof Plane;
  status: 'live' | 'soon';
}[] = [
  { id: 'gp',   label: 'GP',       desc: 'Bagage accompagné · 3-7j', Icon: Luggage, status: 'live' },
  { id: 'air',  label: 'Aérien',   desc: 'Fret classique',           Icon: Plane,   status: 'soon' },
  { id: 'sea',  label: 'Maritime', desc: 'Conteneur / LCL',          Icon: Ship,    status: 'soon' },
  { id: 'road', label: 'Routier',  desc: 'Terminal D',               Icon: Truck,   status: 'live' },
];

export const isModeSoon = (m: SendTransportMode, liveModes?: SendTransportMode[]) =>
  liveModes?.includes(m)
    ? false
    : SEND_TRANSPORT_MODES.find(x => x.id === m)?.status === 'soon';

interface Props {
  value: SendTransportMode;
  onChange: (m: SendTransportMode) => void;
  /** dark theme variant (used inside the /expedier sticky bar in dark mode) */
  dark?: boolean;
  className?: string;
  /** Modes forcés "opérationnels" (ex : aérien ouvert côté admin pour les tests). */
  liveModes?: SendTransportMode[];
}

export function TransportModeSelector({ value, onChange, dark = false, className, liveModes }: Props) {

  return (
    <div className={className}>
      <div
        className={cn(
          'text-[10px] uppercase tracking-[0.18em] mb-1.5 font-medium',
          dark ? 'text-yellow-400/80' : 'text-muted-foreground',
        )}
      >
        Mode de transport
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5" role="radiogroup" aria-label="Mode de transport">
        {SEND_TRANSPORT_MODES.map(m => {
          const active = value === m.id;
          const soon = isModeSoon(m.id, liveModes);

          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(m.id)}
              className={cn(
                'relative text-left rounded-lg border px-2.5 py-2 transition-all min-w-0',
                active
                  ? dark
                    ? 'bg-yellow-400 text-zinc-950 border-yellow-400'
                    : 'bg-foreground text-background border-foreground'
                  : dark
                    ? 'border-white/10 text-white/70 hover:border-white/30'
                    : 'border-border text-muted-foreground hover:border-foreground/40',
                soon && !active && 'opacity-70',
              )}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <m.Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[12.5px] font-semibold truncate">{m.label}</span>
              </div>
              <div className={cn('text-[10px] mt-0.5 truncate', active ? 'opacity-70' : 'opacity-80')}>
                {soon ? 'Bientôt disponible' : m.desc}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Encart affiché quand un mode non opérationnel est sélectionné. */
export function ModeSoonNotice({ mode, dark = false }: { mode: SendTransportMode; dark?: boolean }) {
  const label = SEND_TRANSPORT_MODES.find(m => m.id === mode)?.label ?? '';
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 text-[12px] leading-relaxed',
        dark ? 'border-yellow-400/30 bg-yellow-400/10 text-white/85' : 'border-border bg-secondary text-foreground',
      )}
      role="status"
    >
      <strong className="font-semibold">{label} — bientôt disponible.</strong>{' '}
      Ce service n'est pas encore ouvert. En attendant, choisissez <strong>GP</strong> (bagage accompagné) ou{' '}
      <a
        href="https://wa.me/221784604003"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 font-medium"
      >
        contactez-nous sur WhatsApp
      </a>.
    </div>
  );
}
