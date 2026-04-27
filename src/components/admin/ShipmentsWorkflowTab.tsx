import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LayoutGrid, List, AlertTriangle, Clock, MapPin, Weight, User as UserIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  SHIPMENT_WORKFLOW_ORDER,
  SHIPMENT_STATUS_LABELS,
  type Shipment,
  type ShipmentStatus,
} from '@/lib/types';

type ShipmentRow = Shipment & {
  client_name?: string | null;
};

const STATUS_TONE: Record<ShipmentStatus, string> = {
  PENDING:           'bg-muted/40 border-border',
  WAITING_FOR_MATCH: 'bg-amber-50 border-amber-200',
  CONFIRMED:         'bg-blue-50 border-blue-200',
  MATCHED:           'bg-blue-50 border-blue-200',
  IN_PREPARATION:    'bg-violet-50 border-violet-200',
  IN_TRANSIT:        'bg-blue-50 border-blue-200',
  CUSTOMS:           'bg-amber-50 border-amber-200',
  ARRIVED:           'bg-emerald-50 border-emerald-200',
  OUT_FOR_DELIVERY:  'bg-emerald-50 border-emerald-200',
  DELIVERED:         'bg-emerald-50 border-emerald-300',
  ON_HOLD:           'bg-rose-50 border-rose-200',
  CANCELLED:         'bg-muted/40 border-border',
};

const ATTENTION_STATUSES = new Set<ShipmentStatus>(['ON_HOLD', 'WAITING_FOR_MATCH', 'CUSTOMS']);

