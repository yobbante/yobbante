import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/* =========================================================================
   Continuous-flow primitives — Apple-grade, navy + yellow brand.
   Used by SendFlow / ReceiveFlow / SourcingFlow.
   ========================================================================= */

export function FlowShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <FlowTopBar />
      <main className="mx-auto w-full max-w-3xl px-5 sm:px-8 pb-40">
        {children}
      </main>
    </div>
  );
}

function FlowTopBar() {
  return (
    <header className="sticky top-0 z-40 bg-zinc-950/85 backdrop-blur-md border-b border-white/10">
      <div className="mx-auto max-w-3xl px-5 sm:px-8 h-14 flex items-center justify-between">
        <Link to="/" className="text-sm font-bold tracking-tight">YOBBANTÉ</Link>
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Accueil
        </Link>
      </div>
    </header>
  );
}

export function FlowHero({
  eyebrow, title, subtitle, info,
}: {
  eyebrow: string; title: string; subtitle: string; info?: ReactNode;
}) {
  return (
    <section className="pt-10 sm:pt-16 pb-8">
      <motion.p
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="text-[11px] uppercase tracking-[0.18em] text-yellow-400/80 font-medium"
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
        className="mt-4 text-base sm:text-lg text-white/60 max-w-xl text-pretty"
      >
        {subtitle}
      </motion.p>
      {info && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.25 }}
          className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/70 leading-relaxed"
        >
          {info}
        </motion.div>
      )}
    </section>
  );
}

/**
 * Progressive disclosure block. Renders only when `revealed` is true.
 * No step number / no stepper — just a soft fade + slide-up.
 */
