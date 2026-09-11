import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CreditCard, FileText, ArrowRight } from 'lucide-react';
import { useDossiers } from '@/hooks/useDossiers';
import { Skeleton } from '@/components/ui/skeleton';
import type { Dossier } from '@/lib/types';

function amountOf(d: Dossier): number | null {
  const any = d as any;
  return any.final_amount_xof ?? any.quote_amount_xof ?? any.total_amount_xof ?? null;
}

function fmtDate(date?: string | null): string {
  if (!date) return '';
  try {
    return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

/** Deux écrans jumeaux : « Mes paiements » (à régler) et « Mes factures » (réglés). */
export function BillingView({ mode }: { mode: 'payments' | 'invoices' }) {
  const navigate = useNavigate();
  const { dossiers, isLoading } = useDossiers();

  const list = dossiers.filter((d) =>
    mode === 'payments'
      ? d.payment_status === 'pending' && d.status !== 'CLOSED' && d.status !== 'CANCELLED'
      : d.payment_status === 'paid'
  );

  const total = list.reduce((sum, d) => sum + (amountOf(d) ?? 0), 0);
  const Icon = mode === 'payments' ? CreditCard : FileText;

  return (
    <div className="space-y-5 pb-28 md:pb-12">
      <motion.header initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-muted-foreground">
          {mode === 'payments' ? 'Paiements' : 'Factures'}
        </p>
        <h1 className="mt-1.5 text-[1.5rem] sm:text-3xl font-bold tracking-tight text-foreground">
          {mode === 'payments' ? 'Mes paiements' : 'Mes factures'}
        </h1>
        <p className="mt-1.5 text-[13px] sm:text-sm text-muted-foreground max-w-md">
          {mode === 'payments'
            ? 'Les montants restant à régler sur vos dossiers en cours.'
            : 'Vos dossiers déjà réglés, avec le détail de chaque montant.'}
        </p>
      </motion.header>

      <div className="rounded-2xl border border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-[#F5C518]/15 text-[#F5C518] flex items-center justify-center">
            <Icon className="w-4 h-4" />
          </span>
          <div>
            <p className="text-[11px] text-muted-foreground">
              {mode === 'payments' ? 'Total à régler' : 'Total réglé'}
            </p>
            <p className="text-lg font-bold tabular-nums text-foreground">
              {new Intl.NumberFormat('fr-FR').format(total)} FCFA
            </p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{list.length} dossier{list.length > 1 ? 's' : ''}</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-10 px-6 text-center">
          <Icon className="w-6 h-6 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-semibold text-foreground">
            {mode === 'payments' ? 'Rien à régler pour le moment' : 'Aucune facture pour le moment'}
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            {mode === 'payments'
              ? 'Vos paiements en attente apparaîtront ici dès qu’un dossier sera chiffré.'
              : 'Vos dossiers réglés apparaîtront ici avec leur montant.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/expedier')}
            className="mt-4 inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[#F5C518] text-zinc-950 text-sm font-semibold hover:bg-[#F5C518]/90 transition-colors"
          >
            Nouvelle expédition <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border divide-y divide-border overflow-hidden">
          {list.map((d) => {
            const amt = amountOf(d);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => navigate(`/app/dossier/${d.id}`)}
                className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-foreground/5 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">{d.reference}</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {d.origin_city ?? d.origin_country} → {d.destination_city ?? d.destination_country}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {mode === 'payments' ? 'Créé le ' : 'Réglé · '}{fmtDate(d.created_at)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {amt ? `${new Intl.NumberFormat('fr-FR').format(amt)} FCFA` : '—'}
                  </p>
                  <span className={`text-[10px] font-semibold ${mode === 'payments' ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {mode === 'payments' ? 'À régler' : 'Payé'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
