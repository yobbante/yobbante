/**
 * Centralized French label mapping + formatters.
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
  ASSIGNED: 'Assigné à un GP',
  DEPARTURE_CONFIRMED: 'Départ confirmé & synchronisé',
  COLLECTING: 'Collecte en cours',
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

const SOURCE_FR: Record<string, string> = {
  site_web: 'Site web',
  yobbante: 'Site web',
  whatsapp: 'WhatsApp',
  whatsapp_bot: 'Bot WhatsApp',
  telephone: 'Téléphone',
  email: 'Email',
  instagram: 'Instagram',
  facebook: 'Facebook',
  walk_in: 'En personne',
  manuel: 'Saisie manuelle',
  referral: 'Recommandation',
  autre: 'Autre',
  expedier: 'Site web',
  recevoir: 'Site web',
};

const SERVICE_TYPE_FR: Record<string, string> = {
  expedier: 'Expédition',
  recevoir: 'Réception internationale',
  reception: 'Réception internationale',
  sourcing: 'Sourcing',
  envoi: 'Expédition',
};

export function formatStatusLabel(status?: string | null): string {
  if (!status) return '—';
  return STATUS_FR[status] ?? status.replace(/_/g, ' ');
}

export function formatEventLabel(eventType?: string | null): string {
  if (!eventType) return '—';
  return EVENT_FR[eventType] ?? eventType.replace(/_/g, ' ');
}

export function formatSourceLabel(source?: string | null): string {
  if (!source) return '—';
  return SOURCE_FR[source] ?? source.replace(/_/g, ' ');
}

export function formatServiceTypeLabel(type?: string | null): string {
  if (!type) return '—';
  return SERVICE_TYPE_FR[type] ?? type.replace(/_/g, ' ');
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

/** Relative French time: "il y a 2 heures", "il y a 3 jours" */
export function formatRelativeFR(input?: string | number | Date | null): string {
  if (!input) return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '—';
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), 'day');
  return formatDateFR(d);
}

/** "18 500 XOF" with French thousands separators */
export function formatAmountXOF(amount?: number | string | null): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!isFinite(n)) return '—';
  return `${new Intl.NumberFormat('fr-SN').format(Math.round(n))} XOF`;
}

/** "+221 78 607 80 80" — international grouping with pairs after country code */
export function formatPhoneFR(phone?: string | null): string {
  if (!phone) return '—';
  const cleaned = String(phone).replace(/[^\d+]/g, '');
  if (!cleaned) return '—';
  const digits = cleaned.replace(/^\+/, '');
  if (!digits) return '—';
  // Country code length: 1 (US), 3 (most African codes starting with 2), else 2.
  let ccLen = 2;
  if (digits.startsWith('1')) ccLen = 1;
  else if (/^2\d{10,}$/.test(digits) || /^2[0-9]\d/.test(digits)) ccLen = 3;
  const cc = digits.slice(0, ccLen);
  const rest = digits.slice(ccLen);
  const pairs = rest.match(/.{1,2}/g)?.join(' ') ?? rest;
  return `+${cc}${pairs ? ' ' + pairs : ''}`;
}
