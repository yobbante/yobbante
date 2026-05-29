import { describe, it, expect } from 'vitest';
import {
  calculatePricing,
  fcfaToEur,
  eurToFcfa,
  roundFcfa,
  assertPriceCoherence,
  FCFA_PER_EUR,
  TVA_RATE,
  EXPRESS_COEF,
  YOBBANTE_MARGIN,
  getMarchandiseCoef,
} from './pricingEngine';

/**
 * Recompose la formule métier pour valider chaque ligne :
 *   fret      = round(poids × tarif × marge × coef × (express ? EXPRESS_COEF : 1))
 *   billet    = max(2000, round(fret × 0.15))
 *   dossier   = 1500
 *   agence    = round(fret × 0.10)
 *   HT        = fret + billet + dossier + agence + enlev + assur
 *   TVA       = round(HT × 0.18)
 *   TTC       = HT + TVA
 */
function expectedBreakdown(
  poids: number,
  tarif: number,
  marchandise: string,
  mode: 'standard' | 'express',
  enlev: number,
  ass: number,
) {
  const coef = getMarchandiseCoef(marchandise);
  const fretStd = Math.round(poids * tarif * YOBBANTE_MARGIN * coef);
  const fret = mode === 'express' ? Math.round(fretStd * EXPRESS_COEF) : fretStd;
  const billet = Math.max(2000, Math.round(fret * 0.15));
  const dossier = 1500;
  const agence = Math.round(fret * 0.10);
  const ht = fret + billet + dossier + agence + enlev + ass;
  const tva = Math.round(ht * TVA_RATE);
  return { fret, billet, dossier, agence, ht, tva, ttc: ht + tva };
}

describe('calculatePricing — Standard / Express', () => {
  it('Dakar → Paris, 1 kg, standard, sans assurance, Dakar centre', () => {
    const out = calculatePricing(
      { tarifGPFcfa: 12000, weightKg: 1, marchandise: 'standard', enlevementFcfa: 0, assuranceFcfa: 0 },
      'standard',
    );
    const e = expectedBreakdown(1, 12000, 'standard', 'standard', 0, 0);
    expect(out.fret).toBe(e.fret);
    expect(out.billet_soute).toBe(e.billet);
    expect(out.frais_dossier).toBe(1500);
    expect(out.frais_agence).toBe(e.agence);
    expect(out.sous_total_ht).toBe(e.ht);
    expect(out.tva).toBe(e.tva);
    expect(out.total_ttc).toBe(e.ttc);
    expect(out.mode).toBe('standard');
  });

  it('Express applique bien le coefficient ×1.45 sur le fret', () => {
    const std = calculatePricing({ tarifGPFcfa: 12000, weightKg: 2, marchandise: 'standard' }, 'standard');
    const exp = calculatePricing({ tarifGPFcfa: 12000, weightKg: 2, marchandise: 'standard' }, 'express');
    expect(exp.fret).toBe(Math.round(std.fret * EXPRESS_COEF));
    expect(exp.total_ttc).toBeGreaterThan(std.total_ttc);
  });

  it("Standard et Express exposés simultanément dans prix_standard / prix_express", () => {
    const out = calculatePricing({ tarifGPFcfa: 9000, weightKg: 3, marchandise: 'electronics' }, 'standard');
    const e = expectedBreakdown(3, 9000, 'electronics', 'standard', 0, 0);
    const eExp = expectedBreakdown(3, 9000, 'electronics', 'express', 0, 0);
    expect(out.prix_standard).toBe(e.ttc);
    expect(out.prix_express).toBe(eExp.ttc);
  });
});

describe('calculatePricing — marchandises', () => {
  it.each([
    ['standard', 1.00],
    ['electronics', 1.08],
    ['fragile', 1.10],
    ['bijoux', 1.12],
    ['livres', 0.95],
  ] as const)('coef marchandise %s = %s appliqué au fret', (m, coef) => {
    const w = 2, r = 10000;
    const out = calculatePricing({ tarifGPFcfa: r, weightKg: w, marchandise: m }, 'standard');
    expect(out.fret).toBe(Math.round(w * r * YOBBANTE_MARGIN * coef));
  });

  it('marchandise inconnue → coef 1', () => {
    const out = calculatePricing({ tarifGPFcfa: 10000, weightKg: 1, marchandise: 'inconnue' }, 'standard');
    expect(out.fret).toBe(Math.round(1 * 10000 * YOBBANTE_MARGIN));
  });
});

describe('calculatePricing — quartiers (enlèvement)', () => {
  it.each([
    ['Dakar centre', 0],
    ['Banlieue', 5000],
    ['Hors zone', 10000],
  ])('zone %s — surcharge %i incluse dans HT', (_label, enlev) => {
    const out = calculatePricing(
      { tarifGPFcfa: 12000, weightKg: 1.5, marchandise: 'standard', enlevementFcfa: enlev },
      'standard',
    );
    const e = expectedBreakdown(1.5, 12000, 'standard', 'standard', enlev, 0);
    expect(out.enlevement).toBe(enlev);
    expect(out.sous_total_ht).toBe(e.ht);
    expect(out.total_ttc).toBe(e.ttc);
    // Ligne visible uniquement si > 0
    const hasLine = out.lines.some((l) => l.label.toLowerCase().includes('enlèvement'));
    expect(hasLine).toBe(enlev > 0);
  });
});

