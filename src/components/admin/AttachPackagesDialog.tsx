import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { COUNTRY_FLAGS, type Package } from '@/lib/types';
import { formatStatusLabel } from '@/lib/statusLabels';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dossierId: string;
  ownerUserId: string;
}

export function AttachPackagesDialog({ open, onOpenChange, dossierId, ownerUserId }: Props) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['attach-candidates', ownerUserId, dossierId],
    enabled: open,
    queryFn: async () => {
      // Show client's packages that are not attached to ANY dossier, OR already attached to this one
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('user_id', ownerUserId)
        .or(`dossier_id.is.null,dossier_id.eq.${dossierId}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Package[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      // Detach packages currently linked but unselected
      const currentlyLinked = candidates.filter(p => p.dossier_id === dossierId).map(p => p.id);
      const toDetach = currentlyLinked.filter(id => !selected.has(id));
      const toAttach = Array.from(selected).filter(id => !currentlyLinked.includes(id));

      if (toDetach.length) {
        const { error } = await supabase.from('packages').update({ dossier_id: null }).in('id', toDetach);
        if (error) throw error;
      }
      if (toAttach.length) {
        const { error } = await supabase.from('packages').update({ dossier_id: dossierId }).in('id', toAttach);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dossier-packages', dossierId] });
      qc.invalidateQueries({ queryKey: ['attach-candidates'] });
      toast.success('Colis mis à jour');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || 'Erreur'),
  });

  // Initialize selection from currently linked packages
  if (open && selected.size === 0 && candidates.length > 0) {
    const init = new Set(candidates.filter(p => p.dossier_id === dossierId).map(p => p.id));
    if (init.size > 0) setSelected(init);
  }

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSelected(new Set()); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Lier des colis au dossier</DialogTitle>
          <DialogDescription>
            Sélectionnez les colis du client à rattacher à ce dossier.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Ce client n'a pas encore de colis disponibles.
          </p>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {candidates.map(p => {
              const checked = selected.has(p.id);
              const linkedElsewhere = p.dossier_id && p.dossier_id !== dossierId;
              return (
                <li key={p.id}>
                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${checked ? 'border-foreground bg-secondary/50' : 'border-border hover:border-foreground/40'}`}>
                    <Checkbox checked={checked} onCheckedChange={() => toggle(p.id)} disabled={!!linkedElsewhere} />
                    <span className="text-xl">{COUNTRY_FLAGS[p.warehouse_country]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{p.description || 'Colis sans description'}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatStatusLabel(p.status)} · {p.weight ? `${p.weight} kg` : '—'}
                      </p>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
