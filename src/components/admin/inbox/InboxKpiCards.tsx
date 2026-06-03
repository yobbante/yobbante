import { Card } from '@/components/ui/card';
import { Inbox, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import type { InboxStats } from '@/hooks/useInboxStats';

export function InboxKpiCards({ stats }: { stats: InboxStats }) {
  const kpis: { label: string; main: number; sub: string; tone: string; Icon: any; pulse?: boolean }[] = [
    { label: 'Nouveau', main: stats.weekTotal, sub: 'cette semaine', tone: 'blue', Icon: Inbox, pulse: stats.weekTotal > 0 },
    { label: 'À traiter', main: stats.todo, sub: stats.todo > 0 ? 'à assigner' : 'tout est traité', tone: stats.todo > 0 ? 'orange' : 'muted', Icon: AlertCircle, pulse: stats.todo > 0 },
    { label: 'Attente client', main: stats.awaiting, sub: 'paiement / confirmation', tone: stats.awaiting > 0 ? 'yellow' : 'muted', Icon: Clock },
    { label: 'Confirmés', main: stats.confirmed, sub: `${stats.confirmedThisWeek} cette semaine`, tone: 'green', Icon: CheckCircle2 },
  ];

  const toneCls: Record<string, string> = {
    blue:   'border-sky-500/30 bg-sky-500/5 text-sky-500',
    orange: 'border-orange-500/30 bg-orange-500/5 text-orange-500',
    yellow: 'border-amber-500/30 bg-amber-500/5 text-amber-500',
    green:  'border-emerald-500/30 bg-emerald-500/5 text-emerald-500',
    muted:  'border-border bg-muted/30 text-muted-foreground',
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {kpis.map(k => (
        <Card key={k.label} className={`p-3 border ${toneCls[k.tone]} relative overflow-hidden`}>
          <div className="flex items-start justify-between">
            <div className="text-xs font-medium">{k.label}</div>
            <k.Icon className={`w-4 h-4 ${k.pulse ? 'animate-pulse' : ''}`} />
          </div>
          <div className="text-2xl font-bold text-foreground mt-1 tabular-nums">{k.main}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{k.sub}</div>
        </Card>
      ))}
    </div>
  );
}
