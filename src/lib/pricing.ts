// Live transport pricing engine for the Confier-mon-dossier wizard.
// Returns an estimate range in EUR based on weight × per-kg tariff,
// with multipliers for urgency.

export type Transport = 'gp' | 'air' | 'sea' | 'road';
export type Urgency = 'standard' | 'express' | 'priority';

export const TRANSPORT_RATES: Record<Transport, { perKg: number; baseFee: number; spread: number; minTotal: number }> = {
  gp:   { perKg: 9,    baseFee: 5,  spread: 0.20, minTotal: 15 },   // GP: 8–11 €/kg
  air:  { perKg: 14,   baseFee: 12, spread: 0.22, minTotal: 25 },   // Aérien: 11–17 €/kg
  sea:  { perKg: 1.2,  baseFee: 80, spread: 0.30, minTotal: 90 },   // Maritime: lourd, base élevée
  road: { perKg: 4,    baseFee: 25, spread: 0.30, minTotal: 35 },   // Routier régional
};

const URGENCY_MULT: Record<Urgency, number> = {
  standard: 1,
  express: 1.25,
  priority: 1.5,
};

export interface PriceEstimate {
  min: number;
  max: number;
  formatted: string;     // "120 – 165 €"
  perKgFormatted: string; // "~8 €/kg"
}

export function estimateTransport(
  transport: Transport,
  weightKg: number,
  urgency: Urgency = 'standard',
): PriceEstimate {
  const r = TRANSPORT_RATES[transport];
  const w = Math.max(0.5, weightKg);
  const mult = URGENCY_MULT[urgency];

  const center = (r.baseFee + r.perKg * w) * mult;
  const min = Math.max(r.minTotal, Math.round(center * (1 - r.spread / 2)));
  const max = Math.max(min + 5, Math.round(center * (1 + r.spread / 2)));

  return {
    min,
    max,
    formatted: `${min.toLocaleString('fr-FR')} – ${max.toLocaleString('fr-FR')} €`,
    perKgFormatted: `~${r.perKg} €/kg`,
  };
}
