/**
 * Normalisation des visuels produit Dëkk.
 * Objectif : toutes les photos partagent le même ratio (4/5), le même recadrage
 * centré et un fond neutre, quelle que soit leur source (Unsplash, CDN Lovable,
 * upload marchand).
 */

export const DEKK_RATIO = 4 / 5;

type Fit = { w?: number; h?: number };

/** Ratio 4/5 par défaut, hauteur déduite de la largeur. */
function box({ w = 900, h }: Fit) {
  return { w, h: h ?? Math.round(w / DEKK_RATIO) };
}

/**
 * Renvoie une URL recadrée de façon homogène.
 * - Unsplash : paramètres de crop centré + format auto (WebP/AVIF selon support).
 * - Supabase Storage : transformation `render/image` si disponible.
 * - Autres sources : URL inchangée (le recadrage CSS prend le relais).
 */
export function dekkImageUrl(url?: string | null, fit: Fit = {}): string | undefined {
  if (!url) return undefined;
  const { w, h } = box(fit);

  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://dekk.yobbante.com');

    if (u.hostname.endsWith('unsplash.com')) {
      u.searchParams.set('auto', 'format');
      u.searchParams.set('fit', 'crop');
      u.searchParams.set('crop', 'entropy');
      u.searchParams.set('w', String(w));
      u.searchParams.set('h', String(h));
      u.searchParams.set('q', '80');
      return u.toString();
    }

    if (u.pathname.includes('/storage/v1/object/public/')) {
      const rendered = u.toString().replace('/object/public/', '/render/image/public/');
      const r = new URL(rendered);
      r.searchParams.set('width', String(w));
      r.searchParams.set('height', String(h));
      r.searchParams.set('resize', 'cover');
      r.searchParams.set('quality', '80');
      return r.toString();
    }

    return url;
  } catch {
    return url;
  }
}

/** Jeu de tailles pour un rendu net sur écrans Retina sans surcharge réseau. */
export function dekkSrcSet(url?: string | null, widths: number[] = [400, 700, 1000]): string | undefined {
  if (!url) return undefined;
  const set = widths
    .map((w) => {
      const src = dekkImageUrl(url, { w });
      return src ? `${src} ${w}w` : null;
    })
    .filter(Boolean);
  return set.length ? set.join(', ') : undefined;
}
