import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MapPin, Loader2, Save } from 'lucide-react';

type Relay = {
  id: string;
  country: string;
  country_code: string;
  city: string;
  address_line1: string;
  address_line2: string | null;
  postal_code: string | null;
  phone: string | null;
  contact_name: string | null;
  active: boolean;
  notes: string | null;
};

export function RelayAddressesPanel() {
  const [relays, setRelays] = useState<Relay[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('relay_addresses')
      .select('*')
      .order('country');
    if (error) toast.error(error.message);
    else setRelays(data as Relay[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateField = (id: string, field: keyof Relay, value: any) => {
    setRelays(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const save = async (relay: Relay) => {
    setSavingId(relay.id);
    const { error } = await supabase
      .from('relay_addresses')
      .update({
        address_line1: relay.address_line1,
        address_line2: relay.address_line2,
        postal_code: relay.postal_code,
        phone: relay.phone,
        contact_name: relay.contact_name,
        active: relay.active,
        notes: relay.notes,
      })
      .eq('id', relay.id);
    setSavingId(null);
    if (error) toast.error(error.message);
    else toast.success(`${relay.city} mis à jour`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-muted-foreground" />
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Adresses de relais (Réception)
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Ces adresses physiques sont affichées aux clients qui enregistrent une commande internationale. Mettez à jour les valeurs réelles ici.
      </p>

      <div className="grid lg:grid-cols-2 gap-3">
        {relays.map(r => (
          <div key={r.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">{r.country} — {r.city}</p>
              <label className="inline-flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={r.active}
                  onChange={e => updateField(r.id, 'active', e.target.checked)}
                />
                Actif
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Nom contact" value={r.contact_name ?? ''} onChange={e => updateField(r.id, 'contact_name', e.target.value)} />
              <Input placeholder="Téléphone" value={r.phone ?? ''} onChange={e => updateField(r.id, 'phone', e.target.value)} />
            </div>
            <Input placeholder="Renseigner l'adresse" value={r.address_line1 ?? ''} onChange={e => updateField(r.id, 'address_line1', e.target.value)} />
            <Input placeholder="Adresse ligne 2 (suite, étage…)" value={r.address_line2 ?? ''} onChange={e => updateField(r.id, 'address_line2', e.target.value)} />
            <Input placeholder="Code postal" value={r.postal_code ?? ''} onChange={e => updateField(r.id, 'postal_code', e.target.value)} />
            <Textarea placeholder="Notes internes" rows={2} value={r.notes ?? ''} onChange={e => updateField(r.id, 'notes', e.target.value)} />

            <Button
              size="sm"
              onClick={() => save(r)}
              disabled={savingId === r.id}
              className="w-full"
            >
              {savingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-1.5" /> Enregistrer</>}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
