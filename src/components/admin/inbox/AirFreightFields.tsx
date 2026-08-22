import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, Plane, Paperclip, X } from 'lucide-react';
import {
  AIR_CITIES, AIR_QUOTE_DISCLAIMER, AIR_VOLUMETRIC_HINT,
  estimateAirFreight, findAirZone, fmtFcfaAir,
} from '@/lib/airFreight';

export interface AirFieldsValue {
  air_city: string;
  weight_kg: string;
  air_length_cm: string;
  air_width_cm: string;
  air_height_cm: string;
  description: string;
  declared_value: string;
}

interface Props {
  value: AirFieldsValue;
  update: (patch: Partial<AirFieldsValue>) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
}

/**
 * Bloc de saisie du mode Aérien (fret classique) — usage ADMIN interne.
 * Produit une ESTIMATION INDICATIVE, jamais un prix ferme payable.
 */
export function AirFreightFields({ value, update, files, onFilesChange }: Props) {
  const zone = useMemo(() => findAirZone(value.air_city), [value.air_city]);

  const estimate = useMemo(
    () => estimateAirFreight({
      zone,
      realKg: parseFloat(value.weight_kg),
      lengthCm: parseFloat(value.air_length_cm),
      widthCm: parseFloat(value.air_width_cm),
      heightCm: parseFloat(value.air_height_cm),
    }),
    [zone, value.weight_kg, value.air_length_cm, value.air_width_cm, value.air_height_cm],
  );

  return (
    <div className="space-y-3">
      <div className="rounded-[10px] border border-border bg-secondary/60 p-3 text-xs">
        <div className="flex items-start gap-2">
          <Plane className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Aérien — mode interne (non ouvert au public)</p>
            <p className="text-muted-foreground mt-0.5">
              Le dossier sera créé au statut <strong>Devis à confirmer</strong> : aucune estimation
              n'est engageante tant que les documents ne sont pas vérifiés.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs">Ville desservie (aérien)</Label>
          <select
            className="h-10 w-full rounded-md border bg-background px-2 text-sm"
            value={value.air_city}
            onChange={e => update({ air_city: e.target.value })}
          >
            <option value="">Sélectionner…</option>
            {AIR_CITIES.map(c => (
              <option key={c.city} value={c.city}>{c.city} — {c.zoneLabel}</option>
            ))}
          </select>
          {zone && (
            <Badge variant="outline" className="mt-1 text-[11px]">{zone.label}</Badge>
          )}
        </div>

        <div>
          <Label className="text-xs">Poids réel (kg)</Label>
          <Input
            type="number" min="0" step="0.1"
            value={value.weight_kg}
            onChange={e => update({ weight_kg: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Valeur déclarée (€)</Label>
          <Input
            type="number" min="0"
            value={value.declared_value}
            onChange={e => update({ declared_value: e.target.value })}
          />
        </div>

        <div className="col-span-2">
          <Label className="text-xs">Dimensions du colis (cm)</Label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <Input type="number" min="0" placeholder="Longueur"
              value={value.air_length_cm} onChange={e => update({ air_length_cm: e.target.value })} />
            <Input type="number" min="0" placeholder="Largeur"
              value={value.air_width_cm} onChange={e => update({ air_width_cm: e.target.value })} />
            <Input type="number" min="0" placeholder="Hauteur"
              value={value.air_height_cm} onChange={e => update({ air_height_cm: e.target.value })} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-start gap-1">
            <Info className="w-3 h-3 mt-[2px] shrink-0" />
            {AIR_VOLUMETRIC_HINT}
          </p>
        </div>

        <div className="col-span-2">
          <Label className="text-xs">Description précise de la marchandise</Label>
          <Textarea
            rows={2}
            value={value.description}
            onChange={e => update({ description: e.target.value })}
            placeholder="Nature exacte, quantité, conditionnement…"
          />
        </div>

        <div className="col-span-2">
          <Label className="text-xs">Documents (optionnel) — facture commerciale, photos du colis</Label>
          <Input
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={e => onFilesChange([...files, ...Array.from(e.target.files ?? [])])}
            className="mt-1"
          />
          {files.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-[11px] text-muted-foreground">
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
          Estimation indicative
        </div>
        {estimate.price != null ? (
          <div className="text-lg font-semibold mt-0.5">
            environ {fmtFcfaAir(estimate.price)}
          </div>
        ) : (
          <div className="text-sm font-medium mt-0.5">
            {estimate.manualQuote ? 'Devis sur mesure' : '—'}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-1">{estimate.detail}</p>
        {(estimate.realKg != null || estimate.volumetricKg != null) && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Poids réel : {estimate.realKg ?? '—'} kg · Poids volumétrique :{' '}
            {estimate.volumetricKg ?? '—'} kg (L×l×H ÷ 6000)
          </p>
        )}
        <p className="text-[11px] mt-1.5 font-medium">{AIR_QUOTE_DISCLAIMER}</p>
      </Card>
    </div>
  );
}
