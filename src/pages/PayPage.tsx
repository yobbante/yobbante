import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Loader2, CreditCard, Smartphone, CheckCircle2, XCircle, Scale, MapPin, MessageCircle, Truck } from 'lucide-react';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { EmptyState } from '@/components/EmptyState';
import { supabase } from '@/integrations/supabase/client';
import { useSeo } from '@/hooks/useSeo';
import { toast } from 'sonner';

interface PublicDossier {
  id?: string;
  tracking_id: string;
  reference: string;
  status: string;
  payment_status: string;
  origin_country: string | null;
  destination_country: string | null;
  estimated_weight: number | null;
  estimated_cost: number | null;
  actual_weight_kg: number | null;
  final_amount_xof: number | null;
  cash_on_delivery: boolean | null;
  assigned_transporteur_ref: string | null;
  weighed_at: string | null;
  paid_at: string | null;
  created_at: string;
}

const SUPPORT_PHONE = '+221 78 460 4003';
const SUPPORT_TEL = '+221784604003';

export default function PayPage() {
  const { trackingId } = useParams();
  const [params] = useSearchParams();
  const successFlag = params.get('success') === '1';
  const errorFlag = params.get('error') === '1';

  useSeo({ title: `Paiement ${trackingId ?? ''} | Yobbanté`, path: `/pay/${trackingId ?? ''}` });

  const [loading, setLoading] = useState(true);
  const [dossier, setDossier] = useState<PublicDossier | null>(null);
  const [busy, setBusy] = useState<'wave' | 'om' | 'cod' | null>(null);

  useEffect(() => {
    if (!trackingId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc('lookup_dossier_public', { p_tracking: trackingId });
      if (cancelled) return;
      if (data && data.length) setDossier(data[0] as PublicDossier);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [trackingId]);

  const amountXof = dossier?.final_amount_xof
    ?? (dossier?.estimated_cost ? Math.round(dossier.estimated_cost * 655.957) : null);

  async function payWith(provider: 'wave' | 'om') {
    if (!trackingId) return;
    setBusy(provider);
    try {
      const fn = provider === 'wave' ? 'create-wave-payment' : 'create-om-payment';
      const { data, error } = await supabase.functions.invoke(fn, { body: { tracking_id: trackingId } });
      if (error) throw error;
      if (data?.available === false) {
        toast.info(
          provider === 'wave'
            ? `Wave disponible bientôt. Contactez-nous : ${SUPPORT_PHONE}`
            : `Orange Money disponible bientôt. Contactez-nous : ${SUPPORT_PHONE}`,
        );
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      toast.error('Réponse de paiement invalide. Réessayez.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur de paiement');
    } finally {
      setBusy(null);
    }
  }

  async function payOnDelivery() {
    if (!trackingId || !dossier) return;
    setBusy('cod');
    try {
      const { data, error } = await supabase.rpc('set_dossier_cod_public', { p_tracking: trackingId });
      if (error) throw error;
      if (data !== true) throw new Error('Impossible de confirmer le paiement à la livraison');


      const ref = dossier.tracking_id || dossier.reference;
      // Notif admin (best-effort)
      supabase.functions.invoke('send-whatsapp', { body: {
        recipient_type: 'admin', recipient_phone: SUPPORT_TEL,
        message: `Paiement livraison choisi pour ${ref} - ${amountXof ?? '?'} XOF`,
        trigger_type: 'cod_chosen',
      }}).catch(() => {});

      toast.success('Paiement à la livraison confirmé. Votre colis prendra la route.');
      setDossier({ ...dossier, cash_on_delivery: true, payment_status: 'pending_delivery' });
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav />
      <main className="flex-1 max-w-xl w-full mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
          </div>
        ) : !dossier ? (
          <EmptyState icon={CreditCard} title="Lien invalide" description="Ce lien de paiement n’est pas valide." />
        ) : successFlag || dossier.payment_status === 'paid' ? (
          <SuccessCard trackingId={dossier.tracking_id || dossier.reference} />
        ) : errorFlag ? (
          <ErrorCard trackingId={dossier.tracking_id || dossier.reference} />
        ) : dossier.cash_on_delivery || dossier.payment_status === 'pending_delivery' || dossier.payment_status === 'not_required' ? (
          <div className="surface-card text-center py-10">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: '#F5C518' }} />
            <h2 className="mb-2">Paiement à la livraison</h2>
            <p className="text-muted-foreground text-sm">
              Vous réglerez {amountXof ? `${amountXof.toLocaleString('fr-FR')} XOF ` : ''}directement au GP à la livraison.
            </p>
            <Link to={`/suivre/${dossier.tracking_id || dossier.reference}`} className="btn-cta inline-flex items-center gap-2 mt-4">
              <Truck className="w-4 h-4" /> Suivre mon colis
            </Link>
          </div>
        ) : (
          <div className="surface-card">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              {dossier.tracking_id || dossier.reference}
            </p>
            <h2 className="mt-1 mb-4">Régler votre colis</h2>

            <div className="rounded-[12px] p-4 mb-6 space-y-2" style={{ background: 'hsl(var(--secondary))' }}>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Trajet</span>
                <span>{dossier.origin_country} → {dossier.destination_country}</span>
              </div>
              {dossier.actual_weight_kg && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1"><Scale className="w-3.5 h-3.5" /> Poids réel</span>
                  <span>{dossier.actual_weight_kg} kg</span>
                </div>
              )}
              {dossier.assigned_transporteur_ref && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">GP assigné</span>
                  <span className="font-mono text-xs">{dossier.assigned_transporteur_ref}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 mt-2 border-t" style={{ borderColor: 'hsl(var(--border))' }}>
                <span className="font-medium">Montant à payer</span>
                <span className="font-bold text-2xl" style={{ color: '#F5C518' }}>
                  {amountXof ? `${amountXof.toLocaleString('fr-FR')} XOF` : '—'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => payWith('wave')}
                disabled={!!busy}
                className="btn-cta w-full flex items-center justify-center gap-2"
              >
                {busy === 'wave' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                Payer avec Wave
              </button>
              <button
                onClick={() => payWith('om')}
                disabled={!!busy}
                className="btn-cta w-full flex items-center justify-center gap-2"
              >
                {busy === 'om' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                Payer avec Orange Money
              </button>
              <button
                onClick={payOnDelivery}
                disabled={!!busy}
                className="w-full flex items-center justify-center gap-2 rounded-[12px] py-3 border font-medium transition hover:bg-secondary"
                style={{ borderColor: 'hsl(var(--border))' }}
              >
                {busy === 'cod' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                Payer à la livraison
              </button>
            </div>

            <p className="text-xs text-center text-muted-foreground mt-4">
              Besoin d’aide ? Appelez le <a href={`tel:${SUPPORT_TEL}`} className="underline">{SUPPORT_PHONE}</a>.
            </p>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

function SuccessCard({ trackingId }: { trackingId: string }) {
  return (
    <div className="surface-card text-center py-10">
      <CheckCircle2 className="w-16 h-16 mx-auto mb-4" style={{ color: '#1D9E75' }} />
      <h2 className="mb-2">Paiement reçu !</h2>
      <p className="text-muted-foreground text-sm mb-2">
        Votre colis <span className="font-mono">{trackingId}</span> va maintenant prendre la route.
      </p>
      <p className="text-muted-foreground text-sm mb-6">
        Vous recevrez une confirmation WhatsApp dans quelques instants.
      </p>
      <Link to={`/suivre/${trackingId}`} className="btn-cta inline-flex items-center gap-2">
        <Truck className="w-4 h-4" /> Suivre mon colis
      </Link>
    </div>
  );
}

function ErrorCard({ trackingId }: { trackingId: string }) {
  return (
    <div className="surface-card text-center py-10">
      <XCircle className="w-16 h-16 mx-auto mb-4" style={{ color: '#E53E3E' }} />
      <h2 className="mb-2">Paiement non complété</h2>
      <p className="text-muted-foreground text-sm mb-6">Voulez-vous réessayer ?</p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Link to={`/pay/${trackingId}`} className="btn-cta inline-flex items-center justify-center gap-2">
          Réessayer
        </Link>
        <a
          href={`https://wa.me/${SUPPORT_TEL.replace('+', '')}`}
          target="_blank" rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-[12px] py-3 px-5 border font-medium hover:bg-secondary"
          style={{ borderColor: 'hsl(var(--border))' }}
        >
          <MessageCircle className="w-4 h-4" /> Nous contacter
        </a>
      </div>
    </div>
  );
}
