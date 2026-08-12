import { useState } from 'react';
import { Package } from 'lucide-react';
import { DEKK } from './dekkTheme';
import { dekkImageUrl, dekkSrcSet } from '@/lib/dekkImage';

export interface DekkImageProps {
  src?: string | null;
  alt: string;
  /** Ratio CSS de la boîte — `4/5` par défaut (standard catalogue Dëkk). */
  ratio?: string;
  /** Largeur de rendu ciblée, utilisée pour le recadrage serveur. */
  width?: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Rayon d'angle (Apple-like) — 0 par défaut pour l'esthétique éditoriale. */
  radius?: number;
}

/**
 * Visuel produit uniformisé : ratio constant, recadrage centré, fond neutre,
 * fondu à l'apparition et silhouette animée pendant le chargement.
 */
export function DekkImage({
  src,
  alt,
  ratio = '4 / 5',
  width = 900,
  sizes = '(max-width: 760px) 50vw, 420px',
  priority = false,
  className,
  style,
  radius = 0,
}: DekkImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const url = dekkImageUrl(src, { w: width });
  const srcSet = dekkSrcSet(src);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        aspectRatio: ratio,
        background: DEKK.creamDeep,
        overflow: 'hidden',
        borderRadius: radius,
        ...style,
      }}
    >
      {!loaded && !failed && <span className="dekk-shimmer" aria-hidden />}

      {url && !failed ? (
        <img
          src={url}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            display: 'block',
            opacity: loaded ? 1 : 0,
            transform: loaded ? 'scale(1)' : 'scale(1.02)',
            transition: 'opacity 520ms cubic-bezier(.22,.8,.24,1), transform 700ms cubic-bezier(.22,.8,.24,1)',
          }}
        />
      ) : failed || !url ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: DEKK.muted,
          }}
        >
          <Package size={26} strokeWidth={1.3} />
        </div>
      ) : null}
    </div>
  );
}
