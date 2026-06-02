// Lightweight wrapper around Microsoft Clarity custom events / tags.
// Safe to call even if Clarity is not loaded (ad-blockers, dev).
type ClarityFn = (...args: any[]) => void;

function getClarity(): ClarityFn | null {
  if (typeof window === 'undefined') return null;
  const c = (window as any).clarity;
  return typeof c === 'function' ? (c as ClarityFn) : null;
}

export function clarityEvent(name: string, props?: Record<string, string | number | boolean>) {
  try {
    const c = getClarity();
    if (!c) return;
    c('event', name);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        c('set', k, String(v));
      }
    }
  } catch {
    /* swallow — analytics must never break the app */
  }
}
