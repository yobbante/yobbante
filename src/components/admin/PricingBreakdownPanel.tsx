// Panneau de décomposition tarifaire — ADMIN UNIQUEMENT.
// Affiche tarif GP brut, marge, enlèvement, hors-Dakar, total client,
// coût GP, marge nette. Ces infos ne doivent JAMAIS être visibles côté client.

import { formatFcfa, YOBBANTE_MARGIN_PCT, ENLEVEMENT_INTEGRE } from '@/lib/yobbantePricing';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  gpRatePerKg?: number | null;
  yobbanteMarginPct?: number | null;
  enlevementAmount?: number | null;
  horsDakarSurcharge?: number | null;
  deliveryCarrierCost?: number | null;
  displayedPricePerKg?: number | null;
  totalDisplayedPrice?: number | null;
  totalCostPrice?: number | null;
  yobbanteGrossMargin?: number | null;
  weightKg?: number | null;
  isExpress?: boolean;
  isEstimate?: boolean;
}

export default function PricingBreakdownPanel(props: Props) {
  const [visible, setVisible] = useState(false);

  const marginPct = (props.yobbanteMarginPct ?? YOBBANTE_MARGIN_PCT) * 100;
  const enlevement = props.enlevementAmount ?? ENLEVEMENT_INTEGRE;
  const hd = props.horsDakarSurcharge ?? 0;
  const gpRate = props.gpRatePerKg ?? 0;
  const margePerKg = gpRate * (marginPct / 100);

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
          <Lock className="h-4 w-4" />
          Décomposition tarifaire (admin)
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setVisible((v) => !v)}
          className="text-amber-400 hover:text-amber-300"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <span className="ml-1">{visible ? 'Masquer' : 'Afficher'}</span>
        </Button>
      </div>

      {visible && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Row label="Tarif GP brut" value={`${formatFcfa(gpRate)}/kg`} />
          <Row label={`Marge agence (${marginPct.toFixed(0)} %)`} value={`+ ${formatFcfa(margePerKg)}/kg`} />
          <Row label="Tarif affiché client" value={`${formatFcfa(props.displayedPricePerKg)}/kg`} />
          <Row label="Mode" value={props.isExpress ? 'Express (×1.45)' : 'Standard'} />
          <Row label="Enlèvement (intégré)" value={formatFcfa(enlevement)} />
          <Row label="Frais hors Dakar" value={hd > 0 ? formatFcfa(hd) : '—'} />
          {props.deliveryCarrierCost ? (
            <Row label="Carrier destination" value={formatFcfa(props.deliveryCarrierCost)} />
          ) : null}
          <Row label="Poids facturé" value={`${Number(props.weightKg ?? 0).toFixed(1)} kg`} />

          <div className="col-span-2 border-t border-amber-500/20 my-1" />

          <Row label="TOTAL CLIENT" value={formatFcfa(props.totalDisplayedPrice)} highlight />
          <Row label="Coût GP" value={formatFcfa(props.totalCostPrice)} muted />
          <Row label="Marge nette Yobbanté" value={formatFcfa(props.yobbanteGrossMargin)} highlight />

          {props.isEstimate && (
            <div className="col-span-2 text-xs text-amber-400/80 italic">
              ⚠️ Prix estimatif — pas encore confirmé (GP non assigné ou sans tarif).
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  label, value, highlight, muted,
}: { label: string; value: React.ReactNode; highlight?: boolean; muted?: boolean }) {
  return (
    <>
      <div className={`${muted ? 'text-muted-foreground' : 'text-foreground/70'}`}>{label}</div>
      <div className={`text-right font-mono ${highlight ? 'text-amber-300 font-bold' : muted ? 'text-muted-foreground' : ''}`}>
        {value}
      </div>
    </>
  );
}
