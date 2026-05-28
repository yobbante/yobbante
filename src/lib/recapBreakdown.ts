/**
 * Récapitulatif tarifaire — calcul FORWARD et proportionnel (FCFA).
 *
 * Plan de calcul :
 *   fret_base   = rate_per_kg(corridor) × poids
 *   billet/soute = isAir ? max(2 000 ; fret_base × 0.15) : 0
 *   frais_dossier = 1 500 (fixe, petit)
 *   frais_agence  = fret_base × 0.10
 *   assurance     = (passé)
 *   enlèvement    = (passé, 0 si Dakar centre)
 *
 *   HT  = somme des lignes ci-dessus
 *   TVA = HT × 18 %
 *   TTC = HT + TVA
 *
 * Tout est strictement proportionnel au tarif corridor (rate_per_kg) × poids,
 * pour rester cohérent avec le "À partir de" affiché sur la landing.
 *
 * Exemple Paris (rate 6 000) — 1 kg :
 *   fret 6 000 + billet 2 000 + doss 1 500 + agence 600 = 10 100 HT
 *   TVA 1 818 → TTC ≈ 11 918 FCFA
 *
 * Exemple Abidjan (rate 3 500) — 1 kg :
 *   fret 3 500 + billet 2 000 + doss 1 500 + agence 350 = 7 350 HT
 *   TVA 1 323 → TTC ≈ 8 673 FCFA
 *
 * Pour l'admin, la TVA réellement reversée se calcule sur la marge
 * (cf. FinancesTab). Ici on isole la TVA visuelle pour le client.
 */

export const TVA_RATE = 0.18;

const FRAIS_DOSSIER_FCFA = 1500;
const AGENCE_PCT = 0.10;
const BILLET_PCT = 0.15;
const BILLET_MIN_FCFA = 2000;

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
}

export function buildRecapBreakdown(opts: BuildRecapOpts): RecapBreakdown {
  const w = Math.max(0.5, Number(opts.weightKg) || 0);
  const rate = Math.max(0, Number(opts.ratePerKgFcfa) || 0);

  const fret = Math.round(rate * w);
  const billet = opts.isAir ? Math.max(BILLET_MIN_FCFA, Math.round(fret * BILLET_PCT)) : 0;
  const dossier = FRAIS_DOSSIER_FCFA;
  const agence = Math.round(fret * AGENCE_PCT);
  const assurance = Math.max(0, Math.round(opts.insuranceFcfa ?? 0));
  const enlevement = Math.max(0, Math.round(opts.pickupSurchargeFcfa ?? 0));

  const lines: RecapLine[] = [
    { label: 'Fret transporteur', amountFcfa: fret },
  ];
  if (billet > 0) lines.push({ label: 'Billet / soute aérienne', amountFcfa: billet });
  lines.push({ label: 'Frais de dossier', amountFcfa: dossier });
  lines.push({ label: "Frais d'agence", amountFcfa: agence });
  if (assurance > 0) lines.push({ label: 'Assurance colis', amountFcfa: assurance });
  if (enlevement > 0) lines.push({ label: 'Enlèvement (zone élargie)', amountFcfa: enlevement });

  const ht = lines.reduce((s, l) => s + l.amountFcfa, 0);
  const tva = Math.round(ht * TVA_RATE);
  const ttc = ht + tva;

  return { lines, subtotalHt: ht, tva, tvaRate: TVA_RATE, totalTtc: ttc };
}
