import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  useManualDepartures, type ManualDeparture, type ManualDepartureInput,
  type TransportMode, type DepartureStatus,
} from '@/hooks/useManualDepartures';
import { useTransporteurs, fetchTransporteurByRef, type Transporteur } from '@/hooks/useTransporteurs';
import { TransporteurReferenceLookup } from './TransporteurReferenceLookup';
import { supabase } from '@/integrations/supabase/client';
import { ALL_CITIES, HUB_DAKAR } from '@/lib/worldCities';
import { useCustomCities } from '@/hooks/useCustomCities';
import { estimateArrivalDate } from '@/lib/deliveryEta';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

/** CORRECTION #4 — Auto-resolve country ISO from a city name (best-effort). */
function resolveCountryFromCity(city: string | null | undefined): string {
  if (!city) return '';
  const v = city.trim().toLowerCase();
  if (!v) return '';
  const m =
    ALL_CITIES.find(c => c.city.toLowerCase() === v) ??
    ALL_CITIES.find(c => c.city.toLowerCase().startsWith(v)) ??
    ALL_CITIES.find(c => c.city.toLowerCase().includes(v));
  return m?.country ?? '';
}

export interface ManualDeparturePrefill {
  transporteurRef?: string | null;
  originCountry?: string | null;
  originCity?: string | null;
  destCountry?: string | null;
  destCity?: string | null;
  /** ISO yyyy-mm-dd */
  departureDate?: string | null;
  totalCapacityKg?: number | null;
  notes?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  departure: ManualDeparture | null;
  /** CORRECTION #3 / #6 — Préremplir le formulaire (depuis assignation GP ou page flyers). */
  prefill?: ManualDeparturePrefill | null;
}

const Schema = z.object({
  origin_city: z.string().trim().min(2, 'Origine requise'),
  destination_city: z.string().trim().min(2, 'Destination requise'),
  transport_mode: z.enum(['air', 'sea_lcl', 'road']),
  departure_date: z.string().min(1, 'Date de départ requise'),
  total_capacity_kg: z.number().int().min(0),
  available_capacity_kg: z.number().int().min(0),
}).refine(d => d.available_capacity_kg <= d.total_capacity_kg, {
  message: 'La capacité disponible ne peut pas dépasser la capacité totale',
  path: ['available_capacity_kg'],
});

const VILLES = ['Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor', 'Kaolack', 'Touba', 'Autre'];

