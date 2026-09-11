/**
 * Point d'entrée UNIQUE des demandes de devis Yobbanté.
 *
 * Tous les boutons « Demander un devis » du site (accueil, /expedier,
 * Terminal D, entreprises, footer, flow d'envoi) passent par cette fonction :
 * une seule création de dossier (`submit_quote_request`), un seul format de
 * notes, une seule notification client + admin.
 */
import { supabase } from '@/integrations/supabase/client';
import { normalizePhone } from '@/lib/phone';
import { transportModeLabel } from '@/lib/transportMode';
import { countryForCity } from '@/lib/worldCities';

export const QUOTE_BOT_DISPLAY = '+221 78 607 80 80';
const ADMIN_PHONE = '+221784604003';

const SUPPORTED_ORIGINS = new Set(['FR', 'CN', 'US', 'CA', 'AE', 'DE', 'SN']);

export type QuoteSegment = 'particulier' | 'entreprise';

export interface QuoteRequestInput {
  clientName: string;
  clientPhone: string;
  clientEmail?: string | null;
  segment?: QuoteSegment;
  company?: string | null;

  originCity: string;
  originCountry?: string | null;
  destinationCity: string;
  destinationCountry?: string | null;

  weightKg?: number | null;
  parcelCount?: number | null;
  volumeCbm?: number | null;
  transportMode?: string | null;
  goodsType?: string | null;
  description?: string | null;
  declaredValue?: number | string | null;
  declaredCurrency?: string | null;
  insurance?: string | null;
  priority?: string | null;
  pickupDate?: string | null;
  pickupSlot?: string | null;

  senderName?: string | null;
  senderPhone?: string | null;
  senderAddress?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientAddress?: string | null;

  note?: string | null;
  /** D'où vient la demande : 'devis_page' | 'send_flow' | 'terminal_d' … */
  source?: string;
}

export interface QuoteRequestResult {
  reference: string;
  trackingId: string;
  dossierId: string | null;
}

/**
 * Construit l'URL du formulaire unique /demande-devis, pré-rempli.
 * Tous les boutons « Demander un devis » du site passent par ici.
 */
export function buildQuoteRequestUrl(p: {
  originCity?: string | null;
  destinationCity?: string | null;
  weightKg?: number | null;
  parcelCount?: number | null;
  transportMode?: string | null;
  description?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  segment?: QuoteSegment;
  source?: string;
}): string {
  const q = new URLSearchParams();
  const clean = (v?: string | null) => (v && v.trim() && v.trim() !== '—' ? v.trim() : '');
  if (clean(p.originCity)) q.set('origin', clean(p.originCity));
  if (clean(p.destinationCity)) q.set('destination', clean(p.destinationCity));
  if (p.weightKg) q.set('weight', String(p.weightKg));
  if (p.parcelCount) q.set('parcels', String(p.parcelCount));
  if (clean(p.transportMode)) q.set('mode', clean(p.transportMode).toLowerCase());
  if (clean(p.description)) q.set('description', clean(p.description));
  if (clean(p.clientName)) q.set('name', clean(p.clientName));
  if (clean(p.clientPhone)) q.set('phone', clean(p.clientPhone));
  if (p.segment) q.set('segment', p.segment);
  if (p.source) q.set('source', p.source);
  const s = q.toString();
  return s ? `/demande-devis?${s}` : '/demande-devis';
}

function line(label: string, value?: string | number | null) {
  return value === undefined || value === null || value === '' ? '' : `${label}: ${value}`;
}

export function buildQuoteNotes(input: QuoteRequestInput): string {
  return [
    '[DEMANDE DE DEVIS]',
    line('Segment', input.segment === 'entreprise' ? 'Entreprise' : 'Particulier'),
    line('Société', input.company),
    line('Source', input.source ?? 'site'),
    line('Trajet', `${input.originCity} → ${input.destinationCity}`),
    line('Poids', input.weightKg ? `${input.weightKg} kg` : null),
    line('Volume', input.volumeCbm ? `${input.volumeCbm} m³` : null),
    line('Colis', input.parcelCount),
    line('Type marchandise', input.goodsType),
    line('Transport', input.transportMode ? transportModeLabel(input.transportMode) : null),
    line('Priorité', input.priority),
    line('Valeur déclarée', input.declaredValue ? `${input.declaredValue} ${input.declaredCurrency ?? ''}`.trim() : null),
    line('Assurance', input.insurance),
    line('Email', input.clientEmail),
    line(
      'Collecte souhaitée',
      input.pickupDate ? `${input.pickupDate}${input.pickupSlot ? ` (${input.pickupSlot})` : ''}` : null,
    ),
    line('Note client', input.note),
  ].filter(Boolean).join('\n');
}

