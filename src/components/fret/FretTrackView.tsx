import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Search, Truck } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { fretApi, FRET_STATUS_LABEL, type FretStatus } from '@/lib/fretApi';

interface FretTrackCourse {
  ref: string;
  destination: string;
  status: FretStatus;
  remis_at: string | null;
  accepted_at: string | null;
  en_route_at: string | null;
  arrived_at: string | null;
  delivered_at: string | null;
}

const STEPS: { status: FretStatus; label: string; key: keyof FretTrackCourse }[] = [
  { status: 'PENDING_ACCEPT', label: 'Colis remis au garage', key: 'remis_at' },
  { status: 'REMIS_CHAUFFEUR', label: 'Pris en charge par le chauffeur', key: 'accepted_at' },
  { status: 'EN_ROUTE', label: 'En route vers la destination', key: 'en_route_at' },
  { status: 'ARRIVE', label: 'Arrivé à destination', key: 'arrived_at' },
  { status: 'LIVRE', label: 'Livré au client', key: 'delivered_at' },
];

const ORDER: FretStatus[] = ['PENDING_ACCEPT', 'REMIS_CHAUFFEUR', 'EN_ROUTE', 'ARRIVE', 'LIVRE'];

function fmt(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return null; }
}

/** Suivi public d'une course de fret routier interne (réf. YBR-XXXXXX). */
export function FretTrackView({ trackingRef, onReset }: { trackingRef: string; onReset: () => void }) {
  const [course, setCourse] = useState<FretTrackCourse | null>(null);
  const [chauffeur, setChauffeur] = useState<{ nom_complet: string | null; immatriculation: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fretApi.track(trackingRef);
      setCourse(r.course as unknown as FretTrackCourse);
      setChauffeur(r.chauffeur);
      setNotFound(false);
    } catch {
      setNotFound(true);
      setCourse(null);
    } finally {
      setLoading(false);
    }
  }, [trackingRef]);

  useEffect(() => { load(); }, [load]);

  if (loading && !course) {
    return (
      <div className="flex items-center justify-center gap-3 py-20 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /> Chargement du suivi…
      </div>
    );
  }

  if (notFound || !course) {
    return (
      <EmptyState
        icon={Search}
        title="Colis introuvable"
        description={`Aucune course de fret routier ne correspond à la référence ${trackingRef}.`}
        ctaLabel="Réessayer"
        onCta={load}
        secondaryLabel="Nouvelle recherche"
        onSecondary={onReset}
      />
    );
  }

  const isCancelled = course.status === 'ANNULE';
  const currentIndex = ORDER.indexOf(course.status);

  return (
    <>
      <div
        className="rounded-[12px] p-5 mb-5 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-start sm:justify-between"
        style={{ background: 'hsl(var(--secondary))' }}
      >
        <div>
          <span className="text-label font-mono" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {course.ref}
          </span>
          <h2 className="mt-1">Dakar → {course.destination}</h2>
          <p className="text-[13px] mt-1 flex items-center gap-1.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
            <Truck className="w-3.5 h-3.5" /> Fret routier Yobbanté
            {chauffeur?.nom_complet ? ` · ${chauffeur.nom_complet}` : ''}
            {chauffeur?.immatriculation ? ` (${chauffeur.immatriculation})` : ''}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <span
            className={isCancelled ? 'badge-danger' : course.status === 'LIVRE' ? 'badge-success' : 'badge-warning'}
            style={{ fontSize: 12, padding: '4px 14px' }}
          >
            {FRET_STATUS_LABEL[course.status]}
          </span>
          <button onClick={load} className="text-muted-foreground hover:text-foreground" aria-label="Rafraîchir" style={{ padding: 6 }}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isCancelled ? (
        <div className="rounded-[12px] border p-5 mb-5" style={{ borderColor: '#ef4444', background: 'hsl(var(--card))' }}>
          <div className="text-sm font-semibold mb-1">Course annulée</div>
          <p className="text-[13px] text-muted-foreground">
            Cette course a été annulée. Contactez-nous pour organiser un nouvel acheminement.
          </p>
        </div>
      ) : (
        <ol>
          {STEPS.map((s, i) => {
            const isLast = i === STEPS.length - 1;
            const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'pending';
            const date = fmt(course[s.key] as string | null);
            const dotStyle =
              state === 'done'
                ? { background: '#1D9E75' }
                : state === 'current'
                  ? { background: 'hsl(var(--foreground))' }
                  : { background: 'transparent', border: '1.5px solid hsl(var(--color-border-tertiary))' };
            return (
              <li key={s.status} className="flex gap-3.5 mb-4">
                <div className="flex flex-col items-center">
                  <span className="rounded-full" style={{ width: 10, height: 10, marginTop: 3, ...dotStyle }} />
                  {!isLast && <span style={{ width: 1, minHeight: 28, flex: 1, background: 'hsl(var(--color-border-tertiary))' }} />}
                </div>
                <div className="flex-1 pb-1">
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: state === 'pending' ? 400 : 500,
                      color: state === 'pending' ? 'hsl(var(--text-tertiary))' : 'hsl(var(--foreground))',
                    }}
                  >
                    {s.label}
                  </div>
                  <div className="mt-0.5" style={{ fontSize: 12, color: 'hsl(var(--text-tertiary))' }}>
                    {date || (state === 'pending' ? 'À venir' : '—')}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {course.status === 'ARRIVE' && (
        <p className="text-[13px] text-muted-foreground mt-2">
          Votre colis est arrivé. Confirmez la réception via le lien reçu par WhatsApp dès que vous l'avez récupéré.
        </p>
      )}
    </>
  );
}
