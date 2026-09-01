import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FileDown, Receipt } from 'lucide-react';
import { useFinanceLedger, TVA_RATE, type MonthLedger } from '@/hooks/useFinanceLedger';
import { formatXof } from '@/lib/gpFinance';
import { cn } from '@/lib/utils';

/**
 * Bilan mensuel semi-automatique :
 * encaissé - (coûts GP + coûts routiers) = bénéfice, dont TVA 18 % à reverser.
 */
export function BilanTvaTab() {
  const { data, isLoading } = useFinanceLedger(6);

  const totals = useMemo(() => {
    const m = data?.months ?? [];
    return {
      revenue: m.reduce((s, x) => s + x.revenueXof, 0),
      gp: m.reduce((s, x) => s + x.costGpXof, 0),
      road: m.reduce((s, x) => s + x.costRoadXof, 0),
      margin: m.reduce((s, x) => s + x.marginXof, 0),
      tva: m.reduce((s, x) => s + x.tvaXof, 0),
    };
  }, [data]);

  const exportCsv = () => {
    const rows = [
      ['Mois', 'Encaisse XOF', 'Cout GP XOF', 'Cout routier XOF', 'Marge XOF', 'TVA 18% XOF'],
      ...(data?.months ?? []).map((m: MonthLedger) => [
        m.month, m.revenueXof, m.costGpXof, m.costRoadXof, m.marginXof, m.tvaXof,
      ]),
    ];
    const csv = rows.map(r => r.join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `bilan-tva-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || !data) {
    return <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;
  }

  const cur = data.current;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        <Stat label="Encaissé ce mois" value={formatXof(cur.revenueXof)} />
        <Stat label="Payé / dû aux GP" value={formatXof(cur.costGpXof)} />
        <Stat label="Payé / dû aux routiers" value={formatXof(cur.costRoadXof)} />
        <Stat
          label={`TVA à reverser (${Math.round(TVA_RATE * 100)} %)`}
          value={formatXof(cur.tvaXof)}
          tone={cur.tvaXof > 0 ? 'accent' : 'default'}
          hint={`Bénéfice : ${formatXof(cur.marginXof)}`}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 md:gap-3">
        <Stat label="Restant à payer aux GP" value={formatXof(data.dueGpXof)} tone="warn" />
        <Stat
          label="Restant à payer aux routiers"
          value={formatXof(data.dueRoadXof)}
          tone="warn"
          hint={data.missingRoadRateCount ? `${data.missingRoadRateCount} course(s) sans coût saisi` : undefined}
        />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Receipt className="w-4 h-4 text-muted-foreground" />
            Bilan des 6 derniers mois
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <FileDown className="w-3.5 h-3.5 mr-1.5" /> CSV
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Mois</th>
                <th className="text-right font-medium px-3 py-2">Encaissé</th>
                <th className="text-right font-medium px-3 py-2">Coût GP</th>
                <th className="text-right font-medium px-3 py-2">Coût routier</th>
                <th className="text-right font-medium px-3 py-2">Bénéfice</th>
                <th className="text-right font-medium px-3 py-2">TVA 18 %</th>
              </tr>
            </thead>
            <tbody>
              {data.months.map((m) => (
                <tr key={m.month} className="border-t border-border/60">
                  <td className="px-3 py-2 whitespace-nowrap capitalize">{m.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatXof(m.revenueXof)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatXof(m.costGpXof)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatXof(m.costRoadXof)}</td>
                  <td className={cn('px-3 py-2 text-right tabular-nums font-medium',
                    m.marginXof >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]')}>
                    {formatXof(m.marginXof)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{formatXof(m.tvaXof)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/30 font-medium">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatXof(totals.revenue)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatXof(totals.gp)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatXof(totals.road)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatXof(totals.margin)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatXof(totals.tva)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Encaissé = dossiers marqués payés (date de paiement) + courses routières livrées sans dossier lié.
        Coûts = montants GP saisis (mois de livraison) et coûts chauffeurs saisis dans « Paiements routiers ».
        TVA = 18 % du bénéfice mensuel, à ajuster avec votre comptable.
      </p>
    </div>
  );
}

function Stat({ label, value, hint, tone = 'default' }: {
  label: string; value: string; hint?: string; tone?: 'default' | 'accent' | 'warn';
}) {
  return (
    <div className={cn('rounded-xl border p-2.5 md:p-3',
      tone === 'accent' ? 'border-primary/40 bg-primary/5'
        : tone === 'warn' ? 'border-[hsl(var(--warning,45_93%_47%)/0.35)] bg-card'
        : 'border-border bg-card')}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="mt-1 text-sm md:text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
