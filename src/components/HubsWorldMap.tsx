import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Sparkles, Plane, Ship, Truck, Activity,
  Inbox, Warehouse, PackageCheck, Calendar, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDepartures, type KonnektDeparture } from '@/hooks/useDepartures';

/* ──────────────────────────────────────────────────────────────────────
   HubsWorldMap — interactive dark world map with 6 glowing hub nodes.
   Premium UX: hover/tap reveals hub details, Konnekt trust layer,
   compact legend and a small timeline preview for the active hub.
   ────────────────────────────────────────────────────────────────────── */

export type HubId = 'CN' | 'FR' | 'US' | 'AE' | 'TR' | 'SN';

type HubMeta = {
  id: HubId;
  flag: string;
  label: string;
  city: string;
  tagline: string;
  /** Position in % on the SVG viewBox 0..100 */
  x: number;
  y: number;
  /**
   * Authoritative mapping table for matching Konnekt `origin_country` values
   * to this hub. Values are normalized (uppercased, trimmed) before compare.
   * Use exact equality — no substring heuristics.
   */
  konnektMatch: string[];
};

export const WORLD_HUBS: HubMeta[] = [
  { id: 'US', flag: '🇺🇸', label: 'USA',     city: 'Miami',     tagline: 'Idéal Amazon US, eBay, Walmart',  x: 22, y: 38, konnektMatch: ['US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA'] },
  { id: 'FR', flag: '🇫🇷', label: 'France',  city: 'Paris',     tagline: 'Amazon FR, Cdiscount, Fnac',      x: 50, y: 30, konnektMatch: ['FR', 'FRANCE', 'FRA'] },
  { id: 'TR', flag: '🇹🇷', label: 'Turquie', city: 'Istanbul',  tagline: 'Mode, textile, gros volumes',     x: 56, y: 36, konnektMatch: ['TR', 'TUR', 'TURKEY', 'TÜRKIYE', 'TURKIYE'] },
  { id: 'AE', flag: '🇦🇪', label: 'Dubai',   city: 'Dubai',     tagline: 'Électronique, luxe, Amazon.ae',   x: 62, y: 44, konnektMatch: ['AE', 'ARE', 'UAE', 'DUBAI', 'UNITED ARAB EMIRATES'] },
  { id: 'CN', flag: '🇨🇳', label: 'Chine',   city: 'Shenzhen',  tagline: 'Alibaba, AliExpress, Shein, Temu',x: 78, y: 40, konnektMatch: ['CN', 'CHN', 'CHINA'] },
  { id: 'SN', flag: '🇸🇳', label: 'Sénégal', city: 'Dakar',     tagline: 'Hub local · regroupement & livraison', x: 44, y: 52, konnektMatch: ['SN', 'SEN', 'SENEGAL', 'SÉNÉGAL'] },
];

/* ──────────────────────────────────────────────────────────────────────
   36 destinations — flag markers placed on the map via a piecewise
   equirectangular projection calibrated on the existing hub positions.
   ────────────────────────────────────────────────────────────────────── */

type CityMarker = { city: string; country: string; flag: string; lat: number; lon: number };

