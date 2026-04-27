import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LayoutGrid, List, AlertTriangle, Clock, MapPin, Weight, User as UserIcon, X, Activity, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ShipmentAuditDrawer } from './ShipmentAuditDrawer';
import {
  SHIPMENT_WORKFLOW_ORDER,
  SHIPMENT_STATUS_LABELS,
  type Shipment,
  type ShipmentStatus,
} from '@/lib/types';

type RefundStatus = 'pending' | 'sent' | 'processed' | 'failed';

type ShipmentRow = Shipment & {
  client_name?: string | null;
  refund_status?: RefundStatus | null;
  refund_amount_eur?: number | null;
};

const STATUS_TONE: Record<ShipmentStatus, string> = {
  PENDING:           'bg-card border-border',
  WAITING_FOR_MATCH: 'bg-amber-50/60 border-amber-200',
  CONFIRMED:         'bg-card border-border',
  MATCHED:           'bg-card border-border',
  IN_PREPARATION:    'bg-card border-border',
  IN_TRANSIT:        'bg-card border-border',
  CUSTOMS:           'bg-amber-50/60 border-amber-200',
  ARRIVED:           'bg-card border-border',
  OUT_FOR_DELIVERY:  'bg-card border-border',
  DELIVERED:         'bg-primary/5 border-primary/30',
  ON_HOLD:           'bg-rose-50/60 border-rose-200',
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

function refundBadgeStyle(status: RefundStatus | null | undefined) {
  if (!status) return null;
  if (status === 'sent' || status === 'processed') {
    return { tone: 'bg-primary/10 text-primary border-primary/30', label: 'Remb. OK' };
  }
  if (status === 'failed') {
    return { tone: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Remb. KO' };
  }
  return { tone: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Remb. en cours' };
}

function RefundBadge({ status }: { status: RefundStatus | null | undefined }) {
  const s = refundBadgeStyle(status);
  if (!s) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border', s.tone)}>
      <RefreshCw className="w-2.5 h-2.5" />
      {s.label}
    </span>
  );
}

export function ShipmentsWorkflowTab() {
  const qc = useQueryClient();
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [auditState, setAuditState] = useState<{ id: string; tracking?: string | null } | null>(null);

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ['admin', 'shipments-workflow'],
    queryFn: async (): Promise<ShipmentRow[]> => {
      const { data, error } = await supabase
        .from('shipments')
        .select('*, profiles:user_id(full_name), refund_requests(status, amount_eur, created_at)')
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((s: any) => {
        const refunds = (s.refund_requests ?? []) as Array<{ status: string; amount_eur: number | null; created_at: string }>;
        // pick most recent refund
        const latest = refunds.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0];
        return {
          ...s,
          client_name: s.profiles?.full_name ?? null,
          refund_status: (latest?.status ?? null) as RefundStatus | null,
          refund_amount_eur: latest?.amount_eur ?? null,
        };
      }) as ShipmentRow[];
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

  const cancelShipment = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc('cancel_shipment', {
        p_shipment_id: id,
        p_reason: reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const released = data?.released_kg ? ` · ${data.released_kg} kg libérés` : '';
      toast.success(
        data?.refund_id ? `Envoi annulé · Remboursement programmé${released}` : `Envoi annulé${released}`,
      );
      qc.invalidateQueries({ queryKey: ['admin', 'shipments-workflow'] });
      qc.invalidateQueries({ queryKey: ['shipments'] });
    },
    onError: (e: any) => {
      toast.error('Annulation impossible', { description: e?.message ?? 'Erreur inconnue' });
    },
  });

  const handleCancel = (id: string, tracking: string | null | undefined) => {
    const reason = window.prompt(`Raison d'annulation pour ${tracking ?? id.slice(0, 8)} ?`, 'Annulation manuelle');
    if (reason === null) return;
    cancelShipment.mutate({ id, reason: reason.trim() || 'Annulation manuelle' });
  };

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
              'px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 transition-colors',
              view === 'kanban' ? 'bg-foreground text-background' : 'bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Kanban
          </button>
          <button
            onClick={() => setView('list')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 border-l border-border transition-colors',
              view === 'list' ? 'bg-foreground text-background' : 'bg-card text-muted-foreground hover:text-foreground',
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
                  className="w-[260px] flex-shrink-0 rounded-lg border border-border bg-secondary/40 flex flex-col"
                >
                  <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                      {SHIPMENT_STATUS_LABELS[status]}
                    </span>
                    <span className="text-[11px] font-semibold text-muted-foreground bg-card px-1.5 py-0.5 rounded">
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
                          'group rounded-md border p-2.5 cursor-grab active:cursor-grabbing',
                          'hover:border-foreground/30 hover:shadow-sm transition-all',
                          STATUS_TONE[status],
                        )}
                      >
                        <header className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[11px] font-bold tracking-tight text-foreground truncate">
                            {s.tracking_number ?? s.konnekt_id ?? s.id.slice(0, 8)}
                          </span>
                          <div className="flex items-center gap-1">
                            <RefundBadge status={s.refund_status} />
                            {ATTENTION_STATUSES.has(status) && (
                              <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                            )}
                          </div>
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
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground inline-flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" /> {timeSince(s.updated_at ?? s.created_at)}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); setAuditState({ id: s.id, tracking: s.tracking_number }); }}
                              title="Voir piste d'audit"
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Activity className="w-3 h-3" />
                            </button>
                            {status !== 'CANCELLED' && status !== 'DELIVERED' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCancel(s.id, s.tracking_number); }}
                                title="Annuler cet envoi"
                                className="text-muted-foreground hover:text-rose-600 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
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
        <ShipmentsList
          shipments={shipments}
          onChangeStatus={(id, to) => updateStatus.mutate({ id, to })}
          onCancel={handleCancel}
          onAudit={(id, tracking) => setAuditState({ id, tracking })}
        />
      )}

      <p className="text-[11px] text-muted-foreground">
        Astuce : glissez une carte d'une colonne à l'autre pour changer son statut. Cliquez sur l'icône activité pour voir l'historique complet et les remboursements.
      </p>

      <ShipmentAuditDrawer
        shipmentId={auditState?.id ?? null}
        trackingNumber={auditState?.tracking}
        open={!!auditState}
        onOpenChange={(v) => !v && setAuditState(null)}
      />
    </div>
  );
}

