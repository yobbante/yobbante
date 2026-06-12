/**
 * Carte de décision client sur un départ assigné.
 * - Confirmer le départ
 * - Demander une date plus proche (avec date)
 * - Annuler (avec raison)
 *
 * S'affiche dans /app/dossier/:id dès qu'un assigned_departure_id existe.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Calendar, CheckCircle2, Clock, Loader2, Plane, ShieldAlert, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { clarityEvent } from '@/lib/clarity';

type Decision = 'pending' | 'confirmed' | 'reschedule_requested' | 'cancelled';

interface Props {
  dossierId: string;
  assignedDepartureId: string | null | undefined;
  decision: Decision | null | undefined;
  decidedAt: string | null | undefined;
  requestedDate: string | null | undefined;
  note: string | null | undefined;
  dossierStatus: string | null | undefined;
}

const TERMINAL = ['IN_TRANSIT', 'CUSTOMS', 'ARRIVED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CLOSED', 'CANCELLED'];

export function ClientDepartureDecision({
  dossierId,
  assignedDepartureId,
  decision,
  decidedAt,
  requestedDate,
  note,
  dossierStatus,
}: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<null | 'reschedule' | 'cancel'>(null);
  const [pickDate, setPickDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  const { data: dep } = useQuery({
    queryKey: ['dossier-assigned-departure', assignedDepartureId],
    enabled: !!assignedDepartureId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manual_departures')
        .select('id, origin_city, destination_city, departure_date, transport_mode, status')
        .eq('id', assignedDepartureId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Realtime — mettre à jour la carte si l'admin change le départ
  useEffect(() => {
    const ch = supabase
      .channel(`dossier-decision-${dossierId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dossiers', filter: `id=eq.${dossierId}` },
        () => qc.invalidateQueries({ queryKey: ['dossier', dossierId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [dossierId, qc]);

  // Track when the client lands on the confirmation card (from wa.me link)
  useEffect(() => {
    if (!assignedDepartureId) return;
    if (decision && decision !== 'pending') return;
    clarityEvent('client_departure_confirmation_opened', {
      dossier_id: dossierId,
      decision: decision ?? 'pending',
    });
  }, [assignedDepartureId, decision, dossierId]);

  const decide = useMutation({
    mutationFn: async (vars: { decision: 'confirmed' | 'reschedule_requested' | 'cancelled'; date?: string | null; note?: string | null }) => {
      const { error } = await supabase.rpc('client_decide_departure' as any, {
        p_dossier_id: dossierId,
        p_decision: vars.decision,
        p_requested_date: vars.date ?? null,
        p_note: vars.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['dossier', dossierId] });
      const msg =
        vars.decision === 'confirmed' ? 'Départ confirmé ✓' :
        vars.decision === 'reschedule_requested' ? 'Demande envoyée à l\'équipe' :
        'Annulation enregistrée';
      toast.success(msg);
      setMode(null);
      setReason('');
      setPickDate('');
    },
    onError: (e: any) => toast.error(e?.message || 'Échec'),
  });

  if (!assignedDepartureId) return null;
  if (dossierStatus && TERMINAL.includes(dossierStatus)) return null;

  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' }) : '—';

  const d = decision ?? 'pending';

  return (
    <section>
      <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
        <Plane className="w-4 h-4 text-[#F5C518]" /> Votre départ
      </h2>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        {/* Info départ */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Un transporteur a été assigné à votre colis :</p>
          <p className="text-base font-semibold text-foreground">
            {dep?.origin_city ?? '—'} → {dep?.destination_city ?? '—'}
          </p>
          <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Départ prévu : {fmtDate(dep?.departure_date)}
          </p>
        </div>

        {/* État courant */}
        {d === 'confirmed' && (
          <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-200 flex gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Vous avez confirmé ce départ.</p>
              {decidedAt && <p className="text-xs opacity-80 mt-0.5">Le {new Date(decidedAt).toLocaleString('fr-FR')}</p>}
            </div>
          </div>
        )}
        {d === 'reschedule_requested' && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100 flex gap-2">
            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Demande d'une date plus proche envoyée.</p>
              {requestedDate && (
                <p className="text-xs opacity-90 mt-0.5">Date souhaitée : {fmtDate(requestedDate)}</p>
              )}
              {note && <p className="text-xs opacity-80 mt-1 italic">« {note} »</p>}
              <p className="text-xs opacity-80 mt-1">L'équipe Yobbanté vous contactera sous peu.</p>
            </div>
          </div>
        )}
        {d === 'cancelled' && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100 flex gap-2">
            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Vous avez annulé cet envoi.</p>
              {note && <p className="text-xs opacity-80 mt-1 italic">« {note} »</p>}
              <p className="text-xs opacity-80 mt-1">L'équipe Yobbanté reviendra vers vous.</p>
            </div>
          </div>
        )}

        {/* Actions */}
        {d === 'pending' && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Validez ce départ ou proposez une autre option :</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                onClick={() => decide.mutate({ decision: 'confirmed' })}
                disabled={decide.isPending}
                className="bg-[#F5C518] text-black hover:bg-[#F5C518]/90"
              >
                {decide.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                Confirmer
              </Button>
              <Button
                variant="outline"
                onClick={() => setMode('reschedule')}
                disabled={decide.isPending}
              >
                <Clock className="w-4 h-4 mr-1.5" /> Date plus proche
              </Button>
              <Button
                variant="outline"
                onClick={() => setMode('cancel')}
                disabled={decide.isPending}
                className="border-red-500/40 text-red-300 hover:bg-red-500/10 hover:text-red-200"
              >
                <XCircle className="w-4 h-4 mr-1.5" /> Annuler
              </Button>
            </div>
          </div>
        )}

        {/* Permettre de revenir sur sa décision tant que non IN_TRANSIT */}
        {(d === 'reschedule_requested' || d === 'cancelled' || d === 'confirmed') && (
          <button
            onClick={() => decide.mutate({ decision: 'confirmed' })}
            className={cn(
              'text-xs underline-offset-2 hover:underline text-muted-foreground',
              d === 'confirmed' && 'hidden',
            )}
          >
            Finalement, je confirme ce départ
          </button>
        )}
      </div>

      {/* Dialog : Demander date plus proche */}
      <Dialog open={mode === 'reschedule'} onOpenChange={(v) => !v && setMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#F5C518]" /> Demander une date plus proche
            </DialogTitle>
            <DialogDescription>
              Indiquez la date à laquelle vous souhaiteriez expédier. L'équipe vous proposera une alternative.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Date souhaitée</label>
              <Input
                type="date"
                value={pickDate}
                min={new Date().toISOString().slice(0, 10)}
                max="2099-12-31"
                onChange={e => {
                  const v = e.target.value;
                  const m = v.match(/^(\d{4})-\d{2}-\d{2}$/);
                  if (v && (!m || Number(m[1]) < 2024 || Number(m[1]) > 2099)) return;
                  setPickDate(v);
                }}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Précisions (optionnel)</label>
              <Textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Ex : je voyage le 10 et j'ai besoin du colis avant."
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setMode(null)}>Annuler</Button>
            <Button
              disabled={!pickDate || decide.isPending}
              onClick={() => decide.mutate({ decision: 'reschedule_requested', date: pickDate, note: reason || null })}
              className="bg-[#F5C518] text-black hover:bg-[#F5C518]/90"
            >
              {decide.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : Annuler */}
      <Dialog open={mode === 'cancel'} onOpenChange={(v) => !v && setMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" /> Annuler cet envoi
            </DialogTitle>
            <DialogDescription>
              L'équipe Yobbanté sera notifiée. Vous pourrez relancer l'envoi à tout moment depuis votre espace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Raison (optionnel)</label>
              <Textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Ex : changement de programme, prix trop élevé, etc."
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setMode(null)}>Retour</Button>
            <Button
              variant="destructive"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ decision: 'cancelled', note: reason || null })}
            >
              {decide.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Confirmer l'annulation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
