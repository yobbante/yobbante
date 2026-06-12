/**
 * Actions client sur son propre dossier (depuis /app/dossier/:id) :
 *  - Modifier la date de collecte
 *  - Modifier l'adresse de collecte
 *  - Annuler la demande (seulement si SUBMITTED & aucun départ assigné)
 *
 * Toutes les actions sont gardées par RPC SECURITY DEFINER côté DB
 * et notifient automatiquement l'équipe Yobbanté.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { CalendarDays, Loader2, MapPin, Settings2, ShieldAlert, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  dossierId: string;
  trackingId?: string | null;
  status: string | null | undefined;
  assignedDepartureId: string | null | undefined;
  decision: string | null | undefined;
  pickupDate: string | null | undefined;
  senderAddress: string | null | undefined;
}

const EDITABLE_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'SOURCING', 'PROCURED'];

export function ClientDossierActions({
  dossierId, trackingId, status, assignedDepartureId, decision, pickupDate, senderAddress,
}: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<null | 'date' | 'address' | 'cancel'>(null);
  const [dateVal, setDateVal] = useState<string>(pickupDate ? String(pickupDate).slice(0, 10) : '');
  const [addrVal, setAddrVal] = useState<string>(senderAddress ?? '');
  const [reason, setReason] = useState<string>('');

  const canEdit = !!status && EDITABLE_STATUSES.includes(status) && decision !== 'confirmed';
  const canCancel = status === 'SUBMITTED' && !assignedDepartureId;

  if (!canEdit && !canCancel) return null;

  const updatePickup = useMutation({
    mutationFn: async (vars: { date?: string | null; address?: string | null }) => {
      const { data, error } = await supabase.rpc('client_update_pickup' as any, {
        p_dossier_id: dossierId,
        p_pickup_date: vars.date ?? null,
        p_pickup_address: vars.address ?? null,
      });
      if (error) throw error;
      const res = data as { ok: boolean; reason?: string } | null;
      if (!res?.ok) throw new Error(res?.reason || 'Modification refusée');
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dossier', dossierId] });
      qc.invalidateQueries({ queryKey: ['dossiers'] });
      toast.success(`Modification envoyée — ${trackingId ?? ''}`.trim());
      setMode(null);
      setReason('');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Échec'),
  });

  const cancelDossier = useMutation({
    mutationFn: async (vars: { reason: string }) => {
      const { data, error } = await supabase.rpc('client_cancel_dossier' as any, {
        p_dossier_id: dossierId,
        p_reason: vars.reason || null,
      });
      if (error) throw error;
      const res = data as { ok: boolean; reason?: string } | null;
      if (!res?.ok) throw new Error(res?.reason || 'Annulation refusée');
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dossier', dossierId] });
      qc.invalidateQueries({ queryKey: ['dossiers'] });
      toast.success(`Demande annulée — ${trackingId ?? ''}`.trim());
      setMode(null);
      setReason('');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Échec de l\'annulation'),
  });

  return (
    <section>
      <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2 flex-wrap">
        <Settings2 className="w-4 h-4 text-[#F5C518]" /> Gérer mon dossier
        {trackingId && (
          <span className="ml-auto font-mono text-[11px] px-2 py-0.5 rounded-full bg-[#F5C518]/10 text-[#F5C518] border border-[#F5C518]/30">
            #{trackingId}
          </span>
        )}
      </h2>

      <div className="bg-card border border-border rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {canEdit && (
          <>
            <Button
              variant="outline"
              onClick={() => setMode('date')}
              className="justify-start gap-2"
            >
              <CalendarDays className="w-4 h-4 text-[#F5C518]" />
              <span className="text-left">
                <span className="block text-sm font-medium">Modifier la date de collecte</span>
                <span className="block text-[11px] text-muted-foreground">
                  {pickupDate ? new Date(pickupDate).toLocaleDateString('fr-FR') : 'Non renseignée'}
                </span>
              </span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setMode('address')}
              className="justify-start gap-2"
            >
              <MapPin className="w-4 h-4 text-[#F5C518]" />
              <span className="text-left min-w-0">
                <span className="block text-sm font-medium">Modifier l'adresse de collecte</span>
                <span className="block text-[11px] text-muted-foreground truncate max-w-[220px]">
                  {senderAddress || 'Non renseignée'}
                </span>
              </span>
            </Button>
          </>
        )}
        {canCancel && (
          <Button
            variant="outline"
            onClick={() => setMode('cancel')}
            className="justify-start gap-2 border-red-500/40 text-red-300 hover:bg-red-500/10 hover:text-red-200 sm:col-span-2"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-sm font-medium">Annuler ma demande</span>
          </Button>
        )}
      </div>

      {/* Dialog : nouvelle date */}
      <Dialog open={mode === 'date'} onOpenChange={(v) => !v && setMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#F5C518]" /> Nouvelle date de collecte
            </DialogTitle>
            <DialogDescription>
              L'équipe Yobbanté sera notifiée et adaptera votre dossier.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Date souhaitée</label>
            <Input
              type="date"
              value={dateVal}
              min={new Date().toISOString().slice(0, 10)}
              max="2099-12-31"
              onChange={(e) => {
                const v = e.target.value;
                const m = v.match(/^(\d{4})-\d{2}-\d{2}$/);
                if (v && (!m || Number(m[1]) < 2024 || Number(m[1]) > 2099)) return;
                setDateVal(v);
              }}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setMode(null)}>Annuler</Button>
            <Button
              disabled={!dateVal || updatePickup.isPending}
              onClick={() => updatePickup.mutate({ date: dateVal })}
              className="bg-[#F5C518] text-black hover:bg-[#F5C518]/90"
            >
              {updatePickup.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : nouvelle adresse */}
      <Dialog open={mode === 'address'} onOpenChange={(v) => !v && setMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#F5C518]" /> Nouvelle adresse de collecte
            </DialogTitle>
            <DialogDescription>
              Indiquez l'adresse complète où récupérer votre colis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              value={addrVal}
              onChange={(e) => setAddrVal(e.target.value)}
              placeholder="Ex : 12 Rue de Paris, 75001 Paris"
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setMode(null)}>Annuler</Button>
            <Button
              disabled={!addrVal.trim() || updatePickup.isPending}
              onClick={() => updatePickup.mutate({ address: addrVal })}
              className="bg-[#F5C518] text-black hover:bg-[#F5C518]/90"
            >
              {updatePickup.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : annulation */}
      <Dialog open={mode === 'cancel'} onOpenChange={(v) => !v && setMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" /> Annuler ma demande
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir annuler ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">
              Raison (optionnel)
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex : changement de plan, prix trop élevé…"
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setMode(null)}>Non, garder</Button>
            <Button
              variant="destructive"
              disabled={cancelDossier.isPending}
              onClick={() => cancelDossier.mutate({ reason })}
            >
              {cancelDossier.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Oui, annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
