import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { usePackages } from '@/hooks/usePackages';
import { useShipments } from '@/hooks/useShipments';
import { useDepartures, type KonnektDeparture } from '@/hooks/useDepartures';
import { COUNTRY_FLAGS, COUNTRY_NAMES, type WarehouseCountry } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import {
  Plane, Ship, Truck, Package as PackageIcon, Radio, Database, FlaskConical,
  CalendarClock, MapPin, HelpCircle, Loader2, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShipNowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetCountry?: WarehouseCountry;
}

const TRANSPORT_ICON = { AIR: Plane, SEA: Ship, ROAD: Truck } as const;
const TRANSPORT_LABEL = { AIR: 'Aérien', SEA: 'Maritime', ROAD: 'Routier' } as const;

const FLAG: Record<string, string> = {
  CN: '🇨🇳', FR: '🇫🇷', US: '🇺🇸', CA: '🇨🇦', AE: '🇦🇪', DE: '🇩🇪',
  SN: '🇸🇳', CI: '🇨🇮', ML: '🇲🇱', CM: '🇨🇲', BF: '🇧🇫', GN: '🇬🇳',
  TG: '🇹🇬', BJ: '🇧🇯', GA: '🇬🇦', CG: '🇨🇬',
};

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function SourceBadge({ source }: { source: 'konnekt' | 'cache' | 'mock' }) {
  const cfg = {
    konnekt: { Icon: Radio,        label: 'Konnekt live', className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
    cache:   { Icon: Database,     label: 'Dernier valide', className: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
    mock:    { Icon: FlaskConical, label: 'Démo',         className: 'text-muted-foreground bg-muted/40 border-border' },
  }[source];
  const { Icon, label, className } = cfg;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border',
      className,
    )}>
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

export function ShipNowDialog({ open, onOpenChange, presetCountry }: ShipNowDialogProps) {
  const { packages } = usePackages();
  const { createShipment } = useShipments();
  const { data: departuresData, isLoading: depLoading } = useDepartures();

  const shippable = useMemo(
    () => packages.filter(p => !p.shipment_id && ['RECEIVED', 'IN_STORAGE', 'READY_TO_SHIP'].includes(p.status)),
    [packages]
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<'departure' | 'manual'>('departure');
  const [selectedDeparture, setSelectedDeparture] = useState<KonnektDeparture | null>(null);

  // Manual fields
  const [manualOriginCity, setManualOriginCity] = useState('');
  const [manualDestCountry, setManualDestCountry] = useState('SN');
  const [manualDestCity, setManualDestCity] = useState('Dakar');
  const [manualDate, setManualDate] = useState('');
  const [manualNote, setManualNote] = useState('');

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelectedIds([]);
      setSelectedDeparture(null);
      setMode('departure');
      setManualOriginCity('');
      setManualDestCity('Dakar');
      setManualDestCountry('SN');
      setManualDate('');
      setManualNote('');
    }
  }, [open]);

  const visiblePackages = presetCountry
    ? shippable.filter(p => p.warehouse_country === presetCountry)
    : shippable;

  const selectedPackages = shippable.filter(p => selectedIds.includes(p.id));
  const totalWeight = selectedPackages.reduce((sum, p) => sum + (p.weight || 0.5), 0);

  // Origin countries derived from selection
  const originCountries = useMemo(
    () => Array.from(new Set(selectedPackages.map(p => p.warehouse_country))),
    [selectedPackages]
  );

  // Filter departures matching selected package origins
  const matchingDepartures = useMemo(() => {
    const list = departuresData?.departures || [];
    if (originCountries.length === 0) return list;
    return list.filter(d => originCountries.includes(d.origin_country as WarehouseCountry));
  }, [departuresData, originCountries]);

  // Group selected packages by origin country
  const byCountry = useMemo(() => selectedPackages.reduce((acc, p) => {
    if (!acc[p.warehouse_country]) acc[p.warehouse_country] = [];
    acc[p.warehouse_country].push(p);
    return acc;
  }, {} as Record<string, typeof selectedPackages>), [selectedPackages]);

  const toggle = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    setSelectedDeparture(null); // reset selection if pkg list changes
  };

  const transportFromDeparture = (t: 'AIR' | 'SEA' | 'ROAD') => t.toLowerCase();

  const canSubmit = selectedPackages.length > 0 && (
    (mode === 'departure' && selectedDeparture) ||
    (mode === 'manual' && manualDestCity.trim().length > 0)
  );

  const handleSubmit = async () => {
    if (selectedPackages.length === 0) {
      toast({ title: 'Sélectionnez au moins un colis', variant: 'destructive' });
      return;
    }

    try {
      if (mode === 'departure' && selectedDeparture) {
        const dep = selectedDeparture;
        // Restrict packages to those matching the departure origin
        const pkgs = selectedPackages.filter(p => p.warehouse_country === dep.origin_country);
        if (pkgs.length === 0) {
          toast({ title: 'Aucun colis ne correspond à cette origine', variant: 'destructive' });
          return;
        }
        await createShipment.mutateAsync({
          origin_country: dep.origin_country as 'FR' | 'CN' | 'US',
          destination_country: dep.destination_country,
          transport_type: transportFromDeparture(dep.transport),
          package_ids: pkgs.map(p => p.id),
          konnekt_departure_id: dep.id,
          departure_date: dep.departure_date,
          origin_city: dep.origin_city,
          destination_city: dep.destination_city,
        });
        toast({
          title: 'Expédition rattachée au départ',
          description: `${pkgs.length} colis · ${dep.origin_city} → ${dep.destination_city} · ${fmtDate(dep.departure_date)}`,
        });
      } else {
        // Manual — one shipment per origin country, all marked pending_assignment
        for (const [country, pkgs] of Object.entries(byCountry)) {
          await createShipment.mutateAsync({
            origin_country: country as 'FR' | 'CN' | 'US',
            destination_country: manualDestCountry,
            transport_type: 'standard',
            package_ids: pkgs.map(p => p.id),
            origin_city: manualOriginCity || null,
            destination_city: manualDestCity,
            departure_date: manualDate || null,
            manual_request: true,
            client_note: manualNote || null,
          });
        }
        toast({
          title: 'Demande enregistrée',
          description: 'Nous vous attribuerons un départ dès qu\'il sera disponible.',
        });
      }
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Erreur', description: 'Impossible de créer l\'expédition', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nouvelle expédition</DialogTitle>
          <DialogDescription>
            Sélectionnez vos colis puis rattachez-les à un départ Konnekt — ou demandez un départ manuel.
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
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left',
                          checked ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-secondary',
                        )}
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

            {/* Departure picker / manual */}
            {selectedPackages.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-semibold">Choix du départ</Label>
                  {departuresData?.source && <SourceBadge source={departuresData.source} />}
                </div>

                <Tabs value={mode} onValueChange={(v) => setMode(v as 'departure' | 'manual')}>
                  <TabsList className="w-full">
                    <TabsTrigger value="departure" className="flex-1">
                      <CalendarClock className="w-3.5 h-3.5 mr-1.5" />
                      Départs Konnekt
                      {matchingDepartures.length > 0 && (
                        <span className="ml-1.5 text-[10px] font-bold opacity-70">({matchingDepartures.length})</span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="manual" className="flex-1">
                      <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
                      Demande manuelle
                    </TabsTrigger>
                  </TabsList>

                  {/* DEPARTURE TAB */}
                  <TabsContent value="departure" className="mt-3 space-y-2">
                    {depLoading ? (
                      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Chargement des prochains départs…
                      </div>
                    ) : matchingDepartures.length === 0 ? (
                      <div className="text-center py-6 border border-dashed border-border rounded-xl">
                        <CalendarClock className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
                        <p className="text-sm font-medium text-foreground">Aucun départ disponible</p>
                        <p className="text-xs text-muted-foreground mt-1 px-4">
                          Aucun départ Konnekt ne correspond à l'origine de vos colis.<br/>
                          Passez en <button type="button" onClick={() => setMode('manual')} className="text-primary underline-offset-2 hover:underline font-medium">demande manuelle</button> — nous trouvons un départ pour vous.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {matchingDepartures.map(d => {
                          const Icon = TRANSPORT_ICON[d.transport];
                          const active = selectedDeparture?.id === d.id;
                          return (
                            <button
                              type="button"
                              key={d.id}
                              onClick={() => setSelectedDeparture(d)}
                              className={cn(
                                'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors',
                                active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-secondary',
                              )}
                            >
                              <div className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                                active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                              )}>
                                {active ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  <span className="mr-1">{FLAG[d.origin_country] || '🌍'}</span>
                                  {d.origin_city}
                                  <span className="mx-1.5 text-muted-foreground">→</span>
                                  <span className="mr-1">{FLAG[d.destination_country] || '🌍'}</span>
                                  {d.destination_city}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {TRANSPORT_LABEL[d.transport]} · {fmtDate(d.departure_date)}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>

                  {/* MANUAL TAB */}
                  <TabsContent value="manual" className="mt-3 space-y-3">
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <p className="text-xs text-foreground leading-relaxed">
                        <strong>Pas de départ qui vous convient ?</strong> Indiquez vos préférences ci-dessous.
                        Notre équipe vous attribue un départ dès qu'il est disponible et vous notifie automatiquement.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="m-origin" className="text-xs font-semibold mb-1.5 block">
                          Ville d'origine
                          <span className="text-muted-foreground font-normal ml-1">
                            ({originCountries.map(c => COUNTRY_FLAGS[c]).join(' ')})
                          </span>
                        </Label>
                        <Input
                          id="m-origin"
                          value={manualOriginCity}
                          onChange={e => setManualOriginCity(e.target.value)}
                          placeholder="ex: Shenzhen"
                        />
                      </div>
                      <div>
                        <Label htmlFor="m-date" className="text-xs font-semibold mb-1.5 block">
                          Date souhaitée
                        </Label>
                        <Input
                          id="m-date"
                          type="date"
                          value={manualDate}
                          onChange={e => {
                            const v = e.target.value;
                            const m = v.match(/^(\d{4})-\d{2}-\d{2}$/);
                            if (v && (!m || Number(m[1]) < 2024 || Number(m[1]) > 2099)) return;
                            setManualDate(v);
                          }}
                          min={new Date().toISOString().slice(0, 10)}
                          max="2099-12-31"
                        />
                      </div>
                      <div>
                        <Label htmlFor="m-dest-city" className="text-xs font-semibold mb-1.5 block">
                          Ville de destination *
                        </Label>
                        <Input
                          id="m-dest-city"
                          value={manualDestCity}
                          onChange={e => setManualDestCity(e.target.value)}
                          placeholder="Dakar"
                        />
                      </div>
                      <div>
                        <Label htmlFor="m-dest-country" className="text-xs font-semibold mb-1.5 block">
                          Pays de destination
                        </Label>
                        <Input
                          id="m-dest-country"
                          value={manualDestCountry}
                          onChange={e => setManualDestCountry(e.target.value.toUpperCase().slice(0, 2))}
                          placeholder="SN"
                          maxLength={2}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="m-note" className="text-xs font-semibold mb-1.5 block">
                        Note (optionnel)
                      </Label>
                      <Textarea
                        id="m-note"
                        value={manualNote}
                        onChange={e => setManualNote(e.target.value)}
                        placeholder="Contraintes de délai, préférence transport, …"
                        rows={2}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Summary */}
            {selectedPackages.length > 0 && (
              <div className="rounded-xl bg-secondary p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Poids total</span>
                  <span className="font-medium text-foreground">{totalWeight.toFixed(1)} kg</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Origines</span>
                  <span className="font-medium text-foreground">
                    {originCountries.map(c => `${COUNTRY_FLAGS[c]} ${c}`).join(' · ')}
                  </span>
                </div>
                {mode === 'departure' && selectedDeparture && (
                  <div className="flex justify-between text-sm pt-2 border-t border-border">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Départ choisi
                    </span>
                    <span className="font-bold text-primary">
                      {fmtDate(selectedDeparture.departure_date)} · {TRANSPORT_LABEL[selectedDeparture.transport]}
                    </span>
                  </div>
                )}
                {mode === 'manual' && (
                  <div className="flex justify-between text-sm pt-2 border-t border-border">
                    <span className="font-semibold text-foreground">Statut</span>
                    <span className="font-bold text-amber-400">En attente d'attribution</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || createShipment.isPending}
          >
            {createShipment.isPending
              ? 'Création…'
              : mode === 'manual'
                ? 'Envoyer la demande'
                : 'Confirmer le départ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
