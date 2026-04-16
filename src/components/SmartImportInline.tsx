import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { COUNTRY_FLAGS, COUNTRY_NAMES, type WarehouseCountry, type SmartRecommendation } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Plane, Ship, Truck, ArrowRight, Sparkles } from 'lucide-react';

const COUNTRIES: WarehouseCountry[] = ['FR', 'CN', 'US', 'CA', 'AE', 'DE'];
const DESTINATIONS = ['Dakar, Sénégal', 'Abidjan, Côte d\'Ivoire', 'Bamako, Mali', 'Lomé, Togo', 'Cotonou, Bénin', 'Conakry, Guinée'];

interface Props {
  variant?: 'card' | 'plain';
  onConfideDossier?: (preset: { product: string; weight: number; origin: WarehouseCountry; destination: string; estimatedCost: number }) => void;
}

export function SmartImportInline({ variant = 'card', onConfideDossier }: Props) {
  const [product, setProduct] = useState('');
  const [weight, setWeight] = useState('');
  const [origin, setOrigin] = useState<WarehouseCountry>('CN');
  const [destination, setDestination] = useState('Dakar, Sénégal');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const [reco, setReco] = useState<SmartRecommendation | null>(null);

  const submit = async () => {
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
          budget: budget ? parseFloat(budget) : undefined,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setReco(data as SmartRecommendation);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'estimation. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const wrapClass = variant === 'card'
    ? 'bg-card border border-border rounded-2xl p-6 md:p-8'
    : '';

  return (
    <div className={wrapClass}>
      <div className="grid md:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Produit</Label>
            <Input value={product} onChange={e => setProduct(e.target.value)} placeholder="Ex : smartphones, vêtements…" maxLength={100} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium mb-2 block">Poids (kg)</Label>
              <Input type="number" min="0.1" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="12" />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Budget (€)</Label>
              <Input type="number" min="0" value={budget} onChange={e => setBudget(e.target.value)} placeholder="optionnel" />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium mb-2 block">Pays d'achat</Label>
            <Select value={origin} onValueChange={v => setOrigin(v as WarehouseCountry)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => (
                  <SelectItem key={c} value={c}>{COUNTRY_FLAGS[c]} {COUNTRY_NAMES[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium mb-2 block">Destination</Label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DESTINATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={submit} disabled={!product.trim() || !weight || loading} className="w-full">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analyse IA…</> : <><Sparkles className="w-4 h-4 mr-2" /> Obtenir 3 routes</>}
          </Button>
        </div>

        {/* Result */}
        <div className="space-y-3">
          {!reco ? (
            <div className="h-full min-h-[280px] rounded-xl bg-secondary/50 border border-dashed border-border flex flex-col items-center justify-center text-center p-6">
              <Sparkles className="w-7 h-7 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">Recevez 3 options de route</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">Express, équilibrée, économique — avec coût et délai pour chacune.</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-foreground text-background p-4 flex items-center gap-3 text-sm font-semibold">
                <span>{COUNTRY_NAMES[origin]}</span>
                <ArrowRight className="w-4 h-4 opacity-60" />
                <span>{destination}</span>
              </div>
              {reco.options.map(opt => {
                const Icon = opt.transport === 'air' ? Plane : opt.transport === 'sea' ? Ship : Truck;
                const isReco = opt.key === reco.recommended;
                return (
                  <div key={opt.key} className={`rounded-xl p-4 border transition-colors ${isReco ? 'border-foreground bg-foreground/[0.03]' : 'border-border'}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                          {isReco && <span className="text-[10px] uppercase tracking-wider font-bold bg-foreground text-background px-1.5 py-0.5 rounded">Recommandé</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{opt.highlight}</p>
                        <div className="flex items-baseline gap-3 mt-2">
                          <span className="text-lg font-bold text-foreground">{Math.round(opt.estimatedCost)} €</span>
                          <span className="text-xs text-muted-foreground">{opt.estimatedDays}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {reco.reasoning && (
                <div className="rounded-xl bg-secondary/60 p-4">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Pourquoi cette recommandation</p>
                  <p className="text-xs text-foreground leading-relaxed">{reco.reasoning}</p>
                </div>
              )}
              {onConfideDossier && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const opt = reco.options.find(o => o.key === reco.recommended) || reco.options[0];
                    onConfideDossier({
                      product, weight: parseFloat(weight), origin, destination,
                      estimatedCost: opt.estimatedCost,
                    });
                  }}
                >
                  Confier ce dossier à Yobbanté
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
