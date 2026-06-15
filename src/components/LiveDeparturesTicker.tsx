import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type TickerItem = {
  ville_depart: string;
  ville_arrivee: string;
  date_depart: string;
  mode_transport: string;
  transporteur: string;
};

const FALLBACK_TEXT = 'FRANCE · SÉNÉGAL · USA · MAROC · DUBAI · CHINE';

function formatMode(m?: string | null): string {
  const v = (m || '').toLowerCase();
  if (v.includes('air') || v === 'aérien' || v === 'aerien') return 'Aérien';
  if (v.includes('sea') || v.includes('mar')) return 'Maritime';
  if (v.includes('express') || v.includes('road') || v.includes('rout')) return 'Express';
  return m || 'Aérien';
}

function formatDate(iso: string): string {
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

async function fetchTickerDepartures(): Promise<TickerItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const items: TickerItem[] = [];

  // Toutes les sources sont anonymisées côté client : on n'expose ni le nom
  // du GP ni la plateforme source (cf. Correction 1).
  try {
    const { data: manual } = await supabase
      .from('public_active_departures' as any)
      .select('origin_city, destination_city, departure_date, transport_mode')
      .gte('departure_date', today)
      .order('departure_date', { ascending: true })
      .limit(20);
    if (manual?.length) {
      for (const m of manual as any[]) {
        items.push({
          ville_depart: m.origin_city,
          ville_arrivee: m.destination_city,
          date_depart: m.departure_date,
          mode_transport: m.transport_mode,
          transporteur: 'Yobbanté',
        });
      }
    }
  } catch { /* skip silently */ }

  try {
    const { data: konnekt } = await supabase
      .from('konnekt_departures')
      .select('origin_city, destination_city, departure_date, transport, status')
      .gte('departure_date', today)
      .in('status', ['OPEN', 'active'])
      .order('departure_date', { ascending: true })
      .limit(20);
    if (konnekt) {
      for (const k of konnekt) {
        items.push({
          ville_depart: k.origin_city,
          ville_arrivee: k.destination_city,
          date_depart: k.departure_date,
          mode_transport: k.transport,
          transporteur: 'Yobbanté',
        });
      }
    }
  } catch { /* skip silently */ }

  try {
    const { data: live } = await supabase.functions.invoke('list-departures');
    const deps = (live as any)?.departures as Array<any> | undefined;
    if (Array.isArray(deps)) {
      for (const k of deps) {
        if (!k?.departure_date || k.departure_date < today) continue;
        items.push({
          ville_depart: k.origin_city,
          ville_arrivee: k.destination_city,
          date_depart: k.departure_date,
          mode_transport: k.transport,
          transporteur: 'Yobbanté',
        });
      }
    }
  } catch { /* skip silently */ }

  // Dedup by route + date + mode
  const seen = new Set<string>();
  const dedup: TickerItem[] = [];
  for (const it of items) {
    const key = `${it.ville_depart}|${it.ville_arrivee}|${it.date_depart}|${it.mode_transport}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(it);
  }
  items.length = 0;
  items.push(...dedup);

  return items
    .sort((a, b) => a.date_depart.localeCompare(b.date_depart))
    .slice(0, 20);
}

export function LiveDeparturesTicker() {
  const { data } = useQuery({
    queryKey: ['live-departures-ticker'],
    queryFn: fetchTickerDepartures,
    refetchInterval: 300_000,
    staleTime: 60_000,
  });

  const items = data ?? [];
  const hasItems = items.length > 0;

  const sep = (
    <span
      style={{
        fontFamily: '"DM Mono", ui-monospace, monospace',
        color: '#8A8A8A',
        margin: '0 24px',
      }}
    >
      ·····
    </span>
  );

  const renderedItems = hasItems
    ? items.map((d, i) => (
        <span
          key={i}
          style={{
            fontFamily: '"DM Mono", ui-monospace, monospace',
            color: '#E5E5E5',
            display: 'inline-flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#1D9E75',
              display: 'inline-block',
              marginRight: 6,
            }}
          />
          {d.ville_depart}
          <span style={{ color: '#F5C518', margin: '0 6px' }}>→</span>
          {d.ville_arrivee}
          <span style={{ color: '#8A8A8A', margin: '0 8px' }}>·</span>
          {formatDate(d.date_depart)}
          <span style={{ color: '#8A8A8A', margin: '0 8px' }}>·</span>
          {formatMode(d.mode_transport)}
        </span>
      ))
    : [
        <span
          key="fallback"
          style={{
            fontFamily: '"DM Mono", ui-monospace, monospace',
            color: '#E5E5E5',
            whiteSpace: 'nowrap',
          }}
        >
          {FALLBACK_TEXT}
        </span>,
      ];

  // Build a track that contains items separated by `sep`, duplicated for seamless loop
  const buildTrack = (key: string) => (
    <div
      key={key}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        paddingRight: 48,
        flexShrink: 0,
      }}
    >
      {renderedItems.map((node, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
          {node}
          {i < renderedItems.length - 1 && sep}
        </span>
      ))}
      {renderedItems.length > 1 && sep}
    </div>
  );

  return (
    <div
      className="w-full"
      style={{
        height: 32,
        background: '#0F0F0F',
        borderBottom: '0.5px solid #1E1E1E',
        zIndex: 49,
        display: 'flex',
        alignItems: 'center',
      }}
      aria-label="Prochains départs"
    >
      <span
        style={{
          fontFamily: '"DM Mono", ui-monospace, monospace',
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          color: '#B0B0B0',
          paddingLeft: 16,
          paddingRight: 12,
          borderRight: '0.5px solid #1E1E1E',
          height: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        Prochains départs
      </span>

      <div
        className="ticker-scroll-zone"
        style={{
          flex: 1,
          overflow: 'hidden',
          height: '100%',
          position: 'relative',
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0%, #000 5%, #000 95%, transparent 100%)',
          maskImage:
            'linear-gradient(to right, transparent 0%, #000 5%, #000 95%, transparent 100%)',
        }}
      >
        <div
          className="ticker-track"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: '100%',
            fontSize: 12,
            animation: hasItems
              ? 'ticker-scroll 40s linear infinite'
              : 'ticker-scroll 60s linear infinite',
            whiteSpace: 'nowrap',
            willChange: 'transform',
          }}
        >
          {buildTrack('a')}
          {buildTrack('b')}
        </div>
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-scroll-zone:hover .ticker-track {
          animation-play-state: paused !important;
        }
        @media (max-width: 640px) {
          .ticker-track { font-size: 12px !important; }
        }
      `}</style>
    </div>
  );
}
