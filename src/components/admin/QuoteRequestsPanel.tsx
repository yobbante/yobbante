import { useMemo, useState } from 'react';
import { FileText, MessageCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DevisDialog } from './messages/DevisDialog';
import { useQuoteRequests, type QuoteRequestRow } from '@/hooks/useQuoteRequests';
import { transportModeLabel } from '@/lib/transportMode';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
  QUOTE_REQUESTED: 'À traiter',
  QUOTE_SENT: 'Devis envoyé',
  QUOTE_ACCEPTED: 'Accepté',
  QUOTE_REFUSED: 'Refusé',
};

const STATUS_TONE: Record<string, string> = {
  QUOTE_REQUESTED: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  QUOTE_SENT: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  QUOTE_ACCEPTED: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  QUOTE_REFUSED: 'bg-red-500/10 text-red-500 border-red-500/20',
};

const FILTERS = ['all', 'QUOTE_REQUESTED', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'QUOTE_REFUSED'] as const;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function QuoteRequestsPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { data: rows = [], isLoading } = useQuoteRequests();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<(typeof FILTERS)[number]>('all');
  const [target, setTarget] = useState<QuoteRequestRow | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (!s) return true;
      return [r.reference, r.tracking_id, r.buyer_name, r.contact_phone, r.origin_city, r.destination_city]
        .some((v) => (v ?? '').toLowerCase().includes(s));
    });
  }, [rows, q, status]);

  const counts = useMemo(() => ({
    todo: rows.filter((r) => r.status === 'QUOTE_REQUESTED').length,
    sent: rows.filter((r) => r.status === 'QUOTE_SENT').length,
    won: rows.filter((r) => r.status === 'QUOTE_ACCEPTED').length,
  }), [rows]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[['À traiter', counts.todo], ['Devis envoyés', counts.sent], ['Acceptés', counts.won]].map(([label, n]) => (
          <div key={label as string} className="rounded-xl border border-border p-2.5">
            <p className="text-lg font-semibold leading-none">{n as number}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{label as string}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-10"
               placeholder="Référence · client · téléphone · ville" />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setStatus(f)}
            className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[11px]',
              status === f ? 'border-[#F5C518] bg-[#F5C518]/10 text-foreground' : 'border-border text-muted-foreground')}>
            {f === 'all' ? 'Toutes' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">Aucune demande pour ces filtres.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-xl border border-border p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{r.tracking_id || r.reference || '—'}</span>
                <Badge variant="outline" className={cn('h-5 text-[9px]', STATUS_TONE[r.status])}>
                  {STATUS_LABELS[r.status] ?? r.status}
                </Badge>
              </div>
              <p className="text-sm font-medium truncate">
                {(r.origin_city || r.origin_country || '—')} → {(r.destination_city || r.destination_country || '—')}
                {r.estimated_weight ? ` · ${r.estimated_weight} kg` : ''}
                {r.transport_mode ? ` · ${transportModeLabel(r.transport_mode)}` : ''}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {r.buyer_name || 'Client'} · {r.contact_phone || 'sans téléphone'} · {fmtDate(r.created_at)}
              </p>
              {r.product_description && (
                <p className="text-[11px] text-muted-foreground line-clamp-2">{r.product_description}</p>
              )}
              {!readOnly && (
                <div className="flex gap-1.5 pt-1">
                  <Button size="sm" className="h-8 text-xs" onClick={() => setTarget(r)}>
                    <FileText className="w-3 h-3 mr-1" /> Créer le devis
                  </Button>
                  {r.contact_phone && (
                    <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                      <a href={`https://wa.me/${r.contact_phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {target && !readOnly && (
        <DevisDialog
          open={!!target}
          onOpenChange={(v) => !v && setTarget(null)}
          phone={target.contact_phone ?? ''}
          dossier={{
            id: target.id,
            reference: target.reference,
            tracking_id: target.tracking_id,
            origin_city: target.origin_city,
            destination_city: target.destination_city,
            origin_country: target.origin_country,
            destination_country: target.destination_country,
            estimated_weight: target.estimated_weight,
          }}
        />
      )}
    </div>
  );
}
