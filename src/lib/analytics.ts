/**
 * Analytics — GA4 (gtag) + Google Tag Manager + Meta Pixel wrapper.
 *
 * Build-time env vars (publishable, OK to ship in client bundle):
 *   - VITE_GTM_ID           (e.g. "GTM-XXXXXXX")        — optional
 *   - VITE_GA4_ID           (e.g. "G-XXXXXXXXXX")
 *   - VITE_META_PIXEL_ID    (e.g. "1234567890123456")   — Boutique Dëkk only
 *
 * Consent : Google Consent Mode v2 est initialisé AVANT le chargement des
 * tags, avec tous les signaux à "denied". Les tags se chargent quand même
 * (pings anonymisés / modélisation), puis passent à "granted" quand
 * l'utilisateur accepte les cookies. Le pixel Meta est chargé avec
 * `fbq('consent','revoke')` par défaut, puis `grant` après acceptation.
 *
 * Devise : toutes les valeurs e-commerce sont en **XOF (FCFA)**.
 */

import { isDekkSubdomain } from './dekkDomain';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
    _fbq?: unknown;
  }
}

/** Publishable IDs — fallback si les variables d'env ne sont pas définies. */
const DEFAULT_GA4_ID = 'G-7G7D3GDYP5';
const DEFAULT_META_PIXEL_ID = '1578412097153501';

const GTM_ID = (import.meta.env.VITE_GTM_ID as string | undefined)?.trim();
const GA4_ID = ((import.meta.env.VITE_GA4_ID as string | undefined)?.trim() || DEFAULT_GA4_ID);
const META_PIXEL_ID = ((import.meta.env.VITE_META_PIXEL_ID as string | undefined)?.trim() || DEFAULT_META_PIXEL_ID);
const CONSENT_KEY = 'yobbante.cookies.v1';

/** Devise unique de la boutique. */
export const CURRENCY = 'XOF';

let installed = false;
let pixelInstalled = false;

function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'accept';
  } catch {
    return false;
  }
}

/**
 * IMPORTANT : gtag.js n'accepte QUE des objets `arguments` dans le dataLayer.
 * Pousser un vrai Array (`dataLayer.push(args)`) fait que gtag.js ignore
 * silencieusement les commandes `config`/`event` → aucun hit /g/collect.
 */
function gtag() {
  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}


/** Consent Mode v2 — doit être poussé avant le chargement des tags Google. */
function initConsentMode(): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) window.gtag = gtag as any;
  const granted = hasConsent();
  const state = granted ? 'granted' : 'denied';
  window.gtag!('consent', 'default', {
    ad_storage: state,
    ad_user_data: state,
    ad_personalization: state,
    analytics_storage: state,
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500,
  });
  window.gtag!('set', 'ads_data_redaction', !granted);
  window.gtag!('set', 'url_passthrough', true);
}

function injectGtm(): void {
  if (!GTM_ID) return;
  window.dataLayer!.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`;
  document.head.appendChild(script);
}

function injectGa4(): void {
  if (!GA4_ID) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`;
  document.head.appendChild(script);
  window.gtag!('js', new Date());
  window.gtag!('config', GA4_ID, { send_page_view: true, currency: CURRENCY });
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

  window.fbq!('consent', hasConsent() ? 'grant' : 'revoke');
  window.fbq!('init', META_PIXEL_ID);
  window.fbq!('track', 'PageView');
}

function inject(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  initConsentMode();
  injectGtm();
  injectGa4();
  injectMetaPixel();
}

/** Boot-time call — les tags se chargent en mode consentement "denied". */
export function installAnalytics(): void {
  inject();
}

/** Call after user clicks Accept on the cookie banner. */
export function enableAnalytics(): void {
  inject();
  if (typeof window === 'undefined') return;
  window.gtag?.('consent', 'update', {
    ad_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
    analytics_storage: 'granted',
  });
  window.gtag?.('set', 'ads_data_redaction', false);
  window.fbq?.('consent', 'grant');
}

/** Push a custom event to the dataLayer + GA4. Safe no-op when tags absent. */
export function track(event: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
  window.gtag?.('event', event, params);
}

/** Push a pageview to GA4 + Meta Pixel — call on every SPA route change. */
export function trackPageview(path: string): void {
  if (typeof window === 'undefined') return;
  if (GA4_ID) {
    window.gtag?.('event', 'page_view', { page_path: path, page_location: window.location.href });
  }
  if (pixelInstalled && window.fbq) {
    window.fbq('track', 'PageView');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// E-commerce helpers — Meta Pixel standard events + GA4 (valeurs en XOF)
// ─────────────────────────────────────────────────────────────────────────────

type Money = { value: number; currency?: string };
type EcomItem = { id: string; name?: string; category?: string; price?: number; quantity?: number };

const cur = (m: Money) => m.currency ?? CURRENCY;
const val = (m: Money) => Math.round(Number(m.value) || 0);

function fb(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined' || !window.fbq) return;
  window.fbq('track', event, params);
}

export const ecommerce = {
  viewContent(item: EcomItem, money: Money) {
    track('view_item', { currency: cur(money), value: val(money), items: [item] });
    fb('ViewContent', {
      content_ids: [item.id],
      content_name: item.name,
      content_category: item.category,
      content_type: 'product',
      currency: cur(money),
      value: val(money),
    });
  },
  addToCart(item: EcomItem, money: Money) {
    track('add_to_cart', { currency: cur(money), value: val(money), items: [item] });
    fb('AddToCart', {
      content_ids: [item.id],
      content_name: item.name,
      content_type: 'product',
      currency: cur(money),
      value: val(money),
    });
  },
  initiateCheckout(items: EcomItem[], money: Money) {
    track('begin_checkout', { currency: cur(money), value: val(money), items });
    fb('InitiateCheckout', {
      content_ids: items.map(i => i.id),
      num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0),
      content_type: 'product',
      currency: cur(money),
      value: val(money),
    });
  },
  addPaymentInfo(method: string, money: Money) {
    track('add_payment_info', { payment_type: method, currency: cur(money), value: val(money) });
    fb('AddPaymentInfo', { currency: cur(money), value: val(money), payment_method: method });
  },
  purchase(reference: string, items: EcomItem[], money: Money) {
    track('purchase', { transaction_id: reference, currency: cur(money), value: val(money), items });
    fb('Purchase', {
      content_ids: items.map(i => i.id),
      contents: items.map(i => ({ id: i.id, quantity: i.quantity ?? 1, item_price: i.price })),
      num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0),
      content_type: 'product',
      currency: cur(money),
      value: val(money),
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
