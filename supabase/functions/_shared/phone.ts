// Normalisation centralisée des numéros (Edge Functions). Miroir de src/lib/phone.ts.
// Règles : voir src/lib/phone.ts.

export function normalizePhone(input: string | null | undefined): string {
  if (input == null) return '';
  let v = String(input).replace(/[\s().\-_]/g, '');
  if (!v) return '';
  if (v.startsWith('+')) return v;
  if (v.startsWith('00221')) return '+' + v.slice(2);
  if (v.startsWith('00') && v.length > 5) return '+' + v.slice(2);
  if (v.startsWith('221') && v.length >= 11) return '+' + v;
  const digits = v.replace(/\D/g, '');
  if (digits.length === 9 && (digits.startsWith('7') || digits.startsWith('3'))) {
    return '+221' + digits;
  }
  return digits ? digits : v;
}

/** Chiffres seuls (sans "+"). Utilisé pour l'API Meta et les clés de session. */
export function normalizePhoneDigits(input: string | null | undefined): string {
  return normalizePhone(input).replace(/\D/g, '');
}

export function isValidPhone(input: string | null | undefined): boolean {
  const n = normalizePhone(input);
  if (!n.startsWith('+')) return false;
  const digits = n.slice(1);
  return /^\d+$/.test(digits) && digits.length >= 10 && digits.length <= 15;
}

export function warnIfInvalidPhone(input: string | null | undefined, ctx?: string): string {
  const n = normalizePhone(input);
  if (!isValidPhone(n)) {
    console.warn('[phone] format inhabituel', JSON.stringify({ ctx: ctx ?? '', input, normalized: n }));
  }
  return n;
}
