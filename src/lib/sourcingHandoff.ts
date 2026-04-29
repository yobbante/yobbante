/**
 * Sourcing → Recevoir handoff bridge.
 *
 * When the user chooses "Je commande moi-même" at the end of a sourcing
 * brief, we persist a small payload that the ReceiveFlow consumes on mount
 * to pre-fill hub, destination and merchant context. The handoff is
 * single-use: ReceiveFlow clears it after consumption.
 */

const KEY = 'yobbante.sourcing.handoff';

export type SourcingHandoff = {
  hub: string;                  // origin country (CN/FR/US/AE)
  destination: string;          // dest country code
  merchantHint?: string;        // platform name (Alibaba, Amazon…)
  productTitle?: string;        // product name to pre-fill tracking input
  productUrl?: string;          // original URL pasted in sourcing
  estimatedPriceEur?: number;
  estimatedWeightKg?: number;
  quantity?: number;
  createdAt: number;
};

export function writeSourcingHandoff(h: Omit<SourcingHandoff, 'createdAt'>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...h, createdAt: Date.now() }));
  } catch { /* noop */ }
}

export function readSourcingHandoff(): SourcingHandoff | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SourcingHandoff;
    // Expire after 30 minutes — avoids stale prefill on later visits.
    if (Date.now() - parsed.createdAt > 30 * 60 * 1000) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

export function clearSourcingHandoff() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}
