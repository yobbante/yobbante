import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Sparkles, Plane, Ship, Truck, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDepartures, type KonnektDeparture } from '@/hooks/useDepartures';

/* ──────────────────────────────────────────────────────────────────────
   HubsWorldMap — interactive dark world map with 6 glowing hub nodes.
   Premium UX: hover/tap reveals hub details + Konnekt trust layer.
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
  /** Country codes Konnekt may report this hub as */
  konnektMatch: string[];
};

export const WORLD_HUBS: HubMeta[] = [
  { id: 'US', flag: '🇺🇸', label: 'USA',     city: 'Miami',     tagline: 'Idéal Amazon US, eBay, Walmart',  x: 22, y: 38, konnektMatch: ['US', 'USA', 'United States'] },
  { id: 'FR', flag: '🇫🇷', label: 'France',  city: 'Paris',     tagline: 'Amazon FR, Cdiscount, Fnac',      x: 50, y: 30, konnektMatch: ['FR', 'France'] },
  { id: 'TR', flag: '🇹🇷', label: 'Turquie', city: 'Istanbul',  tagline: 'Mode, textile, gros volumes',     x: 56, y: 36, konnektMatch: ['TR', 'Turkey', 'Türkiye'] },
  { id: 'AE', flag: '🇦🇪', label: 'Dubai',   city: 'Dubai',     tagline: 'Électronique, luxe, Amazon.ae',   x: 62, y: 44, konnektMatch: ['AE', 'UAE', 'Dubai', 'United Arab Emirates'] },
  { id: 'CN', flag: '🇨🇳', label: 'Chine',   city: 'Shenzhen',  tagline: 'Alibaba, AliExpress, Shein, Temu',x: 78, y: 40, konnektMatch: ['CN', 'China'] },
  { id: 'SN', flag: '🇸🇳', label: 'Sénégal', city: 'Dakar',     tagline: 'Hub local · regroupement & livraison', x: 44, y: 52, konnektMatch: ['SN', 'Senegal'] },
];

/* Derived live insights per hub from Konnekt departures */
function useHubInsights() {
  const { data, isLoading } = useDepartures();
  const departures: KonnektDeparture[] = data?.departures ?? [];

  return useMemo(() => {
    const byHub: Record<HubId, { next?: KonnektDeparture; count: number }> = {
      CN: { count: 0 }, FR: { count: 0 }, US: { count: 0 },
      AE: { count: 0 }, TR: { count: 0 }, SN: { count: 0 },
    };

    for (const hub of WORLD_HUBS) {
      const matching = departures
        .filter(d => hub.konnektMatch.some(m =>
          d.origin_country?.toUpperCase().includes(m.toUpperCase())
        ))
        .sort((a, b) => new Date(a.departure_date).getTime() - new Date(b.departure_date).getTime());

      byHub[hub.id] = { next: matching[0], count: matching.length };
    }

    return { byHub, isLoading, hasLiveData: (data?.count ?? 0) > 0 };
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
  className,
}: {
  value: string | null;
  onChange: (id: HubId) => void;
  /** Highlighted hub id (e.g. auto-suggested from product link). */
  recommended?: HubId | null;
  /** Destination hub id for path drawing — defaults to Senegal. */
  destination?: HubId;
  variant?: 'dark' | 'light';
  className?: string;
}) {
  const { byHub, isLoading, hasLiveData } = useHubInsights();
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
  const fg = isDark ? 'text-white' : 'text-foreground';

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

          {/* Stylised continent silhouettes (abstract, not geographically exact) */}
          <g fill={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}
             stroke={isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}
             strokeWidth="0.15">
            {/* North America */}
            <path d="M8,18 Q14,10 24,12 Q32,14 30,22 Q34,28 26,32 Q18,34 12,28 Q6,24 8,18 Z" />
            {/* South America */}
            <path d="M24,38 Q30,36 30,42 Q28,48 22,46 Q20,42 24,38 Z" />
            {/* Europe */}
            <path d="M44,20 Q52,18 56,22 Q54,28 48,28 Q42,26 44,20 Z" />
            {/* Africa */}
            <path d="M46,30 Q56,28 56,38 Q52,48 44,46 Q40,38 46,30 Z" />
            {/* Middle East / West Asia */}
            <path d="M56,28 Q64,26 66,34 Q60,38 56,34 Z" />
            {/* Asia */}
            <path d="M64,18 Q80,14 88,22 Q86,32 76,34 Q66,30 64,18 Z" />
            {/* Oceania */}
            <path d="M82,38 Q88,36 90,42 Q84,46 80,42 Z" />
          </g>

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
              {/* Pulse ring (recommended/selected) */}
              {(isRecommended || isSelected) && (
                <span
                  className={cn(
                    'absolute inset-0 rounded-full animate-ping',
                    isSelected ? 'bg-primary/50' : 'bg-yellow-400/60'
                  )}
                  style={{ animationDuration: '2.2s' }}
                />
              )}

              {/* Node */}
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

              {/* Tooltip label */}
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

              {/* Recommended badge */}
              {isRecommended && (
                <span className="absolute -top-2 left-full ml-1 inline-flex items-center gap-0.5 rounded-full bg-yellow-400 text-zinc-950 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 whitespace-nowrap shadow-lg">
                  <Sparkles className="w-2.5 h-2.5" /> Recommandé
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Detail panel — slides up on hover/select */}
      <div className={cn('relative border-t px-4 sm:px-5 py-3 sm:py-3.5 min-h-[78px]', isDark ? 'border-white/10 bg-zinc-950/60' : 'border-border bg-card/60')}>
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
                    Hub actif cette semaine
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
                  ) : hasLiveData ? (
                    <span className={cn('inline-flex items-center gap-1', muted)}>
                      <Activity className="w-3 h-3" /> Départs sur demande
                    </span>
                  ) : (
                    <span className={cn('inline-flex items-center gap-1', muted)}>
                      <Activity className="w-3 h-3" /> Départs réguliers
                    </span>
                  )}
                  {(activeInsights?.count ?? 0) > 0 && (
                    <span className={cn('inline-flex items-center gap-1', muted)}>
                      <Plane className="w-3 h-3" /> {activeInsights!.count} expédition{activeInsights!.count > 1 ? 's' : ''} planifiée{activeInsights!.count > 1 ? 's' : ''}
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
    </div>
  );
}
