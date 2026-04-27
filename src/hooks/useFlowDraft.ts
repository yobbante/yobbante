import { useEffect, useRef } from 'react';

/**
 * Persists a flow's in-progress state to sessionStorage so that when the user is
 * bounced to /auth and comes back, the form is rehydrated exactly where it was
 * — instead of restarting from step 1.
 *
 * Usage:
 *   const draftKey = 'send-flow';
 *   useFlowDraft(draftKey, { type, originCityId, destCityId, weight, ... }, (d) => {
 *     if (d.type) setType(d.type);
 *     ...
 *   });
 *
 *   // Before navigating to /auth:
 *   saveDraft(draftKey, { ...currentState });
 *   navigate(`/auth?redirect=${encodeURIComponent('/expedier/envoyer?resume=1')}`);
 */

const PREFIX = 'yobbante:flow-draft:';

export function saveDraft(key: string, value: unknown) {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify({ value, ts: Date.now() }));
  } catch { /* quota or disabled */ }
}

export function loadDraft<T = any>(key: string, maxAgeMs = 30 * 60_000): T | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { value: T; ts: number };
    if (Date.now() - parsed.ts > maxAgeMs) {
      sessionStorage.removeItem(PREFIX + key);
      return null;
    }
    return parsed.value;
  } catch { return null; }
}

export function clearDraft(key: string) {
  try { sessionStorage.removeItem(PREFIX + key); } catch { /* noop */ }
}

/**
 * Auto-saves the snapshot on every change, and rehydrates once on mount when a
 * draft is found (regardless of `?resume=1` — we always restore so a user who
 * hits back never loses progress).
 */
export function useFlowDraft<T>(
  key: string,
  snapshot: T,
  rehydrate: (draft: T) => void,
) {
  const didHydrate = useRef(false);

  // Rehydrate once on mount
  useEffect(() => {
    if (didHydrate.current) return;
    didHydrate.current = true;
    const draft = loadDraft<T>(key);
    if (draft) rehydrate(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every change (after hydration)
  useEffect(() => {
    if (!didHydrate.current) return;
    saveDraft(key, snapshot);
  }, [key, snapshot]);
}
