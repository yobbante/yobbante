/**
 * Boîtes de dialogue d'annulation et de retour dossier.
 *
 * Utilisées depuis le drawer admin et — via les mêmes props — depuis
 * n'importe quel écran qui liste des dossiers (fiche GP, fiche client,
 * kanban…). Toute la logique de transition passe par `dossierLifecycle.ts`.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { RETURN_REASON_CATEGORIES, canCancel, canRequestReturn } from '@/lib/dossierLifecycle';

interface BaseProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dossierId: string;
  currentStatus: string;
  /** displayed label like YOB-XXXXXX or reference */
  displayRef?: string;
  onDone?: () => void;
}

export function CancelDossierDialog({ open, onOpenChange, dossierId, currentStatus, displayRef, onDone }: BaseProps) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');

  const allowed = canCancel(currentStatus);

  const mut = useMutation({
    mutationFn: async () => {
      if (!allowed) throw new Error('Impossible d\'annuler un colis déjà en transit. Utilisez le retour.');
      const { error } = await supabase
        .from('dossiers')
        .update({
          status: 'CANCELLED',
          cancellation_reason: reason.trim() || null,
          cancellation_source: 'admin',
          cancelled_by: 'admin',
        } as any)
        .eq('id', dossierId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Dossier annulé');
      qc.invalidateQueries({ queryKey: ['admin-dossier', dossierId] });
      qc.invalidateQueries({ queryKey: ['dossiers'] });
      qc.invalidateQueries({ queryKey: ['inbox-dossiers'] });
      qc.invalidateQueries({ queryKey: ['departure-dossiers'] });
      qc.invalidateQueries({ queryKey: ['admin-requests'] });
      window.dispatchEvent(new CustomEvent('dossier:lifecycle-action', {
        detail: { dossierId, action: 'cancelled', newStatus: 'CANCELLED', reason: reason.trim() || null },
      }));
      onOpenChange(false);
      setReason('');
      onDone?.();
    },
    onError: (e: any) => toast.error(e?.message || 'Échec annulation'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Annuler ce dossier</DialogTitle>
          <DialogDescription>
            {displayRef ? <span className="font-mono text-xs">{displayRef}</span> : null}
          </DialogDescription>
        </DialogHeader>

        {!allowed ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
            Impossible d'annuler un colis déjà en transit. Utilisez « Démarrer un retour ».
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Motif d'annulation</Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ex : client a changé d'avis, doublon, informations erronées…"
              rows={4}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button
            variant="destructive"
            disabled={!allowed || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Confirmer l'annulation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReturnDossierDialog({ open, onOpenChange, dossierId, currentStatus, displayRef, onDone }: BaseProps) {
  const qc = useQueryClient();
  const [category, setCategory] = useState('refused');
  const [reason, setReason] = useState('');

  const allowed = canRequestReturn(currentStatus);

  const mut = useMutation({
    mutationFn: async () => {
      if (!allowed) throw new Error('Le retour n\'est possible qu\'à partir du transit.');
      const { error } = await supabase
        .from('dossiers')
        .update({
          status: 'RETURN_REQUESTED',
          return_reason_category: category,
          return_reason: reason.trim() || null,
        } as any)
        .eq('id', dossierId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Retour demandé');
      qc.invalidateQueries({ queryKey: ['admin-dossier', dossierId] });
      qc.invalidateQueries({ queryKey: ['dossiers'] });
      qc.invalidateQueries({ queryKey: ['inbox-dossiers'] });
      qc.invalidateQueries({ queryKey: ['departure-dossiers'] });
      onOpenChange(false);
      setReason('');
      onDone?.();
    },
    onError: (e: any) => toast.error(e?.message || 'Échec de la demande de retour'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Démarrer un retour</DialogTitle>
          <DialogDescription>
            {displayRef ? <span className="font-mono text-xs">{displayRef}</span> : null}
          </DialogDescription>
        </DialogHeader>

        {!allowed ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-500">
            Le retour n'est possible qu'à partir du moment où le colis est en transit.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RETURN_REASON_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="return-reason">Précisions</Label>
              <Textarea
                id="return-reason"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Contexte, contact destinataire, action à prendre…"
                rows={4}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button
            disabled={!allowed || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Confirmer le retour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
