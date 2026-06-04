// Normalisation centralisée des numéros de téléphone Sénégal (et international).
// Règles :
//  1. Supprimer espaces, tirets, parenthèses, points.
//  2. "00221..." -> "+221..."
//  3. "221..."   -> "+221..."
//  4. "7XXXXXXXX" (9 chiffres) -> "+221XXXXXXXXX"
//  5. "3XXXXXXXX" (9 chiffres) -> "+221XXXXXXXXX"
//  6. "+..."     -> garder tel quel
//  7. Sinon      -> retourner tel quel + warning
//
// La fonction NE BLOQUE jamais : si invalide, on retourne le mieux possible
// et `isValidPhone()` permet à l'appelant de logger un warning.

export function normalizePhone(input: string | null | undefined): string {
  if (input == null) return '';
  // 1. strip espaces, tirets, parenthèses, points
  let v = String(input).replace(/[\s().\-_]/g, '');
  if (!v) return '';

  // 6. déjà E.164
  if (v.startsWith('+')) return v;

  // 2. 00221... -> +221...
  if (v.startsWith('00221')) return '+' + v.slice(2);
  // 00 international générique
  if (v.startsWith('00') && v.length > 5) return '+' + v.slice(2);

  // 3. 221XXXXXXXXX -> +221...
  if (v.startsWith('221') && v.length >= 11) return '+' + v;

  const digits = v.replace(/\D/g, '');

  // 4 & 5. numéros locaux SN (7 ou 3, 9 chiffres)
  if (digits.length === 9 && (digits.startsWith('7') || digits.startsWith('3'))) {
    return '+221' + digits;
  }

  // 7. sinon : retourner les chiffres préservés, sans bloquer
  return digits ? digits : v;
}

/** Variante chiffres-seuls (sans "+"), utile pour l'API Meta WhatsApp
 *  et pour les clés de session (qui sont historiquement stockées en digits-only). */
export function normalizePhoneDigits(input: string | null | undefined): string {
  const n = normalizePhone(input);
  return n.replace(/\D/g, '');
}

/** Renvoie true si le numéro normalisé est plausiblement valide
 *  (commence par "+" et 10–15 chiffres). */
export function isValidPhone(input: string | null | undefined): boolean {
  const n = normalizePhone(input);
  if (!n.startsWith('+')) return false;
  const digits = n.slice(1);
  return /^\d+$/.test(digits) && digits.length >= 10 && digits.length <= 15;
}

/** Log un warning si le numéro normalisé est invalide. Ne bloque jamais. */
export function warnIfInvalidPhone(input: string | null | undefined, ctx?: string): string {
  const n = normalizePhone(input);
  if (!isValidPhone(n)) {
    // eslint-disable-next-line no-console
    console.warn('[phone] format inhabituel', { ctx: ctx ?? '', input, normalized: n });
  }
  return n;
}
