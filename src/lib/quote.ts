// Pricing engine v2 (frontend mirror of calculate_quote_v2).
// Pure / synchronous so the result page can render instantly. Numbers tuned
// to match the SQL engine: zone → base+per-kg → bracket → goods → mode →
// supply (heuristic) → margin (×1.22). Three options expose Express ×1.35,
// Économique ×1.00, Volume ×0.85.

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
  departureIso: string; // YYYY-MM-DD for backend
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
  fallback: boolean;
  requiresManualQuote: boolean;
}

const EUR_TO_XOF = 656; // BCEAO peg
const MARGIN = 1.22;    // platform margin (matches SQL engine)

// Zones with base + €/kg (calibrated from zone_pricing seeds)
const ZONE: Record<string, { base: number; perKg: { air: number; sea: number; road: number }; minDays: [number, number] }> = {
  'Afrique de l\'Ouest':       { base: 12,  perKg: { air: 6,    sea: 3.5, road: 4.5 }, minDays: [1, 4] },
  'Europe':                    { base: 18,  perKg: { air: 9.5,  sea: 5,   road: 6 },   minDays: [3, 7] },
  'Amérique du Nord':          { base: 22,  perKg: { air: 13,   sea: 7,   road: 8 },   minDays: [5, 9] },
  'Moyen-Orient':              { base: 20,  perKg: { air: 11,   sea: 6,   road: 7 },   minDays: [4, 8] },
  'Asie':                      { base: 24,  perKg: { air: 14,   sea: 7.5, road: 9 },   minDays: [6, 12] },
  'Internationale':            { base: 22,  perKg: { air: 12,   sea: 6.5, road: 8 },   minDays: [5, 10] },
};

const TYPE_MULT: Record<GoodsType, number> = {
  standard: 1,
  fragile: 1.2,
  electronique: 1.25,
  cosmetiques: 1.15,
  auto: 1.3,
  haute_valeur: 1.45,
};

function bracketMult(taxable: number): number {
  if (taxable <= 5)    return 1.10;
  if (taxable <= 30)   return 1.00;
  if (taxable <= 100)  return 0.92;
  if (taxable <= 300)  return 0.85;
  return 0.78;
}

// Heuristic supply: deterministic per-route so prices stay stable across reloads.
function supplyMult(seed: string): { mult: number; tone: 'success' | 'warning' | 'muted'; label: string } {
  const h = Array.from(seed).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0);
  const slot = h % 10;
  if (slot < 6) return { mult: 1.00, tone: 'success', label: 'Places disponibles' };
  if (slot < 9) return { mult: 1.05, tone: 'warning', label: 'Dernières disponibilités' };
  return { mult: 0.95, tone: 'success', label: 'Forte disponibilité' };
}

function fmtDate(offsetDays: number): { label: string; iso: string } {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return {
    label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    iso: d.toISOString().slice(0, 10),
  };
}

function detectZone(dest: string): string {
  const d = (dest || '').toLowerCase();
  if (/(paris|france|lyon|marseille|bruxelles|belgique|madrid|espagne|allemagne|berlin|italie|rome|londres|london|uk)/.test(d)) return 'Europe';
  if (/(usa|new york|miami|los angeles|états|etats|canada|montreal|toronto)/.test(d)) return 'Amérique du Nord';
  if (/(dubai|emirates|emirats|riyad|qatar|arabie)/.test(d)) return 'Moyen-Orient';
  if (/(chine|china|shanghai|guangzhou|shenzhen|hong|inde|india|japon|japan|corée|coree)/.test(d)) return 'Asie';
  if (/(dakar|abidjan|bamako|conakry|sénégal|senegal|côte|cote|mali|guinée|guinee|togo|bénin|benin|burkina)/.test(d)) return 'Afrique de l\'Ouest';
  return 'Internationale';
}

export function computeQuote(input: QuoteInput): QuoteResult {
  const realW = Math.max(0.1, Number(input.weightKg) || 0.1);
  // Approx volumetric in absence of dimensions — keep close to /6000 air rule.
  const volumetric = Math.round((realW / 3) * 100) / 100;
  // Min taxable enforced (3 kg air, 1 kg road/sea LCL)
  const minTaxable = input.mode === 'air' ? 3 : 1;
  const taxable = Math.max(realW, volumetric, minTaxable);

  const zoneName = detectZone(input.destination);
  const zoneCfg = ZONE[zoneName] || ZONE['Internationale'];
  const perKg = zoneCfg.perKg[input.mode];

  // base + per-kg
  const rawEur = zoneCfg.base + Math.max(0, taxable - 1) * perKg;
  // multipliers (bracket × goods × supply × margin)
  const supply = supplyMult(`${zoneName}|${input.mode}`);
  const goodsMult = TYPE_MULT[input.type];
  const adjusted = rawEur * bracketMult(taxable) * goodsMult * supply.mult * MARGIN;

  // Three option multipliers
  const expressEur = Math.round(adjusted * 1.35);
  const ecoEur     = Math.round(adjusted * 1.00);
  const volumeEur  = Math.round(adjusted * 0.85);

  const dExpress = fmtDate(2);
  const dEco     = fmtDate(4);
  const dVolume  = fmtDate(6);

  const opts: QuoteOption[] = [
    {
      key: 'express',
      label: 'Express',
      delay: `${zoneCfg.minDays[0]}–${Math.max(zoneCfg.minDays[0] + 1, zoneCfg.minDays[1] - 2)} jours`,
      priceEur: expressEur,
      priceXof: Math.round(expressEur * EUR_TO_XOF / 100) * 100,
      departure: `Départ ${dExpress.label}`,
      departureIso: dExpress.iso,
      supply: supply.mult >= 1.05 ? 'Dernières disponibilités' : supply.label,
      supplyTone: supply.mult >= 1.05 ? 'warning' : 'success',
    },
    {
      key: 'eco',
      label: 'Économique',
      delay: `${zoneCfg.minDays[0] + 1}–${zoneCfg.minDays[1]} jours`,
      priceEur: ecoEur,
      priceXof: Math.round(ecoEur * EUR_TO_XOF / 100) * 100,
      departure: `Départ ${dEco.label}`,
      departureIso: dEco.iso,
      supply: supply.label,
      supplyTone: supply.tone,
      featured: true,
      badge: 'Meilleur rapport qualité-prix',
      badgeTone: 'success',
    },
  ];

  if (taxable >= 30) {
    opts.push({
      key: 'volume',
      label: 'Volume',
      delay: `${zoneCfg.minDays[1]}–${zoneCfg.minDays[1] + 3} jours`,
      priceEur: volumeEur,
      priceXof: Math.round(volumeEur * EUR_TO_XOF / 100) * 100,
      departure: `Départ ${dVolume.label}`,
      departureIso: dVolume.iso,
      supply: 'Places disponibles',
      supplyTone: 'muted',
      badge: 'Pour les gros envois',
      badgeTone: 'warning',
    });
  }

  // Manual quote required for >300kg or unknown zone
  const requiresManualQuote = taxable > 300;
  const fallback = !ZONE[zoneName];

  return {
    options: opts,
    taxableWeight: Math.round(taxable * 10) / 10,
    volumetricWeight: volumetric,
    zone: zoneName,
    fallback,
    requiresManualQuote,
  };
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
