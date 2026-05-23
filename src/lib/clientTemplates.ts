// Templates messages WhatsApp client (607). Textes sans accents.
import { DOSSIER_STATUS_LABELS, type DossierStatus } from './types';

export interface TemplateContext {
  prenom?: string | null;
  tracking_id?: string | null;
  reference?: string | null;
  origin?: string | null;
  destination?: string | null;
  status?: DossierStatus | string | null;
}

function firstName(full?: string | null) {
  if (!full) return 'Client';
  return full.trim().split(/\s+/)[0] || 'Client';
}

function fill(tpl: string, ctx: TemplateContext): string {
  const ref = ctx.tracking_id || ctx.reference || '';
  const statusLabel = ctx.status
    ? (DOSSIER_STATUS_LABELS as Record<string, string>)[String(ctx.status)] || String(ctx.status)
    : '';
  return tpl
    .replace(/\{prenom\}/g, firstName(ctx.prenom))
    .replace(/\{tracking_id\}/g, ref)
    .replace(/\{origin\}/g, ctx.origin || '')
    .replace(/\{destination\}/g, ctx.destination || '')
    .replace(/\{statut_label\}/g, statusLabel);
}

export interface ClientTemplate {
  id: string;
  label: string;
  description: string;
  build: (ctx: TemplateContext) => string;
}

export const CLIENT_TEMPLATES: ClientTemplate[] = [
  {
    id: 'confirm',
    label: 'Confirmation',
    description: 'Confirmer la prise en charge',
    build: (ctx) =>
      fill(
        `Bonjour {prenom},\n\nVotre dossier {tracking_id} a bien ete pris en charge.\nRoute : {origin} -> {destination}\nUn transporteur vous contactera sous 24h.\n\n— Equipe Yobbante`,
        ctx,
      ),
  },
  {
    id: 'status',
    label: 'Mise a jour',
    description: 'Notifier un changement de statut',
    build: (ctx) =>
      fill(
        `Bonjour {prenom},\n\nVotre colis {tracking_id} est maintenant : {statut_label}.\nSuivez en temps reel : yobbante.com/suivre/{tracking_id}\n\n— Yobbante`,
        ctx,
      ),
  },
  {
    id: 'infos',
    label: 'Demande infos',
    description: "Demander des informations complementaires",
    build: (ctx) =>
      fill(
        `Bonjour {prenom},\n\nNous avons besoin d informations complementaires pour {tracking_id}.\nPouvez-vous nous rappeler ou repondre a ce message ?\n\n— Equipe Yobbante`,
        ctx,
      ),
  },
];

export function buildGpAssignMessage(args: {
  gp_prenom?: string | null;
  tracking_id?: string | null;
  reference?: string | null;
  origin?: string | null;
  destination?: string | null;
  client_name?: string | null;
  weight?: number | string | null;
  pickup_address?: string | null;
  pickup_date?: string | Date | null;
}): string {
  const ref = args.tracking_id || args.reference || '';
  const date = args.pickup_date
    ? new Date(args.pickup_date).toLocaleDateString('fr-FR')
    : 'a confirmer';
  const weight = args.weight ? `${args.weight} kg` : 'a confirmer';
  return [
    `Salam ${firstName(args.gp_prenom)},`,
    ``,
    `Nouveau dossier Yobbante.`,
    `Ref : ${ref}`,
    `Route : ${args.origin || '-'} -> ${args.destination || '-'}`,
    `Client : ${args.client_name || '-'}`,
    `Poids : ${weight}`,
    `Collecte : ${args.pickup_address || 'a confirmer'}`,
    `Date : ${date}`,
    ``,
    `Confirmez : COLLECTE ${ref}`,
    `Tapez AIDE pour les commandes.`,
  ].join('\n');
}
