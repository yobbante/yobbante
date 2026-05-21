import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Scale, CreditCard, HandCoins } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface WeighingDossier {
  id: string;
  tracking_id: string | null;
  reference: string;
  buyer_name: string | null;
  contact_phone: string | null;
  estimated_weight: number | null;
  estimated_cost: number | null;
  destination_country: string | null;
  user_id: string;
}

const HUBS = ['Hub Dakar', 'Hub Paris', 'Hub New York', 'Hub Dubaï', 'Hub Chine'];

export function WeighingDialog({
  dossier, open, onClose, onDone,
}: {
  dossier: WeighingDossier | null;
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}) {
  const [weight, setWeight] = useState('');
  const [location, setLocation] = useState<string>('Hub Dakar');
  const [cod, setCod] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) { setWeight(''); setLocation('Hub Dakar'); setCod(false); }
  }, [open, dossier?.id]);

  const actualKg = parseFloat(weight.replace(',', '.'));
  const valid = !isNaN(actualKg) && actualKg > 0;

  // Compute final amount: scale estimated_cost (EUR) by actual/estimated ratio, fallback to flat 2500 XOF/kg
  const { finalXof, diffXof, estXof } = useMemo(() => {
    const estKg = dossier?.estimated_weight ?? 0;
    const estEur = dossier?.estimated_cost ?? 0;
    const estXof = Math.round(estEur * 655.957);
    if (!valid || !dossier) return { finalXof: 0, diffXof: 0, estXof };
    const ratio = estKg > 0 ? actualKg / estKg : 1;
    const baseXof = estXof > 0 ? estXof : Math.round(actualKg * 2500);
    const finalXof = estXof > 0 ? Math.round(estXof * ratio) : baseXof;
    return { finalXof, diffXof: finalXof - estXof, estXof };
  }, [valid, actualKg, dossier]);

  async function submit(asCod: boolean) {
    if (!dossier || !valid) return;
    setSubmitting(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id ?? null;
      const now = new Date().toISOString();

      const update: Record<string, unknown> = {
        actual_weight_kg: actualKg,
        final_amount_xof: finalXof,
        weighed_at: now,
        weighed_by: uid,
        weigh_location: location,
      };
      if (asCod) {
        update.cash_on_delivery = true;
        update.payment_status = 'not_required';
        update.status = 'IN_TRANSIT';
      } else {
        update.cash_on_delivery = false;
        update.payment_status = 'pending';
        update.status = 'WEIGHED';
      }

      const { error: updErr } = await supabase.from('dossiers').update(update as any).eq('id', dossier.id);
      if (updErr) throw updErr;

      await supabase.from('weight_logs' as any).insert({
        dossier_id: dossier.id,
        weight_kg: actualKg,
        measured_by: uid,
        location,
      });

      // WhatsApp notification
      const prenom = (dossier.buyer_name || '').split(' ')[0] || 'Client';
      const trackingId = dossier.tracking_id || dossier.reference;
      const payLink = `https://yobbante.com/pay/${trackingId}`;
      if (dossier.contact_phone) {
        const params = asCod
          ? [prenom, trackingId, `${actualKg}kg`, `${finalXof.toLocaleString('fr-FR')} XOF`]
          : [prenom, trackingId, `${actualKg}kg`, `${finalXof.toLocaleString('fr-FR')} XOF`, payLink];

        const template_name = asCod ? 'cash_on_delivery_confirmed' : 'weight_confirmation';
        try {
          await supabase.functions.invoke('send-whatsapp', {
            body: {
              recipient_type: 'client',
              recipient_phone: dossier.contact_phone,
              template_name,
              template_params: params,
              dossier_id: dossier.id,
              trigger_type: asCod ? 'weighed_cod' : 'weighed_payment_request',
            },
          });
        } catch (e) {
          console.warn('whatsapp send failed', e);
        }
      }

      toast.success(asCod ? 'Pesée + cash à la livraison enregistrés' : 'Pesée enregistrée — paiement demandé');
      onDone?.();
      onClose();
    } catch (e) {
      toast.error('Erreur : ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-[#F5C518]" />
            Pesée au hub
          </DialogTitle>
          <DialogDescription>
            {dossier ? `${dossier.tracking_id || dossier.reference} · ${dossier.buyer_name ?? ''}` : ''}
          </DialogDescription>
        </DialogHeader>

        {dossier && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-secondary/40 p-3">
                <div className="text-[10px] uppercase text-muted-foreground font-semibold">Poids estimé</div>
                <div className="text-sm font-medium mt-0.5">{dossier.estimated_weight ?? '—'} kg</div>
              </div>
              <div className="rounded-lg bg-secondary/40 p-3">
                <div className="text-[10px] uppercase text-muted-foreground font-semibold">Montant estimé</div>
                <div className="text-sm font-medium mt-0.5">{estXof ? `${estXof.toLocaleString('fr-FR')} XOF` : '—'}</div>
              </div>
            </div>

            <div>
              <Label className="text-xs">Poids réel pesé (kg)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>

            <div>
              <Label className="text-xs">Lieu de pesée</Label>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HUBS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {valid && (
              <div className="rounded-lg border border-[#F5C518]/30 bg-[#F5C518]/5 p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nouveau montant</span>
                  <span className="font-bold text-base">{finalXof.toLocaleString('fr-FR')} XOF</span>
                </div>
                {estXof > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Différence vs estimation</span>
                    <span className={diffXof > 0 ? 'text-amber-500' : diffXof < 0 ? 'text-emerald-500' : ''}>
                      {diffXof > 0 ? '+' : ''}{diffXof.toLocaleString('fr-FR')} XOF
                    </span>
                  </div>
                )}
              </div>
            )}

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={cod} onCheckedChange={(v) => setCod(!!v)} />
              <span>Le client paiera à la livraison (cash on delivery)</span>
            </label>

            <div className="flex flex-col gap-2 pt-2">
              {!cod ? (
                <Button
                  disabled={!valid || submitting}
                  onClick={() => submit(false)}
                  className="bg-[#F5C518] text-black hover:bg-[#e4b614]"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
                  Confirmer poids + Demander paiement
                </Button>
              ) : (
                <Button
                  disabled={!valid || submitting}
                  onClick={() => submit(true)}
                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <HandCoins className="w-4 h-4 mr-2" />}
                  Confirmer poids + Cash à la livraison
                </Button>
              )}
              <Button variant="outline" onClick={onClose} disabled={submitting}>Annuler</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
