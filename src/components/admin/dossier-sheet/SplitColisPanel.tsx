import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Split, Plus, Trash2, ArrowUpRight, ArrowLeft, Package, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  useDossierChildren, useDossierParent, useSplitDossier, useAddParcel,
  useMergeParcels, useUpdateParcel, type SplitPart,
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

/** Statuts proposés colis par colis (ordre de progression). */
const PARCEL_STATUSES = [
  'CONFIRMED', 'EN_RECHERCHE_DEPART', 'ASSIGNED', 'DEPARTURE_CONFIRMED',
  'COLLECTING', 'COLLECTED', 'WEIGHED', 'IN_TRANSIT', 'CUSTOMS',
  'ARRIVED_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CLOSED',
];

/** Liste des colis, suivi par colis, ajout / annulation / refusion. */
export function SplitColisPanel({ dossier }: { dossier: Dossier }) {
  const { open } = useDossierSheet();
  const { data: children = [] } = useDossierChildren(dossier.parent_dossier_id ? null : dossier.id);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const update = useUpdateParcel(dossier.id);
  const merge = useMergeParcels();

  if (dossier.parent_dossier_id) return null;

  const activeCount = children.filter((c) => !['CANCELLED', 'ARCHIVED'].includes(c.status)).length;

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Split className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-medium">Colis de l'envoi</p>
          {children.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{children.length} colis</Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => (children.length === 0 ? setDialogOpen(true) : setAddOpen(true))}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter un colis
        </Button>
      </div>

      {children.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Un seul colis. Ajoutez-en un second si l'envoi part avec plusieurs transporteurs.
        </p>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">
            Le statut de l'envoi suit automatiquement le colis le moins avancé.
          </p>
          <div className="space-y-2">
            {children.map((c) => {
              const cancelled = ['CANCELLED', 'ARCHIVED'].includes(c.status);
              return (
                <div
                  key={c.id}
                  className={`rounded-lg border p-2.5 space-y-2 ${cancelled ? 'border-border/60 bg-muted/30 opacity-70' : 'border-border bg-card'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => open(c.id)} className="text-left min-w-0 group">
                      <p className="text-xs font-medium truncate group-hover:text-primary">
                        Colis {c.split_index}/{c.split_count ?? children.length} — {c.product_description ?? 'Colis'}
                        <ArrowUpRight className="inline w-3 h-3 ml-1 text-muted-foreground" />
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {kg(c.actual_weight_kg ?? c.estimated_weight)} ·{' '}
                        {c.assigned_transporteur_ref ? `Transporteur ${c.assigned_transporteur_ref}` : 'Sans transporteur'}
                      </p>
                    </button>
                    <Badge variant="outline" className="text-[10px] shrink-0">{label(c.status)}</Badge>
                  </div>

                  {c.tracking_id && (
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(c.tracking_id!);
                        toast.success('Numéro de suivi copié');
                      }}
                      className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="w-3 h-3" /> {c.tracking_id}
                    </button>
                  )}

                  {!cancelled && (
                    <div className="flex items-center gap-2">
                      <Select
                        value={c.status}
                        onValueChange={(v) => update.mutate({ id: c.id, patch: { status: v } })}
                      >
                        <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PARCEL_STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">{label(s)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon" variant="ghost" className="h-8 w-8"
                        aria-label="Annuler ce colis"
                        onClick={() => update.mutate({ id: c.id, patch: { status: 'CANCELLED' } })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {activeCount <= 1 && (
            <Button
              size="sm" variant="ghost" className="w-full text-xs"
              disabled={merge.isPending}
              onClick={async () => {
                try {
                  await merge.mutateAsync(dossier.id);
                  toast.success('Envoi refusionné en un seul colis');
                } catch (e: any) {
                  toast.error(e?.message ?? 'Refusion impossible');
                }
              }}
            >
              Refusionner en un seul colis
            </Button>
          )}
        </>
      )}

      <SplitDialog dossier={dossier} open={dialogOpen} onOpenChange={setDialogOpen} />
      <AddParcelDialog dossier={dossier} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

/** Ajout d'un colis supplémentaire à un envoi déjà réparti. */
function AddParcelDialog({
  dossier, open, onOpenChange,
}: { dossier: Dossier; open: boolean; onOpenChange: (v: boolean) => void }) {
  const add = useAddParcel();
  const types = carrierTypesForMode((dossier.transport_mode as any) || 'gp');
  const [part, setPart] = useState<Part>({ description: '', weight: null });

  const submit = async () => {
    try {
      await add.mutateAsync({
        dossierId: dossier.id,
        part: {
          description: part.description?.trim() || undefined,
          weight: part.weight ?? null,
          transporteur_ref: (part.transporteur_ref || part.carrier_name)?.trim() || undefined,
        },
      });
      toast.success('Colis ajouté');
      setPart({ description: '', weight: null });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Plus className="w-4 h-4" /> Ajouter un colis
          </DialogTitle>
          <DialogDescription className="text-xs">
            Ce colis rejoint l'envoi {dossier.reference} avec sa propre référence et son propre suivi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-[11px]">Contenu</Label>
            <Input
              className="h-9" value={part.description ?? ''}
              onChange={(e) => setPart((p) => ({ ...p, description: e.target.value }))}
              placeholder="Ex. Carton chaussures"
            />
          </div>
          <div>
            <Label className="text-[11px]">Poids (kg)</Label>
            <Input
              className="h-9" type="number" inputMode="decimal" min={0} step="0.1"
              value={part.weight ?? ''}
              onChange={(e) => setPart((p) => ({ ...p, weight: e.target.value === '' ? null : Number(e.target.value) }))}
            />
          </div>
          <div>
            <Label className="text-[11px]">Transporteur / GP</Label>
            <CarrierPicker
              value={part.carrier_name ?? ''}
              valueRef={part.transporteur_ref ?? null}
              types={types}
              autoDetected={null}
              onChange={(name, ref) => setPart((p) => ({ ...p, carrier_name: name, transporteur_ref: ref ?? undefined }))}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={add.isPending}>Ajouter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SplitDialog({
  dossier, open, onOpenChange,
}: { dossier: Dossier; open: boolean; onOpenChange: (v: boolean) => void }) {
  const split = useSplitDossier();
  const total = Number(dossier.actual_weight_kg ?? dossier.estimated_weight ?? 0);
  const { data: autoCarrier } = useResolvedCarrier(dossier);
  const types = carrierTypesForMode((dossier.transport_mode as any) || 'gp');
  // Colis 1 = l'envoi déjà enregistré (poids et transporteur d'origine),
  // colis 2 = le nouveau colis à saisir.
  const [parts, setParts] = useState<Part[]>([
    { description: dossier.product_description ?? '', weight: total || null },
    { description: '', weight: null },
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
                  {i === 0 && (
                    <Badge variant="secondary" className="text-[10px] font-normal">Déjà enregistré</Badge>
                  )}
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
