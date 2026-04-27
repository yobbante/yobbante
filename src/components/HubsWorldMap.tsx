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

          {/* Stylised continent silhouettes — closer to real-world shapes (Equirectangular-ish) */}
          <g fill={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.045)'}
             stroke={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)'}
             strokeWidth="0.12"
             strokeLinejoin="round">
            {/* North America */}
            <path d="M6,14 L14,11 L22,12 L27,15 L29,20 L26,24 L22,28 L18,30 L14,28 L10,25 L7,21 L5,17 Z" />
            {/* Central America bridge */}
            <path d="M18,30 L21,33 L23,36 L22,38 L19,36 L17,33 Z" />
            {/* South America */}
            <path d="M22,38 L27,38 L29,42 L28,46 L25,49 L22,48 L20,44 L21,40 Z" />
            {/* Greenland */}
            <path d="M34,9 L39,8 L41,12 L38,15 L34,13 Z" />
            {/* Europe */}
            <path d="M44,16 L49,14 L54,15 L57,18 L55,22 L51,23 L47,22 L44,20 Z" />
            {/* Africa */}
            <path d="M46,24 L52,23 L56,26 L57,32 L54,38 L50,42 L46,40 L44,34 L44,28 Z" />
            {/* Middle East */}
            <path d="M55,22 L60,22 L63,26 L61,29 L57,28 L55,25 Z" />
            {/* Asia */}
            <path d="M57,14 L68,12 L78,13 L86,16 L88,20 L85,24 L80,26 L74,25 L68,24 L62,22 L58,19 Z" />
            {/* India */}
            <path d="M70,26 L74,26 L75,30 L72,33 L69,30 Z" />
            {/* South-East Asia */}
            <path d="M78,28 L83,28 L84,32 L81,33 L79,31 Z" />
            {/* Australia */}
            <path d="M82,38 L89,37 L92,40 L90,44 L84,44 L81,41 Z" />
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
      <div className={cn('relative border-t px-4 sm:px-5 py-3 sm:py-3.5 min-h-[78px]', border, isDark ? 'bg-zinc-950/60' : 'bg-card/60')}>
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
      {showTimelinePreview && activeHub && activeHub.id !== destination && (
        <div className={cn('relative border-t px-4 sm:px-5 py-3', border, isDark ? 'bg-zinc-950/40' : 'bg-secondary/30')}>
          <div className="flex items-center justify-between mb-2">
            <p className={cn('text-[10px] uppercase tracking-wider font-semibold', subtle)}>
              Parcours type depuis {activeHub.label}
            </p>
            <p className={cn('text-[10px]', subtle)}>~ 4 étapes suivies</p>
          </div>
          <ol className="flex items-center gap-1.5 sm:gap-2">
            {[
              { Icon: Inbox,         label: 'Reçu au hub' },
              { Icon: Warehouse,     label: 'En stockage' },
              { Icon: Plane,         label: 'Prêt à partir' },
              { Icon: PackageCheck,  label: `Livré · ${dest.label}` },
            ].map((s, i, arr) => (
              <li key={s.label} className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] sm:text-[11px] font-medium',
                  chipBg, fg
                )}>
                  <s.Icon className="w-3 h-3 opacity-70" />
                  <span className="truncate">{s.label}</span>
                </span>
                {i < arr.length - 1 && (
                  <span className={cn('h-px w-3 sm:w-5', isDark ? 'bg-white/15' : 'bg-foreground/15')} />
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