export function ManualDepartureForm({ open, onClose, departure, prefill }: Props) {
  const { create, update } = useManualDepartures();
  const { upsert: upsertTransporteur } = useTransporteurs();
  const { cities: customCities, addCustomCity } = useCustomCities();
  const isEdit = !!departure;

  // Merged catalog: 36 predefined + admin-added custom cities. Dakar exclu (hub).
  const cityCatalog = [...ALL_CITIES, ...customCities]
    .filter((c) => c.id !== HUB_DAKAR.id)
    .sort((a, b) => a.city.localeCompare(b.city, 'fr'));

  // Direction: Dakar ↔ ville étrangère
  const [direction, setDirection] = useState<'from_dakar' | 'to_dakar'>('from_dakar');
  const [foreignCityId, setForeignCityId] = useState<string>('');

  // Departure fields
  const [originCountry, setOriginCountry] = useState('');
  const [originCity, setOriginCity] = useState('');
  const [destCountry, setDestCountry] = useState('');
  const [destCity, setDestCity] = useState('');
  const [mode, setMode] = useState<TransportMode>('air');
  const [departureDate, setDepartureDate] = useState<Date | undefined>();
  const [arrivalEstimate, setArrivalEstimate] = useState<Date | undefined>();
  const [totalCapacity, setTotalCapacity] = useState(0);
  const [availableCapacity, setAvailableCapacity] = useState(0);
  const [useFixedPrice, setUseFixedPrice] = useState(false);
  const [priceOverride, setPriceOverride] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<DepartureStatus>('draft');
  const [submitting, setSubmitting] = useState(false);

  // Transporter fields
  const [tRef, setTRef] = useState('');
  const [matched, setMatched] = useState<Transporteur | null>(null);
  const [tNom, setTNom] = useState('');
  const [tTel1, setTTel1] = useState('');
  const [tTel2, setTTel2] = useState('');
  const [tAdr1, setTAdr1] = useState('');
  const [tAdr2, setTAdr2] = useState('');
  const [tVille, setTVille] = useState('Dakar');
  const [tZone, setTZone] = useState('');
  const [tNotes, setTNotes] = useState('');
  const [edited, setEdited] = useState(false);

  // Snapshot values when matched, to detect edits
  function applyTransporteur(t: Transporteur | null) {
    setMatched(t);
    setEdited(false);
    if (t) {
      setTNom(t.nom);
      setTTel1(t.telephone_1);
      setTTel2(t.telephone_2 ?? '');
      setTAdr1(t.adresse_1);
      setTAdr2(t.adresse_2 ?? '');
      setTVille(t.ville);
      setTZone(t.zone ?? '');
      setTNotes(t.notes ?? '');
    } else {
      setTNom(''); setTTel1(''); setTTel2('');
      setTAdr1(''); setTAdr2('');
      setTVille('Dakar'); setTZone(''); setTNotes('');
    }
  }

  function markEditedIf(initial: string | null | undefined, next: string) {
    if (matched && (initial ?? '') !== next) setEdited(true);
  }

  useEffect(() => {
    if (!open) return;
    if (departure) {
      setOriginCountry(departure.origin_country ?? '');
      setOriginCity(departure.origin_city);
      setDestCountry(departure.destination_country ?? '');
      setDestCity(departure.destination_city);
      // Derive direction from cities
      const isFromDakar = departure.origin_city.toLowerCase() === 'dakar';
      setDirection(isFromDakar ? 'from_dakar' : 'to_dakar');
      const foreignCity = isFromDakar ? departure.destination_city : departure.origin_city;
      const foreignCountry = isFromDakar ? departure.destination_country : departure.origin_country;
      const match = [...ALL_CITIES, ...customCities].find(
        (c) => c.city.toLowerCase() === foreignCity.toLowerCase() && (!foreignCountry || c.country === foreignCountry),
      );
      setForeignCityId(match?.id ?? '');
      setMode(departure.transport_mode);
      setDepartureDate(new Date(departure.departure_date));
      setArrivalEstimate(departure.arrival_estimate ? new Date(departure.arrival_estimate) : undefined);
      setTotalCapacity(departure.total_capacity_kg);
      setAvailableCapacity(departure.available_capacity_kg);
      setUseFixedPrice(departure.price_override_xof != null);
      setPriceOverride(departure.price_override_xof ?? '');
      setNotes(departure.notes ?? '');
      setStatus(departure.status);

      const ref = (departure as any).transporteur_ref ?? '';
      setTRef(ref);
      if (ref) {
        fetchTransporteurByRef(ref).then(applyTransporteur);
      } else {
        applyTransporteur(null);
      }
    } else {
      // CORRECTION #4 — Mapping form départ
      // - Origine SN/Dakar par défaut, destination = pays/ville du GP via prefill.
      // - Pays destination auto-déduit depuis la ville si non fourni.
      // Default: from Dakar to foreign city (matches prefill semantics)
      setDirection('from_dakar');
      setOriginCountry(prefill?.originCountry ?? 'SN');
      setOriginCity(prefill?.originCity ?? 'Dakar');
      const destCityVal = prefill?.destCity ?? '';
      const destCountryVal = prefill?.destCountry ?? resolveCountryFromCity(destCityVal);
      setDestCountry(destCountryVal);
      setDestCity(destCityVal);
      const prefMatch = destCityVal
        ? [...ALL_CITIES, ...customCities].find(
            (c) => c.city.toLowerCase() === destCityVal.toLowerCase() && (!destCountryVal || c.country === destCountryVal),
          )
        : null;
      setForeignCityId(prefMatch?.id ?? '');
      setMode('air');
      setDepartureDate(prefill?.departureDate ? new Date(prefill.departureDate) : undefined);
      setArrivalEstimate(undefined);
      setTotalCapacity(prefill?.totalCapacityKg ?? 0);
      setAvailableCapacity(prefill?.totalCapacityKg ?? 0);
      setUseFixedPrice(false); setPriceOverride('');
      setNotes(prefill?.notes ?? '');
      setStatus('draft');
      const pref = prefill?.transporteurRef ?? '';
      setTRef(pref);
      if (pref && /^[0-9]{4}$/.test(pref)) {
        fetchTransporteurByRef(pref).then((t) => {
          applyTransporteur(t);
          // Adresse principale laissée vide : on ne préremplit PAS depuis matched.adresse_1
          // pour ce départ. Le bloc applyTransporteur l'a mise, on la blanchit.
          setTAdr1('');
        });
      } else {
        applyTransporteur(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, departure, prefill]);

  async function save(publish: boolean) {
    // Transporter validation
    if (!/^[0-9]{4}$/.test(tRef)) {
      toast.error('Référence transporteur : 4 chiffres requis');
      return;
    }
    if (!tNom.trim() || !tTel1.trim() || !tAdr1.trim() || !tVille.trim()) {
      toast.error('Champs transporteur requis : Nom, Téléphone principal, Adresse, Ville');
      return;
    }

    const finalStatus: DepartureStatus = publish ? 'active' : status === 'active' ? 'active' : 'draft';
    const payload = {
      origin_city: originCity.trim(),
      destination_city: destCity.trim(),
      transport_mode: mode,
      departure_date: departureDate ? format(departureDate, 'yyyy-MM-dd') : '',
      total_capacity_kg: Number(totalCapacity) || 0,
      available_capacity_kg: Number(availableCapacity) || 0,
    };
    const parsed = Schema.safeParse(payload);
    if (!parsed.success) {
      toast.error(Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Champs invalides');
      return;
    }

    setSubmitting(true);
    try {
      // 1) Upsert transporteur
      const wasNew = !matched;
      const wasEdited = matched && edited;
      await upsertTransporteur.mutateAsync({
        reference: tRef,
        nom: tNom.trim(),
        telephone_1: tTel1.trim(),
        telephone_2: tTel2.trim() || null,
        adresse_1: tAdr1.trim(),
        adresse_2: tAdr2.trim() || null,
        ville: tVille.trim(),
        zone: tZone.trim() || null,
        notes: tNotes.trim() || null,
      });

      // 2) Save departure
      const input: ManualDepartureInput = {
        origin_country: originCountry.trim() || null,
        origin_city: originCity.trim(),
        destination_country: destCountry.trim() || null,
        destination_city: destCity.trim(),
        transport_mode: mode,
        departure_date: format(departureDate!, 'yyyy-MM-dd'),
        arrival_estimate: arrivalEstimate ? format(arrivalEstimate, 'yyyy-MM-dd') : null,
        total_capacity_kg: Number(totalCapacity) || 0,
        available_capacity_kg: Number(availableCapacity) || 0,
        price_override_xof: useFixedPrice && priceOverride !== '' ? Number(priceOverride) : null,
        carrier_name: tNom.trim() || null,
        carrier_contact: tTel1.trim() || null,
        notes: notes.trim() || null,
        status: finalStatus,
        transporteur_ref: tRef,
      };

      let savedDeparture: ManualDeparture;
      if (isEdit && departure) {
        savedDeparture = await update.mutateAsync({ id: departure.id, patch: input });
      } else {
        savedDeparture = await create.mutateAsync(input);
      }

      // 3) Fire-and-forget WhatsApp notification
      const prenom = tNom.trim().split(/\s+/)[0] || tNom.trim();
      const dossierRef = `MAN-${savedDeparture.id.slice(0, 8).toUpperCase()}`;
      try {
        const { data: notifyData } = await supabase.functions.invoke('notify-transporter', {
          body: {
            transporteur_ref: tRef,
            telephone: tTel1.trim(),
            prenom,
            dossierRef,
            collecteAddress: tAdr1.trim(),
            destinationCity: destCity.trim(),
            dateDepart: format(departureDate!, 'dd/MM/yyyy'),
            poids: totalCapacity,
          },
        });
        if (notifyData && notifyData.sent === false) {
          toast.warning(
            `Notification WhatsApp non envoyée. Contact manuel : ${tTel1}${tTel2 ? ' · ' + tTel2 : ''}`,
            { duration: 8000 },
          );
        }
      } catch {
        toast.warning(
          `Notification WhatsApp non envoyée. Contact manuel : ${tTel1}${tTel2 ? ' · ' + tTel2 : ''}`,
          { duration: 8000 },
        );
      }

      // 4) Confirmation feedback
      if (wasNew) {
        toast.success(
          `Transporteur Réf. ${tRef} enregistré. Il sera pré-rempli automatiquement à votre prochain départ.`,
        );
      } else if (wasEdited) {
        toast.success(`Infos transporteur Réf. ${tRef} mises à jour.`);
      } else {
        toast.success(isEdit ? 'Départ mis à jour' : (publish ? 'Départ publié' : 'Brouillon enregistré'));
      }

      onClose();
    } catch (e: any) {
      toast.error(e.message ?? 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Modifier le départ' : 'Nouveau départ'}</SheetTitle>
          <SheetDescription>Cette navette sera utilisée par le moteur de matching et de pricing.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Section 0: Transporter reference (FIRST) */}
          <Section title="Référence transporteur">
            <TransporteurReferenceLookup
              value={tRef}
              onChange={setTRef}
              onMatch={applyTransporteur}
            />
          </Section>

          {/* Section 1: Transporter details */}
          {/^[0-9]{4}$/.test(tRef) && (
            <Section title="Informations transporteur">
              {edited && (
                <p className="font-mono text-[11px]" style={{ color: '#F5C518' }}>
                  Modification détectée — les infos seront mises à jour pour ce transporteur.
                </p>
              )}
              <div>
                <Label>Nom / Prénom *</Label>
                <Input value={tNom} onChange={(e) => { setTNom(e.target.value); markEditedIf(matched?.nom, e.target.value); }} placeholder="Ibrahima Fall" />
              </div>
              <div>
                <Label>Téléphone principal *</Label>
                <Input value={tTel1} onChange={(e) => { setTTel1(e.target.value); markEditedIf(matched?.telephone_1, e.target.value); }} placeholder="+221 77 ..." />
                <p className="text-[11px] text-muted-foreground mt-1">Utilisé pour la notification WhatsApp automatique</p>
              </div>
              <div>
                <Label>Téléphone secondaire</Label>
                <Input value={tTel2} onChange={(e) => { setTTel2(e.target.value); markEditedIf(matched?.telephone_2, e.target.value); }} placeholder="+221 76 ..." />
              </div>
              <div>
                <Label>Adresse principale *</Label>
                <Input value={tAdr1} onChange={(e) => { setTAdr1(e.target.value); markEditedIf(matched?.adresse_1, e.target.value); }} placeholder="Liberté 6, Dakar" />
              </div>
              <div>
                <Label>Adresse secondaire (optionnel)</Label>
                <Input value={tAdr2} onChange={(e) => { setTAdr2(e.target.value); markEditedIf(matched?.adresse_2, e.target.value); }} placeholder="Point de dépôt habituel" />
              </div>
              <div>
                <Label>Ville *</Label>
                <Select value={tVille} onValueChange={(v) => { setTVille(v); markEditedIf(matched?.ville, v); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VILLES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Zone / Quartier (optionnel)</Label>
                <Input value={tZone} onChange={(e) => { setTZone(e.target.value); markEditedIf(matched?.zone, e.target.value); }} placeholder="Almadies" />
              </div>
              <div>
                <Label>Notes internes (optionnel)</Label>
                <Textarea value={tNotes} onChange={(e) => { setTNotes(e.target.value); markEditedIf(matched?.notes, e.target.value); }} rows={2} placeholder="Ex: disponible après 9h, préfère le 2ème numéro" />
              </div>
            </Section>
          )}

          {/* Section 2: Route */}
          <Section title="Route">
            <p className="text-[11px] text-muted-foreground">
              Yobbanté opère uniquement entre Dakar et l'une des 36 villes (+ villes personnalisées).
            </p>
            <div>
              <Label>Sens *</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Button
                  type="button"
                  variant={direction === 'from_dakar' ? 'default' : 'outline'}
                  onClick={() => {
                    setDirection('from_dakar');
                    setOriginCountry('SN'); setOriginCity('Dakar');
                    const c = cityCatalog.find((x) => x.id === foreignCityId);
                    setDestCountry(c?.country ?? ''); setDestCity(c?.city ?? '');
                  }}
                  className="justify-center"
                >
                  🇸🇳 Dakar → étranger
                </Button>
                <Button
                  type="button"
                  variant={direction === 'to_dakar' ? 'default' : 'outline'}
                  onClick={() => {
                    setDirection('to_dakar');
                    setDestCountry('SN'); setDestCity('Dakar');
                    const c = cityCatalog.find((x) => x.id === foreignCityId);
                    setOriginCountry(c?.country ?? ''); setOriginCity(c?.city ?? '');
                  }}
                  className="justify-center"
                >
                  étranger → Dakar 🇸🇳
                </Button>
              </div>
            </div>
            <div>
              <Label>{direction === 'from_dakar' ? 'Ville de destination *' : 'Ville d\'origine *'}</Label>
              <Select
                value={foreignCityId}
                onValueChange={(id) => {
                  setForeignCityId(id);
                  const c = cityCatalog.find((x) => x.id === id);
                  if (!c) return;
                  if (direction === 'from_dakar') {
                    setDestCountry(c.country); setDestCity(c.city);
                  } else {
                    setOriginCountry(c.country); setOriginCity(c.city);
                  }
                  // Auto-remplir arrivée estimée si départ connu et arrivée vide
                  if (departureDate && !arrivalEstimate) {
                    setArrivalEstimate(estimateArrivalDate({ destinationCountry: c.country, departureDate }));
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Choisir une ville…" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {cityCatalog.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.flag} {c.city} <span className="text-muted-foreground">· {c.countryLabel}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                className="mt-2 text-[11px] text-primary hover:underline"
                onClick={async () => {
                  const city = prompt('Nom de la ville à ajouter au catalogue ?')?.trim();
                  if (!city) return;
                  const code = prompt('Code pays ISO (2 lettres, ex: FR) ?')?.trim().toUpperCase();
                  if (!code || code.length !== 2) { toast.error('Code pays invalide'); return; }
                  const label = prompt('Nom du pays (ex: France) ?')?.trim();
                  if (!label) return;
                  try {
                    const added = await addCustomCity({ city, country_code: code, country_label: label });
                    setForeignCityId(added.id);
                    if (direction === 'from_dakar') { setDestCountry(added.country); setDestCity(added.city); }
                    else { setOriginCountry(added.country); setOriginCity(added.city); }
                    toast.success(`Ville ajoutée : ${added.city}`);
                  } catch (e: any) {
                    toast.error(e?.message ?? 'Erreur');
                  }
                }}
              >
                + Ajouter une ville hors liste
              </button>
            </div>
            <div>
              <Label>Mode de transport *</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as TransportMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="air">Air</SelectItem>
                  <SelectItem value="sea_lcl">Mer (LCL)</SelectItem>
                  <SelectItem value="road">Route</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Section>

          {/* Section 3: Dates */}
          <Section title="Dates">
            <div className="grid grid-cols-2 gap-2">
              <DateField label="Date de départ *" value={departureDate} onChange={setDepartureDate} />
              <DateField label="Arrivée estimée" value={arrivalEstimate} onChange={setArrivalEstimate} />
            </div>
          </Section>

          {/* Section 4: Capacity */}
          <Section title="Capacité">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Capacité totale (kg) *</Label>
                <Input type="number" min={0} value={totalCapacity} onChange={(e) => {
                  const n = Number(e.target.value) || 0;
                  setTotalCapacity(n);
                  if (availableCapacity > n) setAvailableCapacity(n);
                }} />
              </div>
              <div>
                <Label>Capacité disponible (kg) *</Label>
                <Input type="number" min={0} max={totalCapacity} value={availableCapacity} onChange={(e) => setAvailableCapacity(Math.min(Number(e.target.value) || 0, totalCapacity))} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">La capacité disponible ne peut pas dépasser la capacité totale.</p>
          </Section>

          {/* Section 5: Price */}
          <Section title="Prix">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label className="cursor-pointer">Prix fixe pour ce départ</Label>
                <p className="text-[11px] text-muted-foreground">Désactivé = utilise le pricing engine.</p>
              </div>
              <Switch checked={useFixedPrice} onCheckedChange={setUseFixedPrice} />
            </div>
            {useFixedPrice && (
              <div>
                <Label>Prix (XOF)</Label>
                <Input type="number" min={0} value={priceOverride} onChange={(e) => setPriceOverride(e.target.value === '' ? '' : Number(e.target.value))} placeholder="ex. 250000" />
              </div>
            )}
          </Section>

          {/* Section 6: Notes */}
          <Section title="Note interne (départ)">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Visible uniquement par l'équipe ops" />
          </Section>

          {/* Section 7: Status */}
          <Section title="Statut">
            <Select value={status} onValueChange={(v) => setStatus(v as DepartureStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Brouillon</SelectItem>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="full">Complet</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </Section>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-4 border-t border-border sticky bottom-0 bg-background pb-4 -mx-6 px-6">
            <Button variant="outline" disabled={submitting} onClick={() => save(false)} className="flex-1">
              Enregistrer en brouillon
            </Button>
            <Button disabled={submitting} onClick={() => save(true)} className="flex-1">
              {isEdit ? 'Mettre à jour' : 'Publier le départ'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function DateField({ label, value, onChange }: { label: string; value: Date | undefined; onChange: (d: Date | undefined) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, 'dd MMM yyyy') : 'Sélectionner'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus className={cn('p-3 pointer-events-auto')} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
