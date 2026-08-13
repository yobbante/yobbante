import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, Heart, User, Menu, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDekkCartCount } from '@/hooks/useDekkCart';
import { DEKK, SERIF, SANS, MONO, fmtFcfa, openDekkCart } from './dekkTheme';

export interface DekkHeaderProps {
  /** Current search value (controlled) — optional, header keeps its own state otherwise. */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onWishlist?: () => void;
  sticky?: boolean;
}

type Suggestion = { id: string; name: string; price_fcfa: number; image_url: string | null };

const NAV = [
  { label: 'Boutique', to: '/boutique?all=1' },
  { label: 'Nouveautés', to: '/boutique?sort=new' },
  { label: 'Packs', to: '/boutique?cat=packs-cadeaux' },
  { label: 'Suivi', to: '/suivre' },
];

/**
 * Header éditorial Dëkk : bandeau livraison, nav à gauche, logo centré,
 * icônes à droite. Recherche avec autocomplete, menu hamburger sur mobile.
 */
export function DekkHeader({ searchValue, onSearchChange, onWishlist, sticky = true }: DekkHeaderProps) {
  const nav = useNavigate();
  const cartCount = useDekkCartCount();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
  const [pool, setPool] = useState<Suggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = searchValue !== undefined ? searchValue : localQuery;
  const setQuery = (v: string) => {
    setLocalQuery(v);
    onSearchChange?.(v);
  };

  useEffect(() => {
    if (!searchOpen || pool.length) return;
    (async () => {
      const { data } = await supabase
        .from('products' as any)
        .select('id,name,price_fcfa,image_url')
        .eq('status', 'published')
        .eq('en_vente', true)
        .limit(200);
      setPool(((data as any) || []) as Suggestion[]);
    })();
  }, [searchOpen, pool.length]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 40);
  }, [searchOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [menuOpen]);


  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return pool.filter((p) => p.name?.toLowerCase().includes(q)).slice(0, 6);
  }, [query, pool]);

  return (
    <header
      style={{
        position: sticky ? 'sticky' : 'static',
        top: 0,
        zIndex: 60,
        background: 'rgba(247,244,239,0.92)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${DEKK.line}`,
        fontFamily: SANS,
        color: DEKK.ink,
      }}
    >
      <style>{`
        .dekk-nav-link{position:relative;transition:color 180ms ease}
        .dekk-nav-link:hover{color:${DEKK.gold}}
        .dekk-icon-btn{transition:opacity 160ms ease,color 160ms ease}
        .dekk-icon-btn:hover{color:${DEKK.gold}}
        @media (max-width:860px){ .dekk-desktop-only{display:none !important} }
        @media (min-width:861px){ .dekk-mobile-only{display:none !important} }
        @media (max-width:860px){
          .dekk-topbar{height:60px !important;padding:0 12px !important;gap:6px !important}
          .dekk-actions{gap:2px !important}
          /* cibles tactiles 44px */
          .dekk-actions .dekk-icon-btn, .dekk-menu-btn{
            width:44px;height:44px;padding:0 !important;
            align-items:center;justify-content:center;
          }
          .dekk-actions .dekk-icon-btn svg, .dekk-menu-btn svg{width:22px;height:22px}
          .dekk-logo{font-size:22px !important;letter-spacing:0.26em !important;padding-left:0.26em !important}
        }
        @media (max-width:380px){
          .dekk-actions .dekk-icon-btn, .dekk-menu-btn{width:40px;height:40px}
          .dekk-logo{font-size:20px !important}
        }
      `}</style>


      {/* Bandeau livraison */}
      <div style={{ background: DEKK.ink, color: '#F7F4EF', textAlign: 'center', padding: '7px 16px' }}>
        <span style={{ fontSize: 11, fontFamily: MONO, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Livraison offerte dès 25 000 FCFA · Dakar J+1 · Régions J+3
        </span>
      </div>

      {/* Barre principale */}
      <div
        className="dekk-topbar"
        style={{
          maxWidth: 1180, margin: '0 auto', padding: '0 20px', height: 68,
          display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12,
        }}
      >
        {/* Gauche — nav / hamburger */}
        <nav className="dekk-desktop-only" style={{ display: 'flex', gap: 26 }}>
          {NAV.map((n) => (
            <Link key={n.label} to={n.to} className="dekk-nav-link"
              style={{ fontSize: 12.5, letterSpacing: '0.04em', color: DEKK.ink, textDecoration: 'none' }}>
              {n.label}
            </Link>
          ))}
        </nav>
        <button className="dekk-mobile-only dekk-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu"
          style={{ background: 'none', border: 'none', padding: 4, color: DEKK.ink, cursor: 'pointer', justifySelf: 'start', display: 'inline-flex' }}>
          <Menu size={22} />
        </button>

        {/* Centre — logo */}
        <Link to="/boutique" style={{ textDecoration: 'none', textAlign: 'center', color: DEKK.ink }}>
          <div className="dekk-logo" style={{ fontFamily: SERIF, fontSize: 26, letterSpacing: '0.32em', lineHeight: 1, paddingLeft: '0.32em' }}>
            DËKK
          </div>
          <div className="dekk-desktop-only" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: DEKK.muted, marginTop: 5 }}>
            by Yobbanté
          </div>
        </Link>

        {/* Droite — icônes */}
        <div className="dekk-actions" style={{ display: 'flex', alignItems: 'center', gap: 18, justifySelf: 'end' }}>
          <button className="dekk-icon-btn" onClick={() => setSearchOpen((v) => !v)} aria-label="Rechercher"
            style={iconBtn}>
            <Search size={19} />
          </button>
          <button className="dekk-icon-btn dekk-desktop-only"
            onClick={() => (onWishlist ? onWishlist() : nav('/boutique?wishlist=1'))}
            aria-label="Favoris" style={iconBtn}>
            <Heart size={19} />
          </button>
          <button className="dekk-icon-btn dekk-desktop-only" onClick={() => nav('/auth')} aria-label="Compte" style={iconBtn}>
            <User size={19} />
          </button>
          <button className="dekk-icon-btn" onClick={openDekkCart} aria-label="Voir le panier"
            style={{ ...iconBtn, position: 'relative' }}>
            <ShoppingBag size={19} />
            {cartCount > 0 && (
              <span style={{
                position: 'absolute', top: -5, right: -7, minWidth: 17, height: 17, padding: '0 4px',
                borderRadius: 9, background: DEKK.gold, color: '#fff', fontSize: 9.5, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Recherche + autocomplete */}
      {searchOpen && (
        <div style={{ borderTop: `1px solid ${DEKK.line}`, background: DEKK.surface }}>
          <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 20px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${DEKK.ink}`, paddingBottom: 8 }}>
              <Search size={17} color={DEKK.muted} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setSearchOpen(false); }}
                placeholder="Rechercher un produit…"
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, fontFamily: SANS, color: DEKK.ink }}
              />

              <button onClick={() => setSearchOpen(false)} aria-label="Fermer la recherche" style={iconBtn}>
                <X size={17} />
              </button>
            </div>
            {suggestions.length > 0 && (
              <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <Link to={`/boutique/${s.id}`} onClick={() => setSearchOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 4px', textDecoration: 'none', color: DEKK.ink }}>
                      <span style={{ width: 40, height: 46, background: DEKK.creamDeep, overflow: 'hidden', flexShrink: 0 }}>
                        {s.image_url && <img src={s.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </span>
                      <span style={{ flex: 1, fontFamily: SERIF, fontSize: 17 }}>{s.name}</span>
                      <span style={{ fontFamily: MONO, fontSize: 12, color: DEKK.muted }}>{fmtFcfa(s.price_fcfa)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {query.trim().length >= 2 && suggestions.length === 0 && (
              <p style={{ fontSize: 13, color: DEKK.muted, marginTop: 14 }}>
                Aucun produit pour « {query.trim()} ». Essayez une autre orthographe ou parcourez le catalogue.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Menu mobile — plein écran éditorial */}
      {menuOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          style={{
            position: 'fixed', inset: 0, zIndex: 2000, fontFamily: SANS,
            background: `radial-gradient(120% 80% at 100% 0%, ${DEKK.goldSoft} 0%, ${DEKK.cream} 46%, ${DEKK.creamDeep} 100%)`,
            display: 'flex', flexDirection: 'column',
            animation: 'dekkMenuFade 240ms cubic-bezier(.22,.8,.24,1) both',
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            overflowY: 'auto',
            color: DEKK.ink,
          }}
        >
          <style>{`
            @keyframes dekkMenuFade{from{opacity:0}to{opacity:1}}
            @keyframes dekkMenuItem{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
            .dekk-menu-item{animation:dekkMenuItem 520ms var(--dekk-ease, cubic-bezier(.22,.8,.24,1)) both}
            .dekk-menu-item .dekk-menu-rule{transform:scaleX(.16);transform-origin:left;transition:transform 420ms var(--dekk-ease, ease)}
            .dekk-menu-item:active .dekk-menu-rule{transform:scaleX(1)}
            .dekk-menu-num{font-variant-numeric:tabular-nums}
          `}</style>

          {/* Barre haute */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '18px 20px', borderBottom: `1px solid ${DEKK.line}`,
          }}>
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 22, letterSpacing: '0.3em', paddingLeft: '0.3em', lineHeight: 1 }}>DËKK</div>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: DEKK.muted, marginTop: 5 }}>
                by Yobbanté
              </div>
            </div>
            <button onClick={() => setMenuOpen(false)} aria-label="Fermer le menu"
              style={{
                width: 44, height: 44, borderRadius: 999, border: `1px solid ${DEKK.line}`,
                background: 'rgba(255,255,255,0.7)', color: DEKK.ink, display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>
              <X size={20} />
            </button>
          </div>

          {/* Liens principaux */}
          <nav style={{ padding: '10px 20px 4px', flex: 1 }}>
            {[...NAV, { label: 'Favoris', to: '/boutique?wishlist=1' }, { label: 'Mon compte', to: '/mon-compte' }].map((n, i) => (
              <Link
                key={n.label}
                to={n.to}
                onClick={() => setMenuOpen(false)}
                className="dekk-menu-item"
                style={{
                  display: 'block', textDecoration: 'none', color: DEKK.ink,
                  padding: '16px 0 12px', animationDelay: `${60 + i * 55}ms`,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                  <span className="dekk-menu-num" style={{ fontFamily: MONO, fontSize: 10, color: DEKK.gold, letterSpacing: '0.14em' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontFamily: SERIF, fontSize: 34, lineHeight: 1.05, letterSpacing: '-0.01em' }}>{n.label}</span>
                </span>
                <span className="dekk-menu-rule" style={{ display: 'block', height: 1, background: DEKK.gold, marginTop: 14 }} />
              </Link>
            ))}
          </nav>

          {/* Pied de menu */}
          <div style={{ padding: '18px 20px 26px', borderTop: `1px solid ${DEKK.line}` }}>
            <button
              onClick={() => { setMenuOpen(false); openDekkCart(); }}
              className="dekk-press"
              style={{
                width: '100%', height: 52, border: 'none', cursor: 'pointer',
                background: DEKK.ink, color: '#F7F4EF', fontFamily: MONO, fontSize: 11,
                letterSpacing: '0.16em', textTransform: 'uppercase',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              <ShoppingBag size={16} />
              Voir le panier{cartCount > 0 ? ` · ${cartCount}` : ''}
            </button>
            <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: DEKK.muted, marginTop: 16, textAlign: 'center' }}>
              Livraison offerte dès 25 000 FCFA
            </p>
          </div>
        </div>
      )}

    </header>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 2, color: DEKK.ink, cursor: 'pointer', display: 'inline-flex',
};
