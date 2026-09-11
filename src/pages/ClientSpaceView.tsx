import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Package as PackageIcon, CreditCard, FileText, MessageCircle, ArrowRight, Inbox, Search, Check } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useDossiers } from '@/hooks/useDossiers';
import { useDossiersRealtime } from '@/hooks/useDossiersRealtime';
import { ClientDossierCard } from '@/components/client/ClientDossierCard';
import type { Dossier } from '@/lib/types';

const QUOTE_STATUSES = new Set(['QUOTE_REQUESTED', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'QUOTE_REFUSED']);

/** Statuts terminaux : le dossier rejoint l'historique (livré, clos, annulé, archivé, retourné). */
const TERMINAL_STATUSES = new Set(['DELIVERED', 'CLOSED', 'CANCELLED', 'ARCHIVED', 'RETURNED']);

const QUOTE_FILTER = (d: Dossier) =>
  QUOTE_STATUSES.has((d as any).status);

const ACTIVE_FILTER = (d: Dossier) =>
  !TERMINAL_STATUSES.has(d.status as any) && !QUOTE_STATUSES.has(d.status as any);

const HISTORY_FILTER = (d: Dossier) =>
  TERMINAL_STATUSES.has(d.status as any);

const HISTORY_LABEL: Record<string, string> = {
  DELIVERED: 'Livré le',
  CLOSED: 'Clôturé le',
  CANCELLED: 'Annulé le',
  ARCHIVED: 'Archivé le',
  RETURNED: 'Retourné le',
};

