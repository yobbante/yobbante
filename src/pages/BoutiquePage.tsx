import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { supabase } from '@/integrations/supabase/client';
import { ShoppingBag, Heart, X, Plus, Minus, ArrowUpRight, ShieldCheck, Globe } from 'lucide-react';
import { useSeo } from '@/hooks/useSeo';
import { DekkHeader } from '@/components/dekk/DekkHeader';
import { CatNav, CAT_PILLS, type CatKey } from '@/components/dekk/CatNav';
import { useDekkCart } from '@/hooks/useDekkCart';
import { useDekkWishlist } from '@/hooks/useDekkWishlist';
import { ecommerce } from '@/lib/analytics';

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price_eur: number;
  price_fcfa: number;
  origin_country: string;
  stock_mode: string;
  stock_qty: number;
  delivery_days: number | null;
  status: string;
  image_url: string | null;
  source_type: string;
  verified?: boolean;
  created_at: string;
};

const DEKK = {
  accent: '#C97B3A',
  accentLight: '#F5E6D8',
  accentDark: '#8B5220',
  accentSoft: '#FBF3EA',
  ink: '#0E0E0E',
  line: '#ECECEC',
  muted: '#6B6B6B',
};

const CAT_LABEL: Record<string, string> = Object.fromEntries(CAT_PILLS.map(c => [c.key, c.label]));

const DB_TO_UI: Record<string, CatKey> = {
  'mode': 'merch-identite',
  'auto': 'voyage-mobilite',
  'tech': 'tech-productivite',
  'electronique': 'rc-gadgets',
  'maison': 'lifestyle-deco',
  'beaute': 'bien-etre',
};

const SORTS = [
  { id: 'trending', label: 'Tendance' },
  { id: 'price_asc', label: 'Prix croissant' },
  { id: 'price_desc', label: 'Prix décroissant' },
  { id: 'new', label: 'Nouveautés' },
];

const ORIGIN_LABEL: Record<string, string> = { CN: 'Chine', US: 'USA', FR: 'France', OTHER: 'International' };

const fmtEur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const fmtFcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const isNew = (d: string) => Date.now() - +new Date(d) < 14 * 24 * 3600 * 1000;

type CartItem = { product: Product; qty: number };

