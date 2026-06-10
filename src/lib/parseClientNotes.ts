/**
 * Parse the free-text "notes" field produced by SendFlow / older intake flows
 * into a structured object so the admin UI can display essentials first and
 * gracefully fall back when dedicated DB columns are still empty.
 *
 * The SendFlow writes lines like:
 *   Profil: Particulier
 *   Type marchandise: standard
 *   Description: ...
 *   Poids: 1 kg · 1 colis
 *   Valeur déclarée: 100000 FCFA
 *   Transport: AIR · normal
 *   Assurance: none
 *   Paiement: wave
 *   Collecte: 2026-05-27 · morning
 *   — Expéditeur —
 *   Amath · 789269756
 *   Ouest foire
 *   — Destinataire —
 *   Lamine · 789269756
 *   Paris
 */
export interface ParsedClientNotes {
  profile?: string;
  goodsType?: string;
  description?: string;
  weightKg?: number | null;
  parcelCount?: number | null;
  declaredValue?: string;
  transport?: string;
  priority?: string;
  insurance?: string;
  payment?: string;
  pickupDate?: string;
  pickupSlot?: string;
  senderName?: string;
  senderPhone?: string;
  senderAddress?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  /** Lines that didn't match any known pattern. */
  rest: string[];
}

const KEY_RE = /^([^:]+):\s*(.+)$/;

function pickPhone(s: string) {
  const m = s.match(/(\+?\d[\d\s.-]{5,})/);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

export function parseClientNotes(notes?: string | null): ParsedClientNotes {
  const out: ParsedClientNotes = { rest: [] };
  if (!notes) return out;

  const lines = notes.split('\n').map(l => l.trim()).filter(Boolean);
  let section: 'sender' | 'recipient' | null = null;
  const senderLines: string[] = [];
  const recipientLines: string[] = [];

  for (const line of lines) {
    const low = line.toLowerCase();
    if (/^[—\-–]\s*expéditeur/i.test(line) || /^expéditeur\s*:/.test(low)) { section = 'sender'; continue; }
    if (/^[—\-–]\s*destinataire/i.test(line) || /^destinataire\s*:/.test(low)) { section = 'recipient'; continue; }

    const m = line.match(KEY_RE);
    if (m && !section) {
      const k = m[1].trim().toLowerCase();
      const v = m[2].trim();
      if (k.startsWith('profil')) out.profile = v;
      else if (k.startsWith('type marchandise') || k === 'type') out.goodsType = v;
      else if (k.startsWith('description')) out.description = v;
      else if (k.startsWith('poids')) {
        const w = v.match(/([\d.,]+)\s*kg/i);
        if (w) out.weightKg = Number(w[1].replace(',', '.'));
        const p = v.match(/(\d+)\s*colis/i);
        if (p) out.parcelCount = Number(p[1]);
      }
      else if (k.startsWith('valeur')) out.declaredValue = v;
      else if (k.startsWith('transport')) {
        const parts = v.split('·').map(s => s.trim());
        out.transport = parts[0];
        if (parts[1]) out.priority = parts[1];
      }
      else if (k.startsWith('assurance')) out.insurance = v;
      else if (k.startsWith('paiement')) out.payment = v;
      else if (k.startsWith('collecte')) {
        const parts = v.split('·').map(s => s.trim());
        out.pickupDate = parts[0];
        if (parts[1]) out.pickupSlot = parts[1];
      }
      else out.rest.push(line);
      continue;
    }

    if (section === 'sender') senderLines.push(line);
    else if (section === 'recipient') recipientLines.push(line);
    else out.rest.push(line);
  }

  const fillContact = (lines: string[], target: 'sender' | 'recipient') => {
    if (!lines.length) return;
    const first = lines[0];
    // "Name · phone" or "Name - phone"
    const split = first.split(/[·\-—]/).map(s => s.trim()).filter(Boolean);
    const phone = pickPhone(first);
    let name = '';
    if (split.length >= 2) {
      name = split[0];
    } else {
      name = first.replace(phone, '').replace(/[·\-—]/g, '').trim();
    }
    const address = lines.slice(1).join(', ');
    if (target === 'sender') {
      out.senderName = name || undefined;
      out.senderPhone = phone || undefined;
      out.senderAddress = address || undefined;
    } else {
      out.recipientName = name || undefined;
      out.recipientPhone = phone || undefined;
      out.recipientAddress = address || undefined;
    }
  };
  fillContact(senderLines, 'sender');
  fillContact(recipientLines, 'recipient');

  return out;
}

/** True if the parsed structure carries any essential info. */
export function hasParsedEssentials(p: ParsedClientNotes) {
  return !!(p.description || p.weightKg || p.declaredValue || p.transport || p.payment || p.pickupDate);
}