const CITIES_36: CityMarker[] = [
  { city: 'Abidjan',     country: 'CI', flag: '🇨🇮', lat: 5.36,  lon: -4.0  },
  { city: 'Alméria',     country: 'ES', flag: '🇪🇸', lat: 36.84, lon: -2.46 },
  { city: 'Bamako',      country: 'ML', flag: '🇲🇱', lat: 12.65, lon: -8.0  },
  { city: 'Barcelone',   country: 'ES', flag: '🇪🇸', lat: 41.39, lon: 2.17  },
  { city: 'Berlin',      country: 'DE', flag: '🇩🇪', lat: 52.52, lon: 13.4  },
  { city: 'Beyrouth',    country: 'LB', flag: '🇱🇧', lat: 33.89, lon: 35.5  },
  { city: 'Bordeaux',    country: 'FR', flag: '🇫🇷', lat: 44.84, lon: -0.58 },
  { city: 'Brazzaville', country: 'CG', flag: '🇨🇬', lat: -4.27, lon: 15.28 },
  { city: 'Bruxelles',   country: 'BE', flag: '🇧🇪', lat: 50.85, lon: 4.35  },
  { city: 'Casablanca',  country: 'MA', flag: '🇲🇦', lat: 33.57, lon: -7.59 },
  { city: 'Conakry',     country: 'GN', flag: '🇬🇳', lat: 9.64,  lon: -13.58 },
  { city: 'Douala',      country: 'CM', flag: '🇨🇲', lat: 4.05,  lon: 9.77  },
  { city: 'Dubaï',       country: 'AE', flag: '🇦🇪', lat: 25.2,  lon: 55.27 },
  { city: 'Düsseldorf',  country: 'DE', flag: '🇩🇪', lat: 51.23, lon: 6.78  },
  { city: 'Gatineau',    country: 'CA', flag: '🇨🇦', lat: 45.48, lon: -75.7 },
  { city: 'Genève',      country: 'CH', flag: '🇨🇭', lat: 46.2,  lon: 6.14  },
  { city: 'Istanbul',    country: 'TR', flag: '🇹🇷', lat: 41.0,  lon: 28.97 },
  { city: 'Kinshasa',    country: 'CD', flag: '🇨🇩', lat: -4.33, lon: 15.31 },
  { city: 'Libreville',  country: 'GA', flag: '🇬🇦', lat: 0.42,  lon: 9.45  },
  { city: 'Lille',       country: 'FR', flag: '🇫🇷', lat: 50.63, lon: 3.06  },
  { city: 'Lyon',        country: 'FR', flag: '🇫🇷', lat: 45.76, lon: 4.84  },
  { city: 'Madrid',      country: 'ES', flag: '🇪🇸', lat: 40.42, lon: -3.7  },
  { city: 'Malabo',      country: 'GQ', flag: '🇬🇶', lat: 3.75,  lon: 8.78  },
  { city: 'Marseille',   country: 'FR', flag: '🇫🇷', lat: 43.3,  lon: 5.37  },
  { city: 'Milan',       country: 'IT', flag: '🇮🇹', lat: 45.46, lon: 9.19  },
  { city: 'Montpellier', country: 'FR', flag: '🇫🇷', lat: 43.61, lon: 3.88  },
  { city: 'Montréal',    country: 'CA', flag: '🇨🇦', lat: 45.5,  lon: -73.57 },
  { city: "N'Djamena",   country: 'TD', flag: '🇹🇩', lat: 12.13, lon: 15.05 },
  { city: 'New York',    country: 'US', flag: '🇺🇸', lat: 40.71, lon: -74.0 },
  { city: 'Nîmes',       country: 'FR', flag: '🇫🇷', lat: 43.84, lon: 4.36  },
  { city: 'Ottawa',      country: 'CA', flag: '🇨🇦', lat: 45.42, lon: -75.7 },
  { city: 'Paris',       country: 'FR', flag: '🇫🇷', lat: 48.85, lon: 2.35  },
  { city: 'Providence',  country: 'US', flag: '🇺🇸', lat: 41.82, lon: -71.4 },
  { city: 'Rennes',      country: 'FR', flag: '🇫🇷', lat: 48.11, lon: -1.68 },
  { city: 'Rouen',       country: 'FR', flag: '🇫🇷', lat: 49.44, lon: 1.1   },
  { city: 'Washington',  country: 'US', flag: '🇺🇸', lat: 38.9,  lon: -77.04 },
  { city: 'Yaoundé',     country: 'CM', flag: '🇨🇲', lat: 3.87,  lon: 11.52 },
];

/** Piecewise projection calibrated on existing hub positions (viewBox 0..100 × 0..50). */
function projectLatLon(lat: number, lon: number): { x: number; y: number } {
  let x: number;
  if (lon <= 2.35) x = 50 + (lon - 2.35) * 0.366;
  else if (lon <= 55.3) x = 50 + (lon - 2.35) * 0.225;
  else x = 62 + (lon - 55.3) * 0.272;
  const y = 61.5 - 0.644 * lat;
  return { x, y };
}

