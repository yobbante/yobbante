/**
 * Smart "home" routing.
 *
 * When the user has entered the authenticated app shell (/app, /app/...),
 * any "Accueil" / "Retour" link should bring them back to /app — not /,
 * which would dump them on the public landing page and break the journey.
 *
 * Strategy: /app marks the session with a flag on mount. Public surfaces
 * (search bars, flow back links, etc.) read it to resolve the right href.
 */
export const APP_SESSION_KEY = 'yobbante:in-app';

export function markInApp() {
  try { sessionStorage.setItem(APP_SESSION_KEY, '1'); } catch {}
}

export function clearInApp() {
  try { sessionStorage.removeItem(APP_SESSION_KEY); } catch {}
}

export function getHomeHref(): string {
  try {
    return sessionStorage.getItem(APP_SESSION_KEY) === '1' ? '/app' : '/';
  } catch {
    return '/';
  }
}
