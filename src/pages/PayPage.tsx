import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CreditCard, Smartphone, CheckCircle2, Scale, MapPin } from 'lucide-react';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { EmptyState } from '@/components/EmptyState';
import { supabase } from '@/integrations/supabase/client';
import { useSeo } from '@/hooks/useSeo';

interface PublicDossier {
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

export default function PayPage() {
  const { trackingId } = useParams();
  useSeo({ title: `Paiement ${trackingId ?? ''} | Yobbanté`, path: `/pay/${trackingId ?? ''}` });

  const [loading, setLoading] = useState(true);
  const [dossier, setDossier] = useState<PublicDossier | null>(null);

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
        ) : dossier.payment_status === 'paid' ? (
          <div className="surface-card text-center py-10">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: '#1D9E75' }} />
            <h2 className="mb-2">Déjà réglé ✓</h2>
            <p className="text-muted-foreground text-sm">
              Ce colis a déjà été payé. Merci !
            </p>
          </div>
        ) : dossier.cash_on_delivery || dossier.payment_status === 'not_required' ? (
          <div className="surface-card text-center py-10">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: '#F5C518' }} />
            <h2 className="mb-2">Paiement à la livraison</h2>
            <p className="text-muted-foreground text-sm">
              Vous réglerez {amountXof ? `${amountXof.toLocaleString('fr-FR')} XOF ` : ''}directement au GP à la livraison.
            </p>
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
              <button className="btn-cta w-full flex items-center justify-center gap-2" disabled>
                <Smartphone className="w-4 h-4" /> Wave
              </button>
              <button className="btn-cta w-full flex items-center justify-center gap-2" disabled>
                <Smartphone className="w-4 h-4" /> Orange Money
              </button>
              <button className="btn-cta w-full flex items-center justify-center gap-2" disabled>
                <CreditCard className="w-4 h-4" /> Carte bancaire
              </button>
            </div>

            <p className="text-xs text-center text-muted-foreground mt-4">
              Paiement bientôt disponible. Pour régler maintenant, contactez-nous au <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`} className="underline">{SUPPORT_PHONE}</a>.
            </p>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Une fois payé, votre colis prendra la route.
            </p>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
