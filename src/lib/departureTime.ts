/**
 * Centralised helpers for displaying the *next departure* across SendFlow,
 * SourcingFlow and any future surface.
 *
 * Goals:
 *  - Always treat the API value (`YYYY-MM-DD`) as a calendar date in the
 *    warehouse timezone (Europe/Paris) so we never drift by a day for users
 *    in other timezones.
 *  - Provide a precise countdown (days / hours / minutes) plus an `urgency`
 *    flag (`<24h`, `<48h`) for discreet inline alerts.
 */

// Yobbanté warehouses operate on Europe/Paris time. Departures are scheduled
// to leave at the start of that local day.
export const WAREHOUSE_TIMEZONE = 'Europe/Paris';

/**
 * Compute the absolute UTC instant matching `YYYY-MM-DD` at 00:00 in the
 * warehouse timezone. Pure + deterministic so it's safe to unit-test.
 */
export function warehouseDateToUtc(dateStr: string): Date {
  // Approximate the warehouse offset for that calendar date by formatting a
  // reference instant in the warehouse TZ and reading back the parts.
  const ref = new Date(`${dateStr}T00:00:00Z`);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: WAREHOUSE_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(ref).map(p => [p.type, p.value]));
  // Difference between the wall-clock we'd see in Paris and the UTC ref tells
  // us the offset for that date.
  const wall = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  const offsetMs = wall - ref.getTime();
  // Departure happens at 00:00 Paris time, so the UTC instant is ref - offset.
  return new Date(ref.getTime() - offsetMs);
}

export interface DepartureCountdown {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  isPast: boolean;
  /** True when departure is in less than 24h. */
  under24h: boolean;
  /** True when departure is in less than 48h (and not under24h). */
  under48h: boolean;
  /** Short label like "dans 2 j 4 h", "dans 6 h 20 min", "départ imminent". */
  label: string;
}

export function getDepartureCountdown(
  dateStr: string | null | undefined,
  now: Date = new Date(),
): DepartureCountdown | null {
  if (!dateStr) return null;
  const target = warehouseDateToUtc(dateStr);
  const totalMs = target.getTime() - now.getTime();
  const isPast = totalMs <= 0;
  const abs = Math.max(0, totalMs);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);

  const under24h = !isPast && totalMs < 24 * 3_600_000;
  const under48h = !isPast && totalMs < 48 * 3_600_000 && !under24h;

  let label: string;
  if (isPast) label = 'départ imminent';
  else if (days >= 1) label = `dans ${days} j ${hours} h`;
  else if (hours >= 1) label = `dans ${hours} h ${minutes} min`;
  else label = `dans ${minutes} min`;

  return { totalMs, days, hours, minutes, isPast, under24h, under48h, label };
}

/**
 * Format the warehouse calendar date in the user's locale, using the
 * warehouse timezone to anchor the day so we never display "yesterday" for
 * users west of Paris.
 */
export function formatDepartureDate(
  dateStr: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' },
  locale = 'fr-FR',
): string {
  if (!dateStr) return '';
  const d = warehouseDateToUtc(dateStr);
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: WAREHOUSE_TIMEZONE }).format(d);
}
