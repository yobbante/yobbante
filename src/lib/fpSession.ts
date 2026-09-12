// Session partenaire fret (aérien / maritime) — lien magique, stockage local.
export type FreightPartnerSession = {
  session: string;
  reference: string;
  company_name: string;
  expires: number;
};

const KEY = 'freight_partner_session';

export function readFpSession(): FreightPartnerSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as FreightPartnerSession;
    if (!s?.session || !s.expires || s.expires < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

export function writeFpSession(s: FreightPartnerSession) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function clearFpSession() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function hasFpSessionFor(ref: string): boolean {
  const s = readFpSession();
  return !!s && s.reference.toUpperCase() === String(ref ?? '').toUpperCase();
}
