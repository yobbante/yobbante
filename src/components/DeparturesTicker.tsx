import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plane, Ship, Truck, Radio, Database, FlaskConical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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

type DeparturesResponse = {
  departures: Departure[];
  source?: 'konnekt' | 'cache' | 'mock';
  count?: number;
  lkg_updated_at?: string | null;
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

function dedupClient(list: Departure[]): Departure[] {
  const seen = new Set<string>();
  const out: Departure[] = [];
  for (const d of list) {
    const k = `${d.origin_country}|${d.destination_country}|${d.departure_date}|${d.transport}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(d);
  }
  return out;
}

function SourceBadge({ source }: { source: 'konnekt' | 'cache' | 'mock' }) {
  const cfg = {
    konnekt: { Icon: Radio,        label: 'Konnekt',  className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
    cache:   { Icon: Database,     label: 'Cache',    className: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
    mock:    { Icon: FlaskConical, label: 'Mock',     className: 'text-muted-foreground bg-muted/40 border-border' },
  }[source];
  const { Icon, label, className } = cfg;
  return (
    <span
      title={
        source === 'konnekt' ? 'Données live depuis Konnekt' :
        source === 'cache'   ? 'Dernier snapshot Konnekt valide (Konnekt indisponible)' :
                               'Données de démonstration — Konnekt non connecté'
      }
      className={cn(
        'inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border',
        className,
      )}
    >
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

export function DeparturesTicker() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['public-departures'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('list-departures');
      if (error) throw error;
      return data as DeparturesResponse;
    },
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const departures = useMemo(
    () => dedupClient(data?.departures || []),
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

  const handleFollow = async (d: Departure) => {
    const qs = `view=shipments&destination=${d.destination_country}&origin=${d.origin_country}`;
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      navigate(`/app?${qs}`);
    } else {
      navigate(`/auth?next=${encodeURIComponent(`/app?${qs}`)}`);
    }
  };

  return (
    <div className="relative border-y border-border bg-card/50 backdrop-blur-sm overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent z-10" />

      <div className="flex items-center gap-3 py-2.5">
        <span className="shrink-0 ml-4 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Prochains départs
          <SourceBadge source={source} />
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
