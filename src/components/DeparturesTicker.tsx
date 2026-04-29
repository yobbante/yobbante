import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Ship, Truck, Radio, Database, FlaskConical, Pause, Play } from 'lucide-react';
import { useDepartures } from '@/hooks/useDepartures';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type Departure = {
  id: string;
  origin_country: string;
  origin_city: string;
  destination_country: string;
  destination_city: string;
  departure_date: string;
  transport: 'AIR' | 'SEA' | 'ROAD';
};

const FLAG: Record<string, string> = {
  CN: '🇨🇳', FR: '🇫🇷', US: '🇺🇸', CA: '🇨🇦', AE: '🇦🇪', DE: '🇩🇪',
  SN: '🇸🇳', CI: '🇨🇮', ML: '🇲🇱', CM: '🇨🇲', BF: '🇧🇫', GN: '🇬🇳',
  TG: '🇹🇬', BJ: '🇧🇯', GA: '🇬🇦', CG: '🇨🇬',
};

const TRANSPORT_ICON = { AIR: Plane, SEA: Ship, ROAD: Truck } as const;

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function dedupKey(d: Departure): string {
  return `${d.origin_country.toUpperCase()}|${d.destination_country.toUpperCase()}|${d.departure_date.slice(0, 10)}|${d.transport}`;
}

function dedupClient(list: Departure[]): Departure[] {
  const seen = new Set<string>();
  const out: Departure[] = [];
  for (const d of list) {
    const k = dedupKey(d);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(d);
  }
  return out;
}

function formatAge(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'à l’instant';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  return `${days}j`;
}

function SourceBadge({
  source,
  authed,
  lkgUpdatedAt,
  generatedAt,
}: {
  source: 'konnekt' | 'cache' | 'mock';
  authed: boolean;
  lkgUpdatedAt: string | null;
  generatedAt: string | null;
}) {
  const cfg = {
    konnekt: {
      Icon: Radio,
      label: 'Live',
      className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      tip: `Données live depuis Konnekt${authed ? ' (partenaire authentifié)' : ''}.${
        generatedAt ? ` Reçues il y a ${formatAge(generatedAt)}.` : ''
      }`,
    },
    cache: {
      Icon: Database,
      label: lkgUpdatedAt ? `LKG ${formatAge(lkgUpdatedAt)}` : 'LKG',
      className: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      tip: `Konnekt indisponible — affichage du dernier snapshot valide${
        lkgUpdatedAt ? ` datant de ${formatAge(lkgUpdatedAt)}` : ''
      }.`,
    },
    mock: {
      Icon: FlaskConical,
      label: 'Démo',
      className: 'text-muted-foreground bg-muted/40 border-border',
      tip: 'Données de démonstration — Konnekt non connecté ou aucun snapshot disponible.',
    },
  }[source];
  const { Icon, label, className, tip } = cfg;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border cursor-help',
              className,
            )}
          >
            <Icon className="w-2.5 h-2.5" />
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function DeparturesTicker() {
  const navigate = useNavigate();
  const { data, isLoading } = useDepartures();
  const [paused, setPaused] = useState(false);

  const departures = useMemo(
    () => dedupClient((data?.departures || []) as Departure[]),
    [data?.departures],
  );

  if (isLoading || !departures.length) {
    return (
      <div className="border-y border-border bg-card/50 backdrop-blur-sm">
        <div className="h-9 sm:h-10 flex items-center px-3 sm:px-4">
          <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground">
            Chargement des prochains départs…
          </span>
        </div>
      </div>
    );
  }

  const source: 'konnekt' | 'cache' | 'mock' = data?.source || 'mock';
  const items = [...departures, ...departures];

  const handleFollow = (d: Departure) => {
    // Pre-fill SendFlow with full departure context (origin, destination,
    // transport, date) so the user never has to re-enter destination.
    navigate('/expedier/envoyer', {
      state: {
        preset: {
          type: 'package',
          origin: d.origin_country,
          destination: d.destination_country,
          origin_city: d.origin_city,
          destination_city: d.destination_city,
          transport: d.transport,
          departure_date: d.departure_date,
          source: 'departures-ticker',
        },
      },
    });
  };

  return (
    <div className="relative border-y border-border bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Edge fades — narrower on mobile */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 sm:w-16 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 sm:w-16 bg-gradient-to-l from-background to-transparent z-10" />

      <div className="flex items-center gap-2 sm:gap-3 py-2 sm:py-2.5">
        {/* Label — compact on mobile */}
        <span className="shrink-0 ml-3 sm:ml-4 inline-flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="hidden xs:inline sm:inline">Prochains départs</span>
          <span className="xs:hidden sm:hidden">Départs</span>
          <span className="hidden sm:inline-flex">
            <SourceBadge
              source={source}
              authed={Boolean(data?.partner_authenticated)}
              lkgUpdatedAt={data?.lkg_updated_at ?? null}
              generatedAt={data?.generated_at ?? null}
            />
          </span>
        </span>

        {/* Pause/Play — only visible on touch devices via hover-less UX */}
        <button
          type="button"
          onClick={() => setPaused(p => !p)}
          aria-label={paused ? 'Reprendre le défilement' : 'Mettre en pause'}
          className="shrink-0 sm:hidden inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted/40 border border-border text-muted-foreground active:scale-95 transition-transform z-20"
        >
          {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
        </button>

        <div
          className="flex-1 overflow-hidden"
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        >
          <div
            className={cn(
              'flex w-max gap-4 sm:gap-6 animate-marquee whitespace-nowrap will-change-transform',
              paused && '[animation-play-state:paused]',
            )}
          >
            {items.map((d, i) => {
              const Icon = TRANSPORT_ICON[d.transport];
              return (
                <button
                  key={`${d.id}-${i}`}
                  type="button"
                  onClick={() => handleFollow(d)}
                  className="group inline-flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-foreground px-2 sm:px-2.5 py-1.5 sm:py-1 rounded-full hover:bg-primary/10 active:bg-primary/15 hover:text-primary transition-colors min-h-[32px]"
                  title={`Suivre ce départ vers ${d.destination_city}`}
                >
                  <span className="text-sm sm:text-base leading-none">{FLAG[d.origin_country] || '🌍'}</span>
                  <span className="font-medium">{d.origin_city}</span>
                  <span className="text-muted-foreground group-hover:text-primary">→</span>
                  <span className="text-sm sm:text-base leading-none">{FLAG[d.destination_country] || '🌍'}</span>
                  <span className="font-medium">{d.destination_city}</span>
                  <span className="text-muted-foreground group-hover:text-primary hidden sm:inline">·</span>
                  <Icon className="w-3 h-3 text-primary" />
                  <span className="text-muted-foreground group-hover:text-primary">{fmtDate(d.departure_date)}</span>
                  <span className="hidden sm:inline ml-1 text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity text-primary">
                    Suivre →
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
