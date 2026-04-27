import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, Loader2, RefreshCw, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useEffect, useMemo, useRef, useState, createContext, useContext, type ReactNode } from 'react';
import { PublicNav } from '@/components/PublicNav';

/* =========================================================================
   Continuous-flow primitives — Apple-grade.
   Two themes: 'light' (white, like landing) | 'dark' (zinc-950 / yellow).
   ========================================================================= */

type FlowTheme = 'light' | 'dark';
const ThemeCtx = createContext<FlowTheme>('light');
const useFlowTheme = () => useContext(ThemeCtx);

/** Theme-aware token strings. */
const T = {
  light: {
    shell: 'bg-background text-foreground',
    muted: 'text-muted-foreground',
    border: 'border-border',
    card: 'bg-card',
    cardActive: 'border-foreground bg-foreground/[0.03]',
    cardIdle: 'border-border bg-card hover:border-foreground/40 hover:-translate-y-0.5',
    accent: 'text-foreground',
    inputBg: 'bg-card',
    inputPlaceholder: 'placeholder:text-muted-foreground/60',
    skeleton: 'border-border bg-secondary/40',
    summaryBar: 'border-border bg-background/95 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.08)]',
    cta: 'bg-foreground text-background hover:bg-foreground/90',
    badgeBg: 'bg-secondary',
    info: 'border-border bg-secondary/50 text-muted-foreground',
    strong: 'text-foreground',
    iconBg: 'bg-foreground text-background',
    iconBgIdle: 'bg-secondary text-muted-foreground',
    sliderAccent: 'accent-foreground',
    toggleOn: 'bg-foreground',
    toggleOff: 'bg-border',
    toggleHandle: 'bg-background',
    eyebrow: 'text-muted-foreground',
  },
  dark: {
    shell: 'bg-zinc-950 text-white',
    muted: 'text-white/55',
    border: 'border-white/10',
    card: 'bg-white/[0.02]',
    cardActive: 'border-yellow-400 bg-yellow-400/10 shadow-[0_0_0_1px_rgba(250,204,21,0.6)]',
    cardIdle: 'border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]',
    accent: 'text-yellow-400',
    inputBg: 'bg-white/[0.03]',
    inputPlaceholder: 'placeholder:text-white/30',
    skeleton: 'border-white/10 bg-white/[0.02]',
    summaryBar: 'border-white/10 bg-zinc-950/95',
    cta: 'bg-yellow-400 text-zinc-950 hover:bg-yellow-300',
    badgeBg: 'bg-yellow-400/15',
    info: 'border-white/10 bg-white/[0.03] text-white/70',
    strong: 'text-white',
    iconBg: 'bg-yellow-400 text-zinc-950',
    iconBgIdle: 'bg-white/10 text-white/70',
    sliderAccent: 'accent-yellow-400',
    toggleOn: 'bg-yellow-400',
    toggleOff: 'bg-white/15',
    toggleHandle: 'bg-white',
    eyebrow: 'text-yellow-400/80',
  },
} as const;

export function FlowShell({
  children,
  theme = 'light',
  compactHeader,
}: {
  children: ReactNode;
  theme?: FlowTheme;
  compactHeader?: ReactNode;
}) {
  const t = T[theme];
  const navHidden = !!compactHeader;

  // Persist theme on <html> + <body> so background, scroll-bg, and overscroll
  // areas all match — no white flash around the dark Recevoir flow.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.backgroundColor;
    const prevBodyBg = body.style.backgroundColor;
    const prevColorScheme = html.style.colorScheme;
    if (theme === 'dark') {
      html.style.backgroundColor = 'rgb(9 9 11)';   // zinc-950
      body.style.backgroundColor = 'rgb(9 9 11)';
      html.style.colorScheme = 'dark';
    } else {
      html.style.backgroundColor = 'hsl(var(--background))';
      body.style.backgroundColor = 'hsl(var(--background))';
      html.style.colorScheme = 'light';
    }
    return () => {
      html.style.backgroundColor = prevHtmlBg;
      body.style.backgroundColor = prevBodyBg;
      html.style.colorScheme = prevColorScheme;
    };
  }, [theme]);

  return (
    <ThemeCtx.Provider value={theme}>
      <div className={cn('min-h-screen', t.shell)}>
        {!navHidden && <PublicNav hideActions />}
        <main className="mx-auto w-full max-w-3xl px-5 sm:px-8 pb-40">
          {compactHeader ? (
            compactHeader
          ) : (
            <Link
              to="/"
              className={cn('inline-flex items-center gap-1.5 text-xs hover:opacity-100 transition-opacity mt-6', t.muted)}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Retour
            </Link>
          )}
          {children}
        </main>
      </div>
    </ThemeCtx.Provider>
  );
}

