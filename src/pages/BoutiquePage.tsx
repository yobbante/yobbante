import { useEffect, useMemo, useState } from 'react';
import { PublicNav } from '@/components/PublicNav';
import { supabase } from '@/integrations/supabase/client';
import { ShoppingBag, Heart, Search, SlidersHorizontal, X, Plus, Minus, Check, Sparkles, TrendingUp, Star } from 'lucide-react';

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price_eur: number;
  price_fcfa: number;
  origin_country: string;
  stock_mode: string;
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
  ink: '#1A1A1A',
};

const CATEGORIES: { key: string; label: string; emoji: string }[] = [
  { key: 'all', label: 'Tout', emoji: '✨' },
  { key: 'electronique', label: 'Électronique', emoji: '🎧' },
  { key: 'mode', label: 'Mode', emoji: '👕' },
  { key: 'maison', label: 'Maison', emoji: '🏠' },
  { key: 'auto', label: 'Auto', emoji: '🚗' },
  { key: 'tech', label: 'Tech', emoji: '💻' },
  { key: 'beaute', label: 'Beauté', emoji: '💄' },
  { key: 'autre', label: 'Autre', emoji: '🛍️' },
];
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.key, c.label]));

const SORTS = [
  { id: 'trending', label: 'Tendance' },
  { id: 'price_asc', label: 'Prix ↑' },
  { id: 'price_desc', label: 'Prix ↓' },
  { id: 'new', label: 'Nouveautés' },
];

const ORIGIN_LABEL: Record<string, { flag: string; name: string }> = {
  CN: { flag: '🇨🇳', name: 'Chine' },
  US: { flag: '🇺🇸', name: 'USA' },
  FR: { flag: '🇫🇷', name: 'France' },
  OTHER: { flag: '🌍', name: 'Autre' },
};

const fmtEur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const fmtFcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const isNew = (d: string) => Date.now() - +new Date(d) < 14 * 24 * 3600 * 1000;

type CartItem = { product: Product; qty: number };

