import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DekkHeader } from '@/components/dekk/DekkHeader';
import { applySeo } from '@/lib/dekkSeo';
import { ArrowLeft, Check, ShieldCheck, CreditCard, Smartphone, Banknote, Tag, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ecommerce } from '@/lib/analytics';

const DEKK = { accent: '#C97B3A', accentSoft: '#FBF3EA', ink: '#0E0E0E', line: '#ECECEC', muted: '#6B6B6B' };

type Product = { id: string; name: string; price_eur: number; price_fcfa: number; image_url: string | null; stock_mode: string; delivery_days: number | null };
type CartItem = { product: Product; qty: number };

const fmtEur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const fmtFcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

const CITIES = ['Dakar', 'Pikine', 'Guédiawaye', 'Rufisque', 'Thiès', 'Mbour', 'Saint-Louis', 'Touba', 'Kaolack', 'Ziguinchor', 'Diourbel', 'Autre'];

const PAY_METHODS = [
  { id: 'wave', label: 'Wave', sub: 'Paiement mobile instantané', icon: Smartphone },
  { id: 'om', label: 'Orange Money', sub: 'Paiement mobile sécurisé', icon: Smartphone },
  { id: 'card', label: 'Carte bancaire', sub: 'Visa · Mastercard', icon: CreditCard },
  { id: 'cash', label: 'Paiement à la livraison', sub: 'Espèces à réception', icon: Banknote },
] as const;

function readCart(): CartItem[] {
  try { return JSON.parse(localStorage.getItem('dekk_cart') || '[]'); } catch { return []; }
}

function genReference() {
  const yr = new Date().getFullYear();
  const rnd = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `DEKK-${yr}-${rnd}`;
}

