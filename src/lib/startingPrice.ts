/**
 * "À partir de" pricing — affichage public le plus attractif.
 *
 * Formule : tarif zone le + bas (6 000 FCFA/kg) × poids × 1.20 (marge Yobbanté)
 *           + 5 000 FCFA d'enlèvement Dakar centre (zone par défaut).
 *
 * Le client découvre les surcoûts réels (banlieue / hors Dakar, livraison
 * carrier à destination) plus tard dans le flow d'envoi.
 *
 * Exemple : 1 kg → 6000 × 1 × 1.20 + 5000 = 12 200 FCFA.
 */
export const LOWEST_GP_RATE_PER_KG = 6000;
export const YOBBANTE_MARGIN = 1.20;
export const DAKAR_CENTRE_ENLEVEMENT = 5000;

export function lowestStartingPriceFcfa(weightKg: number): number {
  const w = Math.max(0.5, Number(weightKg) || 0);
  return Math.round(LOWEST_GP_RATE_PER_KG * w * YOBBANTE_MARGIN + DAKAR_CENTRE_ENLEVEMENT);
}

export function formatStartingFromFcfa(weightKg: number): string {
  const n = lowestStartingPriceFcfa(weightKg);
  return `À partir de ${n.toLocaleString('fr-FR')} FCFA`;
}
