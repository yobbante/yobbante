/**
 * Statuts dynamiques par type de dossier.
 *
 * Les `value` correspondent aux valeurs autorisées par l'enum
 * `dossier_status` côté Supabase (voir migrations). Les labels
 * sont les libellés affichés en français côté admin.
 *
 * NB : certains libellés demandés (ex. « Nouveau », « En analyse »,
 * « Devis envoyé », « Acheté ») sont mappés vers des valeurs DB
 * existantes pour éviter d'enfreindre l'enum côté base.
 */

export type StatutOption = { value: string; label: string };

export const STATUTS_PAR_TYPE: Record<'expedier' | 'recevoir' | 'sourcing', StatutOption[]> = {
  expedier: [
    { value: 'SUBMITTED',         label: 'Nouveau' },
    { value: 'AWAITING_CLIENT',   label: 'En attente client' },
    { value: 'CONFIRMED',         label: 'Confirmé' },
    { value: 'ASSIGNED',          label: 'Assigné à un GP' },
    { value: 'DEPARTURE_CONFIRMED', label: 'Départ confirmé & synchronisé' },
    { value: 'COLLECTED',         label: 'Collecté' },
    { value: 'WEIGHED',           label: 'Pesé — Paiement en attente' },
    { value: 'IN_TRANSIT',        label: 'En transit' },
    { value: 'ARRIVED_HUB',       label: 'Arrivé au hub destination' },
    { value: 'OUT_FOR_DELIVERY',  label: 'En cours de livraison' },
    { value: 'DELIVERED',         label: 'Livré' },
    { value: 'CANCELLED',         label: 'Annulé' },
    { value: 'ARCHIVED',          label: 'Archivé' },
  ],
  recevoir: [
    { value: 'SUBMITTED',         label: 'Nouveau' },
    { value: 'AWAITING_CLIENT',   label: 'En attente client' },
    { value: 'CONFIRMED',         label: 'Confirmé' },
    { value: 'IN_TRANSIT',        label: 'En transit vers Dakar' },
    { value: 'ARRIVED_HUB',       label: 'Arrivé hub Dakar' },
    { value: 'OUT_FOR_DELIVERY',  label: 'En livraison Dakar' },
    { value: 'DELIVERED',         label: 'Livré au destinataire' },
    { value: 'CANCELLED',         label: 'Annulé' },
    { value: 'ARCHIVED',          label: 'Archivé' },
  ],
  sourcing: [
    { value: 'SUBMITTED',         label: 'Nouveau' },
    { value: 'AWAITING_CLIENT',   label: 'En attente client' },
    { value: 'CONFIRMED',         label: 'Confirmé' },
    { value: 'IN_REVIEW',         label: 'En analyse' },
    { value: 'SOURCING',          label: 'Devis envoyé' },
    { value: 'PROCURED',          label: 'Acheté' },
    { value: 'IN_TRANSIT',        label: 'En transit' },
    { value: 'CUSTOMS',           label: 'En douane' },
    { value: 'ARRIVED_HUB',       label: 'Arrivé hub Dakar' },
    { value: 'DELIVERED',         label: 'Livré' },
    { value: 'CANCELLED',         label: 'Annulé' },
    { value: 'ARCHIVED',          label: 'Archivé' },
  ],
};

export type DossierKindHint = {
  service_type?: string | null;
  app_source?: string | null;
  needs_sourcing?: boolean | null;
};

/** Détermine le type fonctionnel d'un dossier (expedier / recevoir / sourcing). */
export function getDossierKind(d: DossierKindHint | string | null | undefined): 'expedier' | 'recevoir' | 'sourcing' {
  const s = (typeof d === 'string' ? d : d?.service_type ?? d?.app_source ?? '').toLowerCase();

  if (typeof d === 'object' && d?.needs_sourcing) return 'sourcing';
  if (s.includes('sourcing')) return 'sourcing';
  if (s.includes('recevoir') || s.includes('reception') || s.includes('réception')) return 'recevoir';
  if (s.includes('expedier') || s.includes('expédier') || s.includes('envoi') || s.includes('expedition') || s.includes('expédition') || s.includes('send')) return 'expedier';

  return 'expedier';
}

/** Retourne les statuts admin pertinents pour un dossier donné. */
export function getStatutsPourDossier(d: DossierKindHint | string | null | undefined): StatutOption[] {
  return STATUTS_PAR_TYPE[getDossierKind(d)];
}
