import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { EmptyState } from '@/components/EmptyState';
import { useSeo } from '@/hooks/useSeo';
import { getDeliveryDelay, getArrivalFromDeparture, type DeliveryMode } from '@/lib/deliveryDelays';
import { PublicDepartureConfirm } from '@/components/dossier/PublicDepartureConfirm';

interface TimelineEvent {
  status: 'done' | 'current' | 'pending';
  label: string;
  date: string | null;
  note?: string | null;
}

interface TrackResponse {
  tracking_number: string;
  status: string;
  status_label: string;
  origin_city: string | null;
  destination_city: string | null;
  weight_kg: number | null;
  departure_date: string | null;
  eta: string | null;
  transport_type: string | null;
  priority: string | null;
  total_cost: number | null;
  timeline: TimelineEvent[];
  source: 'db' | 'db+konnekt';
}

const STATUS_BADGE: Record<string, string> = {
  CONFIRMED: 'badge-success',
  MATCHED: 'badge-success',
  IN_PREPARATION: 'badge-warning',
  IN_TRANSIT: 'badge-success',
  CUSTOMS: 'badge-warning',
  ARRIVED: 'badge-success',
  OUT_FOR_DELIVERY: 'badge-success',
  DELIVERED: 'badge-success',
  ON_HOLD: 'badge-warning',
  CANCELLED: 'badge-danger',
  RETURN_REQUESTED: 'badge-warning',
  RETURN_IN_PROGRESS: 'badge-warning',
  RETURNED: 'badge-danger',
};

const IS_LIFECYCLE_END = (s: string) =>
  s === 'CANCELLED' || s === 'RETURNED' || s === 'RETURN_REQUESTED' || s === 'RETURN_IN_PROGRESS';