export function FlowSection({
  revealed, label, title, hint, children, dim = false,
}: {
  revealed: boolean;
  label?: string;
  title: string;
  hint?: string;
  children: ReactNode;
  dim?: boolean;
}) {
  return (
    <AnimatePresence initial={false}>
      {revealed && (
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: dim ? 0.55 : 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="py-10 border-t border-white/5 first:border-t-0"
        >
          {label && (
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/35 font-medium mb-2">
              {label}
            </p>
          )}
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">{title}</h2>
          {hint && <p className="mt-2 text-sm text-white/50">{hint}</p>}
          <div className="mt-6">{children}</div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

/* ─────────── Inputs / selectors ─────────── */

export function ChipGroup<T extends string>({
  options, value, onChange,
}: {
  options: { id: T; label: string; desc?: string; icon?: ReactNode }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid sm:grid-cols-3 gap-2.5">
      {options.map(o => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              'group relative text-left rounded-xl border px-4 py-3.5 transition-all',
              active
                ? 'border-yellow-400 bg-yellow-400/10 shadow-[0_0_0_1px_rgba(250,204,21,0.6)]'
                : 'border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]'
            )}
          >
            <div className="flex items-center gap-2">
              {o.icon && <span className={cn('text-white/60', active && 'text-yellow-400')}>{o.icon}</span>}
              <span className="text-sm font-semibold">{o.label}</span>
              {active && <Check className="w-3.5 h-3.5 text-yellow-400 ml-auto" />}
            </div>
            {o.desc && <p className="mt-1 text-xs text-white/50 leading-relaxed">{o.desc}</p>}
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
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {countries.map(c => {
        const active = value === c.id;
        return (
          <button
            key={c.id}
            onClick={() => onChange(c.id)}
            className={cn(
              'rounded-xl border py-3 text-center transition-all',
              active
                ? 'border-yellow-400 bg-yellow-400/10'
                : 'border-white/10 bg-white/[0.02] hover:border-white/25'
            )}
          >
            <div className="text-2xl leading-none">{c.flag}</div>
            <div className="mt-1.5 text-[11px] font-medium text-white/70">{c.label}</div>
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
  return (
    <label className="block">
      {label && <span className="block text-xs text-white/55 mb-1.5">{label}</span>}
      <div className="relative">
        {icon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">{icon}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3.5 text-base text-white placeholder:text-white/30',
            'focus:outline-none focus:border-yellow-400/60 focus:bg-white/[0.05] transition-all',
            icon && 'pl-10', suffix && 'pr-14'
          )}
        />
        {suffix && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-white/45">{suffix}</span>}
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
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-white/55">{label}</span>
        <span className="text-base font-semibold tabular-nums">
          {value}{unit && <span className="text-white/50 ml-1">{unit}</span>}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-3 accent-yellow-400"
      />
      <div className="flex justify-between text-[10px] text-white/35 mt-1">
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

export function ToggleRow({
  label, desc, value, onChange,
}: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        'w-full flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 text-left transition-all',
        value ? 'border-yellow-400/60 bg-yellow-400/5' : 'border-white/10 bg-white/[0.02] hover:border-white/25'
      )}
    >
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {desc && <p className="mt-0.5 text-xs text-white/50">{desc}</p>}
      </div>
      <span
        className={cn(
          'relative w-10 h-6 rounded-full transition-colors shrink-0',
          value ? 'bg-yellow-400' : 'bg-white/15'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
            value && 'translate-x-4'
          )}
        />
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
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative text-left rounded-2xl border p-5 transition-all',
        active
          ? 'border-yellow-400 bg-yellow-400/10 shadow-[0_0_0_1px_rgba(250,204,21,0.7)]'
          : 'border-white/10 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]'
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', active ? 'bg-yellow-400 text-zinc-950' : 'bg-white/10 text-white/70')}>
          {icon}
        </div>
        {opt.highlight && (
          <span className="text-[10px] uppercase tracking-wider text-yellow-400/90 font-semibold">
            {opt.highlight}
          </span>
        )}
      </div>
      <p className="mt-4 text-base font-bold">{opt.label}</p>
      <p className="mt-1 text-xs text-white/55">{opt.eta_days}</p>
      <p className="mt-3 text-2xl font-bold tabular-nums">
        {opt.price_eur.toLocaleString('fr-FR')} <span className="text-sm text-white/50 font-medium">€</span>
      </p>
      {opt.departure_date && (
        <p className="mt-1 text-[11px] text-white/40">Départ {new Date(opt.departure_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
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
  /** Optional second-line content (e.g. "Départ dans 2 j") */
  sideContent?: ReactNode;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-zinc-950/95 backdrop-blur-lg"
        >
          <div className="mx-auto max-w-3xl px-5 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.18em] text-yellow-400/80 font-medium">Récapitulatif</p>
              <p className="mt-1 text-sm font-semibold truncate">{summary}</p>
              {sideContent && <p className="text-[11px] text-white/50 mt-0.5 truncate">{sideContent}</p>}
            </div>
            <button
              onClick={onSubmit}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 bg-yellow-400 text-zinc-950 font-bold rounded-xl px-6 py-3.5 text-sm hover:bg-yellow-300 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
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
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      className="py-16 sm:py-24 text-center"
    >
      <div className="inline-flex w-16 h-16 rounded-2xl bg-yellow-400 text-zinc-950 items-center justify-center">
        <Check className="w-8 h-8" strokeWidth={3} />
      </div>
      <h2 className="mt-6 text-3xl sm:text-4xl font-bold tracking-tight">{title}</h2>
      <p className="mt-3 text-base text-white/60 max-w-md mx-auto">{subtitle}</p>
      <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
        <span className="text-[11px] uppercase tracking-wider text-white/50">Réf.</span>
        <span className="text-sm font-mono font-semibold">{reference}</span>
      </div>
      <div className="mt-8">
        <Link
          to={ctaHref}
          className="inline-flex items-center gap-2 bg-yellow-400 text-zinc-950 font-bold rounded-xl px-6 py-3.5 text-sm hover:bg-yellow-300 transition-all"
        >
          {ctaLabel}
        </Link>
      </div>
    </motion.section>
  );
}
