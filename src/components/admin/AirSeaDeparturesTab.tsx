import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plane, Ship, Plus, Search, Pencil, Ban, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { EmptyState } from '@/components/EmptyState';
import { useManualDepartures, type ManualDeparture } from '@/hooks/useManualDepartures';
import { useFreightPartners } from '@/hooks/useFreightPartners';
import { AirSeaDepartureFields } from '@/components/freight/AirSeaDepartureFields';
import {
  AirSeaDepartureForm, EMPTY_AIR_SEA, airSeaFormError, fromAirSeaRow, toAirSeaPayload,
} from '@/components/freight/airSeaDeparture';

function fmt(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="Ville, compagnie…" value={search}
                 onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={modeFilter} onValueChange={v => setModeFilter(v as any)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Aérien + Maritime</SelectItem>
            <SelectItem value="air">Aérien</SelectItem>
            <SelectItem value="sea_lcl">Maritime</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => openNew('air')}>
          <Plane className="w-4 h-4 mr-1" /> Départ aérien
        </Button>
        <Button size="sm" onClick={() => openNew('sea_lcl')}>
          <Ship className="w-4 h-4 mr-1" /> Départ maritime
        </Button>
      </div>

      {list.isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={Plus} title="Aucun départ aérien ou maritime"
                    description="Créez un départ manuellement ou laissez vos partenaires publier les leurs." />
      ) : (
        <div className="space-y-2">
          {rows.map(d => {
            const any = d as any;
            const isPartner = d.source === 'partner';
            const pending = isPartner && any.publication_status !== 'published';
            return (
              <div key={d.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <button className="text-left min-w-0 flex-1" onClick={() => openEdit(d)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      {d.transport_mode === 'air' ? <Plane className="w-4 h-4 text-muted-foreground" />
                                                  : <Ship className="w-4 h-4 text-muted-foreground" />}
                      <span className="text-sm font-medium">{d.origin_city} → {d.destination_city}</span>
                      {isPartner && <Badge variant="secondary">Partenaire</Badge>}
                      {pending && <Badge variant="outline">À valider</Badge>}
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
                        : `${any.capacity_cbm ? ` · ${any.capacity_cbm} CBM` : ''}${any.price_per_cbm_xof ? ` · ${any.price_per_cbm_xof} XOF/CBM` : ''}`}
                    </p>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {pending && (
                      <Button size="icon" variant="ghost" aria-label="Publier ce départ"
                              onClick={() => setStatus.mutate({
                                id: d.id,
                                patch: { publication_status: 'published', published_at: new Date().toISOString(), status: 'active' },
                              })}>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
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
          })}
        </div>
      )}

      <Sheet open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing?.id ? 'Modifier le départ' : 'Nouveau départ'}</SheetTitle>
          </SheetHeader>
          {editing && (
            <div className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label>Partenaire (optionnel)</Label>
                <Select value={partnerId} onValueChange={setPartnerId}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun — départ interne</SelectItem>
                    {(partners.data ?? []).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
