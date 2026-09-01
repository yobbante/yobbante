import { Luggage, Plane, Ship, Truck } from 'lucide-react';

/**
 * Mode de transport d'un dossier (colonne `dossiers.transport_mode`).
 * Aligné sur le sélecteur client `TransportModeSelector` (/expedier, intake admin).
 */
export type DossierTransportMode = 'gp' | 'air' | 'sea' | 'road';

export const DOSSIER_TRANSPORT_MODES: {
  id: DossierTransportMode;
  label: string;
  desc: string;
  Icon: typeof Plane;
  status: 'live' | 'soon';
}[] = [
  { id: 'gp', label: 'GP', desc: 'Bagage accompagné · 3-7j', Icon: Luggage, status: 'live' },
  { id: 'air', label: 'Aérien', desc: 'Fret aérien classique', Icon: Plane, status: 'live' },
  { id: 'sea', label: 'Maritime', desc: 'Groupage LCL / Conteneur FCL', Icon: Ship, status: 'live' },
  { id: 'road', label: 'Routier', desc: 'Terminal D', Icon: Truck, status: 'live' },
];

export function normalizeTransportMode(v: unknown): DossierTransportMode | null {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (!s) return null;
  if (s === 'gp' || s === 'accompagne' || s === 'bagage') return 'gp';
  if (s === 'air' || s === 'aerien' || s === 'aérien' || s === 'avion') return 'air';
  if (s === 'sea' || s === 'sea_lcl' || s === 'maritime' || s === 'bateau') return 'sea';
  if (s === 'road' || s === 'routier' || s === 'terminal_d') return 'road';
  return null;
}

/** Mode effectif d'un dossier, avec repli sur le GP quand un GP/départ est déjà attaché. */
export function resolveTransportMode(dossier: Record<string, any> | null | undefined): DossierTransportMode | null {
  if (!dossier) return null;
  const explicit = normalizeTransportMode(dossier.transport_mode);
  if (explicit) return explicit;
  if (dossier.assigned_transporteur_ref || dossier.assigned_departure_id) return 'gp';
  return null;
}

export function transportModeLabel(m: unknown): string {
  const id = normalizeTransportMode(m);
  return DOSSIER_TRANSPORT_MODES.find(x => x.id === id)?.label ?? '—';
}

export function transportModeMeta(m: DossierTransportMode) {
  return DOSSIER_TRANSPORT_MODES.find(x => x.id === m)!;
}