describe('calculatePricing — assurance', () => {
  it('sans assurance — pas de ligne, montant 0', () => {
    const out = calculatePricing({ tarifGPFcfa: 12000, weightKg: 1, marchandise: 'standard' }, 'standard');
    expect(out.assurance_amount).toBe(0);
    expect(out.lines.find((l) => l.label.toLowerCase().includes('protection'))).toBeUndefined();
  });

  it('avec assurance 3 €/5 € convertis en FCFA — TTC augmente du montant + TVA correspondante', () => {
    const sans = calculatePricing({ tarifGPFcfa: 12000, weightKg: 1, marchandise: 'standard' }, 'standard');
    const avec = calculatePricing(
      { tarifGPFcfa: 12000, weightKg: 1, marchandise: 'standard', assuranceFcfa: 3 * FCFA_PER_EUR },
      'standard',
    );
    expect(avec.assurance_amount).toBe(3 * FCFA_PER_EUR);
    expect(avec.sous_total_ht - sans.sous_total_ht).toBe(3 * FCFA_PER_EUR);
    // TVA recalculée sur le HT global → différence ≈ assurance × 0.18 (à 1 FCFA près)
    expect(Math.abs(avec.tva - sans.tva - Math.round(3 * FCFA_PER_EUR * TVA_RATE))).toBeLessThanOrEqual(1);
  });
});

describe('calculatePricing — TVA & arrondis', () => {
  it('TVA = round(HT × 0.18) et TTC = HT + TVA', () => {
    const out = calculatePricing(
      { tarifGPFcfa: 11500, weightKg: 2.3, marchandise: 'fragile', enlevementFcfa: 5000, assuranceFcfa: 1965 },
      'express',
    );
    expect(out.tva).toBe(Math.round(out.sous_total_ht * TVA_RATE));
    expect(out.total_ttc).toBe(out.sous_total_ht + out.tva);
    expect(out.tva_a_reverser).toBe(out.tva);
  });

  it('poids < 0,5 kg traité comme 0,5 kg minimum', () => {
    const a = calculatePricing({ tarifGPFcfa: 12000, weightKg: 0.1, marchandise: 'standard' }, 'standard');
    const b = calculatePricing({ tarifGPFcfa: 12000, weightKg: 0.5, marchandise: 'standard' }, 'standard');
    expect(a.total_ttc).toBe(b.total_ttc);
  });

  it('inputs invalides (NaN, négatif) → pas de NaN dans la sortie', () => {
    const out = calculatePricing(
      { tarifGPFcfa: NaN, weightKg: -3, marchandise: null, enlevementFcfa: -100, assuranceFcfa: NaN },
      'standard',
    );
    Object.values(out).forEach((v) => {
      if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
    });
  });
});

describe('FCFA ↔ EUR helpers', () => {
  it('fcfaToEur arrondit à l\'euro entier', () => {
    expect(fcfaToEur(655)).toBe(1);
    expect(fcfaToEur(1310)).toBe(2);
    expect(fcfaToEur(900)).toBe(1); // 900/655 ≈ 1.37 → 1
    expect(fcfaToEur(1000)).toBe(2); // 1000/655 ≈ 1.52 → 2
  });

  it('eurToFcfa arrondit au FCFA entier', () => {
    expect(eurToFcfa(1)).toBe(655);
    expect(eurToFcfa(10)).toBe(6550);
  });

  it('cas limites — 0, négatif, NaN, Infinity → 0', () => {
    expect(fcfaToEur(0)).toBe(0);
    expect(fcfaToEur(-100)).toBe(0);
    expect(fcfaToEur(NaN)).toBe(0);
    expect(fcfaToEur(Infinity)).toBe(0);
    expect(eurToFcfa(0)).toBe(0);
    expect(eurToFcfa(-5)).toBe(0);
    expect(eurToFcfa(NaN)).toBe(0);
  });

  it('roundFcfa centralise Math.round et neutralise NaN/Infinity', () => {
    expect(roundFcfa(1234.6)).toBe(1235);
    expect(roundFcfa(1234.4)).toBe(1234);
    expect(roundFcfa(NaN)).toBe(0);
    expect(roundFcfa(Infinity)).toBe(0);
  });
});

describe('assertPriceCoherence', () => {
  it('renvoie true quand les prix sont identiques', () => {
    expect(assertPriceCoherence('test', 91271, 91271)).toBe(true);
  });
  it('tolère 1 FCFA d\'écart d\'arrondi', () => {
    expect(assertPriceCoherence('test', 91271, 91272)).toBe(true);
  });
  it('renvoie false si divergence > tolérance', () => {
    expect(assertPriceCoherence('test', 91271, 95000)).toBe(false);
  });
});
