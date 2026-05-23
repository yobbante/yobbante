// Badges contextuels pour les lignes Dossiers (NOUVEAU / URGENT)
import type { DossierStatus } from './types';

const H = 3_600_000;
const D = 24 * H;

export interface DossierBadgeInput {
  status: DossierStatus | string;
  created_at: string | Date;
  assigned_transporteur_ref?: string | null;
  assigned_departure_id?: string | null;
  departure_date?: string | Date | null;
}

export interface DossierBadge {
  kind: 'new' | 'urgent';
  label: string;
  className: string;
  reason: string;
}

export function getDossierBadges(d: DossierBadgeInput): DossierBadge[] {
  const out: DossierBadge[] = [];
  const created = new Date(d.created_at).getTime();
  const age = Date.now() - created;

  if (age < D) {
    out.push({
      kind: 'new',
      label: 'NOUVEAU',
      className: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
      reason: 'Créé il y a moins de 24h',
    });
  }

  let urgent: string | null = null;

  // Soumis depuis > 48h
  if ((d.status === 'SUBMITTED' || d.status === 'IN_REVIEW') && age > 2 * D) {
    urgent = 'Soumis depuis +48h sans traitement';
  }

  // Confirmé/en analyse sans GP depuis > 24h
  if (
    !urgent &&
    (d.status === 'IN_REVIEW' || d.status === 'PROCURED') &&
    !d.assigned_transporteur_ref &&
    age > D
  ) {
    urgent = 'Validé sans GP depuis +24h';
  }

  // Départ assigné dans < 48h
  if (!urgent && d.departure_date) {
    const dep = new Date(d.departure_date).getTime();
    const toGo = dep - Date.now();
    if (toGo > 0 && toGo < 2 * D) {
      urgent = 'Départ dans moins de 48h';
    }
  }

  if (urgent) {
    out.push({
      kind: 'urgent',
      label: 'URGENT',
      className: 'bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse',
      reason: urgent,
    });
  }

  return out;
}