/** Compact header used when flow is fused into selection page. */
export function FlowCompactHeader({
  eyebrow, title, onSwap, swapLabel, theme = 'light',
}: {
  eyebrow: string;
  title: string;
  onSwap: () => void;
  swapLabel: string;
  theme?: FlowTheme;
}) {
  const t = T[theme];
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className={cn('sticky top-0 z-40 -mx-5 sm:-mx-8 px-5 sm:px-8 py-4 backdrop-blur-md border-b',
        theme === 'dark' ? 'bg-zinc-950/85 border-white/10' : 'bg-background/85 border-border'
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className={cn('text-[10px] uppercase tracking-[0.18em] font-medium', t.eyebrow)}>{eyebrow}</p>
          <h1 className="mt-0.5 text-base sm:text-lg font-bold tracking-tight truncate">{title}</h1>
        </div>
        <button
          onClick={onSwap}
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 transition-all shrink-0',
            theme === 'dark'
              ? 'border border-white/15 hover:border-white/40 text-white/80 hover:text-white'
              : 'border border-border hover:border-foreground text-muted-foreground hover:text-foreground'
          )}
        >
          <RefreshCw className="w-3 h-3" /> {swapLabel}
        </button>
      </div>
    </motion.div>
  );
}

export function FlowHero({
  eyebrow, title, subtitle, info,
}: {
  eyebrow: string; title: string; subtitle: string; info?: ReactNode;
}) {
  const theme = useFlowTheme();
  const t = T[theme];
  return (
    <section className="pt-8 sm:pt-12 pb-6">
      <motion.p
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className={cn('text-[11px] uppercase tracking-[0.18em] font-medium', t.eyebrow)}
      >
        {eyebrow}
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}
        className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight leading-[1.05] text-balance"
      >
        {title}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.15 }}
        className={cn('mt-4 text-base sm:text-lg max-w-xl text-pretty leading-relaxed', t.muted)}
      >
        {subtitle}
      </motion.p>
      {info && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.25 }}
          className={cn('mt-6 rounded-xl border px-4 py-3 text-xs leading-relaxed', t.info)}
        >
          {info}
        </motion.div>
      )}
    </section>
  );
}

