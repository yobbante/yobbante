import { Card } from '@/components/ui/card';
import { SOURCE_BY_ID, type IntakeSource } from '@/lib/intakeSources';
import type { InboxStats } from '@/hooks/useInboxStats';

export function InboxKpiCards({ stats }: { stats: InboxStats }) {
  const kpis = [
    { label: '📥 Cette semaine', main: stats.weekTotal, sub: 'nouveaux dossiers' },
    { label: '🔴 À traiter',     main: stats.todo,      sub: `${stats.todoNewThisWeek} cette semaine` },
    { label: '🟡 Attente client', main: stats.awaiting,  sub: `${stats.awaitingPending} en attente` },
    { label: '🟢 Confirmés',      main: stats.confirmed, sub: `${stats.confirmedThisWeek} cette semaine` },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {kpis.map(k => (
          <Card key={k.label} className="p-3">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="text-2xl font-semibold text-foreground mt-0.5">{k.main}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{k.sub}</div>
          </Card>
        ))}
      </div>

      {stats.sourceDistribution.length > 0 && (
        <Card className="p-3">
          <div className="text-xs font-semibold text-foreground mb-2">Sources des dossiers · cette semaine</div>
          <div className="space-y-1.5">
            {stats.sourceDistribution.map(row => {
              const meta = SOURCE_BY_ID[row.source as IntakeSource];
              return (
                <div key={row.source} className="flex items-center gap-2 text-xs">
                  <span className="w-28 flex items-center gap-1 truncate">
                    <span>{meta?.emoji ?? '•'}</span>
                    <span className="truncate">{meta?.label ?? row.source}</span>
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{ width: `${row.pct}%`, background: meta?.color ?? 'hsl(var(--primary))' }}
                    />
                  </div>
                  <span className="w-10 text-right tabular-nums text-muted-foreground">{row.pct}%</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
