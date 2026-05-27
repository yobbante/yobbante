// Helper pour afficher une route lisible (ville > pays > code ISO).
// Ne JAMAIS afficher le code ISO seul.
import { COUNTRY_NAMES, type WarehouseCountry } from '@/lib/types';

export function countryLabel(code?: string | null): string {
  if (!code) return '—';
  const upper = String(code).toUpperCase();
  return (COUNTRY_NAMES as Record<string, string>)[upper] ?? upper;
}

export function placeLabel(city?: string | null, country?: string | null): string {
  const c = (city ?? '').trim();
  if (c) return c;
  return countryLabel(country);
}

export function routeLabel(d: {
  origin_city?: string | null;
  destination_city?: string | null;
  origin_country?: string | null;
  destination_country?: string | null;
}): string {
  return `${placeLabel(d.origin_city, d.origin_country)} → ${placeLabel(d.destination_city, d.destination_country)}`;
}