export function FlowSection({
  revealed, label, title, hint, children, step, total,
}: {
  revealed: boolean;
  label?: string;
  title: string;
  hint?: string;
  children: ReactNode;
  /** Optional progress: shows "Étape N · Total" pill in the section header. */
  step?: number;
  total?: number;
}) {
  const theme = useFlowTheme();
  const t = T[theme];
  const ref = useRef<HTMLElement>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    if (revealed && !scrolled.current && ref.current) {
      scrolled.current = true;
      setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 250);
    }
  }, [revealed]);

  const showProgress = step != null && total != null;
  const pct = showProgress ? Math.min(100, Math.round((step! / total!) * 100)) : 0;

  return (
    <AnimatePresence initial={false}>
      {revealed && (
        <motion.section
          ref={ref}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
          className={cn('py-10 border-t first:border-t-0 scroll-mt-24', t.border)}
        >
          {showProgress && (
            <div className="flex items-center gap-3 mb-3">
              <div className={cn('h-0.5 w-10 rounded-full overflow-hidden',
                theme === 'dark' ? 'bg-white/10' : 'bg-border'
              )}>
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className={theme === 'dark' ? 'h-full bg-yellow-400' : 'h-full bg-foreground'}
                />
              </div>
              <p className={cn('text-[10px] uppercase tracking-[0.18em] font-medium tabular-nums', t.muted)}>
                Étape {step} <span className="opacity-50">/ {total}</span>
              </p>
            </div>
          )}
          {label && (
            <p className={cn('text-[10px] uppercase tracking-[0.18em] font-medium mb-2', t.muted)}>
              {label}
            </p>
          )}
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">{title}</h2>
          {hint && <p className={cn('mt-2 text-sm', t.muted)}>{hint}</p>}
          <div className="mt-6">{children}</div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

/* ─────────── Inputs / selectors ─────────── */

interface ChipGroupProps<T2 extends string> {
  options: { id: T2; label: string; desc?: string; icon?: ReactNode }[];
  value: T2 | null;
  onChange: (v: T2) => void;
}
export function ChipGroup<T2 extends string>({ options, value, onChange }: ChipGroupProps<T2>) {
  const theme = useFlowTheme();
  const t = T[theme];
  return (
    <div className="grid sm:grid-cols-3 gap-2.5">
      {options.map(o => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              'group relative text-left rounded-xl border-2 px-4 py-3.5 transition-all',
              active ? t.cardActive : t.cardIdle
            )}
          >
            <div className="flex items-center gap-2">
              {o.icon && <span className={cn(t.muted, active && t.accent)}>{o.icon}</span>}
              <span className="text-sm font-semibold">{o.label}</span>
              {active && <Check className={cn('w-3.5 h-3.5 ml-auto', t.accent)} strokeWidth={3} />}
            </div>
            {o.desc && <p className={cn('mt-1 text-xs leading-relaxed', t.muted)}>{o.desc}</p>}
          </button>
        );
      })}
    </div>
  );
}

export function CountryGrid({
  countries, value, onChange,
}: {
  countries: { id: string; flag: string; label: string }[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  const theme = useFlowTheme();
  const t = T[theme];
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {countries.map(c => {
        const active = value === c.id;
        return (
          <button
            key={c.id}
            onClick={() => onChange(c.id)}
            className={cn(
              'rounded-xl border-2 py-3 text-center transition-all',
              active ? t.cardActive : t.cardIdle
            )}
          >
            <div className="text-2xl leading-none">{c.flag}</div>
            <div className="mt-1.5 text-[11px] font-medium opacity-80">{c.label}</div>
          </button>
        );
      })}
    </div>
  );
}

export function TextField({
  label, value, onChange, placeholder, type = 'text', icon, suffix,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: ReactNode;
  suffix?: ReactNode;
}) {
  const theme = useFlowTheme();
  const t = T[theme];
  return (
    <label className="block">
      {label && <span className={cn('block text-xs mb-1.5 font-medium', t.muted)}>{label}</span>}
      <div className="relative">
        {icon && <span className={cn('absolute left-3.5 top-1/2 -translate-y-1/2', t.muted)}>{icon}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'w-full border-2 rounded-xl px-4 py-3.5 text-base focus:outline-none transition-all',
            t.inputBg, t.border, t.inputPlaceholder,
            theme === 'dark' ? 'focus:border-yellow-400/60' : 'focus:border-foreground',
            icon && 'pl-10', suffix && 'pr-14'
          )}
        />
        {suffix && <span className={cn('absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium', t.muted)}>{suffix}</span>}
      </div>
    </label>
  );
}

export function NumberSlider({
  label, value, onChange, min, max, step = 1, unit,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number; unit?: string;
}) {
  const theme = useFlowTheme();
  const t = T[theme];
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className={cn('text-xs font-medium', t.muted)}>{label}</span>
        <span className="text-base font-bold tabular-nums">
          {value}{unit && <span className={cn('ml-1 font-normal', t.muted)}>{unit}</span>}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn('w-full mt-3', t.sliderAccent)}
      />
      <div className={cn('flex justify-between text-[10px] mt-1', t.muted)}>
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

export function ToggleRow({
  label, desc, value, onChange,
}: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  const theme = useFlowTheme();
  const t = T[theme];
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        'w-full flex items-center justify-between gap-4 rounded-xl border-2 px-4 py-3.5 text-left transition-all',
        value ? t.cardActive : t.cardIdle
      )}
    >
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {desc && <p className={cn('mt-0.5 text-xs', t.muted)}>{desc}</p>}
      </div>
      <span className={cn('relative w-10 h-6 rounded-full transition-colors shrink-0', value ? t.toggleOn : t.toggleOff)}>
        <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform shadow-sm', t.toggleHandle, value && 'translate-x-4')} />
      </span>
    </button>
  );
}

