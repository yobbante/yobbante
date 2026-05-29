import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, MapPin } from 'lucide-react';
import { toast } from 'sonner';

type RelayPoint = {
  id: string;
  name: string;
  address: string;
  contact_phone: string;
  contact_name: string | null;
  quartier: string;
  opening_hours: string | null;
  notes: string | null;
  is_active: boolean;
};

const empty: Omit<RelayPoint, 'id'> = {
  name: '', address: '', contact_phone: '', contact_name: '',
  quartier: '', opening_hours: '', notes: '', is_active: false,
};

function RelaisPageInner() {
  const [list, setList] = useState<RelayPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RelayPoint | null>(null);
  const [form, setForm] = useState<Omit<RelayPoint, 'id'>>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('relay_points')
      .select('*')
      .order('quartier', { ascending: true });
    if (error) toast.error(error.message);
    setList((data ?? []) as RelayPoint[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(rp: RelayPoint) {
    setEditing(rp);
    const { id, ...rest } = rp;
    setForm(rest);
    setOpen(true);
  }

  async function toggleActive(rp: RelayPoint) {
    const { error } = await supabase
      .from('relay_points')
      .update({ is_active: !rp.is_active })
      .eq('id', rp.id);
    if (error) return toast.error(error.message);
    toast.success(rp.is_active ? 'Point relais désactivé' : 'Point relais activé');
    load();
  }

  async function save() {
    if (!form.name.trim() || !form.address.trim() || !form.contact_phone.trim() || !form.quartier.trim()) {
      toast.error('Nom, adresse, téléphone et quartier sont obligatoires');
      return;
    }
    setSaving(true);
    const payload = { ...form };
    const { error } = editing
      ? await supabase.from('relay_points').update(payload).eq('id', editing.id)
      : await supabase.from('relay_points').insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? 'Point relais mis à jour' : 'Point relais ajouté');
    setOpen(false);
    load();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <MapPin className="w-6 h-6" style={{ color: '#F5C518' }} />
              Points relais
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Disponibles uniquement à Dakar. Désactivés par défaut.
            </p>
          </div>
          <Button onClick={openCreate} style={{ background: '#F5C518', color: '#0A0E1A' }} className="font-semibold hover:opacity-90">
            <Plus className="w-4 h-4 mr-1.5" /> Ajouter un point relais
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Quartier</TableHead>
                <TableHead className="text-center">Actif</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Chargement…</TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun point relais</TableCell></TableRow>
              ) : list.map(rp => (
                <TableRow key={rp.id}>
                  <TableCell className="font-medium">{rp.name}</TableCell>
                  <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">{rp.address}</TableCell>
                  <TableCell className="text-sm">
                    <div>{rp.contact_phone}</div>
                    {rp.contact_name && <div className="text-xs text-muted-foreground">{rp.contact_name}</div>}
                  </TableCell>
                  <TableCell>{rp.quartier}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={rp.is_active} onCheckedChange={() => toggleActive(rp)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(rp)}>
                      <Pencil className="w-4 h-4 mr-1" /> Modifier
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-background">
          <SheetHeader>
            <SheetTitle>{editing ? 'Modifier le point relais' : 'Ajouter un point relais'}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <Field label="Nom *">
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Relais Liberté 6" />
            </Field>
            <Field label="Adresse complète *">
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="45 rue Moussé Diop" />
            </Field>
            <Field label="Téléphone contact *">
              <Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} placeholder="+221 77 000 00 00" />
            </Field>
            <Field label="Nom contact">
              <Input value={form.contact_name ?? ''} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
            </Field>
            <Field label="Quartier Dakar *">
              <Input value={form.quartier} onChange={e => setForm({ ...form, quartier: e.target.value })} placeholder="Liberté 6" />
            </Field>
            <Field label="Heures d'ouverture">
              <Input value={form.opening_hours ?? ''} onChange={e => setForm({ ...form, opening_hours: e.target.value })} placeholder="Lun-Sam 9h-19h" />
            </Field>
            <Field label="Notes internes">
              <Textarea rows={3} value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
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

export default function RelaisPage() {
  const { isAdmin, isLoading } = useUserRole();
  if (isLoading) return null;
  if (!isAdmin) return <Navigate to="/auth" replace />;
  return <RelaisPageInner />;
}
