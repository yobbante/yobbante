import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DekkHeader } from '@/components/dekk/DekkHeader';
import { DekkImage } from '@/components/dekk/DekkImage';
import { applySeo } from '@/lib/dekkSeo';
import { recommend, RecProduct } from '@/lib/dekkRecommend';
import { useDekkCart, fcfaOf } from '@/hooks/useDekkCart';
import { Minus, Plus, ShoppingBag, Trash2, ShieldCheck, Truck } from 'lucide-react';
import { DEKK, SERIF, SANS, MONO, fmtFcfa } from '@/components/dekk/dekkTheme';

/** Ouvre l'étape de confirmation avant commande. */
const openConfirm = () => window.dispatchEvent(new Event('dekk:order-confirm'));

export default function CartPage() {
  const { items: cart, updateQty, removeItem } = useDekkCart();
  const [recs, setRecs] = useState<RecProduct[]>([]);

  useEffect(() => {
    applySeo({
      title: 'Mon panier · Dëkk by Yobbanté',
      description: 'Récapitulez votre sélection Dëkk et continuez vers la livraison incluse au Sénégal.',
      type: 'website',
    });
  }, []);

  useEffect(() => {
    const cats = [...new Set(cart.map((i) => i.product.category))];
    recommend({
      excludeIds: cart.map((i) => i.product.id),
      primaryCategory: cats[0] as string | undefined,
      limit: 4,
    }).then(setRecs);
  }, [cart.length]);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + fcfaOf(i.product) * i.qty, 0), [cart]);
  const itemsCount = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <div style={{ minHeight: '100vh', background: DEKK.cream, fontFamily: SANS, color: DEKK.ink }}>
      <style>{`
        .dekk-cart{display:grid;gap:44px;grid-template-columns:1fr 340px;align-items:start}
        .dekk-cart-bar{display:none}
        @media (max-width:900px){
          .dekk-cart{grid-template-columns:1fr;gap:26px}
          .dekk-cart aside{position:static}
          .dekk-cart aside .dekk-cart-cta{display:none}
          .dekk-cart-bar{
            display:block;position:fixed;left:0;right:0;bottom:0;z-index:70;
            background:rgba(255,255,255,0.94);backdrop-filter:blur(14px);
            border-top:1px solid ${DEKK.line};
            padding:12px 16px calc(12px + var(--dekk-safe-b));
            animation:dekkSheetUp 320ms var(--dekk-ease) both;
          }
        }
        .dekk-recs{display:grid;gap:20px;grid-template-columns:repeat(4,1fr)}
        @media (max-width:760px){.dekk-recs{grid-template-columns:repeat(2,1fr);gap:14px}}
      `}</style>

      <DekkHeader />

      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 20px 140px' }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: DEKK.muted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Dëkk · Étape 1 sur 3
        </div>
        <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(30px, 5vw, 46px)', fontWeight: 500, letterSpacing: '-0.01em', margin: '8px 0 26px' }}>
          Mon panier
          {itemsCount > 0 && (
            <span style={{ color: DEKK.muted, fontWeight: 400, fontSize: '0.5em' }}> · {itemsCount} article{itemsCount > 1 ? 's' : ''}</span>
          )}
        </h1>

        {cart.length === 0 ? (
          <EmptyCart />
        ) : (
          <div className="dekk-cart">
            {/* Articles */}
            <div>
              {cart.map((item, k) => (
                <div key={`${item.product.id}-${k}`} className="dekk-rise"
                  style={{ display: 'flex', gap: 16, padding: '18px 0', borderBottom: `1px solid ${DEKK.line}` }}>
                  <Link to={`/boutique/${item.product.id}`} style={{ width: 96, flexShrink: 0 }}>
                    <DekkImage src={item.product.image_url} alt={item.product.name || ''} width={280} sizes="96px" />
                  </Link>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <Link to={`/boutique/${item.product.id}`}
                      style={{ fontFamily: SERIF, fontSize: 19, lineHeight: 1.25, color: DEKK.ink, textDecoration: 'none' }}>
                      {item.product.name}
                    </Link>
                    <div style={{ fontSize: 11, fontFamily: MONO, color: DEKK.muted, marginTop: 5, letterSpacing: '0.05em' }}>
                      {[
                        item.product.stock_mode === 'stock' ? 'En stock' : `Sous ${item.product.delivery_days ?? 7} j`,
                        item.size,
                        item.color,
                      ].filter(Boolean).join(' · ')}
                    </div>
                    <div style={{ marginTop: 'auto', paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${DEKK.line}`, height: 40 }}>
                        <button onClick={() => updateQty(k, -1)} aria-label="Diminuer" className="dekk-press" style={qtyBtn}>
                          <Minus size={13} />
                        </button>
                        <span style={{ minWidth: 28, textAlign: 'center', fontSize: 13, fontFamily: MONO }}>{item.qty}</span>
                        <button onClick={() => updateQty(k, 1)} aria-label="Augmenter" className="dekk-press" style={qtyBtn}>
                          <Plus size={13} />
                        </button>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: MONO, fontSize: 14 }}>{fmtFcfa(fcfaOf(item.product) * item.qty)}</div>
                        <button onClick={() => removeItem(k)}
                          style={{ background: 'none', border: 'none', color: DEKK.muted, fontSize: 11.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, padding: 0, marginTop: 5 }}>
                          <Trash2 size={11} /> Retirer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Récapitulatif */}
            <aside style={{ position: 'sticky', top: 96, alignSelf: 'start', border: `1px solid ${DEKK.line}`, padding: 22, background: DEKK.surface }}>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: DEKK.muted, marginBottom: 16 }}>
                Récapitulatif
              </div>
              <Row label="Sous-total" value={fmtFcfa(subtotal)} />
              <Row label="Livraison" value="Calculée à l'étape suivante" muted />
              <Row label="Taxes" value="Incluses" muted />
              <div style={{ borderTop: `1px solid ${DEKK.line}`, margin: '16px 0 14px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 13 }}>Total articles</span>
                <span style={{ fontFamily: MONO, fontSize: 20 }}>{fmtFcfa(subtotal)}</span>
              </div>
              <button onClick={openConfirm} className="dekk-press dekk-cart-cta"
                style={{ width: '100%', minHeight: 54, marginTop: 20, background: DEKK.gold, color: '#fff', border: 'none', borderRadius: 2, fontSize: 12.5, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Passer la commande
              </button>
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${DEKK.line}`, display: 'flex', flexDirection: 'column', gap: 9, fontSize: 11.5, color: DEKK.muted }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Truck size={13} color={DEKK.gold} /> Dakar 24–72 h · régions 3–6 j</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><ShieldCheck size={13} color={DEKK.gold} /> Paiement sécurisé Wave · OM · Carte</span>
              </div>
            </aside>
          </div>
        )}

        {recs.length > 0 && <Recommendations title="Vous aimerez aussi" items={recs} />}
      </main>

      {/* Barre d'action mobile */}
      {cart.length > 0 && (
        <div className="dekk-cart-bar">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: DEKK.muted }}>Total articles</span>
            <span style={{ fontFamily: MONO, fontSize: 16 }}>{fmtFcfa(subtotal)}</span>
          </div>
          <button onClick={openConfirm} className="dekk-press"
            style={{ width: '100%', minHeight: 52, background: DEKK.gold, color: '#fff', border: 'none', borderRadius: 2, fontSize: 12.5, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Passer la commande
          </button>
        </div>
      )}
    </div>
  );
}

const qtyBtn: React.CSSProperties = {
  width: 38, height: 38, border: 'none', background: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: DEKK.ink,
};

function Row({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, color: muted ? DEKK.muted : DEKK.ink, marginBottom: 9 }}>
      <span>{label}</span><span style={{ textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="dekk-rise" style={{ textAlign: 'center', padding: '72px 24px', border: `1px solid ${DEKK.line}`, background: DEKK.surface }}>
      <div style={{ width: 62, height: 62, borderRadius: 31, background: DEKK.goldSoft, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
        <ShoppingBag size={24} color={DEKK.gold} />
      </div>
      <p style={{ fontFamily: SERIF, fontSize: 24, margin: 0 }}>Votre panier est vide</p>
      <p style={{ fontSize: 13, color: DEKK.muted, marginTop: 8 }}>Découvrez la sélection Dëkk, importée et vérifiée par Yobbanté.</p>
      <Link to="/boutique" className="dekk-press"
        style={{ display: 'inline-block', marginTop: 20, background: DEKK.gold, color: '#fff', padding: '15px 28px', fontSize: 12.5, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none' }}>
        Découvrir la boutique
      </Link>
    </div>
  );
}

export function Recommendations({ title, items }: { title: string; items: RecProduct[] }) {
  if (!items.length) return null;
  return (
    <section style={{ marginTop: 64, paddingTop: 32, borderTop: `1px solid ${DEKK.line}` }}>
      <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 500, margin: '0 0 22px' }}>{title}</h2>
      <div className="dekk-recs">
        {items.map((p) => (
          <Link key={p.id} to={`/boutique/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <DekkImage src={p.image_url} alt={p.name} width={600} sizes="(max-width: 760px) 45vw, 260px" />
            <div style={{ fontFamily: SERIF, fontSize: 18, marginTop: 10, lineHeight: 1.25 }}>{p.name}</div>
            <div style={{ fontFamily: MONO, fontSize: 12.5, marginTop: 4 }}>{fmtFcfa(fcfaOf(p as any))}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
