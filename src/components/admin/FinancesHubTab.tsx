import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Wallet, Coins, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { RevenusTab } from './RevenusTab';
import { FinancesTab } from './FinancesTab';
import { useAdminBrief } from '@/hooks/useAdminBrief';

const fmtXOF = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' FCFA';

type TabId = 'revenus' | 'paiements-gp';
const DEFAULT_TAB: TabId = 'revenus';

/**
 * Hub Finances — fusionne "Revenus clients" et "Paiements GP" en un seul écran
 * avec une ligne de résumé toujours visible au-dessus des onglets.
 */
export function FinancesHubTab() {
  const [sp, setSp] = useSearchParams();
  const tabParam = sp.get('tab') as TabId | null;
  const tab: TabId = tabParam === 'paiements-gp' ? 'paiements-gp' : DEFAULT_TAB;
  const { data, isLoading } = useAdminBrief();

  const onChange = (v: string) => {
    const next = new URLSearchParams(sp);
    if (v === DEFAULT_TAB) next.delete('tab');
    else next.set('tab', v);
    setSp(next, { replace: true });
  };

  const positiveMargin = (data?.marginMonthXof ?? 0) >= 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Finances</h1>
        <p className="text-sm text-muted-foreground">Revenus clients et paiements des transporteurs.</p>
      </div>

      {/* Ligne de résumé — toujours visible */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {isLoading || !data ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (
          <>
            <SummaryCard icon={Wallet} label="Encaissé ce mois" value={fmtXOF(data.revenueMonthXof)} tone="default" />
            <SummaryCard icon={Coins}  label="Coût GP ce mois"  value={fmtXOF(data.gpCostMonthXof)}  tone="muted" />
            <SummaryCard
              icon={TrendingUp}
              label="Marge nette"
              value={fmtXOF(data.marginMonthXof)}
              tone={positiveMargin ? 'success' : 'danger'}
            />
          </>
        )}
      </div>

      <Tabs value={tab} onValueChange={onChange}>
        <TabsList>
          <TabsTrigger value="revenus">Revenus clients</TabsTrigger>
          <TabsTrigger value="paiements-gp">Paiements GP</TabsTrigger>
        </TabsList>
        <TabsContent value="revenus" className="mt-4"><RevenusTab /></TabsContent>
        <TabsContent value="paiements-gp" className="mt-4"><FinancesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({
  icon: Icon, label, value, tone,
}: {
  icon: typeof Wallet; label: string; value: string;
  tone: 'default' | 'muted' | 'success' | 'danger';
}) {
  const styles: Record<string, string> = {
    default: 'border-border bg-card',
    muted:   'border-border bg-card',
    success: 'border-[hsl(var(--success)/0.35)] bg-[hsl(var(--success-soft)/0.5)]',
    danger:  'border-[hsl(var(--danger)/0.35)] bg-[hsl(var(--danger)/0.05)]',
  };
  const text: Record<string, string> = {
    default: 'text-foreground',
    muted:   'text-muted-foreground',
    success: 'text-[hsl(var(--success))]',
    danger:  'text-[hsl(var(--danger))]',
  };
  return (
    <div className={cn('rounded-xl border p-4', styles[tone])}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn('w-3.5 h-3.5', text[tone])} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      </div>
      <p className={cn('mt-2 text-xl font-semibold tabular-nums', text[tone])}>{value}</p>
    </div>
  );
}
