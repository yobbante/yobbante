import type { CityOption } from '@/components/flows/FlowPrimitives';

/**
 * STRICT predefined city list (36 cities).
 *
 * Yobbanté opère exclusivement entre Dakar (hub central) et l'une des villes
 * ci-dessous. Tous les sélecteurs de ville n'exposent QUE ces 36 villes.
 * L'autre extrémité de la route est TOUJOURS forcée à Dakar (voir HUB_DAKAR).
 */
const RAW: Array<Omit<CityOption, 'id'>> = [
  { city: 'Abidjan',         country: 'CI', countryLabel: "Côte d'Ivoire",                flag: '🇨🇮' },
  { city: 'Alméria',         country: 'ES', countryLabel: 'Espagne',                      flag: '🇪🇸' },
  { city: 'Bamako',          country: 'ML', countryLabel: 'Mali',                         flag: '🇲🇱' },
  { city: 'Barcelone',       country: 'ES', countryLabel: 'Espagne',                      flag: '🇪🇸' },
  { city: 'Berlin',          country: 'DE', countryLabel: 'Allemagne',                    flag: '🇩🇪' },
  { city: 'Beyrouth',        country: 'LB', countryLabel: 'Liban',                        flag: '🇱🇧' },
  { city: 'Bordeaux',        country: 'FR', countryLabel: 'France',                       flag: '🇫🇷' },
  { city: 'Brazzaville',     country: 'CG', countryLabel: 'République du Congo',          flag: '🇨🇬' },
  { city: 'Bruxelles',       country: 'BE', countryLabel: 'Belgique',                     flag: '🇧🇪' },
  { city: 'Casablanca',      country: 'MA', countryLabel: 'Maroc',                        flag: '🇲🇦' },
  { city: 'Conakry',         country: 'GN', countryLabel: 'Guinée',                       flag: '🇬🇳' },
  { city: 'Douala',          country: 'CM', countryLabel: 'Cameroun',                     flag: '🇨🇲' },
  { city: 'Dubaï',           country: 'AE', countryLabel: 'Émirats Arabes Unis',          flag: '🇦🇪' },
  { city: 'Düsseldorf',      country: 'DE', countryLabel: 'Allemagne',                    flag: '🇩🇪' },
  { city: 'Gatineau',        country: 'CA', countryLabel: 'Canada',                       flag: '🇨🇦' },
  { city: 'Genève',          country: 'CH', countryLabel: 'Suisse',                       flag: '🇨🇭' },
  { city: 'Istanbul',        country: 'TR', countryLabel: 'Turquie',                      flag: '🇹🇷' },
  { city: 'Kinshasa',        country: 'CD', countryLabel: 'République Démocratique du Congo', flag: '🇨🇩' },
  { city: 'Libreville',      country: 'GA', countryLabel: 'Gabon',                        flag: '🇬🇦' },
  { city: 'Lille',           country: 'FR', countryLabel: 'France',                       flag: '🇫🇷' },
  { city: 'Lyon',            country: 'FR', countryLabel: 'France',                       flag: '🇫🇷' },
  { city: 'Madrid',          country: 'ES', countryLabel: 'Espagne',                      flag: '🇪🇸' },
  { city: 'Malabo',          country: 'GQ', countryLabel: 'Guinée Équatoriale',           flag: '🇬🇶' },
  { city: 'Marseille',       country: 'FR', countryLabel: 'France',                       flag: '🇫🇷' },
  { city: 'Milan',           country: 'IT', countryLabel: 'Italie',                       flag: '🇮🇹' },
  { city: 'Montpellier',     country: 'FR', countryLabel: 'France',                       flag: '🇫🇷' },
  { city: 'Montréal',        country: 'CA', countryLabel: 'Canada',                       flag: '🇨🇦' },
  { city: "N'Djamena",       country: 'TD', countryLabel: 'Tchad',                        flag: '🇹🇩' },
  { city: 'New York',        country: 'US', countryLabel: 'États-Unis',                   flag: '🇺🇸' },
  { city: 'Nîmes',           country: 'FR', countryLabel: 'France',                       flag: '🇫🇷' },
  { city: 'Ottawa',          country: 'CA', countryLabel: 'Canada',                       flag: '🇨🇦' },
  { city: 'Paris',           country: 'FR', countryLabel: 'France',                       flag: '🇫🇷' },
  { city: 'Providence',      country: 'US', countryLabel: 'États-Unis',                   flag: '🇺🇸' },
  { city: 'Rennes',          country: 'FR', countryLabel: 'France',                       flag: '🇫🇷' },
  { city: 'Rouen',           country: 'FR', countryLabel: 'France',                       flag: '🇫🇷' },
  { city: 'Washington',      country: 'US', countryLabel: 'États-Unis',                   flag: '🇺🇸' },
  { city: 'Yaoundé',         country: 'CM', countryLabel: 'Cameroun',                     flag: '🇨🇲' },
];

const withId = (l: Array<Omit<CityOption, 'id'>>): CityOption[] =>
  l.map(c => ({ ...c, id: `${c.country}-${c.city}` }));

export const ALL_CITIES: CityOption[] = withId(RAW);

/**
 * Hub central Yobbanté — toujours forcé comme une des deux extrémités de
 * chaque route (origine OU destination, selon le sens du flow).
 * N'apparaît PAS dans les listes sélectionnables.
 */
export const HUB_DAKAR: CityOption = {
  id: 'SN-Dakar',
  city: 'Dakar',
  country: 'SN',
  countryLabel: 'Sénégal',
  flag: '🇸🇳',
};

export const ORIGIN_CITIES: CityOption[] = ALL_CITIES;
export const DESTINATION_CITIES: CityOption[] = ALL_CITIES;

/** Villes mises en avant (pinned) en tête des sélecteurs. */
const POPULAR = [
  'FR-Paris', 'CA-Montréal', 'FR-Lyon', 'AE-Dubaï',
  'CI-Abidjan', 'FR-Marseille', 'ML-Bamako', 'CM-Douala',
  'US-New York', 'ES-Madrid', 'BE-Bruxelles', 'GA-Libreville',
];

export const POPULAR_ORIGIN_IDS = POPULAR;
export const POPULAR_DEST_IDS = POPULAR;

export function findCity(list: CityOption[], id: string | null): CityOption | null {
  if (!id) return null;
  return list.find(c => c.id === id) ?? null;
}
