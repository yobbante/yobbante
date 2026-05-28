/**
 * "À partir de" pricing — affichage public le plus attractif et dynamique.
 *
 * Le tarif "à partir de" dépend du corridor : on prend le tarif par défaut
 * (route_default_rates) du pays NON-Dakar de la route, puis on applique :
 *
 *   total = rate_per_kg(zone corridor) × poids × 1.20 (marge Yobbanté)
 *         + 5 000 FCFA d'enlèvement Dakar centre (zone par défaut)
 *
 * Le client découvre les surcoûts réels (banlieue / hors Dakar, livraison
 * carrier à destination, type de marchandise) plus tard dans le flow d'envoi.
 *
 * Exemples (poids = 1 kg) :
 *  - Dakar ↔ Paris       (FR, 6 000) → 12 200 FCFA
 *  - Dakar ↔ Abidjan     (CI, 3 500) →  9 200 FCFA
 *  - Dakar ↔ Montréal    (CA, 7 500) → 14 000 FCFA
 *  - Dakar ↔ Dubai       (AE, 7 000) → 13 400 FCFA
 *  - Dakar ↔ New York    (US, 8 000) → 14 600 FCFA
 *
 * NB : les valeurs reflètent la table `route_default_rates` (zones FCFA/kg).
 * Si la table évolue côté admin, mettre ces constantes à jour en miroir
 * (la lecture en direct ferait un round-trip réseau pour chaque frappe au
 * clavier sur la landing — pas souhaitable).
 */

export const YOBBANTE_MARGIN = 1.20;
export const DAKAR_CENTRE_ENLEVEMENT = 5000;

/** Tarif FCFA/kg par zone — miroir de `public.route_default_rates`. */
export const ZONE_RATE_PER_KG = {
  europe_ouest: 6000,        // FR, ES, IT, PT, BE, NL, CH, AT, DE, LU
  europe_nord: 6500,         // GB, IE, SE, NO, DK, FI
  amerique_nord: 8000,       // US
  amerique_nord_canada: 7500, // CA
  afrique_ouest: 3500,       // CI, GN, ML, SN, GW, SL, BF, TG, BJ, NE
  afrique_centrale: 4000,    // CM, GA, CG, CD, CF, TD
  moyen_orient: 7000,        // AE, SA, QA, KW, BH, OM
  asie: 9000,                // CN, JP, KR, SG, HK, TH, MY, VN
  autre: 6000,               // fallback raisonnable
} as const;

export type CorridorZone = keyof typeof ZONE_RATE_PER_KG;

/** ISO-2 pays → zone du tarif par défaut. */
const COUNTRY_TO_ZONE: Record<string, CorridorZone> = {
  // europe_ouest
  FR: 'europe_ouest', ES: 'europe_ouest', IT: 'europe_ouest', PT: 'europe_ouest',
  BE: 'europe_ouest', NL: 'europe_ouest', CH: 'europe_ouest', AT: 'europe_ouest',
  DE: 'europe_ouest', LU: 'europe_ouest',
  // europe_nord
  GB: 'europe_nord', IE: 'europe_nord', SE: 'europe_nord', NO: 'europe_nord',
  DK: 'europe_nord', FI: 'europe_nord',
  // amériques
  US: 'amerique_nord',
  CA: 'amerique_nord_canada',
  // afrique_ouest
  CI: 'afrique_ouest', GN: 'afrique_ouest', ML: 'afrique_ouest', SN: 'afrique_ouest',
  GW: 'afrique_ouest', SL: 'afrique_ouest', BF: 'afrique_ouest', TG: 'afrique_ouest',
  BJ: 'afrique_ouest', NE: 'afrique_ouest',
  // afrique_centrale
  CM: 'afrique_centrale', GA: 'afrique_centrale', CG: 'afrique_centrale',
  CD: 'afrique_centrale', CF: 'afrique_centrale', TD: 'afrique_centrale',
  // moyen_orient
  AE: 'moyen_orient', SA: 'moyen_orient', QA: 'moyen_orient', KW: 'moyen_orient',
  BH: 'moyen_orient', OM: 'moyen_orient',
  // asie
  CN: 'asie', JP: 'asie', KR: 'asie', SG: 'asie', HK: 'asie',
  TH: 'asie', MY: 'asie', VN: 'asie',
  // sénégal traité à part (corridor domestique → afrique_ouest)
};

export function corridorZone(
  originCountry?: string | null,
  destinationCountry?: string | null,
): CorridorZone {
  // Le tarif se calcule sur l'extrémité NON-Dakar de la route.
  const o = (originCountry || '').toUpperCase();
  const d = (destinationCountry || '').toUpperCase();
  const other = o === 'SN' ? d : o; // si Dakar est en origine on regarde la destination
  if (!other) return 'autre';
  return COUNTRY_TO_ZONE[other] ?? 'autre';
}

export function ratePerKgForCorridor(
  originCountry?: string | null,
  destinationCountry?: string | null,
): number {
  return ZONE_RATE_PER_KG[corridorZone(originCountry, destinationCountry)];
}

export function lowestStartingPriceFcfa(
  weightKg: number,
  originCountry?: string | null,
  destinationCountry?: string | null,
): number {
  const w = Math.max(0.5, Number(weightKg) || 0);
  const rate = ratePerKgForCorridor(originCountry, destinationCountry);
  return Math.round(rate * w * YOBBANTE_MARGIN + DAKAR_CENTRE_ENLEVEMENT);
}

export function formatStartingFromFcfa(
  weightKg: number,
  originCountry?: string | null,
  destinationCountry?: string | null,
): string {
  const n = lowestStartingPriceFcfa(weightKg, originCountry, destinationCountry);
  return `À partir de ${n.toLocaleString('fr-FR')} FCFA`;
}
