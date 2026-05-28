/**
 * Décomposition "intelligente" du récapitulatif client.
 *
 * Le total affiché (TTC) est conservé tel quel. On le décompose en lignes
 * lisibles pour rassurer le client, et on isole la TVA 18 % calculée
 * sur le total TTC (mode reverse) :
 *
 *   HT  = TTC / 1.18
 *   TVA = TTC − HT
 *
 * NB : pour l'admin, la TVA réellement reversée est calculée sur la marge
 * (cf. FinancesTab — KPI "TVA à reverser"). Cette répartition côté client
 * est purement présentationnelle.
 *
 * Toutes les valeurs sont dans la même unité que `total` (EUR ou FCFA).
 */

export const TVA_RATE = 0.18;

export type RecapLine = { label: string; amount: number; muted?: boolean };

export interface RecapBreakdown {
  lines: RecapLine[];
  subtotalHt: number;
  tva: number;
  tvaRate: number;
  totalTtc: number;
}

export interface BuildRecapOpts {
  /** Total TTC affiché (devise libre, doit rester l'ancre). */
  total: number;
  /** Poids facturé (kg). */
  weightKg: number;
  /** Transport aérien → ajoute "Billet / soute aérienne". */
  isAir?: boolean;
  /** Assurance déjà incluse dans le total (même unité). */
  insurance?: number;
  /** Surcharge enlèvement zone (même unité, 0 si Dakar centre). */
  pickupSurcharge?: number;
  /** Frais de dossier fixes (défaut : ~7.6 EUR ≈ 5 000 FCFA). */
  fileFee?: number;
}

/**
 * Construit la décomposition. Garantit que la somme des lignes + TVA = total.
 */
export function buildRecapBreakdown(opts: BuildRecapOpts): RecapBreakdown {
  const total = Math.max(0, Math.round(opts.total));
  const ht = Math.round(total / (1 + TVA_RATE));
  const tva = total - ht;

  const insurance = Math.max(0, Math.round(opts.insurance ?? 0));
  const pickup = Math.max(0, Math.round(opts.pickupSurcharge ?? 0));
  const fileFee = Math.max(0, Math.round(opts.fileFee ?? 8)); // ~5 000 FCFA
  const agencyFee = Math.max(0, Math.round(ht * 0.08));
  const airTicket = opts.isAir ? Math.max(0, Math.round(ht * 0.18)) : 0;

  // Reste = fret transporteur de base
  const knownFees = fileFee + agencyFee + airTicket + insurance + pickup;
  const fret = Math.max(0, ht - knownFees);

  const lines: RecapLine[] = [
    { label: 'Fret transporteur', amount: fret },
  ];
  if (airTicket > 0) lines.push({ label: 'Billet / soute aérienne', amount: airTicket });
  lines.push({ label: 'Frais de dossier', amount: fileFee });
  lines.push({ label: "Frais d'agence", amount: agencyFee });
  if (insurance > 0) lines.push({ label: 'Assurance colis', amount: insurance });
  if (pickup > 0) lines.push({ label: 'Enlèvement (zone élargie)', amount: pickup });

  return {
    lines,
    subtotalHt: ht,
    tva,
    tvaRate: TVA_RATE,
    totalTtc: total,
  };
}
