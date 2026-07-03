import { Wallet, Coins, TrendingUp, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminBrief } from '@/hooks/useAdminBrief';

const fmtXOF = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' FCFA';

/**
 * 4 cartes KPI Finances affichées en haut de la Vue Globale.
 * Zéro affichés en clair — jamais de skeleton infini.
 */
export function FinancesKpis({ onJump }: { onJump: (s: string) => void }) {
  const { data, isLoading } = useAdminBrief();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  const positiveMargin = data.marginMonthXof >= 0;

  const cards: Array<{
    icon: typeof Wallet; label: string; value: string; tone: string; onClick?: () => void;
  }> = [
    { icon: Wallet, label: 'Revenus du mois', value: fmtXOF(data.revenueMonthXof), tone: 'default', onClick: () => onJump('revenus') },
    { icon: Coins, label: 'Coût GP', value: fmtXOF(data.gpCostMonthXof), tone: 'muted', onClick: () => onJump('finances') },
    { icon: TrendingUp, label: 'Marge', value: fmtXOF(data.marginMonthXof), tone: positiveMargin ? 'success' : 'danger', onClick: () => onJump('finances') },
    { icon: CreditCard, label: 'Paiements en attente', value: fmtXOF(data.pendingPaymentsXof), tone: data.pendingPaymentsXof > 0 ? 'warning' : 'muted', onClick: () => onJump('revenus') },
  ];

  const toneStyles: Record<string, string> = {
    default: 'border-border bg-card',
    muted:   'border-border bg-card',
    success: 'border-[hsl(var(--success)/0.35)] bg-[hsl(var(--success-soft)/0.5)]',
    warning: 'border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning-soft)/0.5)]',
    danger:  'border-[hsl(var(--danger)/0.35)] bg-[hsl(var(--danger)/0.05)]',
  };
  const toneText: Record<string, string> = {
    default: 'text-foreground',
    muted:   'text-muted-foreground',
    success: 'text-[hsl(var(--success))]',
    warning: 'text-[hsl(var(--warning))]',
    danger:  'text-[hsl(var(--danger))]',
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(c => (
        <button
          key={c.label}
          onClick={c.onClick}
          className={cn(
            'text-left rounded-xl border p-4 transition-colors hover:border-foreground/40',
            toneStyles[c.tone],
          )}
        >
          <div className="flex items-center gap-1.5">
            <c.icon className={cn('w-3.5 h-3.5', toneText[c.tone])} />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{c.label}</span>
          </div>
          <p className={cn('mt-2 text-xl font-semibold tabular-nums', toneText[c.tone])}>{c.value}</p>
        </button>
      ))}
    </div>
  );
}
