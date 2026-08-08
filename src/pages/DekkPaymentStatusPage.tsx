import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Clock, RefreshCw, ArrowLeft, AlertTriangle } from 'lucide-react';
import { DekkHeader } from '@/components/dekk/DekkHeader';

type PayInfo = {
  reference: string;
  total_fcfa: number;
  payment_status: string;
  payment_method: string | null;
  payment_external_id: string | null;
  paid_at: string | null;
  status: string;
  created_at: string;
};

const PAY_LABEL: Record<string, string> = {
  wave: 'Wave', om: 'Orange Money', card: 'Carte bancaire', cash: 'À la livraison',
};

const WHATSAPP = 'https://wa.me/221781234567';

export default function DekkPaymentStatusPage() {
  const { reference = '' } = useParams<{ reference: string }>();
  const [sp] = useSearchParams();
  const [info, setInfo] = useState<PayInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('dekk_order_payment_status' as any, { _reference: reference });
    const row = Array.isArray(data) ? (data[0] as PayInfo | undefined) : (data as PayInfo | undefined);
    setLoading(false);
    if (!row) { setNotFound(true); return; }
    setNotFound(false);
    setInfo(row);
    return row;
  }, [reference]);

  useEffect(() => { load(); }, [load]);

  // Poll while pending (IPN can take a few seconds), stop after 2 minutes.
  useEffect(() => {
    if (!info || info.payment_status === 'paid') return;
    if (elapsed >= 120) return;
    timer.current = window.setTimeout(async () => {
      setElapsed(e => e + 5);
      await load();
    }, 5000);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [info, elapsed, load]);

  async function retryPayment() {
    setRetrying(true);
    try {
      const { data } = await supabase.functions.invoke('dekk-payment', {
        body: { reference, origin: window.location.origin },
      });
      if (data?.redirect_url) { window.location.href = data.redirect_url as string; return; }
    } catch { /* fallback below */ }
    setRetrying(false);
  }

  const paid = info?.payment_status === 'paid';
  const canceled = sp.get('cancel') === '1';
  const ipnLate = !paid && elapsed >= 60;

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: '"DM Sans", system-ui, sans-serif', color: '#12130F' }}>
      <DekkHeader />
      <main className="max-w-xl mx-auto px-4 md:px-6 pt-8 pb-24">
        <Link to="/boutique" style={{ fontSize: 12, color: '#7A7C74', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: '"DM Mono", monospace', letterSpacing: '0.06em' }}>
          <ArrowLeft size={12} /> RETOUR À LA BOUTIQUE
        </Link>

        <h1 style={{ fontSize: 24, fontWeight: 600, margin: '18px 0 4px' }}>Suivi du paiement</h1>
        <p style={{ fontSize: 13, color: '#7A7C74', margin: 0 }}>Commande {reference}</p>

        {loading ? (
          <p style={{ marginTop: 28, fontSize: 14, color: '#7A7C74' }}>Chargement…</p>
        ) : notFound ? (
          <div style={{ marginTop: 24, border: '1px solid #EDEDE7', borderRadius: 14, padding: 20 }}>
            <AlertTriangle size={18} color="#8B5220" />
            <p style={{ fontSize: 14, marginTop: 8 }}>Aucune commande trouvée pour cette référence.</p>
            <a href={WHATSAPP} style={{ fontSize: 13, color: '#085041' }}>Contacter le support</a>
          </div>
        ) : info && (
          <>
            <div style={{
              marginTop: 24, borderRadius: 16, padding: 20,
              background: paid ? '#E1F5EE' : '#FBF3E7',
              border: `1px solid ${paid ? '#B9E5D6' : '#F0DFC4'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {paid ? <CheckCircle2 size={22} color="#085041" /> : <Clock size={22} color="#8B5220" />}
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 16, color: paid ? '#085041' : '#8B5220' }}>
                    {paid ? 'Paiement confirmé' : canceled ? 'Paiement annulé' : 'Paiement en attente'}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#5F6158' }}>
                    {paid
                      ? `Réglé le ${new Date(info.paid_at ?? info.created_at).toLocaleString('fr-FR')}`
                      : 'Nous vérifions la confirmation de votre opérateur…'}
                  </p>
                </div>
              </div>
            </div>

            <dl style={{ marginTop: 20, border: '1px solid #EDEDE7', borderRadius: 14, overflow: 'hidden' }}>
              <Row label="Montant" value={`${info.total_fcfa.toLocaleString('fr-FR')} FCFA`} strong />
              <Row label="Moyen de paiement" value={PAY_LABEL[info.payment_method ?? ''] ?? info.payment_method ?? '—'} />
              <Row label="Référence PayTech" value={info.payment_external_id ?? '—'} mono />
              <Row label="Statut commande" value={info.status} />
            </dl>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
              <button
                onClick={() => { setElapsed(0); load(); }}
                style={btn('#12130F', '#fff')}
              >
                <RefreshCw size={14} /> Actualiser
              </button>
              {!paid && (
                <button onClick={retryPayment} disabled={retrying} style={btn('#fff', '#12130F', true)}>
                  {retrying ? 'Redirection…' : 'Reprendre le paiement'}
                </button>
              )}
              <Link to={`/panier/confirmation/${reference}`} style={{ ...btn('#fff', '#12130F', true), textDecoration: 'none' }}>
                Voir la commande
              </Link>
            </div>

            {ipnLate && (
              <div style={{ marginTop: 18, border: '1px dashed #E0D8C6', borderRadius: 14, padding: 16, background: '#FCFBF7' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>La confirmation tarde ?</p>
                <p style={{ margin: '6px 0 10px', fontSize: 13, color: '#5F6158', lineHeight: 1.5 }}>
                  Si vous avez déjà payé, votre commande sera validée manuellement par notre équipe.
                  Envoyez-nous la référence <strong>{info.payment_external_id ?? reference}</strong> avec la capture de votre paiement.
                </p>
                <a href={`${WHATSAPP}?text=${encodeURIComponent(`Bonjour, paiement Dëkk ${info.payment_external_id ?? reference} — ${info.total_fcfa} FCFA, statut toujours en attente.`)}`}
                   style={{ fontSize: 13, fontWeight: 600, color: '#085041' }}>
                  Nous écrire sur WhatsApp →
                </a>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Row({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderBottom: '1px solid #F3F3EE' }}>
      <dt style={{ fontSize: 13, color: '#7A7C74' }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: strong ? 15 : 13, fontWeight: strong ? 600 : 500, fontFamily: mono ? '"DM Mono", monospace' : undefined, textAlign: 'right', wordBreak: 'break-all' }}>{value}</dd>
    </div>
  );
}

const btn = (bg: string, fg: string, outline = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: bg, color: fg, border: outline ? '1px solid #DDDDD5' : 'none',
  borderRadius: 999, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
});
