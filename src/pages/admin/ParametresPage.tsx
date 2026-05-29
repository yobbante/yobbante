import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminOnlyGuard } from '@/components/AdminOnlyGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Building2 } from 'lucide-react';
import { toast } from 'sonner';

type Partner = {
  id: string;
  destination_country: string;
  name: string;
  address: string;
  phone: string;
  opening_hours: string | null;
  instructions: string | null;
  is_active: boolean;
};

const empty: Omit<Partner, 'id'> = {
  destination_country: '', name: '', address: '', phone: '',
  opening_hours: '', instructions: '', is_active: true,
};

function ParametresPageInner() {
  const [list, setList] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [form, setForm] = useState<Omit<Partner, 'id'>>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('delivery_partners')
      .select('*')
      .order('destination_country', { ascending: true });
    if (error) toast.error(error.message);
    setList((data ?? []) as Partner[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(p: Partner) {
    setEditing(p);
    const { id, ...rest } = p;
    setForm(rest);
    setOpen(true);
  }
  async function toggleActive(p: Partner) {
    const { error } = await supabase
      .from('delivery_partners')
      .update({ is_active: !p.is_active })
      .eq('id', p.id);
    if (error) return toast.error(error.message);
    load();
  }

  async function save() {
    if (!form.name.trim() || !form.address.trim() || !form.phone.trim() || !form.destination_country.trim()) {
      toast.error('Pays, nom, adresse et téléphone sont obligatoires');
      return;
    }
    setSaving(true);
    const payload = { ...form, destination_country: form.destination_country.toUpperCase() };
    const { error } = editing
      ? await supabase.from('delivery_partners').update(payload).eq('id', editing.id)
      : await supabase.from('delivery_partners').insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? 'Partenaire mis à jour' : 'Partenaire ajouté');
    setOpen(false);
    load();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Building2 className="w-6 h-6" style={{ color: '#F5C518' }} />
          Paramètres
        </h1>
        <p className="text-sm text-muted-foreground mt-1 mb-8">
          Configuration des partenaires et autres paramètres globaux.
        </p>

        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Partenaire livraison à destination</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Coordonnées du partenaire local par pays de destination. Utilisé pour la notification WhatsApp automatique
                quand le colis arrive au hub et que le client a choisi "Récupérer chez notre partenaire".
              </p>
            </div>
            <Button onClick={openCreate} style={{ background: '#F5C518', color: '#0A0E1A' }} className="font-semibold hover:opacity-90">
              <Plus className="w-4 h-4 mr-1.5" /> Ajouter
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pays</TableHead>
                  <TableHead>Partenaire</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead className="text-center">Actif</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Chargement…</TableCell></TableRow>
                ) : list.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun partenaire configuré</TableCell></TableRow>
                ) : list.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono font-semibold">{p.destination_country}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">{p.address}</TableCell>
                    <TableCell className="text-sm">{p.phone}</TableCell>
                    <TableCell className="text-center">
                      <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                        <Pencil className="w-4 h-4 mr-1" /> Modifier
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-background">
          <SheetHeader>
            <SheetTitle>{editing ? 'Modifier le partenaire' : 'Ajouter un partenaire'}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <Field label="Code pays destination * (ex. SN, FR, US)">
              <Input value={form.destination_country} maxLength={3}
                onChange={e => setForm({ ...form, destination_country: e.target.value.toUpperCase() })}
                placeholder="SN" />
            </Field>
            <Field label="Nom du partenaire *">
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="DHL Relay Paris" />
            </Field>
            <Field label="Adresse complète *">
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Téléphone *">
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Heures d'ouverture">
              <Input value={form.opening_hours ?? ''} onChange={e => setForm({ ...form, opening_hours: e.target.value })} placeholder="Lun-Ven 9h-18h" />
            </Field>
            <Field label="Instructions spéciales">
              <Textarea rows={3} value={form.instructions ?? ''} onChange={e => setForm({ ...form, instructions: e.target.value })} />
            </Field>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <Label className="text-sm">Actif</Label>
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving} style={{ background: '#F5C518', color: '#0A0E1A' }} className="font-semibold hover:opacity-90">
              {saving ? 'Enregistrement…' : (editing ? 'Enregistrer' : 'Créer')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export default function ParametresPage() {
  return <AdminOnlyGuard><ParametresPageInner /></AdminOnlyGuard>;
}
