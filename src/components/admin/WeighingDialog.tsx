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
import {
  YOBBANTE_MARGIN_PCT,
  enlevementForZone,
  formatFcfa,
} from '@/lib/yobbantePricing';
import { calculerFraisEnlevement, type DakarZoneCategory } from '@/lib/dakarZones';

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
  /** Tarif GP au kg (XOF). */
  gp_rate_per_kg?: number | null;
  /** Zone d'enlèvement déjà classifiée. */
  pickup_zone?: DakarZoneCategory | string | null;
  /** Adresse expéditeur (fallback pour déduire la zone). */
  sender_address?: string | null;
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
  const [manualPricing, setManualPricing] = useState(false);
  const [manualTotal, setManualTotal] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setWeight(''); setLocation('Hub Dakar'); setCod(false);
      setManualPricing(false); setManualTotal('');
    }
  }, [open, dossier?.id]);

  const actualKg = parseFloat(weight.replace(',', '.'));
  const valid = !isNaN(actualKg) && actualKg > 0;
  const manualTotalNum = parseFloat(manualTotal.replace(/[\s,]/g, '').replace(',', '.'));
  const manualValid = manualPricing ? !isNaN(manualTotalNum) && manualTotalNum > 0 : true;

  /**
   * Formule officielle (cf. spec QA 27/05/2026) :
   *   total = poids × tarif_gp × (1 + 0.20) + enlevement_zone
   * UN SEUL frais d'enlèvement selon la zone (5k / 10k / 15k).
   * Si tarif manuel activé → on remplace le total calculé.
   */
  const breakdown = useMemo(() => {
    if (!dossier) return null;
    const gpRate = Number(dossier.gp_rate_per_kg ?? 0);
    const zone: DakarZoneCategory =
      (dossier.pickup_zone as DakarZoneCategory) ||
      (dossier.sender_address
        ? calculerFraisEnlevement(dossier.sender_address).zone
        : 'dakar_centre');
    const enlevement = enlevementForZone(zone);
    const clientPerKg = gpRate * (1 + YOBBANTE_MARGIN_PCT);
    const weightTotal = valid ? clientPerKg * actualKg : 0;
    const computedTotal = valid ? Math.round(weightTotal + enlevement) : 0;
    const total = manualPricing && !isNaN(manualTotalNum) && manualTotalNum > 0
      ? Math.round(manualTotalNum)
      : computedTotal;
    return { gpRate, zone, enlevement, clientPerKg, weightTotal, computedTotal, total };
  }, [dossier, valid, actualKg, manualPricing, manualTotalNum]);

  async function submit(asCod: boolean) {
    if (!dossier || !valid || !breakdown) return;
    setSubmitting(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id ?? null;
      const now = new Date().toISOString();

      const update: Record<string, unknown> = {
        actual_weight_kg: actualKg,
        final_amount_xof: breakdown.total,
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
          ? [prenom, trackingId, `${actualKg}kg`, `${breakdown.total.toLocaleString('fr-FR')} XOF`]
          : [prenom, trackingId, `${actualKg}kg`, `${breakdown.total.toLocaleString('fr-FR')} XOF`, payLink];

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

  const zoneLabel: Record<string, string> = {
    dakar_centre: 'Dakar centre',
    dakar_banlieue: 'Banlieue Dakar',
    hors_dakar: 'Hors Dakar',
  };

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
                <div className="text-[10px] uppercase text-muted-foreground font-semibold">Zone enlèvement</div>
                <div className="text-sm font-medium mt-0.5">{zoneLabel[breakdown?.zone ?? 'dakar_centre']}</div>
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

            {breakdown && (
              <div className="rounded-lg border border-[#F5C518]/30 bg-[#F5C518]/5 p-3 space-y-1 text-xs font-mono">
                {!breakdown.gpRate && (
                  <div className="text-amber-500 mb-1 font-sans">
                    ⚠️ Tarif GP non renseigné — le total sera incomplet.
                  </div>
                )}
                <Row label="Poids réel" value={`${valid ? actualKg : 0} kg`} />
                <Row label="Tarif GP" value={`${formatFcfa(breakdown.gpRate)}/kg`} />
                <Row label="Prix client/kg (×1.20)" value={`${formatFcfa(breakdown.clientPerKg)}/kg`} />
                <Row label="Sous-total poids" value={formatFcfa(breakdown.weightTotal)} />
                <Row label={`Enlèvement (${zoneLabel[breakdown.zone]})`} value={formatFcfa(breakdown.enlevement)} />
                <div className="border-t border-[#F5C518]/30 my-1" />
                <Row label="TOTAL" value={formatFcfa(breakdown.total)} bold />
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

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-sm font-bold text-foreground' : 'text-muted-foreground'}`}>
      <span className="font-sans">{label}</span>
      <span>{value}</span>
    </div>
  );
}
