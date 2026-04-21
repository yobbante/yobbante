import { useQuery } from '@tanstack/react-query';
import { Plane, Ship, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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

export function DeparturesTicker() {
  const { data, isLoading } = useQuery({
    queryKey: ['public-departures'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('list-departures');
      if (error) throw error;
      return data as { departures: Departure[] };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading || !data?.departures?.length) {
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

  // Duplicate the list so the marquee loops seamlessly
  const items = [...data.departures, ...data.departures];

  return (
    <div className="relative border-y border-border bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent z-10" />

      <div className="flex items-center gap-3 py-2.5">
        <span className="shrink-0 ml-4 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Prochains départs
        </span>

        <div className="flex-1 overflow-hidden">
          <div className="flex gap-8 animate-marquee whitespace-nowrap will-change-transform">
            {items.map((d, i) => {
              const Icon = TRANSPORT_ICON[d.transport];
              return (
                <div
                  key={`${d.id}-${i}`}
                  className="inline-flex items-center gap-2 text-xs text-foreground"
                >
                  <span className="text-base leading-none">{FLAG[d.origin_country] || '🌍'}</span>
                  <span className="font-medium">{d.origin_city}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-base leading-none">{FLAG[d.destination_country] || '🌍'}</span>
                  <span className="font-medium">{d.destination_city}</span>
                  <span className="text-muted-foreground">·</span>
                  <Icon className="w-3 h-3 text-primary" />
                  <span className="text-muted-foreground">{fmtDate(d.departure_date)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
