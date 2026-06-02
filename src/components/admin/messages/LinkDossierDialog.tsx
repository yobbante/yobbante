import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Package, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LinkableDossier {
  id: string;
  reference: string | null;
  tracking_id: string | null;
  status: string;
  origin_country: string | null;
  destination_country: string | null;
  buyer_name: string | null;
  assigned_transporteur_ref: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Optional GP reference to surface their dossiers first */
  transporteurRef?: string | null;
  /** Phone of the conversation, used for client lookups */
  phone?: string | null;
  onPick: (d: LinkableDossier) => void;
}

const FIELDS = 'id, reference, tracking_id, status, origin_country, destination_country, origin_city, destination_city, buyer_name, assigned_transporteur_ref';
const CLOSED = '(DELIVERED,ARCHIVED,CANCELLED,CLOSED)';

export function LinkDossierDialog({ open, onOpenChange, transporteurRef, phone, onPick }: Props) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<LinkableDossier[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ('');
    (async () => {
      setLoading(true);
      let combined: LinkableDossier[] = [];
      // 1) Dossiers du GP en priorité
      if (transporteurRef) {
        const { data } = await supabase
          .from('dossiers')
          .select(FIELDS)
          .eq('assigned_transporteur_ref', transporteurRef)
          .order('created_at', { ascending: false })
          .limit(15);
        combined = (data ?? []) as LinkableDossier[];
      }
      // 2) Dossiers liés au téléphone (client)
      if (phone) {
        const tail = phone.replace(/\D/g, '').slice(-9);
        const { data } = await supabase
          .from('dossiers')
          .select(FIELDS)
          .or(`contact_phone.ilike.%${tail}%,sender_phone.ilike.%${tail}%,recipient_phone.ilike.%${tail}%,buyer_contact.ilike.%${tail}%`)
          .order('created_at', { ascending: false })
          .limit(10);
          (data ?? []).forEach((d) => {
            if (!combined.find((x) => x.id === d.id)) combined.push(d as LinkableDossier);
          });
      }
      // 3) Compléter avec dossiers récents non clos
      if (combined.length < 10) {
        const { data } = await supabase
          .from('dossiers')
          .select(FIELDS)
          .not('status', 'in', CLOSED)
          .order('created_at', { ascending: false })
          .limit(10);
        (data ?? []).forEach((d) => {
          if (!combined.find((x) => x.id === d.id)) combined.push(d as LinkableDossier);
        });
      }
      setRows(combined);
      setLoading(false);
    })();
  }, [open, transporteurRef, phone]);

  // Live search by tracking_id / reference
  useEffect(() => {
    if (!open || q.trim().length < 3) return;
    const t = setTimeout(async () => {
      setLoading(true);
      const term = q.trim();
      const { data } = await supabase
        .from('dossiers')
        .select(FIELDS)
        .or(`tracking_id.ilike.%${term}%,reference.ilike.%${term}%,buyer_name.ilike.%${term}%`)
        .order('created_at', { ascending: false })
        .limit(20);
      setRows((data ?? []) as LinkableDossier[]);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Lier un dossier</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="YOB-XXXXXX, référence ou nom client…"
            className="pl-8 h-9 text-xs"
          />
        </div>
        <div className="max-h-[420px] overflow-y-auto -mx-1">
          {loading ? (
            <div className="p-6 text-center text-xs text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Aucun dossier trouvé</div>
          ) : (
            <ul className="space-y-1">
              {rows.map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => { onPick(d); onOpenChange(false); }}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-md border border-border hover:border-primary hover:bg-muted/50 transition-colors',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">{d.tracking_id || d.reference || '—'}</span>
                      <Badge variant="outline" className="text-[9px]">{d.status}</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {(d.origin_country || '—')} → {(d.destination_country || '—')}
                      {d.buyer_name ? ` · ${d.buyer_name}` : ''}
                      {d.assigned_transporteur_ref ? ` · GP${d.assigned_transporteur_ref}` : ''}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground pt-1">Le dossier sera lié à toute la conversation.</div>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Fermer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
