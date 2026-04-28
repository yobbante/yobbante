import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Loader2, Check, Building2, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

/**
 * RelayPicker — single source of truth for picking a Yobbanté relay address.
 *
 * Used by every entry of /expedier/recevoir so labels, ordering and
 * the visual map stay perfectly consistent.
 *
 * Renders:
 *  - A dark world map with one glowing pin per active relay country
 *  - A grid of relay cards under the map (full address, contact)
 *  - Hover/tap on a pin highlights the matching card and vice-versa
 */

export type RelayAddress = {
  id: string;
  country: string;
  country_code: string;
  city: string;
  address_line1: string;
  address_line2: string | null;
  postal_code: string | null;
  phone: string | null;
  contact_name: string | null;
  active: boolean;
  notes: string | null;
};

/** Lat/lng → simple equirectangular projection on a 0..100 viewBox. */
const COUNTRY_COORDS: Record<string, { x: number; y: number }> = {
  US: { x: 22, y: 38 },
  FR: { x: 50, y: 30 },
  TR: { x: 56, y: 36 },
  DE: { x: 52, y: 28 },
  GB: { x: 48, y: 27 },
  AE: { x: 62, y: 44 },
  CN: { x: 78, y: 40 },
  CA: { x: 24, y: 28 },
  SN: { x: 44, y: 52 },
};

interface RelayPickerProps {
  value: string | null;
  onChange: (relayId: string, relay: RelayAddress) => void;
  /** Optional: pre-suggest a relay (e.g. based on merchant). */
  suggestedCountryCode?: string | null;
  /** Optional theme. Defaults to dark (used inside the dark Receive flow). */
  theme?: 'dark' | 'light';
}