/* ─────────── Konnekt match options ─────────── */

export interface MatchOptionView {
  id: 'fast' | 'economy' | 'volume';
  label: string;
  eta_days: string;
  price_eur: number;
  departure_date?: string | null;
  highlight?: string;
}

export function MatchOptionCard({
  opt, active, onClick, icon,
}: {
  opt: MatchOptionView; active: boolean; onClick: () => void; icon: ReactNode;
}) {
  const theme = useFlowTheme();
  const t = T[theme];
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative text-left rounded-2xl border-2 p-5 transition-all',
        active ? t.cardActive : t.cardIdle
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center transition-colors', active ? t.iconBg : t.iconBgIdle)}>
          {icon}
        </div>
        {opt.highlight && (
          <span className={cn('text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md', t.badgeBg, t.accent)}>
            {opt.highlight}
          </span>
        )}
      </div>
      <p className="mt-4 text-base font-bold">{opt.label}</p>
      <p className={cn('mt-1 text-xs', t.muted)}>{opt.eta_days}</p>
      <p className="mt-3 text-2xl font-bold tabular-nums">
        {opt.price_eur.toLocaleString('fr-FR')} <span className={cn('text-sm font-medium', t.muted)}>€</span>
      </p>
      {opt.departure_date && (
        <p className={cn('mt-1 text-[11px]', t.muted)}>Départ {new Date(opt.departure_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
      )}
    </button>
  );
}

/* ─────────── Live summary sticky bar ─────────── */

export function LiveSummaryBar({
  visible, summary, ctaLabel, onSubmit, submitting, sideContent,
}: {
  visible: boolean;
  summary: string;
  ctaLabel: string;
  onSubmit: () => void;
  submitting: boolean;
  sideContent?: ReactNode;
}) {
  const theme = useFlowTheme();
  const t = T[theme];
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className={cn('fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-lg', t.summaryBar)}
        >
          <div className="mx-auto max-w-3xl px-5 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
            <div className="min-w-0 flex-1">
              <p className={cn('text-[10px] uppercase tracking-[0.18em] font-medium', t.eyebrow)}>Récapitulatif</p>
              <p className="mt-1 text-sm font-semibold truncate">{summary}</p>
              {sideContent && <p className={cn('text-[11px] mt-0.5 truncate', t.muted)}>{sideContent}</p>}
            </div>
            <button
              onClick={onSubmit}
              disabled={submitting}
              className={cn(
                'inline-flex items-center justify-center gap-2 font-bold rounded-xl px-6 py-3.5 text-sm active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed',
                t.cta
              )}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {ctaLabel}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─────────── Success screen ─────────── */

export function FlowSuccess({
  reference, title, subtitle, ctaHref, ctaLabel,
}: {
  reference: string; title: string; subtitle: string;
  ctaHref: string; ctaLabel: string;
}) {
  const theme = useFlowTheme();
  const t = T[theme];
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      className="py-16 sm:py-24 text-center"
    >
      <div className={cn('inline-flex w-16 h-16 rounded-2xl items-center justify-center', t.iconBg)}>
        <Check className="w-8 h-8" strokeWidth={3} />
      </div>
      <h2 className="mt-6 text-3xl sm:text-4xl font-bold tracking-tight">{title}</h2>
      <p className={cn('mt-3 text-base max-w-md mx-auto', t.muted)}>{subtitle}</p>
      <div className={cn('mt-6 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5', t.border, t.card)}>
        <span className={cn('text-[11px] uppercase tracking-wider', t.muted)}>Réf.</span>
        <span className="text-sm font-mono font-semibold">{reference}</span>
      </div>
      <div className="mt-8">
        <Link
          to={ctaHref}
          className={cn('inline-flex items-center gap-2 font-bold rounded-xl px-6 py-3.5 text-sm transition-all', t.cta)}
        >
          {ctaLabel}
        </Link>
      </div>
    </motion.section>
  );
}
