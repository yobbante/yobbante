/**
 * Single source of truth for the "door-to-door" wording.
 * Use these constants/helpers across UI, emails, receipts and notifications
 * so the customer always reads exactly the same promise.
 */

import type { CoverageLevel } from '@/hooks/useCoverageZone';

/** Short tagline displayed on cards / banners. */
export const DOOR_TO_DOOR_TAGLINE =
  'Porte-à-porte transparent';

/** Slightly longer one-liner — used in banners and emails. */
export const DOOR_TO_DOOR_HEADLINE =
  'Enlèvement chez vous et livraison au domicile du destinataire inclus, sans frais cachés.';

/** Single canonical perk label, reused on every quote screen. */
export const PICKUP_INCLUDED_LABEL =
  'Enlèvement à domicile inclus';
export const DELIVERY_INCLUDED_LABEL =
  'Livraison à domicile incluse';

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
        message: `Enlèvement & livraison à domicile disponibles${city ? ` à ${city}` : ''} — équipe Yobbanté.`,
      };
    case 'partner':
      return {
        availability: 'partner',
        message: `Porte-à-porte assuré${city ? ` à ${city}` : ''} via un partenaire local agréé.`,
        alternative:
          'Notre coordinateur vous confirme le créneau de collecte sous 2 h par WhatsApp.',
      };
    case 'none':
    default:
      return {
        availability: 'unavailable',
        message: `Adresse hors zone porte-à-porte directe${city ? ` (${city})` : ''}.`,
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
