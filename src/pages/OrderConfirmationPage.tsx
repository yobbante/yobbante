import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PublicNav } from '@/components/PublicNav';
import { applySeo } from '@/lib/dekkSeo';
import { recommend, RecProduct } from '@/lib/dekkRecommend';
import { Recommendations } from './CartPage';
import { Check, Copy, MapPin, Package, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const DEKK = { accent: '#C97B3A', accentSoft: '#FBF3EA', ink: '#0E0E0E', line: '#ECECEC', muted: '#6B6B6B' };

const fmtEur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const fmtFcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

const PAY_LABEL: Record<string, string> = {
  wave: 'Wave', om: 'Orange Money', card: 'Carte bancaire', cash: 'Paiement à la livraison',
};

export default function OrderConfirmationPage() {
  const { reference } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [recs, setRecs] = useState<RecProduct[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!reference) return;
    (async () => {
      // Try backend first
      const { data } = await supabase
        .from('dekk_orders' as any)
        .select('*')
        .eq('reference', reference)
        .maybeSingle();
      if (data) {
        const d: any = data;
        setOrder({
          reference: d.reference,
          created_at: d.created_at,
          customer: { name: d.customer_name, phone: d.customer_phone, email: d.customer_email, city: d.city, address: d.address, note: d.note },
          payment_method: d.payment_method,
          items: d.items,
          subtotal_eur: d.subtotal_eur,
          total_eur: d.total_eur,
          total_fcfa: d.total_fcfa,
          status: d.status,
        });
      } else {
        try {
          const raw = localStorage.getItem(`dekk_order_${reference}`);
          if (raw) setOrder(JSON.parse(raw));
        } catch {}
      }
    })();
    applySeo({
      title: `Commande ${reference} confirmée · Dëkk`,
      description: 'Votre commande Dëkk est confirmée. Suivez son acheminement directement depuis votre espace.',
      type: 'website',
    });
  }, [reference]);

  useEffect(() => {
    if (!order) return;
    const cats = [...new Set(order.items.map((i: any) => i.product.category))] as string[];
    const ids = order.items.map((i: any) => i.product.id);
    recommend({ excludeIds: ids, primaryCategory: cats[0], limit: 4 }).then(setRecs);
  }, [order]);

  if (!order) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
        <PublicNav />
        <div className="max-w-2xl mx-auto px-4 py-24 text-center">
          <p style={{ fontSize: 16, fontWeight: 500 }}>Commande introuvable.</p>
          <Link to="/boutique" style={{ display: 'inline-block', marginTop: 14, color: DEKK.accent, fontSize: 14 }}>Retour à la boutique</Link>
        </div>
      </div>
    );
  }

  const itemsCount = order.items.reduce((s: number, i: any) => s + i.qty, 0);

  const copyRef = async () => {
    try { await navigator.clipboard.writeText(order.reference); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: '"DM Sans", system-ui, sans-serif', color: DEKK.ink }}>
      <PublicNav />
      <main className="max-w-3xl mx-auto px-4 md:px-6 pt-10 pb-20">
        {/* Hero */}
        <div style={{ textAlign: 'center', padding: '24px 0 32px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: DEKK.accentSoft, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Check size={28} color={DEKK.accent} strokeWidth={2.5} />
          </div>
          <div style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', color: DEKK.muted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            DËKK · COMMANDE CONFIRMÉE
          </div>
          <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 600, letterSpacing: '-0.02em', margin: '8px 0 6px' }}>
            Merci, {order.customer.name.split(' ')[0]}.
          </h1>
          <p style={{ fontSize: 14, color: DEKK.muted, margin: 0 }}>
            Votre commande a bien été enregistrée. Vous recevrez une notification dès l'expédition.
          </p>
          <button onClick={copyRef}
            style={{ marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 100, background: DEKK.ink, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: '"DM Mono", monospace', letterSpacing: '0.04em' }}>
            {copied ? <><Check size={14} /> COPIÉE</> : <><Copy size={14} /> {order.reference}</>}
          </button>
        </div>

        {/* Tracker */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '20px 4px', borderTop: `0.5px solid ${DEKK.line}`, borderBottom: `0.5px solid ${DEKK.line}` }}>
          {[
            { label: 'Confirmée', done: true },
            { label: 'Préparation', done: false },
            { label: 'En transit', done: false },
            { label: 'Livrée', done: false },
          ].map((s, i, arr) => (
            <div key={s.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              <div style={{ width: 12, height: 12, borderRadius: 6, background: s.done ? DEKK.accent : DEKK.line, marginBottom: 6 }} />
              <span style={{ fontSize: 10, fontFamily: '"DM Mono", monospace', color: s.done ? DEKK.ink : DEKK.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.label}</span>
              {i < arr.length - 1 && <div style={{ position: 'absolute', top: 6, left: '60%', right: '-40%', height: 1, background: DEKK.line }} />}
            </div>
          ))}
        </div>

        {/* Recap grid */}
        <div className="grid sm:grid-cols-2 gap-4 mt-6">
          <Card icon={<MapPin size={14} />} title="Livraison">
            <strong>{order.customer.name}</strong><br />
            {order.customer.address}<br />
            {order.customer.city}, Sénégal
            {order.customer.note && <><br /><span style={{ color: DEKK.muted }}>Note : {order.customer.note}</span></>}
          </Card>
          <Card icon={<Phone size={14} />} title="Contact">
            {order.customer.phone}<br />
            {order.customer.email && <span style={{ color: DEKK.muted }}>{order.customer.email}</span>}
          </Card>
          <Card icon={<Package size={14} />} title="Paiement">
            <strong>{PAY_LABEL[order.payment_method] ?? order.payment_method}</strong><br />
            <span style={{ color: order.status === 'confirmed' ? '#0E7A4F' : DEKK.accent, fontFamily: '"DM Mono", monospace', fontSize: 11, letterSpacing: '0.06em' }}>
              {order.status === 'confirmed' ? 'CONFIRMÉ' : 'EN ATTENTE DE PAIEMENT'}
            </span>
          </Card>
          <Card icon={<Check size={14} />} title="Total">
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{fmtEur(order.total_eur)}</div>
            <div style={{ fontSize: 11, color: DEKK.muted, fontFamily: '"DM Mono", monospace' }}>≈ {fmtFcfa(order.total_fcfa)} · {itemsCount} article{itemsCount > 1 ? 's' : ''}</div>
          </Card>
        </div>

        {/* Items */}
        <div style={{ marginTop: 28, border: `1px solid ${DEKK.line}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: '#FAFAFA', fontSize: 11, fontFamily: '"DM Mono", monospace', color: DEKK.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Articles ({itemsCount})
          </div>
          {order.items.map((item: any) => (
            <div key={item.product.id} style={{ display: 'flex', gap: 12, padding: '14px 16px', borderTop: `0.5px solid ${DEKK.line}` }}>
              <div style={{ width: 56, height: 56, borderRadius: 8, background: '#F6F6F6', overflow: 'hidden', flexShrink: 0 }}>
                {item.product.image_url && <img src={item.product.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{item.product.name}</div>
                <div style={{ fontSize: 11, color: DEKK.muted, fontFamily: '"DM Mono", monospace', marginTop: 4 }}>Qté {item.qty} · {fmtEur(item.product.price_eur)}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, alignSelf: 'center' }}>{fmtEur(item.product.price_eur * item.qty)}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Link to="/boutique" style={{ flex: 1, minHeight: 50, background: DEKK.ink, color: '#fff', borderRadius: 12, fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
            Continuer mes achats
          </Link>
          <Link to="/track" style={{ flex: 1, minHeight: 50, background: '#fff', color: DEKK.ink, border: `1px solid ${DEKK.line}`, borderRadius: 12, fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
            Suivre ma commande
          </Link>
        </div>

        {recs.length > 0 && <Recommendations title="Vous aimerez aussi" items={recs} />}
      </main>
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${DEKK.line}`, borderRadius: 14, padding: 16, background: '#fff' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: '"DM Mono", monospace', color: DEKK.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
        <span style={{ color: DEKK.accent }}>{icon}</span> {title}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}
