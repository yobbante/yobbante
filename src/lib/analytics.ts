/**
 * Analytics — Google Tag Manager + GA4 + Meta Pixel wrapper.
 *
 * Build-time env vars (publishable, OK to ship in client bundle):
 *   - VITE_GTM_ID           (e.g. "GTM-XXXXXXX")
 *   - VITE_GA4_ID           (e.g. "G-XXXXXXXXXX")        — optional
 *   - VITE_META_PIXEL_ID    (e.g. "1234567890123456")   — Boutique Dëkk only
 *
 * Loading is GATED on user cookie consent (RGPD/CNIL). Trackers only inject
 * when localStorage 'yobbante.cookies.v1' === 'accept'. Call enableAnalytics()
 * after the user accepts; the module then injects scripts at runtime.
 *
 * Meta Pixel loads ONLY on the dekk.* subdomain (boutique). The main
 * Yobbanté logistics site does not need Facebook attribution.
 */

import { isDekkSubdomain } from './dekkDomain';

declare global {
  interface Window {
    dataLayer?: unknown[];
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
    _fbq?: unknown;
  }
}

const GTM_ID = (import.meta.env.VITE_GTM_ID as string | undefined)?.trim();
const GA4_ID = (import.meta.env.VITE_GA4_ID as string | undefined)?.trim();
const META_PIXEL_ID = (import.meta.env.VITE_META_PIXEL_ID as string | undefined)?.trim();
const CONSENT_KEY = 'yobbante.cookies.v1';

let installed = false;
let pixelInstalled = false;

function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'accept';
  } catch {
    return false;
  }
}

function injectGtm(): void {
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

function injectMetaPixel(): void {
  if (pixelInstalled || typeof window === 'undefined' || !META_PIXEL_ID) return;
  // Boutique uniquement
  if (!isDekkSubdomain()) return;
  pixelInstalled = true;

  /* eslint-disable */
  (function (f: any, b: any, e: any, v: any) {
    if (f.fbq) return;
    const n: any = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    f.fbq = n;
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    const t = b.createElement(e); t.async = true; t.src = v;
    const s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  window.fbq && window.fbq('init', META_PIXEL_ID);
  window.fbq && window.fbq('track', 'PageView');
}

function inject(): void {
  injectGtm();
  injectMetaPixel();
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

/** Push a pageview to GTM + Meta Pixel — call on every SPA route change. */
export function trackPageview(path: string): void {
  if (typeof window === 'undefined') return;
  if (installed) {
    track('page_view', { page_path: path, page_location: window.location.href });
  }
  if (pixelInstalled && window.fbq) {
    window.fbq('track', 'PageView');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// E-commerce helpers — Meta Pixel standard events + GA4-compatible dataLayer
// ─────────────────────────────────────────────────────────────────────────────

type Money = { value: number; currency?: string };
type EcomItem = { id: string; name?: string; category?: string; price?: number; quantity?: number };

function fb(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined' || !window.fbq) return;
  window.fbq('track', event, params);
}

export const ecommerce = {
  viewContent(item: EcomItem, money: Money) {
    track('view_item', { ecommerce: { currency: money.currency ?? 'EUR', value: money.value, items: [item] } });
    fb('ViewContent', {
      content_ids: [item.id],
      content_name: item.name,
      content_category: item.category,
      content_type: 'product',
      currency: money.currency ?? 'EUR',
      value: money.value,
    });
  },
  addToCart(item: EcomItem, money: Money) {
    track('add_to_cart', { ecommerce: { currency: money.currency ?? 'EUR', value: money.value, items: [item] } });
    fb('AddToCart', {
      content_ids: [item.id],
      content_name: item.name,
      content_type: 'product',
      currency: money.currency ?? 'EUR',
      value: money.value,
    });
  },
  initiateCheckout(items: EcomItem[], money: Money) {
    track('begin_checkout', { ecommerce: { currency: money.currency ?? 'EUR', value: money.value, items } });
    fb('InitiateCheckout', {
      content_ids: items.map(i => i.id),
      num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0),
      content_type: 'product',
      currency: money.currency ?? 'EUR',
      value: money.value,
    });
  },
  addPaymentInfo(method: string, money: Money) {
    track('add_payment_info', { payment_type: method, ecommerce: { currency: money.currency ?? 'EUR', value: money.value } });
    fb('AddPaymentInfo', { currency: money.currency ?? 'EUR', value: money.value, payment_method: method });
  },
  purchase(reference: string, items: EcomItem[], money: Money) {
    track('purchase', { ecommerce: { transaction_id: reference, currency: money.currency ?? 'EUR', value: money.value, items } });
    fb('Purchase', {
      content_ids: items.map(i => i.id),
      contents: items.map(i => ({ id: i.id, quantity: i.quantity ?? 1, item_price: i.price })),
      num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0),
      content_type: 'product',
      currency: money.currency ?? 'EUR',
      value: money.value,
      order_id: reference,
    });
  },
  search(query: string) {
    if (!query || query.length < 2) return;
    track('search', { search_term: query });
    fb('Search', { search_string: query });
  },
  lead(source?: string) {
    track('generate_lead', { lead_source: source });
    fb('Lead', { lead_source: source });
  },
};
