/**
 * Tarification fret routier "Terminal D" (garage Baux Maraîchers).
 * Système INDÉPENDANT de pricingEngine.ts (aérien/maritime/GP international).
 *
 * National  : tarif fixe par taille de colis (S/M/L), par zone de distance.
 * International : tarif au kg, avec poids minimum facturé (3 kg).
 */

export type FretScope = 'national' | 'international';
export type ColisSize = 'S' | 'M' | 'L';

export interface FretZone {
  id: string;
  scope: FretScope;
  code: string;
  label: string;
  price_s_fcfa: number | null;
  price_m_fcfa: number | null;
  price_l_fcfa: number | null;
  price_per_kg_fcfa: number | null;
  min_billable_kg: number | null;
}

export interface FretDestination {
  id: string;
  zone_id: string;
  scope: FretScope;
  name: string;
  country_code: string | null;
}

/** Limites indicatives des tailles de colis (aide au choix côté client). */
export const COLIS_SIZES: {
  key: ColisSize;
  label: string;
  weight: string;
  dims: string;
  maxKg: number;
}[] = [
  { key: 'S', label: 'Petit', weight: "jusqu'à 2 kg", dims: '30 × 20 × 10 cm', maxKg: 2 },
  { key: 'M', label: 'Moyen', weight: '2 à 10 kg', dims: '50 × 40 × 30 cm', maxKg: 10 },
  { key: 'L', label: 'Grand', weight: '10 à 25 kg', dims: '70 × 50 × 50 cm', maxKg: 25 },
];

/** Au-delà de ce poids : devis sur mesure, aucun prix automatique. */
export const FRET_MAX_AUTO_KG = 25;

export interface FretQuote {
  price: number | null;
  /** true => hors grille, il faut passer par un devis sur mesure. */
  manualQuote: boolean;
  detail: string;
  billableKg?: number;
}

export function quoteNational(zone: FretZone, size: ColisSize): FretQuote {
  const price =
    size === 'S' ? zone.price_s_fcfa : size === 'M' ? zone.price_m_fcfa : zone.price_l_fcfa;
  if (price == null) {
    return { price: null, manualQuote: true, detail: 'Tarif non disponible pour cette zone' };
  }
  const def = COLIS_SIZES.find(s => s.key === size)!;
  return {
    price,
    manualQuote: false,
    detail: `Taille ${size} (${def.weight}) · ${zone.label} · tarif fixe`,
  };
}

export function quoteInternational(zone: FretZone, weightKg: number): FretQuote {
  const rate = zone.price_per_kg_fcfa;
  if (!rate) {
    return { price: null, manualQuote: true, detail: 'Tarif non disponible pour cette zone' };
  }
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    return { price: null, manualQuote: false, detail: 'Renseignez le poids du colis' };
  }
  if (weightKg > FRET_MAX_AUTO_KG) {
    return { price: null, manualQuote: true, detail: 'Au-delà de 25 kg : devis sur mesure' };
  }
  const min = zone.min_billable_kg ?? 0;
  const billableKg = Math.max(weightKg, min);
  return {
    price: Math.round(billableKg * rate),
    manualQuote: false,
    billableKg,
    detail:
      billableKg > weightKg
        ? `${billableKg} kg facturés (minimum ${min} kg) × ${rate.toLocaleString('fr-FR')} FCFA/kg`
        : `${billableKg} kg × ${rate.toLocaleString('fr-FR')} FCFA/kg`,
  };
}

export function fmtFcfa(n: number): string {
  return `${n.toLocaleString('fr-FR')} FCFA`;
}
