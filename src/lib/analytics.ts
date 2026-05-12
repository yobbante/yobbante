/**
 * Analytics — Google Tag Manager + GA4 wrapper.
 *
 * IDs are read from build-time env vars:
 *   - VITE_GTM_ID  (e.g. "GTM-XXXXXXX")
 *   - VITE_GA4_ID  (e.g. "G-XXXXXXXXXX") — optional
 *
 * Loading is GATED on user cookie consent (RGPD/CNIL). GTM/GA4 only inject
 * when localStorage 'yobbante.cookies.v1' === 'accept'. Call enableAnalytics()
 * after the user accepts; the module then injects the container at runtime.
 *
 * No-op when VITE_GTM_ID is not configured.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

const GTM_ID = (import.meta.env.VITE_GTM_ID as string | undefined)?.trim();
const GA4_ID = (import.meta.env.VITE_GA4_ID as string | undefined)?.trim();
const CONSENT_KEY = 'yobbante.cookies.v1';

let installed = false;

function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'accept';
  } catch {
    return false;
  }
}

function inject(): void {
  if (installed || typeof window === 'undefined' || !GTM_ID) return;
  installed = true;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`;
  document.head.appendChild(script);

  const noscript = document.createElement('noscript');
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(GTM_ID)}`;
  iframe.height = '0';
  iframe.width = '0';
  iframe.style.display = 'none';
  iframe.style.visibility = 'hidden';
  noscript.appendChild(iframe);
  document.body.insertBefore(noscript, document.body.firstChild);

  if (GA4_ID) {
    window.dataLayer.push({ event: 'ga4_config', measurement_id: GA4_ID });
  }
}

/** Boot-time call: only injects if user already consented in a previous session. */
export function installAnalytics(): void {
  if (hasConsent()) inject();
}

/** Call after user clicks Accept on the cookie banner. */
export function enableAnalytics(): void {
  inject();
}

/** Push a custom event to the dataLayer. Safe no-op when GTM not loaded. */
export function track(event: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

/** Push a pageview event — call on every SPA route change. */
export function trackPageview(path: string): void {
  if (!installed) return;
  track('page_view', { page_path: path, page_location: window.location.href });
}
