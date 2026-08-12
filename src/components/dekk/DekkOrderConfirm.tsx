import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, MessageCircle, CreditCard, Check, ChevronLeft } from 'lucide-react';
import { useDekkCart, fcfaOf } from '@/hooks/useDekkCart';
import { YOBBANTE_WHATSAPP } from '@/lib/contact';
import { DEKK, SERIF, SANS, MONO, fmtFcfa } from './dekkTheme';
import { DekkImage } from './DekkImage';

/**
 * Étape de confirmation avant commande.
 * S'ouvre via l'évènement `dekk:order-confirm`, récapitule le panier puis laisse
 * choisir entre paiement en ligne et envoi du récapitulatif sur WhatsApp.
 */
export function DekkOrderConfirm() {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const nav = useNavigate();
  const { items } = useDekkCart();

  useEffect(() => {
    const onOpen = () => { setSent(false); setOpen(true); };
    window.addEventListener('dekk:order-confirm', onOpen);
    return () => window.removeEventListener('dekk:order-confirm', onOpen);
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

  if (!open) return null;

  const subtotal = items.reduce((s, i) => s + fcfaOf(i.product) * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  const waHref = () => {
    const lignes = items
      .map((i) => `• ${i.product.name}${i.size ? ` (${i.size})` : ''}${i.color ? ` (${i.color})` : ''} × ${i.qty} — ${fmtFcfa(fcfaOf(i.product) * i.qty)}`)
      .join('\n');
    const msg = `Bonjour Yobbanté 👋\nJe confirme ma commande Dëkk :\n\n${lignes}\n\nTotal articles : ${fmtFcfa(subtotal)}\n(${count} article${count > 1 ? 's' : ''})\n\nMerci de me confirmer les frais de livraison.`;
    return `https://wa.me/${YOBBANTE_WHATSAPP}?text=${encodeURIComponent(msg)}`;
  };

  const sendWhatsApp = () => {
    window.open(waHref(), '_blank', 'noopener');
    setSent(true);
  };

  return (
    <>
      <div onClick={() => setOpen(false)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,16,0.5)', zIndex: 95, animation: 'dekkFade 200ms ease-out' }} />

      <div role="dialog" aria-label="Confirmation de commande" className="dekk-confirm"
        style={{
          position: 'fixed', zIndex: 96, background: DEKK.surface, color: DEKK.ink, fontFamily: SANS,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
        <style>{`
          .dekk-confirm{
            left:50%;top:50%;transform:translate(-50%,-50%);
            width:460px;max-width:calc(100% - 32px);max-height:86vh;border-radius:6px;
            animation:dekkRise 320ms var(--dekk-ease) both;
            box-shadow:0 28px 70px rgba(20,18,16,.22);
          }
          @media (max-width:640px){
            .dekk-confirm{
              left:0;right:0;bottom:0;top:auto;transform:none;width:100%;max-width:100%;
              max-height:92vh;border-radius:18px 18px 0 0;
              animation:dekkSheetUp 340ms var(--dekk-ease) both;
            }
          }
        `}</style>

        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: `1px solid ${DEKK.line}` }}>
          <span style={{ fontFamily: SERIF, fontSize: 21 }}>{sent ? 'Commande transmise' : 'Confirmer la commande'}</span>
          <button onClick={() => setOpen(false)} aria-label="Fermer" className="dekk-press"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: DEKK.ink, display: 'inline-flex', padding: 4 }}>
            <X size={19} />
          </button>
        </header>

        {sent ? (
          <div style={{ padding: '34px 22px 30px', textAlign: 'center' }}>
            <div style={{ width: 58, height: 58, borderRadius: 29, background: DEKK.goldSoft, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={26} color={DEKK.gold} />
            </div>
            <p style={{ fontFamily: SERIF, fontSize: 22, margin: '16px 0 6px' }}>WhatsApp est ouvert</p>
            <p style={{ fontSize: 13, color: DEKK.muted, margin: 0, lineHeight: 1.6 }}>
              Envoyez le message pré-rempli pour valider. Notre équipe confirme la livraison sous quelques minutes.
            </p>
            <button onClick={() => setSent(false)} className="dekk-press"
              style={{ marginTop: 20, background: 'none', border: 'none', color: DEKK.muted, fontSize: 12.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <ChevronLeft size={14} /> Revenir au récapitulatif
            </button>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 18px' }}>
              {items.map((i, k) => (
                <div key={`${i.product.id}-${k}`} style={{ display: 'flex', gap: 12, padding: '13px 0', borderBottom: `1px solid ${DEKK.line}` }}>
                  <DekkImage src={i.product.image_url} alt={i.product.name || ''} width={160} sizes="52px" style={{ width: 52, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.25 }}>{i.product.name}</div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: DEKK.muted, marginTop: 3 }}>
                      {[i.size, i.color, `× ${i.qty}`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 13 }}>{fmtFcfa(fcfaOf(i.product) * i.qty)}</div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 0 4px' }}>
                <span style={{ fontSize: 13, color: DEKK.muted }}>Total articles</span>
                <span style={{ fontFamily: MONO, fontSize: 18 }}>{fmtFcfa(subtotal)}</span>
              </div>
              <p style={{ fontSize: 11.5, color: DEKK.muted, margin: '0 0 12px' }}>
                Frais de livraison confirmés à l'étape suivante selon votre zone.
              </p>
            </div>

            <footer style={{ borderTop: `1px solid ${DEKK.line}`, background: DEKK.cream, padding: '14px 18px calc(16px + var(--dekk-safe-b))', display: 'grid', gap: 10 }}>
              <button onClick={() => { setOpen(false); nav('/panier/checkout'); }} className="dekk-press"
                style={{ width: '100%', minHeight: 52, background: DEKK.gold, color: '#fff', border: 'none', borderRadius: 2, fontSize: 12.5, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
                <CreditCard size={16} /> Payer en ligne
              </button>
              <button onClick={sendWhatsApp} className="dekk-press"
                style={{ width: '100%', minHeight: 52, background: 'transparent', color: DEKK.ink, border: `1px solid ${DEKK.ink}`, borderRadius: 2, fontSize: 12.5, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
                <MessageCircle size={16} /> Confirmer sur WhatsApp
              </button>
            </footer>
          </>
        )}
      </div>
    </>
  );
}
