// Message WhatsApp (wa.me) envoyé au client depuis la fiche dossier.
// Tolérant aux champs manquants : jamais de "undefined", "?" ou "Client".
import { countryLabel } from '@/lib/routeLabel';

export interface WaClientMessageInput {
  name?: string | null;
  tracking_id?: string | null;
  reference?: string | null;
  origin_city?: string | null;
  origin_country?: string | null;
  destination_city?: string | null;
  destination_country?: string | null;
  pickup_date?: string | null;
}

function firstName(full?: string | null): string {
  const n = (full ?? '').trim();
  if (!n) return '';
  return n.split(/\s+/)[0] || '';
}

/** Ville lisible : si la "ville" est en fait un code pays (FR, SN), on affiche le pays. */
function place(city?: string | null, country?: string | null): string {
  const c = (city ?? '').trim();
  if (c && !/^[A-Za-z]{2}$/.test(c)) return c;
  const code = c || (country ?? '').trim();
  if (!code) return '';
  return countryLabel(code);
}

function fmtDate(d?: string | null): string {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function buildWaClientMessage(d: WaClientMessageInput): string {
  const ref = (d.tracking_id || d.reference || '').trim();
  const prenom = firstName(d.name);
  const from = place(d.origin_city, d.origin_country);
  const to = place(d.destination_city, d.destination_country);
  const date = fmtDate(d.pickup_date);

  const lines: string[] = [];
  lines.push(prenom ? `Bonjour ${prenom} 👋` : 'Bonjour 👋');
  lines.push('');
  lines.push('Votre dossier Yobbanté est bien enregistré.');
  lines.push('');
  if (ref) lines.push(`📦 Réf : ${ref}`);
  if (from || to) lines.push(`🌍 Trajet : ${from || '—'} → ${to || '—'}`);
  if (date) lines.push(`📅 Date souhaitée : ${date}`);
  lines.push('');
  lines.push('Suivez votre colis en temps réel ici :');
  lines.push(ref ? `https://yobbante.com/suivre/${ref}` : 'https://yobbante.com/suivre');
  lines.push('');
  lines.push("L'équipe Yobbanté");

  return lines.join('\n');
}
