import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: () => void;
}

export function WhatsAppImportDepartureDialog({ open, onOpenChange, onCreated }: Props) {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [transporteurRef, setTransporteurRef] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [kg, setKg] = useState('');
  const [saving, setSaving] = useState(false);

  async function parse() {
    if (!text.trim()) return;
    setParsing(true);
    const { data, error } = await supabase.functions.invoke('parse-departure-message', {
      body: { text: text.trim() },
    });
    setParsing(false);
    if (error || !data?.ok) {
      toast.error('Impossible de parser le message');
      return;
    }
    setDestination(data.destination ?? '');
    setDate(data.date ?? '');
    setKg(String(data.kg ?? ''));
    toast.success('Message analysé');
  }

  async function save() {
    if (!transporteurRef || !destination || !date || !kg) {
      toast.error('Tous les champs sont requis');
      return;
    }
    setSaving(true);
    const v_kg = Math.max(1, Math.ceil(Number(kg)));
    const { error } = await supabase.from('manual_departures').insert({
      origin_country: 'SN',
      origin_city: 'Dakar',
      destination_city: destination,
      destination_country: '',
      transport_mode: 'air',
      departure_date: date,
      total_capacity_kg: v_kg,
      available_capacity_kg: v_kg,
      transporteur_ref: transporteurRef,
      source: 'whatsapp_import',
      created_via: 'whatsapp_import',
      status: 'active',
      publication_status: 'published',
      published_at: new Date().toISOString(),
    } as any);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Départ créé');
    setText(''); setTransporteurRef(''); setDestination(''); setDate(''); setKg('');
    onCreated?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importer depuis WhatsApp</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Message GP brut</Label>
            <Textarea
              rows={3}
              placeholder="DEP Paris 15/06 25kg"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button size="sm" variant="outline" onClick={parse} disabled={parsing || !text.trim()}>
              {parsing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
              Analyser
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs text-muted-foreground">Référence GP (4 chiffres)</Label>
              <Input value={transporteurRef} onChange={(e) => setTransporteurRef(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs text-muted-foreground">Destination</Label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Paris" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Kg</Label>
              <Input type="number" min={1} value={kg} onChange={(e) => setKg(e.target.value)} placeholder="25" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            onClick={save}
            disabled={saving}
            style={{ background: '#F5C518', color: '#0A0E1A' }}
            className="font-semibold hover:opacity-90"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            Créer le départ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
