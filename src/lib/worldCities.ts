import type { CityOption } from '@/components/flows/FlowPrimitives';

/** Curated list of major world cities (origin) + West-Africa destinations. */
const RAW: Array<Omit<CityOption, 'id'>> = [
  // ── Asia
  { city: 'Shenzhen',  country: 'CN', countryLabel: 'Chine',     flag: '🇨🇳' },
  { city: 'Guangzhou', country: 'CN', countryLabel: 'Chine',     flag: '🇨🇳' },
  { city: 'Shanghai',  country: 'CN', countryLabel: 'Chine',     flag: '🇨🇳' },
  { city: 'Yiwu',      country: 'CN', countryLabel: 'Chine',     flag: '🇨🇳' },
  { city: 'Pékin',     country: 'CN', countryLabel: 'Chine',     flag: '🇨🇳' },
  { city: 'Hong Kong', country: 'HK', countryLabel: 'Hong Kong', flag: '🇭🇰' },
  { city: 'Tokyo',     country: 'JP', countryLabel: 'Japon',     flag: '🇯🇵' },
  { city: 'Séoul',     country: 'KR', countryLabel: 'Corée du Sud', flag: '🇰🇷' },
  { city: 'Singapour', country: 'SG', countryLabel: 'Singapour', flag: '🇸🇬' },
  { city: 'Bangkok',   country: 'TH', countryLabel: 'Thaïlande', flag: '🇹🇭' },
  { city: 'Mumbai',    country: 'IN', countryLabel: 'Inde',      flag: '🇮🇳' },
  { city: 'Delhi',     country: 'IN', countryLabel: 'Inde',      flag: '🇮🇳' },
  { city: 'Istanbul',  country: 'TR', countryLabel: 'Turquie',   flag: '🇹🇷' },

  // ── Middle East
  { city: 'Dubai',     country: 'AE', countryLabel: 'Émirats arabes unis', flag: '🇦🇪' },
  { city: 'Abu Dhabi', country: 'AE', countryLabel: 'Émirats arabes unis', flag: '🇦🇪' },
  { city: 'Doha',      country: 'QA', countryLabel: 'Qatar',     flag: '🇶🇦' },

  // ── Europe
  { city: 'Paris',      country: 'FR', countryLabel: 'France',     flag: '🇫🇷' },
  { city: 'Marseille',  country: 'FR', countryLabel: 'France',     flag: '🇫🇷' },
  { city: 'Lyon',       country: 'FR', countryLabel: 'France',     flag: '🇫🇷' },
  { city: 'Bordeaux',   country: 'FR', countryLabel: 'France',     flag: '🇫🇷' },
  { city: 'Londres',    country: 'GB', countryLabel: 'Royaume-Uni',flag: '🇬🇧' },
  { city: 'Bruxelles',  country: 'BE', countryLabel: 'Belgique',   flag: '🇧🇪' },
  { city: 'Amsterdam',  country: 'NL', countryLabel: 'Pays-Bas',   flag: '🇳🇱' },
  { city: 'Rotterdam',  country: 'NL', countryLabel: 'Pays-Bas',   flag: '🇳🇱' },
  { city: 'Hambourg',   country: 'DE', countryLabel: 'Allemagne',  flag: '🇩🇪' },
  { city: 'Berlin',     country: 'DE', countryLabel: 'Allemagne',  flag: '🇩🇪' },
  { city: 'Francfort',  country: 'DE', countryLabel: 'Allemagne',  flag: '🇩🇪' },
  { city: 'Madrid',     country: 'ES', countryLabel: 'Espagne',    flag: '🇪🇸' },
  { city: 'Barcelone',  country: 'ES', countryLabel: 'Espagne',    flag: '🇪🇸' },
  { city: 'Milan',      country: 'IT', countryLabel: 'Italie',     flag: '🇮🇹' },
  { city: 'Rome',       country: 'IT', countryLabel: 'Italie',     flag: '🇮🇹' },
  { city: 'Lisbonne',   country: 'PT', countryLabel: 'Portugal',   flag: '🇵🇹' },
  { city: 'Genève',     country: 'CH', countryLabel: 'Suisse',     flag: '🇨🇭' },

  // ── Americas
  { city: 'Miami',      country: 'US', countryLabel: 'États-Unis', flag: '🇺🇸' },
  { city: 'New York',   country: 'US', countryLabel: 'États-Unis', flag: '🇺🇸' },
  { city: 'Los Angeles',country: 'US', countryLabel: 'États-Unis', flag: '🇺🇸' },
  { city: 'Houston',    country: 'US', countryLabel: 'États-Unis', flag: '🇺🇸' },
  { city: 'Atlanta',    country: 'US', countryLabel: 'États-Unis', flag: '🇺🇸' },
  { city: 'Montréal',   country: 'CA', countryLabel: 'Canada',     flag: '🇨🇦' },
  { city: 'Toronto',    country: 'CA', countryLabel: 'Canada',     flag: '🇨🇦' },
  { city: 'São Paulo',  country: 'BR', countryLabel: 'Brésil',     flag: '🇧🇷' },

  // ── Africa
  { city: 'Casablanca', country: 'MA', countryLabel: 'Maroc',      flag: '🇲🇦' },
  { city: 'Le Caire',   country: 'EG', countryLabel: 'Égypte',     flag: '🇪🇬' },
  { city: 'Tunis',      country: 'TN', countryLabel: 'Tunisie',    flag: '🇹🇳' },
];

