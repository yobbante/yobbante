import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Star } from 'lucide-react';
import { toast } from 'sonner';
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
  origin_city: string | null;
  destination_city: string | null;
  estimated_delivery_date: string | null;
  created_at: string;
}

export default function AvisPage() {
  const { trackingId } = useParams();
  useSeo({ title: `Donner mon avis ${trackingId ?? ''} | Yobbanté`, path: `/avis/${trackingId ?? ''}` });

  const [loading, setLoading] = useState(true);
  const [dossier, setDossier] = useState<PublicDossier | null>(null);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!trackingId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('lookup_dossier_public', { p_tracking: trackingId });
      const { data: existsData } = await supabase.rpc('review_exists_for_tracking', { p_tracking: trackingId });
      if (cancelled) return;
      if (!error && data && data.length) setDossier(data[0] as PublicDossier);
      setAlreadyReviewed(Boolean(existsData));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [trackingId]);

  const submit = async () => {
    if (!dossier || rating === 0) {
      toast.error('Sélectionnez une note');
      return;
    }
    setSubmitting(true);
    // need the dossier id — fetch via a public mini-lookup? We don't expose id. Use a secondary RPC.
    const { data: ids } = await supabase
      .from('dossiers')
      .select('id')
      .or(`tracking_id.eq.${trackingId},reference.eq.${trackingId}`)
      .limit(1);
    const dossierId = ids?.[0]?.id;
    if (!dossierId) {
      toast.error('Dossier introuvable');
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.from('customer_reviews').insert({
      dossier_id: dossierId,
      rating,
      comment: comment.trim() || null,
      would_recommend: recommend,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || 'Impossible d’enregistrer l’avis');
      return;
    }
    setSubmitted(true);
    toast.success('Merci pour votre avis !');
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav />
      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
          </div>
        ) : !dossier ? (
          <EmptyState icon={Star} title="Avis non disponible" description="Ce lien n’est pas valide." />
        ) : dossier.status !== 'DELIVERED' ? (
          <EmptyState
            icon={Star}
            title="Avis non disponible"
            description="Vous pourrez laisser un avis dès que votre colis sera livré."
          />
        ) : alreadyReviewed || submitted ? (
          <div className="surface-card text-center py-10">
            <div className="text-4xl mb-3">🙏</div>
            <h2 className="mb-2">Merci pour votre avis !</h2>
            <p className="text-muted-foreground text-sm">
              Votre retour aide Yobbanté à mieux servir la diaspora.
            </p>
          </div>
        ) : (
          <div className="surface-card">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              {dossier.tracking_id || dossier.reference}
            </p>
            <h2 className="mt-1 mb-1">Comment s’est passée votre livraison ?</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {dossier.origin_country} → {dossier.destination_country}
              {dossier.estimated_delivery_date && ` · livré ${new Date(dossier.estimated_delivery_date).toLocaleDateString('fr-FR')}`}
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Votre note</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(n)}
                    className="p-1"
                    aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
                  >
                    <Star
                      className="w-8 h-8 transition-colors"
                      fill={(hoverRating || rating) >= n ? '#F5C518' : 'transparent'}
                      stroke={(hoverRating || rating) >= n ? '#F5C518' : 'currentColor'}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Commentaire (optionnel)</label>
              <textarea
                className="input-base w-full"
                rows={4}
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Dites-nous ce qui a marqué cette expérience…"
                maxLength={1000}
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Recommanderiez-vous Yobbanté ?</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`btn-cta flex-1 ${recommend === true ? '' : 'opacity-60'}`}
                  onClick={() => setRecommend(true)}
                >
                  Oui
                </button>
                <button
                  type="button"
                  className={`btn-cta flex-1 ${recommend === false ? '' : 'opacity-60'}`}
                  onClick={() => setRecommend(false)}
                >
                  Non
                </button>
              </div>
            </div>

            <button className="btn-cta w-full" onClick={submit} disabled={submitting || rating === 0}>
              {submitting ? 'Envoi…' : 'Envoyer mon avis'}
            </button>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
