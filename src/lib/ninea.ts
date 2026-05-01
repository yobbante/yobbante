// NINEA validation utilities
// Format Sénégal : 8 chiffres + 1 lettre + 1 chiffre, espaces autorisés à la saisie.
// Ex: "00123456 7A2" ou "001234567A2"

export function normalizeNinea(input: string): string {
  return (input || '').replace(/\s+/g, '').toUpperCase();
}

const NINEA_REGEX = /^\d{8}[A-Z]\d$/;

export function isValidNinea(input: string): boolean {
  return NINEA_REGEX.test(normalizeNinea(input));
}

export function formatNinea(input: string): string {
  const n = normalizeNinea(input);
  if (n.length <= 8) return n;
  return `${n.slice(0, 8)} ${n.slice(8)}`;
}
