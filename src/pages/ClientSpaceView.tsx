import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Package as PackageIcon, CreditCard, FileText, MessageCircle, ArrowRight, Inbox, Search, Check } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useDossiers } from '@/hooks/useDossiers';
import { useDossiersRealtime } from '@/hooks/useDossiersRealtime';
import { ClientDossierCard } from '@/components/client/ClientDossierCard';
import type { Dossier } from '@/lib/types';

const QUOTE_STATUSES = new Set(['QUOTE_REQUESTED', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'QUOTE_REFUSED']);

const QUOTE_FILTER = (d: Dossier) =>
  QUOTE_STATUSES.has((d as any).status);

const ACTIVE_FILTER = (d: Dossier) =>
  d.status !== 'DELIVERED' && d.status !== 'CLOSED' && !QUOTE_STATUSES.has(d.status as any);

const HISTORY_FILTER = (d: Dossier) =>
  d.status === 'DELIVERED' || d.status === 'CLOSED';

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

  const firstName = useMemo(() => {
    if (!profile?.full_name) return '';
    return profile.full_name.split(' ')[0];
  }, [profile?.full_name]);

  const active = dossiers.filter(ACTIVE_FILTER);
  const history = dossiers.filter(HISTORY_FILTER).slice(0, 5);
  const pendingCount = dossiers.filter((d) => d.payment_status === 'pending' && d.status !== 'CLOSED').length;
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

      {/* Empty state guidé — 3 étapes pour un premier envoi */}
      {isEmpty && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-10 px-4 border border-dashed border-border rounded-2xl"
        >
          <div className="mx-auto w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <Inbox className="w-7 h-7 text-muted-foreground" />
          </div>
          <h2 className="text-base font-semibold text-foreground text-center">
            Bienvenue sur votre espace Yobbanté
          </h2>
          <p className="text-sm text-muted-foreground mt-1 mb-6 text-center">
            Envoyer un colis prend 3 minutes. Voici comment ça se passe :
          </p>
          <ol className="space-y-3 max-w-md mx-auto mb-6">
            {[
              { n: 1, t: 'Décrivez votre colis', d: 'Poids, contenu, destination — devis instantané.' },
              { n: 2, t: 'On vient le chercher', d: 'Collecte gratuite à Dakar par un transporteur vérifié.' },
              { n: 3, t: 'Livré et suivi', d: 'Notifications WhatsApp à chaque étape jusqu\'à la livraison.' },
            ].map((s) => (
              <li key={s.n} className="flex gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-[#F5C518] text-zinc-950 text-xs font-bold flex items-center justify-center">
                  {s.n}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{s.t}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => navigate('/expedier')}
              className="inline-flex items-center gap-1.5 h-11 px-5 rounded-xl bg-[#F5C518] text-zinc-950 text-sm font-semibold hover:bg-[#F5C518]/90 transition-colors"
            >
              Envoyer mon premier colis <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Mes expéditions en cours */}
      {!isEmpty && (
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
          <div className="grid grid-cols-3 gap-2.5">
            <QuickAction icon={PackageIcon} label="Nouveau colis" onClick={() => navigate('/expedier')} />
            <QuickAction
              icon={CreditCard}
              label="Mes paiements"
              badge={pendingCount > 0 ? pendingCount : undefined}
              onClick={() => navigate('/app?view=envois&filter=pending')}
            />
            <QuickAction icon={FileText} label="Mes factures" onClick={() => navigate('/app?view=envois&filter=invoices')} />
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
                    {d.destination_city ?? d.destination_country} · Livré le {fmtShort(d.delivered_at ?? d.updated_at)}
                  </p>
                </div>
                <span className="text-xs text-[#F5C518] font-medium inline-flex items-center gap-1 shrink-0">
                  Voir <ArrowRight className="w-3 h-3" />
                </span>
              </button>
            ))}
          </div>
          {dossiers.filter(HISTORY_FILTER).length > 5 && (
            <button
              type="button"
              onClick={() => navigate('/app?view=envois&filter=history')}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              Voir tout l'historique <ArrowRight className="w-3 h-3" />
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
