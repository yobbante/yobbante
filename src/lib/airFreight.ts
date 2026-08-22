/**
 * Fret aérien classique ("Aérien") — préparation en amont.
 *
 * Distinct du GP (bagage accompagné) et du fret routier (Terminal D).
 * Statut public : "Bientôt disponible". Utilisable en interne (admin) pour
 * produire une ESTIMATION INDICATIVE — jamais un prix ferme.
 */

export type AirZoneId = 'A1' | 'A2' | 'A3';

export interface AirBracket {
  /** poids taxable min (inclus) */
  from: number;
  /** poids taxable max (inclus) */
  to: number;
  pricePerKg: number;
}

export interface AirZone {
  id: AirZoneId;
  label: string;
  cities: string[];
  brackets: AirBracket[];
}

export const AIR_ZONES: AirZone[] = [
  {
    id: 'A1',
    label: 'Zone 1 — Europe proche',
    cities: ['Paris', 'Bruxelles', 'Madrid', 'Lisbonne'],
    brackets: [
      { from: 0, to: 45, pricePerKg: 3000 },
      { from: 45, to: 100, pricePerKg: 2640 },
      { from: 100, to: 300, pricePerKg: 2340 },
    ],
  },
  {
    id: 'A2',
    label: 'Zone 2 — Moyen-Orient / Maghreb',
    cities: ['Istanbul', 'Dubaï', 'Casablanca'],
    brackets: [
      { from: 0, to: 45, pricePerKg: 3600 },
      { from: 45, to: 100, pricePerKg: 3170 },
      { from: 100, to: 300, pricePerKg: 2810 },
    ],
  },
  {
    id: 'A3',
    label: 'Zone 3 — Long-courrier',
    cities: ['Addis-Abeba', 'New York'],
    brackets: [
      { from: 0, to: 45, pricePerKg: 4500 },
      { from: 45, to: 100, pricePerKg: 3960 },
      { from: 100, to: 300, pricePerKg: 3510 },
    ],
  },
];

/** Toutes les villes desservies en Aérien (liste distincte des 36 villes GP). */
export const AIR_CITIES: { city: string; zone: AirZoneId; zoneLabel: string }[] =
  AIR_ZONES.flatMap(z => z.cities.map(city => ({ city, zone: z.id, zoneLabel: z.label })));

/** Au-delà de ce poids taxable : aucun calcul automatique. */
export const AIR_MAX_AUTO_KG = 300;

/** Diviseur volumétrique standard IATA (cm³ → kg). */
export const AIR_VOLUMETRIC_DIVISOR = 6000;

export const AIR_VOLUMETRIC_HINT =
  "Un colis volumineux mais léger peut coûter plus cher qu'un colis compact — c'est la règle standard du transport aérien international.";

export const AIR_QUOTE_DISCLAIMER =
  'Estimation indicative — devis final confirmé après réception de vos documents.';

export function findAirZone(city?: string | null): AirZone | null {
  const c = (city ?? '').trim().toLowerCase();
  if (!c) return null;
  return AIR_ZONES.find(z => z.cities.some(x => x.toLowerCase() === c)) ?? null;
}

export function airZoneById(id?: AirZoneId | null): AirZone | null {
  return AIR_ZONES.find(z => z.id === id) ?? null;
}

/** Poids volumétrique IATA : (L × l × H cm) / 6000. */
export function volumetricWeight(l?: number | null, w?: number | null, h?: number | null): number | null {
  if (!l || !w || !h) return null;
  if (![l, w, h].every(v => Number.isFinite(v) && (v as number) > 0)) return null;
  return Math.round(((l as number) * (w as number) * (h as number)) / AIR_VOLUMETRIC_DIVISOR * 100) / 100;
}

export interface AirEstimate {
  /** Estimation indicative en FCFA (null si hors grille / données manquantes). */
  price: number | null;
  realKg: number | null;
  volumetricKg: number | null;
  /** Poids retenu pour la facturation (le plus élevé des deux). */
  taxableKg: number | null;
  /** 'real' | 'volumetric' — quelle base a été retenue. */
  basis: 'real' | 'volumetric' | null;
  pricePerKg: number | null;
  zone: AirZone | null;
  /** true => hors grille (>300 kg) : devis sur mesure obligatoire. */
  manualQuote: boolean;
  detail: string;
}

export function bracketFor(zone: AirZone, taxableKg: number): AirBracket | null {
  return zone.brackets.find(b => taxableKg > b.from && taxableKg <= b.to)
    ?? (taxableKg > 0 && taxableKg <= zone.brackets[0].to ? zone.brackets[0] : null);
}

export function estimateAirFreight(input: {
  zone: AirZone | null;
  realKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
}): AirEstimate {
  const { zone } = input;
  const realKg = Number.isFinite(input.realKg as number) && (input.realKg as number) > 0
    ? (input.realKg as number)
    : null;
  const volumetricKg = volumetricWeight(input.lengthCm, input.widthCm, input.heightCm);

  const base: AirEstimate = {
    price: null, realKg, volumetricKg, taxableKg: null, basis: null,
    pricePerKg: null, zone, manualQuote: false, detail: '',
  };

  if (!zone) return { ...base, detail: 'Sélectionnez une ville desservie en aérien' };
  if (!realKg) return { ...base, detail: 'Renseignez le poids réel du colis' };

  const taxableKg = Math.max(realKg, volumetricKg ?? 0);
  const basis: 'real' | 'volumetric' = (volumetricKg ?? 0) > realKg ? 'volumetric' : 'real';

  if (taxableKg > AIR_MAX_AUTO_KG) {
    return {
      ...base, taxableKg, basis, manualQuote: true,
      detail: 'Au-delà de 300 kg : devis sur mesure, contactez-nous directement.',
    };
  }

  const bracket = bracketFor(zone, taxableKg);
  if (!bracket) return { ...base, taxableKg, basis, detail: 'Palier de poids indisponible' };

  return {
    ...base,
    taxableKg,
    basis,
    pricePerKg: bracket.pricePerKg,
    price: Math.round(taxableKg * bracket.pricePerKg),
    detail:
      `${taxableKg} kg taxables (${basis === 'volumetric' ? 'poids volumétrique retenu' : 'poids réel retenu'})` +
      ` × ${bracket.pricePerKg.toLocaleString('fr-FR')} FCFA/kg`,
  };
}

export const fmtFcfaAir = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;
