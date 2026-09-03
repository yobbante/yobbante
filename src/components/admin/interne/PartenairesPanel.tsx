import { useMemo, useState } from 'react';
import { Plus, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { AIR_ZONES } from '@/lib/airFreight';
import { SEA_ZONES } from '@/lib/seaFreight';
import { usePartenaires, usePartenaireMutations, type Partenaire } from '@/hooks/useInternalWorkspace';

export const CHANTIERS: Record<string, string> = {
  aerien: 'Aérien',
  maritime: 'Maritime',
  transit_iex: 'Transit / Import-Export',
  achat_vehicules: 'Achat véhicules',
};

const STATUTS: Record<string, string> = {
  a_contacter: 'À contacter',
  contacte: 'Contacté',
  negociation: 'En négociation',
  tarif_obtenu: 'Tarif obtenu',
};

const STATUT_CLS: Record<string, string> = {
  a_contacter: 'bg-muted text-muted-foreground',
  contacte: 'bg-blue-500/10 text-blue-600',
  negociation: 'bg-amber-500/10 text-amber-600',
  tarif_obtenu: 'bg-emerald-500/10 text-emerald-600',
};

/** Zones réelles du système, selon le chantier. */
function zonesFor(chantier: string) {
  if (chantier === 'maritime') return SEA_ZONES.map(z => ({ code: `sea:${z.id}`, label: `Maritime ${z.label}` }));
  if (chantier === 'aerien') return AIR_ZONES.map(z => ({ code: `air:${z.id}`, label: `Aérien ${z.label}` }));
  return [];
}

/** Lien direct vers la grille de prix concernée. */
function gridLink(p: Partenaire): string | null {
  if (p.chantier === 'aerien') return '/admin/dossiers?tab=aerien';
  if (p.chantier === 'maritime') return '/admin/dossiers?tab=maritime';
  return null;
}

const EMPTY: Partial<Partenaire> = {
  chantier: 'aerien', nom: '', contact: '', specialite: '', statut: 'a_contacter',
  zone_code: null, zone_label: null, ville: '', tarif_obtenu: '', tarif_montant: null, notes: '',
};

export function PartenairesPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { data: rows = [], isLoading } = usePartenaires();
  const { savePartenaire } = usePartenaireMutations();
  const [fChantier, setFChantier] = useState('all');
  const [fStatut, setFStatut] = useState('all');
  const [editing, setEditing] = useState<Partial<Partenaire> | null>(null);

  const filtered = useMemo(() => rows.filter(r =>
    (fChantier === 'all' || r.chantier === fChantier) && (fStatut === 'all' || r.statut === fStatut),
  ), [rows, fChantier, fStatut]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={fChantier} onValueChange={setFChantier}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les chantiers</SelectItem>
            {Object.entries(CHANTIERS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fStatut} onValueChange={setFStatut}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUTS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        {!readOnly && (
          <Button size="sm" className="ml-auto" onClick={() => setEditing({ ...EMPTY })}>
            <Plus className="w-4 h-4 mr-1" /> Fiche partenaire
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">Aucune fiche partenaire.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <div key={p.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <button className="text-left min-w-0 flex-1" onClick={() => !readOnly && setEditing(p)}>
                  <p className="text-sm font-medium text-foreground truncate">{p.nom}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {CHANTIERS[p.chantier] ?? p.chantier}
                    {p.zone_label ? ` · ${p.zone_label}` : ''}
                    {p.ville ? ` · ${p.ville}` : ''}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge variant="secondary" className={STATUT_CLS[p.statut]}>{STATUTS[p.statut] ?? p.statut}</Badge>
                    {p.specialite && <span className="text-[11px] text-muted-foreground">{p.specialite}</span>}
                    {p.contact && <span className="text-[11px] text-muted-foreground">{p.contact}</span>}
                    {(p.tarif_obtenu || p.tarif_montant) && (
                      <span className="text-[11px] font-medium text-emerald-600">
                        Tarif : {p.tarif_obtenu || `${Number(p.tarif_montant).toLocaleString('fr-FR')} ${p.devise ?? 'XOF'}`}
                      </span>
                    )}
                  </div>
                </button>
                {(p.tarif_obtenu || p.tarif_montant) && gridLink(p) && (
                  <a
                    href={gridLink(p)!}
                    className="text-[11px] inline-flex items-center gap-1 text-primary hover:underline shrink-0"
                  >
                    Grille <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              {p.notes && <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{p.notes}</p>}
            </div>
          ))}
        </div>
      )}

      <Sheet open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{editing?.id ? 'Modifier la fiche' : 'Nouvelle fiche partenaire'}</SheetTitle></SheetHeader>
          {editing && (
            <div className="space-y-3 mt-4">
              <Select
                value={editing.chantier}
                onValueChange={v => setEditing({ ...editing, chantier: v, zone_code: null, zone_label: null })}
              >
                <SelectTrigger><SelectValue placeholder="Chantier" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CHANTIERS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>

              {zonesFor(editing.chantier ?? 'aerien').length > 0 && (
                <Select
                  value={editing.zone_code ?? ''}
                  onValueChange={v => {
                    const z = zonesFor(editing.chantier ?? 'aerien').find(x => x.code === v);
                    setEditing({ ...editing, zone_code: v, zone_label: z?.label ?? null });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Zone rattachée" /></SelectTrigger>
                  <SelectContent>
                    {zonesFor(editing.chantier ?? 'aerien').map(z => (
                      <SelectItem key={z.code} value={z.code}>{z.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Input placeholder="Ville" value={editing.ville ?? ''} onChange={e => setEditing({ ...editing, ville: e.target.value })} />
              <Input placeholder="Nom du partenaire" value={editing.nom ?? ''} onChange={e => setEditing({ ...editing, nom: e.target.value })} />
              <Input placeholder="Contact (tel / email)" value={editing.contact ?? ''} onChange={e => setEditing({ ...editing, contact: e.target.value })} />
              <Input placeholder="Spécialité" value={editing.specialite ?? ''} onChange={e => setEditing({ ...editing, specialite: e.target.value })} />

              <Select value={editing.statut} onValueChange={v => setEditing({ ...editing, statut: v })}>
                <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUTS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>

              <Input placeholder="Tarif obtenu (texte libre)" value={editing.tarif_obtenu ?? ''} onChange={e => setEditing({ ...editing, tarif_obtenu: e.target.value })} />
              <Input
                type="number" placeholder="Montant (XOF)"
                value={editing.tarif_montant ?? ''}
                onChange={e => setEditing({ ...editing, tarif_montant: e.target.value === '' ? null : Number(e.target.value) })}
              />
              <Textarea placeholder="Notes" value={editing.notes ?? ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} />

              <Button
                className="w-full"
                disabled={savePartenaire.isPending || !(editing.nom ?? '').trim()}
                onClick={async () => {
                  try {
                    await savePartenaire.mutateAsync(editing);
                    toast({ title: 'Fiche enregistrée' });
                    setEditing(null);
                  } catch (e) {
                    toast({ title: 'Erreur', description: (e as Error).message, variant: 'destructive' });
                  }
                }}
              >
                {savePartenaire.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
