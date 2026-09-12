import { useMemo, useState } from 'react';
import { Plus, Link2, Copy, MessageCircle, Plane, Ship, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { EmptyState } from '@/components/EmptyState';
import {
  useFreightPartners, FP_MODE_LABEL, type FreightPartner, type FreightPartnerInput,
} from '@/hooks/useFreightPartners';

const EMPTY: FreightPartnerInput = {
  company_name: '', mode: 'air', contact_name: '', phone: '', email: '',
  city: '', country: '', hubs: [], status: 'active', notes: '',
};

export function FreightPartnersTab() {
  const { list, save, createAccessLink } = useFreightPartners();
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('all');
  const [editing, setEditing] = useState<FreightPartnerInput | null>(null);

  const rows = useMemo(() => (list.data ?? []).filter(p => {
    if (modeFilter !== 'all' && p.mode !== modeFilter && p.mode !== 'both') return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return p.company_name.toLowerCase().includes(s)
      || (p.city ?? '').toLowerCase().includes(s)
      || p.reference.toLowerCase().includes(s)
      || p.phone.includes(s);
  }), [list.data, search, modeFilter]);

  async function shareLink(p: FreightPartner, viaWhatsApp: boolean) {
    try {
      const r = await createAccessLink.mutateAsync(p.id);
      if (viaWhatsApp) {
        const text = `Bonjour ${r.company_name}, voici votre accès à l'espace partenaire Yobbanté (valable 7 jours) : ${r.url}`;
        window.open(`https://wa.me/${r.phone}?text=${encodeURIComponent(text)}`, '_blank');
      } else {
        await navigator.clipboard.writeText(r.url);
        toast.success("Lien d'accès copié");
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="Rechercher un partenaire…"
                 value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={modeFilter} onValueChange={setModeFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les modes</SelectItem>
            <SelectItem value="air">Aérien</SelectItem>
            <SelectItem value="sea">Maritime</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setEditing({ ...EMPTY })}>
          <Plus className="w-4 h-4 mr-1" /> Nouveau partenaire
        </Button>
      </div>

      {list.isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={Plane} title="Aucun partenaire"
                    description="Créez une fiche partenaire aérien ou maritime pour lui donner accès à son espace." />
      ) : (
        <div className="space-y-2">
          {rows.map(p => (
            <div key={p.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <button className="text-left min-w-0 flex-1" onClick={() => setEditing(p)}>
                  <div className="flex items-center gap-2">
                    {p.mode === 'sea' ? <Ship className="w-4 h-4 text-muted-foreground" />
                                      : <Plane className="w-4 h-4 text-muted-foreground" />}
                    <p className="text-sm font-medium truncate">{p.company_name}</p>
                    <Badge variant="secondary">{p.reference}</Badge>
                    {p.status === 'suspended' && <Badge variant="destructive">Suspendu</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {FP_MODE_LABEL[p.mode]}
                    {p.city ? ` · ${p.city}` : ''}{p.country ? `, ${p.country}` : ''} · {p.phone}
                  </p>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" aria-label="Copier le lien d'accès"
                          onClick={() => shareLink(p, false)}>
                    {createAccessLink.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Envoyer le lien par WhatsApp"
                          onClick={() => shareLink(p, true)}>
                    <MessageCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{editing?.id ? 'Fiche partenaire' : 'Nouveau partenaire'}</SheetTitle></SheetHeader>
          {editing && (
            <div className="space-y-3 mt-4">
              <div className="space-y-1.5">
                <Label htmlFor="fp-company">Société</Label>
                <Input id="fp-company" value={editing.company_name ?? ''}
                       onChange={e => setEditing({ ...editing, company_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Mode</Label>
                <Select value={editing.mode ?? 'air'} onValueChange={v => setEditing({ ...editing, mode: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="air">Aérien</SelectItem>
                    <SelectItem value="sea">Maritime</SelectItem>
                    <SelectItem value="both">Aérien + Maritime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fp-contact">Contact</Label>
                <Input id="fp-contact" value={editing.contact_name ?? ''}
                       onChange={e => setEditing({ ...editing, contact_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fp-phone">Téléphone WhatsApp (format international)</Label>
                <Input id="fp-phone" placeholder="+221771234567" value={editing.phone ?? ''}
                       onChange={e => setEditing({ ...editing, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fp-email">Email</Label>
                <Input id="fp-email" type="email" value={editing.email ?? ''}
                       onChange={e => setEditing({ ...editing, email: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fp-city">Ville</Label>
                  <Input id="fp-city" value={editing.city ?? ''}
                         onChange={e => setEditing({ ...editing, city: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fp-country">Pays</Label>
                  <Input id="fp-country" value={editing.country ?? ''}
                         onChange={e => setEditing({ ...editing, country: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fp-kg">Prix /kg</Label>
                  <Input id="fp-kg" type="number" value={editing.default_price_per_kg_xof ?? ''}
                         onChange={e => setEditing({ ...editing, default_price_per_kg_xof: e.target.value === '' ? null : Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fp-cbm">Prix /CBM</Label>
                  <Input id="fp-cbm" type="number" value={editing.default_price_per_cbm_xof ?? ''}
                         onChange={e => setEditing({ ...editing, default_price_per_cbm_xof: e.target.value === '' ? null : Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fp-transit">Transit (j)</Label>
                  <Input id="fp-transit" type="number" value={editing.default_transit_days ?? ''}
                         onChange={e => setEditing({ ...editing, default_transit_days: e.target.value === '' ? null : Number(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select value={editing.status ?? 'active'} onValueChange={v => setEditing({ ...editing, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="suspended">Suspendu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fp-notes">Notes internes</Label>
                <Textarea id="fp-notes" value={editing.notes ?? ''}
                          onChange={e => setEditing({ ...editing, notes: e.target.value })} />
              </div>

              <Button className="w-full"
                      disabled={save.isPending || !(editing.company_name ?? '').trim() || !(editing.phone ?? '').trim()}
                      onClick={async () => {
                        try {
                          await save.mutateAsync(editing);
                          toast.success('Fiche partenaire enregistrée');
                          setEditing(null);
                        } catch (e) { toast.error((e as Error).message); }
                      }}>
                {save.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Enregistrer
              </Button>

              {editing.id && (
                <Button variant="outline" className="w-full"
                        onClick={() => shareLink(editing as FreightPartner, true)}>
                  <Link2 className="w-4 h-4 mr-1" /> Envoyer le lien d'accès par WhatsApp
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
