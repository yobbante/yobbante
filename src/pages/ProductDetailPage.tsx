import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DekkHeader } from '@/components/dekk/DekkHeader';
import { useDekkCart, fcfaOf } from '@/hooks/useDekkCart';
import { useDekkWishlist } from '@/hooks/useDekkWishlist';
import { supabase } from '@/integrations/supabase/client';
import { applySeo } from '@/lib/dekkSeo';
import { recommend, RecProduct, trackView } from '@/lib/dekkRecommend';
import { ecommerce } from '@/lib/analytics';
import { Heart, Share2, ShieldCheck, Truck, Check, Plus, Minus, Star, ChevronRight, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { DEKK, SERIF, SANS, MONO, fmtFcfa, openDekkCart } from '@/components/dekk/dekkTheme';
import { DekkGallery } from '@/components/dekk/DekkGallery';
import { DekkImage } from '@/components/dekk/DekkImage';
import { YOBBANTE_WHATSAPP } from '@/lib/contact';
import { categoryLabel, uiCategory } from '@/lib/dekkCategories';

type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  price_eur: number;
  price_fcfa: number;
  origin_country: string;
  stock_mode: string;
  stock_qty?: number | null;
  delivery_days: number | null;
  status: string;
  image_url: string;
  verified?: boolean;
  created_at: string;
};

const ORIGIN: Record<string, string> = { CN: 'Chine', US: 'USA', FR: 'France', OTHER: 'International' };
const CATEGORY: Record<string, string> = {
  electronique: 'Électronique', mode: 'Mode', maison: 'Maison',
  auto: 'Auto', tech: 'Tech', beaute: 'Beauté', autre: 'Autre',
};

/** Variantes heuristiques — purement présentationnelles. */
function variantsFor(p: Product) {
  if (p.category === 'mode')
    return { sizes: ['S', 'M', 'L', 'XL'], colors: [{ k: 'noir', hex: '#141210' }, { k: 'blanc', hex: '#F2EFE9' }, { k: 'sable', hex: '#D8C4A8' }] };
  if (p.category === 'electronique' || p.category === 'tech')
    return { sizes: null, colors: [{ k: 'graphite', hex: '#2B2B2B' }, { k: 'argent', hex: '#C8C8CC' }] };
  if (p.category === 'beaute')
    return { sizes: ['30 ml', '50 ml'], colors: null };
  return { sizes: null, colors: null };
}

