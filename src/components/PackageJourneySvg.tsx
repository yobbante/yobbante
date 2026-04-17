import { motion } from 'framer-motion';

/**
 * Animated SVG mini-tutorial showing a package journey from origin → hub → transit → home.
 * Lightweight (no Lottie dep). Loops automatically.
 */
export function PackageJourneySvg() {
  return (
    <div className="relative w-full aspect-[16/7] rounded-2xl overflow-hidden border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
      <svg viewBox="0 0 320 140" className="w-full h-full" preserveAspectRatio="xMidYMid meet" aria-label="Parcours d'un colis">
        {/* Dotted route */}
        <motion.path
          d="M30 80 Q 110 30, 160 80 T 290 80"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          strokeDasharray="3 4"
          opacity={0.5}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, ease: 'easeInOut' }}
        />

        {/* Stations */}
        {[
          { x: 30, y: 80, label: 'Achat', icon: '🛒' },
          { x: 130, y: 60, label: 'Hub', icon: '🏭' },
          { x: 220, y: 80, label: 'Transit', icon: '✈️' },
          { x: 290, y: 80, label: 'Vous', icon: '🏠' },
        ].map((s, i) => (
          <g key={s.label}>
            <motion.circle
              cx={s.x}
              cy={s.y}
              r={11}
              fill="hsl(var(--card))"
              stroke="hsl(var(--primary))"
              strokeWidth={1.5}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.25, type: 'spring', stiffness: 200, damping: 14 }}
            />
            <motion.text
              x={s.x}
              y={s.y + 4}
              textAnchor="middle"
              fontSize="11"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 + i * 0.25 }}
            >
              {s.icon}
            </motion.text>
            <motion.text
              x={s.x}
              y={s.y + 28}
              textAnchor="middle"
              fontSize="7"
              fill="hsl(var(--muted-foreground))"
              initial={{ opacity: 0, y: s.y + 22 }}
              animate={{ opacity: 1, y: s.y + 28 }}
              transition={{ delay: 0.45 + i * 0.25 }}
            >
              {s.label.toUpperCase()}
            </motion.text>
          </g>
        ))}

        {/* Moving package */}
        <motion.g
          initial={{ offsetDistance: '0%' }}
          animate={{ offsetDistance: '100%' }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
          style={{
            offsetPath: "path('M30 80 Q 110 30, 160 80 T 290 80')",
            offsetRotate: '0deg',
          }}
        >
          <circle r="6" fill="hsl(var(--primary))" />
          <text textAnchor="middle" y="3" fontSize="8" fill="hsl(var(--primary-foreground))">📦</text>
        </motion.g>

        {/* Pulsing dot at destination */}
        <motion.circle
          cx={290}
          cy={80}
          r={11}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={1}
          animate={{ r: [11, 18, 11], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        />
      </svg>
    </div>
  );
}
