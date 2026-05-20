// Multi-channel intake — central catalog used in Inbox & NewIntakeDialog.

export type IntakeSource =
  | 'site_web'
  | 'whatsapp'
  | 'telephone'
  | 'email'
  | 'instagram'
  | 'facebook'
  | 'walk_in'
  | 'referral'
  | 'autre';

export type IntakeMethod = 'self_service' | 'manual_intake';

export type ServiceKind = 'envoi' | 'sourcing' | 'reception';

export interface IntakeSourceMeta {
  id: IntakeSource;
  label: string;
  emoji: string;
  /** Background tint (HSL-ish hex used as inline style — short list, safe to keep literal). */
  color: string;
  /** Suggested label for the "reference" field on step 1. */
  referencePlaceholder: string;
}

export const INTAKE_SOURCES: IntakeSourceMeta[] = [
  { id: 'whatsapp',  label: 'WhatsApp',         emoji: '', color: '#25D366', referencePlaceholder: 'Numero WhatsApp (ex: +221…)' },
  { id: 'telephone', label: 'Appel',            emoji: '', color: '#F59E0B', referencePlaceholder: "Numero appelant ou heure d'appel" },
  { id: 'email',     label: 'Email',            emoji: '', color: '#8B5CF6', referencePlaceholder: 'Adresse email du client' },
  { id: 'instagram', label: 'Instagram DM',     emoji: '', color: '#E1306C', referencePlaceholder: 'Pseudo Instagram' },
  { id: 'facebook',  label: 'Facebook DM',      emoji: '', color: '#1877F2', referencePlaceholder: 'Pseudo / page Facebook' },
  { id: 'walk_in',   label: 'Walk-in',          emoji: '', color: '#64748B', referencePlaceholder: 'Lieu (bureau, hub, …)' },
  { id: 'referral',  label: 'Recommandation',   emoji: '', color: '#EAB308', referencePlaceholder: 'Nom du referent' },
  { id: 'site_web',  label: 'Site web',         emoji: '', color: '#3B82F6', referencePlaceholder: 'URL ou parcours' },
  { id: 'autre',     label: 'Autre',            emoji: '', color: '#94A3B8', referencePlaceholder: 'Precisez le canal' },
];

export const SOURCE_BY_ID: Record<IntakeSource, IntakeSourceMeta> =
  Object.fromEntries(INTAKE_SOURCES.map(s => [s.id, s])) as Record<IntakeSource, IntakeSourceMeta>;

export const SERVICE_KINDS: { id: ServiceKind; label: string; emoji: string }[] = [
  { id: 'envoi',     label: 'Envoyer un colis',  emoji: '' },
  { id: 'sourcing',  label: 'Sourcing',          emoji: '' },
  { id: 'reception', label: 'Reception',         emoji: '' },
];

/** Tag prepended to product_description so we can detect "reception" intake from a dossier row. */
export const RECEPTION_TAG = '[RECEPTION]';
export const SOURCING_TAG = '[SOURCING]';

export function detectServiceKind(dossier: { needs_sourcing?: boolean; product_description?: string | null }): ServiceKind {
  const desc = dossier.product_description || '';
  if (desc.startsWith(RECEPTION_TAG)) return 'reception';
  if (dossier.needs_sourcing) return 'sourcing';
  return 'envoi';
}
