/**
 * Pricing Engine — SOURCE UNIQUE DE VÉRITÉ pour TOUS les prix Yobbanté.
 *
 * Toute UI (cards Standard/Express, récap détaillé, LiveSummaryBar,
 * page /pay, admin) DOIT passer par `calculatePricing(...)`. Aucun
 * autre calcul de prix ne doit coexister.
 *
 * Formule (FCFA) :
 *   fret      = poids × tarifGP × MARGE × coefMarchandise           (Standard)
 *               × EXPRESS_COEF                                      (Express)
 *   billet    = max(2000, fret × 0.15)
 *   dossier   = 1500
 *   agence    = fret × 0.10
 *   enlevement = 0 / 5000 / 10000 selon zone
 *   assurance = montant choisi par le client (0 sinon)
 *   HT        = fret + billet + dossier + agence + enlevement + assurance
 *   TVA       = HT × 0.18
 *   TTC       = HT + TVA
 */

export const TVA_RATE = 0.18;
export const YOBBANTE_MARGIN = 1.20;
export const EXPRESS_COEF = 1.45;

/** Taux pivot FCFA ↔ EUR (XOF est fixé à 655,957 par euro — on arrondit à 655). */
export const FCFA_PER_EUR = 655;

const FRAIS_DOSSIER_FCFA = 1500;
const AGENCE_PCT = 0.10;
const BILLET_PCT = 0.15;

