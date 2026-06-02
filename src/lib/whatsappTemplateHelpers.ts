// Helpers shared by the admin messaging UI.
// - Auto-fill template params from a linked dossier
// - Categorize client templates for grouped display

import type { WaTemplateKey } from './whatsappTemplates';

export interface AutoFillDossier {
  id: string;
  reference: string | null;
  tracking_id: string | null;
  status: string;
  origin_country: string | null;
  destination_country: string | null;
  origin_city?: string | null;
  destination_city?: string | null;
  estimated_weight: number | null;
  estimated_delivery_date: string | null;
  buyer_name: string | null;
  sender_name: string | null;
  recipient_name: string | null;
  recipient_address: string | null;
  sender_address: string | null;
  final_amount_xof: number | null;
  actual_weight_kg?: number | null;
}

function firstName(full: string | null | undefined): string {
  if (!full) return '';
  return full.trim().split(/\s+/)[0] || '';
}

function fmtAmount(xof: number | null | undefined): string {
  if (xof == null) return '';
  return `${Math.round(xof).toLocaleString('fr-FR')} FCFA`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' });
  } catch { return d; }
}

/**
 * Build a map of param-name → auto-filled value from a dossier.
 * Used by both the conversation composer and the "Nouveau message" dialog.
 */
export function buildAutoFill(d: AutoFillDossier | null): Record<string, string> {
  if (!d) return {};
  const prenom = firstName(d.sender_name) || firstName(d.buyer_name) || firstName(d.recipient_name);
  const trackingId = d.tracking_id || d.reference || '';
  const originLabel = d.origin_city || d.origin_country || '';
  const destLabel = d.destination_city || d.destination_country || '';
  const route = `${originLabel} → ${destLabel}`;
  const weight = (d.actual_weight_kg ?? d.estimated_weight) ?? null;
  const amount = fmtAmount(d.final_amount_xof);
  const eta = fmtDate(d.estimated_delivery_date);

  return {
    prenom,
    client_name: d.buyer_name || d.recipient_name || d.sender_name || '',
    tracking_id: trackingId,
    route,
    origin: d.origin_country || '',
    destination: d.destination_country || '',
    weight: weight != null ? `${weight}` : '',
    poids: weight != null ? `${weight}` : '',
    amount,
    eta,
    departure_date: eta,
    review_link: trackingId ? `https://yobbante.com/avis/${trackingId}` : '',
    payment_link: trackingId ? `https://yobbante.com/payer/${trackingId}` : '',
    gp_name: '',
    gp_phone: '',
  };
}

/** Template categories shown in admin dropdowns. */
export const TEMPLATE_CATEGORIES: Array<{ label: string; keys: WaTemplateKey[] }> = [
  {
    label: 'Statuts dossier',
    keys: [
      'ORDER_CONFIRMATION',
      'DEPARTURE_ASSIGNED',
      'COLLECTION_INSTRUCTIONS',
      'PACKAGE_COLLECTED',
      'WEIGHT_CONFIRMATION',
      'PAYMENT_CONFIRMATION',
      'CASH_ON_DELIVERY_CONFIRMED',
      'PAYMENT_REQUEST',
      'PACKAGE_IN_TRANSIT',
      'PACKAGE_ARRIVED',
      'PACKAGE_DELIVERED',
    ],
  },
  {
    label: 'Rappels',
    keys: [
      'PAYMENT_REMINDER_48H',
      'CLIENT_REMINDER_48H',
      'FEEDBACK_REQUEST',
    ],
  },
];

/**
 * WhatsApp 24h window status for a conversation.
 * - 'open'    : last inbound < 24h → free text allowed
 * - 'closed'  : last inbound > 24h → templates only
 * - 'unknown' : no inbound message yet → templates only
 */
export type WaWindowStatus = 'open' | 'closed' | 'unknown';

export function computeWindowStatus(lastInboundAt: string | null | undefined): WaWindowStatus {
  if (!lastInboundAt) return 'unknown';
  const ageMs = Date.now() - new Date(lastInboundAt).getTime();
  if (Number.isNaN(ageMs)) return 'unknown';
  return ageMs <= 24 * 60 * 60 * 1000 ? 'open' : 'closed';
}