export default function CheckoutPage() {
  const nav = useNavigate();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<'delivery' | 'payment'>('delivery');
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Dakar');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [payment, setPayment] = useState<typeof PAY_METHODS[number]['id']>('wave');

  // Promo code state
  const [promoInput, setPromoInput] = useState('');
  const [promoApplying, setPromoApplying] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ id: string; code: string; discount_eur: number } | null>(null);

  useEffect(() => {
    const c = readCart();
    if (c.length === 0) nav('/panier', { replace: true });
    setCart(c);
    applySeo({
      title: 'Livraison & paiement · Dëkk',
      description: 'Finalisez votre commande Dëkk. Livraison incluse au Sénégal, paiement Wave, Orange Money ou carte.',
      type: 'website',
    });
    if (c.length > 0) {
      const value = c.reduce((s, i) => s + i.product.price_eur * i.qty, 0);
      ecommerce.initiateCheckout(
        c.map(i => ({ id: i.product.id, name: i.product.name, price: i.product.price_eur, quantity: i.qty })),
        { value, currency: 'EUR' },
      );
    }
  }, [nav]);

  // Fire AddPaymentInfo once user reaches the payment step
  useEffect(() => {
    if (step === 'payment' && cart.length > 0) {
      const value = cart.reduce((s, i) => s + i.product.price_eur * i.qty, 0);
      ecommerce.addPaymentInfo(payment, { value, currency: 'EUR' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, payment]);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.product.price_eur * i.qty, 0), [cart]);
  const itemsCount = cart.reduce((s, i) => s + i.qty, 0);

  const deliveryValid = name.trim().length >= 2 && phone.trim().length >= 6 && city && address.trim().length >= 4;

  const handleConfirm = async () => {
    if (!deliveryValid) return;
    setSubmitting(true);
    const reference = genReference();
    const order = {
      reference,
      created_at: new Date().toISOString(),
      customer: { name, phone, email, city, address, note },
      payment_method: payment,
      items: cart,
      subtotal_eur: subtotal,
      total_eur: subtotal,
      total_fcfa: subtotal * 655,
      status: payment === 'cash' ? 'confirmed' : 'awaiting_payment',
    };
    try {
      // Persist to backend
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('dekk_orders' as any).insert({
        reference,
        customer_name: name,
        customer_phone: phone,
        customer_email: email || null,
        city,
        address,
        note: note || null,
        payment_method: payment,
        items: cart,
        subtotal_eur: Math.round(subtotal),
        total_eur: Math.round(subtotal),
        total_fcfa: Math.round(subtotal * 655),
        status: order.status,
        user_id: session?.user?.id ?? null,
      });
      // Cache for confirmation page (offline fallback)
      localStorage.setItem(`dekk_order_${reference}`, JSON.stringify(order));
      const hist = JSON.parse(localStorage.getItem('dekk_orders') || '[]');
      hist.unshift({ reference, total_eur: subtotal, created_at: order.created_at });
      localStorage.setItem('dekk_orders', JSON.stringify(hist.slice(0, 20)));
      localStorage.setItem('dekk_cart', '[]'); window.dispatchEvent(new Event('dekk:cart'));
    } catch (e) {
      console.error('Order persist failed', e);
    }
    setTimeout(() => nav(`/panier/confirmation/${reference}`, { replace: true }), 600);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: '"DM Sans", system-ui, sans-serif', color: DEKK.ink }}>
      <DekkHeader />
      <main className="max-w-5xl mx-auto px-4 md:px-6 pt-6 pb-24">
        <Link to="/panier" style={{ fontSize: 12, color: DEKK.muted, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: '"DM Mono", monospace', letterSpacing: '0.06em' }}>
          <ArrowLeft size={12} /> RETOUR AU PANIER
        </Link>

        <Stepper step={step} />

        <div className="grid lg:grid-cols-[1fr,360px] gap-8 mt-6">
          <div>
            {step === 'delivery' ? (
              <section>
                <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', margin: '0 0 18px' }}>Adresse de livraison</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nom complet *" value={name} onChange={setName} placeholder="Aminata Diop" />
                  <Field label="Téléphone *" value={phone} onChange={setPhone} placeholder="+221 77 000 00 00" type="tel" />
                  <Field label="Email" value={email} onChange={setEmail} placeholder="vous@email.com" type="email" full />
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Label>Ville *</Label>
                    <select value={city} onChange={e => setCity(e.target.value)} style={inputStyle}>
                      {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Label>Adresse complète *</Label>
                    <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Quartier, rue, point de repère…"
                      style={{ ...inputStyle, minHeight: 80, resize: 'vertical', paddingTop: 12 }} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Label>Note pour la livraison (optionnel)</Label>
                    <input value={note} onChange={e => setNote(e.target.value)} placeholder="Étage, sonnerie, instructions…" style={inputStyle} />
                  </div>
                </div>
                <button onClick={() => setStep('payment')} disabled={!deliveryValid}
                  style={{ ...primaryBtn, marginTop: 22, opacity: deliveryValid ? 1 : 0.4, cursor: deliveryValid ? 'pointer' : 'not-allowed' }}>
                  Continuer vers le paiement →
                </button>
              </section>
            ) : (
              <section>
                <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', margin: '0 0 6px' }}>Mode de paiement</h2>
                <p style={{ fontSize: 12, color: DEKK.muted, margin: '0 0 18px' }}>Choisissez comment régler votre commande.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {PAY_METHODS.map(m => {
                    const Icon = m.icon;
                    const selected = payment === m.id;
                    return (
                      <button key={m.id} type="button" onClick={() => setPayment(m.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                          background: '#fff', cursor: 'pointer', textAlign: 'left',
                          border: `1.5px solid ${selected ? DEKK.ink : DEKK.line}`, borderRadius: 12,
                          transition: 'border-color 150ms',
                        }}>
                        <span style={{ width: 38, height: 38, borderRadius: 10, background: selected ? DEKK.ink : DEKK.accentSoft, color: selected ? '#fff' : DEKK.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon size={18} />
                        </span>
                        <span style={{ flex: 1 }}>
                          <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{m.label}</span>
                          <span style={{ display: 'block', fontSize: 11, color: DEKK.muted, fontFamily: '"DM Mono", monospace', marginTop: 2 }}>{m.sub}</span>
                        </span>
                        <span style={{ width: 20, height: 20, borderRadius: 10, border: `1.5px solid ${selected ? DEKK.ink : DEKK.line}`, background: selected ? DEKK.ink : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                          {selected && <Check size={12} />}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginTop: 18, padding: 14, background: DEKK.accentSoft, borderRadius: 12, fontSize: 12, color: DEKK.ink, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <ShieldCheck size={16} color={DEKK.accent} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>Vos informations sont chiffrées. Aucun débit n'est effectué tant que vous n'avez pas confirmé.</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-5">
                  <button onClick={() => setStep('delivery')} style={ghostBtn}>← Modifier la livraison</button>
                  <button onClick={handleConfirm} disabled={submitting}
                    style={{ ...primaryBtn, flex: 1, opacity: submitting ? 0.6 : 1 }}>
                    {submitting ? 'Confirmation…' : `Confirmer la commande · ${fmtEur(subtotal)}`}
                  </button>
                </div>
              </section>
            )}
          </div>

          {/* Order summary */}
          <aside style={{ alignSelf: 'start', position: 'sticky', top: 20, border: `1px solid ${DEKK.line}`, borderRadius: 16, padding: 20, background: '#FAFAFA' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Votre commande ({itemsCount})</div>
            <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 14 }}>
              {cart.map(item => (
                <div key={item.product.id} style={{ display: 'flex', gap: 10, padding: '8px 0' }}>
                  <div style={{ position: 'relative', width: 52, height: 52, borderRadius: 8, background: '#fff', overflow: 'hidden', flexShrink: 0 }}>
                    {item.product.image_url && <img src={item.product.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    <span style={{ position: 'absolute', top: -4, right: -4, background: DEKK.ink, color: '#fff', fontSize: 9, fontWeight: 700, width: 18, height: 18, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.qty}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
                    <div style={{ fontWeight: 500, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.product.name}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, alignSelf: 'center' }}>
                    {fmtEur(item.product.price_eur * item.qty)}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: `0.5px solid ${DEKK.line}`, paddingTop: 12 }}>
              <SummaryRow label="Sous-total" value={fmtEur(subtotal)} />
              <SummaryRow label="Livraison" value={<span style={{ color: '#0E7A4F', fontWeight: 600 }}>Incluse</span>} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Total</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{fmtEur(subtotal)}</div>
                  <div style={{ fontSize: 10, color: DEKK.muted, fontFamily: '"DM Mono", monospace' }}>≈ {fmtFcfa(subtotal * 655)}</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Stepper({ step }: { step: 'delivery' | 'payment' }) {
  const steps = [
    { id: 'cart', label: 'Panier', done: true },
    { id: 'delivery', label: 'Livraison', done: step === 'payment' },
    { id: 'payment', label: 'Paiement', done: false },
    { id: 'confirm', label: 'Confirmation', done: false },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, fontSize: 11, fontFamily: '"DM Mono", monospace', letterSpacing: '0.08em', textTransform: 'uppercase', flexWrap: 'wrap' }}>
      {steps.map((s, i) => {
        const active = (step === 'delivery' && s.id === 'delivery') || (step === 'payment' && s.id === 'payment');
        const done = s.done || (step === 'payment' && s.id === 'delivery');
        return (
          <div key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 22, height: 22, borderRadius: 11,
              background: active ? DEKK.ink : done ? DEKK.accent : '#fff',
              color: active || done ? '#fff' : DEKK.muted,
              border: active || done ? 'none' : `1px solid ${DEKK.line}`,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
            }}>{done ? <Check size={11} /> : i + 1}</span>
            <span style={{ color: active || done ? DEKK.ink : DEKK.muted }}>{s.label}</span>
            {i < steps.length - 1 && <span style={{ color: DEKK.line }}>—</span>}
          </div>
        );
      })}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: DEKK.ink, marginBottom: 6 }}><span style={{ color: DEKK.muted }}>{label}</span><span>{value}</span></div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 11, fontFamily: '"DM Mono", monospace', color: DEKK.muted, letterSpacing: '0.06em', marginBottom: 6 }}>{children}</label>;
}
function Field({ label, value, onChange, placeholder, type = 'text', full }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : undefined }}>
      <Label>{label}</Label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 46, padding: '0 14px', fontSize: 14, color: DEKK.ink,
  background: '#fff', border: `1px solid ${DEKK.line}`, borderRadius: 10, outline: 'none',
  fontFamily: 'inherit',
};
const primaryBtn: React.CSSProperties = {
  minHeight: 52, padding: '0 22px', background: DEKK.ink, color: '#fff',
  border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
const ghostBtn: React.CSSProperties = {
  minHeight: 52, padding: '0 22px', background: '#fff', color: DEKK.ink,
  border: `1px solid ${DEKK.line}`, borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: 'pointer',
};
