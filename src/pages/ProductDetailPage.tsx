import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PublicNav } from '@/components/PublicNav';
import { supabase } from '@/integrations/supabase/client';
import { applySeo } from '@/lib/dekkSeo';
import { recommend, RecProduct, trackView } from '@/lib/dekkRecommend';
import { ArrowLeft, Heart, Share2, ShieldCheck, Truck, Check, Plus, Minus, ShoppingBag, Star, ChevronRight } from 'lucide-react';

type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  price_eur: number;
  price_fcfa: number;
  origin_country: string;
  stock_mode: string;
  delivery_days: number | null;
  status: string;
  image_url: string;
  verified?: boolean;
  created_at: string;
};

const DEKK = { accent: '#C97B3A', accentDark: '#8B5220', accentSoft: '#FBF3EA', ink: '#0E0E0E', line: '#ECECEC', muted: '#6B6B6B' };

const ORIGIN: Record<string, string> = { CN: 'Chine', US: 'USA', FR: 'France', OTHER: 'International' };
const CATEGORY: Record<string, string> = {
  electronique: 'Électronique', mode: 'Mode', maison: 'Maison',
  auto: 'Auto', tech: 'Tech', beaute: 'Beauté', autre: 'Autre',
};

const fmtEur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const fmtFcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

// Heuristic variants — purely presentational
function variantsFor(p: Product) {
  if (p.category === 'mode')
    return { sizes: ['S', 'M', 'L', 'XL'], colors: [{ k: 'noir', hex: '#0E0E0E' }, { k: 'blanc', hex: '#F2F2F2' }, { k: 'sable', hex: '#D8C4A8' }] };
  if (p.category === 'electronique' || p.category === 'tech')
    return { sizes: null, colors: [{ k: 'graphite', hex: '#2B2B2B' }, { k: 'argent', hex: '#C8C8CC' }] };
  if (p.category === 'beaute')
    return { sizes: ['30 ml', '50 ml'], colors: null };
  return { sizes: null, colors: null };
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [p, setP] = useState<Product | null>(null);
  const [related, setRelated] = useState<RecProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [wished, setWished] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [tab, setTab] = useState<'desc' | 'specs' | 'ship'>('desc');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('products' as any).select('*').eq('id', id).maybeSingle();
      const prod = data as any as Product | null;
      setP(prod);
      if (prod) {
        trackView(prod.id, prod.category);
        const url = window.location.href;
        applySeo({
          title: `${prod.name} · Dëkk by Yobbanté`,
          description: (prod.description || '').slice(0, 155) || `Découvrez ${prod.name} sur Dëkk. Livraison incluse au Sénégal.`,
          image: prod.image_url,
          url,
          type: 'product',
          jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: prod.name,
            description: prod.description,
            image: prod.image_url ? [prod.image_url] : undefined,
            sku: prod.id,
            category: CATEGORY[prod.category] ?? prod.category,
            brand: { '@type': 'Brand', name: 'Dëkk by Yobbanté' },
            offers: {
              '@type': 'Offer',
              url,
              priceCurrency: 'EUR',
              price: prod.price_eur,
              availability: prod.stock_mode === 'stock'
                ? 'https://schema.org/InStock'
                : 'https://schema.org/PreOrder',
              itemCondition: 'https://schema.org/NewCondition',
            },
          },
        });
        const recs = await recommend({ excludeIds: [prod.id], primaryCategory: prod.category, limit: 4 });
        setRelated(recs);
      }
      setLoading(false);
      try { setWished(JSON.parse(localStorage.getItem('dekk_wishlist') || '[]').includes(id)); } catch {}
    })();
    window.scrollTo(0, 0);
  }, [id]);

  const variants = useMemo(() => p ? variantsFor(p) : { sizes: null, colors: null }, [p]);

  const addToCart = () => {
    if (!p) return;
    if (variants.sizes && !size) return;
    setAdding(true);
    try {
      const c = JSON.parse(localStorage.getItem('dekk_cart') || '[]');
      const existing = c.find((i: any) => i.product.id === p.id);
      if (existing) existing.qty += qty;
      else c.push({ product: p, qty });
      localStorage.setItem('dekk_cart', JSON.stringify(c));
    } catch {}
    setTimeout(() => { setAdding(false); }, 800);
  };

  const toggleWish = () => {
    setWished(w => {
      const next = !w;
      try {
        const list: string[] = JSON.parse(localStorage.getItem('dekk_wishlist') || '[]');
        const set = new Set(list);
        next ? set.add(id!) : set.delete(id!);
        localStorage.setItem('dekk_wishlist', JSON.stringify([...set]));
      } catch {}
      return next;
    });
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ title: p?.name, url }); } catch {} }
    else { await navigator.clipboard.writeText(url); }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
        <PublicNav />
        <div className="max-w-6xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-8 animate-pulse">
          <div style={{ aspectRatio: '1/1', background: '#F4F4F4', borderRadius: 16 }} />
          <div className="space-y-4">
            <div style={{ height: 14, width: '30%', background: '#F0F0F0', borderRadius: 4 }} />
            <div style={{ height: 32, width: '80%', background: '#F0F0F0', borderRadius: 4 }} />
            <div style={{ height: 24, width: '40%', background: '#F0F0F0', borderRadius: 4 }} />
            <div style={{ height: 100, background: '#F4F4F4', borderRadius: 8 }} />
          </div>
        </div>
      </div>
    );
  }

  if (!p) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
        <PublicNav />
        <div className="max-w-2xl mx-auto px-4 py-24 text-center">
          <p style={{ fontSize: 18, fontWeight: 500 }}>Ce produit n'existe plus.</p>
          <Link to="/boutique" style={{ display: 'inline-block', marginTop: 16, color: DEKK.accent, fontSize: 14 }}>← Retour à la boutique</Link>
        </div>
      </div>
    );
  }

  // Generate gallery (single image padded with subtle variations)
  const gallery = [p.image_url, p.image_url + '&sat=-30', p.image_url + '&blur=0'].filter(Boolean);

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: '"DM Sans", system-ui, sans-serif', color: DEKK.ink }}>
      <PublicNav />

      {/* Breadcrumb */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <nav style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', color: DEKK.muted, display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.04em' }}>
          <button onClick={() => nav('/boutique')} style={{ background: 'none', border: 'none', color: DEKK.muted, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowLeft size={12} /> DËKK
          </button>
          <ChevronRight size={11} />
          <span>{(CATEGORY[p.category] ?? p.category).toUpperCase()}</span>
          <ChevronRight size={11} />
          <span style={{ color: DEKK.ink, opacity: 0.7 }}>{p.name.length > 24 ? p.name.slice(0, 24) + '…' : p.name}</span>
        </nav>
      </div>

      <main className="max-w-6xl mx-auto px-4 pt-4 pb-24 grid md:grid-cols-2 gap-10 lg:gap-16">
        {/* GALLERY */}
        <div>
          <div style={{
            position: 'relative', aspectRatio: '1/1', background: '#FAFAFA',
            borderRadius: 18, overflow: 'hidden', border: `0.5px solid ${DEKK.line}`,
          }}>
            <img src={gallery[imgIdx]} alt={p.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 300ms' }} />
            <button onClick={toggleWish} aria-label="Favori"
              style={{
                position: 'absolute', top: 14, right: 14, width: 40, height: 40, borderRadius: 20,
                background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <Heart size={17} fill={wished ? DEKK.accent : 'none'} color={wished ? DEKK.accent : DEKK.ink} />
            </button>
            {p.verified && (
              <div style={{
                position: 'absolute', bottom: 14, left: 14,
                background: '#fff', borderRadius: 20, padding: '6px 12px',
                fontSize: 10, fontFamily: '"DM Mono", monospace', fontWeight: 600,
                letterSpacing: '0.06em', color: DEKK.ink, display: 'inline-flex', alignItems: 'center', gap: 5,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}>
                <ShieldCheck size={11} color={DEKK.accent} /> TESTÉ COMMUNAUTÉ
              </div>
            )}
          </div>
          {/* Thumbnails */}
          <div className="flex gap-2 mt-3">
            {gallery.map((g, i) => (
              <button key={i} onClick={() => setImgIdx(i)}
                style={{
                  width: 64, height: 64, borderRadius: 10, overflow: 'hidden',
                  border: `1px solid ${i === imgIdx ? DEKK.ink : DEKK.line}`,
                  cursor: 'pointer', padding: 0, background: '#FAFAFA',
                }}>
                <img src={g} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
            ))}
          </div>
        </div>

        {/* INFO */}
        <div>
          <div style={{ fontSize: 10, fontFamily: '"DM Mono", monospace', letterSpacing: '0.1em', color: DEKK.accent, textTransform: 'uppercase' }}>
            {CATEGORY[p.category] ?? p.category} · Origine {ORIGIN[p.origin_country] ?? 'International'}
          </div>
          <h1 style={{ fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 600, letterSpacing: '-0.02em', margin: '8px 0 0', lineHeight: 1.15 }}>
            {p.name}
          </h1>

          {/* Rating mock */}
          <div className="flex items-center gap-2 mt-3" style={{ fontSize: 12, color: DEKK.muted }}>
            <span style={{ display: 'inline-flex', gap: 1 }}>
              {[1,2,3,4,5].map(i => <Star key={i} size={13} fill={i<=4?DEKK.accent:'none'} color={DEKK.accent} strokeWidth={1.5} />)}
            </span>
            <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 11 }}>4.7 · 128 avis</span>
          </div>

          <div className="flex items-baseline gap-3 mt-5">
            <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em' }}>{fmtEur(p.price_eur)}</span>
            <span style={{ fontSize: 13, color: DEKK.muted, fontFamily: '"DM Mono", monospace' }}>{fmtFcfa(p.price_fcfa)}</span>
          </div>
          <p style={{ fontSize: 11, color: DEKK.muted, marginTop: 4, fontFamily: '"DM Mono", monospace' }}>
            Livraison incluse au Sénégal · Paiement à la livraison possible
          </p>

          {/* Variants */}
          {variants.colors && (
            <div className="mt-6">
              <div style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', color: DEKK.muted, letterSpacing: '0.06em', marginBottom: 8 }}>
                COULEUR{color && <span style={{ color: DEKK.ink, marginLeft: 6 }}>· {color}</span>}
              </div>
              <div className="flex gap-2">
                {variants.colors.map(c => (
                  <button key={c.k} onClick={() => setColor(c.k)}
                    aria-label={c.k}
                    style={{
                      width: 32, height: 32, borderRadius: 16, background: c.hex,
                      border: `2px solid ${color === c.k ? DEKK.ink : '#fff'}`,
                      boxShadow: `0 0 0 1px ${color === c.k ? DEKK.ink : DEKK.line}`,
                      cursor: 'pointer', padding: 0,
                    }} />
                ))}
              </div>
            </div>
          )}

          {variants.sizes && (
            <div className="mt-6">
              <div style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', color: DEKK.muted, letterSpacing: '0.06em', marginBottom: 8 }}>
                {p.category === 'beaute' ? 'FORMAT' : 'TAILLE'}
              </div>
              <div className="flex flex-wrap gap-2">
                {variants.sizes.map(s => (
                  <button key={s} onClick={() => setSize(s)}
                    style={{
                      minWidth: 54, height: 40, padding: '0 14px', borderRadius: 10,
                      border: `1px solid ${size === s ? DEKK.ink : DEKK.line}`,
                      background: size === s ? DEKK.ink : '#fff',
                      color: size === s ? '#fff' : DEKK.ink,
                      fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    }}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity + CTA */}
          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              border: `1px solid ${DEKK.line}`, borderRadius: 12, height: 52, padding: '0 4px',
            }}>
              <button onClick={() => setQty(q => Math.max(1, q-1))} style={{ width: 40, height: 44, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DEKK.ink }}>
                <Minus size={14} />
              </button>
              <span style={{ minWidth: 32, textAlign: 'center', fontSize: 15, fontWeight: 600, fontFamily: '"DM Mono", monospace' }}>{qty}</span>
              <button onClick={() => setQty(q => q+1)} style={{ width: 40, height: 44, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DEKK.ink }}>
                <Plus size={14} />
              </button>
            </div>
            <button onClick={addToCart} disabled={adding}
              style={{
                flex: 1, minHeight: 52, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: adding ? '#0E7A4F' : DEKK.ink, color: '#fff',
                fontSize: 14, fontWeight: 600, letterSpacing: '0.01em',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 200ms',
              }}>
              {adding ? <><Check size={16} /> Ajouté au panier</> : <><ShoppingBag size={16} /> Ajouter — {fmtEur(p.price_eur * qty)}</>}
            </button>
          </div>

          <button onClick={() => { addToCart(); setTimeout(() => nav('/panier/checkout'), 200); }}
            style={{
              marginTop: 10, width: '100%', minHeight: 52, borderRadius: 12,
              background: DEKK.accent, color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
            }}>
            Acheter maintenant →
          </button>

          <button onClick={share} style={{
            marginTop: 14, background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, color: DEKK.muted, display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Share2 size={13} /> Partager ce produit
          </button>

          {/* Trust row */}
          <div className="mt-7 grid grid-cols-3 gap-2" style={{ borderTop: `0.5px solid ${DEKK.line}`, paddingTop: 18 }}>
            {[
              { icon: <Truck size={16} />, t: 'Livraison incluse', s: 'Dakar & régions' },
              { icon: <ShieldCheck size={16} />, t: 'Qualité testée', s: 'Avant expédition' },
              { icon: <Check size={16} />, t: 'Paiement sécurisé', s: 'Wave · OM · Carte' },
            ].map((it, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', color: DEKK.accent, marginBottom: 4 }}>{it.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 600 }}>{it.t}</div>
                <div style={{ fontSize: 10, color: DEKK.muted, fontFamily: '"DM Mono", monospace' }}>{it.s}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="mt-8" style={{ borderTop: `0.5px solid ${DEKK.line}`, paddingTop: 18 }}>
            <div className="flex gap-1" style={{ borderBottom: `0.5px solid ${DEKK.line}` }}>
              {([['desc', 'Description'], ['specs', 'Détails'], ['ship', 'Livraison']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k as any)}
                  style={{
                    padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 500,
                    color: tab === k ? DEKK.ink : DEKK.muted,
                    borderBottom: `2px solid ${tab === k ? DEKK.ink : 'transparent'}`,
                    marginBottom: -1,
                  }}>{l}</button>
              ))}
            </div>
            <div style={{ padding: '16px 2px', fontSize: 13, lineHeight: 1.65, color: '#333' }}>
              {tab === 'desc' && <p style={{ margin: 0 }}>{p.description}</p>}
              {tab === 'specs' && (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {[
                    ['Catégorie', CATEGORY[p.category] ?? p.category],
                    ['Origine', ORIGIN[p.origin_country] ?? 'International'],
                    ['Disponibilité', p.stock_mode === 'stock' ? 'En stock' : `Sur commande (${p.delivery_days ?? 7} j)`],
                    ['Référence', p.id.slice(0, 8).toUpperCase()],
                  ].map(([k, v]) => (
                    <li key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `0.5px solid ${DEKK.line}`, fontSize: 12 }}>
                      <span style={{ color: DEKK.muted, fontFamily: '"DM Mono", monospace' }}>{k}</span>
                      <span style={{ color: DEKK.ink }}>{v}</span>
                    </li>
                  ))}
                </ul>
              )}
              {tab === 'ship' && (
                <div>
                  <p style={{ margin: '0 0 8px' }}><strong>Livraison à Dakar :</strong> 24–72 h après réception en entrepôt.</p>
                  <p style={{ margin: '0 0 8px' }}><strong>Régions :</strong> 3–6 jours via partenaires locaux.</p>
                  <p style={{ margin: 0, color: DEKK.muted }}>Tous les frais de douane et la livraison finale sont inclus dans le prix affiché.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* RELATED */}
      {related.length > 0 && (
        <section style={{ borderTop: `0.5px solid ${DEKK.line}`, background: '#FAFAFA' }}>
          <div className="max-w-6xl mx-auto px-4 py-12">
            <div style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', color: DEKK.muted, letterSpacing: '0.1em' }}>VOUS AIMEREZ AUSSI</div>
            <h2 style={{ fontSize: 22, fontWeight: 600, margin: '6px 0 20px', letterSpacing: '-0.01em' }}>
              Dans la même catégorie
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {related.map(r => (
                <Link key={r.id} to={`/boutique/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ aspectRatio: '1/1', background: '#fff', borderRadius: 12, overflow: 'hidden', border: `0.5px solid ${DEKK.line}` }}>
                    <img src={r.image_url} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, marginTop: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {r.name}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{fmtEur(r.price_eur)}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
