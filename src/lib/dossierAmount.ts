/**
 * Source unique de vérité pour le montant affiché d'un dossier / d'une course.
 *
 * Règle (identique partout dans l'admin, le client et les récaps WhatsApp) :
 *  1. `final_amount_xof` (prix validé, éventuellement corrigé après pesée)
 *  2. sinon `total_fcfa` (courses Terminal D)
 *  3. sinon `estimated_cost` (EUR) converti au taux fixe XOF
 */

export const EUR_XOF = 655.957;

export function eurToXof(eur: number | null | undefined): number | null {
  if (eur == null || Number.isNaN(Number(eur))) return null;
  return Math.round(Number(eur) * EUR_XOF);
}

export interface AmountInfo {
  /** Montant en FCFA, ou null si aucun prix connu. */
  xof: number | null;
  /** true quand le montant est un prix validé (pas une estimation). */
  isFinal: boolean;
}

export function dossierAmount(row: Record<string, any> | null | undefined): AmountInfo {
  if (!row) return { xof: null, isFinal: false };
  const final = row.final_amount_xof ?? row.total_fcfa;
  if (final != null && !Number.isNaN(Number(final))) {
    return { xof: Math.round(Number(final)), isFinal: true };
  }
  return { xof: eurToXof(row.estimated_cost), isFinal: false };
}

/** Raccourci : montant FCFA uniquement. */
export function dossierAmountXof(row: Record<string, any> | null | undefined): number | null {
  return dossierAmount(row).xof;
}

export function formatXof(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(v))} FCFA`;
}
