import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, Download, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { SOURCE_BY_ID, type IntakeSource } from '@/lib/intakeSources';
import { detectCarrier, isFromKonnekt } from '@/lib/inboxFilters';
import type { InboxDossier } from '@/hooks/useInboxDossiers';
import { toast } from 'sonner';

type SortKey = 'reference' | 'buyer_name' | 'destination_country' | 'estimated_weight' | 'final_amount_xof' | 'status' | 'created_at';

interface Props {
  dossiers: InboxDossier[];
  onView: (d: InboxDossier) => void;
}

function exportCsv(rows: InboxDossier[]) {
  const headers = ['Tracking','Client','Téléphone','Origine','Destination','Poids','Montant FCFA','Canal','Transporteur','Statut','Créé'];
  const lines = [headers.join(',')];
  for (const d of rows) {
    const amount = d.final_amount_xof ?? (d.estimated_cost != null ? Math.round(d.estimated_cost * 655.957) : '');
    lines.push([
      d.reference,
      (d.buyer_name || '').replace(/,/g, ' '),
      d.contact_phone || '',
      d.origin_city || d.origin_country,
      d.destination_city || d.destination_country,
      d.estimated_weight ?? '',
      amount,
      d.source,
      detectCarrier(d),
      d.status,
      d.created_at,
    ].join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `demandes-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

export function InboxListView({ dossiers, onView }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => {
    const arr = [...dossiers];
    arr.sort((a, b) => {
      const va = (a as any)[sortKey] ?? '';
      const vb = (b as any)[sortKey] ?? '';
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [dossiers, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  };

  const toggleAll = () => {
    if (selected.size === sorted.length) setSelected(new Set());
    else setSelected(new Set(sorted.map(d => d.id)));
  };
  const toggleOne = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const Th = ({ k, children, className = '' }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={`text-left text-[11px] uppercase tracking-wide text-muted-foreground font-medium px-2 py-2 ${className}`}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children} <ArrowUpDown className="w-3 h-3" />
      </button>
    </th>
  );

  const selectedRows = sorted.filter(d => selected.has(d.id));

  return (
    <div className="space-y-2">
      {selected.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-xs">
          <span className="font-medium">{selected.size} sélectionné(s)</span>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" className="h-7" onClick={() => {
            const phones = selectedRows.map(d => d.contact_phone).filter(Boolean);
            if (!phones.length) return toast.error('Aucun téléphone');
            toast.info(`WhatsApp groupé : ${phones.length} clients (à venir)`);
          }}>
            <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp
          </Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => exportCsv(selectedRows)}>
            <Download className="w-3 h-3 mr-1" /> Export CSV
          </Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setSelected(new Set())}>
            Annuler
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="w-8 px-2 py-2">
                <Checkbox
                  checked={selected.size > 0 && selected.size === sorted.length}
                  onCheckedChange={toggleAll}
                />
              </th>
              <Th k="reference">Tracking</Th>
              <Th k="buyer_name">Client</Th>
              <th className="text-left text-[11px] uppercase tracking-wide text-muted-foreground font-medium px-2 py-2">Tel</th>
              <Th k="destination_country">Destination</Th>
              <Th k="estimated_weight" className="text-right">Poids</Th>
              <Th k="final_amount_xof" className="text-right">Montant</Th>
              <th className="text-left text-[11px] uppercase tracking-wide text-muted-foreground font-medium px-2 py-2">Canal</th>
              <th className="text-left text-[11px] uppercase tracking-wide text-muted-foreground font-medium px-2 py-2">Transp.</th>
              <Th k="status">Statut</Th>
              <Th k="created_at">Âge</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={11} className="text-center text-muted-foreground py-8 text-xs">Aucun dossier</td></tr>
            ) : sorted.map(d => {
              const src = SOURCE_BY_ID[(d.source as IntakeSource) || 'site_web'] || SOURCE_BY_ID.autre;
              const amount = d.final_amount_xof ?? (d.estimated_cost != null ? Math.round(d.estimated_cost * 655.957) : null);
              return (
                <tr key={d.id} data-dossier-id={d.id} className="border-t border-border hover:bg-muted/20 cursor-pointer" onClick={() => onView(d)}>
                  <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selected.has(d.id)} onCheckedChange={() => toggleOne(d.id)} />
                  </td>
                  <td className="px-2 py-2 font-mono text-[11px]">
                    {d.reference}
                    {isFromKonnekt(d) && <Badge className="ml-1 text-[9px] px-1 py-0 h-4 bg-sky-500/15 text-sky-500 border-0">K</Badge>}
                  </td>
                  <td className="px-2 py-2 max-w-[140px] truncate">{d.buyer_name || '—'}</td>
                  <td className="px-2 py-2 text-xs text-muted-foreground">{d.contact_phone || '—'}</td>
                  <td className="px-2 py-2 text-xs">{d.destination_city || d.destination_country}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{d.estimated_weight ?? '—'}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{amount != null ? amount.toLocaleString('fr-FR') : '—'}</td>
                  <td className="px-2 py-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${src.color}22`, color: src.color }}>
                      {src.label}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-xs">{detectCarrier(d)}</td>
                  <td className="px-2 py-2 text-xs">{d.status}</td>
                  <td className="px-2 py-2 text-xs text-muted-foreground">{formatDistanceToNow(new Date(d.created_at), { locale: fr })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
