import { useMemo, useState } from 'react';
import { Search, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GP_STEPS, GP_STEP_TONE, stepOf, stalledHours, useGpColis, type GpColis, type GpColisStep,
} from '@/hooks/useGpTerrain';
import { GpColisSheet } from './GpColisSheet';
import { cn } from '@/lib/utils';

const FILTERS: { id: 'all' | GpColisStep; label: string }[] = [
  { id: 'all', label: 'Tous' },
  ...GP_STEPS.map(s => ({ id: s.id, label: s.label })),
];

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '—';

/** Suivi des colis confiés à un transporteur GP. */
export function GpColisTab() {
  const { data: colis = [], isLoading } = useGpColis();
  const [filter, setFilter] = useState<'all' | GpColisStep>('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<GpColis | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return colis.filter((c) => {
      if (filter !== 'all' && stepOf(c.status) !== filter) return false;
      if (!needle) return true;
      return [c.reference, c.recipient_name, c.sender_name, c.recipient_phone, c.sender_phone,
        c.destination_city, c.assigned_transporteur_ref]
        .filter(Boolean).join(' ').toLowerCase().includes(needle);
    });
  }, [colis, filter, q]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-8 h-9"
          placeholder="Rechercher un colis (réf, client, ville, GP)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={filter === f.id ? 'default' : 'outline'}
            className="h-7 text-xs shrink-0"
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Aucun colis GP.</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {rows.map((c) => {
            const st = stepOf(c.status);
            const stale = stalledHours(c) > 48 && st !== 'RECUPERE';
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="text-left rounded-xl border border-border bg-card p-3 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      <span className="font-mono text-xs text-muted-foreground">{c.reference ?? '—'}</span>{' '}
                      {c.recipient_name ?? c.sender_name ?? 'Client'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.origin_city ?? '—'} → {c.destination_city ?? c.destination_country ?? '—'} ·
                      {' '}GP #{c.assigned_transporteur_ref ?? '—'}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn('text-[10px] shrink-0', GP_STEP_TONE[st])}>
                    {GP_STEPS.find(s => s.id === st)?.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                  <span>{Number(c.actual_weight_kg ?? c.estimated_weight ?? 0)} kg</span>
                  <span>Créé {fmt(c.created_at)}</span>
                  {stale && (
                    <span className="ml-auto inline-flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="w-3 h-3" /> Sans évolution 48h+
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <GpColisSheet
        colis={selected}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
      />
    </div>
  );
}
