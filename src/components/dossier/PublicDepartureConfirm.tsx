/**
 * Carte publique de confirmation d'un départ assigné, affichée sur /track/:id.
 * Pas besoin d'être connecté : utilise les RPC publiques
 *   - get_assigned_departure_public(tracking)
 *   - confirm_departure_public(tracking, confirmed, reason)
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { CheckCircle2, Loader2, Plane, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  tracking: string;
}

export function PublicDepartureConfirm({ tracking }: Props) {
  const qc = useQueryClient();
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['public-assigned-departure', tracking],
    enabled: !!tracking,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_assigned_departure_public' as any, { p_tracking: tracking });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as any;
    },
  });

  const decide = useMutation({
    mutationFn: async (vars: { confirmed: boolean; reason?: string | null }) => {
      const { data, error } = await supabase.rpc('confirm_departure_public' as any, {
        p_tracking: tracking,
        p_confirmed: vars.confirmed,
        p_reason: vars.reason ?? null,
      });
      if (error) throw error;
      const res = data as { ok: boolean; reason?: string } | null;
      if (!res?.ok) throw new Error(res?.reason || 'Action refusée');
      return res;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['public-assigned-departure', tracking] });
      toast.success(vars.confirmed ? 'Merci, départ confirmé ✓' : 'Refus enregistré');
      setRefuseOpen(false);
      setReason('');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Échec'),
  });

  if (isLoading || !data) return null;
  if (!data.assigned_departure_id) return null;

  const decision: string = data.client_departure_decision ?? 'pending';
  const fmt = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '—';

  return (
    <div className="rounded-2xl border border-[#F5C518]/40 bg-[#F5C518]/5 p-5 mb-5 space-y-4">
      <div className="flex items-center gap-2">
        <Plane className="w-4 h-4 text-[#F5C518]" />
        <h3 className="text-sm font-semibold text-foreground">Départ assigné — À confirmer</h3>
      </div>

      <div className="text-sm space-y-1">
        <p className="text-foreground font-medium">
          {data.origin_city ?? '—'} → {data.destination_city ?? '—'}
        </p>
        <p className="text-muted-foreground">Date : {fmt(data.departure_date)}</p>
        {data.short_ref && <p className="text-muted-foreground text-xs">Référence : #{data.short_ref}</p>}
      </div>

      {decision === 'pending' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            onClick={() => decide.mutate({ confirmed: true })}
            disabled={decide.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {decide.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
            Confirmer
          </Button>
          <Button
            variant="outline"
            onClick={() => setRefuseOpen(true)}
            disabled={decide.isPending}
            className="border-red-500/40 text-red-300 hover:bg-red-500/10 hover:text-red-200"
          >
            <XCircle className="w-4 h-4 mr-1.5" /> Refuser
          </Button>
        </div>
      ) : decision === 'confirmed' ? (
        <div className="text-sm text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Vous avez confirmé ce départ.
        </div>
      ) : (
        <div className="text-sm text-red-300 flex items-center gap-2">
          <XCircle className="w-4 h-4" /> Départ refusé. L'équipe Yobbanté vous recontacte rapidement.
        </div>
      )}

      <Dialog open={refuseOpen} onOpenChange={setRefuseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" /> Pourquoi refusez-vous ?
            </DialogTitle>
            <DialogDescription>
              Aidez-nous à vous proposer un meilleur départ.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex : la date ne me convient pas, je veux une autre destination…"
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setRefuseOpen(false)}>Retour</Button>
            <Button
              variant="destructive"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ confirmed: false, reason })}
            >
              {decide.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Refuser le départ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
