/**
 * Fret maritime ("Maritime") — préparation en amont.
 *
 * Même principe que l'Aérien classique : structure construite maintenant,
 * statut public "Bientôt disponible", testable uniquement côté admin.
 * Produit une ESTIMATION INDICATIVE — jamais un prix ferme, jamais de paiement.
 */

export type SeaZoneId = 'S1' | 'S2' | 'S3';
export type SeaShipmentType = 'lcl' | 'fcl';
export type ContainerSize = '20' | '40';

export interface SeaZone {
  id: SeaZoneId;
  label: string;
  cities: string[];
  /** Groupage : FCFA par m³ taxable. */
  lclPerM3: number;
  /** Conteneur complet : FCFA par conteneur. */
  fcl: Record<ContainerSize, number>;
  /** Délai indicatif porte-à-port (jours). */
  transitDays: [number, number];
}

export const SEA_ZONES: SeaZone[] = [
  {
    id: 'S1',
    label: 'Zone 1 — Europe proche',
    cities: ['Paris', 'Bruxelles', 'Madrid', 'Lisbonne'],
    lclPerM3: 3500,
    fcl: { '20': 2_800_000, '40': 4_200_000 },
    transitDays: [25, 30],
  },
  {
    id: 'S2',
    label: 'Zone 2 — Moyen-Orient / Maghreb',
    cities: ['Istanbul', 'Dubaï', 'Casablanca'],
    lclPerM3: 4200,
    fcl: { '20': 3_200_000, '40': 4_800_000 },
    transitDays: [28, 35],
  },
  {
    id: 'S3',
    label: 'Zone 3 — Long-courrier',
    cities: ['Addis-Abeba', 'New York'],
    lclPerM3: 5200,
    fcl: { '20': 3_800_000, '40': 5_700_000 },
    transitDays: [32, 40],
  },
];

/** Villes desservies en maritime (mêmes zones que l'aérien classique). */
export const SEA_CITIES: { city: string; zone: SeaZoneId; zoneLabel: string }[] =
  SEA_ZONES.flatMap(z => z.cities.map(city => ({ city, zone: z.id, zoneLabel: z.label })));

/** Règle W/M standard : 1 tonne (1000 kg) = 1 m³. */
export const SEA_WM_KG_PER_M3 = 1000;

export const SEA_WM_HINT =
  "Règle W/M : on compare le poids réel (1 tonne = 1 m³) et le volume — la base la plus élevée est retenue.";

export const SEA_LCL_DISCLAIMER =
  'Estimation indicative — tarif confirmé après vérification du volume et des documents.';

export const SEA_FCL_DISCLAIMER =
  'Estimation TRÈS approximative : les taux conteneur varient toutes les 2 semaines. Contactez-nous pour un devis précis.';

export function findSeaZone(city?: string | null): SeaZone | null {
  const c = (city ?? '').trim().toLowerCase();
  if (!c) return null;
  return SEA_ZONES.find(z => z.cities.some(x => x.toLowerCase() === c)) ?? null;
}

export function seaZoneById(id?: SeaZoneId | null): SeaZone | null {
  return SEA_ZONES.find(z => z.id === id) ?? null;
}

/** Volume en m³ depuis des dimensions en cm. */
export function volumeM3(l?: number | null, w?: number | null, h?: number | null): number | null {
  const v = [l, w, h];
  if (!v.every(x => Number.isFinite(x as number) && (x as number) > 0)) return null;
  return Math.round(((l as number) * (w as number) * (h as number)) / 1_000_000 * 1000) / 1000;
}

export function seaTransitLabel(zone: SeaZone | null): string {
  if (!zone) return 'Délai maritime indicatif : 25 à 40 jours selon la zone';
  return `Délai indicatif : ${zone.transitDays[0]} à ${zone.transitDays[1]} jours`;
}

export interface SeaEstimate {
  price: number | null;
  type: SeaShipmentType;
  zone: SeaZone | null;
  /** LCL uniquement */
  realKg: number | null;
  volumeM3: number | null;
  taxableM3: number | null;
  basis: 'weight' | 'volume' | null;
  /** FCL uniquement */
  containers: number | null;
  containerSize: ContainerSize | null;
  /** Fiabilité de l'estimation — pilote le niveau d'avertissement affiché. */
  reliability: 'indicative' | 'very_rough';
  detail: string;
  disclaimer: string;
}

export function estimateSeaFreight(input: {
  zone: SeaZone | null;
  type: SeaShipmentType;
  realKg?: number | null;
  volumeM3?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  containers?: number | null;
  containerSize?: ContainerSize | null;
}): SeaEstimate {
  const { zone, type } = input;
  const isFcl = type === 'fcl';

  const base: SeaEstimate = {
    price: null, type, zone,
    realKg: null, volumeM3: null, taxableM3: null, basis: null,
    containers: null, containerSize: null,
    reliability: isFcl ? 'very_rough' : 'indicative',
    detail: '',
    disclaimer: isFcl ? SEA_FCL_DISCLAIMER : SEA_LCL_DISCLAIMER,
  };

  if (!zone) return { ...base, detail: 'Sélectionnez une ville desservie en maritime' };

  if (isFcl) {
    const size: ContainerSize = input.containerSize ?? '20';
    const n = Number.isFinite(input.containers as number) && (input.containers as number) > 0
      ? Math.floor(input.containers as number)
      : null;
    if (!n) {
      return { ...base, containerSize: size, detail: 'Indiquez le nombre de conteneurs souhaité' };
    }
    const unit = zone.fcl[size];
    return {
      ...base,
      containers: n,
      containerSize: size,
      price: n * unit,
      detail: `${n} conteneur${n > 1 ? 's' : ''} ${size} pieds × ${unit.toLocaleString('fr-FR')} FCFA`,
    };
  }

  const realKg = Number.isFinite(input.realKg as number) && (input.realKg as number) > 0
    ? (input.realKg as number)
    : null;
  const vol = Number.isFinite(input.volumeM3 as number) && (input.volumeM3 as number) > 0
    ? (input.volumeM3 as number)
    : volumeM3(input.lengthCm, input.widthCm, input.heightCm);

  if (!realKg && !vol) {
    return { ...base, detail: 'Renseignez le poids réel et/ou le volume (m³ ou dimensions)' };
  }

  const weightAsM3 = realKg ? realKg / SEA_WM_KG_PER_M3 : 0;
  const taxableM3 = Math.round(Math.max(weightAsM3, vol ?? 0) * 1000) / 1000;
  const basis: 'weight' | 'volume' = weightAsM3 > (vol ?? 0) ? 'weight' : 'volume';

  return {
    ...base,
    realKg,
    volumeM3: vol,
    taxableM3,
    basis,
    price: Math.round(taxableM3 * zone.lclPerM3),
    detail:
      `${taxableM3} m³ taxables (${basis === 'weight' ? 'poids retenu — 1 t = 1 m³' : 'volume retenu'})` +
      ` × ${zone.lclPerM3.toLocaleString('fr-FR')} FCFA/m³`,
  };
}

export const fmtFcfaSea = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;
