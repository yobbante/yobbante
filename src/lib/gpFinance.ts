// Helpers for GP financial calculations and labels.

export type PaymentMethod = 'wave' | 'orange_money' | 'cash';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  cash: 'Cash',
};

export type GpRoutesMap = Record<string, number>;

/**
 * Build a route key from origin and destination cities.
 * Normalised lower-case, hyphen-separated, no accents.
 */
export function routeKey(origin?: string | null, destination?: string | null): string {
  const norm = (s: string) =>
    s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
  const o = origin ? norm(origin) : '';
  const d = destination ? norm(destination) : '';
  if (!o && !d) return '';
  if (!o) return d;
  if (!d) return o;
  return `${o}-${d}`;
}

/**
 * Suggested rate for a GP on a given dossier.
 * Tries route-specific rate first, then default per-kg rate.
 */
export function suggestedGpAmount(opts: {
  weightKg?: number | null;
  defaultRatePerKg?: number | null;
  routes?: GpRoutesMap | null;
  origin?: string | null;
  destination?: string | null;
}): number | null {
  const w = Number(opts.weightKg ?? 0);
  if (!w || w <= 0) return null;

  const k = routeKey(opts.origin, opts.destination);
  if (k && opts.routes && Number(opts.routes[k]) > 0) {
    return Math.round(Number(opts.routes[k]) * w);
  }
  const fwd = opts.destination ? routeKey(null, opts.destination) : '';
  if (fwd && opts.routes && Number(opts.routes[fwd]) > 0) {
    return Math.round(Number(opts.routes[fwd]) * w);
  }
  if (opts.defaultRatePerKg && opts.defaultRatePerKg > 0) {
    return Math.round(opts.defaultRatePerKg * w);
  }
  return null;
}

export function formatXof(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return `${Math.round(n).toLocaleString('fr-FR')} XOF`;
}

export function marginPercent(client?: number | null, gp?: number | null): number {
  const c = Number(client ?? 0);
  const g = Number(gp ?? 0);
  if (c <= 0) return 0;
  return Math.round(((c - g) / c) * 100);
}

/** Strip accents — for WhatsApp-safe outbound. */
export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}
