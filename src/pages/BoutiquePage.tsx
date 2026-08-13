import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { supabase } from '@/integrations/supabase/client';
import { Truck, Smartphone, ShieldCheck, Star } from 'lucide-react';
import { useSeo } from '@/hooks/useSeo';
import { DekkHeader } from '@/components/dekk/DekkHeader';
import { type CatKey } from '@/components/dekk/CatNav';
import { CAT_LABEL, uiCategory, matchesCategory } from '@/lib/dekkCategories';
import { DekkProductCard } from '@/components/dekk/DekkProductCard';
import { useDekkCart } from '@/hooks/useDekkCart';
import { useDekkWishlist } from '@/hooks/useDekkWishlist';
import { ecommerce } from '@/lib/analytics';
import { DEKK, SERIF, SANS, MONO, openDekkCart } from '@/components/dekk/dekkTheme';
import { DekkImage } from '@/components/dekk/DekkImage';
import { DekkCategoryRail } from '@/components/dekk/DekkCategoryRail';
import { dekkImageUrl } from '@/lib/dekkImage';

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

const SORTS = [
  { id: 'trending', label: 'Sélection' },
  { id: 'new', label: 'Nouveautés' },
  { id: 'price_asc', label: 'Prix croissant' },
  { id: 'price_desc', label: 'Prix décroissant' },
];

