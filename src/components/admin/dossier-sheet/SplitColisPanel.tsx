import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Split, Plus, Trash2, ArrowUpRight, ArrowLeft, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  useDossierChildren, useDossierParent, useSplitDossier, type SplitPart,
} from '@/hooks/useDossierSplit';
import { useDossierSheet } from './useDossierSheet';
import { formatStatusLabel } from '@/lib/statusLabels';
import { CarrierPicker } from '@/components/admin/payments/CarrierPicker';
import { useResolvedCarrier, carrierTypesForMode } from '@/hooks/useCarrierDirectory';

interface Dossier {
  id: string;
  reference: string;
  product_description?: string | null;
  estimated_weight?: number | null;
  actual_weight_kg?: number | null;
  parent_dossier_id?: string | null;
  split_index?: number | null;
  split_count?: number | null;
  assigned_transporteur_ref?: string | null;
  gp_id?: string | null;
  transport_mode?: string | null;
}

/** Part locale : on garde le nom affiché en plus de la référence enregistrée. */
type Part = SplitPart & { carrier_name?: string };

const label = (s: string) => formatStatusLabel(s);
const kg = (n: number | null | undefined) => (n == null ? '—' : `${Number(n)} kg`);

/** Bandeau affiché sur un sous-colis, avec retour au dossier parent. */
export function SplitChildBanner({ dossier }: { dossier: Dossier }) {
  const { open } = useDossierSheet();
  const { data: parent } = useDossierParent(dossier.parent_dossier_id);
  if (!dossier.parent_dossier_id) return null;
  return (
    <button
      onClick={() => open(dossier.parent_dossier_id!)}
      className="w-full text-left rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 flex items-center gap-2 hover:bg-primary/10 transition-colors"
    >
      <ArrowLeft className="w-4 h-4 text-primary shrink-0" />
      <span className="text-xs text-foreground">
        Colis {dossier.split_index ?? '?'}/{dossier.split_count ?? '?'} du dossier{' '}
        <span className="font-mono">{parent?.reference ?? '…'}</span>
      </span>
    </button>
  );
}

/** Liste des sous-colis + création du split. */
export function SplitColisPanel({ dossier }: { dossier: Dossier }) {
  const { open } = useDossierSheet();
  const { data: children = [] } = useDossierChildren(dossier.parent_dossier_id ? null : dossier.id);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (dossier.parent_dossier_id) return null;

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Split className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-medium">Répartition en plusieurs colis</p>
          {children.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{children.length} colis</Badge>
          )}
        </div>
        {children.length === 0 && (
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            <Split className="w-3.5 h-3.5 mr-1" /> Scinder
          </Button>
        )}
      </div>

      {children.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Un seul colis. Scindez si l'envoi part avec plusieurs transporteurs différents.
        </p>
      ) : (
        <div className="space-y-2">
          {children.map((c) => (
            <button
              key={c.id}
              onClick={() => open(c.id)}
              className="w-full text-left rounded-lg border border-border bg-card p-2.5 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">
                    <span className="font-mono text-[11px] text-muted-foreground">{c.reference}</span>{' '}
                    {c.product_description ?? 'Colis'}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {kg(c.actual_weight_kg ?? c.estimated_weight)} ·{' '}
                    {c.assigned_transporteur_ref ? `GP ${c.assigned_transporteur_ref}` : 'Sans transporteur'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="outline" className="text-[10px]">{label(c.status)}</Badge>
                  <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <SplitDialog dossier={dossier} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function SplitDialog({
  dossier, open, onOpenChange,
}: { dossier: Dossier; open: boolean; onOpenChange: (v: boolean) => void }) {
  const split = useSplitDossier();
  const total = Number(dossier.actual_weight_kg ?? dossier.estimated_weight ?? 0);
  const { data: autoCarrier } = useResolvedCarrier(dossier);
  const types = carrierTypesForMode((dossier.transport_mode as any) || 'gp');
  const [parts, setParts] = useState<Part[]>([
    { description: dossier.product_description ?? '', weight: total ? total / 2 : null },
    { description: dossier.product_description ?? '', weight: total ? total / 2 : null },
  ]);

  // Le transporteur déjà assigné au dossier pré-remplit le premier colis.
  useEffect(() => {
    if (!autoCarrier) return;
    setParts((p) =>
      p.map((x, i) =>
        i === 0 && !x.transporteur_ref && !x.carrier_name
          ? { ...x, transporteur_ref: autoCarrier.ref ?? undefined, carrier_name: autoCarrier.name }
          : x,
      ),
    );
  }, [autoCarrier]);

  const set = (i: number, patch: Partial<Part>) =>
    setParts((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const submit = async () => {
    try {
      await split.mutateAsync({
        dossierId: dossier.id,
        parts: parts.map((p) => ({
          description: p.description?.trim() || undefined,
          weight: p.weight ?? null,
          transporteur_ref: (p.transporteur_ref || p.carrier_name)?.trim() || undefined,
        })),
      });
      toast.success(`${parts.length} colis créés`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur lors du split');
    }
  };

  const sum = parts.reduce((s, p) => s + Number(p.weight ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Split className="w-4 h-4" /> Scinder {dossier.reference}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Chaque colis aura sa propre référence, son poids, son transporteur et son suivi.
            Le montant client est réparti au prorata du poids.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {parts.map((p, i) => (
            <div key={i} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" /> Colis {i + 1}
                </p>
                {parts.length > 2 && (
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => setParts((x) => x.filter((_, j) => j !== i))}
                    aria-label="Retirer ce colis"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              <div>
                <Label className="text-[11px]">Contenu</Label>
                <Input
                  className="h-9"
                  value={p.description ?? ''}
                  onChange={(e) => set(i, { description: e.target.value })}
                  placeholder="Ex. Cartons vêtements"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px]">Poids (kg)</Label>
                  <Input
                    className="h-9" type="number" inputMode="decimal" min={0} step="0.1"
                    value={p.weight ?? ''}
                    onChange={(e) => set(i, { weight: e.target.value === '' ? null : Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-[11px]">Transporteur / GP</Label>
                <CarrierPicker
                  value={p.carrier_name ?? ''}
                  valueRef={p.transporteur_ref ?? null}
                  types={types}
                  autoDetected={i === 0 ? autoCarrier ?? null : autoCarrier ?? null}
                  onChange={(name, ref) => set(i, { carrier_name: name, transporteur_ref: ref ?? undefined })}
                />
              </div>
            </div>
          ))}

          <Button
            variant="outline" size="sm" className="w-full"
            onClick={() => setParts((p) => [...p, { description: '', weight: null }])}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter un colis
          </Button>

          <p className="text-[11px] text-muted-foreground">
            Total réparti : {sum || 0} kg{total ? ` · poids du dossier : ${total} kg` : ''}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={split.isPending || parts.length < 2}>
            Créer {parts.length} colis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
