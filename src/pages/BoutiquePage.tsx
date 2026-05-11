import { useEffect, useMemo, useState } from 'react';
import { PublicNav } from '@/components/PublicNav';
import { supabase } from '@/integrations/supabase/client';

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

const DEKK_ACCENT = '#C97B3A';
const DEKK_ACCENT_LIGHT = '#F5E6D8';
const DEKK_ACCENT_DARK = '#8B5220';

const CATEGORIES = ['Tout', 'Électronique', 'Mode', 'Maison', 'Auto', 'Tech', 'Beauté', 'Autre'];

const SORTS = [
  { id: 'trending', label: 'Tendance' },
  { id: 'price_asc', label: 'Prix croissant' },
  { id: 'price_desc', label: 'Prix décroissant' },
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

export default function BoutiquePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState('Tout');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('trending');

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

  const filtered = useMemo(() => {
    let list = activeCat === 'Tout' ? products : products.filter(p => p.category === activeCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q));
    }
    if (sort === 'price_asc') list = [...list].sort((a, b) => a.price_eur - b.price_eur);
    else if (sort === 'price_desc') list = [...list].sort((a, b) => b.price_eur - a.price_eur);
    else if (sort === 'new') list = [...list].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return list;
  }, [products, activeCat, search, sort]);

  const featuredCutIdx = Math.min(6, filtered.length);
  const beforeFeatured = filtered.slice(0, featuredCutIdx);
  const afterFeatured = filtered.slice(featuredCutIdx);

  return (
    <div className="min-h-screen" style={{ background: 'hsl(var(--background-primary))', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <PublicNav />

      <main className="max-w-6xl mx-auto" style={{ background: 'hsl(var(--background-primary))' }}>
        {/* Dëkk brand header */}
        <header style={{ padding: '28px 24px 0' }}>
          <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', color: DEKK_ACCENT, margin: 0, lineHeight: 1 }}>
            DËKK
          </h1>
          <p style={{ fontSize: 13, fontWeight: 400, color: 'hsl(var(--muted-foreground))', marginTop: 6, margin: 0, marginBlockStart: 6 }}>
            Le monde, livré ici.
          </p>
          <p style={{ fontSize: 10, fontFamily: '"DM Mono", monospace', letterSpacing: '0.06em', color: 'hsl(var(--muted-foreground))', marginTop: 4, margin: 0, marginBlockStart: 4 }}>
            by Yobbanté
          </p>

          {/* Search bar */}
          <div style={{ marginTop: 20 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un produit..."
              style={{
                width: '100%', height: 40, padding: '0 14px', fontSize: 13,
                border: '0.5px solid hsl(var(--color-border-tertiary))', borderRadius: 8,
                background: 'hsl(var(--background-secondary))', color: 'hsl(var(--foreground))',
                outline: 'none',
              }}
            />
          </div>

          {/* Trust strip */}
          <div
            style={{
              marginTop: 10,
              fontSize: 10, fontFamily: '"DM Mono", monospace',
              color: 'hsl(var(--muted-foreground))',
              whiteSpace: 'nowrap', overflowX: 'auto',
            }}
          >
            ✓ Produits testés et importés · ✓ Livraison au Sénégal incluse · ✓ Paiement sécurisé
          </div>
        </header>

        <div className="px-5 sm:px-6 pt-4 pb-10">

        {/* Categories + sort */}
        <div className="mb-5 flex items-center gap-3">
          <div
            className="dekk-chips flex gap-2 overflow-x-auto flex-nowrap w-full md:flex-1"
            style={{ scrollbarWidth: 'none', minWidth: 0, WebkitOverflowScrolling: 'touch' }}
          >
            <style>{`.dekk-chips::-webkit-scrollbar{display:none}`}</style>
            {CATEGORIES.map(cat => {
              const active = cat === activeCat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCat(cat)}
                  style={{
                    flex: '0 0 auto',
                    height: 32,
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 13,
                    lineHeight: 1,
                    fontWeight: active ? 500 : 400,
                    background: active ? DEKK_ACCENT : 'transparent',
                    color: active ? '#ffffff' : 'hsl(var(--muted-foreground))',
                    border: active ? '0.5px solid ' + DEKK_ACCENT : '0.5px solid hsl(var(--color-border-tertiary))',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="hidden md:block"
            style={{
              flex: '0 0 auto', height: 32, padding: '0 10px', fontSize: 12, borderRadius: 8,
              border: '0.5px solid hsl(var(--color-border-tertiary))',
              background: 'hsl(var(--background-primary))', color: 'hsl(var(--muted-foreground))',
            }}
          >
            {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        {/* Grid / empty */}
        {loading ? null : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3" style={{ marginTop: 20 }}>
              {beforeFeatured.map(p => <ProductCard key={p.id} p={p} />)}
            </div>
            {afterFeatured.length > 0 && <FeaturedStrip />}
            {afterFeatured.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {afterFeatured.map(p => <ProductCard key={p.id} p={p} />)}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-8" style={{ borderTop: '0.5px solid hsl(var(--color-border-tertiary))', textAlign: 'center' }}>
          <p style={{ fontSize: 10, fontFamily: '"DM Mono", monospace', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
            DËKK · by Yobbanté
          </p>
          <p style={{ fontSize: 10, fontFamily: '"DM Mono", monospace', color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>
            La boutique alimentée par la communauté.
          </p>
        </footer>
        </div>
      </main>
    </div>
  );
}

function FeaturedStrip() {
  return (
    <div
      className="flex items-center justify-between flex-wrap gap-3"
      style={{ background: DEKK_ACCENT_LIGHT, borderRadius: 12, padding: 20, margin: '4px 0' }}
    >
      <div>
        <div style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: DEKK_ACCENT_DARK }}>
          SÉLECTION DU MOMENT
        </div>
        <div style={{ fontSize: 15, fontWeight: 500, color: '#1a1a1a', marginTop: 4 }}>
          Ce que Dakar commande en ce moment.
        </div>
      </div>
      <a href="#" style={{ fontSize: 13, color: DEKK_ACCENT, fontWeight: 500, textDecoration: 'none' }}>
        Voir tout →
      </a>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-20 text-center">
      <div style={{ fontSize: 32, marginBottom: 12 }}>🛍️</div>
      <p style={{ fontSize: 16, fontWeight: 500, color: 'hsl(var(--foreground))', margin: 0 }}>Dëkk arrive bientôt.</p>
      <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginTop: 6 }}>
        Les premiers produits sont en cours de sélection.
      </p>
    </div>
  );
}

function ProductCard({ p }: { p: Product }) {
  const stockBadge =
    p.stock_mode === 'stock'
      ? { label: 'En stock', bg: '#E1F5EE', color: '#085041' }
      : { label: `Sous ${p.delivery_days ?? 7} j`, bg: DEKK_ACCENT_LIGHT, color: DEKK_ACCENT_DARK };

  const origin = ORIGIN_LABEL[p.origin_country] ?? ORIGIN_LABEL.OTHER;

  return (
    <article
      style={{
        border: '0.5px solid hsl(var(--color-border-tertiary))',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'hsl(var(--background-primary))',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ position: 'relative', height: 200, background: 'hsl(var(--secondary))' }}>
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : null}
        <span
          style={{
            position: 'absolute', top: 8, left: 8,
            background: '#fff', borderRadius: 6, padding: '3px 8px',
            fontFamily: '"DM Mono", monospace', fontSize: 9,
            color: 'hsl(var(--foreground))',
            border: '0.5px solid hsl(var(--color-border-tertiary))',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          <span>{origin.flag}</span><span>{origin.name}</span>
        </span>
        <span
          style={{
            position: 'absolute', top: 8, right: 8,
            background: stockBadge.bg, color: stockBadge.color,
            borderRadius: 20, padding: '3px 10px',
            fontFamily: '"DM Mono", monospace', fontSize: 9,
          }}
        >
          {stockBadge.label}
        </span>
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div
          style={{
            fontSize: 11, fontFamily: '"DM Mono", monospace',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'hsl(var(--muted-foreground))', marginBottom: 4,
          }}
        >
          {p.category}
        </div>
        <div
          style={{
            fontSize: 14, fontWeight: 500, color: 'hsl(var(--foreground))',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden', lineHeight: 1.3,
          }}
        >
          {p.name}
        </div>
        {p.verified && (
          <div style={{ fontSize: 10, color: DEKK_ACCENT, fontFamily: '"DM Mono", monospace', marginTop: 2 }}>
            ✓ Testé par la communauté
          </div>
        )}
        <div style={{ height: '0.5px', background: 'hsl(var(--color-border-tertiary))', margin: '10px 0' }} />
        <div style={{ marginTop: 'auto' }}>
          <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.02em', color: 'hsl(var(--foreground))' }}>
            {fmtEur(p.price_eur)}
          </div>
          <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', fontFamily: '"DM Mono", monospace' }}>
            {fmtFcfa(p.price_fcfa)}
          </div>
        </div>
        <button
          onClick={() => { window.location.href = `/devis?product=${encodeURIComponent(p.id)}`; }}
          onMouseEnter={e => (e.currentTarget.style.background = DEKK_ACCENT_DARK)}
          onMouseLeave={e => (e.currentTarget.style.background = DEKK_ACCENT)}
          style={{
            marginTop: 10, width: '100%', height: 44, minHeight: 44,
            background: DEKK_ACCENT, color: '#fff',
            fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none',
            cursor: 'pointer', transition: 'background 150ms',
          }}
        >
          Commander
        </button>
      </div>
    </article>
  );
}
