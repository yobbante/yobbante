/**
 * Centralized French status / event label mapping.
 * DB keys stay in English — only display strings are translated.
 */

const STATUS_FR: Record<string, string> = {
  // Shipment
  PENDING: 'En attente',
  WAITING_FOR_MATCH: 'Sans départ',
  CONFIRMED: 'Confirmé',
  MATCHED: 'Assigné',
  IN_PREPARATION: 'En préparation',
  IN_TRANSIT: 'En transit',
  ARRIVED: 'Arrivé',
  DELIVERED: 'Livré',
  CANCELLED: 'Annulé',
  ON_HOLD: 'En attente',

  // Package
  CREATED: 'Créé',
  RECEIVED: 'Reçu',
  IN_STORAGE: 'En stock',
  READY_TO_SHIP: 'Prêt à expédier',
  SHIPPED: 'Expédié',

  // Dossier
  SUBMITTED: 'Soumis',
  AWAITING_CLIENT: 'En attente client',
  IN_REVIEW: 'En analyse',
  IN_ANALYSIS: 'En analyse',
  SOURCING: 'Sourcing',
  QUOTE_SENT: 'Devis envoyé',
  PROCURED: 'Acheté',
  PURCHASED: 'Acheté',
  EN_RECHERCHE_DEPART: 'Recherche départ',
  ASSIGNED: 'GP assigné',
  COLLECTED: 'Collecté',
  WEIGHED: 'Pesé — Paiement en attente',
  ARRIVED_HUB: 'Arrivé au hub',
  OUT_FOR_DELIVERY: 'En cours de livraison',
  CUSTOMS: 'En douane',
  CLOSED: 'Clôturé',
  STALE: 'Sans réponse',
  ARCHIVED: 'Archivé',
  NEW: 'Nouveau',
};

const EVENT_FR: Record<string, string> = {
  WELCOME: 'Bienvenue',
  PACKAGE_RECEIVED: 'Colis reçu',
  PACKAGE_STATUS: 'Statut colis',
  SHIPMENT_CREATED: 'Expédition créée',
  SHIPMENT_STATUS: 'Statut expédition',
  DELIVERED: 'Livré',
  IDLE_ALERT: 'Alerte inactivité',
  DOSSIER_SUBMITTED: 'Dossier soumis',
  DOSSIER_STATUS: 'Statut dossier',
  CONSOLIDATION: 'Consolidation',
};

export function formatStatusLabel(status?: string | null): string {
  if (!status) return '—';
  return STATUS_FR[status] ?? status.replace(/_/g, ' ');
}

export function formatEventLabel(eventType?: string | null): string {
  if (!eventType) return '—';
  return EVENT_FR[eventType] ?? eventType.replace(/_/g, ' ');
}

/** French long date: "20 mai 2026" */
export function formatDateFR(input?: string | number | Date | null): string {
  if (!input) return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}
