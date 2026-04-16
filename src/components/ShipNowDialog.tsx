import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePackages } from '@/hooks/usePackages';
import { useShipments } from '@/hooks/useShipments';
import { COUNTRY_FLAGS, COUNTRY_NAMES, type WarehouseCountry } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { Plane, Ship, Truck, Package as PackageIcon } from 'lucide-react';

interface ShipNowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetCountry?: WarehouseCountry;
}

const TRANSPORT_OPTIONS = [
  { id: 'air', label: 'Aérien', desc: '3–7 jours · prioritaire', icon: Plane, multiplier: 1 },
  { id: 'sea', label: 'Maritime', desc: '25–40 jours · économique', icon: Ship, multiplier: 0.35 },
  { id: 'road', label: 'Routier', desc: '7–14 jours · équilibré', icon: Truck, multiplier: 0.65 },
];

export function ShipNowDialog({ open, onOpenChange, presetCountry }: ShipNowDialogProps) {
  const { packages } = usePackages();
  const { createShipment } = useShipments();

  const shippable = useMemo(
    () => packages.filter(p => !p.shipment_id && ['RECEIVED', 'IN_STORAGE', 'READY_TO_SHIP'].includes(p.status)),
    [packages]
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [transport, setTransport] = useState('air');
  const [destination, setDestination] = useState('Dakar, Sénégal');

  const selectedPackages = shippable.filter(p => selectedIds.includes(p.id));
  const totalWeight = selectedPackages.reduce((sum, p) => sum + (p.weight || 0.5), 0);

  // Group by country (one shipment per origin)
  const byCountry = selectedPackages.reduce((acc, p) => {
    if (!acc[p.warehouse_country]) acc[p.warehouse_country] = [];
    acc[p.warehouse_country].push(p);
    return acc;
  }, {} as Record<string, typeof selectedPackages>);

  const transportOpt = TRANSPORT_OPTIONS.find(t => t.id === transport)!;
  const estimatedCost = Math.max(15, totalWeight * 12 * transportOpt.multiplier);

  // Filter by preset country if provided
  const visiblePackages = presetCountry
    ? shippable.filter(p => p.warehouse_country === presetCountry)
    : shippable;

  const toggle = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSubmit = async () => {
    if (selectedPackages.length === 0) {
      toast({ title: 'Sélectionnez au moins un colis', variant: 'destructive' });
      return;
    }

    try {
      // Create one shipment per origin country (consolidation)
      for (const [country, pkgs] of Object.entries(byCountry)) {
        await createShipment.mutateAsync({
          origin_country: country as 'FR' | 'CN' | 'US',
          destination_country: destination,
          transport_type: transport,
          package_ids: pkgs.map(p => p.id),
        });
      }
      toast({
        title: 'Expédition créée',
        description: `${selectedPackages.length} colis groupés · ${Object.keys(byCountry).length} envoi(s)`,
      });
      setSelectedIds([]);
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Erreur', description: 'Impossible de créer l\'expédition', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nouvelle expédition</DialogTitle>
          <DialogDescription>
            Sélectionnez vos colis, choisissez un transport et confirmez.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-2">
            {/* Packages */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-semibold">Colis disponibles</Label>
                <span className="text-xs text-muted-foreground">
                  {selectedIds.length}/{visiblePackages.length} sélectionné{selectedIds.length > 1 ? 's' : ''}
                </span>
              </div>
              {visiblePackages.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-border rounded-xl">
                  <PackageIcon className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucun colis disponible</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {visiblePackages.map(pkg => {
                    const checked = selectedIds.includes(pkg.id);
                    return (
                      <button
                        type="button"
                        key={pkg.id}
                        onClick={() => toggle(pkg.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                          checked ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-secondary'
                        }`}
                      >
                        <Checkbox checked={checked} className="pointer-events-none" />
                        <span className="text-xl">{COUNTRY_FLAGS[pkg.warehouse_country]}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {pkg.description || 'Colis sans description'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {COUNTRY_NAMES[pkg.warehouse_country]} · {pkg.weight ? `${pkg.weight}kg` : 'Poids inconnu'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Transport */}
            <div>
              <Label className="text-sm font-semibold mb-3 block">Mode de transport</Label>
              <RadioGroup value={transport} onValueChange={setTransport} className="space-y-2">
                {TRANSPORT_OPTIONS.map(opt => (
                  <label
                    key={opt.id}
                    htmlFor={opt.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      transport === opt.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-secondary'
                    }`}
                  >
                    <RadioGroupItem value={opt.id} id={opt.id} />
                    <opt.icon className="w-5 h-5 text-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {/* Destination */}
            <div>
              <Label htmlFor="dest" className="text-sm font-semibold mb-2 block">Destination</Label>
              <Input
                id="dest"
                value={destination}
                onChange={e => setDestination(e.target.value)}
                placeholder="Ville, pays"
              />
            </div>

            {/* Summary */}
            {selectedPackages.length > 0 && (
              <div className="rounded-xl bg-secondary p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Poids total</span>
                  <span className="font-medium text-foreground">{totalWeight.toFixed(1)} kg</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Envois consolidés</span>
                  <span className="font-medium text-foreground">{Object.keys(byCountry).length}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-border">
                  <span className="font-semibold text-foreground">Estimation</span>
                  <span className="font-bold text-foreground">{estimatedCost.toFixed(0)} €</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedPackages.length === 0 || createShipment.isPending}
          >
            {createShipment.isPending ? 'Création…' : 'Créer l\'expédition'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
