import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { COUNTRY_FLAGS, COUNTRY_NAMES, type WarehouseCountry } from '@/lib/types';
import { Sparkles, Plane, Ship, Truck, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SmartImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Recommendation {
  route: string;
  transport: 'air' | 'sea' | 'road';
  transportLabel: string;
  estimatedCost: number;
  estimatedDays: string;
  reasoning: string;
}

const COUNTRIES: WarehouseCountry[] = ['FR', 'CN', 'US', 'CA', 'AE', 'DE'];
const DESTINATIONS = ['Dakar, Sénégal', 'Abidjan, Côte d\'Ivoire', 'Bamako, Mali', 'Lomé, Togo', 'Cotonou, Bénin', 'Conakry, Guinée'];

export function SmartImportDialog({ open, onOpenChange }: SmartImportDialogProps) {
  const [step, setStep] = useState<'form' | 'result'>('form');
  const [product, setProduct] = useState('');
  const [weight, setWeight] = useState('');
  const [origin, setOrigin] = useState<WarehouseCountry>('CN');
  const [destination, setDestination] = useState('Dakar, Sénégal');
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const w = parseFloat(weight);
    if (!product.trim() || isNaN(w) || w <= 0) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('smart-import', {
        body: {
          product: product.trim(),
          weight: w,
          origin: COUNTRY_NAMES[origin],
          destination,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setRecommendation({
        route: data.route || `${COUNTRY_NAMES[origin]} → ${destination}`,
        transport: data.transport || 'air',
        transportLabel: data.transportLabel || 'Aérien',
        estimatedCost: data.estimatedCost || 0,
        estimatedDays: data.estimatedDays || '—',
        reasoning: data.reasoning || '',
      });
      setStep('result');
    } catch (err: any) {
      console.error('Smart import error:', err);
      toast.error('Erreur lors de l\'estimation. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('form');
    setRecommendation(null);
    setLoading(false);
  };

  const TransportIcon = recommendation?.transport === 'air' ? Plane : recommendation?.transport === 'sea' ? Ship : Truck;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Smart Import Assistant
          </DialogTitle>
          <DialogDescription>
            {step === 'form'
              ? 'Décrivez votre import, recevez une recommandation IA instantanée.'
              : 'Voici la route optimale pour votre import.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {step === 'form' ? (
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="product" className="text-sm font-medium mb-2 block">Produit</Label>
                <Input
                  id="product"
                  value={product}
                  onChange={e => setProduct(e.target.value)}
                  placeholder="Ex : Smartphones, vêtements, électroménager…"
                  maxLength={100}
                />
              </div>
              <div>
                <Label htmlFor="weight" className="text-sm font-medium mb-2 block">Poids estimé (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  placeholder="Ex : 12.5"
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Pays d'achat</Label>
                <Select value={origin} onValueChange={(v) => setOrigin(v as WarehouseCountry)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => (
                      <SelectItem key={c} value={c}>
                        {COUNTRY_FLAGS[c]} {COUNTRY_NAMES[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Destination</Label>
                <Select value={destination} onValueChange={setDestination}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DESTINATIONS.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : recommendation && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-foreground text-background p-5">
                <p className="text-xs uppercase tracking-wider opacity-60 mb-2">Route recommandée</p>
                <div className="flex items-center gap-3 text-sm font-semibold">
                  <span>{COUNTRY_NAMES[origin]}</span>
                  <ArrowRight className="w-4 h-4 opacity-60" />
                  <span>{destination}</span>
                </div>
              </div>
              <div className="rounded-xl border border-border p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <TransportIcon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Transport</p>
                  <p className="text-base font-semibold text-foreground">{recommendation.transportLabel}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-secondary p-4">
                  <p className="text-xs text-muted-foreground">Coût estimé</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{recommendation.estimatedCost.toFixed(0)} €</p>
                </div>
                <div className="rounded-xl bg-secondary p-4">
                  <p className="text-xs text-muted-foreground">Délai</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{recommendation.estimatedDays}</p>
                </div>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Analyse IA
                </p>
                <p className="text-sm text-foreground leading-relaxed">{recommendation.reasoning}</p>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Estimation IA indicative. Tarif final après prise en charge du dossier.
              </p>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2">
          {step === 'form' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button onClick={handleSubmit} disabled={!product.trim() || !weight || loading}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analyse IA...</> : 'Estimer'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={reset}>Nouvelle estimation</Button>
              <Button onClick={() => onOpenChange(false)}>Fermer</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
