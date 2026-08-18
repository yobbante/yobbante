import { useMemo, useState } from 'react';
import { FileText, Loader2, Search, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { HubHeader } from './hub-ui';
import { DevisDialog } from './messages/DevisDialog';
import { useAllDevis } from '@/hooks/useDevis';
import {
  ENGINE_LABELS, STATUS_LABELS, fcfa, formatFrDate, isDevisExpired,
  type DevisEngine, type DevisRow, type DevisStatus,
} from '@/lib/devis';
import { cn } from '@/lib/utils';

const ORIGIN_SHORT: Record<DevisEngine, string> = {
  international: 'Aérien / maritime',
  fret_national: 'Routier national',
  fret_international: 'Routier international',
};

const ORIGIN_TONE: Record<DevisEngine, string> = {
  international: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  fret_national: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  fret_international: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
};

const STATUS_FILTERS: { id: 'all' | DevisStatus; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'pending_send', label: 'À vérifier' },
  { id: 'sent', label: 'Envoyés' },
  { id: 'accepted', label: 'Acceptés' },
  { id: 'expired', label: 'Expirés' },
];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });

export function DevisAdminTab({ readOnly = false, fretOnly = false }: { readOnly?: boolean; fretOnly?: boolean }) {
  const { data: devis = [], isLoading } = useAllDevis();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | DevisStatus>('all');
  const [engine, setEngine] = useState<'all' | DevisEngine>(fretOnly ? 'fret_national' : 'all');
  const [open, setOpen] = useState<DevisRow | null>(null);
  const [creating, setCreating] = useState(false);

  const current = useMemo(() => devis.filter(d => d.is_current), [devis]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return current.filter((d) => {
      const expired = isDevisExpired(d);
      if (status !== 'all') {
        if (status === 'expired' ? !expired : (d.status !== status || expired)) return false;
      }
      if (fretOnly && d.engine === 'international') return false;
      if (engine !== 'all' && d.engine !== engine) return false;
      if (!s) return true;
      return (
        d.reference.toLowerCase().includes(s) ||
        (d.conversation_phone ?? '').toLowerCase().includes(s) ||
        (d.destination ?? '').toLowerCase().includes(s) ||
        (d.origin ?? '').toLowerCase().includes(s)
      );
    });
  }, [current, q, status, engine, fretOnly]);

  return (
    <div className="space-y-3 md:space-y-4">
      <HubHeader
        title="Devis"
        subtitle={fretOnly
          ? 'Devis Terminal D (routier national et international) — consultation uniquement.'
          : 'Tous les devis, aérien/maritime et transport routier Terminal D.'}
        actions={readOnly ? undefined : (
          <Button size="sm" onClick={() => setCreating(true)} aria-label="Nouveau devis">
            <FileText className="w-4 h-4 md:mr-1" /><span className="hidden md:inline">Nouveau devis</span>
          </Button>
        )}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-10"
               placeholder="Référence · téléphone · ville" />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {STATUS_FILTERS.map(f => (
          <button key={f.id} onClick={() => setStatus(f.id)}
            className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[11px]',
              status === f.id ? 'border-[#F5C518] bg-[#F5C518]/10 text-foreground' : 'border-border text-muted-foreground')}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {((fretOnly ? ['fret_national', 'fret_international'] : ['all', 'international', 'fret_national', 'fret_international']) as ('all' | DevisEngine)[]).map(id => (
          <button key={id} onClick={() => setEngine(id)}
            className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[11px]',
              engine === id ? 'border-[#F5C518] bg-[#F5C518]/10 text-foreground' : 'border-border text-muted-foreground')}>
            {id === 'all' ? 'Toutes origines' : ORIGIN_SHORT[id]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">Aucun devis pour ces filtres.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => {
            const expired = isDevisExpired(d);
            return (
              <div key={d.id} className="rounded-xl border border-border p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">
                    {d.reference}{d.version > 1 && <span className="text-muted-foreground"> v{d.version}</span>}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={cn('h-5 text-[9px]', ORIGIN_TONE[d.engine])}>
                      {ORIGIN_SHORT[d.engine]}
                    </Badge>
                    <Badge variant="outline" className={cn('h-5 text-[9px]', expired && 'border-red-500/40 text-red-500')}>
                      {expired ? 'Expiré' : STATUS_LABELS[d.status]}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm font-medium truncate">
                  {(d.origin || '—')} → {(d.destination || '—')} · {fcfa(d.total_fcfa)}
                  {d.total_manual && <span className="text-xs text-muted-foreground"> · ajusté</span>}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {d.conversation_phone || 'Contact inconnu'} · créé le {fmtDate(d.created_at)} · valable jusqu'au {formatFrDate(d.valid_until)}
                </p>
                <p className="text-[11px] text-muted-foreground">{ENGINE_LABELS[d.engine]}</p>
                {!readOnly && (
                  <div className="pt-1">
                    <Button size="sm" className="h-8 text-xs" onClick={() => setOpen(d)}>
                      <Send className="w-3 h-3 mr-1" /> Vérifier et envoyer
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {open && !readOnly && (
        <DevisDialog
          open={!!open}
          onOpenChange={(v) => !v && setOpen(null)}
          phone={open.conversation_phone ?? ''}
          initialDevis={open}
        />
      )}

      {!readOnly && <DevisDialog open={creating} onOpenChange={setCreating} phone="" />}
    </div>
  );
}
