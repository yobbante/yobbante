// Délais de livraison Yobbanté par zone géographique (mode Express vs Standard).
// Valeurs indicatives — toujours afficher "(estimation)" à côté d'une date calculée.

export const DELIVERY_DELAYS = {
  express: {
    paris: 1,
    europe_ouest: 2,
    uk: 2,
    usa_canada: 3,
    afrique_ouest: 1,
    afrique_centrale: 2,
    moyen_orient_dubai: 3,
    asie: 3,
  },
  standard: {
    paris: 3,
    europe_ouest: 4,
    uk: 4,
    usa_canada: 6,
    afrique_ouest: 3,
    afrique_centrale: 4,
    moyen_orient_dubai: 5,
    asie: 6,
  },
} as const;

export type DeliveryMode = keyof typeof DELIVERY_DELAYS;
export type DeliveryZone = keyof typeof DELIVERY_DELAYS['express'];

// Mapping villes (sans accents, minuscules) → zone tarifaire
export const CITY_TO_ZONE: Record<string, DeliveryZone> = {
  // Paris (cas exceptionnel — 24h express)
  'paris': 'paris',

  // Europe Ouest
  'lyon': 'europe_ouest', 'marseille': 'europe_ouest', 'bordeaux': 'europe_ouest',
  'toulouse': 'europe_ouest', 'nantes': 'europe_ouest', 'strasbourg': 'europe_ouest',
  'lille': 'europe_ouest', 'nice': 'europe_ouest', 'montpellier': 'europe_ouest',
  'madrid': 'europe_ouest', 'barcelone': 'europe_ouest', 'milan': 'europe_ouest',
  'rome': 'europe_ouest', 'bruxelles': 'europe_ouest', 'amsterdam': 'europe_ouest',
  'geneve': 'europe_ouest', 'zurich': 'europe_ouest', 'lisbonne': 'europe_ouest',

  // UK / Irlande
  'londres': 'uk', 'london': 'uk', 'dublin': 'uk',
  'manchester': 'uk', 'birmingham': 'uk',

  // USA / Canada
  'new york': 'usa_canada', 'washington': 'usa_canada', 'miami': 'usa_canada',
  'los angeles': 'usa_canada', 'chicago': 'usa_canada', 'boston': 'usa_canada',
  'houston': 'usa_canada', 'montreal': 'usa_canada', 'toronto': 'usa_canada',
  'vancouver': 'usa_canada',

  // Afrique de l'Ouest
  'abidjan': 'afrique_ouest', 'conakry': 'afrique_ouest', 'bamako': 'afrique_ouest',
  'lome': 'afrique_ouest', 'cotonou': 'afrique_ouest', 'accra': 'afrique_ouest',
  'banjul': 'afrique_ouest', 'bissau': 'afrique_ouest', 'freetown': 'afrique_ouest',
  'ouagadougou': 'afrique_ouest', 'niamey': 'afrique_ouest',

  // Afrique Centrale
  'libreville': 'afrique_centrale', 'douala': 'afrique_centrale',
  'yaounde': 'afrique_centrale', 'kinshasa': 'afrique_centrale',
  'brazzaville': 'afrique_centrale',

  // Moyen-Orient / Dubai
  'dubai': 'moyen_orient_dubai', 'abu dhabi': 'moyen_orient_dubai',
  'riyadh': 'moyen_orient_dubai', 'doha': 'moyen_orient_dubai',
  'koweit': 'moyen_orient_dubai', 'istanbul': 'moyen_orient_dubai',

  // Asie
  'pekin': 'asie', 'beijing': 'asie', 'shanghai': 'asie', 'guangzhou': 'asie',
  'hong kong': 'asie', 'tokyo': 'asie', 'seoul': 'asie',
  'singapour': 'asie', 'bangkok': 'asie',
};

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function resolveZone(destination?: string | null): DeliveryZone {
  if (!destination) return 'europe_ouest';
  const d = normalize(destination);
  for (const [city, zone] of Object.entries(CITY_TO_ZONE)) {
    if (d.includes(city)) return zone;
  }
  return 'europe_ouest';
}

function formatDelayLabel(days: number): string {
  if (days <= 0) return 'Aujourd\'hui';
  if (days < 3) return `${days * 24}h`;
  return `${days} jours`;
}

function formatFrenchDate(d: Date, withYear = true): string {
  return d.toLocaleDateString('fr-FR', withYear
    ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    : { weekday: 'long', day: 'numeric', month: 'long' });
}

export interface DelayResult {
  days: number;
  label: string;
  arrivalDate: Date;
  arrivalLabel: string;
  zone: DeliveryZone;
}

/**
 * Calcule le délai de livraison estimé et la date d'arrivée à partir
 * d'un départ de référence (aujourd'hui + 2j si non précisé).
 */
export function getDeliveryDelay(
  destination: string | null | undefined,
  mode: DeliveryMode,
): DelayResult {
  const zone = resolveZone(destination);
  const days = DELIVERY_DELAYS[mode][zone] ?? (mode === 'express' ? 3 : 6);

  const departureBase = new Date();
  departureBase.setDate(departureBase.getDate() + 2);
  const arrivalDate = new Date(departureBase);
  arrivalDate.setDate(arrivalDate.getDate() + days);

  return {
    days,
    label: formatDelayLabel(days),
    arrivalDate,
    arrivalLabel: formatFrenchDate(arrivalDate, true),
    zone,
  };
}

/**
 * Variante avec une date de départ réelle (départ confirmé Konnekt).
 */
export function getArrivalFromDeparture(
  departureDate: Date | string,
  destination: string | null | undefined,
  mode: DeliveryMode,
): DelayResult {
  const zone = resolveZone(destination);
  const days = DELIVERY_DELAYS[mode][zone] ?? (mode === 'express' ? 3 : 6);

  const departure = new Date(departureDate);
  const arrivalDate = new Date(isNaN(departure.getTime()) ? Date.now() : departure.getTime());
  arrivalDate.setDate(arrivalDate.getDate() + days);

  return {
    days,
    label: formatDelayLabel(days),
    arrivalDate,
    arrivalLabel: formatFrenchDate(arrivalDate, false),
    zone,
  };
}
