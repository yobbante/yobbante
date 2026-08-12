import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, Minus, Plus, ShoppingBag } from 'lucide-react';
import { useDekkCart, fcfaOf } from '@/hooks/useDekkCart';
import { DEKK, SERIF, SANS, MONO, fmtFcfa } from './dekkTheme';

/**
 * Tiroir panier global Dëkk.
 * Slide latéral sur desktop, plein écran sur mobile.
 * S'ouvre via l'évènement `dekk:cart-open`.
 */
export function DekkCartDrawer() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const { items, updateQty, removeItem } = useDekkCart();

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('dekk:cart-open', onOpen);
    return () => window.removeEventListener('dekk:cart-open', onOpen);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const subtotal = items.reduce((s, i) => s + fcfaOf(i.product) * i.qty, 0);

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes dekkFade{from{opacity:0}to{opacity:1}}
        @keyframes dekkSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
        @media (max-width: 640px){ .dekk-drawer{ width:100% !important; } }
      `}</style>
      <div
        onClick={() => setOpen(false)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,16,0.42)', zIndex: 80, animation: 'dekkFade 200ms ease-out' }}
      />
      <aside
        className="dekk-drawer"
        role="dialog"
        aria-label="Panier"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '100%',
          background: DEKK.surface, zIndex: 81, display: 'flex', flexDirection: 'column',
          fontFamily: SANS, color: DEKK.ink,
          animation: 'dekkSlideIn 320ms cubic-bezier(.22,.8,.24,1)',
          boxShadow: '-24px 0 60px rgba(20,18,16,0.14)',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: `1px solid ${DEKK.line}` }}>
          <span style={{ fontFamily: SERIF, fontSize: 24, letterSpacing: '0.01em' }}>Panier</span>
          <button onClick={() => setOpen(false)} aria-label="Fermer le panier"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: DEKK.ink, display: 'inline-flex', padding: 4 }}>
            <X size={20} />
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '72px 12px' }}>
              <div style={{ width: 64, height: 64, borderRadius: 32, background: DEKK.goldSoft, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <ShoppingBag size={26} color={DEKK.gold} />
              </div>
              <p style={{ fontFamily: SERIF, fontSize: 22, margin: 0 }}>Votre panier est vide</p>
              <p style={{ fontSize: 13, color: DEKK.muted, marginTop: 8 }}>
                Parcourez la sélection Dëkk et ajoutez vos coups de cœur.
              </p>
              <button onClick={() => { setOpen(false); nav('/boutique'); }}
                style={{ marginTop: 20, background: DEKK.gold, color: '#fff', border: 'none', borderRadius: 2, padding: '13px 26px', fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Découvrir la boutique
              </button>
            </div>
          ) : (
            items.map((item, idx) => (
              <div key={`${item.product.id}-${item.size}-${item.color}-${idx}`}
                style={{ display: 'flex', gap: 14, padding: '16px 0', borderBottom: `1px solid ${DEKK.line}` }}>
                <Link to={`/boutique/${item.product.id}`} onClick={() => setOpen(false)}
                  style={{ width: 74, height: 88, background: DEKK.creamDeep, flexShrink: 0, overflow: 'hidden' }}>
                  {item.product.image_url && (
                    <img src={item.product.image_url} alt={item.product.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <Link to={`/boutique/${item.product.id}`} onClick={() => setOpen(false)}
                      style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.25, color: DEKK.ink, textDecoration: 'none' }}>
                      {item.product.name}
                    </Link>
                    <button onClick={() => removeItem(item.product.id)}
                      style={{ background: 'none', border: 'none', color: DEKK.muted, fontSize: 12, cursor: 'pointer', padding: 0, textDecoration: 'underline', flexShrink: 0 }}>
                      Retirer
                    </button>
                  </div>
                  {(item.size || item.color) && (
                    <div style={{ fontSize: 11, fontFamily: MONO, color: DEKK.muted, marginTop: 4 }}>
                      {[item.size, item.color].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${DEKK.line}` }}>
                      <button onClick={() => updateQty(item.product.id, -1)} aria-label="Diminuer"
                        style={{ width: 30, height: 30, border: 'none', background: 'none', cursor: 'pointer', color: DEKK.ink }}>
                        <Minus size={12} />
                      </button>
                      <span style={{ minWidth: 24, textAlign: 'center', fontSize: 13, fontFamily: MONO }}>{item.qty}</span>
                      <button onClick={() => updateQty(item.product.id, 1)} aria-label="Augmenter"
                        style={{ width: 30, height: 30, border: 'none', background: 'none', cursor: 'pointer', color: DEKK.ink }}>
                        <Plus size={12} />
                      </button>
                    </div>
                    <span style={{ fontSize: 13, fontFamily: MONO }}>{fmtFcfa(fcfaOf(item.product) * item.qty)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <footer style={{ borderTop: `1px solid ${DEKK.line}`, padding: '18px 20px 24px', background: DEKK.cream }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, color: DEKK.muted }}>Sous-total</span>
              <span style={{ fontSize: 18, fontFamily: MONO }}>{fmtFcfa(subtotal)}</span>
            </div>
            <p style={{ fontSize: 11, color: DEKK.muted, margin: '6px 0 14px' }}>
              Frais de livraison calculés à l'étape suivante.
            </p>
            <button onClick={() => { setOpen(false); nav('/panier'); }}
              style={{ width: '100%', minHeight: 52, background: DEKK.gold, color: '#fff', border: 'none', borderRadius: 2, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Passer la commande
            </button>
          </footer>
        )}
      </aside>
    </>
  );
}
