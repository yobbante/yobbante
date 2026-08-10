/**
 * Critères partagés entre les compteurs (Morning Brief / KPI) et les listes admin,
 * pour que "12 paiements en attente" corresponde exactement à ce qu'on voit en cliquant.
 */

/** Statuts terminaux : un dossier dans cet état n'attend plus rien. */
export const TERMINAL_STATUSES = ['DELIVERED', 'CLOSED', 'CANCELLED', 'ARCHIVED'] as const;

/** Statuts « devis » : pas encore une commande, donc aucun paiement n'est réellement attendu. */
export const QUOTE_STATUSES = ['QUOTE_REQUESTED', 'QUOTE_SENT', 'QUOTE_REFUSED'] as const;

/** Statuts exclus du décompte « paiements en attente ». */
export const PENDING_PAYMENT_EXCLUDED_STATUSES: string[] = [
  ...TERMINAL_STATUSES,
  ...QUOTE_STATUSES,
];

/** Version prête pour le filtre PostgREST `.not('status','in', ...)`. */
export const PENDING_PAYMENT_EXCLUDED_PG = `(${PENDING_PAYMENT_EXCLUDED_STATUSES.join(',')})`;

/** Statuts considérés comme « dossier actif sans GP assigné ». */
export const NO_GP_STATUSES = [
  'SUBMITTED', 'IN_REVIEW', 'CONFIRMED', 'ASSIGNED', 'EN_RECHERCHE_DEPART',
] as const;
