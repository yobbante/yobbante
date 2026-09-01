import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsContent } from '@/components/ui/tabs';
import { HubHeader, HubTab } from './hub-ui';
import { Wallet, TrendingDown, TrendingUp, Receipt, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { BilanTvaTab } from './BilanTvaTab';
import { useFinanceLedger } from '@/hooks/useFinanceLedger';
import { useFinanceRealtime } from '@/hooks/useAllPayments';
import { PaymentsAllTab } from './payments/PaymentsAllTab';

const fmtXOF = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' FCFA';

type TabId = 'tous' | 'bilan';

/**
 * Hub Finances — un seul flux de paiements (tous modes confondus, filtrable)
 * + bilan mensuel avec TVA. Ligne de résumé toujours visible.
 */
export function FinancesHubTab() {
  const [sp, setSp] = useSearchParams();
  const tab: TabId = sp.get('tab') === 'bilan' ? 'bilan' : 'tous';
  const { data, isLoading } = useFinanceLedger(6);
  useFinanceRealtime();

  const onChange = (v: string) => {
    const next = new URLSearchParams(sp);
    if (v === 'tous') next.delete('tab');
    else next.set('tab', v);
    setSp(next, { replace: true });
  };

  const cur = data?.current;
  const costs = (cur?.costGpXof ?? 0) + (cur?.costRoadXof ?? 0) + (cur?.costCarrierXof ?? 0);
  const positiveMargin = (cur?.marginXof ?? 0) >= 0;

  return (
    <div className="space-y-3 md:space-y-5">
      <HubHeader title="Finances" subtitle="Paiements, reversements transporteurs et TVA." />

      {/* Ligne de résumé — toujours visible */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {isLoading || !cur ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (
          <>
            <SummaryCard icon={Wallet} label="Encaissé ce mois" value={fmtXOF(cur.revenueXof)} tone="default" />
            <SummaryCard icon={TrendingDown} label="Coûts ce mois" value={fmtXOF(costs)} tone="muted" />
            <SummaryCard
              icon={TrendingUp}
              label="Bénéfice net"
              value={fmtXOF(cur.marginXof)}
              tone={positiveMargin ? 'success' : 'danger'}
            />
          </>
        )}
      </div>

      <Tabs value={tab} onValueChange={onChange}>
        <TabsList>
          <HubTab value="tous" icon={CreditCard} label="Paiements" />
          <HubTab value="bilan" icon={Receipt} label="Bilan & TVA" />
        </TabsList>
        <TabsContent value="tous" className="mt-4"><PaymentsAllTab /></TabsContent>
        <TabsContent value="bilan" className="mt-4"><BilanTvaTab /></TabsContent>
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
    <div className={cn('rounded-xl border p-2.5 md:p-4', styles[tone])}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn('w-3.5 h-3.5 shrink-0', text[tone])} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium truncate">{label}</span>
      </div>
      <p className={cn('mt-1.5 text-sm md:text-xl font-semibold tabular-nums', text[tone])}>{value}</p>
    </div>
  );
}
