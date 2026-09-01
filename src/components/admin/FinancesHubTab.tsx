import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsContent } from '@/components/ui/tabs';
import { HubHeader, HubTab } from './hub-ui';
import { Wallet, Coins, TrendingUp, Truck, Receipt, CreditCard, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { RevenusTab } from './RevenusTab';
import { FinancesTab } from './FinancesTab';
import { RoadPaymentsTab } from './RoadPaymentsTab';
import { BilanTvaTab } from './BilanTvaTab';
import { useFinanceLedger } from '@/hooks/useFinanceLedger';
import { useFinanceRealtime } from '@/hooks/useAllPayments';
import { PaymentsAllTab } from './payments/PaymentsAllTab';

const fmtXOF = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' FCFA';

type TabId = 'tous' | 'revenus' | 'paiements-gp' | 'paiements-routiers' | 'bilan';
const DEFAULT_TAB: TabId = 'tous';
const TAB_IDS: TabId[] = ['tous', 'revenus', 'paiements-gp', 'paiements-routiers', 'bilan'];

/**
 * Hub Finances — revenus clients, paiements transporteurs (GP + routiers)
 * et bilan mensuel avec TVA, avec une ligne de résumé toujours visible.
 */
export function FinancesHubTab() {
  const [sp, setSp] = useSearchParams();
  const tabParam = sp.get('tab') as TabId | null;
  const tab: TabId = tabParam && TAB_IDS.includes(tabParam) ? tabParam : DEFAULT_TAB;
  const { data, isLoading } = useFinanceLedger(6);
  useFinanceRealtime();

  const onChange = (v: string) => {
    const next = new URLSearchParams(sp);
    if (v === DEFAULT_TAB) next.delete('tab');
    else next.set('tab', v);
    setSp(next, { replace: true });
  };

  const cur = data?.current;
  const positiveMargin = (cur?.marginXof ?? 0) >= 0;

  return (
    <div className="space-y-3 md:space-y-5">
      <HubHeader title="Finances" subtitle="Revenus clients, paiements transporteurs et TVA." />

      {/* Ligne de résumé — toujours visible */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 md:gap-3">
        {isLoading || !cur ? (
          [...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (
          <>
            <SummaryCard icon={Wallet} label="Encaissé ce mois" value={fmtXOF(cur.revenueXof)} tone="default" />
            <SummaryCard icon={Coins}  label="Coût GP ce mois"  value={fmtXOF(cur.costGpXof)}  tone="muted" />
            <SummaryCard icon={Truck}  label="Coût routier ce mois" value={fmtXOF(cur.costRoadXof)} tone="muted" />
            <SummaryCard icon={Plane}  label="Coût aérien/maritime" value={fmtXOF(cur.costCarrierXof)} tone="muted" />
            <SummaryCard
              icon={TrendingUp}
              label="Bénéfice net"
              value={fmtXOF(cur.marginXof)}
              tone={positiveMargin ? 'success' : 'danger'}
            />
            <SummaryCard icon={Receipt} label="TVA à reverser (18 %)" value={fmtXOF(cur.tvaXof)} tone="default" />
          </>
        )}
      </div>

      <Tabs value={tab} onValueChange={onChange}>
        <TabsList>
          <HubTab value="tous" icon={CreditCard} label="Tous les paiements" />
          <HubTab value="revenus" icon={Wallet} label="Revenus clients" />
          <HubTab value="paiements-gp" icon={Coins} label="Paiements GP" />
          <HubTab value="paiements-routiers" icon={Truck} label="Paiements routiers" />
          <HubTab value="bilan" icon={Receipt} label="Bilan & TVA" />
        </TabsList>
        <TabsContent value="tous" className="mt-4"><PaymentsAllTab /></TabsContent>
        <TabsContent value="revenus" className="mt-4"><RevenusTab /></TabsContent>
        <TabsContent value="paiements-gp" className="mt-4"><FinancesTab /></TabsContent>
        <TabsContent value="paiements-routiers" className="mt-4"><RoadPaymentsTab /></TabsContent>
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
        <Icon className={cn('w-3.5 h-3.5', text[tone])} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      </div>
      <p className={cn('mt-1.5 text-sm md:text-xl font-semibold tabular-nums', text[tone])}>{value}</p>
    </div>
  );
}
