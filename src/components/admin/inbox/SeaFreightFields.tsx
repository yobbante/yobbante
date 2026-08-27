import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, Ship, Paperclip, X, AlertTriangle, Clock } from 'lucide-react';
import {
  SEA_CITIES, SEA_WM_HINT, estimateSeaFreight, findSeaZone, fmtFcfaSea,
  seaTransitLabel, type ContainerSize, type SeaShipmentType,
} from '@/lib/seaFreight';

export interface SeaFieldsValue {
  sea_city: string;
  sea_type: SeaShipmentType;
  weight_kg: string;
  sea_volume_m3: string;
  sea_length_cm: string;
  sea_width_cm: string;
  sea_height_cm: string;
  sea_containers: string;
  sea_container_size: ContainerSize;
  description: string;
  declared_value: string;
}

interface Props {
  value: SeaFieldsValue;
  update: (patch: Partial<SeaFieldsValue>) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
}

/**
 * Bloc de saisie du mode Maritime (LCL groupage / FCL conteneur) — usage ADMIN.
 * Produit une ESTIMATION INDICATIVE, jamais un prix ferme payable.
 */
export function SeaFreightFields({ value, update, files, onFilesChange }: Props) {
  const zone = useMemo(() => findSeaZone(value.sea_city), [value.sea_city]);
  const isFcl = value.sea_type === 'fcl';

  const estimate = useMemo(
    () => estimateSeaFreight({
      zone,
      type: value.sea_type,
      realKg: parseFloat(value.weight_kg),
      volumeM3: parseFloat(value.sea_volume_m3),
      lengthCm: parseFloat(value.sea_length_cm),
      widthCm: parseFloat(value.sea_width_cm),
      heightCm: parseFloat(value.sea_height_cm),
      containers: parseFloat(value.sea_containers),
      containerSize: value.sea_container_size,
    }),
    [zone, value.sea_type, value.weight_kg, value.sea_volume_m3, value.sea_length_cm,
      value.sea_width_cm, value.sea_height_cm, value.sea_containers, value.sea_container_size],
  );

  return (
    <div className="space-y-3">
      <div className="rounded-[10px] border border-border bg-secondary/60 p-3 text-xs">
        <div className="flex items-start gap-2">
          <Ship className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Maritime — mode interne (non ouvert au public)</p>
            <p className="text-muted-foreground mt-0.5">
              Le dossier sera créé au statut <strong>Devis à confirmer</strong> : aucune estimation
              n'est engageante tant que les documents ne sont pas vérifiés.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs">Ville / port desservi (maritime)</Label>
          <select
            className="h-10 w-full rounded-md border bg-background px-2 text-sm"
            value={value.sea_city}
            onChange={e => update({ sea_city: e.target.value })}
          >
            <option value="">Sélectionner…</option>
            {SEA_CITIES.map(c => (
              <option key={c.city} value={c.city}>{c.city} — {c.zoneLabel}</option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {zone && <Badge variant="outline" className="text-[11px]">{zone.label}</Badge>}
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> {seaTransitLabel(zone)}
            </span>
          </div>
        </div>

        <div className="col-span-2">
          <Label className="text-xs">Type d'envoi</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {([
              { id: 'lcl' as const, label: 'Groupage (LCL)', desc: 'Petits volumes · facturé au m³ (règle W/M)' },
              { id: 'fcl' as const, label: 'Conteneur complet (FCL)', desc: 'Gros volumes · facturé au conteneur' },
            ]).map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => update({ sea_type: t.id })}
                className={`p-2.5 rounded-lg border-2 text-left transition-all ${
                  value.sea_type === t.id ? 'border-primary bg-primary/10' : 'border-border'
                }`}
              >
                <div className="text-xs font-medium">{t.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {!isFcl && (
          <>
            <div>
              <Label className="text-xs">Poids réel (kg)</Label>
              <Input
                type="number" min="0" step="0.1"
                value={value.weight_kg}
                onChange={e => update({ weight_kg: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Volume (m³)</Label>
              <Input
                type="number" min="0" step="0.01"
                value={value.sea_volume_m3}
                onChange={e => update({ sea_volume_m3: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Ou dimensions (cm) — volume calculé automatiquement</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <Input type="number" min="0" placeholder="Longueur"
                  value={value.sea_length_cm} onChange={e => update({ sea_length_cm: e.target.value })} />
                <Input type="number" min="0" placeholder="Largeur"
                  value={value.sea_width_cm} onChange={e => update({ sea_width_cm: e.target.value })} />
                <Input type="number" min="0" placeholder="Hauteur"
                  value={value.sea_height_cm} onChange={e => update({ sea_height_cm: e.target.value })} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-start gap-1">
                <Info className="w-3 h-3 mt-[2px] shrink-0" />
                {SEA_WM_HINT}
              </p>
            </div>
          </>
        )}

        {isFcl && (
          <>
            <div>
              <Label className="text-xs">Nombre de conteneurs</Label>
              <Input
                type="number" min="1" step="1"
                value={value.sea_containers}
                onChange={e => update({ sea_containers: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Taille</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                value={value.sea_container_size}
                onChange={e => update({ sea_container_size: e.target.value as ContainerSize })}
              >
                <option value="20">20 pieds</option>
                <option value="40">40 pieds</option>
              </select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Volume total estimé (m³) — si le client hésite sur la taille</Label>
              <Input
                type="number" min="0" step="0.1"
                value={value.sea_volume_m3}
                onChange={e => update({ sea_volume_m3: e.target.value })}
              />
            </div>
          </>
        )}

        <div>
          <Label className="text-xs">Valeur déclarée (€)</Label>
          <Input
            type="number" min="0"
            value={value.declared_value}
            onChange={e => update({ declared_value: e.target.value })}
          />
        </div>

        <div className="col-span-2">
          <Label className="text-xs">Description précise de la marchandise</Label>
          <Textarea
            rows={2}
            value={value.description}
            onChange={e => update({ description: e.target.value })}
            placeholder="Nature, quantité, conditionnement…"
          />
        </div>

        <div className="col-span-2">
          <Label className="text-xs">Documents (facture commerciale, liste de colisage, photos)</Label>
          <Input
            type="file" multiple
            className="mt-1"
            onChange={e => onFilesChange([...files, ...Array.from(e.target.files ?? [])])}
          />
          {files.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-1.5 text-[11px]">
                  <Paperclip className="w-3 h-3 shrink-0" />
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    aria-label={`Retirer ${f.name}`}
                    onClick={() => onFilesChange(files.filter((_, idx) => idx !== i))}
                    className="ml-auto"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Card className="p-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Estimation indicative — {isFcl ? 'conteneur complet (FCL)' : 'groupage (LCL)'}
        </div>
        {estimate.price != null ? (
          <div className="text-lg font-semibold mt-0.5">environ {fmtFcfaSea(estimate.price)}</div>
        ) : (
          <div className="text-sm font-medium mt-0.5">—</div>
        )}
        <p className="text-[11px] text-muted-foreground mt-1">{estimate.detail}</p>
        {!isFcl && (estimate.realKg != null || estimate.volumeM3 != null) && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Poids réel : {estimate.realKg ?? '—'} kg · Volume : {estimate.volumeM3 ?? '—'} m³ (1 t = 1 m³)
          </p>
        )}
        <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
          <Clock className="w-3 h-3" /> {seaTransitLabel(zone)}
        </p>

        {isFcl ? (
          <div className="mt-2 rounded-[10px] border border-amber-500/50 bg-amber-500/10 p-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
              {estimate.disclaimer}
            </p>
          </div>
        ) : (
          <p className="text-[11px] mt-1.5 font-medium">{estimate.disclaimer}</p>
        )}
      </Card>
    </div>
  );
}
