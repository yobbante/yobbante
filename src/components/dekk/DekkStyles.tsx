import { DEKK } from './dekkTheme';

/**
 * Feuille de style globale Dëkk : micro-interactions, shimmer de chargement,
 * scroll-snap des galeries mobiles, respect de `prefers-reduced-motion`.
 * Montée une seule fois via DekkLayout — aucun coût de rendu par composant.
 */
export function DekkStyles() {
  return (
    <style>{`
      :root{
        --dekk-ease:cubic-bezier(.22,.8,.24,1);
        --dekk-safe-b:env(safe-area-inset-bottom, 0px);
      }
      .dekk-shimmer{
        position:absolute;inset:0;
        background:linear-gradient(100deg, ${DEKK.creamDeep} 30%, #F6F2EB 48%, ${DEKK.creamDeep} 66%);
        background-size:220% 100%;
        animation:dekkShimmer 1.35s ease-in-out infinite;
      }
      @keyframes dekkShimmer{0%{background-position:120% 0}100%{background-position:-120% 0}}
      @keyframes dekkFade{from{opacity:0}to{opacity:1}}
      @keyframes dekkSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
      @keyframes dekkSheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
      @keyframes dekkRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}

      .dekk-rise{animation:dekkRise 520ms var(--dekk-ease) both}
      .dekk-press{transition:transform 160ms var(--dekk-ease), opacity 160ms ease}
      .dekk-press:active{transform:scale(.975);opacity:.9}

      .dekk-swipe{
        display:flex;overflow-x:auto;scroll-snap-type:x mandatory;
        -webkit-overflow-scrolling:touch;scrollbar-width:none;
      }
      .dekk-swipe::-webkit-scrollbar{display:none}
      .dekk-swipe > *{scroll-snap-align:center;flex:0 0 100%}

      @media (prefers-reduced-motion: reduce){
        *,*::before,*::after{animation-duration:.001ms !important;transition-duration:.001ms !important}
      }
    `}</style>
  );
}