export default function BoutiquePage() {
  useSeo({
    title: 'Dëkk — Boutique premium livrée à Dakar | Yobbanté',
    description:
      'Dëkk by Yobbanté : une sélection soignée de produits importés, livrés à Dakar en 24–48 h. Paiement Wave & Orange Money.',
    path: '/boutique',
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  const activeCat = (searchParams.get('cat') as CatKey) || 'all';
  const sort = searchParams.get('sort') || 'trending';
  const wishlistOnly = searchParams.get('wishlist') === '1';
  const showAll = searchParams.get('all') === '1';

  const wishlist = useDekkWishlist();
  const cart = useDekkCart();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('products' as any)
        .select('*')
        .eq('status', 'published')
        .eq('en_vente', true)
        .order('created_at', { ascending: false });
      setProducts(((data as any) as Product[]) || []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => ecommerce.search(q), 600);
    return () => clearTimeout(t);
  }, [search]);

  const setParam = (key: string, value: string | null) => {
    const sp = new URLSearchParams(searchParams);
    if (!value || value === 'all') sp.delete(key);
    else sp.set(key, value);
    setSearchParams(sp, { replace: true });
  };

  const addToCart = (p: Product) => {
    cart.addItem(p as any, 1);
    openDekkCart();
  };

  const filtered = useMemo(() => {
    let list = activeCat === 'all' ? products : products.filter((p) => matchesCategory(p.category, activeCat));
    if (wishlistOnly) list = list.filter((p) => wishlist.has(p.id));
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q));
    if (sort === 'price_asc') list = [...list].sort((a, b) => a.price_fcfa - b.price_fcfa);
    else if (sort === 'price_desc') list = [...list].sort((a, b) => b.price_fcfa - a.price_fcfa);
    else if (sort === 'new') list = [...list].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return list;
  }, [products, activeCat, search, sort, wishlistOnly, wishlist]);

  /** Catégories affichées : uniquement celles qui contiennent des produits, avec une vraie image. */
  const categories = useMemo(() => {
    const map = new Map<CatKey, { key: CatKey; label: string; image: string | null; count: number }>();
    for (const p of products) {
      const key = uiCategory(p.category);
      const prev = map.get(key);
      if (prev) {
        prev.count += 1;
        if (!prev.image && p.image_url) prev.image = p.image_url;
      } else {
        map.set(key, { key, label: CAT_LABEL[key] ?? p.category, image: p.image_url, count: 1 });
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }, [products]);

  const hero = useMemo(() => products.find((p) => p.image_url) ?? null, [products]);
  const featured = useMemo(
    () => products.filter((p) => p.image_url).slice(0, 4),
    [products],
  );

  const gridActive = Boolean(search.trim()) || activeCat !== 'all' || wishlistOnly || sort !== 'trending' || showAll;

  return (
    <div style={{ minHeight: '100vh', background: DEKK.cream, fontFamily: SANS, color: DEKK.ink }}>
      <style>{`
        @keyframes dekkShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .dekk-cat-tile img{transition:transform 800ms cubic-bezier(.2,.7,.2,1)}
        .dekk-cat-tile:hover img{transform:scale(1.05)}
        .dekk-grid{display:grid;gap:26px;grid-template-columns:repeat(4,1fr)}
        @media (max-width:1024px){.dekk-grid{grid-template-columns:repeat(3,1fr)}}
        @media (max-width:760px){.dekk-grid{grid-template-columns:repeat(2,1fr);gap:16px}}
      `}</style>

      <DekkHeader
        searchValue={search}
        onSearchChange={setSearch}
        onWishlist={() => setParam('wishlist', wishlistOnly ? null : '1')}
      />

      {/* ── HERO ─────────────────────────────────────── */}
      <section style={{ position: 'relative', height: 'min(78vh, 640px)', background: DEKK.ink, overflow: 'hidden' }}>
        {hero?.image_url && (
          <img src={dekkImageUrl(hero.image_url, { w: 1600, h: 1100 })} alt={hero.name}
            fetchPriority="high" decoding="async"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: 0.72 }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(20,18,16,0.72) 0%, rgba(20,18,16,0.25) 70%)' }} />
        <div style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: '0 20px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 72 }}>
          <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.24em', textTransform: 'uppercase', color: DEKK.goldSoft }}>
            Dëkk — Édition 2026
          </span>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(38px, 6.5vw, 68px)', lineHeight: 1.05, color: '#FBF9F5', margin: '14px 0 0', maxWidth: 620, fontWeight: 500 }}>
            Le monde choisi,<br />livré à Dakar.
          </h1>
          <p style={{ fontSize: 14.5, color: 'rgba(251,249,245,0.82)', maxWidth: 420, marginTop: 16, lineHeight: 1.65 }}>
            Une sélection resserrée de produits testés et importés par Yobbanté. Livraison 24–48 h, paiement Wave & Orange Money.
          </p>
          <a href="#dekk-selection"
            style={{ marginTop: 28, alignSelf: 'flex-start', background: DEKK.gold, color: '#fff', textDecoration: 'none', padding: '15px 34px', fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Découvrir la boutique
          </a>
        </div>
      </section>

      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '0 20px 80px' }}>
        {/* ── CATÉGORIES ─────────────────────────────── */}
        {!loading && categories.length > 0 && (
          <section style={{ paddingTop: 72 }}>
            <SectionTitle
              title="Nos catégories"
              right={
                activeCat !== 'all' ? (
                  <button onClick={() => setParam('cat', null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: DEKK.gold }}>
                    Tout voir
                  </button>
                ) : undefined
              }
            />
            <DekkCategoryRail
              items={categories}
              activeKey={activeCat}
              onSelect={(k) => setParam('cat', activeCat === k ? null : k)}
            />
          </section>
        )}

        {/* ── SÉLECTION / GRILLE ─────────────────────── */}
        <section id="dekk-selection" style={{ paddingTop: 72 }}>
          <SectionTitle
            title={gridActive ? (activeCat !== 'all' ? CAT_LABEL[activeCat] ?? 'Sélection' : showAll && !search.trim() ? 'Tout le catalogue' : 'Résultats') : 'Sélection du moment'}
            right={
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                {activeCat !== 'all' && (
                  <button onClick={() => setParam('cat', null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: DEKK.gold }}>
                    Tout voir
                  </button>
                )}
                <select value={sort} onChange={(e) => setParam('sort', e.target.value)} aria-label="Trier"
                  style={{ border: `1px solid ${DEKK.line}`, background: 'transparent', padding: '8px 10px', fontSize: 12, fontFamily: SANS, color: DEKK.ink, borderRadius: 0 }}>
                  {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            }
          />

          {loading ? (
            <SkeletonGrid />
          ) : filtered.length === 0 ? (
            <EmptyResults
              query={search.trim()}
              categories={categories.map((c) => ({ key: c.key, label: c.label }))}
              onPick={(k) => { setSearch(''); setParam('cat', k); }}
            />
          ) : (
            <div className="dekk-grid">
              {(gridActive ? filtered : featured.length ? featured : filtered).map((p) => (
                <DekkProductCard
                  key={p.id}
                  p={p as any}
                  wished={wishlist.has(p.id)}
                  onWish={() => wishlist.toggle(p.id)}
                  onAdd={() => addToCart(p)}
                />
              ))}
            </div>
          )}

          {!gridActive && !loading && filtered.length > featured.length && (
            <div style={{ textAlign: 'center', marginTop: 44 }}>
              <button onClick={() => { setParam('all', '1'); document.getElementById('dekk-selection')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                style={{ border: `1px solid ${DEKK.ink}`, background: 'transparent', color: DEKK.ink, padding: '14px 38px', fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Voir tout le catalogue
              </button>
            </div>
          )}
        </section>

        {/* ── BANDEAU CONFIANCE ──────────────────────── */}
        <section style={{ marginTop: 84, borderTop: `1px solid ${DEKK.line}`, borderBottom: `1px solid ${DEKK.line}`, padding: '38px 0' }}>
          <div style={{ display: 'grid', gap: 28, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {[
              { icon: Truck, t: 'Livraison à Dakar', s: 'Sous 48 h, partout dans la ville.' },
              { icon: Smartphone, t: 'Wave & Orange Money', s: 'Payez simplement, ou à la livraison.' },
              { icon: ShieldCheck, t: 'Qualité vérifiée', s: 'Chaque produit testé avant expédition.' },
            ].map(({ icon: Icon, t, s }) => (
              <div key={t} style={{ display: 'flex', gap: 12 }}>
                <Icon size={19} color={DEKK.gold} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{t}</div>
                  <div style={{ fontSize: 12.5, color: DEKK.muted, marginTop: 3 }}>{s}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── RÉASSURANCE ────────────────────────────── */}
        <section style={{ marginTop: 56, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', gap: 3, color: DEKK.gold }}>
            {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={15} fill={i <= 4 ? DEKK.gold : 'none'} color={DEKK.gold} strokeWidth={1.4} />)}
          </div>
          <p style={{ fontFamily: SERIF, fontSize: 24, margin: '12px 0 4px' }}>4,7 / 5 · plus de 1 200 clients livrés</p>
          <p style={{ fontSize: 12.5, color: DEKK.muted, margin: 0 }}>
            Paiement sécurisé · Retour sous 7 jours · Support WhatsApp sous 2 h
          </p>
        </section>
      </main>
    </div>
  );
}

function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 26, flexWrap: 'wrap' }}>
      <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(26px, 3.4vw, 34px)', fontWeight: 500, margin: 0, letterSpacing: '0.01em' }}>
        {title}
      </h2>
      {right}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="dekk-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i}>
          <div style={{
            aspectRatio: '4/5',
            background: 'linear-gradient(90deg, #E9E3D9 0%, #F4F0E9 50%, #E9E3D9 100%)',
            backgroundSize: '200% 100%',
            animation: 'dekkShimmer 1.4s infinite',
          }} />
          <div style={{ height: 10, width: '35%', background: DEKK.creamDeep, marginTop: 12 }} />
          <div style={{ height: 16, width: '80%', background: DEKK.creamDeep, marginTop: 10 }} />
          <div style={{ height: 12, width: '45%', background: DEKK.creamDeep, marginTop: 10 }} />
        </div>
      ))}
    </div>
  );
}

function EmptyResults({
  query,
  categories,
  onPick,
}: {
  query: string;
  categories: { key: string; label: string }[];
  onPick: (k: string) => void;
}) {
  return (
    <div style={{ textAlign: 'center', padding: '72px 20px', border: `1px solid ${DEKK.line}` }}>
      <p style={{ fontFamily: SERIF, fontSize: 26, margin: 0 }}>
        {query ? `Aucun résultat pour « ${query} »` : 'Aucun produit dans cette sélection'}
      </p>
      <p style={{ fontSize: 13, color: DEKK.muted, marginTop: 8 }}>
        Essayez une autre recherche, ou explorez nos catégories populaires.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 20 }}>
        {categories.map((c) => (
          <button key={c.key} onClick={() => onPick(c.key)}
            style={{ border: `1px solid ${DEKK.line}`, background: 'transparent', padding: '10px 18px', fontSize: 12, cursor: 'pointer', color: DEKK.ink }}>
            {c.label}
          </button>
        ))}
        <Link to="/boutique" style={{ border: `1px solid ${DEKK.ink}`, padding: '10px 18px', fontSize: 12, color: DEKK.ink, textDecoration: 'none' }}>
          Tout le catalogue
        </Link>
      </div>
    </div>
  );
}
