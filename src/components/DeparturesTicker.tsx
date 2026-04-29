import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Ship, Truck, Radio, Database, FlaskConical } from 'lucide-react';
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

// Same dedup key as the edge function: origin|destination|date|transport
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
      label: 'Konnekt live',
      className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      tip: `Données live depuis Konnekt${authed ? ' (partenaire authentifié)' : ''}.${
        generatedAt ? ` Reçues il y a ${formatAge(generatedAt)}.` : ''
      }`,
    },
    cache: {
      Icon: Database,
      label: lkgUpdatedAt ? `LKG · ${formatAge(lkgUpdatedAt)}` : 'LKG',
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

  const departures = useMemo(
    () => dedupClient((data?.departures || []) as Departure[]),
    [data?.departures],
  );

  if (isLoading || !departures.length) {
    return (
      <div className="border-y border-border bg-card/50 backdrop-blur-sm">
        <div className="h-10 flex items-center px-4">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Chargement des prochains départs…
          </span>
        </div>
      </div>
    );
  }

  const source: 'konnekt' | 'cache' | 'mock' = data?.source || 'mock';
  const items = [...departures, ...departures];

  const handleFollow = (d: Departure) => {
    // Pre-fill the SendFlow with this departure's origin & destination so the
    // user doesn't need to re-enter them. SendFlow reads `location.state.preset`.
    navigate('/expedier/envoyer', {
      state: {
        preset: {
          type: 'package',
          origin: d.origin_country,
          destination: d.destination_country,
        },
      },
    });
  };

  return (
    <div className="relative border-y border-border bg-card/50 backdrop-blur-sm overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent z-10" />

      <div className="flex items-center gap-3 py-2.5">
        <span className="shrink-0 ml-4 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Prochains départs
          <SourceBadge
            source={source}
            authed={Boolean(data?.partner_authenticated)}
            lkgUpdatedAt={data?.lkg_updated_at ?? null}
            generatedAt={data?.generated_at ?? null}
          />
        </span>

        <div className="flex-1 overflow-hidden">
          <div className="flex gap-6 animate-marquee whitespace-nowrap will-change-transform">
            {items.map((d, i) => {
              const Icon = TRANSPORT_ICON[d.transport];
              return (
                <button
                  key={`${d.id}-${i}`}
                  type="button"
                  onClick={() => handleFollow(d)}
                  className="group inline-flex items-center gap-2 text-xs text-foreground px-2.5 py-1 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                  title={`Suivre ce départ vers ${d.destination_city}`}
                >
                  <span className="text-base leading-none">{FLAG[d.origin_country] || '🌍'}</span>
                  <span className="font-medium">{d.origin_city}</span>
                  <span className="text-muted-foreground group-hover:text-primary">→</span>
                  <span className="text-base leading-none">{FLAG[d.destination_country] || '🌍'}</span>
                  <span className="font-medium">{d.destination_city}</span>
                  <span className="text-muted-foreground group-hover:text-primary">·</span>
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
