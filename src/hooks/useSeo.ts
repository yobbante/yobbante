import { useEffect } from 'react';

const SITE = 'https://yobbante.com';
const DEFAULT_OG = `${SITE}/og-image.jpg`;

export interface SeoOptions {
  title: string;
  description?: string;
  /** Path-only (e.g. "/sourcing") — combined with SITE for canonical/og:url. */
  path: string;
  ogImage?: string;
  /** When false, set robots noindex (e.g. private flows). Default true. */
  index?: boolean;
}

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    Object.entries(attrs).forEach(([k, v]) => k !== 'content' && el!.setAttribute(k, v));
    document.head.appendChild(el);
  }
  el.setAttribute('content', attrs.content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Per-route SEO: title, meta description, canonical, OpenGraph, Twitter.
 * All URLs are absolute (required by FB/WhatsApp/Twitter cards).
 */
export function useSeo({ title, description, path, ogImage, index = true }: SeoOptions) {
  useEffect(() => {
    const url = `${SITE}${path}`;
    const img = ogImage ?? DEFAULT_OG;

    document.title = title;
    if (description) upsertMeta('meta[name="description"]', { name: 'description', content: description });

    upsertLink('canonical', url);

    upsertMeta('meta[property="og:title"]',       { property: 'og:title',       content: title });
    upsertMeta('meta[property="og:url"]',         { property: 'og:url',         content: url });
    upsertMeta('meta[property="og:image"]',       { property: 'og:image',       content: img });
    if (description)
      upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });

    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: img });
    if (description)
      upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });

    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: index ? 'index,follow' : 'noindex,nofollow',
    });
  }, [title, description, path, ogImage, index]);
}
