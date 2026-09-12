import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plane, Ship, Plus, Search, Pencil, Ban, CheckCircle2, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { EmptyState } from '@/components/EmptyState';
import { useManualDepartures, type ManualDeparture } from '@/hooks/useManualDepartures';
import { useFreightPartners, type FreightPartner } from '@/hooks/useFreightPartners';
import { AirSeaDepartureFields } from '@/components/freight/AirSeaDepartureFields';
import {
  AirSeaDepartureForm, EMPTY_AIR_SEA, AIR_SEA_MODE_LABEL, airSeaFormError, fromAirSeaRow, toAirSeaPayload,
} from '@/components/freight/airSeaDeparture';
import { cn } from '@/lib/utils';

function fmt(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const today = () => new Date().toISOString().slice(0, 10);

/** Recherche de partenaire à attribuer au départ (même logique que l'attribution GP). */
function PartnerPicker({
  partners, value, onChange, mode, dark,
}: {
  partners: FreightPartner[];
  value: string;
  onChange: (id: string) => void;
  mode: 'air' | 'sea_lcl';
  dark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const eligible = partners.filter(p =>
    p.status === 'active' && (p.mode === 'both' || p.mode === (mode === 'air' ? 'air' : 'sea')));
  const selected = eligible.find(p => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open}
                className={cn('w-full justify-between font-normal', dark && 'bg-transparent')}>
          {selected ? selected.company_name : 'Rechercher un partenaire…'}
          <ChevronsUpDown className="w-4 h-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Nom, ville, référence…" />
          <CommandList>
            <CommandEmpty>Aucun partenaire {AIR_SEA_MODE_LABEL[mode].toLowerCase()} actif.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="aucun-depart-interne" onSelect={() => { onChange('none'); setOpen(false); }}>
                <Check className={cn('w-4 h-4 mr-2', value === 'none' ? 'opacity-100' : 'opacity-0')} />
                Aucun — départ interne Yobbanté
              </CommandItem>
              {eligible.map(p => (
                <CommandItem key={p.id} value={`${p.company_name} ${p.reference} ${p.city ?? ''}`}
                             onSelect={() => { onChange(p.id); setOpen(false); }}>
                  <Check className={cn('w-4 h-4 mr-2', value === p.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="min-w-0">
                    <span className="block text-sm">{p.company_name}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {[p.reference, p.city, p.phone].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function AirSeaDeparturesTab() {
  const qc = useQueryClient();
  const { list } = useManualDepartures();
  const { list: partners } = useFreightPartners();
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | 'air' | 'sea_lcl'>('all');
  const [editing, setEditing] = useState<AirSeaDepartureForm | null>(null);
  const [partnerId, setPartnerId] = useState<string>('none');

  const rows = useMemo(() => (list.data ?? [])
    .filter(d => d.transport_mode === 'air' || d.transport_mode === 'sea_lcl')
    .filter(d => modeFilter === 'all' || d.transport_mode === modeFilter)
    .filter(d => {
      if (!search) return true;
      const s = search.toLowerCase();
      return d.origin_city.toLowerCase().includes(s) || d.destination_city.toLowerCase().includes(s)
        || ((d as any).carrier_company ?? '').toLowerCase().includes(s);
    })
    .sort((a, b) => a.departure_date.localeCompare(b.departure_date)),
    [list.data, search, modeFilter]);

  const isPending = (d: ManualDeparture) =>
    d.source === 'partner' && (d as any).publication_status !== 'published' && d.status !== 'cancelled';

  const pendingRows = rows.filter(isPending);
  const upcoming = rows.filter(d => !isPending(d) && d.departure_date >= today());
  const past = rows.filter(d => !isPending(d) && d.departure_date < today());

  const partnerName = (id?: string | null) =>
    (partners.data ?? []).find(p => p.id === id)?.company_name ?? null;

  const save = useMutation({
    mutationFn: async (form: AirSeaDepartureForm) => {
      const p = toAirSeaPayload(form);
      const kg = Number(p.total_capacity_kg ?? 0) || 0;
      const row: Record<string, unknown> = {
        transport_mode: p.transport_mode,
        origin_city: p.origin_city, origin_country: p.origin_country,
        destination_city: p.destination_city, destination_country: p.destination_country,
        departure_date: p.departure_date,
        arrival_estimate: p.arrival_estimate,
        cutoff_date: p.cutoff_date,
        carrier_company: p.carrier_company,
        flight_or_vessel: p.flight_or_vessel,
        port_origin: p.port_origin, port_destination: p.port_destination,
        container_type: p.container_type,
        capacity_cbm: p.capacity_cbm ? Number(p.capacity_cbm) : null,
        price_per_kg_xof: p.price_per_kg_xof ? Number(p.price_per_kg_xof) : null,
        price_per_cbm_xof: p.price_per_cbm_xof ? Number(p.price_per_cbm_xof) : null,
        transit_days: p.transit_days ? Number(p.transit_days) : null,
        notes: p.notes,
        partner_id: partnerId === 'none' ? null : partnerId,
        total_capacity_kg: kg,
        carrier_name: (p.carrier_company as string) || partnerName(partnerId) || null,
      };
      if (form.id) {
        const { error } = await supabase.from('manual_departures').update(row as any).eq('id', form.id);
        if (error) throw error;
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('manual_departures').insert({
        ...row,
        available_capacity_kg: kg,
        source: 'manual', created_via: 'admin',
        status: 'active', publication_status: 'published',
        published_at: new Date().toISOString(),
        created_by: user?.id ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['manual_departures'] }); },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from('manual_departures').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['manual_departures'] }); },
  });

  function openNew(mode: 'air' | 'sea_lcl') {
    setPartnerId('none');
    setEditing({ ...EMPTY_AIR_SEA, transport_mode: mode });
  }

  function openEdit(d: ManualDeparture) {
    setPartnerId((d as any).partner_id ?? 'none');
    setEditing(fromAirSeaRow(d as any));
  }

  /** Reprend les tarifs par défaut du partenaire sélectionné. */
  function pickPartner(id: string) {
    setPartnerId(id);
    const p = (partners.data ?? []).find(x => x.id === id);
    if (!p || !editing) return;
    setEditing({
      ...editing,
      carrier_company: editing.carrier_company || p.company_name,
      price_per_kg_xof: editing.price_per_kg_xof || (p.default_price_per_kg_xof?.toString() ?? ''),
      price_per_cbm_xof: editing.price_per_cbm_xof || (p.default_price_per_cbm_xof?.toString() ?? ''),
      transit_days: editing.transit_days || (p.default_transit_days?.toString() ?? ''),
    });
  }

  async function submit() {
    if (!editing) return;
    const err = airSeaFormError(editing);
    if (err) { toast.error(err); return; }
    try {
      await save.mutateAsync(editing);
      toast.success(editing.id ? 'Départ mis à jour' : 'Départ créé');
      setEditing(null);
    } catch (e) { toast.error((e as Error).message); }
  }

  const Row = ({ d }: { d: ManualDeparture }) => {
    const any = d as any;
    const partner = d.source === 'partner';
    const pending = isPending(d);
    return (
      <div className={cn('rounded-lg border p-3', pending ? 'border-amber-500/40 bg-amber-500/5' : 'border-border')}>
        <div className="flex items-start justify-between gap-3">
          <button className="text-left min-w-0 flex-1" onClick={() => openEdit(d)}>
            <div className="flex items-center gap-2 flex-wrap">
              {d.transport_mode === 'air' ? <Plane className="w-4 h-4 text-muted-foreground" />
                                          : <Ship className="w-4 h-4 text-muted-foreground" />}
              <span className="text-sm font-medium">{d.origin_city} → {d.destination_city}</span>
              <Badge variant="outline">{AIR_SEA_MODE_LABEL[d.transport_mode === 'air' ? 'air' : 'sea_lcl']}</Badge>
              {partner && <Badge variant="secondary">{partnerName(any.partner_id) ?? 'Partenaire'}</Badge>}
              {pending && <Badge className="bg-amber-500 text-white hover:bg-amber-500">À valider</Badge>}
              {d.status === 'cancelled' && <Badge variant="destructive">Annulé</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Départ {fmt(d.departure_date)}
              {any.cutoff_date ? ` · Cut-off ${fmt(any.cutoff_date)}` : ''}
              {d.arrival_estimate ? ` · Arrivée ${fmt(d.arrival_estimate)}` : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              {[any.carrier_company || partnerName(any.partner_id), any.flight_or_vessel]
                .filter(Boolean).join(' · ')}
              {d.transport_mode === 'air'
                ? ` · ${d.total_capacity_kg} kg${any.price_per_kg_xof ? ` · ${any.price_per_kg_xof} XOF/kg` : ''}`
                : `${any.container_type ? ` · ${any.container_type}` : ''}${any.capacity_cbm ? ` · ${any.capacity_cbm} CBM` : ''}${any.price_per_cbm_xof ? ` · ${any.price_per_cbm_xof} XOF/CBM` : ''}`}
            </p>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            {pending && (
              <Button size="sm" variant="outline" onClick={() => setStatus.mutate({
                id: d.id,
                patch: { publication_status: 'published', published_at: new Date().toISOString(), status: 'active' },
              })}>
                <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" /> Valider
              </Button>
            )}
            <Button size="icon" variant="ghost" aria-label="Modifier" onClick={() => openEdit(d)}>
              <Pencil className="w-4 h-4" />
            </Button>
            {d.status !== 'cancelled' && (
              <Button size="icon" variant="ghost" aria-label="Annuler"
                      onClick={() => setStatus.mutate({ id: d.id, patch: { status: 'cancelled', publication_status: 'closed' } })}>
                <Ban className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const Section = ({ title, items }: { title: string; items: ManualDeparture[] }) =>
    items.length === 0 ? null : (
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
          {title} · {items.length}
        </p>
        {items.map(d => <Row key={d.id} d={d} />)}
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="Ville, compagnie…" value={search}
                 onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={modeFilter} onValueChange={v => setModeFilter(v as any)}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Cargo aérien + Maritime</SelectItem>
            <SelectItem value="air">Cargo aérien</SelectItem>
            <SelectItem value="sea_lcl">Maritime</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => openNew('air')}>
          <Plane className="w-4 h-4 mr-1" /> Départ cargo aérien
        </Button>
        <Button size="sm" onClick={() => openNew('sea_lcl')}>
          <Ship className="w-4 h-4 mr-1" /> Départ maritime
        </Button>
      </div>

      {list.isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={Plus} title="Aucun départ cargo aérien ou maritime"
                    description="Créez un départ manuellement ou laissez vos partenaires publier les leurs." />
      ) : (
        <div className="space-y-5">
          <Section title="À valider (partenaires)" items={pendingRows} />
          <Section title="À venir" items={upcoming} />
          <Section title="Passés" items={past} />
        </div>
      )}

      <Sheet open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editing?.id ? 'Modifier le départ' : 'Nouveau départ'}
              {editing ? ` — ${AIR_SEA_MODE_LABEL[editing.transport_mode]}` : ''}
            </SheetTitle>
          </SheetHeader>
          {editing && (
            <div className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label>Partenaire attribué</Label>
                <PartnerPicker
                  partners={partners.data ?? []}
                  value={partnerId}
                  onChange={pickPartner}
                  mode={editing.transport_mode}
                />
                <p className="text-[11px] text-muted-foreground">
                  Laissez « Aucun » pour un départ opéré en interne.
                </p>
              </div>

              <AirSeaDepartureFields value={editing} onChange={setEditing} />

              <Button className="w-full" disabled={save.isPending} onClick={submit}>
                {save.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {editing.id ? 'Enregistrer' : 'Créer le départ'}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