const DEST_RAW: Array<Omit<CityOption, 'id'>> = [
  // ── West Africa (priority destinations)
  { city: 'Dakar',       country: 'SN', countryLabel: 'Sénégal',         flag: '🇸🇳' },
  { city: 'Thiès',       country: 'SN', countryLabel: 'Sénégal',         flag: '🇸🇳' },
  { city: 'Saint-Louis', country: 'SN', countryLabel: 'Sénégal',         flag: '🇸🇳' },
  { city: 'Ziguinchor',  country: 'SN', countryLabel: 'Sénégal',         flag: '🇸🇳' },
  { city: 'Abidjan',     country: 'CI', countryLabel: "Côte d'Ivoire",   flag: '🇨🇮' },
  { city: 'Yamoussoukro',country: 'CI', countryLabel: "Côte d'Ivoire",   flag: '🇨🇮' },
  { city: 'Bamako',      country: 'ML', countryLabel: 'Mali',            flag: '🇲🇱' },
  { city: 'Conakry',     country: 'GN', countryLabel: 'Guinée',          flag: '🇬🇳' },
  { city: 'Ouagadougou', country: 'BF', countryLabel: 'Burkina Faso',    flag: '🇧🇫' },
  { city: 'Lomé',        country: 'TG', countryLabel: 'Togo',            flag: '🇹🇬' },
  { city: 'Cotonou',     country: 'BJ', countryLabel: 'Bénin',           flag: '🇧🇯' },
  { city: 'Niamey',      country: 'NE', countryLabel: 'Niger',           flag: '🇳🇪' },
  { city: 'Nouakchott',  country: 'MR', countryLabel: 'Mauritanie',      flag: '🇲🇷' },
  { city: 'Banjul',      country: 'GM', countryLabel: 'Gambie',          flag: '🇬🇲' },
  { city: 'Bissau',      country: 'GW', countryLabel: 'Guinée-Bissau',   flag: '🇬🇼' },
  { city: 'Libreville',  country: 'GA', countryLabel: 'Gabon',           flag: '🇬🇦' },
  { city: 'Douala',      country: 'CM', countryLabel: 'Cameroun',        flag: '🇨🇲' },
  { city: 'Yaoundé',     country: 'CM', countryLabel: 'Cameroun',        flag: '🇨🇲' },
  { city: 'Kinshasa',    country: 'CD', countryLabel: 'RD Congo',        flag: '🇨🇩' },
];

const withId = (l: Array<Omit<CityOption, 'id'>>): CityOption[] =>
  l.map(c => ({ ...c, id: `${c.country}-${c.city}` }));

export const ORIGIN_CITIES: CityOption[] = withId(RAW);
export const DESTINATION_CITIES: CityOption[] = withId(DEST_RAW);

/** IDs of "popular" cities pinned at the top of the selectors. */
export const POPULAR_ORIGIN_IDS = ['FR-Paris', 'FR-Lyon', 'FR-Marseille', 'AE-Dubai', 'CN-Shenzhen', 'CN-Guangzhou', 'US-New York', 'CA-Montréal'];
export const POPULAR_DEST_IDS   = ['SN-Dakar', 'CI-Abidjan', 'ML-Bamako', 'GN-Conakry', 'BF-Ouagadougou', 'TG-Lomé', 'CM-Douala', 'GA-Libreville'];

export function findCity(list: CityOption[], id: string | null): CityOption | null {
  if (!id) return null;
  return list.find(c => c.id === id) ?? null;
}
