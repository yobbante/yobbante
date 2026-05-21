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
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  departure: ManualDeparture | null;
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

export function ManualDepartureForm({ open, onClose, departure }: Props) {
  const { create, update } = useManualDepartures();
  const { upsert: upsertTransporteur } = useTransporteurs();
  const isEdit = !!departure;

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
      setOriginCountry(''); setOriginCity(''); setDestCountry(''); setDestCity('');
      setMode('air'); setDepartureDate(undefined); setArrivalEstimate(undefined);
      setTotalCapacity(0); setAvailableCapacity(0);
      setUseFixedPrice(false); setPriceOverride('');
      setNotes(''); setStatus('draft');
      setTRef(''); applyTransporteur(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, departure]);

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
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1"><Label>Pays orig.</Label><Input value={originCountry} onChange={(e) => setOriginCountry(e.target.value)} placeholder="FR" maxLength={3} /></div>
              <div className="col-span-2"><Label>Ville origine *</Label><Input value={originCity} onChange={(e) => setOriginCity(e.target.value)} placeholder="Paris" /></div>
              <div className="col-span-1"><Label>Pays dest.</Label><Input value={destCountry} onChange={(e) => setDestCountry(e.target.value)} placeholder="SN" maxLength={3} /></div>
              <div className="col-span-2"><Label>Ville destination *</Label><Input value={destCity} onChange={(e) => setDestCity(e.target.value)} placeholder="Dakar" /></div>
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
