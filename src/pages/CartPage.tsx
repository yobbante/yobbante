import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PublicNav } from '@/components/PublicNav';
import { applySeo } from '@/lib/dekkSeo';
import { recommend, RecProduct } from '@/lib/dekkRecommend';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, ShieldCheck, Truck } from 'lucide-react';

const DEKK = { accent: '#C97B3A', accentSoft: '#FBF3EA', ink: '#0E0E0E', line: '#ECECEC', muted: '#6B6B6B' };

type Product = {
  id: string; name: string; description: string | null; category: string;
  price_eur: number; price_fcfa: number; image_url: string | null;
  stock_mode: string; delivery_days: number | null; origin_country: string;
};
type CartItem = { product: Product; qty: number; size?: string | null; color?: string | null };

const fmtEur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const fmtFcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

function readCart(): CartItem[] {
  try { return JSON.parse(localStorage.getItem('dekk_cart') || '[]'); } catch { return []; }
}
function writeCart(c: CartItem[]) { localStorage.setItem('dekk_cart', JSON.stringify(c)); }

export default function CartPage() {
  const nav = useNavigate();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [recs, setRecs] = useState<RecProduct[]>([]);

  useEffect(() => {
    setCart(readCart());
    applySeo({
      title: 'Mon panier · Dëkk by Yobbanté',
      description: 'Récapitulez votre sélection Dëkk et continuez vers la livraison incluse au Sénégal.',
      type: 'website',
    });
  }, []);

  useEffect(() => {
    const cats = [...new Set(cart.map(i => i.product.category))];
    recommend({
      excludeIds: cart.map(i => i.product.id),
      primaryCategory: cats[0],
      limit: 4,
    }).then(setRecs);
  }, [cart.length]);

  const updateQty = (id: string, delta: number) => {
    setCart(prev => {
      const next = prev
        .map(i => i.product.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
        .filter(i => i.qty > 0);
      writeCart(next); return next;
    });
  };
  const removeItem = (id: string) => {
    setCart(prev => { const next = prev.filter(i => i.product.id !== id); writeCart(next); return next; });
  };

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.product.price_eur * i.qty, 0), [cart]);
  const itemsCount = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: '"DM Sans", system-ui, sans-serif', color: DEKK.ink }}>
      <DekkHeader />
      <main className="max-w-5xl mx-auto px-4 md:px-6 pt-8 pb-24">
        <div style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', color: DEKK.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          DËKK · Étape 1 sur 3
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 24px' }}>
          Mon panier {itemsCount > 0 && <span style={{ color: DEKK.muted, fontWeight: 400, fontSize: '0.6em' }}>· {itemsCount} article{itemsCount>1?'s':''}</span>}
        </h1>

        {cart.length === 0 ? (
          <EmptyCart />
        ) : (
          <div className="grid lg:grid-cols-[1fr,360px] gap-8">
            {/* Items */}
            <div>
              {cart.map(item => (
                <div key={item.product.id} style={{ display: 'flex', gap: 14, padding: '16px 0', borderBottom: `0.5px solid ${DEKK.line}` }}>
                  <Link to={`/boutique/${item.product.id}`} style={{ width: 90, height: 90, borderRadius: 10, overflow: 'hidden', background: '#F6F6F6', flexShrink: 0 }}>
                    {item.product.image_url && <img src={item.product.image_url} alt={item.product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </Link>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <Link to={`/boutique/${item.product.id}`} style={{ fontSize: 14, fontWeight: 500, color: DEKK.ink, textDecoration: 'none', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.product.name}
                    </Link>
                    <div style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', color: DEKK.muted, marginTop: 4, letterSpacing: '0.05em' }}>
                      {item.product.stock_mode === 'stock' ? 'En stock' : `Sous ${item.product.delivery_days ?? 7} j`}
                      {item.size && ` · ${item.size}`}
                      {item.color && ` · ${item.color}`}
                    </div>
                    <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${DEKK.line}`, borderRadius: 10, height: 36 }}>
                        <button onClick={() => updateQty(item.product.id, -1)} style={qtyBtn}><Minus size={13} /></button>
                        <span style={{ minWidth: 28, textAlign: 'center', fontSize: 13, fontWeight: 600, fontFamily: '"DM Mono", monospace' }}>{item.qty}</span>
                        <button onClick={() => updateQty(item.product.id, 1)} style={qtyBtn}><Plus size={13} /></button>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{fmtEur(item.product.price_eur * item.qty)}</div>
                        <button onClick={() => removeItem(item.product.id)} style={{ background: 'none', border: 'none', color: DEKK.muted, fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0, marginTop: 4 }}>
                          <Trash2 size={11} /> Retirer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <Link to="/boutique" style={{ display: 'inline-block', marginTop: 18, fontSize: 13, color: DEKK.accent, textDecoration: 'none' }}>
                ← Continuer mes achats
              </Link>
            </div>

            {/* Summary */}
            <aside style={{ position: 'sticky', top: 20, alignSelf: 'start', border: `1px solid ${DEKK.line}`, borderRadius: 16, padding: 22, background: '#FAFAFA' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Récapitulatif</div>
              <Row label="Sous-total" value={fmtEur(subtotal)} />
              <Row label="Livraison" value={<span style={{ color: '#0E7A4F', fontWeight: 600 }}>Incluse</span>} />
              <Row label="Taxes" value="Incluses" muted />
              <div style={{ borderTop: `0.5px solid ${DEKK.line}`, margin: '14px 0 12px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Total</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{fmtEur(subtotal)}</div>
                  <div style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', color: DEKK.muted }}>≈ {fmtFcfa(subtotal * 655)}</div>
                </div>
              </div>
              <button onClick={() => nav('/panier/checkout')}
                style={{ width: '100%', minHeight: 52, marginTop: 18, background: DEKK.ink, color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                Continuer vers la livraison <ArrowRight size={15} />
              </button>
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `0.5px solid ${DEKK.line}`, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11, color: DEKK.muted }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Truck size={12} color={DEKK.accent} /> Livraison Dakar 24–72 h, régions 3–6 j</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ShieldCheck size={12} color={DEKK.accent} /> Paiement sécurisé Wave · OM · Carte</span>
              </div>
            </aside>
          </div>
        )}

        {recs.length > 0 && <Recommendations title="Vous aimerez aussi" items={recs} />}
      </main>
    </div>
  );
}

const qtyBtn: React.CSSProperties = { width: 34, height: 34, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DEKK.ink };

function Row({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: muted ? DEKK.muted : DEKK.ink, marginBottom: 8 }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

function EmptyCart() {
  return (
    <div style={{ textAlign: 'center', padding: '64px 24px', border: `1px dashed ${DEKK.line}`, borderRadius: 18 }}>
      <div style={{ width: 56, height: 56, borderRadius: 28, background: DEKK.accentSoft, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <ShoppingBag size={22} color={DEKK.accent} />
      </div>
      <p style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Votre panier est vide.</p>
      <p style={{ fontSize: 13, color: DEKK.muted, marginTop: 8 }}>Découvrez les produits sélectionnés par la communauté.</p>
      <Link to="/boutique" style={{ display: 'inline-block', marginTop: 18, background: DEKK.ink, color: '#fff', borderRadius: 100, padding: '12px 24px', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
        Explorer Dëkk →
      </Link>
    </div>
  );
}

export function Recommendations({ title, items }: { title: string; items: RecProduct[] }) {
  if (!items.length) return null;
  return (
    <section style={{ marginTop: 56, paddingTop: 28, borderTop: `0.5px solid ${DEKK.line}` }}>
      <div style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', color: DEKK.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Pour vous</div>
      <h2 style={{ fontSize: 22, fontWeight: 600, margin: '6px 0 18px', letterSpacing: '-0.01em' }}>{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map(p => (
          <Link key={p.id} to={`/boutique/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ aspectRatio: '1/1', background: '#F6F6F6', borderRadius: 12, overflow: 'hidden' }}>
              {p.image_url && <img src={p.image_url} alt={p.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, marginTop: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 32 }}>
              {p.name}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{fmtEur(p.price_eur)}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
