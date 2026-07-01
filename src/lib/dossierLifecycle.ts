/**
 * Central source of truth for dossier lifecycle rules :
 *   - Annulation (CANCELLED) : autorisée uniquement avant l'entrée en transit
 *   - Retour (RETURN_REQUESTED → RETURN_IN_PROGRESS → RETURNED) : autorisé
 *     à partir du moment où le colis est en transit ou plus loin.
 *
 * Ce module est utilisé partout où un statut est lu / affiché :
 * drawer admin, kanban, filtres, page de suivi client, page GP, revenus…
 * Toute nouvelle règle de transition doit passer par ce fichier.
 */

export const CANCELLABLE_STATUSES = new Set<string>([
  'SUBMITTED',
  'AWAITING_CLIENT',
  'CONFIRMED',
  'IN_REVIEW',
  'EN_RECHERCHE_DEPART',
  'ASSIGNED',
  'DEPARTURE_CONFIRMED',
  'COLLECTING',
  'COLLECTED',
  'WEIGHED',
  'STALE',
]);

export const RETURNABLE_STATUSES = new Set<string>([
  'IN_TRANSIT',
  'CUSTOMS',
  'ARRIVED_HUB',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
]);

export const TERMINAL_STATUSES = new Set<string>([
  'CANCELLED', 'RETURNED', 'ARCHIVED', 'CLOSED',
]);

export const RETURN_FLOW_STATUSES = new Set<string>([
  'RETURN_REQUESTED', 'RETURN_IN_PROGRESS', 'RETURNED',
]);

export function canCancel(status?: string | null): boolean {
  if (!status) return false;
  return CANCELLABLE_STATUSES.has(status);
}

export function canRequestReturn(status?: string | null): boolean {
  if (!status) return false;
  return RETURNABLE_STATUSES.has(status);
}

export function isTerminal(status?: string | null): boolean {
  if (!status) return false;
  return TERMINAL_STATUSES.has(status);
}

/** Motifs proposés dans le modal de retour (dropdown + free text « Autre »). */
export const RETURN_REASON_CATEGORIES: { value: string; label: string }[] = [
  { value: 'refused',        label: 'Colis refusé' },
  { value: 'address_unknown', label: 'Adresse introuvable' },
  { value: 'client_cancel',  label: 'Client a annulé' },
  { value: 'damaged',        label: 'Colis endommagé' },
  { value: 'other',          label: 'Autre' },
];

/** Couleurs / tonalités partagées pour tous les badges Annulé/Retour. */
export const LIFECYCLE_BADGE: Record<string, { label: string; tone: string; dot: string }> = {
  CANCELLED:          { label: 'Annulé',          tone: 'bg-red-500/15 text-red-500 border-red-500/30',       dot: 'bg-red-500' },
  RETURN_REQUESTED:   { label: 'Retour demandé',  tone: 'bg-amber-500/15 text-amber-500 border-amber-500/30', dot: 'bg-amber-500' },
  RETURN_IN_PROGRESS: { label: 'Retour en cours', tone: 'bg-orange-500/15 text-orange-500 border-orange-500/30', dot: 'bg-orange-500' },
  RETURNED:           { label: 'Retourné',        tone: 'bg-rose-500/15 text-rose-500 border-rose-500/30',    dot: 'bg-rose-500' },
};

/** Retourne le prochain statut de la chaîne retour (ou null si terminal). */
export function nextReturnStatus(status: string): string | null {
  if (status === 'RETURN_REQUESTED') return 'RETURN_IN_PROGRESS';
  if (status === 'RETURN_IN_PROGRESS') return 'RETURNED';
  return null;
}
