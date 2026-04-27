import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Activity, AlertTriangle, ArrowRight, Ban, CheckCircle2, Clock,
  CreditCard, Package, RefreshCw, User as UserIcon, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ShipmentEvent = {
  id: string;
  shipment_id: string;
  event_type: string;
  triggered_by: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
};

type RefundRequest = {
  id: string;
  status: string;
  amount_eur: number | null;
  reason: string | null;
  attempts: number;
  provider_ref: string | null;
  error: string | null;
  created_at: string;
  processed_at: string | null;
};

const EVENT_META: Record<string, { icon: any; tone: string; label: string }> = {
  shipment_created:        { icon: Package,        tone: 'text-foreground bg-secondary',         label: 'Envoi créé' },
  status_changed:          { icon: ArrowRight,     tone: 'text-foreground bg-secondary',         label: 'Statut modifié' },
  payment_status_changed:  { icon: CreditCard,     tone: 'text-foreground bg-secondary',         label: 'Paiement' },
  departure_matched:       { icon: Zap,            tone: 'text-primary bg-primary/10',           label: 'Départ assigné' },
  no_departure_found:      { icon: AlertTriangle,  tone: 'text-amber-700 bg-amber-50',           label: 'Aucun départ' },
  eta_exceeded:            { icon: Clock,          tone: 'text-amber-700 bg-amber-50',           label: 'ETA dépassée' },
  payment_timeout:         { icon: Ban,            tone: 'text-rose-700 bg-rose-50',             label: 'Paiement expiré' },
  shipment_cancelled:      { icon: Ban,            tone: 'text-rose-700 bg-rose-50',             label: 'Annulation' },
  refund_processed:        { icon: CheckCircle2,   tone: 'text-primary bg-primary/10',           label: 'Remboursement OK' },
  refund_failed:           { icon: AlertTriangle,  tone: 'text-rose-700 bg-rose-50',             label: 'Remboursement échoué' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function refundStatusTone(status: string) {
  if (status === 'sent' || status === 'processed') return 'bg-primary/10 text-primary border-primary/30';
  if (status === 'failed') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-amber-50 text-amber-700 border-amber-200'; // pending
}

export function ShipmentAuditDrawer({
  shipmentId,
  trackingNumber,
  open,
  onOpenChange,
}: {
  shipmentId: string | null;
  trackingNumber?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ['shipment-events', shipmentId],
    enabled: !!shipmentId && open,
    queryFn: async (): Promise<ShipmentEvent[]> => {
      const { data, error } = await supabase
        .from('shipment_events')
        .select('*')
        .eq('shipment_id', shipmentId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ShipmentEvent[];
    },
  });

  const { data: refunds = [], isLoading: loadingRefunds } = useQuery({
    queryKey: ['shipment-refunds', shipmentId],
    enabled: !!shipmentId && open,
    queryFn: async (): Promise<RefundRequest[]> => {
      const { data, error } = await supabase
        .from('refund_requests')
        .select('*')
        .eq('shipment_id', shipmentId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as RefundRequest[];
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Piste d'audit
          </SheetTitle>
          <SheetDescription className="font-mono text-xs">
            {trackingNumber ?? shipmentId?.slice(0, 8)}
          </SheetDescription>
        </SheetHeader>

        {/* Refunds section */}
        <section className="mt-6">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3" /> Remboursements
          </h3>
          {loadingRefunds ? (
            <Skeleton className="h-16 rounded-md" />
          ) : refunds.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Aucun remboursement.</p>
          ) : (
            <div className="space-y-2">
              {refunds.map((r) => (
                <div key={r.id} className="rounded-md border border-border p-3 bg-card">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-sm">
                      {r.amount_eur != null ? `${Math.round(r.amount_eur)} €` : '—'}
                    </span>
                    <Badge variant="outline" className={cn('text-[10px] uppercase font-bold', refundStatusTone(r.status))}>
                      {r.status}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    {r.reason && <div>{r.reason}</div>}
                    <div>Demandé : {fmtDate(r.created_at)}</div>
                    {r.processed_at && <div>Traité : {fmtDate(r.processed_at)}</div>}
                    {r.attempts > 0 && <div>Tentatives : {r.attempts}</div>}
                    {r.provider_ref && <div className="font-mono">Réf : {r.provider_ref}</div>}
                    {r.error && <div className="text-rose-600">⚠ {r.error}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Timeline */}
        <section className="mt-6">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Activity className="w-3 h-3" /> Historique complet
          </h3>
          {loadingEvents ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-md" />)}
            </div>
          ) : events.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Aucun événement.</p>
          ) : (
            <ol className="relative border-l border-border pl-4 space-y-3">
              {events.map((ev) => {
                const meta = EVENT_META[ev.event_type] ?? { icon: Activity, tone: 'text-foreground bg-secondary', label: ev.event_type };
                const Icon = meta.icon;
                return (
                  <li key={ev.id} className="relative">
                    <span className={cn('absolute -left-[26px] top-0 w-5 h-5 rounded-full flex items-center justify-center border border-border', meta.tone)}>
                      <Icon className="w-2.5 h-2.5" />
                    </span>
                    <div className="rounded-md border border-border bg-card p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">{meta.label}</span>
                        <span className="text-[10px] text-muted-foreground">{fmtDate(ev.created_at)}</span>
                      </div>
                      {(ev.from_status || ev.to_status) && (
                        <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <span className="font-mono">{ev.from_status ?? '∅'}</span>
                          <ArrowRight className="w-3 h-3" />
                          <span className="font-mono font-semibold text-foreground">{ev.to_status ?? '∅'}</span>
                        </div>
                      )}
                      {ev.note && <p className="mt-1 text-[11px] text-muted-foreground">{ev.note}</p>}
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <UserIcon className="w-2.5 h-2.5" />
                        <span>{ev.triggered_by}</span>
                      </div>
                      {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                        <details className="mt-1.5">
                          <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                            Détails
                          </summary>
                          <pre className="mt-1 p-1.5 bg-muted rounded text-[10px] font-mono overflow-x-auto">
                            {JSON.stringify(ev.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </SheetContent>
    </Sheet>
  );
}
