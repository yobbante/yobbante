// Pure pricing helpers for the public quote flow.
// All amounts are integers — we never display decimals.

export type ServiceMode = 'send' | 'sourcing' | 'reception';
export type TransportMode = 'air' | 'sea' | 'road';
export type GoodsType = 'standard' | 'fragile' | 'electronique' | 'auto' | 'haute_valeur' | 'cosmetiques';

export interface QuoteInput {
  service: ServiceMode;
  origin: string;
  destination: string;
  weightKg: number;
  mode: TransportMode;
  type: GoodsType;
  // sourcing-specific
  query?: string;
  budgetEur?: number;
  sourcingCountry?: string;
  // reception-specific
  merchant?: string;
  merchantCountry?: string;
  estimatedValueEur?: number;
}

export interface QuoteOption {
  key: 'express' | 'eco' | 'volume';
  label: string;
  delay: string;
  priceEur: number;
  priceXof: number;
  departure: string;
  supply: string;
  supplyTone: 'success' | 'warning' | 'muted';
  featured?: boolean;
  badge?: string;
  badgeTone?: 'success' | 'warning';
}

export interface QuoteResult {
  options: QuoteOption[];
  taxableWeight: number;
  volumetricWeight: number;
  zone: string;
}

const EUR_TO_XOF = 656; // BCEAO peg

const TYPE_MULT: Record<GoodsType, number> = {
  standard: 1,
  fragile: 1.2,
  electronique: 1.25,
  cosmetiques: 1.15,
  auto: 1.3,
  haute_valeur: 1.45,
};

const MODE_MULT: Record<TransportMode, number> = {
  air: 1,
  sea: 0.55,
  road: 0.75,
};

function fmtDate(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function computeQuote(input: QuoteInput): QuoteResult {
  const w = Math.max(0.5, Number(input.weightKg) || 0.5);
  // No volume input in v1 — volumetric is approx (1/3 of weight as placeholder).
  const volumetric = Math.round(w / 3);
  const taxable = Math.max(w, volumetric);

  const baseEur = 8 + taxable * 8.5; // base €/kg, very rough
  const adjusted = baseEur * TYPE_MULT[input.type] * MODE_MULT[input.mode];

  const expressEur = Math.round(adjusted * 1.35);
  const ecoEur = Math.round(adjusted);
  const volumeEur = Math.round(adjusted * 0.85);

  const opts: QuoteOption[] = [
    {
      key: 'express',
      label: 'Express',
      delay: '1–4 jours',
      priceEur: expressEur,
      priceXof: Math.round(expressEur * EUR_TO_XOF),
      departure: `Départ ${fmtDate(2)}`,
      supply: 'Dernières disponibilités',
      supplyTone: 'warning',
    },
    {
      key: 'eco',
      label: 'Économique',
      delay: '3–5 jours',
      priceEur: ecoEur,
      priceXof: Math.round(ecoEur * EUR_TO_XOF),
      departure: `Départ ${fmtDate(4)}`,
      supply: 'Places disponibles',
      supplyTone: 'success',
      featured: true,
      badge: 'Meilleur rapport qualité-prix',
      badgeTone: 'success',
    },
  ];

  if (taxable >= 30) {
    opts.push({
      key: 'volume',
      label: 'Volume',
      delay: '5–7 jours',
      priceEur: volumeEur,
      priceXof: Math.round(volumeEur * EUR_TO_XOF),
      departure: `Départ ${fmtDate(6)}`,
      supply: 'Places disponibles',
      supplyTone: 'muted',
      badge: 'Pour les gros envois',
      badgeTone: 'warning',
    });
  }

  return {
    options: opts,
    taxableWeight: Math.round(taxable),
    volumetricWeight: volumetric,
    zone: detectZone(input.destination),
  };
}

function detectZone(dest: string): string {
  const d = dest.toLowerCase();
  if (/(paris|france|lyon|marseille|bruxelles|belgique|madrid|espagne|allemagne|berlin|italie|rome)/.test(d)) return 'Europe';
  if (/(usa|new york|miami|los angeles|états|etats)/.test(d)) return 'Amérique du Nord';
  if (/(dubai|emirates|emirats|riyad|qatar)/.test(d)) return 'Moyen-Orient';
  if (/(chine|china|shanghai|guangzhou|hong)/.test(d)) return 'Asie';
  if (/(dakar|abidjan|bamako|conakry|sénégal|senegal|côte|cote)/.test(d)) return 'Afrique de l\'Ouest';
  return 'Internationale';
}

export const fmtEur = (n: number) => `${Math.round(n).toLocaleString('fr-FR').replace(/,/g, ' ')} €`;
export const fmtXof = (n: number) => `${Math.round(n).toLocaleString('fr-FR').replace(/,/g, ' ')} XOF`;

// localStorage handoff between screens
const KEY = 'yobbante.quoteDraft';
export function saveDraft(input: QuoteInput, selected?: QuoteOption['key']) {
  try { localStorage.setItem(KEY, JSON.stringify({ input, selected })); } catch { /* */ }
}
export function loadDraft(): { input: QuoteInput; selected?: QuoteOption['key'] } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
