import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CityPicker } from '@/components/quote/CityPicker';
import { supabase } from '@/integrations/supabase/client';
import { countryForCity } from '@/lib/worldCities';
import { toast } from 'sonner';
import { Loader2, UserPlus, Zap } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Numéro de la conversation WhatsApp (pré-rempli). */
  phone: string;
  /** Nom du contact WhatsApp (pré-rempli). */
  contactName?: string | null;
  /** Dernier message reçu — sert de note d'origine. */
  lastMessage?: string | null;
  /** Callback avec le dossier créé, pour le lier immédiatement à la conversation. */
  onCreated: (d: { id: string; reference: string | null; tracking_id: string | null; status: string;
    origin_country: string | null; destination_country: string | null; buyer_name: string | null;
    assigned_transporteur_ref: string | null }) => void;
}

/**
 * Attribution rapide : crée en 1 clic un dossier manuel à partir des infos
 * déjà présentes dans la conversation WhatsApp (nom, numéro, dernier message).
 */
export function QuickDossierDialog({ open, onOpenChange, phone, contactName, lastMessage, onCreated }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [tel, setTel] = useState(phone || '');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('Dakar');
  const [weight, setWeight] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const parts = (contactName || '').trim().split(/\s+/).filter(Boolean);
    setFirstName(parts[0] ?? '');
    setLastName(parts.slice(1).join(' '));
    setTel(phone || '');
    setOrigin('');
    setDestination('Dakar');
    setWeight('');
    setDescription('');
    setNotes(lastMessage ? `Demande WhatsApp : ${lastMessage.slice(0, 400)}` : '');
  }, [open, phone, contactName, lastMessage]);

  const fullName = `${firstName} ${lastName}`.trim();

  async function handleCreate() {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error('Session admin expirée');

      const originCity = origin.trim() || null;
      const destCity = destination.trim() || null;

      const { data: created, error } = await supabase
        .from('dossiers')
        .insert({
          user_id: userId,
          product_description: description.trim() || 'Colis (à préciser)',
          origin_city: originCity,
          destination_city: destCity,
          origin_country: countryForCity(originCity ?? '') || 'FR',
          destination_country: countryForCity(destCity ?? '') || 'SN',
          contact_phone: tel || phone,
          estimated_weight: weight ? parseFloat(weight.replace(',', '.')) : null,
          status: 'SUBMITTED',
          source: 'whatsapp',
          app_source: 'expedier',
          intake_by: userId,
          intake_method: 'whatsapp_quick',
          intake_notes: notes.trim() || null,
          buyer_name: fullName || phone,
          buyer_contact: tel || phone,
          dossier_type: 'individual',
        } as never)
        .select('id, reference, tracking_id, status, origin_country, destination_country, buyer_name, assigned_transporteur_ref')
        .single();
      if (error) throw error;

      toast.success(`Dossier ${created.reference} créé et lié à la conversation`);
      onCreated(created as never);
      onOpenChange(false);
    } catch (e) {
      toast.error('Échec création du dossier', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-[#F5C518]" /> Créer un dossier pour ce contact
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Prénom</label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Nom</label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Téléphone</label>
            <Input value={tel} onChange={(e) => setTel(e.target.value)} className="h-8 text-xs mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Origine</label>
              <CityPicker value={origin} onChange={setOrigin} includeHub placeholder="Ville de départ" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Destination</label>
              <CityPicker value={destination} onChange={setDestination} includeHub placeholder="Ville d'arrivée" />
            </div>
          </div>

          <div className="grid grid-cols-[110px_1fr] gap-2">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Poids (kg)</label>
              <Input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal"
                     placeholder="ex : 5" className="h-8 text-xs mt-1" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Contenu</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)}
                     placeholder="ex : vêtements, documents" className="h-8 text-xs mt-1" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Note interne</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                      className="text-xs mt-1" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button size="sm" onClick={handleCreate} disabled={saving}
                    className="bg-[#F5C518] text-zinc-950 hover:bg-[#F5C518]/90">
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <UserPlus className="w-3.5 h-3.5 mr-1" />}
              Créer et lier
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
