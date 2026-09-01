import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, X, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { formatXof } from '@/lib/gpFinance';
import { KIND_LABEL, MODE_LABEL, invalidateFinance, type PaymentRow } from '@/hooks/useAllPayments';

const METHODS = ['wave', 'orange_money', 'cash', 'virement', 'paytech', 'autre'];

/**
 * Fiche paiement — édition directe du montant, du statut et de la méthode.
 * Écrit sur la même source que la fiche dossier (dossiers / fret_courses),
 * donc les deux vues restent synchronisées en temps réel.
 */
export function PaymentDetailSheet({
  payment, open, onOpenChange,
}: {
  payment: PaymentRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [paid, setPaid] = useState(false);
  const [method, setMethod] = useState<string>('');
  const [carrierName, setCarrierName] = useState('');

  useEffect(() => {
    if (!payment) return;
    setAmount(String(payment.amountXof ?? ''));
    setPaid(payment.paid);
    setMethod(payment.method ?? '');
    setCarrierName(payment.kind === 'carrier' ? payment.clientName : '');
  }, [payment]);

  const save = useMutation({
    mutationFn: async () => {
      if (!payment) return;
      const value = Math.max(0, Math.round(Number(amount) || 0));
      const now = new Date().toISOString();

      if (payment.source === 'dossier') {
        const patch: Record<string, unknown> = {};
        if (payment.kind === 'client') {
          patch.final_amount_xof = value;
          patch.payment_status = paid ? 'paid' : 'pending';
          patch.paid_at = paid ? (payment.paidAt ?? now) : null;
          if (method) patch.payment_method = method;
        } else if (payment.kind === 'gp') {
          patch.gp_amount = value;
          patch.gp_paid = paid;
          patch.gp_paid_at = paid ? (payment.paidAt ?? now) : null;
          if (method) patch.gp_payment_method = method;
        } else {
          patch.carrier_cost_xof = value;
          patch.carrier_paid = paid;
          patch.carrier_paid_at = paid ? (payment.paidAt ?? now) : null;
          patch.carrier_name = carrierName || null;
          if (method) patch.carrier_payment_method = method;
        }
        const { error } = await supabase.from('dossiers').update(patch as never).eq('id', payment.sourceId);
        if (error) throw error;
      } else {
        const patch: Record<string, unknown> =
          payment.kind === 'road'
            ? { chauffeur_cost_fcfa: value, chauffeur_paid: paid, chauffeur_paid_at: paid ? (payment.paidAt ?? now) : null }
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

  if (!payment) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pr-8">
          <SheetTitle className="flex items-center gap-2 text-base">
            {KIND_LABEL[payment.kind]}
            <Badge variant="outline" className="text-[10px]">{MODE_LABEL[payment.mode]}</Badge>
          </SheetTitle>
          <SheetDescription className="text-xs">
            {payment.ref} · {payment.clientName} · {payment.route}
          </SheetDescription>
        </SheetHeader>
        <button
          onClick={() => onOpenChange(false)}
          aria-label="Fermer"
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mt-5 space-y-4">
          <div className="rounded-lg border border-border p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Montant actuel</div>
            <div className="text-xl font-semibold tabular-nums">{formatXof(payment.amountXof)}</div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-amount" className="text-xs">Montant (XOF)</Label>
            <Input
              id="pay-amount" inputMode="numeric" value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
            />
          </div>

          {payment.kind === 'carrier' && (
            <div className="space-y-1.5">
              <Label htmlFor="pay-carrier" className="text-xs">Transporteur</Label>
              <Input id="pay-carrier" value={carrierName} onChange={(e) => setCarrierName(e.target.value)} placeholder="Compagnie / agent" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Méthode</Label>
            <Select value={method || undefined} onValueChange={setMethod}>
              <SelectTrigger><SelectValue placeholder="Non renseignée" /></SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium">
                {payment.direction === 'in' ? 'Encaissé' : 'Réglé au transporteur'}
              </div>
              <div className="text-xs text-muted-foreground">
                {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString('fr-FR') : 'Non réglé'}
              </div>
            </div>
            <Switch checked={paid} onCheckedChange={setPaid} />
          </div>

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
        </div>
      </SheetContent>
    </Sheet>
  );
}
