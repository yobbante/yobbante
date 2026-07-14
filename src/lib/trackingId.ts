/**
 * Normalise a tracking identifier entered by a user or received in a URL.
 * - Trims whitespace
 * - Removes surrounding # and internal spaces
 * - Uppercases (YOB-… / YBT-… are case-insensitive on the API side)
 * Returns '' for null/undefined/empty input so callers can guard easily.
 */
export function normalizeTrackingId(raw: string | null | undefined): string {
  if (!raw) return '';
  return String(raw)
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '')
    .toUpperCase();
}