function ShipmentsList({
  shipments,
  onChangeStatus,
  onCancel,
  onAudit,
}: {
  shipments: ShipmentRow[];
  onChangeStatus: (id: string, to: ShipmentStatus) => void;
  onCancel: (id: string, tracking: string | null | undefined) => void;
  onAudit: (id: string, tracking: string | null | undefined) => void;
}) {
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Tracking</th>
              <th className="text-left px-3 py-2">Route</th>
              <th className="text-left px-3 py-2">Client</th>
              <th className="text-left px-3 py-2">Poids</th>
              <th className="text-left px-3 py-2">Prix</th>
              <th className="text-left px-3 py-2">Paiement</th>
              <th className="text-left px-3 py-2">Remb.</th>
              <th className="text-left px-3 py-2">Statut</th>
              <th className="text-left px-3 py-2">MAJ</th>
              <th className="text-left px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {shipments.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">Aucun envoi</td></tr>
            ) : shipments.map((s) => (
              <tr key={s.id} className="border-t border-border hover:bg-secondary/30">
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
                    s.payment_status === 'paid' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                  )}>
                    {s.payment_status ?? 'unpaid'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <RefundBadge status={s.refund_status} />
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
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAudit(s.id, s.tracking_number)}
                      className="h-6 px-2 text-[11px]"
                      title="Piste d'audit"
                    >
                      <Activity className="w-3 h-3" />
                    </Button>
                    {s.status !== 'CANCELLED' && s.status !== 'DELIVERED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCancel(s.id, s.tracking_number)}
                        className="h-6 px-2 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      >
                        Annuler
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
