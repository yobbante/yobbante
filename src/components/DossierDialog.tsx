import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { COUNTRY_FLAGS, COUNTRY_NAMES, type WarehouseCountry } from '@/lib/types';
import { CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';

interface DossierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  transportPreference: string;
  supplierUrl: string;
  notes: string;
}

const INITIAL: DossierData = {
  fullName: '', email: '', phone: '',
  product: '', quantity: '', estimatedWeight: '',
  origin: 'CN', destination: 'Dakar, Sénégal',
  transportPreference: 'Peu importe (recommandez-moi)',
  supplierUrl: '', notes: '',
};

const STEP_TITLES = ['Vos coordonnées', 'Votre import', 'Détails & préférences'];

export function DossierDialog({ open, onOpenChange }: DossierDialogProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<DossierData>(INITIAL);
  const [submitted, setSubmitted] = useState(false);

  const update = (field: keyof DossierData, value: string) =>
    setData(prev => ({ ...prev, [field]: value }));

  const canNext = () => {
    if (step === 0) return data.fullName.trim() && data.email.trim() && data.phone.trim();
    if (step === 1) return data.product.trim() && data.quantity.trim();
    return true;
  };

  const handleSubmit = () => {
    // In production, this would call an edge function to send an email
    console.log('Dossier submitted:', data);
    setSubmitted(true);
  };

  const reset = () => {
    setStep(0);
    setData(INITIAL);
    setSubmitted(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Confier mon dossier</DialogTitle>
          <DialogDescription>
            {submitted ? 'Dossier envoyé avec succès !' : `Étape ${step + 1}/3 — ${STEP_TITLES[step]}`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {submitted ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground">Dossier reçu !</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
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
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Poids estimé (kg)</Label>
                    <Input type="number" step="0.1" value={data.estimatedWeight} onChange={e => update('estimatedWeight', e.target.value)} placeholder="Ex: 25" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Pays d'achat</Label>
                    <Select value={data.origin} onValueChange={(v) => update('origin', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map(c => (
                          <SelectItem key={c} value={c}>{COUNTRY_FLAGS[c]} {COUNTRY_NAMES[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                <Button onClick={handleSubmit} disabled={!canNext()}>
                  Envoyer mon dossier
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
