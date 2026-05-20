import { useMemo } from 'react';
import type { InboxDossier } from './useInboxDossiers';

export type InboxStats = {
  weekTotal: number;
  todo: number;
  todoNewThisWeek: number;
  awaiting: number;
  awaitingPending: number;
  confirmed: number;
  confirmedThisWeek: number;
  sourceDistribution: { source: string; count: number; pct: number }[];
};

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay() || 7;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - (day - 1));
  return x;
}

export function useInboxStats(dossiers: InboxDossier[]): InboxStats {
  return useMemo(() => {
    const weekStart = startOfWeek();
    const thisWeek = dossiers.filter(d => new Date(d.created_at) >= weekStart);

    const todo = dossiers.filter(d => ['SUBMITTED', 'IN_REVIEW'].includes(d.status));
    const awaiting = dossiers.filter(d => d.status === 'AWAITING_CLIENT');
    const confirmed = dossiers.filter(d => d.status === 'CONFIRMED');

    const counts: Record<string, number> = {};
    for (const d of thisWeek) counts[d.source] = (counts[d.source] || 0) + 1;
    const total = thisWeek.length || 1;
    const sourceDistribution = Object.entries(counts)
      .map(([source, count]) => ({ source, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);

    return {
      weekTotal: thisWeek.length,
      todo: todo.length,
      todoNewThisWeek: todo.filter(d => new Date(d.created_at) >= weekStart).length,
      awaiting: awaiting.length,
      awaitingPending: awaiting.length,
      confirmed: confirmed.length,
      confirmedThisWeek: confirmed.filter(d => new Date(d.created_at) >= weekStart).length,
      sourceDistribution,
    };
  }, [dossiers]);
}
