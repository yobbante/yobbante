import { motion } from 'framer-motion';

interface Hub {
  code: string;
  flag: string;
  label: string;
  // Spherical coords approximated as % position on a 2D circle
  x: number; // 0-100
  y: number; // 0-100
  delay: number;
}

const HUBS: Hub[] = [
  { code: 'FR', flag: '🇫🇷', label: 'France',     x: 52, y: 30, delay: 0.0 },
  { code: 'DE', flag: '🇩🇪', label: 'Allemagne',  x: 58, y: 28, delay: 0.15 },
  { code: 'CN', flag: '🇨🇳', label: 'Chine',      x: 78, y: 38, delay: 0.30 },
  { code: 'AE', flag: '🇦🇪', label: 'Dubai',      x: 64, y: 46, delay: 0.45 },
  { code: 'US', flag: '🇺🇸', label: 'USA',        x: 22, y: 38, delay: 0.60 },
  { code: 'CA', flag: '🇨🇦', label: 'Canada',     x: 26, y: 22, delay: 0.75 },
];

// Destination point (Dakar, Senegal) — center of the action
const DAKAR = { x: 44, y: 54 };

export function HubsGlobe() {
  return (
    <div className="relative aspect-square w-full max-w-md mx-auto">
      {/* Glow halo */}
      <div className="absolute inset-0 rounded-full bg-primary/10 blur-3xl" />

      {/* Globe sphere */}
      <div className="absolute inset-4 rounded-full bg-gradient-to-br from-card via-secondary/40 to-background border border-border shadow-2xl overflow-hidden">
        {/* Latitude lines */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <radialGradient id="sphereShade" cx="35%" cy="30%" r="80%">
              <stop offset="0%" stopColor="hsl(var(--primary) / 0.15)" />
              <stop offset="60%" stopColor="transparent" />
            </radialGradient>
          </defs>
          <rect width="100" height="100" fill="url(#sphereShade)" />
          {/* meridians */}
          {[20, 35, 50, 65, 80].map((cx) => (
            <ellipse
              key={cx}
              cx="50" cy="50" rx={Math.abs(50 - cx)} ry="48"
              fill="none" stroke="hsl(var(--border))" strokeWidth="0.2" opacity="0.5"
            />
          ))}
          {/* parallels */}
          {[20, 35, 50, 65, 80].map((cy) => (
            <ellipse
              key={cy}
              cx="50" cy="50" rx="48" ry={Math.abs(50 - cy)}
              fill="none" stroke="hsl(var(--border))" strokeWidth="0.2" opacity="0.5"
            />
          ))}
          <circle cx="50" cy="50" r="48" fill="none" stroke="hsl(var(--border))" strokeWidth="0.4" />
        </svg>

        {/* Slow rotation indicator (subtle) */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{ rotate: 360 }}
          transition={{ duration: 60, ease: 'linear', repeat: Infinity }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[88%] h-[88%] rounded-full border border-primary/10" />
        </motion.div>

        {/* SVG flight paths */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {HUBS.map((h) => (
            <motion.path
              key={`p-${h.code}`}
              d={curve(h.x, h.y, DAKAR.x, DAKAR.y)}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="0.25"
              strokeDasharray="0.6 0.6"
              opacity="0.55"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, delay: 0.4 + h.delay, ease: 'easeOut' }}
            />
          ))}
          {/* Animated pulse dot along each path */}
          {HUBS.map((h) => (
            <motion.circle
              key={`d-${h.code}`}
              r="0.5"
              fill="hsl(var(--primary))"
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0, 1, 1, 0],
                cx: [h.x, (h.x + DAKAR.x) / 2, DAKAR.x],
                cy: [h.y, (h.y + DAKAR.y) / 2 - 6, DAKAR.y],
              }}
              transition={{
                duration: 2.4,
                delay: 1.5 + h.delay * 1.5,
                repeat: Infinity,
                repeatDelay: 4 + Math.random() * 2,
                ease: 'easeInOut',
              }}
            />
          ))}
        </svg>

        {/* Hubs (flags) */}
        {HUBS.map((h) => (
          <motion.div
            key={h.code}
            className="absolute -translate-x-1/2 -translate-y-1/2 group"
            style={{ left: `${h.x}%`, top: `${h.y}%` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 + h.delay, type: 'spring', stiffness: 200, damping: 16 }}
          >
            <div className="relative">
              {/* Pulse ring */}
              <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" style={{ animationDuration: '2.4s' }} />
              <div className="relative w-8 h-8 rounded-full bg-card border border-primary/40 shadow-md flex items-center justify-center text-base ring-2 ring-background">
                {h.flag}
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-1.5 py-0.5 rounded bg-foreground text-background text-[10px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {h.label}
              </div>
            </div>
          </motion.div>
        ))}

        {/* Destination — Dakar */}
        <motion.div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${DAKAR.x}%`, top: `${DAKAR.y}%` }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1.2, type: 'spring' }}
        >
          <div className="relative">
            <span className="absolute inset-0 rounded-full bg-primary/60 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="relative w-3.5 h-3.5 rounded-full bg-primary ring-4 ring-background shadow-lg" />
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-bold whitespace-nowrap">
              Dakar
            </div>
          </div>
        </motion.div>
      </div>

      {/* Caption */}
      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}
        className="absolute -bottom-2 left-0 right-0 text-center text-[11px] text-muted-foreground"
      >
        6 hubs · 1 destination · vos colis en route
      </motion.p>
    </div>
  );
}

// Quadratic curve from origin (ox, oy) to destination (dx, dy), arched upward
function curve(ox: number, oy: number, dx: number, dy: number): string {
  const mx = (ox + dx) / 2;
  const my = (oy + dy) / 2 - 14; // arch height
  return `M ${ox} ${oy} Q ${mx} ${my} ${dx} ${dy}`;
}
