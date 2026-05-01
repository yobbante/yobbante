import { useMemo, useState } from 'react';
import { MoreHorizontal, Search, Power, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useTransporteurs, type Transporteur } from '@/hooks/useTransporteurs';
import { useManualDepartures } from '@/hooks/useManualDepartures';
import { toast } from 'sonner';

export function TransporteursTab() {
  const { list, upsert, deactivate } = useTransporteurs();
  const { list: depList } = useManualDepartures();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Transporteur | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const counts = useMemo(() => {
    const map: Record<string, { count: number; last: string | null }> = {};
    (depList.data ?? []).forEach((d: any) => {
      const ref = d.transporteur_ref;
      if (!ref) return;
      if (!map[ref]) map[ref] = { count: 0, last: null };
      map[ref].count += 1;
      if (!map[ref].last || d.departure_date > map[ref].last!) map[ref].last = d.departure_date;
    });
    return map;
  }, [depList.data]);

  const filtered = useMemo(() => {
    const all = list.data ?? [];
    const base = showInactive ? all : all.filter(t => t.actif);
    if (!q.trim()) return base;
    const s = q.trim().toLowerCase();
    return base.filter(t =>
      t.reference.includes(s) ||
      t.nom.toLowerCase().includes(s) ||
      t.telephone_1.toLowerCase().includes(s) ||
      (t.telephone_2 ?? '').toLowerCase().includes(s) ||
      t.ville.toLowerCase().includes(s),
    );
  }, [list.data, q, showInactive]);

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Transporteurs</h2>
          <p className="text-sm text-muted-foreground">Annuaire interne. Pré-remplit automatiquement les départs manuels.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing({
          id: '', reference: '', nom: '', telephone_1: '', telephone_2: null,
          adresse_1: '', adresse_2: null, ville: 'Dakar', zone: null, notes: null,
          actif: true, created_at: '', updated_at: '',
        } as Transporteur)}>
          + Nouveau transporteur
        </Button>
      </header>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher : référence · nom · téléphone · ville" className="pl-9" />
        </div>
        <Button variant={showInactive ? 'default' : 'outline'} size="sm" onClick={() => setShowInactive(s => !s)}>
          {showInactive ? 'Masquer inactifs' : 'Afficher inactifs'}
        </Button>
      </div>

      {list.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          Aucun transporteur {q ? 'trouvé' : 'enregistré'}.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="hidden md:grid grid-cols-[80px_1fr_140px_120px_70px_120px_60px] items-center gap-3 px-3 py-2 bg-secondary/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sticky top-0">
            <div>Réf</div><div>Nom</div><div>Téléphone</div><div>Ville</div><div>Départs</div><div>Dernier</div><div></div>
          </div>
          {filtered.map((t) => {
            const c = counts[t.reference] ?? { count: 0, last: null };
            return (
              <div key={t.id} className={`grid md:grid-cols-[80px_1fr_140px_120px_70px_120px_60px] grid-cols-1 gap-2 md:gap-3 px-3 py-3 border-t border-border text-sm items-center ${!t.actif ? 'opacity-60' : ''}`}>
                <div className="font-mono font-semibold">{t.reference}</div>
                <div className="font-medium">{t.nom}{!t.actif && <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">inactif</span>}</div>
                <div className="text-muted-foreground">{t.telephone_1}</div>
                <div>{t.ville}</div>
                <div>{c.count}</div>
                <div className="text-muted-foreground">{c.last ?? '—'}</div>
                <div className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing(t)}>
                        <Pencil className="w-4 h-4 mr-2" /> Modifier
                      </DropdownMenuItem>
                      {t.actif && (
                        <DropdownMenuItem onClick={async () => {
                          await deactivate.mutateAsync(t.id);
                          toast.success(`Transporteur Réf. ${t.reference} désactivé`);
                        }} className="text-destructive">
                          <Power className="w-4 h-4 mr-2" /> Désactiver
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EditDrawer
        transporteur={editing}
        onClose={() => setEditing(null)}
        onSave={async (data) => {
          if (!/^[0-9]{4}$/.test(data.reference)) {
            toast.error('Référence : 4 chiffres requis');
            return;
          }
          await upsert.mutateAsync(data);
          toast.success(`Transporteur Réf. ${data.reference} enregistré`);
          setEditing(null);
        }}
      />
    </div>
  );
}

function EditDrawer({
  transporteur, onClose, onSave,
}: {
  transporteur: Transporteur | null;
  onClose: () => void;
  onSave: (t: any) => Promise<void>;
}) {
  const open = !!transporteur;
  const [ref, setRef] = useState('');
  const [nom, setNom] = useState('');
  const [tel1, setTel1] = useState('');
  const [tel2, setTel2] = useState('');
  const [adr1, setAdr1] = useState('');
  const [adr2, setAdr2] = useState('');
  const [ville, setVille] = useState('Dakar');
  const [zone, setZone] = useState('');
  const [notes, setNotes] = useState('');

  useMemo(() => {
    if (transporteur) {
      setRef(transporteur.reference);
      setNom(transporteur.nom);
      setTel1(transporteur.telephone_1);
      setTel2(transporteur.telephone_2 ?? '');
      setAdr1(transporteur.adresse_1);
      setAdr2(transporteur.adresse_2 ?? '');
      setVille(transporteur.ville || 'Dakar');
      setZone(transporteur.zone ?? '');
      setNotes(transporteur.notes ?? '');
    }
  }, [transporteur]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>{transporteur?.id ? 'Modifier' : 'Nouveau'} transporteur</SheetTitle></SheetHeader>
        <div className="mt-5 space-y-3">
          <div><Label>Référence (4 chiffres) *</Label><Input value={ref} onChange={(e) => setRef(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} inputMode="numeric" disabled={!!transporteur?.id} /></div>
          <div><Label>Nom / Prénom *</Label><Input value={nom} onChange={(e) => setNom(e.target.value)} /></div>
          <div><Label>Téléphone principal *</Label><Input value={tel1} onChange={(e) => setTel1(e.target.value)} /></div>
          <div><Label>Téléphone secondaire</Label><Input value={tel2} onChange={(e) => setTel2(e.target.value)} /></div>
          <div><Label>Adresse principale *</Label><Input value={adr1} onChange={(e) => setAdr1(e.target.value)} /></div>
          <div><Label>Adresse secondaire</Label><Input value={adr2} onChange={(e) => setAdr2(e.target.value)} /></div>
          <div><Label>Ville *</Label><Input value={ville} onChange={(e) => setVille(e.target.value)} /></div>
          <div><Label>Zone / Quartier</Label><Input value={zone} onChange={(e) => setZone(e.target.value)} /></div>
          <div><Label>Notes internes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
          <div className="flex gap-2 pt-3">
            <Button variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
            <Button onClick={() => onSave({
              reference: ref, nom: nom.trim(), telephone_1: tel1.trim(),
              telephone_2: tel2.trim() || null, adresse_1: adr1.trim(), adresse_2: adr2.trim() || null,
              ville: ville.trim(), zone: zone.trim() || null, notes: notes.trim() || null,
            })} className="flex-1">Enregistrer</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
