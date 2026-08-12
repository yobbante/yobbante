import { useEffect, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { DEKK } from './dekkTheme';
import { DekkImage } from './DekkImage';

export interface DekkGalleryProps {
  images: string[];
  alt: string;
  wished?: boolean;
  onWish?: () => void;
}

/**
 * Galerie produit : carrousel swipeable avec pagination sur mobile,
 * grande image + miniatures cliquables sur desktop.
 */
export function DekkGallery({ images, alt, wished, onWish }: DekkGalleryProps) {
  const list = images.filter(Boolean);
  const [idx, setIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => setIdx(0), [list[0]]);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const next = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (next !== idx) setIdx(next);
  };

  if (!list.length) return <DekkImage src={null} alt={alt} priority />;

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        .dekk-gal-desktop{display:block}
        .dekk-gal-mobile{display:none}
        @media (max-width:900px){
          .dekk-gal-desktop{display:none}
          .dekk-gal-mobile{display:block}
        }
      `}</style>

      {/* Mobile — swipe */}
      <div className="dekk-gal-mobile">
        <div ref={trackRef} className="dekk-swipe" onScroll={onScroll} aria-label={`Galerie ${alt}`}>
          {list.map((src, i) => (
            <DekkImage key={i} src={src} alt={`${alt} — vue ${i + 1}`} priority={i === 0} width={1000} sizes="100vw" />
          ))}
        </div>
        {list.length > 1 && (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 12 }}>
            {list.map((_, i) => (
              <span key={i} style={{
                width: i === idx ? 18 : 6, height: 6, borderRadius: 3,
                background: i === idx ? DEKK.ink : DEKK.line,
                transition: 'width 260ms var(--dekk-ease), background 260ms ease',
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Desktop — image + miniatures */}
      <div className="dekk-gal-desktop">
        <DekkImage src={list[idx]} alt={alt} priority width={1100} sizes="(max-width: 900px) 100vw, 560px" />
        {list.length > 1 && (
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            {list.map((src, i) => (
              <button key={i} onClick={() => setIdx(i)} aria-label={`Vue ${i + 1}`} className="dekk-press"
                style={{
                  width: 66, padding: 0, background: 'none', cursor: 'pointer',
                  border: `1px solid ${i === idx ? DEKK.ink : 'transparent'}`,
                }}>
                <DekkImage src={src} alt="" width={200} sizes="66px" />
              </button>
            ))}
          </div>
        )}
      </div>

      {onWish && (
        <button onClick={onWish} aria-label="Ajouter aux favoris" className="dekk-press"
          style={{
            position: 'absolute', top: 14, right: 14, width: 40, height: 40, borderRadius: 20,
            background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Heart size={17} fill={wished ? DEKK.gold : 'none'} color={wished ? DEKK.gold : DEKK.ink} />
        </button>
      )}
    </div>
  );
}