export default function TrackPage() {
  useSeo({
    title: 'Suivre mon colis | Yobbanté',
    description: 'Suivez votre colis Yobbanté en temps réel grâce à votre numéro de suivi.',
    path: '/track',
  });
  const { id } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [data, setData] = useState<TrackResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retries, setRetries] = useState(0);
  const [copied, setCopied] = useState(false);

  const copyTracking = (tn: string) => {
    navigator.clipboard?.writeText(tn).then(() => {
      setCopied(true);
      toast.success('Copié ✓');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => toast.error('Impossible de copier'));
  };


  useEffect(() => {
    document.title = id ? `Yobbanté · Suivi ${id}` : 'Yobbanté · Suivre mon colis';
  }, [id]);

  useEffect(() => {
    if (!id) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    // Filet de sécurité : si rien ne répond après 8s, on sort du loader.
    const hardTimeout = setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      setLoading(false);
      setError('Impossible de charger le suivi. Vérifiez votre connexion.');
    }, 8000);

    const load = async (attempt = 0) => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-shipment?tracking_number=${encodeURIComponent(id)}`;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        const r = await fetch(url, {
          signal: ctrl.signal,
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        });
        clearTimeout(t);
        const json = await r.json().catch(() => ({} as any));
        if (cancelled) return;
        if (!r.ok) {
          // 404 → colis introuvable, pas de retry inutile
          if (r.status === 404) {
            throw new Error('NOT_FOUND');
          }
          if (attempt < 2) {
            setTimeout(() => load(attempt + 1), 800 * (attempt + 1));
            return;
          }
          throw new Error(json?.error || `HTTP ${r.status}`);
        }
        if (!json || !json.tracking_number) {
          throw new Error('NOT_FOUND');
        }
        setData(json as TrackResponse);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        const msg = (e as Error).message || 'Suivi indisponible';
        setError(msg === 'NOT_FOUND' ? 'NOT_FOUND' : msg);
      } finally {
        if (!cancelled) {
          clearTimeout(hardTimeout);
          setLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; clearTimeout(hardTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, retries]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav />

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-6">
        {!id ? (
          <div className="surface-card max-w-[480px] mx-auto">
            <h2 className="mb-3">Suivre mon colis</h2>
            <input
              className="input-base w-full mb-3"
              placeholder="YOB-XXXXXX ou YBT-AAAA-XXXX"
              value={input}
              onChange={e => setInput(e.target.value)}
              style={{ height: 40 }}
            />
            <p className="text-[11px] text-muted-foreground mb-3">
              Les deux formats sont acceptés : référence suivi (YOB-…) ou référence commande (YBT-…).
            </p>
            <button
              className="btn-cta w-full"
              onClick={() => input.trim() && navigate(`/track/${input.trim()}`)}
            >
              Suivre →
            </button>
          </div>
        ) : loading && !data ? (
          <div className="flex items-center justify-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Chargement du suivi…
          </div>
        ) : error && !data ? (
          <EmptyState
            icon={Search}
            title={error === 'NOT_FOUND' ? 'Colis introuvable' : 'Suivi indisponible'}
            description={
              error === 'NOT_FOUND'
                ? "Aucun colis ne correspond à ce numéro de suivi. Vérifiez l'identifiant (YOB-XXXXXX ou YBT-AAAA-XXXX) et réessayez."
                : `Impossible de charger le suivi. Vérifiez votre connexion. (${error})`
            }
            ctaLabel="Réessayer"
            onCta={() => setRetries(r => r + 1)}
            secondaryLabel="Retour à l'accueil"
            onSecondary={() => navigate('/')}
          />
        ) : data ? (
          <>
            <PublicDepartureConfirm tracking={data.tracking_number} />
            <div
              className="rounded-[12px] p-5 mb-5 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-start sm:justify-between"
              style={{ background: 'hsl(var(--secondary))' }}
            >
              <div>
                <button
                  type="button"
                  onClick={() => copyTracking(data.tracking_number)}
                  className="text-label font-mono cursor-pointer"
                  style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
                  title="Copier le numéro"
                >
                  {copied ? 'Copié ✓' : data.tracking_number}
                </button>
                <h2 className="mt-1">
                  {data.origin_city || '—'} → {data.destination_city || '—'}
                </h2>
                <p className="text-[13px] mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {data.weight_kg ? `${data.weight_kg} kg · ` : ''}
                  {data.transport_type || ''}
                  {data.departure_date ? ` · Départ ${new Date(data.departure_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : ''}
                </p>
                {(() => {
                  const mode: DeliveryMode = data.priority === 'express' ? 'express' : 'standard';
                  if (data.departure_date && data.destination_city) {
                    const a = getArrivalFromDeparture(data.departure_date, data.destination_city, mode);
                    return (
                      <p className="text-[12px] mt-1" style={{ color: 'hsl(var(--foreground))' }}>
                        Arrivée estimée le <strong>{a.arrivalLabel}</strong> <span style={{ color: 'hsl(var(--text-tertiary))' }}>(estimation)</span>
                      </p>
                    );
                  }
                  if (data.destination_city) {
                    const a = getDeliveryDelay(data.destination_city, mode);
                    return (
                      <p className="text-[12px] mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                        Délai estimé : <strong>{a.label}</strong> après le départ
                      </p>
                    );
                  }
                  return null;
                })()}
                {data.source === 'db+konnekt' && (
                  <p className="text-[10px] mt-1" style={{ color: '#1D9E75' }}>● Suivi en temps réel · Konnekt</p>
                )}
              </div>
              <div className="flex items-start gap-2">
                <span className={STATUS_BADGE[data.status] || 'badge-success'} style={{ fontSize: 12, padding: '4px 14px' }}>
                  {data.status_label}
                </span>
                <button
                  onClick={() => setRetries(r => r + 1)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Rafraîchir"
                  style={{ padding: 6 }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <ol>
              {data.timeline.map((e, i) => {
                const isLast = i === data.timeline.length - 1;
                const dotStyle =
                  e.status === 'done'
                    ? { background: '#1D9E75' }
                    : e.status === 'current'
                      ? { background: 'hsl(var(--foreground))' }
                      : { background: 'transparent', border: '1.5px solid hsl(var(--color-border-tertiary))' };
                return (
                  <li key={i} className="flex gap-3.5 mb-4">
                    <div className="flex flex-col items-center">
                      <span className="rounded-full" style={{ width: 10, height: 10, marginTop: 3, ...dotStyle }} />
                      {!isLast && (
                        <span style={{ width: 1, minHeight: 28, flex: 1, background: 'hsl(var(--color-border-tertiary))' }} />
                      )}
                    </div>
                    <div className="flex-1 pb-1">
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: e.status === 'pending' ? 400 : 500,
                          color: e.status === 'pending' ? 'hsl(var(--text-tertiary))' : 'hsl(var(--foreground))',
                        }}
                      >
                        {e.label}
                      </div>
                      <div className="mt-0.5" style={{ fontSize: 12, color: 'hsl(var(--text-tertiary))' }}>
                        {e.date || (e.status === 'pending' ? 'À venir' : '—')}
                      </div>
                      {e.note && (
                        <div className="mt-1 text-[12px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{e.note}</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        ) : null}
      </main>

      <PublicFooter />
    </div>
  );
}