/** Build an O(1) lookup table: normalized token -> hub id. */
const KONNEKT_LOOKUP: Record<string, HubId> = (() => {
  const out: Record<string, HubId> = {};
  for (const h of WORLD_HUBS) for (const m of h.konnektMatch) out[m.trim().toUpperCase()] = h.id;
  return out;
})();

export function matchKonnektOrigin(raw: string | null | undefined): HubId | null {
  if (!raw) return null;
  return KONNEKT_LOOKUP[raw.trim().toUpperCase()] ?? null;
}

/* Derived live insights per hub from Konnekt departures */
function useHubInsights() {
  const { data, isLoading } = useDepartures();
  const departures: KonnektDeparture[] = data?.departures ?? [];

  return useMemo(() => {
    const byHub: Record<HubId, { next?: KonnektDeparture; count: number }> = {
      CN: { count: 0 }, FR: { count: 0 }, US: { count: 0 },
      AE: { count: 0 }, TR: { count: 0 }, SN: { count: 0 },
    };

    let totalMatched = 0;
    for (const dep of departures) {
      const hubId = matchKonnektOrigin(dep.origin_country);
      if (!hubId) continue;
      totalMatched++;
      const slot = byHub[hubId];
      slot.count += 1;
      if (!slot.next || new Date(dep.departure_date).getTime() < new Date(slot.next.departure_date).getTime()) {
        slot.next = dep;
      }
    }

    return {
      byHub,
      isLoading,
      hasLiveData: (data?.count ?? 0) > 0,
      hasMatchedAny: totalMatched > 0,
    };
  }, [departures, isLoading, data?.count]);
}

function daysFromNow(iso?: string): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function transportIcon(t?: string) {
  if (t === 'AIR')  return <Plane className="w-3 h-3" />;
  if (t === 'SEA')  return <Ship  className="w-3 h-3" />;
  if (t === 'ROAD') return <Truck className="w-3 h-3" />;
  return <Activity className="w-3 h-3" />;
}

/* ──────────────────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────────────────── */

