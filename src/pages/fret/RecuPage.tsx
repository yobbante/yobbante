import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useSeo } from '@/hooks/useSeo';
import { fretApi, type FretStatus } from '@/lib/fretApi';

export default function RecuPage() {
  const { token = '' } = useParams();
  useSeo({
    title: 'Confirmer la réception | Yobbanté',
    description: 'Confirmez la bonne réception de votre colis Yobbanté en un clic.',
    path: `/recu/${token}`,
  });

  const [course, setCourse] = useState<{ ref: string; destination: string; client_nom: string | null; status: FretStatus } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fretApi.byConfirmToken(token)
      .then((r) => { if (!cancelled) setCourse(r.course); })
      .catch(() => { if (!cancelled) setError('Lien invalide ou expiré.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const confirm = async () => {
    setSending(true);
    try {
      await fretApi.confirmDelivery(token);
      setCourse((c) => (c ? { ...c, status: 'LIVRE' } : c));
      toast.success('Merci, réception confirmée !');
    } catch (e: any) {
      toast.error(e?.message === 'not_arrived' ? "Le colis n'est pas encore arrivé" : 'Confirmation impossible');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm text-center space-y-6">
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        ) : error || !course ? (
          <p className="text-sm text-muted-foreground">{error ?? 'Colis introuvable.'}</p>
        ) : course.status === 'LIVRE' ? (
          <>
            <CheckCircle2 className="w-14 h-14 mx-auto text-primary" />
            <h1 className="text-2xl font-bold">Réception confirmée</h1>
            <p className="text-sm text-muted-foreground">
              Merci ! Le colis {course.ref} est marqué comme livré. Bonne journée avec Yobbanté.
            </p>
          </>
        ) : (
          <>
            <PackageCheck className="w-14 h-14 mx-auto text-primary" />
            <div className="space-y-1">
              <h1 className="text-2xl font-bold">Votre colis est arrivé</h1>
              <p className="text-sm text-muted-foreground">
                {course.ref} · {course.destination}
              </p>
            </div>
            <Button className="w-full h-14 text-base font-semibold" onClick={confirm} disabled={sending}>
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : "J'ai bien reçu mon colis"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Cliquez seulement après avoir récupéré votre colis.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
