/**
 * Récapitulatif tarifaire — calcul FORWARD et proportionnel (FCFA).
 *
 * Plan de calcul (tout est dynamique et change si le client modifie
 * un champ : corridor, quartier de collecte, poids, nombre de colis,
 * type de marchandise, mode express, assurance) :
 *
 *   fret_base     = rate_per_kg(corridor) × poids × coef_marchandise
 *   billet/soute  = isAir ? max(2 000 ; fret_base × 0.15) : 0
 *   frais_dossier = 1 500 (fixe, petit)
 *   frais_agence  = fret_base × 0.10
 *   manutention   = parcelCount > 1 ? (parcelCount - 1) × 500 : 0
 *   express       = isExpress ? 4 000 : 0
 *   assurance     = passé (selon choix client)
 *   enlèvement    = passé (selon quartier de collecte)
 *
 *   HT  = somme des lignes ci-dessus
 *   TVA = HT × 18 %
 *   TTC = HT + TVA
 *
 * Les coefficients par type de marchandise sont volontairement faibles
 * (≤ 1.12) pour éviter d'inquiéter le client tout en montrant que le
 * prix s'adapte à la nature du colis.
 */

export const TVA_RATE = 0.18;

const FRAIS_DOSSIER_FCFA = 1500;
const AGENCE_PCT = 0.10;
const BILLET_PCT = 0.15;
const BILLET_MIN_FCFA = 2000;
const MANUTENTION_PER_EXTRA_PARCEL = 500;
const EXPRESS_SURCHARGE_FCFA = 4000;

export type RecapLine = { label: string; amountFcfa: number };

export interface RecapBreakdown {
  lines: RecapLine[];
  subtotalHt: number;
  tva: number;
  tvaRate: number;
  totalTtc: number;
}

export interface BuildRecapOpts {
  weightKg: number;
  ratePerKgFcfa: number;
  isAir?: boolean;
  insuranceFcfa?: number;
  pickupSurchargeFcfa?: number;
  goodsCoef?: number;
  parcelCount?: number;
  isExpress?: boolean;
}

export function buildRecapBreakdown(opts: BuildRecapOpts): RecapBreakdown {
  const w = Math.max(0.5, Number(opts.weightKg) || 0);
  const rate = Math.max(0, Number(opts.ratePerKgFcfa) || 0);
  const coef = Math.max(0.5, Number(opts.goodsCoef ?? 1));
  const parcels = Math.max(1, Math.round(Number(opts.parcelCount ?? 1)));

  const fret = Math.round(rate * w * coef);
  const billet = opts.isAir ? Math.max(BILLET_MIN_FCFA, Math.round(fret * BILLET_PCT)) : 0;
  const dossier = FRAIS_DOSSIER_FCFA;
  const agence = Math.round(fret * AGENCE_PCT);
  const manutention = parcels > 1 ? (parcels - 1) * MANUTENTION_PER_EXTRA_PARCEL : 0;
  const express = opts.isExpress ? EXPRESS_SURCHARGE_FCFA : 0;
  const assurance = Math.max(0, Math.round(opts.insuranceFcfa ?? 0));
  const enlevement = Math.max(0, Math.round(opts.pickupSurchargeFcfa ?? 0));

  const lines: RecapLine[] = [
    { label: 'Fret transporteur', amountFcfa: fret },
  ];
  if (billet > 0) lines.push({ label: 'Billet / soute aérienne', amountFcfa: billet });
  lines.push({ label: 'Frais de dossier', amountFcfa: dossier });
  lines.push({ label: "Frais d'agence", amountFcfa: agence });
  if (manutention > 0) lines.push({ label: `Manutention (${parcels} colis)`, amountFcfa: manutention });
  if (express > 0) lines.push({ label: 'Traitement express', amountFcfa: express });
  if (assurance > 0) lines.push({ label: 'Assurance colis', amountFcfa: assurance });
  if (enlevement > 0) lines.push({ label: 'Enlèvement (zone élargie)', amountFcfa: enlevement });

  const ht = lines.reduce((s, l) => s + l.amountFcfa, 0);
  const tva = Math.round(ht * TVA_RATE);
  const ttc = ht + tva;

  return { lines, subtotalHt: ht, tva, tvaRate: TVA_RATE, totalTtc: ttc };
}

/**
 * Coefficients faibles par type de marchandise — pour donner du dynamisme
 * au récap (le total change si le client change le type), sans dégrader la
 * confiance ni la marge réelle.
 */
export const GOODS_COEF: Record<string, number> = {
  documents:   0.95,
  standard:    1.00,
  fashion:     1.02,
  food:        1.05,
  cosmetics:   1.06,
  auto_parts:  1.07,
  electronics: 1.08,
  fragile:     1.10,
  high_value:  1.12,
};

export function goodsCoefFor(goodsType: string | null | undefined): number {
  if (!goodsType) return 1;
  return GOODS_COEF[goodsType] ?? 1;
}
