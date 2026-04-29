import { describe, it, expect } from 'vitest';
import {
  getDepartureCountdown,
  formatDepartureDate,
  warehouseDateToUtc,
} from '@/lib/departureTime';

describe('departureTime', () => {
  it('anchors the date at 00:00 in the warehouse timezone (Europe/Paris)', () => {
    // 2026-06-15 in Paris (CEST, +02:00) → 2026-06-14T22:00:00Z
    const utc = warehouseDateToUtc('2026-06-15');
    expect(utc.toISOString()).toBe('2026-06-14T22:00:00.000Z');
  });

  it('formats the date consistently regardless of the user locale offset', () => {
    // User in Dakar (UTC) should still see "lundi 15 juin"
    const out = formatDepartureDate('2026-06-15');
    expect(out.toLowerCase()).toContain('15');
    expect(out.toLowerCase()).toContain('juin');
  });

  it('returns null when no date is provided', () => {
    expect(getDepartureCountdown(null)).toBeNull();
    expect(getDepartureCountdown(undefined)).toBeNull();
  });

  it('flags departures under 24h', () => {
    const target = warehouseDateToUtc('2026-06-15');
    const now = new Date(target.getTime() - 6 * 3_600_000); // 6h before
    const c = getDepartureCountdown('2026-06-15', now)!;
    expect(c.under24h).toBe(true);
    expect(c.under48h).toBe(false);
    expect(c.hours).toBe(6);
    expect(c.label).toMatch(/^dans 6 h/);
  });

  it('flags departures under 48h (but not under 24h)', () => {
    const target = warehouseDateToUtc('2026-06-15');
    const now = new Date(target.getTime() - 36 * 3_600_000); // 36h before
    const c = getDepartureCountdown('2026-06-15', now)!;
    expect(c.under24h).toBe(false);
    expect(c.under48h).toBe(true);
    expect(c.days).toBe(1);
  });

  it('marks past departures as imminent', () => {
    const target = warehouseDateToUtc('2026-06-15');
    const now = new Date(target.getTime() + 3_600_000);
    const c = getDepartureCountdown('2026-06-15', now)!;
    expect(c.isPast).toBe(true);
    expect(c.label).toBe('départ imminent');
  });
});