export default function BoutiquePage() {
  useSeo({
    title: 'Boutique Dëkk — Produits importés à Dakar | Yobbanté',
    description: 'Découvrez Dëkk by Yobbanté : produits sélectionnés et importés à Dakar avec livraison rapide.',
    path: '/boutique',
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<CatKey>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('trending');
  const [cartOpen, setCartOpen] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const wishlistOnly = searchParams.get('wishlist') === '1';

  const wishlist = useDekkWishlist();
  const cart = useDekkCart();
  const cartCount = cart.count;
  const cartTotal = cart.total;

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('products' as any)
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });
      setProducts((data as any as Product[]) || []);
      setLoading(false);
    })();
  }, []);

  // Debounced Search event (Meta Pixel + GA4)
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => ecommerce.search(q), 600);
    return () => clearTimeout(t);
  }, [search]);

  const toggleWish = (id: string) => wishlist.toggle(id);
  const addToCart = (p: Product) => {
    cart.addItem(p as any, 1);
    setCartOpen(true);
  };
  const updateQty = (id: string, delta: number) => cart.updateQty(id, delta);

  const toggleWishlistFilter = () => {
    const sp = new URLSearchParams(searchParams);
    if (wishlistOnly) sp.delete('wishlist'); else sp.set('wishlist', '1');
    setSearchParams(sp, { replace: true });
  };

  const filtered = useMemo(() => {
    let list = activeCat === 'all'
      ? products
      : products.filter(p => DB_TO_UI[p.category] === activeCat);
    if (wishlistOnly) list = list.filter(p => wishlist.has(p.id));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q));
    }
    if (sort === 'price_asc') list = [...list].sort((a, b) => a.price_eur - b.price_eur);
    else if (sort === 'price_desc') list = [...list].sort((a, b) => b.price_eur - a.price_eur);
    else if (sort === 'new') list = [...list].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return list;
  }, [products, activeCat, search, sort, wishlistOnly, wishlist]);

  const wowProducts = useMemo(() => {
    const wowCats = ['cachettes', 'rc-gadgets', 'gaming'];
    return products
      .filter(p => wowCats.includes(p.category) && (p.stock_qty > 0 || p.stock_mode === 'DROP'))
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .slice(0, 4);
  }, [products]);

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: '"DM Sans", system-ui, sans-serif', color: DEKK.ink }}>
      <style>{`
        .dekk-chips::-webkit-scrollbar{display:none}
        @keyframes dekkFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes dekkSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes dekkShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes dekkMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
      `}</style>

      <DekkHeader
        searchValue={search}
        onSearchChange={setSearch}
        onWishlist={toggleWishlistFilter}
      />

      {/* HERO BANNER */}
      <div className="max-w-6xl mx-auto px-4 md:px-6" style={{ marginTop: 24 }}>
        <div style={{
          background: '#FBF3EC',
          border: '0.5px solid #F5E6D8',
          borderRadius: 12,
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}>
          <div>
            <span style={{
              fontSize: 10,
              fontFamily: '"SF Mono", "DM Mono", ui-monospace, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#C97B3A',
            }}>
              LANCEMENT DËKK
            </span>
            <h2 style={{
              fontSize: 18,
              fontWeight: 500,
              color: '#8B5220',
              lineHeight: 1.3,
              marginTop: 6,
              marginBottom: 0,
            }}>
              Produits testés,<br />livrés depuis le monde.
            </h2>
            <p style={{
              fontSize: 13,
              color: '#8B5220',
              opacity: 0.7,
              marginTop: 4,
              marginBottom: 0,
            }}>
              Sélection rigoureuse · Prix justes · Livraison Yobbanté
            </p>
            <button
              onClick={() => document.getElementById('dekk-product-grid')?.scrollIntoView({ behavior: 'smooth' })}
              style={{
                background: '#C97B3A',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 500,
                marginTop: 14,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Découvrir <ArrowUpRight size={14} />
            </button>
          </div>
          <div style={{
            width: 80,
            height: 80,
            background: '#F5E6D8',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Globe size={36} color="#C97B3A" />
          </div>
        </div>
      </div>


      {/* CAT NAV */}
      <CatNav active={activeCat} onChange={setActiveCat} />

      <main className="max-w-6xl mx-auto px-4 md:px-6" style={{ padding: '24px 16px 100px' }}>
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', margin: 0 }}>
              {activeCat === 'all' ? 'Toute la sélection' : CAT_LABEL[activeCat]}
            </h2>
            <p style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', color: DEKK.muted, margin: 0 }}>
              {filtered.length} produit{filtered.length > 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* SECTION EFFET WAOUH */}
        {!loading && wowProducts.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
              <h2 style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em', margin: 0 }}>
                Effet waouh — à ne pas rater
              </h2>
              <button
                onClick={() => setActiveCat('all')}
                style={{ background: 'none', border: 'none', fontSize: 12, color: '#C97B3A', cursor: 'pointer', padding: 0 }}
              >
                Voir tout →
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
              {wowProducts.map((p, i) => (
                <ProductCard key={p.id} p={p} idx={i}
                  wished={wishlist.has(p.id)} onWish={() => toggleWish(p.id)}
                  onAdd={() => addToCart(p)} badge="Waouh" />
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <SkeletonGrid />
        ) : filtered.length === 0 ? (
          <EmptyState onReset={() => { setActiveCat('all'); setSearch(''); }} />
        ) : (
          <>
            <div id="dekk-product-grid" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
              {filtered.slice(0, 6).map((p, i) => (
                <ProductCard key={p.id} p={p} idx={i}
                  wished={wishlist.has(p.id)} onWish={() => toggleWish(p.id)}
                  onAdd={() => addToCart(p)} />
              ))}
            </div>

            {filtered.length > 6 && <FeaturedStrip />}

            {filtered.length > 6 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
                {filtered.slice(6).map((p, i) => (
                  <ProductCard key={p.id} p={p} idx={i + 6}
                    wished={wishlist.has(p.id)} onWish={() => toggleWish(p.id)}
                    onAdd={() => addToCart(p)} />
                ))}
              </div>
            )}
          </>
        )}

        <footer className="mt-20 pt-10" style={{ borderTop: `0.5px solid ${DEKK.line}`, textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', color: DEKK.muted, letterSpacing: '0.1em', margin: 0 }}>
            DËKK · BY YOBBANTÉ · ÉDITION 2026
          </p>
          <p style={{ fontSize: 12, color: DEKK.muted, marginTop: 6 }}>
            La boutique alimentée par la communauté.
          </p>
        </footer>
      </main>

      {/* FLOATING CART BUTTON */}
      {cartCount > 0 && !cartOpen && (
        <button onClick={() => setCartOpen(true)}
          style={{
            position: 'fixed', bottom: 20, right: 20, zIndex: 50,
            height: 56, padding: '0 22px 0 18px', borderRadius: 28,
            background: DEKK.ink, color: '#fff', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,0.25)', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            animation: 'dekkFadeIn 250ms ease-out',
          }}
          aria-label="Voir le panier">
          <ShoppingBag size={18} />
          <span>Panier</span>
          <span style={{
            background: DEKK.accent, color: '#fff', fontSize: 11, fontWeight: 700,
            minWidth: 22, height: 22, borderRadius: 11, padding: '0 7px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{cartCount}</span>
        </button>
      )}

      {cartOpen && (
        <CartDrawer cart={cart.items as any} total={cartTotal} onClose={() => setCartOpen(false)} onQty={updateQty} />
      )}
    </div>
  );
}

function FeaturedStrip() {
  return (
    <div
      className="flex items-center justify-between flex-wrap gap-3"
      style={{
        background: DEKK.ink, color: '#fff',
        borderRadius: 18, padding: '24px 26px', margin: '24px 0',
        position: 'relative', overflow: 'hidden',
      }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(600px circle at 90% 50%, ${DEKK.accent}30, transparent 60%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 10, fontFamily: '"DM Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.14em', color: DEKK.accent, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Sélection du moment
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginTop: 6, letterSpacing: '-0.01em' }}>
          Ce que Dakar commande maintenant.
        </div>
      </div>
      <button style={{ background: '#fff', color: DEKK.ink, fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 100, padding: '11px 20px', cursor: 'pointer', position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        Découvrir <ArrowUpRight size={14} />
      </button>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{ borderRadius: 14, overflow: 'hidden', background: '#FAFAFA', border: `0.5px solid ${DEKK.line}` }}>
          <div style={{ aspectRatio: '1/1', background: 'linear-gradient(90deg, #F0F0F0 0%, #F8F8F8 50%, #F0F0F0 100%)', backgroundSize: '200% 100%', animation: 'dekkShimmer 1.4s infinite' }} />
          <div style={{ padding: 12 }}>
            <div style={{ height: 10, width: '40%', background: '#EEE', borderRadius: 4, marginBottom: 8 }} />
            <div style={{ height: 14, width: '90%', background: '#EEE', borderRadius: 4, marginBottom: 12 }} />
            <div style={{ height: 18, width: '50%', background: '#EEE', borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="text-center" style={{ padding: '64px 24px' }}>
      <div style={{
        width: 56, height: 56, borderRadius: 28, background: DEKK.accentSoft,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
      }}>
        <ShoppingBag size={22} color={DEKK.accent} />
      </div>
      <p style={{ fontSize: 17, fontWeight: 600, color: DEKK.ink, margin: 0 }}>Aucun produit trouvé.</p>
      <p style={{ fontSize: 13, color: DEKK.muted, marginTop: 8 }}>
        Essayez d'autres filtres ou explorez toutes les catégories.
      </p>
      <button onClick={onReset} style={{ marginTop: 20, background: DEKK.ink, color: '#fff', border: 'none', borderRadius: 100, padding: '12px 24px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
        Réinitialiser
      </button>
    </div>
  );
}

function ProductCard({ p, idx, wished, onWish, onAdd, badge }: {
  p: Product; idx: number; wished: boolean;
  onWish: () => void; onAdd: () => void;
  badge?: string;
}) {
  const [hovering, setHovering] = useState(false);
  const stockBadge =
    p.stock_mode === 'stock'
      ? { label: 'En stock', dot: '#0E7A4F' }
      : { label: `Sous ${p.delivery_days ?? 7} j`, dot: DEKK.accent };
  const newBadge = isNew(p.created_at);

  return (
    <article
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        display: 'flex', flexDirection: 'column',
        animation: `dekkFadeIn 320ms ease-out ${Math.min(idx * 40, 320)}ms both`,
      }}>
      <Link to={`/boutique/${p.id}`} style={{
        position: 'relative', aspectRatio: '1/1', background: '#F6F6F6', overflow: 'hidden',
        borderRadius: 14, display: 'block',
      }}>
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 600ms cubic-bezier(.2,.8,.2,1)', transform: hovering ? 'scale(1.05)' : 'scale(1)' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: '#CCC' }}>
            <ShoppingBag size={28} />
          </div>
        )}

        {/* Top-left badges */}
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {badge && (
            <span style={{ background: '#C97B3A', color: '#fff', borderRadius: 4, padding: '3px 7px', fontFamily: '"DM Mono", monospace', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em' }}>
              {badge}
            </span>
          )}
          {newBadge && (
            <span style={{ background: DEKK.ink, color: '#fff', borderRadius: 4, padding: '3px 7px', fontFamily: '"DM Mono", monospace', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em' }}>
              NOUVEAU
            </span>
          )}
          {p.verified && (
            <span style={{ background: '#fff', color: DEKK.ink, borderRadius: 4, padding: '3px 7px', fontFamily: '"DM Mono", monospace', fontSize: 9, fontWeight: 600, letterSpacing: '0.05em', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <ShieldCheck size={10} color={DEKK.accent} /> TESTÉ
            </span>
          )}
        </div>

        {/* Wishlist */}
        <button onClick={(e) => { e.preventDefault(); onWish(); }} aria-label="Favori"
          style={{
            position: 'absolute', top: 10, right: 10, width: 32, height: 32,
            borderRadius: 16, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(6px)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Heart size={14} fill={wished ? DEKK.accent : 'none'} color={wished ? DEKK.accent : DEKK.ink} />
        </button>
      </Link>

      <div style={{ padding: '12px 2px 0', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ fontSize: 10, fontFamily: '"DM Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: DEKK.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{CAT_LABEL[DB_TO_UI[p.category]] ?? p.category}</span>
          <span style={{ width: 3, height: 3, borderRadius: 2, background: stockBadge.dot, display: 'inline-block' }} />
          <span>{stockBadge.label}</span>
        </div>
        <Link to={`/boutique/${p.id}`} style={{
          fontSize: 13.5, fontWeight: 500, color: DEKK.ink, lineHeight: 1.35,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', minHeight: 36, marginTop: 6, textDecoration: 'none',
        }}>
          {p.name}
        </Link>

        <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: DEKK.ink, lineHeight: 1 }}>
              {fmtEur(p.price_eur)}
            </div>
            <div style={{ fontSize: 10, color: DEKK.muted, fontFamily: '"DM Mono", monospace', marginTop: 3 }}>
              {fmtFcfa(p.price_fcfa)}
            </div>
          </div>
          <button
            onClick={onAdd}
            aria-label="Ajouter au panier"
            style={{
              width: 38, height: 38, borderRadius: 19,
              background: DEKK.ink, color: '#fff',
              border: 'none', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform 150ms, background 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = DEKK.accent; }}
            onMouseLeave={e => { e.currentTarget.style.background = DEKK.ink; }}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}

function CartDrawer({ cart, total, onClose, onQty }: {
  cart: CartItem[]; total: number; onClose: () => void;
  onQty: (id: string, delta: number) => void;
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60, animation: 'dekkFadeIn 200ms' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 61,
        background: '#fff', borderRadius: '20px 20px 0 0',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        animation: 'dekkSlideUp 280ms cubic-bezier(.2,.8,.2,1)',
      }}
        className="md:left-auto md:right-4 md:bottom-4 md:top-4 md:rounded-2xl md:max-w-md md:w-full">
        <div style={{ padding: '16px 20px', borderBottom: `0.5px solid ${DEKK.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Mon panier</div>
            <div style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', color: DEKK.muted, marginTop: 2 }}>
              {cart.length} article{cart.length > 1 ? 's' : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#F4F4F4', border: 'none', width: 36, height: 36, borderRadius: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <ShoppingBag size={32} color="#CCC" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: DEKK.muted, fontSize: 13 }}>Votre panier est vide</p>
            </div>
          ) : cart.map(item => (
            <Link to={`/boutique/${item.product.id}`} key={item.product.id} onClick={onClose}
              style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: `0.5px solid ${DEKK.line}`, textDecoration: 'none', color: 'inherit' }}>
              <div style={{ width: 64, height: 64, borderRadius: 8, background: '#F8F8F8', overflow: 'hidden', flexShrink: 0 }}>
                {item.product.image_url && <img src={item.product.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {item.product.name}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>
                  {fmtEur(item.product.price_eur * item.qty)}
                </div>
              </div>
              <div onClick={e => e.preventDefault()} style={{ display: 'flex', alignItems: 'center', gap: 4, height: 32, alignSelf: 'center' }}>
                <button onClick={() => onQty(item.product.id, -1)} style={{ width: 28, height: 28, borderRadius: 14, border: `1px solid ${DEKK.line}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Minus size={12} />
                </button>
                <span style={{ minWidth: 20, textAlign: 'center', fontSize: 13, fontWeight: 600, fontFamily: '"DM Mono", monospace' }}>{item.qty}</span>
                <button onClick={() => onQty(item.product.id, 1)} style={{ width: 28, height: 28, borderRadius: 14, border: 'none', background: DEKK.ink, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={12} />
                </button>
              </div>
            </Link>
          ))}
        </div>

        {cart.length > 0 && (
          <div style={{ padding: 16, borderTop: `0.5px solid ${DEKK.line}`, background: '#FAFAFA' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: DEKK.muted }}>Sous-total</span>
              <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>{fmtEur(total)}</span>
            </div>
            <div style={{ fontSize: 11, color: DEKK.muted, fontFamily: '"DM Mono", monospace', marginBottom: 14 }}>
              ≈ {fmtFcfa(total * 655)} · Livraison incluse
            </div>
            <button
              onClick={() => { window.location.href = '/panier'; }}
              style={{ width: '100%', minHeight: 50, background: DEKK.ink, color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Passer commande →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
