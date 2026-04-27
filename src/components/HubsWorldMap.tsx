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

          {/* Stylised continent silhouettes — refined recognizability at small sizes */}
          <g fill={isDark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.05)'}
             stroke={isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)'}
             strokeWidth="0.13"
             strokeLinejoin="round"
             strokeLinecap="round">
            {/* Greenland */}
            <path d="M33,8 L40,7 L42,11 L39,14 L34,13 Z" />
            {/* North America — wider east coast, tapered Mexico */}
            <path d="M5,14 L13,10 L20,11 L26,13 L30,17 L29,22 L25,25 L20,28 L17,31 L14,29 L10,26 L7,22 L4,18 Z" />
            {/* Central America bridge */}
            <path d="M17,31 L20,33 L22,35 L21,37 L19,36 L17,33 Z" />
            {/* South America — wide north, tapered south */}
            <path d="M21,37 L26,37 L29,40 L29,44 L26,48 L23,49 L21,46 L20,42 Z" />
            {/* Iceland */}
            <path d="M42,15 L44,14 L45,16 L43,17 Z" />
            {/* British Isles */}
            <path d="M44,17 L46,16 L47,19 L45,20 Z" />
            {/* Iberian peninsula */}
            <path d="M44,21 L48,20 L49,23 L46,24 Z" />
            {/* Continental Europe */}
            <path d="M48,18 L55,17 L58,20 L56,23 L51,23 L48,21 Z" />
            {/* Italy boot hint */}
            <path d="M52,22 L54,22 L54,25 L53,26 L52,24 Z" />
            {/* Scandinavia */}
            <path d="M51,13 L55,12 L57,16 L53,17 Z" />
            {/* North Africa */}
            <path d="M44,25 L54,24 L57,27 L56,31 L48,32 L44,29 Z" />
            {/* Sub-Saharan Africa + Horn */}
            <path d="M46,31 L56,31 L58,34 L60,33 L60,36 L57,38 L55,42 L51,43 L47,40 L45,35 Z" />
            {/* Madagascar */}
            <path d="M58,40 L60,40 L60,43 L58,43 Z" />
            {/* Arabian peninsula */}
            <path d="M57,25 L62,24 L64,28 L61,30 L58,28 Z" />
            {/* Asia mainland — broad, with Siberia top */}
            <path d="M58,12 L70,10 L82,11 L89,15 L88,21 L84,24 L78,25 L72,23 L66,22 L60,20 L57,16 Z" />
            {/* Indian subcontinent */}
            <path d="M68,25 L73,25 L74,29 L71,33 L68,30 Z" />
            {/* South-East Asia / Indochina */}
            <path d="M76,26 L80,26 L82,29 L80,32 L77,30 Z" />
            {/* Indonesia / Philippines (archipelago dots) */}
            <path d="M81,32 L84,32 L85,34 L82,34 Z" />
            <path d="M86,30 L88,30 L88,32 L86,32 Z" />
            {/* Japan */}
            <path d="M88,17 L90,16 L91,19 L89,20 Z" />
            {/* Australia */}
            <path d="M82,38 L90,37 L93,40 L91,44 L84,44 L81,41 Z" />
            {/* New Zealand */}
            <path d="M93,44 L95,44 L95,46 L93,46 Z" />
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
      {showTimelinePreview && activeHub && activeHub.id !== destination && (
        <div className={cn('relative border-t px-4 sm:px-5 py-3', border, isDark ? 'bg-zinc-950/40' : 'bg-secondary/30')}>
          <div className="flex items-center justify-between mb-2">
            <p className={cn('text-[10px] uppercase tracking-wider font-semibold', subtle)}>
              Parcours type depuis {activeHub.label}
            </p>
            <p className={cn('text-[10px]', subtle)}>~ 4 étapes suivies</p>
          </div>
          <ol className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto -mx-1 px-1 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { Icon: Inbox,         label: 'Reçu au hub' },
              { Icon: Warehouse,     label: 'En stockage' },
              { Icon: Plane,         label: 'Prêt à partir' },
              { Icon: PackageCheck,  label: `Livré · ${dest.label}` },
            ].map((s, i, arr) => (
              <li key={s.label} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] sm:text-[11px] font-medium whitespace-nowrap',
                  chipBg, fg
                )}>
                  <s.Icon className="w-3 h-3 opacity-70 shrink-0" />
                  <span>{s.label}</span>
                </span>
                {i < arr.length - 1 && (
                  <span className={cn('h-px w-3 sm:w-5 shrink-0', isDark ? 'bg-white/15' : 'bg-foreground/15')} />
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
