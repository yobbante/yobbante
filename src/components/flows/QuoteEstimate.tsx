import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, ShieldCheck, ChevronDown, AlertTriangle } from 'lucide-react';
import type { Quote } from '@/hooks/useQuote';

const fmtXof = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n));

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const CONFIDENCE_LABEL: Record<Quote['confidence'], string> = {
  high: 'Estimation fiable',
  medium: 'Estimation indicative',
  low: 'Estimation provisoire',
};

const CONFIDENCE_DOT: Record<Quote['confidence'], string> = {
  high: 'bg-emerald-500',
  medium: 'bg-amber-500',
  low: 'bg-muted-foreground',
};

const MODE_LABEL: Record<string, string> = {
  air: 'Aérien',
  sea_lcl: 'Maritime LCL',
  road: 'Routier',
  AIR: 'Aérien',
  SEA: 'Maritime',
  ROAD: 'Routier',
};

interface Props {
  quote: Quote | null;
  loading: boolean;
  error: string | null;
}

/**
 * Real-time pricing card v2 — XOF principal + EUR équivalent.
 * Skeleton while loading, fallback message when no price.
 * Detail panel shows the full v2 breakdown (zone, poids volumétrique, multiplicateurs).
 */
export function QuoteEstimate({ quote, loading, error }: Props) {
  const [showDebug, setShowDebug] = useState(false);
  const isFallback = !!quote?.fallback_mode || error === 'fallback';

  return (
    <AnimatePresence mode="wait">
      {loading && (
        <motion.div
          key="loading"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="rounded-2xl border border-border bg-secondary/40 p-5 h-28 animate-pulse"
          aria-label="Calcul du devis en cours"
        />
      )}

      {!loading && !quote && error && (
        <motion.div
          key="error"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
        >
          Nous cherchons la meilleure option pour vous. Le prix sera confirmé sous peu.
        </motion.div>
      )}

      {!loading && quote && (
        <motion.div
          key="quote"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-foreground/10 bg-gradient-to-br from-background to-secondary/40 p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Votre estimation
              </div>
              {/* XOF principal, EUR secondaire */}
              <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                <div className="text-3xl font-bold tracking-tight tabular-nums">
                  {fmtXof(quote.price_xof)} <span className="text-base font-medium text-muted-foreground">XOF</span>
                </div>
                <div className="text-sm text-muted-foreground tabular-nums">
                  ≈ {fmtEur(quote.price_eur)}
                </div>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {quote.estimated_delivery} · {MODE_LABEL[quote.transport_mode] ?? MODE_LABEL[quote.transport_type] ?? quote.transport_type}
                {quote.zone_id && <span className="opacity-60"> · {quote.zone_id}</span>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-1 text-[11px] font-medium">
                <span className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_DOT[quote.confidence]}`} />
                {CONFIDENCE_LABEL[quote.confidence]}
              </span>
              {!isFallback && quote.breakdown.supply_mult < 1 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                  <TrendingUp className="w-3 h-3 rotate-180" /> Offre abondante
                </span>
              )}
              {!isFallback && quote.breakdown.supply_mult > 1 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                  <TrendingUp className="w-3 h-3" /> Capacité limitée
                </span>
              )}
            </div>
          </div>

          {/* Validation messages */}
          {quote.validation_errors?.length > 0 && (
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-800 space-y-1">
              {quote.validation_errors.map((m, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{m}</span>
                </div>
              ))}
            </div>
          )}

          {quote.requires_manual_quote && (
            <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-[12px] text-blue-800">
              Volume important : un de nos experts vous contacte pour un devis sur-mesure.
            </div>
          )}

          {quote.insurance_required && (
            <div className="mt-2 text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Assurance obligatoire (marchandise de valeur)
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Suivi & assurance</span>
              <span className="inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Marge plateforme incluse</span>
            </div>
            <button
              type="button"
              onClick={() => setShowDebug(v => !v)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-foreground/5"
              aria-expanded={showDebug}
            >
              Détails <ChevronDown className={`w-3 h-3 transition-transform ${showDebug ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <AnimatePresence>
            {showDebug && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-3 overflow-hidden"
              >
                <div className="rounded-lg border border-foreground/10 bg-background/60 p-3 text-[11px] space-y-1.5 font-mono">
                  <Row k="Zone" v={`${quote.zone_id} — ${quote.zone_name}`} />
                  <Row k="Poids réel" v={`${quote.taxable_weight_kg.toFixed(1)} kg`} />
                  {quote.volumetric_weight_kg > 0 && (
                    <Row k="Poids volumétrique" v={`${quote.volumetric_weight_kg.toFixed(1)} kg`} />
                  )}
                  <Row k="Poids taxable" v={`${quote.taxable_weight_kg.toFixed(1)} kg`} />
                  <div className="pt-1 border-t border-foreground/10" />
                  <Row k="Prix de base" v={`${fmtXof(quote.breakdown.base_price_xof)} XOF`} />
                  <Row k="Coût additionnel poids" v={`${fmtXof(quote.breakdown.weight_cost_xof)} XOF`} />
                  <Row k="Sous-total brut" v={`${fmtXof(quote.breakdown.raw_price_xof)} XOF`} />
                  <div className="pt-1 border-t border-foreground/10" />
                  <Row k="× palier de poids" v={`× ${quote.breakdown.weight_bracket_mult}`} />
                  <Row k="× type de marchandise" v={`× ${quote.breakdown.goods_mult}`} />
                  <Row k="× urgence" v={`× ${quote.breakdown.urgency_mult}`} />
                  <Row k="× offre Konnekt" v={`× ${quote.breakdown.supply_mult}`} />
                  <Row k="× marge plateforme" v={`× ${quote.breakdown.margin_mult}`} />
                  <Row k="Départs Konnekt ouverts" v={String(quote.breakdown.open_departures)} />
                  <div className="pt-1.5 border-t border-foreground/10 flex items-center justify-between font-semibold">
                    <span>Prix final</span>
                    <span>{fmtXof(quote.price_xof)} XOF · {fmtEur(quote.price_eur)}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{k}</span>
      <span className="text-foreground">{v}</span>
    </div>
  );
}
