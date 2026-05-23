import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { TransporteurReferenceLookup } from '@/components/admin/TransporteurReferenceLookup';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dossierId: string;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  currentRef?: string | null;
}

export function QuickAssignGpDialog({
  open, onOpenChange, dossierId, destinationCity, destinationCountry, currentRef,
}: Props) {
  const qc = useQueryClient();
  const [ref, setRef] = useState(currentRef ?? '');
  const [matched, setMatched] = useState<any>(null);

  const assign = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('dossiers')
        .update({ assigned_transporteur_ref: ref || null })
        .eq('id', dossierId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Transporteur assigné');
      qc.invalidateQueries({ queryKey: ['admin-requests'] });
      qc.invalidateQueries({ queryKey: ['admin-dossier', dossierId] });
      qc.invalidateQueries({ queryKey: ['dossiers'] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || 'Échec'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#F5C518]" />
            Assigner un GP
          </DialogTitle>
          <DialogDescription>
            Saisis la référence à 4 chiffres du GP.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <TransporteurReferenceLookup
            value={ref}
            onChange={setRef}
            onMatch={setMatched}
            destinationCity={destinationCity ?? null}
            destinationCountry={destinationCountry ?? null}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={() => assign.mutate()}
              disabled={ref.length !== 4 || assign.isPending}
              className="bg-[#F5C518] text-black hover:bg-[#F5C518]/90"
            >
              {assign.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
              Assigner
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