export default function BoutiquePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('trending');
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [quickView, setQuickView] = useState<Product | null>(null);
  const [showSort, setShowSort] = useState(false);

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
    try {
      const w = JSON.parse(localStorage.getItem('dekk_wishlist') || '[]');
      setWishlist(new Set(w));
      const c = JSON.parse(localStorage.getItem('dekk_cart') || '[]');
      setCart(c);
    } catch {}
  }, []);

  useEffect(() => { localStorage.setItem('dekk_wishlist', JSON.stringify([...wishlist])); }, [wishlist]);
  useEffect(() => { localStorage.setItem('dekk_cart', JSON.stringify(cart)); }, [cart]);

  const toggleWish = (id: string) => {
    setWishlist(w => { const n = new Set(w); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const addToCart = (p: Product) => {
    setCart(c => {
      const existing = c.find(i => i.product.id === p.id);
      if (existing) return c.map(i => i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...c, { product: p, qty: 1 }];
    });
    setCartOpen(true);
  };
  const updateQty = (id: string, delta: number) => {
    setCart(c => c.map(i => i.product.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0));
  };
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.product.price_eur * i.qty, 0);

  const filtered = useMemo(() => {
    let list = activeCat === 'all' ? products : products.filter(p => p.category === activeCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q));
    }
    if (sort === 'price_asc') list = [...list].sort((a, b) => a.price_eur - b.price_eur);
    else if (sort === 'price_desc') list = [...list].sort((a, b) => b.price_eur - a.price_eur);
    else if (sort === 'new') list = [...list].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return list;
  }, [products, activeCat, search, sort]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: products.length };
    products.forEach(p => { m[p.category] = (m[p.category] || 0) + 1; });
    return m;
  }, [products]);

  return (
    <div className="min-h-screen" style={{ background: '#FFFFFF', fontFamily: '"DM Sans", system-ui, sans-serif', color: DEKK.ink }}>
      <PublicNav />

      {/* HERO */}
      <section style={{
        background: `linear-gradient(135deg, ${DEKK.accentSoft} 0%, #FFFFFF 70%)`,
        borderBottom: `0.5px solid ${DEKK.accentLight}`,
      }}>
        <div className="max-w-6xl mx-auto" style={{ padding: '32px 20px 28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: '#fff', border: `0.5px solid ${DEKK.accentLight}`, fontSize: 10, fontFamily: '"DM Mono", monospace', color: DEKK.accentDark, letterSpacing: '0.08em', marginBottom: 14 }}>
            <Sparkles size={11} /> NOUVELLE COLLECTION · BY YOBBANTÉ
          </div>
          <h1 style={{ fontSize: 'clamp(40px, 11vw, 72px)', fontWeight: 800, letterSpacing: '-0.04em', color: DEKK.accent, margin: 0, lineHeight: 0.95 }}>
            DËKK
          </h1>
          <p style={{ fontSize: 'clamp(15px, 4vw, 18px)', fontWeight: 500, color: DEKK.ink, marginTop: 10, maxWidth: 480 }}>
            Le monde, livré ici. <span style={{ color: '#666', fontWeight: 400 }}>Sourcing, contrôle qualité et livraison incluse au Sénégal.</span>
          </p>

          {/* Search bar */}
          <div style={{ marginTop: 22, position: 'relative', maxWidth: 560 }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un produit, une marque..."
              style={{
                width: '100%', height: 48, padding: '0 14px 0 40px', fontSize: 14,
                border: `0.5px solid ${DEKK.accentLight}`, borderRadius: 24,
                background: '#fff', color: DEKK.ink, outline: 'none',
                boxShadow: '0 4px 20px rgba(201, 123, 58, 0.08)',
              }}
            />
          </div>

          {/* Trust strip */}
          <div style={{ marginTop: 14, display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 11, fontFamily: '"DM Mono", monospace', color: '#666' }}>
            <span>✓ Testé & importé</span>
            <span>✓ Livraison incluse</span>
            <span>✓ Paiement sécurisé</span>
          </div>
        </div>
      </section>

      {/* STICKY FILTER BAR */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '0.5px solid #EEE',
      }}>
        <div className="max-w-6xl mx-auto" style={{ padding: '10px 16px' }}>
          <div className="flex items-center gap-2">
            <div
              className="dekk-chips flex gap-2 overflow-x-auto flex-nowrap flex-1"
              style={{ scrollbarWidth: 'none', minWidth: 0, WebkitOverflowScrolling: 'touch' }}
            >
              <style>{`.dekk-chips::-webkit-scrollbar{display:none} @keyframes dekkFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} @keyframes dekkSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
              {CATEGORIES.map(cat => {
                const active = cat.key === activeCat;
                const count = counts[cat.key] || 0;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setActiveCat(cat.key)}
                    style={{
                      flex: '0 0 auto', height: 36, padding: '0 14px',
                      borderRadius: 20, fontSize: 13, lineHeight: 1,
                      fontWeight: active ? 600 : 500,
                      background: active ? DEKK.accent : '#fff',
                      color: active ? '#fff' : '#444',
                      border: active ? `0.5px solid ${DEKK.accent}` : '0.5px solid #E5E5E5',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      transition: 'all 180ms',
                      boxShadow: active ? '0 4px 12px rgba(201,123,58,0.25)' : 'none',
                    }}
                  >
                    <span>{cat.emoji}</span>{cat.label}
                    {count > 0 && (
                      <span style={{ fontSize: 10, opacity: 0.7, fontFamily: '"DM Mono", monospace' }}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowSort(s => !s)}
              style={{
                flex: '0 0 auto', height: 36, padding: '0 12px', borderRadius: 20,
                background: '#fff', border: '0.5px solid #E5E5E5', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#444',
                position: 'relative',
              }}
            >
              <SlidersHorizontal size={14} />
              <span className="hidden sm:inline">{SORTS.find(s => s.id === sort)?.label}</span>
            </button>
          </div>
          {showSort && (
            <div style={{ position: 'absolute', right: 16, top: 52, background: '#fff', border: '0.5px solid #E5E5E5', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.08)', padding: 6, zIndex: 40, minWidth: 160, animation: 'dekkFadeIn 180ms ease-out' }}>
              {SORTS.map(s => (
                <button key={s.id} onClick={() => { setSort(s.id); setShowSort(false); }}
                  style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', fontSize: 13, background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', color: DEKK.ink }}>
                  {s.label}{sort === s.id && <Check size={14} color={DEKK.accent} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <main className="max-w-6xl mx-auto" style={{ padding: '20px 16px 100px' }}>
        {/* Results count */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontFamily: '"DM Mono", monospace', color: '#888', margin: 0 }}>
              {filtered.length} produit{filtered.length > 1 ? 's' : ''}
              {activeCat !== 'all' && ` · ${CATEGORY_LABEL[activeCat]}`}
            </p>
          </div>
        )}

        {loading ? (
          <SkeletonGrid />
        ) : filtered.length === 0 ? (
          <EmptyState onReset={() => { setActiveCat('all'); setSearch(''); }} />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4" style={{ gap: 12 }}>
              {filtered.slice(0, 6).map((p, i) => (
                <ProductCard key={p.id} p={p} idx={i}
                  wished={wishlist.has(p.id)} onWish={() => toggleWish(p.id)}
                  onQuickView={() => setQuickView(p)} onAdd={() => addToCart(p)} />
              ))}
            </div>

            {filtered.length > 6 && <FeaturedStrip />}

            {filtered.length > 6 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4" style={{ gap: 12 }}>
                {filtered.slice(6).map((p, i) => (
                  <ProductCard key={p.id} p={p} idx={i + 6}
                    wished={wishlist.has(p.id)} onWish={() => toggleWish(p.id)}
                    onQuickView={() => setQuickView(p)} onAdd={() => addToCart(p)} />
                ))}
              </div>
            )}
          </>
        )}

        <footer className="mt-16 pt-8" style={{ borderTop: '0.5px solid #EEE', textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', color: '#999', margin: 0 }}>
            DËKK · BY YOBBANTÉ
          </p>
          <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
            La boutique alimentée par la communauté.
          </p>
        </footer>
      </main>

      {/* FLOATING CART BUTTON */}
      {cartCount > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          style={{
            position: 'fixed', bottom: 20, right: 20, zIndex: 50,
            width: 56, height: 56, borderRadius: 28,
            background: DEKK.accent, color: '#fff', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(201,123,58,0.4)', cursor: 'pointer',
            animation: 'dekkFadeIn 250ms ease-out',
          }}
          aria-label="Voir le panier"
        >
          <ShoppingBag size={22} />
          <span style={{
            position: 'absolute', top: -2, right: -2,
            background: '#1A1A1A', color: '#fff', fontSize: 10, fontWeight: 700,
            minWidth: 20, height: 20, borderRadius: 10, padding: '0 6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #fff',
          }}>{cartCount}</span>
        </button>
      )}

      {/* CART DRAWER */}
      {cartOpen && (
        <CartDrawer cart={cart} total={cartTotal} onClose={() => setCartOpen(false)} onQty={updateQty} />
      )}

      {/* QUICK VIEW */}
      {quickView && (
        <QuickViewSheet p={quickView} wished={wishlist.has(quickView.id)}
          onWish={() => toggleWish(quickView.id)}
          onAdd={() => { addToCart(quickView); setQuickView(null); }}
          onClose={() => setQuickView(null)} />
      )}
    </div>
  );
}

function FeaturedStrip() {
  return (
    <div
      className="flex items-center justify-between flex-wrap gap-3"
      style={{
        background: `linear-gradient(135deg, ${DEKK.accentLight} 0%, ${DEKK.accentSoft} 100%)`,
        borderRadius: 16, padding: '20px 22px', margin: '20px 0',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 100, opacity: 0.15 }}>🔥</div>
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: DEKK.accentDark, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <TrendingUp size={12} /> SÉLECTION DU MOMENT
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: DEKK.ink, marginTop: 4 }}>
          Ce que Dakar commande maintenant.
        </div>
      </div>
      <button style={{ background: DEKK.ink, color: '#fff', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 20, padding: '10px 18px', cursor: 'pointer', position: 'relative' }}>
        Découvrir →
      </button>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4" style={{ gap: 12 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ borderRadius: 14, overflow: 'hidden', background: '#FAFAFA', border: '0.5px solid #EEE' }}>
          <div style={{ height: 200, background: 'linear-gradient(90deg, #F0F0F0 0%, #F8F8F8 50%, #F0F0F0 100%)', backgroundSize: '200% 100%', animation: 'dekkShimmer 1.4s infinite' }} />
          <div style={{ padding: 12 }}>
            <div style={{ height: 10, width: '40%', background: '#EEE', borderRadius: 4, marginBottom: 8 }} />
            <div style={{ height: 14, width: '90%', background: '#EEE', borderRadius: 4, marginBottom: 12 }} />
            <div style={{ height: 18, width: '50%', background: '#EEE', borderRadius: 4 }} />
          </div>
        </div>
      ))}
      <style>{`@keyframes dekkShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="text-center" style={{ padding: '64px 24px' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🛍️</div>
      <p style={{ fontSize: 17, fontWeight: 600, color: DEKK.ink, margin: 0 }}>Aucun produit trouvé.</p>
      <p style={{ fontSize: 13, color: '#888', marginTop: 8 }}>
        Essayez d'autres filtres ou explorez toutes les catégories.
      </p>
      <button onClick={onReset} style={{ marginTop: 20, background: DEKK.accent, color: '#fff', border: 'none', borderRadius: 24, padding: '12px 24px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
        Réinitialiser
      </button>
    </div>
  );
}

function ProductCard({ p, idx, wished, onWish, onQuickView, onAdd }: {
  p: Product; idx: number; wished: boolean;
  onWish: () => void; onQuickView: () => void; onAdd: () => void;
}) {
  const [hovering, setHovering] = useState(false);
  const stockBadge =
    p.stock_mode === 'stock'
      ? { label: 'En stock', bg: '#E1F5EE', color: '#085041' }
      : { label: `Sous ${p.delivery_days ?? 7}j`, bg: DEKK.accentLight, color: DEKK.accentDark };
  const origin = ORIGIN_LABEL[p.origin_country] ?? ORIGIN_LABEL.OTHER;
  const newBadge = isNew(p.created_at);

  return (
    <article
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        border: '0.5px solid #EEE', borderRadius: 14, overflow: 'hidden',
        background: '#fff', display: 'flex', flexDirection: 'column',
        transition: 'all 220ms cubic-bezier(.2,.8,.2,1)',
        transform: hovering ? 'translateY(-4px)' : 'none',
        boxShadow: hovering ? '0 16px 32px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
        animation: `dekkFadeIn 320ms ease-out ${Math.min(idx * 40, 320)}ms both`,
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '1/1', background: '#F8F8F8', overflow: 'hidden' }}>
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 500ms', transform: hovering ? 'scale(1.06)' : 'scale(1)' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: 36, opacity: 0.3 }}>📦</div>
        )}

        {/* Top badges */}
        <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {newBadge && (
            <span style={{ background: DEKK.ink, color: '#fff', borderRadius: 6, padding: '3px 8px', fontFamily: '"DM Mono", monospace', fontSize: 9, fontWeight: 600, letterSpacing: '0.05em' }}>
              NOUVEAU
            </span>
          )}
          <span style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(4px)', borderRadius: 6, padding: '3px 8px', fontFamily: '"DM Mono", monospace', fontSize: 9, color: DEKK.ink, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span>{origin.flag}</span><span>{origin.name}</span>
          </span>
        </div>

        {/* Wishlist */}
        <button onClick={onWish} aria-label="Favori"
          style={{
            position: 'absolute', top: 8, right: 8, width: 32, height: 32,
            borderRadius: 16, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(4px)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 150ms',
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.9)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <Heart size={15} fill={wished ? DEKK.accent : 'none'} color={wished ? DEKK.accent : '#666'} />
        </button>

        {/* Stock badge bottom */}
        <span style={{
          position: 'absolute', bottom: 8, left: 8,
          background: stockBadge.bg, color: stockBadge.color,
          borderRadius: 20, padding: '3px 10px',
          fontFamily: '"DM Mono", monospace', fontSize: 9, fontWeight: 600,
        }}>
          {stockBadge.label}
        </span>

        {/* Quick view (desktop hover) */}
        <button onClick={onQuickView}
          className="hidden md:flex"
          style={{
            position: 'absolute', bottom: 8, right: 8,
            background: 'rgba(26,26,26,0.9)', color: '#fff',
            borderRadius: 20, padding: '6px 12px', fontSize: 11, fontWeight: 500,
            border: 'none', cursor: 'pointer', alignItems: 'center', gap: 4,
            opacity: hovering ? 1 : 0, transform: hovering ? 'translateY(0)' : 'translateY(8px)',
            transition: 'all 220ms',
          }}>
          Aperçu rapide
        </button>
      </div>

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ fontSize: 10, fontFamily: '"DM Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: 4 }}>
          {CATEGORY_LABEL[p.category] ?? p.category}
        </div>
        <div style={{
          fontSize: 13, fontWeight: 500, color: DEKK.ink, lineHeight: 1.35,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', minHeight: 36,
        }}>
          {p.name}
        </div>
        {p.verified && (
          <div style={{ fontSize: 10, color: DEKK.accent, fontFamily: '"DM Mono", monospace', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Star size={10} fill={DEKK.accent} /> Testé communauté
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: DEKK.ink }}>
              {fmtEur(p.price_eur)}
            </span>
            <span style={{ fontSize: 10, color: '#888', fontFamily: '"DM Mono", monospace' }}>
              {fmtFcfa(p.price_fcfa)}
            </span>
          </div>
          <button
            onClick={onAdd}
            onMouseEnter={e => (e.currentTarget.style.background = DEKK.accentDark)}
            onMouseLeave={e => (e.currentTarget.style.background = DEKK.accent)}
            style={{
              marginTop: 10, width: '100%', minHeight: 40,
              background: DEKK.accent, color: '#fff',
              fontSize: 12, fontWeight: 600, borderRadius: 10, border: 'none',
              cursor: 'pointer', transition: 'background 150ms',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Plus size={14} /> Ajouter
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
        className="md:left-auto md:right-4 md:bottom-4 md:top-4 md:rounded-2xl md:max-w-md md:w-full"
      >
        <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #EEE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Mon panier</div>
            <div style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', color: '#888' }}>{cart.length} article{cart.length > 1 ? 's' : ''}</div>
          </div>
          <button onClick={onClose} style={{ background: '#F4F4F4', border: 'none', width: 36, height: 36, borderRadius: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <ShoppingBag size={40} color="#CCC" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: '#888', fontSize: 13 }}>Votre panier est vide</p>
            </div>
          ) : cart.map(item => (
            <div key={item.product.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '0.5px solid #F0F0F0' }}>
              <div style={{ width: 64, height: 64, borderRadius: 8, background: '#F8F8F8', overflow: 'hidden', flexShrink: 0 }}>
                {item.product.image_url && <img src={item.product.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {item.product.name}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: DEKK.accent, marginTop: 4 }}>
                  {fmtEur(item.product.price_eur * item.qty)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, alignSelf: 'center' }}>
                <button onClick={() => onQty(item.product.id, -1)} style={{ width: 28, height: 28, borderRadius: 14, border: '0.5px solid #DDD', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Minus size={12} />
                </button>
                <span style={{ minWidth: 20, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>{item.qty}</span>
                <button onClick={() => onQty(item.product.id, 1)} style={{ width: 28, height: 28, borderRadius: 14, border: 'none', background: DEKK.accent, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <div style={{ padding: 16, borderTop: '0.5px solid #EEE', background: '#FAFAFA' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#666' }}>Sous-total</span>
              <span style={{ fontSize: 18, fontWeight: 700 }}>{fmtEur(total)}</span>
            </div>
            <div style={{ fontSize: 11, color: '#888', fontFamily: '"DM Mono", monospace', marginBottom: 12 }}>
              ≈ {fmtFcfa(total * 655)} · Livraison incluse
            </div>
            <button
              onClick={() => { window.location.href = '/devis'; }}
              style={{ width: '100%', minHeight: 48, background: DEKK.ink, color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Passer commande →
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function QuickViewSheet({ p, wished, onWish, onAdd, onClose }: {
  p: Product; wished: boolean; onWish: () => void; onAdd: () => void; onClose: () => void;
}) {
  const origin = ORIGIN_LABEL[p.origin_country] ?? ORIGIN_LABEL.OTHER;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 70, animation: 'dekkFadeIn 200ms' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 71,
        background: '#fff', borderRadius: '20px 20px 0 0',
        maxHeight: '90vh', overflowY: 'auto',
        animation: 'dekkSlideUp 280ms cubic-bezier(.2,.8,.2,1)',
      }}
        className="md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:max-w-lg md:w-full"
      >
        <div style={{ position: 'relative' }}>
          <div style={{ aspectRatio: '4/3', background: '#F8F8F8', overflow: 'hidden' }}>
            {p.image_url && <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, background: 'rgba(255,255,255,0.95)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
          <button onClick={onWish} style={{ position: 'absolute', top: 12, left: 12, width: 36, height: 36, borderRadius: 18, background: 'rgba(255,255,255,0.95)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Heart size={16} fill={wished ? DEKK.accent : 'none'} color={wished ? DEKK.accent : '#666'} />
          </button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 10, fontFamily: '"DM Mono", monospace', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            {CATEGORY_LABEL[p.category] ?? p.category} · {origin.flag} {origin.name}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{p.name}</h2>
          {p.description && (
            <p style={{ fontSize: 13, color: '#555', lineHeight: 1.5, marginTop: 10 }}>{p.description}</p>
          )}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 16 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: DEKK.ink, letterSpacing: '-0.02em' }}>{fmtEur(p.price_eur)}</span>
            <span style={{ fontSize: 12, color: '#888', fontFamily: '"DM Mono", monospace' }}>{fmtFcfa(p.price_fcfa)}</span>
          </div>
          <div style={{ marginTop: 16, padding: 12, background: DEKK.accentSoft, borderRadius: 10, fontSize: 12, color: DEKK.accentDark, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={14} /> {p.stock_mode === 'stock' ? 'En stock — livraison rapide' : `Disponible sous ${p.delivery_days ?? 7} jours`}
          </div>
          <button onClick={onAdd}
            style={{ marginTop: 16, width: '100%', minHeight: 52, background: DEKK.accent, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <ShoppingBag size={16} /> Ajouter au panier
          </button>
        </div>
      </div>
    </>
  );
}