function fmtShort(date?: string | null): string {
  if (!date) return '';
  try {
    return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

export function ClientSpaceView() {
  const navigate = useNavigate();
  
  const { profile } = useProfile();
  const { dossiers, isLoading } = useDossiers();
  useDossiersRealtime();
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Le rattachement du colis suivi en public est géré au niveau de l'app (Index).


  const firstName = useMemo(() => {
    if (!profile?.full_name) return '';
    return profile.full_name.split(' ')[0];
  }, [profile?.full_name]);

  const active = dossiers.filter(ACTIVE_FILTER);
  const quotes = dossiers.filter(QUOTE_FILTER);
  const allHistory = dossiers.filter(HISTORY_FILTER);
  const history = showAllHistory ? allHistory : allHistory.slice(0, 5);
  const pendingCount = dossiers.filter((d) => d.payment_status === 'pending' && d.status !== 'CLOSED').length;
  const paidCount = dossiers.filter((d) => d.payment_status === 'paid').length;
  const isEmpty = !isLoading && dossiers.length === 0;

  return (
    <div className="space-y-6 pb-28 md:pb-12 relative">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-3"
      >
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
            Bonjour {firstName || 'bienvenue'} <span className="inline-block">👋</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Votre espace Yobbanté</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/expedier')}
          className="hidden sm:inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[#F5C518] text-zinc-950 text-sm font-semibold hover:bg-[#F5C518]/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Nouvelle expédition
        </button>
      </motion.header>

      {/* Incentive compacte — premier envoi (le dashboard reste visible derrière) */}
      {isEmpty && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-card/60 px-3.5 py-2.5"
        >
          <span className="shrink-0 w-8 h-8 rounded-lg bg-[#F5C518]/15 text-[#F5C518] flex items-center justify-center">
            <Inbox className="w-4 h-4" />
          </span>
          <p className="text-xs text-muted-foreground min-w-0 flex-1 leading-snug">
            Premier envoi en 3 minutes : décrivez le colis, on vient le chercher à Dakar, suivi WhatsApp jusqu'à la livraison.
          </p>
          <button
            type="button"
            onClick={() => navigate('/expedier')}
            className="shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-[#F5C518] text-zinc-950 text-xs font-semibold hover:bg-[#F5C518]/90 transition-colors"
          >
            Commencer <ArrowRight className="w-3 h-3" />
          </button>
        </motion.div>
      )}

      {/* Mes expéditions en cours */}
      {(
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Mes expéditions en cours
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">{active.length}</span>
          </div>
          {active.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-2xl">
              Aucune expédition en cours.
            </div>
          ) : (
            <div className="space-y-3">
              {active.map((d) => <ClientDossierCard key={d.id} dossier={d} />)}
            </div>
          )}
        </section>
      )}

      {/* Actions rapides */}
      {!isEmpty && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Actions rapides
          </h2>
          <div className="grid grid-cols-4 gap-2.5">
            <QuickAction icon={PackageIcon} label="Nouveau colis" onClick={() => navigate('/expedier')} />
            <QuickAction
              icon={CreditCard}
              label="Mes paiements"
              badge={pendingCount > 0 ? pendingCount : undefined}
              onClick={() => navigate('/app?view=envois&filter=pending')}
            />
            <QuickAction
              icon={FileText}
              label="Mes factures"
              badge={paidCount > 0 ? paidCount : undefined}
              onClick={() => navigate('/app?view=envois&filter=invoices')}
            />
            <QuickAction
              icon={Search}
              label="Mes devis"
              badge={quotes.length > 0 ? quotes.length : undefined}
              onClick={() => {
                if (quotes.length > 0) {
                  document.getElementById('mes-devis')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                  navigate('/demande-devis');
                }
              }}
            />
          </div>
        </section>
      )}

      {/* Mes devis sur mesure */}
      {quotes.length > 0 && (
        <section id="mes-devis" className="scroll-mt-20">
          <div className="flex items-baseline justify-between mb-3 gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Search className="w-4 h-4" /> Mes devis
            </h2>
            <button
              type="button"
              onClick={() => navigate('/demande-devis')}
              className="text-xs font-semibold text-[#F5C518] hover:opacity-80"
            >
              Demander un devis
            </button>
          </div>
          <div className="space-y-2">
            {quotes.map((d) => {
              const status = (d as any).status;
              const amt = (d as any).quote_amount_xof as number | null | undefined;
              const validUntil = (d as any).quote_valid_until as string | null | undefined;
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
                        {validUntil && <p className="text-[10px] text-muted-foreground">valide → {fmtShort(validUntil)}</p>}
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
        </section>
      )}

      {/* Historique */}
      {history.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Historique
          </h2>
          <div className="rounded-2xl border border-border divide-y divide-border overflow-hidden">
            {history.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => navigate(`/app/dossier/${d.id}`)}
                className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-foreground/5 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-foreground">{d.reference}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {d.destination_city ?? d.destination_country} · {HISTORY_LABEL[d.status as string] ?? 'Terminé le'} {fmtShort(d.delivered_at ?? d.updated_at)}
                  </p>
                </div>
                <span className="text-xs text-[#F5C518] font-medium inline-flex items-center gap-1 shrink-0">
                  Voir <ArrowRight className="w-3 h-3" />
                </span>
              </button>
            ))}
          </div>
          {allHistory.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAllHistory((v) => !v)}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              {showAllHistory
                ? 'Réduire l\u2019historique'
                : `Voir tout l\u2019historique (${allHistory.length})`}
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </section>
      )}

      {/* Contact */}
      {!isEmpty && (
        <a
          href="https://wa.me/221786078080"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 hover:border-foreground/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-500/15 text-green-400 flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Besoin d'aide ?</p>
              <p className="text-[11px] text-muted-foreground">Notre équipe répond sur WhatsApp</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </a>
      )}

      {/* FAB mobile */}
      <button
        type="button"
        onClick={() => navigate('/expedier')}
        aria-label="Nouvelle expédition"
        className="sm:hidden fixed right-4 bottom-[72px] z-40 h-14 w-14 rounded-full bg-[#F5C518] text-zinc-950 shadow-lg shadow-[#F5C518]/30 flex items-center justify-center hover:bg-[#F5C518]/90 transition-colors"
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </button>
    </div>
  );
}

function QuickAction({
  icon: Icon, label, onClick, badge,
}: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; badge?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border border-border bg-card hover:border-foreground/30 transition-colors"
    >
      <Icon className="w-5 h-5 text-foreground" />
      <span className="text-[11px] text-foreground text-center leading-tight">{label}</span>
      {badge !== undefined && (
        <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold inline-flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}
