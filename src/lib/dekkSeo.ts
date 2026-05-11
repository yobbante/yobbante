// Lightweight SEO helper — sets <title>, meta description, OG, Twitter, JSON-LD.
// No dependency on react-helmet. Cleans up on unmount.

type SeoInput = {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: 'website' | 'product' | 'article';
  jsonLd?: Record<string, any> | null;
  canonical?: string;
};

const META_KEYS: Record<string, { attr: 'name' | 'property'; key: string }> = {
  description:    { attr: 'name',     key: 'description' },
  ogTitle:        { attr: 'property', key: 'og:title' },
  ogDescription:  { attr: 'property', key: 'og:description' },
  ogImage:        { attr: 'property', key: 'og:image' },
  ogUrl:          { attr: 'property', key: 'og:url' },
  ogType:         { attr: 'property', key: 'og:type' },
  twCard:         { attr: 'name',     key: 'twitter:card' },
  twTitle:        { attr: 'name',     key: 'twitter:title' },
  twDescription:  { attr: 'name',     key: 'twitter:description' },
  twImage:        { attr: 'name',     key: 'twitter:image' },
};

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  if (!value) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function setCanonical(href: string) {
  let el = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

const JSON_LD_ID = 'dekk-jsonld';
function setJsonLd(data: Record<string, any> | null) {
  let el = document.getElementById(JSON_LD_ID) as HTMLScriptElement | null;
  if (!data) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('script');
    el.id = JSON_LD_ID;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function applySeo(input: SeoInput) {
  const url = input.url ?? (typeof window !== 'undefined' ? window.location.href : '');
  document.title = input.title;
  setMeta(META_KEYS.description.attr, META_KEYS.description.key, input.description);
  setMeta(META_KEYS.ogTitle.attr, META_KEYS.ogTitle.key, input.title);
  setMeta(META_KEYS.ogDescription.attr, META_KEYS.ogDescription.key, input.description);
  setMeta(META_KEYS.ogType.attr, META_KEYS.ogType.key, input.type ?? 'website');
  setMeta(META_KEYS.ogUrl.attr, META_KEYS.ogUrl.key, url);
  if (input.image) setMeta(META_KEYS.ogImage.attr, META_KEYS.ogImage.key, input.image);
  setMeta(META_KEYS.twCard.attr, META_KEYS.twCard.key, input.image ? 'summary_large_image' : 'summary');
  setMeta(META_KEYS.twTitle.attr, META_KEYS.twTitle.key, input.title);
  setMeta(META_KEYS.twDescription.attr, META_KEYS.twDescription.key, input.description);
  if (input.image) setMeta(META_KEYS.twImage.attr, META_KEYS.twImage.key, input.image);
  setCanonical(input.canonical ?? url);
  setJsonLd(input.jsonLd ?? null);
}

export function clearJsonLd() {
  setJsonLd(null);
}
