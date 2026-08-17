/**
 * Devis Yobbanté — couche partagée entre la génération AUTOMATIQUE
 * (fin du formulaire /expedier, Terminal D) et la génération MANUELLE
 * depuis une conversation WhatsApp dans l'admin.
 *
 * Ce module NE CALCULE PAS de prix : il consomme les moteurs existants
 * (`pricingEngine.ts` pour l'aérien/maritime/GP international,
 * `fretPricing.ts` pour le Terminal D national/international) et se
 * charge uniquement de la mise en forme, du statut et du message WhatsApp.
 */

export type DevisEngine = 'international' | 'fret_national' | 'fret_international';
export type DevisStatus = 'pending_send' | 'sent' | 'accepted' | 'expired' | 'cancelled';

export type DevisLine = { label: string; amountFcfa: number };

export interface DevisRow {
  id: string;
  reference: string;
  version: number;
  parent_id: string | null;
  is_current: boolean;
  dossier_id: string | null;
  conversation_phone: string | null;
  engine: DevisEngine;
  origin: string | null;
  destination: string | null;
  weight_kg: number | null;
  colis_size: string | null;
  mode: string | null;
  breakdown: DevisLine[];
  total_fcfa: number;
  total_manual: boolean;
  notes: string | null;
  status: DevisStatus;
  valid_until: string;
  sent_at: string | null;
  created_at: string;
}

/** Durée de validité par défaut d'un devis (jours). */
export const DEVIS_VALIDITY_DAYS = 7;

export const ENGINE_LABELS: Record<DevisEngine, string> = {
  international: 'Aérien / maritime international',
  fret_national: 'Terminal D — national (Sénégal)',
  fret_international: 'Terminal D — international (pays voisins)',
};

export const STATUS_LABELS: Record<DevisStatus, string> = {
  pending_send: "En attente d'envoi",
  sent: 'Envoyé',
  accepted: 'Accepté',
  expired: 'Expiré',
  cancelled: 'Annulé',
};

export function devisValidUntil(days = DEVIS_VALIDITY_DAYS, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isDevisExpired(d: Pick<DevisRow, 'valid_until' | 'status'>): boolean {
  if (d.status === 'accepted' || d.status === 'cancelled') return false;
  const today = new Date().toISOString().slice(0, 10);
  return d.valid_until < today;
}

export function fcfa(n: number): string {
  return `${Math.round(n || 0).toLocaleString('fr-FR')} FCFA`;
}

export function formatFrDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Ligne "Poids"/"Taille" selon le moteur utilisé. */
export function measureLine(d: Pick<DevisRow, 'engine' | 'weight_kg' | 'colis_size'>): {
  label: string; value: string;
} | null {
  if (d.engine === 'fret_national') {
    return d.colis_size ? { label: 'Taille', value: `${d.colis_size}` } : null;
  }
  return d.weight_kg ? { label: 'Poids', value: `${d.weight_kg} kg` } : null;
}

/**
 * Message WhatsApp final, lisible sur mobile (texte simple, sans markdown
 * lourd). Le même format est utilisé pour l'aperçu de l'agent et pour
 * l'envoi réel — il n'existe qu'un seul rendu dans tout le système.
 */
export function formatDevisMessage(d: DevisRow): string {
  const lines: string[] = [];
  lines.push(`📦 Devis Yobbanté — ${d.reference}${d.version > 1 ? ` (v${d.version})` : ''}`);
  if (d.origin || d.destination) {
    lines.push(`Trajet : ${d.origin || '—'} → ${d.destination || '—'}`);
  }
  const m = measureLine(d);
  if (m) lines.push(`${m.label} : ${m.value}`);
  if (d.mode) lines.push(`Mode : ${d.mode}`);
  (d.breakdown || []).forEach((l) => {
    lines.push(`${l.label} : ${fcfa(l.amountFcfa)}`);
  });
  lines.push('─────────────');
  lines.push(`Total : ${fcfa(d.total_fcfa)}`);
  lines.push(`Devis valable jusqu'au ${formatFrDate(d.valid_until)}.`);
  lines.push('Pour confirmer, répondez à ce message.');
  return lines.join('\n');
}
