import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';

export interface WhatsAppHistoryDialogProps {
  transporteurId: string | null;
  phone?: string | null;
  gpLabel?: string;
  onClose: () => void;
}

interface OutboundRow {
  id: string;
  to_phone: string;
  status: string;
  message_body: string | null;
  template_name: string | null;
  error_message: string | null;
  trigger_type: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  sent: 'border-sky-500/40 text-sky-500',
  delivered: 'border-blue-500/40 text-blue-500',
  read: 'border-emerald-500/40 text-emerald-500',
  failed: 'border-red-500/40 text-red-500',
  pending: 'border-amber-500/40 text-amber-500',
};

export function WhatsAppHistoryDialog({ transporteurId, phone, gpLabel, onClose }: WhatsAppHistoryDialogProps) {
  const open = !!transporteurId;
  const [rows, setRows] = useState<OutboundRow[] | null>(null);

  useEffect(() => {
    if (!open) { setRows(null); return; }
    let cancelled = false;
    (async () => {
      let query = supabase
        .from('whatsapp_outbound_messages' as any)
        .select('id,to_phone,status,message_body,template_name,error_message,trigger_type,created_at')
        .order('created_at', { ascending: false })
        .limit(15);
      if (transporteurId) {
        const digits = (phone ?? '').replace(/\D/g, '');
        const variants = digits ? [digits, `+${digits}`] : [];
        query = variants.length
          ? (query.or(`transporteur_id.eq.${transporteurId},to_phone.in.(${variants.join(',')})`) as any)
          : (query.eq('transporteur_id', transporteurId) as any);
      }
      const { data, error } = await query;
      if (cancelled) return;
      if (error) { setRows([]); return; }
      setRows((data ?? []) as unknown as OutboundRow[]);
    })();
    return () => { cancelled = true; };
  }, [open, transporteurId, phone]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Historique WhatsApp</DialogTitle>
          <DialogDescription>
            {gpLabel ? `${gpLabel} · ` : ''}{phone || ''} — 15 derniers envois
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-[55vh] overflow-y-auto">
          {rows === null ? (
            <>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Aucun envoi enregistré pour ce numéro.</p>
          ) : (
            rows.map((r) => {
              const cls = STATUS_STYLES[r.status] ?? 'border-muted-foreground/30 text-muted-foreground';
              const when = new Date(r.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
              return (
                <div key={r.id} className="rounded-lg border border-border p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={`uppercase ${cls}`}>{r.status}</Badge>
                    <span className="text-muted-foreground">{when}</span>
                  </div>
                  {r.template_name && (
                    <div className="text-[10px] text-muted-foreground">Template : {r.template_name}</div>
                  )}
                  {r.trigger_type && (
                    <div className="text-[10px] text-muted-foreground">Source : {r.trigger_type}</div>
                  )}
                  {r.message_body && (
                    <p className="text-foreground/90 whitespace-pre-wrap line-clamp-3">{r.message_body}</p>
                  )}
                  {r.status === 'failed' && r.error_message && (
                    <p className="text-red-500 text-[11px] mt-1">Cause : {r.error_message}</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
