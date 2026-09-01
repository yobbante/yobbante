import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, X, ExternalLink, Ban, Truck, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { formatXof } from '@/lib/gpFinance';
import { KIND_LABEL, MODE_LABEL, invalidateFinance, type PaymentRow } from '@/hooks/useAllPayments';
import { CancelDossierDialog } from '@/components/admin/dossier-sheet/DossierLifecycleDialogs';
import { canCancel, isTerminal } from '@/lib/dossierLifecycle';
import { CarrierPicker } from '@/components/admin/payments/CarrierPicker';
import { carrierTypesForMode, useResolvedCarrier } from '@/hooks/useCarrierDirectory';

const METHODS = ['wave', 'orange_money', 'cash', 'virement', 'paytech', 'autre'];
const METHOD_LABEL: Record<string, string> = {
  wave: 'Wave', orange_money: 'Orange Money', cash: 'Espèces',
  virement: 'Virement', paytech: 'PayTech', autre: 'Autre',
};

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

/**
 * Fiche paiement — détails complets + édition directe du montant, de la méthode,
 * de la date de règlement et du statut. Écrit sur la même source que la fiche
 * dossier (dossiers / fret_courses) : les deux vues restent synchronisées.
 */
export function PaymentDetailSheet({
  payment, related = [], open, onOpenChange,
}: {
  payment: PaymentRow | null;
  /** Autres paiements du même dossier (pour afficher la marge). */
  related?: PaymentRow[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [paid, setPaid] = useState(false);
  const [method, setMethod] = useState<string>('');
  const [paidDate, setPaidDate] = useState('');
  const [carrierName, setCarrierName] = useState('');
  const [carrierRef, setCarrierRef] = useState<string | null>(null);
  const [carrierCost, setCarrierCost] = useState('');
  const [carrierPaid, setCarrierPaid] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  // Dossier lié : statut + coût transporteur alloué (source unique, synchronisée).
  const dossierId = payment?.dossierId ?? null;
  const { data: dossier } = useQuery({
    queryKey: ['admin-dossier', dossierId, 'payment-sheet'],
    enabled: open && !!dossierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('id, status, carrier_name, carrier_cost_xof, carrier_paid, gp_id, gp_amount, assigned_transporteur_ref, transport_mode')
        .eq('id', dossierId as string)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: autoCarrier } = useResolvedCarrier(open ? dossier : null);

  useEffect(() => {
    if (!payment) return;
    setAmount(String(payment.amountXof ?? ''));
    setPaid(payment.paid);
    setMethod(payment.method ?? '');
    setPaidDate(toDateInput(payment.paidAt));
    setCarrierName(payment.kind === 'carrier' ? payment.clientName : '');
    setCarrierRef(null);
  }, [payment]);

  useEffect(() => {
    if (!dossier) return;
    if (payment?.kind !== 'carrier') setCarrierName(dossier.carrier_name ?? '');
    setCarrierRef(dossier.assigned_transporteur_ref ?? null);
    const cost = dossier.carrier_cost_xof ?? (Number(dossier.gp_amount) > 0 ? Number(dossier.gp_amount) : null);
    setCarrierCost(cost != null ? String(cost) : '');
    setCarrierPaid(!!dossier.carrier_paid);
  }, [dossier, payment?.kind]);


  // Pré-remplissage automatique quand le dossier n'a pas encore de transporteur saisi.
  useEffect(() => {
    if (!autoCarrier) return;
    setCarrierName((prev) => prev || autoCarrier.name);
    setCarrierRef((prev) => prev || autoCarrier.ref);
    if (autoCarrier.cost != null) setCarrierCost((prev) => (prev ? prev : String(autoCarrier.cost)));
  }, [autoCarrier]);

  const save = useMutation({
    mutationFn: async (opts?: { forcePaid?: boolean }) => {
      if (!payment) return;
      const isPaid = opts?.forcePaid ?? paid;
      const value = Math.max(0, Math.round(Number(amount) || 0));
      const paidAtIso = isPaid ? (paidDate ? new Date(paidDate + 'T12:00:00').toISOString() : new Date().toISOString()) : null;
      const paid = isPaid; // eslint-disable-line @typescript-eslint/no-shadow


      if (payment.source === 'dossier') {
        const patch: Record<string, unknown> = {};
        if (payment.kind === 'client') {
          patch.final_amount_xof = value;
          patch.payment_status = paid ? 'paid' : 'pending';
          patch.paid_at = paidAtIso;
          if (method) patch.payment_method = method;
        } else if (payment.kind === 'gp') {
          patch.gp_amount = value;
          patch.gp_paid = paid;
          patch.gp_paid_at = paidAtIso;
          if (method) patch.gp_payment_method = method;
        } else {
          patch.carrier_cost_xof = value;
          patch.carrier_paid = paid;
          patch.carrier_paid_at = paidAtIso;
          patch.carrier_name = carrierName || null;
          if (method) patch.carrier_payment_method = method;
        }
        // Transporteur alloué au dossier (éditable depuis n'importe quel paiement du dossier)
        if (payment.kind !== 'carrier' && dossierId) {
          const cost = carrierCost === '' ? null : Math.max(0, Math.round(Number(carrierCost) || 0));
          patch.carrier_name = carrierName || null;
          patch.carrier_cost_xof = cost;
          if (carrierRef) patch.assigned_transporteur_ref = carrierRef;
          patch.carrier_paid = carrierPaid;
          patch.carrier_paid_at = carrierPaid ? (dossier?.carrier_paid ? undefined : new Date().toISOString()) : null;
          if (patch.carrier_paid_at === undefined) delete patch.carrier_paid_at;
        }
        const { error } = await supabase.from('dossiers').update(patch as never).eq('id', payment.sourceId);
        if (error) throw error;

      } else {
        const patch: Record<string, unknown> =
          payment.kind === 'road'
            ? { chauffeur_cost_fcfa: value, chauffeur_paid: paid, chauffeur_paid_at: paidAtIso }
            : { total_fcfa: value };
        const { error } = await supabase.from('fret_courses' as never).update(patch as never).eq('id', payment.sourceId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Paiement mis à jour — synchronisé avec le dossier');
      invalidateFinance(qc);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error('Échec : ' + e.message),
  });

  /**
   * Annulation / archivage direct depuis la fiche paiement.
   * - archive : dossier → ARCHIVED (ou course fret → ANNULE)
   * - cancel  : réservé aux courses fret sans dossier (les dossiers passent par CancelDossierDialog)
   */
  const lifecycle = useMutation({
    mutationFn: async (action: 'archive' | 'cancel') => {
      if (!payment) return;
      if (payment.source === 'dossier' && dossierId) {
        const patch: Record<string, unknown> = action === 'archive'
          ? { status: 'ARCHIVED' }
          : { status: 'CANCELLED', cancellation_source: 'admin', cancelled_by: 'admin' };
        const { error } = await supabase.from('dossiers').update(patch as never).eq('id', dossierId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('fret_courses' as never)
          .update({ status: 'ANNULE' } as never)
          .eq('id', payment.sourceId);
        if (error) throw error;
      }
    },
    onSuccess: (_d, action) => {
      toast.success(action === 'archive' ? 'Paiement archivé' : 'Course annulée');
      invalidateFinance(qc);
      qc.invalidateQueries({ queryKey: ['admin-dossier'] });
      qc.invalidateQueries({ queryKey: ['dossiers'] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error('Échec : ' + e.message),
  });

  if (!payment) return null;

  const others = related.filter((r) => r.key !== payment.key);
  const inSum = related.filter((r) => r.direction === 'in').reduce((s, r) => s + r.amountXof, 0);
  const outSum = related.filter((r) => r.direction === 'out').reduce((s, r) => s + r.amountXof, 0);
  const hasMethod = payment.source === 'dossier';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pr-8">
          <SheetTitle className="flex items-center gap-2 text-base">
            {KIND_LABEL[payment.kind]}
            <Badge variant="outline" className="text-[10px]">{MODE_LABEL[payment.mode]}</Badge>
            <span className={payment.paid ? 'text-[hsl(var(--success))] text-[10px] font-medium' : 'text-amber-500 text-[10px] font-medium'}>
              {payment.paid ? 'Réglé' : 'En attente'}
            </span>
          </SheetTitle>
          <SheetDescription className="text-xs">{payment.ref}</SheetDescription>
        </SheetHeader>
        <button
          onClick={() => onOpenChange(false)}
          aria-label="Fermer"
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mt-5 space-y-4">
          {/* Infos */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Info label={payment.kind === 'carrier' ? 'Transporteur' : 'Client'} value={payment.clientName} />
            <Info label="Trajet" value={payment.route} />
            <Info label="Créé le" value={new Date(payment.date).toLocaleDateString('fr-FR')} />
            <Info label="Méthode actuelle" value={payment.method ? (METHOD_LABEL[payment.method] ?? payment.method) : '—'} />
          </div>

          {/* Marge du dossier (quand plusieurs paiements liés) */}
          {others.length > 0 && (
            <div className="rounded-lg border border-border p-3 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Dossier — vue d'ensemble</div>
              {related.map((r) => (
                <div key={r.key} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {KIND_LABEL[r.kind]}{r.key === payment.key ? ' (ce paiement)' : ''}
                  </span>
                  <span className="tabular-nums font-medium">{formatXof(r.amountXof)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                <span className="font-medium">Marge</span>
                <span className={inSum - outSum >= 0 ? 'tabular-nums font-semibold text-[hsl(var(--success))]' : 'tabular-nums font-semibold text-[hsl(var(--danger))]'}>
                  {formatXof(inSum - outSum)}
                </span>
              </div>
            </div>
          )}

          {/* Édition */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount" className="text-xs">Montant (XOF)</Label>
            <Input
              id="pay-amount" inputMode="numeric" value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
            />
          </div>

          {payment.kind === 'carrier' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Transporteur</Label>
              <CarrierPicker
                value={carrierName}
                valueRef={carrierRef}
                types={carrierTypesForMode(payment.mode)}
                autoDetected={autoCarrier ?? null}
                onChange={(name, ref) => { setCarrierName(name); setCarrierRef(ref); }}
              />
            </div>
          )}

          {hasMethod && (
            <div className="space-y-1.5">
              <Label className="text-xs">Méthode</Label>
              <Select value={method || undefined} onValueChange={setMethod}>
                <SelectTrigger><SelectValue placeholder="Non renseignée" /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => <SelectItem key={m} value={m}>{METHOD_LABEL[m]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="text-sm font-medium">
              {payment.direction === 'in' ? 'Encaissé' : 'Réglé au transporteur'}
            </div>
            <Switch checked={paid} onCheckedChange={setPaid} />
          </div>

          {paid && (
            <div className="space-y-1.5">
              <Label htmlFor="pay-date" className="text-xs">Date de règlement</Label>
              <Input id="pay-date" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
            </div>
          )}

          {/* Transporteur alloué au dossier — écrit sur le dossier, donc synchronisé partout */}
          {payment.kind !== 'carrier' && payment.source === 'dossier' && dossierId && (
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium">
                <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                Transporteur alloué
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nom / compagnie</Label>
                <CarrierPicker
                  value={carrierName}
                  valueRef={carrierRef}
                  types={carrierTypesForMode(payment.mode)}
                  autoDetected={autoCarrier ?? null}
                  onChange={(name, ref) => { setCarrierName(name); setCarrierRef(ref); }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="alloc-cost" className="text-xs text-muted-foreground">Prix payé au transporteur (XOF)</Label>
                <Input
                  id="alloc-cost" inputMode="numeric" value={carrierCost}
                  onChange={(e) => setCarrierCost(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="0"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">Déjà réglé au transporteur</span>
                <Switch checked={carrierPaid} onCheckedChange={setCarrierPaid} />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1">
              {save.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Enregistrer
            </Button>
            {payment.dossierId && (
              <Button variant="outline" asChild>
                <a href={`/admin/orders?dossier=${payment.dossierId}`}>
                  <ExternalLink className="w-4 h-4 mr-1" /> Dossier
                </a>
              </Button>
            )}
          </div>

          {/* Cycle de vie — annulation / archivage */}
          {(dossierId || payment.source === 'course') && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cycle de vie</div>

              {dossierId && dossier?.status && !isTerminal(dossier.status) && (
                <Button
                  variant="outline"
                  className="w-full border-red-500/40 text-red-500 hover:bg-red-500/10 hover:text-red-500"
                  disabled={!canCancel(dossier.status)}
                  onClick={() => setCancelOpen(true)}
                >
                  <Ban className="w-4 h-4 mr-1" />
                  {canCancel(dossier.status) ? 'Annuler ce dossier' : 'Annulation impossible (en transit)'}
                </Button>
              )}

              {payment.source === 'course' && !dossierId && (
                <Button
                  variant="outline"
                  className="w-full border-red-500/40 text-red-500 hover:bg-red-500/10 hover:text-red-500"
                  disabled={lifecycle.isPending}
                  onClick={() => lifecycle.mutate('cancel')}
                >
                  <Ban className="w-4 h-4 mr-1" /> Annuler cette course
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full"
                disabled={lifecycle.isPending || (dossier?.status === 'ARCHIVED')}
                onClick={() => lifecycle.mutate('archive')}
              >
                <Archive className="w-4 h-4 mr-1" />
                {dossier?.status === 'ARCHIVED' ? 'Déjà archivé' : 'Archiver ce paiement'}
              </Button>

              <p className="text-[10px] text-muted-foreground">
                L'archivage retire le paiement des vues actives — le dossier passe en « Archivé ».
              </p>
            </div>
          )}

          {dossier?.status === 'CANCELLED' && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-500 text-center">
              Dossier annulé
            </div>
          )}

        </div>

        {dossierId && (
          <CancelDossierDialog
            open={cancelOpen}
            onOpenChange={setCancelOpen}
            dossierId={dossierId}
            currentStatus={dossier?.status ?? ''}
            displayRef={payment.ref}
            onDone={() => { invalidateFinance(qc); onOpenChange(false); }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}


function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2 min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium truncate">{value}</div>
    </div>
  );
}
