import { useEffect, useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  blocked_24h_window: 'border-amber-500/40 text-amber-500',
  pending: 'border-amber-500/40 text-amber-500',
};

const STATUS_LABEL: Record<string, string> = {
  blocked_24h_window: 'Hors fenêtre 24h',
};

function buildWaLink(phone: string, body?: string | null): string {
  const digits = (phone || '').replace(/\D/g, '');
  const txt = body ? `?text=${encodeURIComponent(body)}` : '';
  return `https://wa.me/${digits}${txt}`;
}

async function copyText(text: string, label = 'Lien copié') {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error('Impossible de copier');
  }
}

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
        .limit(25);
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

  const waMaster = phone ? buildWaLink(phone) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Historique WhatsApp GP</DialogTitle>
          <DialogDescription>
            {gpLabel ? `${gpLabel} · ` : ''}{phone || ''} — 25 derniers envois
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[12px] text-amber-600 dark:text-amber-400">
          ⚠️ Tout envoi manuel doit partir du compte WhatsApp <span className="font-mono font-semibold">122 (+221 78 122 18 91)</span>,
          jamais depuis votre numéro personnel.
        </div>

        {waMaster && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => copyText(waMaster, 'Lien wa.me copié')}>
              <Copy className="w-3.5 h-3.5 mr-1.5" /> Copier wa.me
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={waMaster} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Ouvrir
              </a>
            </Button>
          </div>
        )}

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
              const label = STATUS_LABEL[r.status] ?? r.status;
              const wa = buildWaLink(r.to_phone, r.message_body);
              const isFailure = r.status === 'failed' || r.status === 'blocked_24h_window';
              return (
                <div key={r.id} className="rounded-lg border border-border p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={`uppercase ${cls}`}>{label}</Badge>
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
                  {isFailure && r.error_message && (
                    <p className="text-amber-600 dark:text-amber-500 text-[11px] mt-1">Cause : {r.error_message}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => copyText(wa, 'Lien wa.me copié')}
                      className="text-[11px] inline-flex items-center gap-1 underline text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="w-3 h-3" /> Copier wa.me
                    </button>
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] inline-flex items-center gap-1 underline text-emerald-600 dark:text-emerald-500"
                    >
                      <ExternalLink className="w-3 h-3" /> Ouvrir WhatsApp
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
