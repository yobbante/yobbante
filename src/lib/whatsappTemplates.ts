// WhatsApp templates approved on Meta Business Manager.
// Source of truth for template names + ordered params.
// Use with the `send-whatsapp` edge function.
//
// Les templates _v2 sont la nouvelle version (en cours d'examen Meta).
// `fallbackName` pointe vers l'ancien template approuvé : send-whatsapp
// bascule automatiquement dessus si le _v2 n'est pas (encore) approuvé.

export type WaRecipient = 'client' | 'gp' | 'admin';

export interface WaTemplateSpec {
  name: string;
  recipient: WaRecipient;
  /** Ordered list of body params expected by the Meta template */
  params: readonly string[];
  /** Human label for the admin dropdown */
  label: string;
  /** Ancien nom Meta (fallback si _v2 pas encore approuvé). */
  fallbackName?: string;
}

export const WA_TEMPLATES = {
  // ----- Client (sent from 607) -----
  ORDER_CONFIRMATION: {
    name: 'order_confirmation_v2',
    fallbackName: 'order_confirmation',
    recipient: 'client',
    params: ['prenom', 'tracking_id', 'route', 'amount'],
    label: 'Confirmation de commande',
  },
  DEPARTURE_ASSIGNED: {
    name: 'departure_assigned_v2',
    fallbackName: 'departure_assigned',
    recipient: 'client',
    params: ['prenom', 'tracking_id', 'departure_date', 'eta'],
    label: 'Départ assigné',
  },
  COLLECTION_INSTRUCTIONS: {
    name: 'collection_instructions',
    recipient: 'client',
    params: ['client_name', 'tracking_id', 'gp_name', 'gp_phone'],
    label: 'Instructions de collecte',
  },
  PACKAGE_COLLECTED: {
    name: 'package_collected_v2',
    fallbackName: 'package_collected',
    recipient: 'client',
    params: ['prenom', 'tracking_id'],
    label: 'Colis collecté',
  },
  PACKAGE_IN_TRANSIT: {
    name: 'package_in_transit_v2',
    fallbackName: 'package_in_transit',
    recipient: 'client',
    params: ['prenom', 'tracking_id', 'eta'],
    label: 'En transit',
  },
  PACKAGE_ARRIVED: {
    name: 'package_arrived_v2',
    fallbackName: 'package_arrived',
    recipient: 'client',
    params: ['prenom', 'tracking_id'],
    label: 'Arrivé au hub',
  },
  PACKAGE_DELIVERED: {
    name: 'package_delivered_v2',
    fallbackName: 'package_delivered',
    recipient: 'client',
    params: ['prenom', 'tracking_id'],
    label: 'Livré',
  },
  PAYMENT_REQUEST: {
    name: 'payment_request',
    recipient: 'client',
    params: ['client_name', 'tracking_id', 'amount', 'payment_link'],
    label: 'Demande de paiement',
  },
  CLIENT_REMINDER_48H: {
    name: '_1537_client_reminder_48h_v3',
    recipient: 'client',
    params: ['client_name', 'tracking_id'],
    label: 'Relance 48h',
  },
  FEEDBACK_REQUEST: {
    name: 'feedback_request_v3',
    recipient: 'client',
    params: ['client_name', 'tracking_id', 'review_link'],
    label: 'Demande d’avis',
  },
  WEIGHT_CONFIRMATION: {
    name: 'weight_confirmation_v2',
    fallbackName: 'weight_confirmation',
    recipient: 'client',
    params: ['prenom', 'tracking_id', 'weight', 'amount'],
    label: 'Pesée + montant final',
  },
  PAYMENT_CONFIRMATION: {
    name: 'payment_confirmation_v2',
    // Already v2 in prod; pas de fallback historique côté Meta.
    recipient: 'client',
    params: ['prenom', 'tracking_id', 'amount'],
    label: 'Paiement reçu',
  },
  CASH_ON_DELIVERY_CONFIRMED: {
    name: 'cash_on_delivery_confirmed',
    recipient: 'client',
    params: ['client_name', 'tracking_id', 'amount'],
    label: 'Paiement à la livraison confirmé',
  },
  PAYMENT_REMINDER_48H: {
    name: 'payment_reminder_48h_v2',
    fallbackName: 'payment_reminder_48h',
    recipient: 'client',
    params: ['prenom', 'tracking_id', 'amount'],
    label: 'Relance paiement 48h',
  },

  // ----- GP (sent from 122) -----
  MISSION_ASSIGNED_GP: {
    name: 'mission_assigned_gp_v2',
    fallbackName: 'mission_assigned_gp',
    recipient: 'gp',
    params: ['gp_prenom', 'tracking_id', 'client_name', 'route', 'weight'],
    label: 'Mission assignée (GP)',
  },
  GP_MISSION_RECAP_J1: {
    name: 'gp_mission_recap_j1_v2',
    fallbackName: 'gp_mission_recap_j1',
    recipient: 'gp',
    params: ['gp_prenom', 'missions_count', 'next_departure'],
    label: 'Récap J-1 (GP)',
  },
} as const satisfies Record<string, WaTemplateSpec>;

export type WaTemplateKey = keyof typeof WA_TEMPLATES;

export const WA_TEMPLATES_CLIENT = Object.entries(WA_TEMPLATES)
  .filter(([, t]) => t.recipient === 'client')
  .map(([k, t]) => ({ key: k as WaTemplateKey, ...t }));

export const WA_TEMPLATES_GP = Object.entries(WA_TEMPLATES)
  .filter(([, t]) => t.recipient === 'gp')
  .map(([k, t]) => ({ key: k as WaTemplateKey, ...t }));

export function getTemplate(key: WaTemplateKey): WaTemplateSpec {
  return WA_TEMPLATES[key];
}

/**
 * Retourne le nom de fallback à envoyer à `send-whatsapp` pour qu'il
 * essaie l'ancien template si le _v2 n'est pas (encore) approuvé Meta.
 */
export function getTemplateFallback(name: string): string | undefined {
  for (const t of Object.values(WA_TEMPLATES)) {
    if (t.name === name && t.fallbackName) return t.fallbackName;
  }
  return undefined;
}