/** Arrondi centralisé pour TOUS les montants FCFA. */
export function roundFcfa(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

/** Conversion FCFA → EUR (arrondi à l'euro entier, jamais NaN/Infinity). */
export function fcfaToEur(fcfa: number): number {
  if (!Number.isFinite(fcfa) || fcfa <= 0) return 0;
  return Math.round(fcfa / FCFA_PER_EUR);
}

/** Conversion EUR → FCFA (arrondi au FCFA entier). */
export function eurToFcfa(eur: number): number {
  if (!Number.isFinite(eur) || eur <= 0) return 0;
  return Math.round(eur * FCFA_PER_EUR);
}

/**
 * Vérifie qu'une valeur observée (cards Standard/Express, récap, LiveSummaryBar,
 * /pay) correspond bien au TTC retourné par `calculatePricing`. Tolérance 1 FCFA
 * pour absorber les arrondis intermédiaires.
 *
 * En DEV : log un avertissement + retourne false.
 * En PROD : silencieux + retourne false (l'appelant peut décider de bloquer).
 */
export function assertPriceCoherence(
  source: string,
  expectedFcfa: number,
  observedFcfa: number,
  tolerance = 1,
): boolean {
  const diff = Math.abs(expectedFcfa - observedFcfa);
  const ok = diff <= tolerance;
  if (!ok && typeof console !== 'undefined' && (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV) {
    // eslint-disable-next-line no-console
    console.warn(
      `[pricingEngine] Divergence prix détectée @ ${source} — attendu ${expectedFcfa} FCFA, observé ${observedFcfa} FCFA (Δ ${diff}).`,
    );
  }
  return ok;
}
const BILLET_MIN_FCFA = 2000;

/** Coefficients faibles (0.95 → 1.12) par type de marchandise. */
export const MARCHANDISE_COEF: Record<string, number> = {
  standard:    1.00,
  vetements:   1.00,
  fashion:     1.02,
  chaussures:  1.02,
  cosmetics:   1.02,
  cosmetiques: 1.02,
  food:        0.98,
  alimentaire: 0.98,
  medicaments: 1.05,
  livres:      0.95,
  documents:   0.95,
  jouets:      1.00,
  electronics: 1.08,
  electronique: 1.08,
  electromenager: 1.10,
  fragile:     1.10,
  auto_parts:  1.07,
  bijoux:      1.12,
  high_value:  1.12,
  autre:       1.00,
};

export function getMarchandiseCoef(id?: string | null): number {
  if (!id) return 1;
  return MARCHANDISE_COEF[id] ?? 1;
}

export interface PricingInput {
  /** Tarif corridor GP BRUT (FCFA/kg). */
  tarifGPFcfa: number;
  weightKg: number;
  marchandise?: string | null;
  /** Surcharge enlèvement zone (0 Dakar centre / 5000 banlieue / 10000 hors). */
  enlevementFcfa?: number;
  /** Montant assurance choisi par le client (0 si pas d'assurance). */
  assuranceFcfa?: number;
}

export interface ModeBreakdown {
  fret: number;
  billet_soute: number;
  frais_dossier: number;
  frais_agence: number;
  enlevement: number;
  assurance_amount: number;
  sous_total_ht: number;
  tva: number;
  total_ttc: number;
}

export interface PricingLine {
  label: string;
  amountFcfa: number;
}

export interface PricingOutput extends ModeBreakdown {
  /** Mode utilisé pour les valeurs ci-dessus. */
  mode: 'standard' | 'express';
  lines: PricingLine[];
  /** Prix TTC des deux modes (pour les cards Standard/Express). */
  prix_standard: number;
  prix_express: number;
  standard: ModeBreakdown;
  express: ModeBreakdown;
  // Admin only — ne JAMAIS afficher côté client
  tarif_gp_brut: number;
  marge_yobbante: number;
  tva_a_reverser: number;
  tva_rate: number;
}

function computeMode(
  fretBase: number,
  enlevement: number,
  assurance: number,
): ModeBreakdown {
  const fret = Math.max(0, roundFcfa(fretBase));
  const billet_soute = Math.max(BILLET_MIN_FCFA, roundFcfa(fret * BILLET_PCT));
  const frais_dossier = FRAIS_DOSSIER_FCFA;
  const frais_agence = roundFcfa(fret * AGENCE_PCT);
  const sous_total_ht =
    fret + billet_soute + frais_dossier + frais_agence + enlevement + assurance;
  const tva = roundFcfa(sous_total_ht * TVA_RATE);
  const total_ttc = sous_total_ht + tva;
  return {
    fret,
    billet_soute,
    frais_dossier,
    frais_agence,
    enlevement,
    assurance_amount: assurance,
    sous_total_ht,
    tva,
    total_ttc,
  };
}

function buildLines(m: ModeBreakdown): PricingLine[] {
  const lines: PricingLine[] = [
    { label: 'Fret transporteur', amountFcfa: m.fret },
    { label: 'Billet / soute', amountFcfa: m.billet_soute },
    { label: 'Frais de dossier', amountFcfa: m.frais_dossier },
    { label: "Frais d'agence", amountFcfa: m.frais_agence },
  ];
  if (m.enlevement > 0) lines.push({ label: 'Enlèvement (zone élargie)', amountFcfa: m.enlevement });
  if (m.assurance_amount > 0) lines.push({ label: 'Protection colis', amountFcfa: m.assurance_amount });
  return lines;
}

export function calculatePricing(
  input: PricingInput,
  mode: 'standard' | 'express' = 'standard',
): PricingOutput {
  const w = Math.max(0.5, Number(input.weightKg) || 0);
  const rate = Math.max(0, Number(input.tarifGPFcfa) || 0);
  const coef = getMarchandiseCoef(input.marchandise);
  const enlev = Math.max(0, roundFcfa(input.enlevementFcfa ?? 0));
  const ass = Math.max(0, roundFcfa(input.assuranceFcfa ?? 0));

  const fretStandard = roundFcfa(w * rate * YOBBANTE_MARGIN * coef);
  const fretExpress = roundFcfa(fretStandard * EXPRESS_COEF);

  const standard = computeMode(fretStandard, enlev, ass);
  const express = computeMode(fretExpress, enlev, ass);
  const selected = mode === 'express' ? express : standard;

  return {
    ...selected,
    mode,
    lines: buildLines(selected),
    prix_standard: standard.total_ttc,
    prix_express: express.total_ttc,
    standard,
    express,
    tarif_gp_brut: Math.round(w * rate),
    marge_yobbante: Math.round(selected.fret - w * rate),
    tva_a_reverser: selected.tva,
    tva_rate: TVA_RATE,
  };
}
