// Lightweight heuristic parser to detect a potential GP departure from a
// free-text WhatsApp message: looks for at least one city + one date.

const CITIES: { name: string; country: string }[] = [
  // Sénégal
  { name: 'Dakar', country: 'SN' },
  { name: 'Thiès', country: 'SN' },
  { name: 'Thies', country: 'SN' },
  { name: 'Saint-Louis', country: 'SN' },
  { name: 'Saint Louis', country: 'SN' },
  { name: 'Ziguinchor', country: 'SN' },
  { name: 'Kaolack', country: 'SN' },
  { name: 'Touba', country: 'SN' },
  { name: 'Mbour', country: 'SN' },
  { name: 'Rufisque', country: 'SN' },
  // France
  { name: 'Paris', country: 'FR' },
  { name: 'Lyon', country: 'FR' },
  { name: 'Marseille', country: 'FR' },
  { name: 'Bordeaux', country: 'FR' },
  { name: 'Toulouse', country: 'FR' },
  { name: 'Lille', country: 'FR' },
  { name: 'Nice', country: 'FR' },
  // Europe
  { name: 'Bruxelles', country: 'BE' },
  { name: 'Brussels', country: 'BE' },
  { name: 'Milan', country: 'IT' },
  { name: 'Milano', country: 'IT' },
  { name: 'Rome', country: 'IT' },
  { name: 'Roma', country: 'IT' },
  { name: 'Madrid', country: 'ES' },
  { name: 'Barcelone', country: 'ES' },
  { name: 'Barcelona', country: 'ES' },
  { name: 'Londres', country: 'GB' },
  { name: 'London', country: 'GB' },
  // Afrique
  { name: 'Casablanca', country: 'MA' },
  { name: 'Bamako', country: 'ML' },
  { name: 'Abidjan', country: 'CI' },
  { name: 'Conakry', country: 'GN' },
  { name: 'Lomé', country: 'TG' },
  { name: 'Lome', country: 'TG' },
  { name: 'Cotonou', country: 'BJ' },
  { name: 'Ouagadougou', country: 'BF' },
  { name: 'Niamey', country: 'NE' },
  { name: 'Accra', country: 'GH' },
  { name: 'Nouakchott', country: 'MR' },
  // Amérique
  { name: 'New York', country: 'US' },
  { name: 'Montréal', country: 'CA' },
  { name: 'Montreal', country: 'CA' },
  { name: 'Toronto', country: 'CA' },
];

const MONTHS_FR: Record<string, number> = {
  janv: 1, janvier: 1,
  fev: 2, fevr: 2, fevrier: 2, 'févr': 2, 'février': 2,
  mars: 3,
  avr: 4, avril: 4,
  mai: 5,
  juin: 6,
  juil: 7, juillet: 7,
  aout: 8, 'août': 8,
  sept: 9, septembre: 9,
  oct: 10, octobre: 10,
  nov: 11, novembre: 11,
  dec: 12, 'déc': 12, decembre: 12, 'décembre': 12,
};

export interface ParsedDeparture {
  origin?: { city: string; country: string };
  destination?: { city: string; country: string };
  departureDate?: string; // ISO YYYY-MM-DD
  rawDateMatch?: string;
}

function findCities(msg: string): { city: string; country: string; index: number }[] {
  const found: { city: string; country: string; index: number }[] = [];
  for (const c of CITIES) {
    const re = new RegExp(`\\b${c.name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    const m = msg.match(re);
    if (m && m.index !== undefined) {
      found.push({ city: c.name, country: c.country, index: m.index });
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

function findDate(msg: string): { iso: string; raw: string } | null {
  const now = new Date();
  const currentYear = now.getFullYear();

  // dd/mm or dd-mm or dd.mm (optionally /yyyy)
  const num = msg.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/);
  if (num) {
    const d = parseInt(num[1], 10);
    const m = parseInt(num[2], 10);
    let y = num[3] ? parseInt(num[3], 10) : currentYear;
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return { iso, raw: num[0] };
    }
  }

  // "15 janvier", "le 5 mars 2026"
  const monthNames = Object.keys(MONTHS_FR).join('|');
  const re = new RegExp(`\\b(\\d{1,2})\\s+(${monthNames})\\.?(?:\\s+(\\d{4}))?\\b`, 'i');
  const wm = msg.match(re);
  if (wm) {
    const d = parseInt(wm[1], 10);
    const monthKey = wm[2].toLowerCase().replace('.', '');
    const m = MONTHS_FR[monthKey];
    const y = wm[3] ? parseInt(wm[3], 10) : currentYear;
    if (m && d >= 1 && d <= 31) {
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return { iso, raw: wm[0] };
    }
  }

  return null;
}

/**
 * Detects whether the message looks like a GP departure announcement.
 * Heuristic: at least one known city AND one date.
 */
export function parseDepartureMessage(msg: string | null | undefined): ParsedDeparture | null {
  if (!msg || msg.trim().length < 3) return null;
  const cities = findCities(msg);
  const date = findDate(msg);
  if (cities.length === 0 || !date) return null;

  // Infer direction: look for arrow / "→" / "to" / "vers" / "->"
  const arrowIdx = msg.search(/(→|->|=>|\bvers\b|\bto\b|\bpour\b)/i);
  let origin: ParsedDeparture['origin'];
  let destination: ParsedDeparture['destination'];

  if (arrowIdx > 0 && cities.length >= 2) {
    const before = cities.filter(c => c.index < arrowIdx).pop();
    const after = cities.find(c => c.index > arrowIdx);
    if (before) origin = { city: before.city, country: before.country };
    if (after) destination = { city: after.city, country: after.country };
  }

  if (!origin && !destination) {
    if (cities.length >= 2) {
      origin = { city: cities[0].city, country: cities[0].country };
      destination = { city: cities[1].city, country: cities[1].country };
    } else {
      // Single city → assume destination (most GPs announce "départ pour X")
      destination = { city: cities[0].city, country: cities[0].country };
    }
  }

  return {
    origin,
    destination,
    departureDate: date.iso,
    rawDateMatch: date.raw,
  };
}
