/**
 * Single source of truth for the "door-to-door" wording.
 * Use these constants/helpers across UI, emails, receipts and notifications
 * so the customer always reads exactly the same promise.
 */

import type { CoverageLevel } from '@/hooks/useCoverageZone';

/** Short tagline displayed on cards / banners. */
export const DOOR_TO_DOOR_TAGLINE =
  'Collecte à Dakar · Livraison à destination via nos partenaires';

/** Slightly longer one-liner — used in banners and emails. */
export const DOOR_TO_DOOR_HEADLINE =
  'Collecte à Dakar incluse. Livraison à destination via nos partenaires transporteurs.';

/** Single canonical perk label, reused on every quote screen. */
export const PICKUP_INCLUDED_LABEL =
  'Enlèvement gratuit à Dakar';
export const DELIVERY_INCLUDED_LABEL =
  'Livraison à destination via nos partenaires';

/** Default perks attached to every offer (Express + Standard). */
export const INCLUDED_PERKS: readonly string[] = [
  PICKUP_INCLUDED_LABEL,
  DELIVERY_INCLUDED_LABEL,
  'Suivi temps réel inclus',
  'Assistance WhatsApp 7j/7',
];

/** Things that are NOT covered by the flat door-to-door price. */
export const DOOR_TO_DOOR_EXCEPTIONS: readonly string[] = [
  "Frais de douane et taxes locales à destination (selon réglementation)",
  "Étages sans ascenseur au-delà du 3ᵉ : supplément de manutention possible",
  "Adresses hors zones desservies : relais partenaire ou rendez-vous personnalisé",
  "Articles hors-gabarit (> 150 cm / > 70 kg unitaire) : devis manuel",
];

/** Plain-text block for emails / receipts. */
export const DOOR_TO_DOOR_EMAIL_BLOCK = [
  `✅ ${DOOR_TO_DOOR_TAGLINE}`,
  '',
  DOOR_TO_DOOR_HEADLINE,
  '',
  'Inclus :',
  ...INCLUDED_PERKS.map(p => `  • ${p}`),
  '',
  'Non inclus :',
  ...DOOR_TO_DOOR_EXCEPTIONS.map(p => `  • ${p}`),
].join('\n');

/* ────────────────────────────────────────────────────────────────
 * Coverage check — is true door-to-door available for this address?
 * ────────────────────────────────────────────────────────────────*/

export type DoorToDoorAvailability = 'direct' | 'partner' | 'unavailable';

export interface CoverageCheck {
  /** Whether the address can be served door-to-door at all. */
  availability: DoorToDoorAvailability;
  /** Human-readable status line for the UI. */
  message: string;
  /** Suggested fallback when availability !== 'direct'. */
  alternative?: string;
}

export function checkDoorToDoor(
  level: CoverageLevel,
  loading: boolean,
  city?: string | null,
): CoverageCheck {
  if (loading) {
    return {
      availability: 'partner',
      message: 'Vérification de la zone d’enlèvement / livraison…',
    };
  }

  switch (level) {
    case 'direct':
      return {
        availability: 'direct',
        message: `Collecte & livraison assurées${city ? ` à ${city}` : ''} par l'équipe Yobbanté.`,
      };
    case 'partner':
      return {
        availability: 'partner',
        message: `Livraison à destination${city ? ` (${city})` : ''} assurée via un partenaire transporteur local.`,
        alternative:
          'Notre coordinateur vous confirme le créneau de livraison sous 2 h par WhatsApp.',
      };
    case 'none':
    default:
      return {
        availability: 'unavailable',
        message: `Adresse hors zone de livraison directe${city ? ` (${city})` : ''}.`,
        alternative:
          'Alternative proposée : dépôt / retrait dans le point relais Yobbanté le plus proche, ou rendez-vous personnalisé sur devis.',
      };
  }
}

/** Combine origin + destination checks into a single UI-ready summary. */
export function combineCoverage(
  origin: CoverageCheck,
  destination: CoverageCheck,
) {
  const worst = (a: DoorToDoorAvailability, b: DoorToDoorAvailability) => {
    const order: DoorToDoorAvailability[] = ['direct', 'partner', 'unavailable'];
    return order.indexOf(a) > order.indexOf(b) ? a : b;
  };
  const overall = worst(origin.availability, destination.availability);
  return {
    overall,
    origin,
    destination,
    /** True when both ends are operable (direct OR partner). */
    doorToDoorAvailable: overall !== 'unavailable',
  };
}
