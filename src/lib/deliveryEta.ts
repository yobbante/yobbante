// Estimation de la date d'arrivée par pays (jours calendaires depuis le départ).
// Valeurs indicatives — toujours afficher "(estimation)" à côté de la date.

const DELAI_PAR_PAYS: Record<string, number> = {
  // Europe Schengen
  FR: 5, BE: 5, ES: 5, IT: 5, DE: 5, NL: 5, PT: 5, CH: 5, LU: 5, AT: 5,
  // UK & Irlande
  GB: 6, IE: 6,
  // Amérique du Nord
  US: 8, CA: 8,
  // Afrique de l'Ouest
  SN: 1, ML: 3, CI: 3, BF: 3, GN: 3, GW: 3, MR: 3, GM: 3, NE: 4, TG: 4, BJ: 4,
  // Moyen-Orient
  AE: 7, SA: 7, QA: 7, KW: 7, BH: 7, OM: 7, TR: 7,
  // Asie
  CN: 10, HK: 10, JP: 10, KR: 10, SG: 10, MY: 10, TH: 10, IN: 10, VN: 10, ID: 10,
  // Maghreb
  MA: 4, DZ: 4, TN: 4,
};

export function getDelaiJours(country?: string | null): number {
  if (!country) return 7;
  return DELAI_PAR_PAYS[country.toUpperCase()] ?? 7;
}

export function estimateArrivalDate(opts: {
  destinationCountry?: string | null;
  departureDate?: string | Date | null;
}): Date {
  const days = getDelaiJours(opts.destinationCountry);
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
