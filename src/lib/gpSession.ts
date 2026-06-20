// GP session helpers (localStorage based magic-link auth)
export type GpSession = { ref: string; phone: string; expires: number };

const KEY = 'gp_session';

export function readGpSession(): GpSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GpSession;
    if (!s || !s.ref || !s.expires || s.expires < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

export function writeGpSession(s: GpSession) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

export function clearGpSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function normalizeGpRef(raw: string | undefined | null): string {
  return String(raw ?? '').replace(/\D/g, '').padStart(4, '0').slice(-4);
}

export function hasValidGpSessionFor(ref: string): boolean {
  const s = readGpSession();
  if (!s) return false;
  return normalizeGpRef(s.ref) === normalizeGpRef(ref);
}
