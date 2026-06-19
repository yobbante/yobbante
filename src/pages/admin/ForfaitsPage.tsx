import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AdminOnlyGuard from '@/components/AdminOnlyGuard';
import { ratePerKgForCorridor } from '@/lib/startingPrice';

// Taux de conversion vers FCFA (XOF)
const CONVERSION_RATES: Record<string, number> = {
  XOF: 1,
  EUR: 655.957,
  USD: 600,
  GBP: 760,
  CAD: 440,
};

const CURRENCIES = ['XOF', 'EUR', 'USD', 'GBP', 'CAD'] as const;
const DESTINATIONS = [
  { code: 'ALL', label: 'Toutes destinations' },
  { code: 'FR', label: 'France' },
  { code: 'SN', label: 'Sénégal' },
  { code: 'CN', label: 'Chine' },
  { code: 'US', label: 'États-Unis' },
  { code: 'CA', label: 'Canada' },
];
const MODES = ['ALL', 'AIR', 'SEA', 'ROAD'] as const;

interface Forfait {
  id: string;
  nom: string;
  description: string | null;
  destination: string;
  mode: string;
  prix_fcfa: number;
  devise_originale: string;
  prix_devise_originale: number | null;
  taux_conversion: number | null;
  multiplicateur: number | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

function baseRateFor(destination: string, mode: string): number {
  // Si destination = ALL → on prend "autre" (rate par défaut).
  // Sinon on cherche le tarif corridor SN ↔ destination.
  const origin = destination === 'ALL' ? null : destination;
  // mode n'influe pas sur ratePerKgForCorridor — c'est un tarif corridor unique.
  void mode;
  return ratePerKgForCorridor(origin || 'FR', 'SN');
}

function ForfaitsPageInner() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'product_forfaits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_forfaits' as never)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as Forfait[]) || [];
    },
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Forfait | null>(null);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_forfaits' as never).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'product_forfaits'] });
      toast.success('Forfait supprimé');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, actif }: { id: string; actif: boolean }) => {
      const { error } = await supabase.from('product_forfaits' as never).update({ actif } as never).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'product_forfaits'] }),
  });

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tarifs forfaitaires produits</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Prix fixes par produit, destination et mode. Remplace le calcul au poids lorsqu'un client choisit ce produit.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-1.5" /> Nouveau forfait
        </Button>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Produit</th>
              <th className="text-left px-4 py-3">Destination</th>
              <th className="text-left px-4 py-3">Mode</th>
              <th className="text-right px-4 py-3">Prix</th>
              <th className="text-left px-4 py-3">Devise</th>
              <th className="text-right px-4 py-3">Multiplicateur</th>
              <th className="text-center px-4 py-3">Actif</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Chargement…</td></tr>
            ) : !data?.length ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                Aucun forfait. Créez-en un pour commencer.
              </td></tr>
            ) : data.map(f => (
              <tr key={f.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{f.nom}</td>
                <td className="px-4 py-3">{f.destination}</td>
                <td className="px-4 py-3">{f.mode}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">
                  {f.prix_fcfa.toLocaleString('fr-FR')} FCFA
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {f.devise_originale}
                  {f.devise_originale !== 'XOF' && f.prix_devise_originale && (
                    <> · {f.prix_devise_originale} {f.devise_originale}</>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {f.multiplicateur ? `×${Number(f.multiplicateur).toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <Switch
                    checked={f.actif}
                    onCheckedChange={(v) => toggleActive.mutate({ id: f.id, actif: v })}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(f); setOpen(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      if (confirm(`Supprimer "${f.nom}" ?`)) remove.mutate(f.id);
                    }}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ForfaitDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ['admin', 'product_forfaits'] })}
      />
    </div>
  );
}

function ForfaitDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Forfait | null;
  onSaved: () => void;
}) {
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [destination, setDestination] = useState('ALL');
  const [mode, setMode] = useState<string>('ALL');
  const [devise, setDevise] = useState<string>('XOF');
  const [prixDevise, setPrixDevise] = useState<string>('');
  const [actif, setActif] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNom(editing.nom);
      setDescription(editing.description ?? '');
      setDestination(editing.destination);
      setMode(editing.mode);
      setDevise(editing.devise_originale);
      setPrixDevise(String(editing.prix_devise_originale ?? editing.prix_fcfa));
      setActif(editing.actif);
    } else {
      setNom(''); setDescription(''); setDestination('ALL'); setMode('ALL');
      setDevise('XOF'); setPrixDevise(''); setActif(true);
    }
  }, [open, editing]);

  const prixNum = Number(prixDevise) || 0;
  const taux = CONVERSION_RATES[devise] ?? 1;
  const prixFcfa = Math.round(prixNum * taux);
  const baseRate = useMemo(() => baseRateFor(destination, mode), [destination, mode]);
  const multiplicateur = baseRate > 0 ? prixFcfa / baseRate : 0;

  const canSave = nom.trim() && prixNum > 0;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    const payload = {
      nom: nom.trim(),
      description: description.trim() || null,
      destination, mode,
      prix_fcfa: prixFcfa,
      devise_originale: devise,
      prix_devise_originale: prixNum,
      taux_conversion: taux,
      multiplicateur: Number(multiplicateur.toFixed(4)),
      actif,
    };
    const q = editing
      ? supabase.from('product_forfaits' as never).update(payload as never).eq('id', editing.id)
      : supabase.from('product_forfaits' as never).insert(payload as never);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? 'Forfait mis à jour' : 'Forfait créé');
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Modifier le forfait' : 'Nouveau forfait'}</DialogTitle>
          <DialogDescription>
            Tarif fixe appliqué à la place du calcul au poids quand le client choisit ce produit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nom du produit *</Label>
            <Input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex : Chaussures" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder="Ex : Paire de chaussures jusqu'à 2 kg" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Destination</Label>
              <Select value={destination} onValueChange={setDestination}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DESTINATIONS.map(d => <SelectItem key={d.code} value={d.code}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODES.map(m => <SelectItem key={m} value={m}>{m === 'ALL' ? 'Tous modes' : m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-[1fr,120px] gap-3">
            <div>
              <Label className="text-xs">Prix *</Label>
              <Input type="number" min={0} value={prixDevise}
                onChange={e => setPrixDevise(e.target.value)} placeholder="20" />
            </div>
            <div>
              <Label className="text-xs">Devise</Label>
              <Select value={devise} onValueChange={setDevise}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {devise !== 'XOF' && prixNum > 0 && (
            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              Conversion : <strong className="text-foreground">{prixNum} {devise}</strong>
              {' = '}
              <strong className="text-foreground">{prixFcfa.toLocaleString('fr-FR')} FCFA</strong>
              {' '} (taux {taux})
            </div>
          )}

          <div className="rounded-lg border border-border p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tarif de base ({destination} / {mode})</span>
              <span className="tabular-nums font-medium">{baseRate.toLocaleString('fr-FR')} FCFA/kg</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">Multiplicateur calculé</span>
              <span className="tabular-nums font-bold text-primary">
                {multiplicateur > 0 ? `×${multiplicateur.toFixed(3)}` : '—'}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground italic">
              Information interne — non visible côté client.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label className="text-sm">Forfait actif</Label>
            <Switch checked={actif} onCheckedChange={setActif} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={save} disabled={!canSave || saving}>
            {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ForfaitsPage() {
  return (
    <AdminOnlyGuard>
      <ForfaitsPageInner />
    </AdminOnlyGuard>
  );
}