export function RelayPicker({
  value,
  onChange,
  suggestedCountryCode,
  theme = 'dark',
}: RelayPickerProps) {
  const [relays, setRelays] = useState<RelayAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('relay_addresses')
        .select('*')
        .eq('active', true)
        .order('country');
      if (cancelled) return;
      if (!error && data) setRelays(data as RelayAddress[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-pick suggested relay once relays load
  useEffect(() => {
    if (value || !suggestedCountryCode || !relays.length) return;
    const match = relays.find(r => r.country_code === suggestedCountryCode);
    if (match) onChange(match.id, match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relays, suggestedCountryCode]);

  const isDark = theme === 'dark';

  const pins = useMemo(
    () =>
      relays
        .map(r => ({ relay: r, pos: COUNTRY_COORDS[r.country_code] }))
        .filter(p => !!p.pos),
    [relays]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-white/60' : 'text-muted-foreground')} />
      </div>
    );
  }

  if (relays.length === 0) {
    return (
      <div className={cn('rounded-xl border-2 border-dashed p-6 text-center text-sm', isDark ? 'border-white/15 text-white/60' : 'border-border text-muted-foreground')}>
        Aucun relais actif pour le moment. Notre équipe revient vers vous très vite.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Interactive world map ──────────────────────────────── */}
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-2xl border-2',
          isDark ? 'border-white/10 bg-zinc-950' : 'border-border bg-card'
        )}
      >
        <svg viewBox="0 0 100 60" className="w-full block" preserveAspectRatio="xMidYMid meet">
          {/* Decorative grid */}
          <defs>
            <pattern id="relay-grid" x="0" y="0" width="5" height="5" patternUnits="userSpaceOnUse">
              <path
                d="M 5 0 L 0 0 0 5"
                fill="none"
                stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}
                strokeWidth="0.2"
              />
            </pattern>
            <radialGradient id="relay-glow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="hsl(45 100% 55%)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="hsl(45 100% 55%)" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width="100" height="60" fill="url(#relay-grid)" />

          {/* Soft continents silhouette */}
          <g fill={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}>
            {/* Americas */}
            <path d="M10,20 Q15,15 22,18 Q28,22 28,32 Q26,42 20,46 Q14,42 12,34 Z" />
            <path d="M22,40 Q28,42 30,50 Q26,55 22,52 Q18,48 22,40 Z" />
            {/* Europe + Africa */}
            <path d="M44,18 Q52,16 56,22 Q56,28 50,30 Q46,28 44,24 Z" />
            <path d="M44,30 Q52,32 54,40 Q50,50 46,52 Q42,48 42,38 Z" />
            {/* Asia */}
            <path d="M56,20 Q72,18 82,26 Q86,34 82,42 Q72,44 60,40 Q56,32 56,20 Z" />
            {/* Oceania */}
            <path d="M82,46 Q88,46 88,50 Q86,52 82,52 Z" />
          </g>

          {/* Relay pins */}
          {pins.map(({ relay, pos }) => {
            const active = value === relay.id;
            const isHover = hovered === relay.id;
            const r = active ? 1.6 : 1.1;
            return (
              <g
                key={relay.id}
                transform={`translate(${pos.x} ${pos.y})`}
                onMouseEnter={() => setHovered(relay.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onChange(relay.id, relay)}
                className="cursor-pointer"
              >
                {(active || isHover) && (
                  <circle r={5} fill="url(#relay-glow)" />
                )}
                <circle
                  r={r + 1}
                  fill="none"
                  stroke={active ? 'hsl(45 100% 60%)' : isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)'}
                  strokeWidth="0.25"
                />
                <circle
                  r={r}
                  fill={active ? 'hsl(45 100% 60%)' : isDark ? '#fff' : '#0a0a0a'}
                />
                <text
                  x={0}
                  y={-2.5}
                  textAnchor="middle"
                  fontSize="2.2"
                  fontWeight="700"
                  fill={active ? 'hsl(45 100% 60%)' : isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)'}
                  style={{ pointerEvents: 'none' }}
                >
                  {relay.country_code}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend / hover preview */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className={cn(
                'absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-xs rounded-xl px-3 py-2 backdrop-blur',
                isDark ? 'bg-zinc-900/85 border border-white/10' : 'bg-white/90 border border-border'
              )}
            >
              {(() => {
                const r = relays.find(x => x.id === hovered)!;
                return (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className={cn('text-xs font-bold truncate', isDark ? 'text-white' : 'text-foreground')}>
                        {r.country} · {r.city}
                      </p>
                      <p className={cn('text-[11px] line-clamp-2', isDark ? 'text-white/60' : 'text-muted-foreground')}>
                        {r.address_line1}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Cards under the map ───────────────────────────────── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {relays.map(r => {
          const active = value === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onChange(r.id, r)}
              onMouseEnter={() => setHovered(r.id)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                'text-left rounded-xl border-2 p-4 transition-all hover:-translate-y-0.5',
                active
                  ? isDark
                    ? 'border-yellow-400 bg-yellow-400/10'
                    : 'border-foreground bg-secondary'
                  : isDark
                    ? 'border-white/10 bg-white/[0.03] hover:border-white/30'
                    : 'border-border bg-card hover:border-foreground/40'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className={cn('w-4 h-4 shrink-0', active ? 'text-yellow-400' : isDark ? 'text-white/70' : 'text-muted-foreground')} />
                  <div className="min-w-0">
                    <p className={cn('text-sm font-bold truncate', isDark ? 'text-white' : 'text-foreground')}>
                      {r.country}
                    </p>
                    <p className={cn('text-[11px]', isDark ? 'text-white/55' : 'text-muted-foreground')}>
                      {r.city}
                    </p>
                  </div>
                </div>
                {active && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-400 text-zinc-950 shrink-0">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className={cn('mt-2 text-[11px] line-clamp-2', isDark ? 'text-white/55' : 'text-muted-foreground')}>
                {r.address_line1}
              </p>
              {r.phone && (
                <p className={cn('mt-1.5 text-[10px] inline-flex items-center gap-1', isDark ? 'text-white/45' : 'text-muted-foreground')}>
                  <Phone className="w-3 h-3" /> {r.phone}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