/** Crée la demande de devis (dossier QUOTE_REQUESTED) et notifie client + admin. */
export async function submitQuoteRequest(input: QuoteRequestInput): Promise<QuoteRequestResult> {
  const clientPhone = normalizePhone(input.clientPhone);
  const originCountry = (input.originCountry || countryForCity(input.originCity) || 'SN').toUpperCase();
  const safeOrigin = SUPPORTED_ORIGINS.has(originCountry) ? originCountry : 'SN';
  const destinationCountry =
    (input.destinationCountry || countryForCity(input.destinationCity) || 'SN').toUpperCase();

  const { data: rows, error } = await supabase.rpc('submit_quote_request', {
    p_product_description: input.description?.trim() || 'Demande de devis personnalisé',
    p_estimated_weight: input.weightKg ?? 0,
    p_origin_country: safeOrigin as 'FR' | 'CN' | 'US' | 'CA' | 'AE' | 'DE' | 'SN',
    p_destination_country: destinationCountry,
    p_origin_city: input.originCity,
    p_destination_city: input.destinationCity,
    p_contact_phone: clientPhone,
    p_client_name: input.clientName,
    p_sender_name: input.senderName || input.clientName,
    p_sender_phone: input.senderPhone ? normalizePhone(input.senderPhone) : clientPhone,
    p_sender_address: input.senderAddress || undefined,
    p_recipient_name: input.recipientName || undefined,
    p_recipient_phone: input.recipientPhone ? normalizePhone(input.recipientPhone) : undefined,
    p_recipient_address: input.recipientAddress || undefined,
    p_pickup_date: input.pickupDate || undefined,
    p_notes: buildQuoteNotes({ ...input, clientPhone }),
  });

  if (error) throw error;
  const dossier: any = rows?.[0];
  if (!dossier) throw new Error("La demande n'a pas pu être créée");

  const reference: string = dossier.reference;
  const trackingId: string = dossier.tracking_id || reference;

  const prenom = input.clientName.split(' ')[0];
  const clientMsg =
    `Bonjour ${prenom},\n` +
    `Votre demande de devis Yobbante est bien recue !\n\n` +
    `Reference : ${reference}\n` +
    `Trajet : ${input.originCity} -> ${input.destinationCity}\n` +
    (input.weightKg ? `Poids : ${input.weightKg} kg\n` : '') +
    `\nNotre equipe vous repond sous 2 h ouvrees sur WhatsApp au ${QUOTE_BOT_DISPLAY}.\n\n` +
    `Suivez votre demande :\nyobbante.com/suivre/${trackingId}`;
  supabase.functions
    .invoke('send-whatsapp', { body: { recipient_phone: clientPhone, message: clientMsg, template: 'free_text' } })
    .catch((e) => console.error('WA client error', e));

  const adminMsg =
    `Nouvelle demande devis (${input.segment === 'entreprise' ? 'Entreprise' : 'Particulier'}) : ${trackingId}\n` +
    `${input.originCity} -> ${input.destinationCity}` +
    (input.weightKg ? ` ${input.weightKg}kg` : '') +
    (input.transportMode ? ` · ${transportModeLabel(input.transportMode)}` : '') +
    `\nClient: ${input.clientName} ${clientPhone}` +
    (input.note ? `\nNote: ${input.note}` : '');
  supabase.functions
    .invoke('send-whatsapp', { body: { recipient_phone: ADMIN_PHONE, message: adminMsg, template: 'free_text' } })
    .catch((e) => console.error('WA admin error', e));

  try { localStorage.setItem('last_dossier_tracking_id', trackingId); } catch { /* ignore */ }

  return { reference, trackingId, dossierId: dossier.id ?? null };
}
