import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileSearch, Plus, ArrowRight, Check } from 'lucide-react';
import { useDossiers } from '@/hooks/useDossiers';
import { Skeleton } from '@/components/ui/skeleton';

const QUOTE_STATUSES = new Set(['QUOTE_REQUESTED', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'QUOTE_REFUSED']);

function fmtShort(date?: string | null): string {
  if (!date) return '';
  try {
    return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

export function QuotesView() {
  const navigate = useNavigate();
  const { dossiers, isLoading } = useDossiers();
  const quotes = dossiers.filter((d) => QUOTE_STATUSES.has(d.status as any));

  return (
    <div className="space-y-5 pb-28 md:pb-12">
      <motion.header initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-muted-foreground">Devis</p>
        <h1 className="mt-1.5 text-[1.5rem] sm:text-3xl font-bold tracking-tight text-foreground">Mes devis</h1>
        <p className="mt-1.5 text-[13px] sm:text-sm text-muted-foreground max-w-md">
          Vos demandes de devis et les propositions reçues, au même endroit.
        </p>
      </motion.header>

      {/* Incentive nouvelle demande */}
      <button
        type="button"
        onClick={() => navigate('/demande-devis')}
        className="w-full flex items-center gap-3 rounded-2xl border border-dashed border-[#F5C518]/50 bg-[#F5C518]/5 px-4 py-3 text-left hover:bg-[#F5C518]/10 transition-colors"
      >
        <span className="shrink-0 w-9 h-9 rounded-xl bg-[#F5C518]/20 text-[#F5C518] flex items-center justify-center">
          <Plus className="w-4 h-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">Demander un nouveau devis</span>
          <span className="block text-[11px] text-muted-foreground">GP, aérien, maritime ou routier — réponse sous 24h.</span>
        </span>
        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : quotes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-10 px-6 text-center">
          <FileSearch className="w-6 h-6 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-semibold text-foreground">Aucun devis pour l'instant</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Dites-nous ce que vous voulez envoyer : nous chiffrons votre trajet et vous répondons rapidement.
          </p>
          <button
            type="button"
            onClick={() => navigate('/demande-devis')}
            className="mt-4 inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[#F5C518] text-zinc-950 text-sm font-semibold hover:bg-[#F5C518]/90 transition-colors"
          >
            Demander un devis <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {quotes.map((d) => {
            const status = d.status as string;
            const amt = d.quote_amount_xof;
            const label =
              status === 'QUOTE_REQUESTED' ? 'Demande envoyée · en attente de réponse'
              : status === 'QUOTE_SENT' ? 'Devis reçu — à valider'
              : status === 'QUOTE_ACCEPTED' ? 'Devis accepté'
              : 'Devis refusé';
            const color =
              status === 'QUOTE_REQUESTED' ? 'text-amber-500'
              : status === 'QUOTE_SENT' ? 'text-[#F5C518]'
              : status === 'QUOTE_ACCEPTED' ? 'text-emerald-500'
              : 'text-rose-500';
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => navigate(`/app/dossier/${d.id}`)}
                className="w-full text-left rounded-2xl border border-border bg-card p-3.5 hover:border-foreground/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">{d.reference}</p>
                    <p className="font-semibold text-foreground truncate">
                      {d.origin_city ?? d.origin_country} → {d.destination_city ?? d.destination_country}
                    </p>
                    <p className={`text-xs mt-1 font-medium ${color}`}>{label}</p>
                  </div>
                  {amt ? (
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold tabular-nums">{new Intl.NumberFormat('fr-FR').format(amt)} FCFA</p>
                      {d.quote_valid_until && (
                        <p className="text-[10px] text-muted-foreground">valide → {fmtShort(d.quote_valid_until)}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground shrink-0">…</span>
                  )}
                </div>
                {status === 'QUOTE_SENT' && (
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-[#F5C518] font-semibold">
                    <Check className="w-3 h-3" /> Ouvrir pour compléter et accepter
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
