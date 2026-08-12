import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { X, Minus, Plus, ShoppingBag } from 'lucide-react';
import { useDekkCart, fcfaOf } from '@/hooks/useDekkCart';
import { DEKK, SERIF, SANS, MONO, fmtFcfa } from './dekkTheme';
import { DekkImage } from './DekkImage';

/**
 * Tiroir panier global Dëkk.
 * Slide latéral sur desktop, feuille plein écran (bottom sheet) sur mobile.
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
    if (open) {
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const subtotal = items.reduce((s, i) => s + fcfaOf(i.product) * i.qty, 0);

  if (!open) return null;

  return (
    <>
      <style>{`
        .dekk-drawer{
          position:fixed;top:0;right:0;bottom:0;width:420px;max-width:100%;
          animation:dekkSlideIn 340ms var(--dekk-ease) both;
          box-shadow:-24px 0 60px rgba(20,18,16,0.14);
        }
        @media (max-width:640px){
          .dekk-drawer{
            top:auto;left:0;right:0;bottom:0;width:100%;height:92dvh;
            border-radius:18px 18px 0 0;
            animation:dekkSheetUp 340ms var(--dekk-ease) both;
            box-shadow:0 -20px 60px rgba(20,18,16,0.2);
          }
          .dekk-drawer-grab{display:block}
        }
        .dekk-drawer-grab{display:none;width:38px;height:4px;border-radius:2px;background:${DEKK.line};margin:8px auto 0}
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
          background: DEKK.surface, zIndex: 81, display: 'flex', flexDirection: 'column',
          fontFamily: SANS, color: DEKK.ink,
        }}
      >
        <span className="dekk-drawer-grab" aria-hidden />
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${DEKK.line}` }}>
          <span style={{ fontFamily: SERIF, fontSize: 24, letterSpacing: '0.01em' }}>Panier</span>
          <button onClick={() => setOpen(false)} aria-label="Fermer le panier" className="dekk-press"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: DEKK.ink, display: 'inline-flex', padding: 6 }}>
            <X size={20} />
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '8px 20px' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 12px' }} className="dekk-rise">
              <div style={{ width: 64, height: 64, borderRadius: 32, background: DEKK.goldSoft, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <ShoppingBag size={26} color={DEKK.gold} />
              </div>
              <p style={{ fontFamily: SERIF, fontSize: 22, margin: 0 }}>Votre panier est vide</p>
              <p style={{ fontSize: 13, color: DEKK.muted, marginTop: 8 }}>
                Parcourez la sélection Dëkk et ajoutez vos coups de cœur.
              </p>
              <button onClick={() => { setOpen(false); nav('/boutique'); }} className="dekk-press"
                style={{ marginTop: 20, background: DEKK.gold, color: '#fff', border: 'none', borderRadius: 2, padding: '14px 26px', fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Découvrir la boutique
              </button>
            </div>
          ) : (
            items.map((item, idx) => (
              <div key={`${item.product.id}-${item.size}-${item.color}-${idx}`} className="dekk-rise"
                style={{ display: 'flex', gap: 14, padding: '16px 0', borderBottom: `1px solid ${DEKK.line}` }}>
                <Link to={`/boutique/${item.product.id}`} onClick={() => setOpen(false)} style={{ width: 74, flexShrink: 0 }}>
                  <DekkImage src={item.product.image_url} alt={item.product.name || ''} width={220} sizes="74px" />
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
                      <button onClick={() => updateQty(item.product.id, -1)} aria-label="Diminuer" className="dekk-press"
                        style={{ width: 38, height: 38, border: 'none', background: 'none', cursor: 'pointer', color: DEKK.ink }}>
                        <Minus size={13} />
                      </button>
                      <span style={{ minWidth: 26, textAlign: 'center', fontSize: 13, fontFamily: MONO }}>{item.qty}</span>
                      <button onClick={() => updateQty(item.product.id, 1)} aria-label="Augmenter" className="dekk-press"
                        style={{ width: 38, height: 38, border: 'none', background: 'none', cursor: 'pointer', color: DEKK.ink }}>
                        <Plus size={13} />
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
          <footer style={{ borderTop: `1px solid ${DEKK.line}`, padding: '18px 20px calc(20px + var(--dekk-safe-b))', background: DEKK.cream }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, color: DEKK.muted }}>Sous-total</span>
              <span style={{ fontSize: 18, fontFamily: MONO }}>{fmtFcfa(subtotal)}</span>
            </div>
            <p style={{ fontSize: 11, color: DEKK.muted, margin: '6px 0 14px' }}>
              Frais de livraison calculés à l'étape suivante.
            </p>
            <button
              onClick={() => {
                setOpen(false);
                setTimeout(() => window.dispatchEvent(new Event('dekk:order-confirm')), 180);
              }}
              className="dekk-press"
              style={{ width: '100%', minHeight: 54, background: DEKK.gold, color: '#fff', border: 'none', borderRadius: 2, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Passer la commande
            </button>
            <button onClick={() => { setOpen(false); nav('/panier'); }}
              style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: DEKK.muted, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}>
              Voir le panier détaillé
            </button>
          </footer>
        )}
      </aside>
    </>
  );
}