function timeSince(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}j`;
}

function formatPrice(eur: number | null | undefined): string {
  if (eur === null || eur === undefined) return '—';
  return `${Math.round(eur)} €`;
}

export function ShipmentsWorkflowTab() {
  const qc = useQueryClient();
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ['admin', 'shipments-workflow'],
    queryFn: async (): Promise<ShipmentRow[]> => {
      const { data, error } = await supabase
        .from('shipments')
        .select('*, profiles:user_id(full_name)')
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((s: any) => ({
        ...s,
        client_name: s.profiles?.full_name ?? null,
      })) as ShipmentRow[];
    },
    refetchInterval: 30_000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, to }: { id: string; to: ShipmentStatus }) => {
      const { error } = await supabase
        .from('shipments')
        .update({ status: to })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`Statut mis à jour → ${SHIPMENT_STATUS_LABELS[vars.to]}`);
      qc.invalidateQueries({ queryKey: ['admin', 'shipments-workflow'] });
      qc.invalidateQueries({ queryKey: ['shipments'] });
    },
    onError: (e: any) => {
      toast.error('Impossible de changer le statut', {
        description: e?.message ?? 'Erreur inconnue',
      });
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<ShipmentStatus, ShipmentRow[]>();
    SHIPMENT_WORKFLOW_ORDER.forEach((s) => map.set(s, []));
    shipments.forEach((s) => {
      const arr = map.get(s.status as ShipmentStatus);
      if (arr) arr.push(s);
    });
    return map;
  }, [shipments]);

  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const onDrop = (e: React.DragEvent, to: ShipmentStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    const ship = shipments.find((s) => s.id === id);
    if (!ship || ship.status === to) return;
    updateStatus.mutate({ id, to });
  };

  const attentionCount = shipments.filter((s) => ATTENTION_STATUSES.has(s.status)).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Workflow des envois</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {shipments.length} envoi{shipments.length > 1 ? 's' : ''}
            {attentionCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                {attentionCount} à traiter
              </span>
            )}
          </p>
        </div>

        <div className="inline-flex rounded-md border border-border overflow-hidden">
          <button
            onClick={() => setView('kanban')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5',
              view === 'kanban' ? 'bg-foreground text-background' : 'bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Kanban
          </button>
          <button
            onClick={() => setView('list')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 border-l border-border',
              view === 'list' ? 'bg-foreground text-background' : 'bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            <List className="w-3.5 h-3.5" /> Liste
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      ) : view === 'kanban' ? (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {SHIPMENT_WORKFLOW_ORDER.map((status) => {
              const items = grouped.get(status) ?? [];
              return (
                <div
                  key={status}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, status)}
                  className="w-[260px] flex-shrink-0 rounded-lg border border-border bg-secondary/30 flex flex-col"
                >
                  <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                      {SHIPMENT_STATUS_LABELS[status]}
                    </span>
                    <span className="text-[11px] font-semibold text-muted-foreground bg-background px-1.5 py-0.5 rounded">
                      {items.length}
                    </span>
                  </div>

                  <div className="p-2 space-y-2 min-h-[120px] max-h-[70vh] overflow-y-auto">
                    {items.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic text-center py-4">
                        Vide
                      </p>
                    ) : items.map((s) => (
                      <article
                        key={s.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, s.id)}
                        className={cn(
                          'group rounded-md border p-2.5 bg-background cursor-grab active:cursor-grabbing',
                          'hover:border-foreground/30 hover:shadow-sm transition-all',
                          STATUS_TONE[status],
                        )}
                      >
                        <header className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[11px] font-bold tracking-tight text-foreground truncate">
                            {s.tracking_number ?? s.konnekt_id ?? s.id.slice(0, 8)}
                          </span>
                          {ATTENTION_STATUSES.has(status) && (
                            <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                          )}
                        </header>

                        <div className="space-y-1 text-[11px] text-muted-foreground">
                          <div className="flex items-center gap-1.5 truncate">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">
                              {s.origin_city ?? s.origin_country} → {s.destination_city ?? s.destination_country}
                            </span>
                          </div>
                          {s.weight_kg != null && (
                            <div className="flex items-center gap-1.5">
                              <Weight className="w-3 h-3 flex-shrink-0" /> {Number(s.weight_kg).toFixed(1)} kg
                            </div>
                          )}
                          {s.client_name && (
                            <div className="flex items-center gap-1.5 truncate">
                              <UserIcon className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{s.client_name}</span>
                            </div>
                          )}
                        </div>

                        <footer className="mt-2 pt-1.5 border-t border-border/60 flex items-center justify-between text-[10px]">
                          <span className="font-semibold text-foreground">{formatPrice(s.total_cost)}</span>
                          <span className="text-muted-foreground inline-flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" /> {timeSince(s.updated_at ?? s.created_at)}
                          </span>
                        </footer>
                      </article>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <ShipmentsList shipments={shipments} onChangeStatus={(id, to) => updateStatus.mutate({ id, to })} />
      )}

      <p className="text-[11px] text-muted-foreground">
        Astuce : glissez une carte d'une colonne à l'autre pour changer son statut. Chaque changement est journalisé automatiquement.
      </p>
    </div>
  );
}

function ShipmentsList({
  shipments,
  onChangeStatus,
}: {
  shipments: ShipmentRow[];
  onChangeStatus: (id: string, to: ShipmentStatus) => void;
}) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Tracking</th>
              <th className="text-left px-3 py-2">Route</th>
              <th className="text-left px-3 py-2">Client</th>
              <th className="text-left px-3 py-2">Poids</th>
              <th className="text-left px-3 py-2">Prix</th>
              <th className="text-left px-3 py-2">Paiement</th>
              <th className="text-left px-3 py-2">Statut</th>
              <th className="text-left px-3 py-2">MAJ</th>
            </tr>
          </thead>
          <tbody>
            {shipments.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Aucun envoi</td></tr>
            ) : shipments.map((s) => (
              <tr key={s.id} className="border-t border-border hover:bg-secondary/20">
                <td className="px-3 py-2 font-mono text-xs">{s.tracking_number ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {s.origin_city ?? s.origin_country} → {s.destination_city ?? s.destination_country}
                </td>
                <td className="px-3 py-2 text-muted-foreground truncate max-w-[140px]">{s.client_name ?? '—'}</td>
                <td className="px-3 py-2">{s.weight_kg != null ? `${Number(s.weight_kg).toFixed(1)} kg` : '—'}</td>
                <td className="px-3 py-2 font-medium">{formatPrice(s.total_cost)}</td>
                <td className="px-3 py-2">
                  <span className={cn(
                    'text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded',
                    s.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground',
                  )}>
                    {s.payment_status ?? 'unpaid'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={s.status}
                    onChange={(e) => onChangeStatus(s.id, e.target.value as ShipmentStatus)}
                    className="text-xs border border-border rounded px-1.5 py-1 bg-background"
                  >
                    {SHIPMENT_WORKFLOW_ORDER.map((st) => (
                      <option key={st} value={st}>{SHIPMENT_STATUS_LABELS[st]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-muted-foreground text-xs">{timeSince(s.updated_at ?? s.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
