import { useEffect } from 'react';

/**
 * Injects a JSON-LD <script> into <head> keyed by `id`.
 * Removes it on unmount so per-route schemas don't leak across pages.
 */
export function useJsonLd(id: string, data: Record<string, unknown> | null | undefined) {
  useEffect(() => {
    if (!data) return;
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement('script');
      el.id = id;
      el.type = 'application/ld+json';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
    return () => {
      el?.remove();
    };
  }, [id, JSON.stringify(data)]);
}
