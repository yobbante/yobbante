import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plane, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTransporteurs } from '@/hooks/useTransporteurs';
import { useManualDepartures, type TransportMode } from '@/hooks/useManualDepartures';
import type { ParsedDeparture } from '@/lib/parseDepartureMessage';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contact: {
    id: string;
    phone: string;
    from_name?: string | null;
    message?: string | null;
  };
  parsed: ParsedDeparture;
  onDone: () => void;
}

/** Compute the next 4-digit transporteur reference. */
async function nextTransporteurRef(): Promise<string> {
  const { data } = await supabase
    .from('transporteurs' as any)
    .select('reference')
    .order('reference', { ascending: false })
    .limit(1);
  const last = (data?.[0] as any)?.reference as string | undefined;
  const n = last ? parseInt(String(last).replace(/\D/g, ''), 10) || 0 : 0;
  return String(n + 1).padStart(4, '0');
}

export function CreateGpFromContactDialog({ open, onOpenChange, contact, parsed, onDone }: Props) {
  const { upsert: upsertTransporteur } = useTransporteurs();
  const { create: createDeparture } = useManualDepartures();

  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [originCity, setOriginCity] = useState('');
  const [originCountry, setOriginCountry] = useState('');
  const [destCity, setDestCity] = useState('');
  const [destCountry, setDestCountry] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [transportMode, setTransportMode] = useState<TransportMode>('air');
  const [totalCapacity, setTotalCapacity] = useState<number>(20);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNom((contact.from_name || '').trim());
    setTelephone(contact.phone);
    setOriginCity(parsed.origin?.city ?? '');
    setOriginCountry(parsed.origin?.country ?? '');
    setDestCity(parsed.destination?.city ?? '');
    setDestCountry(parsed.destination?.country ?? '');
    setDepartureDate(parsed.departureDate ?? '');
    setTransportMode('air');
    setTotalCapacity(20);
  }, [open, contact, parsed]);

  async function handleConfirm() {
    if (!nom.trim()) return toast.error('Nom du GP requis');
    if (!telephone.trim()) return toast.error('Téléphone requis');
    if (!originCity.trim() || !destCity.trim()) return toast.error('Origine et destination requises');
    if (!departureDate) return toast.error('Date de départ requise');

    setSubmitting(true);
    try {
      const reference = await nextTransporteurRef();

      const t = await upsertTransporteur.mutateAsync({
        reference,
        nom: nom.trim(),
        prenom: null,
        telephone_1: telephone.trim(),
        telephone_2: null,
        adresse_1: originCity.trim() || 'Non renseigné',
        adresse_2: null,
        ville: originCity.trim() || 'Dakar',
        zone: null,
        notes: `Créé depuis contact WhatsApp inconnu le ${new Date().toLocaleDateString('fr-FR')}`,
        actif: true,
      });

      await createDeparture.mutateAsync({
        origin_country: originCountry || null,
        origin_city: originCity.trim(),
        destination_country: destCountry || null,
        destination_city: destCity.trim(),
        transport_mode: transportMode,
        departure_date: departureDate,
        arrival_estimate: null,
        total_capacity_kg: totalCapacity,
        available_capacity_kg: totalCapacity,
        price_override_xof: null,
        carrier_name: nom.trim(),
        carrier_contact: telephone.trim(),
        notes: contact.message ? `Détecté automatiquement depuis : "${contact.message}"` : null,
        status: 'draft',
        transporteur_ref: t.reference,
      });

      await supabase.from('gp_unknown_contacts' as any).update({
        followed_up: true,
        followed_up_at: new Date().toISOString(),
        notes: `GP créé (réf ${t.reference}) + départ ${originCity}→${destCity} le ${departureDate}`,
      }).eq('id', contact.id);

      toast.success(`GP ${t.reference} et départ créés`);
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e?.message || 'Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="w-4 h-4 text-[#F5C518]" /> Confirmer la création du GP + départ
          </DialogTitle>
          <DialogDescription>
            Vérifiez les informations détectées avant d'enregistrer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border border-border bg-muted/40 p-2 text-xs italic">
            "{contact.message}"
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Nom du GP</Label>
              <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom complet" />
            </div>
            <div>
              <Label className="text-xs">Téléphone</Label>
              <Input value={telephone} onChange={(e) => setTelephone(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Ville d'origine</Label>
              <Input value={originCity} onChange={(e) => setOriginCity(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Pays origine</Label>
              <Input value={originCountry} onChange={(e) => setOriginCountry(e.target.value)} placeholder="FR, SN…" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Ville de destination</Label>
              <Input value={destCity} onChange={(e) => setDestCity(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Pays destination</Label>
              <Input value={destCountry} onChange={(e) => setDestCountry(e.target.value)} placeholder="SN, FR…" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Date départ</Label>
              <Input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Mode</Label>
              <Select value={transportMode} onValueChange={(v) => setTransportMode(v as TransportMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="air">Avion</SelectItem>
                  <SelectItem value="sea_lcl">Bateau (LCL)</SelectItem>
                  <SelectItem value="road">Route</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Capacité (kg)</Label>
              <Input
                type="number"
                min={0}
                value={totalCapacity}
                onChange={(e) => setTotalCapacity(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={submitting}
            className="bg-[#F5C518] text-black hover:bg-[#F5C518]/90"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Création…</>
            ) : (
              <><UserPlus className="w-4 h-4 mr-1.5" /> Créer GP + départ</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
