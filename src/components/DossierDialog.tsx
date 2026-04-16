import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { COUNTRY_FLAGS, COUNTRY_NAMES, type WarehouseCountry } from '@/lib/types';
import { CheckCircle2, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useDossiers } from '@/hooks/useDossiers';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DossierPreset {
  product?: string;
  estimatedWeight?: string;
  origin?: WarehouseCountry;
  destination?: string;
  estimatedCost?: number;
}

interface DossierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset?: DossierPreset;
}

const COUNTRIES: WarehouseCountry[] = ['FR', 'CN', 'US', 'CA', 'AE', 'DE'];
const DESTINATIONS = ['Dakar, Sénégal', 'Abidjan, Côte d\'Ivoire', 'Bamako, Mali', 'Lomé, Togo', 'Cotonou, Bénin', 'Conakry, Guinée'];
const TRANSPORT_OPTIONS = ['Aérien', 'Maritime', 'Routier', 'Peu importe (recommandez-moi)'];

interface DossierData {
  fullName: string;
  email: string;
  phone: string;
  product: string;
  quantity: string;
  estimatedWeight: string;
  origin: WarehouseCountry;
  destination: string;
  budget: string;
  needsSourcing: boolean;
  transportPreference: string;
  supplierUrl: string;
  notes: string;
}

const INITIAL: DossierData = {
  fullName: '', email: '', phone: '',
  product: '', quantity: '', estimatedWeight: '',
  origin: 'CN', destination: 'Dakar, Sénégal',
  budget: '', needsSourcing: false,
  transportPreference: 'Peu importe (recommandez-moi)',
  supplierUrl: '', notes: '',
};

const STEP_TITLES = ['Vos coordonnées', 'Votre import', 'Détails & préférences'];

export function DossierDialog({ open, onOpenChange, preset }: DossierDialogProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<DossierData>(INITIAL);
  const [submitted, setSubmitted] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const { createDossier } = useDossiers();

  // Apply preset when dialog opens
  useEffect(() => {
    if (open) {
      setData(prev => ({
        ...prev,
        product: preset?.product ?? prev.product,
        estimatedWeight: preset?.estimatedWeight ?? prev.estimatedWeight,
        origin: preset?.origin ?? prev.origin,
        destination: preset?.destination ?? prev.destination,
      }));
      // Pre-fill contact from auth if logged in
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email) setData(prev => ({ ...prev, email: prev.email || user.email! }));
      });
    }
  }, [open, preset]);

  const update = <K extends keyof DossierData>(field: K, value: DossierData[K]) =>
    setData(prev => ({ ...prev, [field]: value }));

  const canNext = () => {
    if (step === 0) return data.fullName.trim() && data.email.trim() && data.phone.trim();
    if (step === 1) return data.product.trim() && data.quantity.trim();
    return true;
  };

  const handleSubmit = async () => {
    try {
      const dossier = await createDossier.mutateAsync({
        product_description: `${data.product} — ${data.quantity}`,
        estimated_weight: data.estimatedWeight ? parseFloat(data.estimatedWeight) : null,
        origin_country: data.origin,
        destination_country: data.destination,
        budget_eur: data.budget ? parseFloat(data.budget) : null,
        needs_sourcing: data.needsSourcing || !!data.supplierUrl === false,
        contact_phone: data.phone,
        contact_email: data.email,
        notes: [
          `Contact: ${data.fullName}`,
          data.supplierUrl && `Fournisseur: ${data.supplierUrl}`,
          `Transport préféré: ${data.transportPreference}`,
          data.notes && `Notes: ${data.notes}`,
        ].filter(Boolean).join('\n'),
        estimated_cost: preset?.estimatedCost ?? null,
      });
      setReference(dossier.reference);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Not authenticated')) {
        toast.error('Connectez-vous pour soumettre un dossier.');
      } else {
        toast.error('Erreur lors de l\'envoi. Réessayez.');
      }
    }
  };

  const reset = () => {
    setStep(0);
    setData(INITIAL);
    setSubmitted(false);
    setReference(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Confier mon dossier</DialogTitle>
          <DialogDescription>
            {submitted ? 'Dossier enregistré avec succès' : `Étape ${step + 1}/3 — ${STEP_TITLES[step]}`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {submitted ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground">Dossier reçu</h3>
              {reference && (
                <p className="text-xs text-muted-foreground mt-2">Référence</p>
              )}
              {reference && (
                <p className="font-mono text-base font-bold text-foreground mt-1">{reference}</p>
              )}
              <p className="text-sm text-muted-foreground mt-4 max-w-xs mx-auto">
                Notre équipe analyse votre demande et vous contactera sous 24h avec une proposition détaillée.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Progress */}
              <div className="flex gap-1.5 mb-2">
                {[0, 1, 2].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-foreground' : 'bg-border'}`} />
                ))}
              </div>

              {step === 0 && (
                <>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Nom complet *</Label>
                    <Input value={data.fullName} onChange={e => update('fullName', e.target.value)} placeholder="Amadou Diallo" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Email *</Label>
                    <Input type="email" value={data.email} onChange={e => update('email', e.target.value)} placeholder="amadou@example.com" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Téléphone *</Label>
                    <Input type="tel" value={data.phone} onChange={e => update('phone', e.target.value)} placeholder="+221 77 000 00 00" />
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Produit à importer *</Label>
                    <Input value={data.product} onChange={e => update('product', e.target.value)} placeholder="Ex: Smartphones Samsung Galaxy S25" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Quantité *</Label>
                    <Input value={data.quantity} onChange={e => update('quantity', e.target.value)} placeholder="Ex: 50 unités" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Poids (kg)</Label>
                      <Input type="number" step="0.1" value={data.estimatedWeight} onChange={e => update('estimatedWeight', e.target.value)} placeholder="25" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Budget (€)</Label>
                      <Input type="number" value={data.budget} onChange={e => update('budget', e.target.value)} placeholder="optionnel" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Pays d'achat</Label>
                    <Select value={data.origin} onValueChange={(v) => update('origin', v as WarehouseCountry)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map(c => (
                          <SelectItem key={c} value={c}>{COUNTRY_FLAGS[c]} {COUNTRY_NAMES[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-start gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-secondary/40">
                    <input
                      type="checkbox"
                      checked={data.needsSourcing}
                      onChange={e => update('needsSourcing', e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border"
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">Besoin de sourcing</p>
                      <p className="text-xs text-muted-foreground">Yobbanté trouve et négocie avec le fournisseur pour vous.</p>
                    </div>
                  </label>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Destination</Label>
                    <Select value={data.destination} onValueChange={(v) => update('destination', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DESTINATIONS.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Préférence de transport</Label>
                    <Select value={data.transportPreference} onValueChange={(v) => update('transportPreference', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TRANSPORT_OPTIONS.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Lien fournisseur (optionnel)</Label>
                    <Input value={data.supplierUrl} onChange={e => update('supplierUrl', e.target.value)} placeholder="https://alibaba.com/product/..." />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Notes supplémentaires</Label>
                    <Textarea value={data.notes} onChange={e => update('notes', e.target.value)} placeholder="Précisions, demandes spéciales..." rows={3} />
                  </div>
                </>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2">
          {submitted ? (
            <Button onClick={() => onOpenChange(false)}>Fermer</Button>
          ) : (
            <>
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep(s => s - 1)}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Retour
                </Button>
              )}
              {step < 2 ? (
                <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()}>
                  Suivant <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={!canNext() || createDossier.isPending}>
                  {createDossier.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Envoi…</> : 'Envoyer mon dossier'}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
