/**
 * Timing "dynamique" d'un dossier : on n'affiche jamais toutes les dates,
 * seulement l'information utile au moment présent.
 *
 * Exemples de dynamisme :
 *  - Avant le départ  → date de DÉPART (+ compte à rebours "dans 3 j")
 *  - Après le départ  → date d'ARRIVÉE estimée (+ "J-2" / "en retard")
 *  - Livré            → date de livraison ("Livré il y a 4 j")
 *  - Pas encore de départ assigné → âge de la demande ("En attente · 2 j")
 *  - Paiement en attente → "Paiement en attente · 3 j"
 *  - Annulé / retour   → état terminal, aucune date projetée
 */

export type TimingTone = 'neutral' | 'info' | 'warn' | 'danger' | 'success';

export interface DossierTiming {
  /** Libellé court de la nature de la date affichée. */
  label: string;
  /** Valeur principale (date formatée ou texte d'état). */
  value: string;
  /** Complément contextuel : compte à rebours, retard, ancienneté. */
  hint?: string;
  tone: TimingTone;
}

export interface TimingDeparture {
  departure_date?: string | null;
  arrival_estimate?: string | null;
}

const DAY = 86_400_000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Nombre de jours calendaires entre aujourd'hui et une date (négatif = passé). */
export function daysFromToday(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return Math.round((startOfDay(t) - startOfDay(new Date())) / DAY);
}

export function formatShortDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function countdown(days: number): string {
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'demain';
  if (days === -1) return 'hier';
  if (days > 1) return `dans ${days} j`;
  return `il y a ${Math.abs(days)} j`;
}

function ageDays(iso?: string | null): number | null {
  const d = daysFromToday(iso);
  return d == null ? null : Math.abs(d);
}

type AnyDossier = Record<string, any>;

export function getDossierTiming(d: AnyDossier, dep?: TimingDeparture | null): DossierTiming {
  const status: string = d.status;

  // ── États terminaux / exceptionnels ──────────────────────────────────────
  if (status === 'CANCELLED') {
    return { label: 'Annulé', value: '—', tone: 'danger' };
  }
  if (status === 'RETURN_REQUESTED' || status === 'RETURN_IN_PROGRESS' || status === 'RETURNED') {
    return { label: 'Retour', value: status === 'RETURNED' ? 'Retourné' : 'En cours', tone: 'warn' };
  }
  if (status === 'DELIVERED' || status === 'CLOSED' || status === 'ARCHIVED') {
    const dl = formatShortDate(d.estimated_delivery_date) ?? formatShortDate(dep?.arrival_estimate);
    const age = ageDays(d.estimated_delivery_date ?? dep?.arrival_estimate);
    return {
      label: 'Livré',
      value: dl ?? 'Terminé',
      hint: age != null ? `il y a ${age} j` : undefined,
      tone: 'success',
    };
  }

  // ── Après le départ : on montre l'ARRIVÉE ────────────────────────────────
  const inTransit = ['IN_TRANSIT', 'CUSTOMS', 'ARRIVED_HUB', 'OUT_FOR_DELIVERY'].includes(status);
  const departed = daysFromToday(dep?.departure_date);
  if (inTransit || (departed != null && departed < 0)) {
    const arrIso = dep?.arrival_estimate ?? d.estimated_delivery_date;
    const arr = formatShortDate(arrIso);
    const dd = daysFromToday(arrIso);
    if (arr && dd != null) {
      return {
        label: 'Arrivée',
        value: arr,
        hint: dd < 0 ? `retard ${Math.abs(dd)} j` : countdown(dd),
        tone: dd < 0 ? 'danger' : dd <= 1 ? 'warn' : 'info',
      };
    }
    return { label: 'En transit', value: 'Arrivée à confirmer', tone: 'warn' };
  }

  // ── Avant le départ : on montre le DÉPART ────────────────────────────────
  if (dep?.departure_date && departed != null) {
    return {
      label: 'Départ',
      value: formatShortDate(dep.departure_date)!,
      hint: countdown(departed),
      tone: departed <= 1 ? 'warn' : 'info',
    };
  }

  // ── Paiement en attente : l'info utile devient l'attente de paiement ─────
  if (d.payment_status && d.payment_status !== 'paid' && ['QUOTE_SENT', 'QUOTE_ACCEPTED', 'CONFIRMED'].includes(status)) {
    const age = ageDays(d.created_at);
    return {
      label: 'Paiement',
      value: 'En attente',
      hint: age != null ? `${age} j` : undefined,
      tone: age != null && age >= 3 ? 'danger' : 'warn',
    };
  }

  // ── Enlèvement prévu (expédition domicile) ───────────────────────────────
  const pickup = daysFromToday(d.pickup_date);
  if (pickup != null && pickup >= 0) {
    return {
      label: 'Enlèvement',
      value: formatShortDate(d.pickup_date)!,
      hint: countdown(pickup),
      tone: pickup <= 1 ? 'warn' : 'info',
    };
  }

  // ── Pas de départ assigné : l'info utile est l'ancienneté ────────────────
  const age = ageDays(d.created_at);
  return {
    label: d.assigned_departure_id ? 'Départ' : 'Sans départ',
    value: d.assigned_departure_id ? 'À planifier' : 'À assigner',
    hint: age != null ? `créé il y a ${age} j` : undefined,
    tone: age != null && age >= 2 ? 'danger' : 'neutral',
  };
}

export const TIMING_TONE_CLASS: Record<TimingTone, string> = {
  neutral: 'text-muted-foreground',
  info: 'text-foreground',
  warn: 'text-amber-500',
  danger: 'text-red-500',
  success: 'text-emerald-500',
};
