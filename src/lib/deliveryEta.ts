// Estimation de la date d'arrivée par continent (jours calendaires depuis le départ).
// Règles Yobbanté :
//   - Paris (FR) : J+1
//   - Reste Europe : J+2
//   - Amériques : J+3
//   - Afrique : J+1
//   - Asie / Moyen-Orient : J+4

const EUROPE = new Set(['FR', 'BE', 'ES', 'IT', 'DE', 'NL', 'PT', 'CH', 'LU', 'AT', 'GB', 'IE']);
const AMERICAS = new Set(['US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE']);
const AFRICA = new Set(['SN', 'ML', 'CI', 'BF', 'GN', 'GW', 'MR', 'GM', 'NE', 'TG', 'BJ', 'MA', 'DZ', 'TN', 'CM', 'GA', 'CD', 'CG', 'NG', 'GH']);
const ASIA_ME = new Set(['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'TR', 'CN', 'HK', 'JP', 'KR', 'SG', 'MY', 'TH', 'IN', 'VN', 'ID', 'PH']);

export function getDelaiJours(country?: string | null, city?: string | null): number {
  const c = (country ?? '').toUpperCase();
  const v = (city ?? '').trim().toLowerCase();
  if (c === 'FR' && v === 'paris') return 1;
  if (EUROPE.has(c)) return 2;
  if (AMERICAS.has(c)) return 3;
  if (AFRICA.has(c)) return 1;
  if (ASIA_ME.has(c)) return 4;
  return 3;
}

export function estimateArrivalDate(opts: {
  destinationCountry?: string | null;
  destinationCity?: string | null;
  departureDate?: string | Date | null;
}): Date {
  const days = getDelaiJours(opts.destinationCountry, opts.destinationCity);
  const base = opts.departureDate ? new Date(opts.departureDate) : new Date();
  if (isNaN(base.getTime())) return new Date(Date.now() + days * 86400000);
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatFrenchDate(d: Date): string {
  const day = d.getDate();
  const dayStr = day === 1 ? '1er' : String(day);
  const months = [
    'janvier','février','mars','avril','mai','juin',
    'juillet','août','septembre','octobre','novembre','décembre'
  ];
  return `${dayStr} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
