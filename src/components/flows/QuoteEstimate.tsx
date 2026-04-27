import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, ShieldCheck } from 'lucide-react';
import type { Quote } from '@/hooks/useQuote';

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

interface Props {
  quote: Quote | null;
  loading: boolean;
  error: string | null;
}

/**
 * Real-time pricing card. Renders nothing until inputs are valid.
 * Skeleton while loading, soft fallback on error.
 */
export function QuoteEstimate({ quote, loading, error }: Props) {
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

      {!loading && error && (
        <motion.div
          key="error"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
        >
          Nous cherchons la meilleure option pour vous. Le prix sera confirmé sous peu.
        </motion.div>
      )}

      {!loading && !error && quote && (
        <motion.div
          key="quote"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-foreground/10 bg-gradient-to-br from-background to-secondary/40 p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Votre estimation
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="text-3xl font-bold tracking-tight">{fmtEur(quote.price)}</div>
                <div className="text-xs text-muted-foreground">tout inclus</div>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Livraison {quote.eta_label} · {quote.transport_type === 'AIR' ? 'Aérien' : quote.transport_type === 'SEA' ? 'Maritime' : quote.transport_type}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-1 text-[11px] font-medium">
                <span className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_DOT[quote.confidence]}`} />
                {CONFIDENCE_LABEL[quote.confidence]}
              </span>
              {quote.breakdown.supply_adjustment_eur < 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                  <TrendingUp className="w-3 h-3 rotate-180" /> -10% offre abondante
                </span>
              )}
              {quote.breakdown.supply_adjustment_eur > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                  <TrendingUp className="w-3 h-3" /> +15% capacité limitée
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Suivi & assurance inclus</span>
            <span className="inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Marge plateforme incluse</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
