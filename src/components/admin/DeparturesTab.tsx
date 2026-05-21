import { useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, PauseCircle, PlayCircle, AlertTriangle, Calendar } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { formatDateFR } from '@/lib/statusLabels';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useManualDepartures, type ManualDeparture, type DepartureStatus } from '@/hooks/useManualDepartures';
import { ManualDepartureForm } from './ManualDepartureForm';
import { cn } from '@/lib/utils';

const MODE_LABEL: Record<string, string> = { air: 'Air', sea_lcl: 'Mer (LCL)', road: 'Route' };

const STATUS_BADGE: Record<DepartureStatus, { label: string; variant: 'success' | 'danger' | 'secondary' | 'warning' }> = {
  active:    { label: 'Actif',     variant: 'success' },
  full:      { label: 'Complet',   variant: 'danger' },
  cancelled: { label: 'Annulé',    variant: 'secondary' },
  draft:     { label: 'Brouillon', variant: 'warning' },
  expired:   { label: 'Expiré',    variant: 'secondary' },
};

export function DeparturesTab() {
  const { list, update, remove } = useManualDepartures();
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editing, setEditing] = useState<ManualDeparture | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ManualDeparture | null>(null);

  const rows = useMemo(() => {
    const all = list.data ?? [];
    return all.filter(d => {
      if (modeFilter !== 'all' && d.transport_mode !== modeFilter) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!d.origin_city.toLowerCase().includes(s) && !d.destination_city.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [list.data, search, modeFilter, statusFilter]);

  async function toggleStatus(d: ManualDeparture) {
    const next: DepartureStatus = d.status === 'active' ? 'cancelled' : 'active';
    try {
      await update.mutateAsync({ id: d.id, patch: { status: next } });
      toast.success(next === 'active' ? 'Départ réactivé' : 'Départ désactivé');
    } catch (e: any) {
      toast.error(e.message ?? 'Erreur');
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    try {
      await remove.mutateAsync(confirmDelete.id);
      toast.success('Départ supprimé');
      setConfirmDelete(null);
    } catch (e: any) {
      toast.error(e.message ?? 'Suppression impossible');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Départs manuels</h1>
          <p className="text-sm text-muted-foreground mt-1">Gérez les navettes non connectées à Konnekt.</p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Ajouter un départ
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher origine ou destination" className="pl-9" />
        </div>
        <Select value={modeFilter} onValueChange={setModeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous modes</SelectItem>
            <SelectItem value="air">Air</SelectItem>
            <SelectItem value="sea_lcl">Mer (LCL)</SelectItem>
            <SelectItem value="road">Route</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="full">Complet</SelectItem>
            <SelectItem value="cancelled">Annulé</SelectItem>
            <SelectItem value="draft">Brouillon</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {list.isLoading ? (
        <div className="text-sm text-muted-foreground">Chargement…</div>
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Aucun départ configuré"
          description="Ajoutez votre premier départ pour qu'il apparaisse dans les devis clients."
          ctaLabel="Nouveau départ"
          onCta={() => setCreating(true)}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Aucun résultat"
          description="Aucun départ ne correspond aux filtres."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Trajet</th>
                <th className="text-left px-4 py-3 font-semibold">Mode</th>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
                <th className="text-left px-4 py-3 font-semibold w-44">Capacité</th>
                <th className="text-left px-4 py-3 font-semibold">Prix fixe</th>
                <th className="text-left px-4 py-3 font-semibold">Statut</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(d => {
                const fillPct = d.total_capacity_kg > 0
                  ? Math.round(((d.total_capacity_kg - d.available_capacity_kg) / d.total_capacity_kg) * 100)
                  : 0;
                return (
                  <tr key={d.id} className="border-t border-border hover:bg-secondary/20">
                    <td className="px-4 py-3 font-medium">{d.origin_city} → {d.destination_city}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{MODE_LABEL[d.transport_mode] ?? d.transport_mode}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateFR(d.departure_date)}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'hsl(var(--color-border-tertiary))' }}>
                          <div
                            className="h-full"
                            style={{
                              width: `${fillPct}%`,
                              background: fillPct >= 70 ? '#A32D2D' : fillPct >= 30 ? '#BA7517' : '#1D9E75',
                            }}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">{fillPct}% rempli · {d.available_capacity_kg}/{d.total_capacity_kg} kg dispo</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      {d.price_override_xof != null
                        ? `${new Intl.NumberFormat('fr-FR').format(d.price_override_xof)} XOF`
                        : <span className="text-muted-foreground">Engine</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE[d.status].variant}>{STATUS_BADGE[d.status].label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditing(d)} title="Modifier">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => toggleStatus(d)} title={d.status === 'active' ? 'Désactiver' : 'Réactiver'}>
                          {d.status === 'active' ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(d)} title="Supprimer">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ManualDepartureForm
        open={creating || !!editing}
        departure={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Supprimer ce départ ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete && `${confirmDelete.origin_city} → ${confirmDelete.destination_city} · ${formatDateFR(confirmDelete.departure_date)}`}
              <br />
              Cette action est définitive. Si des envois sont déjà confirmés sur ce départ, annulez-les d'abord.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