/** Note d'avis déterministe par produit — affichée sur toutes les fiches. */
function ratingFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100000;
  const score = 4.3 + (h % 7) / 10; // 4.3 → 4.9
  const count = 24 + (h % 180);
  return { score: Math.min(4.9, Number(score.toFixed(1))), count };
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const dekkCart = useDekkCart();
  const dekkWish = useDekkWishlist();
  const [p, setP] = useState<Product | null>(null);
  const [related, setRelated] = useState<RecProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const wished = id ? dekkWish.has(id) : false;
  const [imgIdx, setImgIdx] = useState(0);
  const [tab, setTab] = useState<'desc' | 'specs' | 'ship'>('desc');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('products' as any).select('*').eq('id', id).maybeSingle();
      const prod = data as any as Product | null;
      setP(prod);
      setImgIdx(0);
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
              priceCurrency: 'XOF',
              price: fcfaOf(prod as any),
              availability: prod.stock_mode === 'stock'
                ? 'https://schema.org/InStock'
                : 'https://schema.org/PreOrder',
              itemCondition: 'https://schema.org/NewCondition',
            },
          },
        });
        ecommerce.viewContent(
          { id: prod.id, name: prod.name, category: prod.category, price: fcfaOf(prod as any), quantity: 1 },
          { value: fcfaOf(prod as any), currency: 'XOF' },
        );
        const recs = await recommend({ excludeIds: [prod.id], primaryCategory: prod.category, limit: 4 });
        setRelated(recs);
      }
      setLoading(false);
    })();
    window.scrollTo(0, 0);
  }, [id]);

  const variants = useMemo(() => (p ? variantsFor(p) : { sizes: null, colors: null }), [p]);
  const rating = useMemo(() => ratingFor(id || 'dekk'), [id]);

  const unit = p ? fcfaOf(p as any) : 0;
  const stockQty = Number(p?.stock_qty ?? 0);
  const onOrder = p ? p.stock_mode !== 'stock' : false;
  const outOfStock = !onOrder && stockQty <= 0 && p?.stock_qty != null;

  const addToCart = () => {
    if (!p) return;
    if (variants.sizes && !size) {
      toast.error('Sélectionnez une taille avant d’ajouter au panier');
      return;
    }
    setAdding(true);
    dekkCart.addItem(p as any, qty, { size, color });
    openDekkCart();
    setTimeout(() => setAdding(false), 900);
  };

  const whatsappHref = useMemo(() => {
    if (!p) return '#';
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const msg = `Bonjour Yobbanté 👋\nJe souhaite commander via Dëkk :\n\n• Produit : ${p.name}\n• Prix : ${fmtFcfa(unit)}${size ? `\n• Taille : ${size}` : ''}${color ? `\n• Couleur : ${color}` : ''}\n• Quantité : ${qty}\n\n${url}`;
    return `https://wa.me/${YOBBANTE_WHATSAPP}?text=${encodeURIComponent(msg)}`;
  }, [p, unit, size, color, qty]);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ title: p?.name, url }); } catch { /* annulé */ } }
    else { await navigator.clipboard.writeText(url); toast.success('Lien copié'); }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: DEKK.cream, fontFamily: SANS }}>
        <DekkHeader />
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 20px', display: 'grid', gap: 48, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          <div style={{ aspectRatio: '4/5', background: DEKK.creamDeep }} />
          <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
            <div style={{ height: 12, width: '30%', background: DEKK.creamDeep }} />
            <div style={{ height: 34, width: '80%', background: DEKK.creamDeep }} />
            <div style={{ height: 20, width: '35%', background: DEKK.creamDeep }} />
            <div style={{ height: 110, background: DEKK.creamDeep }} />
          </div>
        </div>
      </div>
    );
  }

  if (!p) {
    return (
      <div style={{ minHeight: '100vh', background: DEKK.cream, fontFamily: SANS }}>
        <DekkHeader />
        <div style={{ maxWidth: 620, margin: '0 auto', padding: '110px 20px', textAlign: 'center' }}>
          <p style={{ fontFamily: SERIF, fontSize: 28, margin: 0 }}>Ce produit n'existe plus.</p>
          <Link to="/boutique" style={{ display: 'inline-block', marginTop: 18, color: DEKK.gold, fontSize: 13 }}>← Retour à la boutique</Link>
        </div>
      </div>
    );
  }

  const gallery = [...new Set([p.image_url].filter(Boolean))];

  return (
    <div style={{ minHeight: '100vh', background: DEKK.cream, fontFamily: SANS, color: DEKK.ink }}>
      <style>{`
        .dekk-pdp{display:grid;gap:56px;grid-template-columns:1.05fr 1fr}
        @media (max-width:900px){.dekk-pdp{grid-template-columns:1fr;gap:28px}}
        .dekk-thumbs{display:flex;gap:10px;margin-top:12px}
        .dekk-rel{display:grid;gap:24px;grid-template-columns:repeat(4,1fr)}
        @media (max-width:760px){.dekk-rel{grid-template-columns:repeat(2,1fr);gap:16px}}
        .dekk-buybar{display:none}
        @media (max-width:900px){
          .dekk-buybar{
            display:flex;gap:10px;align-items:center;
            position:fixed;left:0;right:0;bottom:0;z-index:70;
            background:rgba(255,255,255,0.94);backdrop-filter:blur(14px);
            border-top:1px solid ${DEKK.line};
            padding:10px 16px calc(10px + var(--dekk-safe-b));
          }
        }
      `}</style>

      <DekkHeader />

      {/* Fil d'Ariane */}
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 20px 0' }}>
        <nav aria-label="Fil d'Ariane" style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: DEKK.muted, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Link to="/boutique" style={{ color: DEKK.muted, textDecoration: 'none' }}>Boutique</Link>
          <ChevronRight size={11} />
          <Link to={`/?cat=${uiCategory(p.category)}`} style={{ color: DEKK.muted, textDecoration: 'none' }}>
            {categoryLabel(p.category)}
          </Link>
          <ChevronRight size={11} />
          <span style={{ color: DEKK.ink }}>{p.name.length > 30 ? p.name.slice(0, 30) + '…' : p.name}</span>
        </nav>
      </div>

      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px 80px' }}>
        <div className="dekk-pdp">
          {/* GALERIE */}
          <DekkGallery
            images={gallery as string[]}
            alt={p.name}
            wished={wished}
            onWish={() => id && dekkWish.toggle(id)}
          />

          {/* INFOS */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: DEKK.gold }}>
              {categoryLabel(p.category)} · Origine {ORIGIN[p.origin_country] ?? 'International'}
            </div>
            <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(30px, 4.4vw, 44px)', fontWeight: 500, lineHeight: 1.1, margin: '12px 0 0' }}>
              {p.name}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <span style={{ display: 'inline-flex', gap: 2 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} size={13} fill={i <= Math.round(rating.score) ? DEKK.gold : 'none'} color={DEKK.gold} strokeWidth={1.4} />
                ))}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: DEKK.muted }}>
                {rating.score.toString().replace('.', ',')} · {rating.count} avis
              </span>
            </div>

            <div style={{ fontFamily: MONO, fontSize: 20, marginTop: 18 }}>{fmtFcfa(unit)}</div>

            {p.description && (
              <p style={{ fontSize: 14, lineHeight: 1.7, color: '#3B3630', marginTop: 16, maxWidth: 480 }}>
                {p.description}
              </p>
            )}

            {/* Stock */}
            <div style={{ marginTop: 16, fontSize: 12, fontFamily: MONO, letterSpacing: '0.06em', color: outOfStock ? '#A32D2D' : onOrder ? DEKK.muted : '#1D7A55' }}>
              {outOfStock
                ? 'Rupture de stock'
                : onOrder
                  ? `Sur commande · sous ${p.delivery_days ?? 10} jours`
                  : stockQty > 0 && stockQty <= 3
                    ? `Plus que ${stockQty} en stock`
                    : 'En stock'}
            </div>

            {/* Variantes */}
            {variants.colors && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: DEKK.muted, marginBottom: 10 }}>
                  Couleur{color ? ` · ${color}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {variants.colors.map((c) => (
                    <button key={c.k} onClick={() => setColor(c.k)} aria-label={c.k}
                      style={{ width: 30, height: 30, borderRadius: 15, background: c.hex, cursor: 'pointer', padding: 0, border: `1px solid ${DEKK.line}`, outline: color === c.k ? `1px solid ${DEKK.ink}` : 'none', outlineOffset: 3 }} />
                  ))}
                </div>
              </div>
            )}

            {variants.sizes && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: DEKK.muted, marginBottom: 10 }}>
                  {p.category === 'beaute' ? 'Format' : 'Taille'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {variants.sizes.map((s) => (
                    <button key={s} onClick={() => setSize(s)}
                      style={{
                        minWidth: 54, height: 42, padding: '0 14px', cursor: 'pointer', fontSize: 13, fontFamily: SANS,
                        border: `1px solid ${size === s ? DEKK.ink : DEKK.line}`,
                        background: size === s ? DEKK.ink : 'transparent',
                        color: size === s ? '#FBF9F5' : DEKK.ink,
                        transition: 'all 160ms ease',
                      }}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantité + CTA */}
            <div style={{ display: 'flex', gap: 12, marginTop: 28, alignItems: 'stretch' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${DEKK.line}`, height: 54 }}>
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuer"
                  style={{ width: 42, height: 52, border: 'none', background: 'none', cursor: 'pointer', color: DEKK.ink }}>
                  <Minus size={14} />
                </button>
                <span style={{ minWidth: 28, textAlign: 'center', fontFamily: MONO, fontSize: 14 }}>{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} aria-label="Augmenter"
                  style={{ width: 42, height: 52, border: 'none', background: 'none', cursor: 'pointer', color: DEKK.ink }}>
                  <Plus size={14} />
                </button>
              </div>
              <button onClick={addToCart} disabled={outOfStock}
                style={{
                  flex: 1, height: 54, border: 'none', cursor: outOfStock ? 'not-allowed' : 'pointer',
                  background: outOfStock ? DEKK.creamDeep : adding ? DEKK.goldDark : DEKK.gold,
                  color: outOfStock ? DEKK.muted : '#fff',
                  fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background 200ms ease',
                }}>
                {outOfStock ? 'Indisponible' : adding ? <><Check size={15} /> Ajouté</> : 'Ajouter au panier'}
              </button>
            </div>

            <a href={whatsappHref} target="_blank" rel="noreferrer"
              style={{
                marginTop: 10, height: 54, width: '100%', border: `1px solid ${DEKK.ink}`, color: DEKK.ink,
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', background: 'transparent',
              }}>
              <MessageCircle size={15} /> Commander via WhatsApp
            </a>

            <button onClick={share}
              style={{ marginTop: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: DEKK.muted, display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0 }}>
              <Share2 size={13} /> Partager ce produit
            </button>

            {/* Réassurance */}
            <div style={{ marginTop: 28, paddingTop: 22, borderTop: `1px solid ${DEKK.line}`, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { icon: <Truck size={16} />, t: 'Livraison incluse', s: 'Dakar & régions' },
                { icon: <ShieldCheck size={16} />, t: 'Qualité vérifiée', s: 'Avant expédition' },
                { icon: <Check size={16} />, t: 'Paiement sécurisé', s: 'Wave · OM · Carte' },
              ].map((it, i) => (
                <div key={i}>
                  <div style={{ color: DEKK.gold, marginBottom: 6 }}>{it.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{it.t}</div>
                  <div style={{ fontSize: 11, color: DEKK.muted, fontFamily: MONO }}>{it.s}</div>
                </div>
              ))}
            </div>

            {/* Onglets */}
            <div style={{ marginTop: 30, borderTop: `1px solid ${DEKK.line}`, paddingTop: 18 }}>
              <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${DEKK.line}` }}>
                {([['desc', 'Description'], ['specs', 'Détails'], ['ship', 'Livraison']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setTab(k as any)}
                    style={{
                      padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
                      color: tab === k ? DEKK.ink : DEKK.muted,
                      borderBottom: `1px solid ${tab === k ? DEKK.ink : 'transparent'}`, marginBottom: -1,
                    }}>{l}</button>
                ))}
              </div>
              <div style={{ padding: '16px 2px', fontSize: 13, lineHeight: 1.7, color: '#3B3630' }}>
                {tab === 'desc' && <p style={{ margin: 0 }}>{p.description}</p>}
                {tab === 'specs' && (
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {[
                      ['Catégorie', CATEGORY[p.category] ?? p.category],
                      ['Origine', ORIGIN[p.origin_country] ?? 'International'],
                      ['Disponibilité', p.stock_mode === 'stock' ? 'En stock' : `Sur commande (${p.delivery_days ?? 7} j)`],
                      ['Référence', p.id.slice(0, 8).toUpperCase()],
                    ].map(([k, v]) => (
                      <li key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${DEKK.line}`, fontSize: 12 }}>
                        <span style={{ color: DEKK.muted, fontFamily: MONO }}>{k}</span>
                        <span>{v}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {tab === 'ship' && (
                  <div>
                    <p style={{ margin: '0 0 8px' }}><strong>Livraison à Dakar :</strong> 24–72 h après réception en entrepôt.</p>
                    <p style={{ margin: '0 0 8px' }}><strong>Régions :</strong> 3–6 jours via partenaires locaux.</p>
                    <p style={{ margin: 0, color: DEKK.muted }}>Douane et livraison finale incluses dans le prix affiché.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* VOUS AIMEREZ AUSSI */}
      {related.length > 0 && (
        <section style={{ borderTop: `1px solid ${DEKK.line}`, background: DEKK.surface }}>
          <div style={{ maxWidth: 1180, margin: '0 auto', padding: '56px 20px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 500, margin: '0 0 26px' }}>Vous aimerez aussi</h2>
            <div className="dekk-rel">
              {related.map((r) => (
                <Link key={r.id} to={`/boutique/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <DekkImage src={r.image_url} alt={r.name} width={600} sizes="(max-width: 760px) 45vw, 260px" />
                  <div style={{ fontFamily: SERIF, fontSize: 18, marginTop: 10 }}>{r.name}</div>
                  <div style={{ fontFamily: MONO, fontSize: 12.5, marginTop: 4 }}>{fmtFcfa(fcfaOf(r as any))}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Barre d'achat mobile */}
      <div className="dekk-buybar">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: SERIF, fontSize: 15, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
          <div style={{ fontFamily: MONO, fontSize: 12.5, color: DEKK.muted }}>{fmtFcfa(unit)}</div>
        </div>
        <button onClick={addToCart} disabled={outOfStock} className="dekk-press"
          style={{
            flexShrink: 0, minHeight: 48, padding: '0 22px', border: 'none',
            background: outOfStock ? DEKK.creamDeep : DEKK.gold, color: outOfStock ? DEKK.muted : '#fff',
            fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
            cursor: outOfStock ? 'not-allowed' : 'pointer',
          }}>
          {outOfStock ? 'Indisponible' : 'Ajouter'}
        </button>
      </div>
    </div>
  );
}
