import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, LogOut, MapPin, Package, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSeo } from '@/hooks/useSeo';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import {
  FRET_NEXT_ACTION,
  FRET_STATUS_LABEL,
  FRET_TOKEN_KEY,
  fretApi,
  type FretChauffeur,
  type FretCourse,
} from '@/lib/fretApi';

/** Ajoute le manifest dédié chauffeur pour rendre l'écran installable. */
function useChauffeurManifest() {
  useEffect(() => {
    const existing = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const previous = existing?.getAttribute('href') ?? null;
    if (existing) existing.setAttribute('href', '/chauffeur.webmanifest');
    return () => {
      if (existing && previous) existing.setAttribute('href', previous);
    };
  }, []);
}

function LoginScreen({ onSuccess }: { onSuccess: (t: string, c: FretChauffeur) => void }) {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fretApi.login(phone, pin);
      localStorage.setItem(FRET_TOKEN_KEY, res.token);
      onSuccess(res.token, res.chauffeur);
    } catch (err: any) {
      toast.error(err?.message === 'invalid_credentials' ? 'Numéro ou code PIN incorrect' : 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-5 py-10 bg-background">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Truck className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Espace chauffeur</h1>
          <p className="text-sm text-muted-foreground">Connectez-vous avec votre numéro et votre code à 4 chiffres.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Numéro de téléphone</Label>
            <Input
              id="phone" type="tel" inputMode="tel" autoComplete="tel"
              placeholder="77 123 45 67" value={phone}
              onChange={(e) => setPhone(e.target.value)} className="h-12 text-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pin">Code PIN</Label>
            <Input
              id="pin" inputMode="numeric" pattern="[0-9]*" maxLength={4}
              placeholder="••••" value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="h-12 text-2xl tracking-[0.5em] text-center"
            />
          </div>
          <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Se connecter'}
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground">
          Code PIN oublié ? Contactez l'agent Yobbanté du garage.
        </p>
      </div>
    </div>
  );
}

function CourseCard({ course, onAdvance, busy }: {
  course: FretCourse;
  onAdvance: (c: FretCourse) => void;
  busy: boolean;
}) {
  const nextLabel = FRET_NEXT_ACTION[course.status];
  return (
    <article className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{course.ref}</p>
          <h2 className="text-lg font-semibold flex items-center gap-1.5 truncate">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            {course.destination}
          </h2>
          {course.colis_description && (
            <p className="text-sm text-muted-foreground truncate">{course.colis_description}</p>
          )}
        </div>
        <span className="shrink-0 text-[11px] px-2 py-1 rounded-full bg-muted text-muted-foreground">
          {FRET_STATUS_LABEL[course.status]}
        </span>
      </div>

      {course.photo_url && (
        <img
          src={course.photo_url} alt={`Colis ${course.ref}`} loading="lazy"
          className="w-full h-36 object-cover rounded-xl border border-border"
        />
      )}

      {nextLabel ? (
        <Button className="w-full h-14 text-base font-semibold" onClick={() => onAdvance(course)} disabled={busy}>
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : nextLabel}
        </Button>
      ) : (
        <div className="flex items-center justify-center gap-2 h-12 rounded-xl bg-muted text-sm text-muted-foreground">
          <Check className="w-4 h-4" />
          {course.status === 'ARRIVE' ? 'En attente de confirmation du client' : FRET_STATUS_LABEL[course.status]}
        </div>
      )}
    </article>
  );
}

export default function ChauffeurApp() {
  useSeo({
    title: 'Espace chauffeur | Yobbanté',
    description: 'Vos courses fret routier Yobbanté : acceptez, suivez et livrez vos colis.',
    path: '/chauffeur',
  });
  useChauffeurManifest();

  const [token, setToken] = useState<string | null>(() => localStorage.getItem(FRET_TOKEN_KEY));
  const [chauffeur, setChauffeur] = useState<FretChauffeur | null>(null);
  const [courses, setCourses] = useState<FretCourse[]>([]);
  const [loading, setLoading] = useState(!!token);
  const [busyId, setBusyId] = useState<string | null>(null);
  const knownIds = useRef<Set<string> | null>(null);
  const { canInstall, promptInstall } = usePwaInstall();

  const load = useCallback(async (t: string) => {
    try {
      const res = await fretApi.me(t);
      setChauffeur(res.chauffeur);
      setCourses(res.courses);
      // Alerte locale sur une nouvelle course assignée
      const ids = new Set(res.courses.map((c) => c.id));
      if (knownIds.current) {
        const fresh = res.courses.filter((c) => !knownIds.current!.has(c.id) && c.status === 'PENDING_ACCEPT');
        if (fresh.length && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          fresh.forEach((c) =>
            new Notification('Nouveau colis à prendre en charge', { body: `${c.destination} — ${c.ref}`, tag: c.id }),
          );
        }
      }
      knownIds.current = ids;
    } catch (err: any) {
      if (err?.message === 'unauthorized') {
        localStorage.removeItem(FRET_TOKEN_KEY);
        setToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    load(token);
    const id = setInterval(() => load(token), 30_000);
    return () => clearInterval(id);
  }, [token, load]);

  const advance = async (c: FretCourse) => {
    if (!token) return;
    setBusyId(c.id);
    try {
      const res = await fretApi.advance(token, c.id);
      toast.success(FRET_STATUS_LABEL[res.status]);
      await load(token);
    } catch {
      toast.error('Action impossible, réessayez');
    } finally {
      setBusyId(null);
    }
  };


  const logout = () => {
    localStorage.removeItem(FRET_TOKEN_KEY);
    setToken(null);
    setChauffeur(null);
    setCourses([]);
  };

  if (!token) {
    return <LoginScreen onSuccess={(t, c) => { setToken(t); setChauffeur(c); setLoading(true); }} />;
  }

  const actives = courses.filter((c) => c.status !== 'LIVRE');
  const done = courses.filter((c) => c.status === 'LIVRE');

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{chauffeur?.nom_complet || 'Chauffeur Yobbanté'}</p>
          <p className="text-xs text-muted-foreground truncate">
            {chauffeur?.immatriculation || 'Véhicule non renseigné'}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={logout} aria-label="Se déconnecter">
          <LogOut className="w-5 h-5" />
        </Button>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-md mx-auto">
        <PushNotificationsCard
          audience="chauffeur"
          chauffeurToken={token}
          title="Alertes de nouvelle course"
          description="Recevez chaque nouveau colis à prendre en charge, même téléphone verrouillé ou app fermée."
        />

        {canInstall && (
          <div className="rounded-2xl border border-border bg-card p-3">
            <Button variant="outline" className="w-full h-11" onClick={() => promptInstall()}>
              <Package className="w-4 h-4 mr-2" /> Installer l'app sur mon téléphone
            </Button>
          </div>
        )}

        {loading && courses.length === 0 ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : actives.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <Package className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucune course en cours pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {actives.map((c) => (
              <CourseCard key={c.id} course={c} onAdvance={advance} busy={busyId === c.id} />
            ))}
          </div>
        )}

        {done.length > 0 && (
          <section className="space-y-2 pt-2">
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Livrés</h3>
            {done.slice(0, 10).map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm rounded-xl border border-border px-3 py-2">
                <span className="truncate">{c.destination}</span>
                <span className="font-mono text-xs text-muted-foreground">{c.ref}</span>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