export function HubsWorldMap({
  value,
  onChange,
  recommended,
  destination = 'SN',
  variant = 'dark',
  showLegend = true,
  showTimelinePreview = true,
  className,
}: {
  value: string | null;
  onChange: (id: HubId) => void;
  /** Highlighted hub id (e.g. auto-suggested from product link). */
  recommended?: HubId | null;
  /** Destination hub id for path drawing — defaults to Senegal. */
  destination?: HubId;
  variant?: 'dark' | 'light';
  /** Compact legend explaining the trust-layer icons. */
  showLegend?: boolean;
  /** Mini timeline preview shown for the active hub. */
  showTimelinePreview?: boolean;
  className?: string;
}) {
  const { byHub, isLoading, hasLiveData, hasMatchedAny } = useHubInsights();
  const [hovered, setHovered] = useState<HubId | null>(null);
  const dest = WORLD_HUBS.find(h => h.id === destination) ?? WORLD_HUBS[5];
  const active = (hovered ?? (value as HubId) ?? recommended ?? null);
  const activeHub = WORLD_HUBS.find(h => h.id === active);
  const activeInsights = active ? byHub[active] : undefined;
  const nextDays = daysFromNow(activeInsights?.next?.departure_date);

  const isDark = variant === 'dark';
  const bg = isDark
    ? 'bg-gradient-to-b from-zinc-950 to-zinc-900 border-white/10'
    : 'bg-gradient-to-b from-secondary to-background border-border';
  const muted = isDark ? 'text-white/55' : 'text-muted-foreground';
  const subtle = isDark ? 'text-white/40' : 'text-muted-foreground/70';
  const fg = isDark ? 'text-white' : 'text-foreground';
  const border = isDark ? 'border-white/10' : 'border-border';
  const chipBg = isDark ? 'bg-white/[0.04]' : 'bg-secondary';

  return (
    <div className={cn('relative rounded-2xl border-2 overflow-hidden', bg, className)}>
      {/* Atmosphere glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(var(--primary)/0.08)_0%,_transparent_60%)]" />

      {/* Map area */}
      <div className="relative aspect-[2/1] sm:aspect-[2.2/1] w-full">
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 50"
          preserveAspectRatio="none"
          aria-hidden
        >
          {/* Subtle grid graticule */}
          {[10, 20, 30, 40].map(y => (
            <line key={`h${y}`} x1="0" x2="100" y1={y} y2={y}
              stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'} strokeWidth="0.1" />
          ))}
          {[15, 30, 45, 60, 75, 90].map(x => (
            <line key={`v${x}`} y1="0" y2="50" x1={x} x2={x}
              stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'} strokeWidth="0.1" />
          ))}

          {/* Stylised continent silhouettes — refined for recognizability */}
          <g fill={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
             stroke={isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.1)'}
             strokeWidth="0.13"
             strokeLinejoin="round"
             strokeLinecap="round">
            {/* Greenland */}
            <path d="M34,6 C37,5 41,5 43,7 C44,10 43,13 40,14 C36,15 33,13 32,11 C32,9 33,7 34,6 Z" />
            {/* North America — Alaska, Canada, US, Florida, Mexico */}
            <path d="M3,15 C5,12 9,10 13,10 C16,9 20,10 24,11 C27,12 30,14 31,17 C32,20 31,23 29,25 C27,26 25,26 24,28 C23,30 22,32 21,33 L24,34 C25,35 24,37 22,37 L19,36 C17,34 15,32 13,30 C10,28 7,25 5,22 C3,20 2,17 3,15 Z" />
            {/* Central America bridge + Florida nub */}
            <path d="M19,28 C21,29 23,31 24,33 L22,34 L20,33 Z" />
            {/* South America — wide north, tapered Patagonia */}
            <path d="M22,36 C25,35 28,36 30,38 C31,41 30,44 28,46 C27,48 25,49 23,48 C21,47 20,44 20,41 C20,39 21,37 22,36 Z" />
            {/* Iceland */}
            <path d="M42,15 C43,14 45,14 45,16 C45,17 43,18 42,17 Z" />
            {/* British Isles */}
            <path d="M44,17 C45,16 47,16 47,18 C47,20 46,21 45,21 C44,20 43,18 44,17 Z" />
            {/* Iberian peninsula */}
            <path d="M44,21 C46,20 49,20 50,22 C50,24 48,25 46,25 C44,24 43,22 44,21 Z" />
            {/* Continental Europe (France/Germany/Poland) */}
            <path d="M47,18 C51,17 56,17 59,19 C60,21 59,23 57,24 C53,24 50,23 47,22 C46,21 46,19 47,18 Z" />
            {/* Italian boot */}
            <path d="M52,22 C53,22 54,23 54,25 C53,26 52,27 52,26 C51,25 51,23 52,22 Z" />
            {/* Scandinavia */}
            <path d="M50,12 C53,11 56,12 57,15 C57,17 55,17 53,17 C51,16 50,14 50,12 Z" />
            {/* North Africa (Maghreb + Sahara) */}
            <path d="M43,24 C48,23 54,23 58,25 C59,27 58,30 56,31 C51,32 47,32 44,31 C42,29 41,26 43,24 Z" />
            {/* Sub-Saharan Africa with Gulf of Guinea curve + Horn of Africa */}
            <path d="M44,31 C49,30 54,31 57,32 C59,32 61,33 62,35 C62,37 60,38 58,38 C57,40 56,42 54,43 C51,44 48,43 46,41 C44,39 43,36 43,33 Z" />
            {/* Madagascar */}
            <path d="M58,40 C59,40 60,41 60,43 C59,44 58,44 58,42 Z" />
            {/* Arabian peninsula */}
            <path d="M56,25 C60,24 63,25 64,28 C63,30 61,31 58,30 C56,29 55,27 56,25 Z" />
            {/* Asia mainland (Siberia → Mongolia → China) */}
            <path d="M58,11 C65,9 74,9 82,10 C87,11 90,13 90,16 C89,20 86,22 82,23 C76,24 70,23 64,22 C60,21 57,18 57,15 C57,13 57,12 58,11 Z" />
            {/* Indian subcontinent */}
            <path d="M68,24 C71,24 74,25 75,28 C74,31 72,33 69,32 C67,30 66,27 68,24 Z" />
            {/* South-East Asia / Indochina */}
            <path d="M75,25 C78,25 81,27 82,30 C81,32 78,32 76,30 C74,28 74,26 75,25 Z" />
            {/* Indonesia / Philippines archipelago */}
            <path d="M80,32 C82,31 85,32 85,34 C84,35 82,35 80,34 Z" />
            <path d="M86,30 C88,29 89,31 88,32 C86,33 85,31 86,30 Z" />
            <path d="M83,35 C84,34 86,35 86,36 C84,37 83,36 83,35 Z" />
            {/* Japan */}
            <path d="M87,16 C89,15 91,17 90,19 C88,21 86,19 87,16 Z" />
            {/* Australia */}
            <path d="M81,37 C86,36 91,37 93,40 C93,43 90,45 86,45 C82,45 79,43 79,40 C79,38 80,37 81,37 Z" />
            {/* New Zealand */}
            <path d="M93,44 C94,44 95,45 95,46 C94,47 92,46 93,44 Z" />
          </g>

          {/* 36 city markers — small filled dots per city, anchor for the flag overlay */}
          {CITIES_36.map((c, idx) => {
            const { x, y } = projectLatLon(c.lat, c.lon);
            return (
              <circle
                key={`city-dot-${idx}`}
                cx={x}
                cy={y}
                r="0.45"
                fill={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.45)'}
                stroke={isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.7)'}
                strokeWidth="0.08"
              />
            );
          })}

          {/* Routes from each hub to destination */}
          {WORLD_HUBS.filter(h => h.id !== destination).map(h => {
            const isActive = active === h.id;
            const mx = (h.x + dest.x) / 2;
            const my = (h.y + dest.y) / 2 - 6;
            return (
              <g key={`route-${h.id}`}>
                <motion.path
                  d={`M ${h.x} ${h.y} Q ${mx} ${my} ${dest.x} ${dest.y}`}
                  fill="none"
                  stroke={isActive
                    ? 'hsl(var(--primary))'
                    : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}
                  strokeWidth={isActive ? 0.35 : 0.18}
                  strokeDasharray="0.8 0.8"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1, delay: 0.15 }}
                />
                {isActive && (
                  <motion.circle
                    r="0.5"
                    fill="hsl(var(--primary))"
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: [0, 1, 1, 0],
                      cx: [h.x, mx, dest.x],
                      cy: [h.y, my, dest.y],
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Flag overlay for the 36 destinations — small clickable chips with tooltip */}
        {CITIES_36.map((c) => {
          const { x, y } = projectLatLon(c.lat, c.lon);
          return (
            <span
              key={`city-flag-${c.country}-${c.city}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto group/city z-[1]"
              style={{ left: `${x}%`, top: `${y}%` }}
              title={`${c.city}`}
            >
              <span
                className={cn(
                  'inline-flex items-center justify-center rounded-full leading-none select-none transition-transform group-hover/city:scale-150',
                  'text-[8px] sm:text-[10px]',
                  'drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]'
                )}
              >
                {c.flag}
              </span>
              <span
                className={cn(
                  'absolute left-1/2 -translate-x-1/2 top-full mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap pointer-events-none opacity-0 group-hover/city:opacity-100 transition-opacity',
                  isDark ? 'bg-white text-zinc-950' : 'bg-foreground text-background'
                )}
              >
                {c.city}
              </span>
            </span>
          );
        })}

        {/* Hub nodes */}
        {WORLD_HUBS.map((h, i) => {
          const isActive = active === h.id;
          const isSelected = value === h.id;
          const isRecommended = recommended === h.id && !value;
          const isDest = h.id === destination;

          return (
            <motion.button
              key={h.id}
              type="button"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.06, type: 'spring', stiffness: 220, damping: 18 }}
              onMouseEnter={() => setHovered(h.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(h.id)}
              onBlur={() => setHovered(null)}
              onClick={() => !isDest && onChange(h.id)}
              disabled={isDest}
              aria-label={`${h.label} — ${h.tagline}`}
              aria-pressed={isSelected}
              className={cn(
                'absolute -translate-x-1/2 -translate-y-1/2 group focus:outline-none',
                isDest ? 'cursor-default' : 'cursor-pointer'
              )}
              style={{ left: `${h.x}%`, top: `${h.y}%` }}
            >
              {(isRecommended || isSelected) && (
                <span
                  className={cn(
                    'absolute inset-0 rounded-full animate-ping',
                    isSelected ? 'bg-primary/50' : 'bg-yellow-400/60'
                  )}
                  style={{ animationDuration: '2.2s' }}
                />
              )}

              <span
                className={cn(
                  'relative inline-flex items-center justify-center rounded-full border-2 transition-all ring-2',
                  isDest
                    ? 'w-4 h-4 sm:w-5 sm:h-5 bg-primary text-primary-foreground border-primary ring-background'
                    : isSelected
                      ? 'w-9 h-9 sm:w-10 sm:h-10 bg-primary text-primary-foreground border-primary ring-background scale-110'
                      : isRecommended
                        ? cn('w-9 h-9 sm:w-10 sm:h-10 bg-yellow-400 text-zinc-950 border-yellow-300', isDark ? 'ring-zinc-950' : 'ring-background')
                        : isActive
                          ? cn('w-9 h-9 sm:w-10 sm:h-10', isDark ? 'bg-white text-zinc-950 border-white ring-zinc-950' : 'bg-foreground text-background border-foreground ring-background')
                          : cn('w-7 h-7 sm:w-8 sm:h-8 group-hover:scale-110',
                              isDark
                                ? 'bg-zinc-900 text-white border-white/40 ring-zinc-950'
                                : 'bg-card text-foreground border-foreground/40 ring-background')
                )}
              >
                {!isDest && <span className="text-sm sm:text-base leading-none">{h.flag}</span>}
              </span>

              <span
                className={cn(
                  'absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap pointer-events-none transition-opacity',
                  isDest
                    ? 'bg-primary text-primary-foreground opacity-100'
                    : (isActive || isSelected || isRecommended)
                      ? cn('opacity-100', isDark ? 'bg-white text-zinc-950' : 'bg-foreground text-background')
                      : 'opacity-0 group-hover:opacity-100 ' + (isDark ? 'bg-white text-zinc-950' : 'bg-foreground text-background')
                )}
              >
                {isDest ? `${h.flag} ${h.label}` : h.label}
              </span>

              {isRecommended && (
                <span className="absolute -top-2 left-full ml-1 inline-flex items-center gap-0.5 rounded-full bg-yellow-400 text-zinc-950 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 whitespace-nowrap shadow-lg">
                  <Sparkles className="w-2.5 h-2.5" /> Recommandé
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Detail panel */}
      <div className={cn('relative border-t px-4 sm:px-5 py-3 sm:py-3.5 min-h-[110px] sm:min-h-[96px]', border, isDark ? 'bg-zinc-950/60' : 'bg-card/60')}>
        <AnimatePresence mode="wait">
          {activeHub ? (
            <motion.div
              key={activeHub.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-3"
            >
              <div className={cn(
                'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-base',
                isDark ? 'bg-white/10' : 'bg-secondary'
              )}>
                {activeHub.flag}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className={cn('text-sm font-bold tracking-tight', fg)}>
                    {activeHub.label} <span className={cn('font-normal', muted)}>· {activeHub.city}</span>
                  </p>
                  {value === activeHub.id && (
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-primary">Sélectionné</span>
                  )}
                </div>
                <p className={cn('text-xs mt-0.5', muted)}>{activeHub.tagline}</p>

                {/* Trust layer */}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Hub actif
                  </span>
                  {activeInsights?.next ? (
                    <span className={cn('inline-flex items-center gap-1', muted)}>
                      {transportIcon(activeInsights.next.transport)}
                      Prochain départ {nextDays === 0 ? "aujourd'hui" : nextDays === 1 ? 'demain' : `dans ${nextDays} j`}
                    </span>
                  ) : isLoading ? (
                    <span className={cn('inline-flex items-center gap-1', muted)}>
                      <Activity className="w-3 h-3 animate-pulse" /> Lecture du planning…
                    </span>
                  ) : hasLiveData && !hasMatchedAny ? (
                    <span className={cn('inline-flex items-center gap-1', muted)}>
                      <Calendar className="w-3 h-3" /> Départs sur demande
                    </span>
                  ) : hasLiveData ? (
                    <span className={cn('inline-flex items-center gap-1', muted)}>
                      <Calendar className="w-3 h-3" /> Pas de départ planifié — sur demande
                    </span>
                  ) : (
                    <span className={cn('inline-flex items-center gap-1', muted)}>
                      <Calendar className="w-3 h-3" /> Départs réguliers
                    </span>
                  )}
                  {(activeInsights?.count ?? 0) > 0 && (
                    <span className={cn('inline-flex items-center gap-1', muted)}>
                      <Layers className="w-3 h-3" /> {activeInsights!.count} départ{activeInsights!.count > 1 ? 's' : ''} planifié{activeInsights!.count > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className={cn('flex items-center gap-2 text-xs', muted)}
            >
              <MapPin className="w-3.5 h-3.5" />
              Survolez ou touchez un hub pour voir les détails — appuyez pour sélectionner.
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Timeline preview — connects map ↔ timeline-first experience */}
      {showTimelinePreview && (
        <div
          className={cn(
            'relative border-t px-4 sm:px-5 py-3 min-h-[112px] sm:min-h-[78px] transition-opacity duration-200',
            border,
            isDark ? 'bg-zinc-950/40' : 'bg-secondary/30',
            activeHub && activeHub.id !== destination ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
          aria-hidden={!(activeHub && activeHub.id !== destination)}
        >
          <div className="flex items-center justify-between mb-2">
            <p className={cn('text-[10px] uppercase tracking-wider font-semibold truncate', subtle)}>
              Parcours type{activeHub ? ` depuis ${activeHub.label}` : ''}
            </p>
            <p className={cn('text-[10px] shrink-0 ml-2', subtle)}>~ 4 étapes</p>
          </div>

          {/* Mobile: 4-col grid (no scroll). Desktop: inline row with connectors */}
          <ol className="grid grid-cols-4 gap-1.5 sm:flex sm:items-center sm:gap-2">
            {[
              { Icon: Inbox,         label: 'Reçu' },
              { Icon: Warehouse,     label: 'Stocké' },
              { Icon: Plane,         label: 'Départ' },
              { Icon: PackageCheck,  label: `Livré` },
            ].map((s, i, arr) => (
              <li
                key={s.label}
                className="flex flex-col sm:flex-row items-center sm:gap-2 min-w-0"
              >
                <span
                  className={cn(
                    'w-full sm:w-auto inline-flex flex-col sm:flex-row items-center justify-center gap-1 rounded-lg sm:rounded-full px-1.5 sm:px-2 py-1.5 sm:py-1 text-[10px] sm:text-[11px] font-medium leading-tight text-center',
                    chipBg, fg
                  )}
                >
                  <s.Icon className="w-3.5 h-3.5 sm:w-3 sm:h-3 opacity-70 shrink-0" />
                  <span className="truncate w-full">{s.label}</span>
                </span>
                {i < arr.length - 1 && (
                  <span className={cn('hidden sm:block h-px w-3 sm:w-5 shrink-0', isDark ? 'bg-white/15' : 'bg-foreground/15')} />
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Compact legend — explains trust metrics */}
      {showLegend && (
        <div className={cn('relative border-t px-4 sm:px-5 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px]', border, isDark ? 'bg-zinc-950/30' : 'bg-secondary/20', subtle)}>
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Hub actif
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Prochain départ
          </span>
          <span className="inline-flex items-center gap-1">
            <Plane className="w-3 h-3" />/<Ship className="w-3 h-3" />/<Truck className="w-3 h-3" />
            Mode de transport
          </span>
          <span className="inline-flex items-center gap-1">
            <Layers className="w-3 h-3" /> Départs planifiés
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-yellow-400" /> Recommandé
            <span className="mx-1.5 opacity-30">·</span>
            <span className="inline-block w-2 h-2 rounded-full bg-primary" /> Sélectionné
          </span>
        </div>
      )}
    </div>
  );
}
