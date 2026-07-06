import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Globe2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from '@/components/ui/dialog';
import { useCustomCities, type CustomCityAdmin } from '@/hooks/useCustomCities';
import { useSeo } from '@/hooks/useSeo';
import { ALL_CITIES } from '@/lib/worldCities';

interface Props {
  /** When rendered as a dialog from another page. */
  embedded?: boolean;
}

export function CustomCitiesManager({ embedded }: Props = {}) {
  const { addCustomCity, deleteCustomCity, listAll } = useCustomCities();
  const [rows, setRows] = useState<CustomCityAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [city, setCity] = useState('');
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [flag, setFlag] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listAll());
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [listAll]);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!city.trim() || !code.trim() || !label.trim()) {
      toast.error('Ville, code pays et libellé pays sont obligatoires');
      return;
    }
    setSubmitting(true);
    try {
      await addCustomCity({ city, country_code: code, country_label: label, flag: flag || undefined });
      toast.success(`Ville ajoutée : ${city.trim()}`);
      setCity(''); setCode(''); setLabel(''); setFlag('');
      setCreating(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(row: CustomCityAdmin) {
    if (!confirm(`Retirer ${row.city} (${row.countryLabel}) du catalogue ?\n\nLa ville sera masquée des listes de départs. Les départs existants ne sont pas modifiés.`)) return;
    try {
      await deleteCustomCity(row.rowId);
      toast.success('Ville retirée');
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur');
    }
  }

  const active = rows.filter((r) => r.active);
  const inactive = rows.filter((r) => !r.active);

  const body = (
    <>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm text-muted-foreground">
            36 villes standard toujours disponibles. Ajoutez ici les destinations hors liste.
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Standard : {ALL_CITIES.length - 1} villes · Custom actives : {active.length}
          </p>
        </div>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Ajouter une ville</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle ville personnalisée</DialogTitle>
              <DialogDescription>
                Elle apparaîtra dans le sélecteur de villes des départs (en plus des 36 villes standard).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Ville *</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex : Bamako" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Code pays ISO (2 lettres) *</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={2} placeholder="ML" />
                </div>
                <div>
                  <Label>Emoji drapeau</Label>
                  <Input value={flag} onChange={(e) => setFlag(e.target.value)} placeholder="🇲🇱" />
                </div>
              </div>
              <div>
                <Label>Nom du pays *</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Mali" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreating(false)}>Annuler</Button>
              <Button onClick={submit} disabled={submitting}>Ajouter</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Chargement…</div>
      ) : active.length === 0 ? (
        <div className="rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
          Aucune ville personnalisée. Seules les 36 villes standard sont proposées.
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium">Drapeau</th>
                <th className="px-4 py-2 font-medium">Ville</th>
                <th className="px-4 py-2 font-medium">Pays</th>
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {active.map((r) => (
                <tr key={r.rowId} className="border-t border-border">
                  <td className="px-4 py-2 text-xl">{r.flag}</td>
                  <td className="px-4 py-2 font-medium">{r.city}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.countryLabel}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.country}</td>
                  <td className="px-4 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => remove(r)} className="gap-1 text-destructive hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" /> Retirer
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inactive.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-muted-foreground cursor-pointer">Villes archivées ({inactive.length})</summary>
          <ul className="mt-2 text-xs text-muted-foreground space-y-1">
            {inactive.map((r) => (
              <li key={r.rowId}>{r.flag} {r.city} · {r.countryLabel}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  );

  if (embedded) return <div className="space-y-4">{body}</div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3 sticky top-0 z-10 bg-background/95 backdrop-blur">
        <Link to="/admin/departs-semaine" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2">
          <Globe2 className="w-4 h-4" />
          <div>
            <h1 className="text-lg font-bold">Villes personnalisées</h1>
            <p className="text-xs text-muted-foreground">Catalogue en complément des 36 villes standard</p>
          </div>
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-6 py-6">{body}</div>
    </div>
  );
}

export default function CustomCitiesPage() {
  useSeo({ title: 'Villes personnalisées · Admin Yobbanté', path: '/admin/villes' });
  return <CustomCitiesManager />;
}
