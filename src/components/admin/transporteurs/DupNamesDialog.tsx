import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Wand2 } from 'lucide-react';

type Row = {
  id: string;
  reference: string | null;
  prenom: string | null;
  nom: string | null;
  telephone_1: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function suggestNom(prenom: string | null, nom: string | null): string {
  const p = (prenom ?? '').trim();
  const n = (nom ?? '').trim();
  if (!p || !n) return n;
  if (n.toLowerCase() === p.toLowerCase()) return '';
  // nom starts with prenom + space → strip the prefix
  if (n.toLowerCase().startsWith(p.toLowerCase() + ' ')) return n.slice(p.length).trim();
  // nom ends with prenom (rare) → strip
  if (n.toLowerCase().endsWith(' ' + p.toLowerCase())) return n.slice(0, n.length - p.length).trim();
  // trailing " -" placeholder
  return n.replace(/\s*-\s*$/, '').trim();
}

export function DupNamesDialog({ open, onOpenChange }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [edits, setEdits] = useState<Record<string, { prenom: string; nom: string }>>({});

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    supabase
      .from('transporteurs')
      .select('id, reference, prenom, nom, telephone_1')
      .order('reference')
      .then(({ data, error }) => {
        if (!alive) return;
        setLoading(false);
        if (error) {
          toast.error('Erreur de chargement');
          return;
        }
        const filtered = (data ?? []).filter((t) => {
          const p = (t.prenom ?? '').trim().toLowerCase();
          const n = (t.nom ?? '').trim().toLowerCase();
          if (!p || !n) return false;
          if (p === n) return true;
          if (n.startsWith(p + ' ')) return true;
          if (n.endsWith(' ' + p)) return true;
          return false;
        }) as Row[];
        setRows(filtered);
        const initial: Record<string, { prenom: string; nom: string }> = {};
        for (const r of filtered) initial[r.id] = { prenom: r.prenom ?? '', nom: r.nom ?? '' };
        setEdits(initial);
      });
    return () => { alive = false; };
  }, [open]);

  const autoFix = (id: string) => {
    const r = rows.find((x) => x.id === id);
    if (!r) return;
    setEdits((e) => ({ ...e, [id]: { prenom: r.prenom ?? '', nom: suggestNom(r.prenom, r.nom) } }));
  };

  const save = async (id: string) => {
    const e = edits[id];
    if (!e) return;
    const { error } = await supabase
      .from('transporteurs')
      .update({ prenom: e.prenom.trim(), nom: e.nom.trim() })
      .eq('id', id);
    if (error) { toast.error('Echec : ' + error.message); return; }
    toast.success('Nom corrige');
    setRows((rs) => rs.filter((r) => r.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Corriger les noms dupliques</DialogTitle>
          <DialogDescription>
            Transporteurs dont le nom contient le prenom (ex : "Souleymane Souleymane").
            Cliquez sur l icone baguette pour appliquer une correction suggeree, puis enregistrez.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
            Aucun nom duplique detecte.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">{rows.length} fiche{rows.length > 1 ? 's' : ''} a corriger.</div>
            {rows.map((r) => {
              const e = edits[r.id] ?? { prenom: r.prenom ?? '', nom: r.nom ?? '' };
              return (
                <div key={r.id} className="grid grid-cols-[70px_1fr_1fr_auto_auto] gap-2 items-center border border-border rounded-md p-2 text-sm">
                  <div className="font-mono text-xs text-muted-foreground">{r.reference}</div>
                  <Input
                    value={e.prenom}
                    onChange={(ev) => setEdits((s) => ({ ...s, [r.id]: { ...e, prenom: ev.target.value } }))}
                    placeholder="Prenom"
                  />
                  <Input
                    value={e.nom}
                    onChange={(ev) => setEdits((s) => ({ ...s, [r.id]: { ...e, nom: ev.target.value } }))}
                    placeholder="Nom"
                  />
                  <Button size="sm" variant="outline" onClick={() => autoFix(r.id)} title="Suggerer">
                    <Wand2 className="w-4 h-4" />
                  </Button>
                  <Button size="sm" onClick={() => save(r.id)}>
                    <Save className="w-4 h-4 mr-1" /> Enregistrer
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
