import { useCallback, useEffect, useRef, useState } from 'react';
import { DekkImage } from './DekkImage';
import { DEKK, SERIF, SANS, MONO } from './dekkTheme';

export type DekkCategoryItem = {
  key: string;
  label: string;
  image: string | null;
  count: number;
};

/**
 * Rail de catégories Dëkk — défilement horizontal snap, carte éditoriale
 * et indicateur latéral discret : filet vertical or à gauche de la carte active
 * + jauge de progression fine sous le rail.
 */
export function DekkCategoryRail({
  items,
  activeKey,
  onSelect,
}: {
  items: DekkCategoryItem[];
  activeKey?: string;
  onSelect: (key: string) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState({ ratio: 1, offset: 0 });

  const measure = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const ratio = el.scrollWidth > 0 ? Math.min(1, el.clientWidth / el.scrollWidth) : 1;
    setProgress({ ratio, offset: max > 0 ? el.scrollLeft / max : 0 });
  }, []);

  useEffect(() => {
    measure();
    const el = railRef.current;
    if (!el) return;
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [measure, items.length]);

  if (!items.length) return null;

  const thumbWidth = Math.max(12, progress.ratio * 100);
  const thumbLeft = progress.offset * (100 - thumbWidth);
  const scrollable = progress.ratio < 0.999;

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{`
        .dekk-rail{
          display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;
          -webkit-overflow-scrolling:touch;scrollbar-width:none;
          padding:2px 20px 2px 0;margin-right:-20px;
        }
        .dekk-rail::-webkit-scrollbar{display:none}
        .dekk-rail-item{
          scroll-snap-align:start;flex:0 0 clamp(190px, 24vw, 250px);
          background:none;border:none;padding:0 0 0 14px;cursor:pointer;text-align:left;
          position:relative;color:${DEKK.ink};
          transition:opacity 420ms cubic-bezier(.22,.8,.24,1);
        }
        .dekk-rail-item::before{
          content:'';position:absolute;left:0;top:6px;bottom:34px;width:1px;
          background:${DEKK.line};
          transition:background 420ms ease, transform 520ms cubic-bezier(.22,.8,.24,1);
          transform-origin:top;
        }
        .dekk-rail-item[data-active="true"]::before{background:${DEKK.gold};width:2px}
        .dekk-rail-item img{transition:transform 900ms cubic-bezier(.2,.7,.2,1), filter 500ms ease}
        @media (hover:hover){
          .dekk-rail:hover .dekk-rail-item{opacity:.58}
          .dekk-rail .dekk-rail-item:hover{opacity:1}
          .dekk-rail-item:hover img{transform:scale(1.05)}
          .dekk-rail-item:hover::before{background:${DEKK.gold}}
        }
        .dekk-rail-item[data-active="true"]{opacity:1}
        .dekk-rail-item[data-active="true"] img{filter:none}
        @media (max-width:640px){
          .dekk-rail-item{flex:0 0 62vw}
        }
      `}</style>

      <div ref={railRef} className="dekk-rail" role="list">
        {items.map((c) => {
          const active = activeKey === c.key;
          return (
            <button
              key={c.key}
              role="listitem"
              type="button"
              data-active={active}
              aria-pressed={active}
              className="dekk-rail-item dekk-press"
              onClick={() => onSelect(c.key)}
            >
              <DekkImage src={c.image} alt={c.label} ratio="4 / 5" width={640} sizes="(max-width: 640px) 62vw, 250px" />
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: 12 }}>
                <span style={{ fontFamily: SERIF, fontSize: 19, lineHeight: 1.2 }}>{c.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.12em', color: active ? DEKK.gold : DEKK.muted }}>
                  {String(c.count).padStart(2, '0')}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Jauge latérale de progression */}
      {scrollable && (
        <div aria-hidden style={{ position: 'relative', height: 1, background: DEKK.line, marginTop: 22, maxWidth: 320 }}>
          <span
            style={{
              position: 'absolute', top: -0.5, height: 2, background: DEKK.gold,
              width: `${thumbWidth}%`, left: `${thumbLeft}%`,
              transition: 'left 160ms linear',
            }}
          />
        </div>
      )}
    </div>
  );
}
