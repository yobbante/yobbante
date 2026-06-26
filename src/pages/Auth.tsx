import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Globe2, Sparkles, ShieldCheck, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';

import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import logoYobbante from '@/assets/logo-yobbante.png';

/**
 * Resolve the post-login route.
 * Admins (role=admin in public.user_roles) ALWAYS land on /admin,
 * regardless of any ?redirect= param. Other users use the requested redirect.
 */
async function resolvePostLoginRoute(userId: string, fallback: string): Promise<string> {
  // CORRECTION 3 — un admin qui finalise une commande client ne doit PAS être
  // renvoyé sur /admin. On respecte la destination demandée dès qu'elle porte
  // une intention client explicite (resume=1, /pay, /suivre, /devis, /expedier,
  // /confirmation…). Sinon, comportement par défaut : admin → /admin.
  const isClientIntent =
    fallback.includes('resume=1') ||
    /^\/(pay|suivre|track|expedier|devis|confirmation|orders|app|gp\/depart)(\/|\?|$)/.test(fallback);
  try {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    const isAdmin = (data ?? []).some((r) => r.role === 'admin');
    if (isAdmin && !isClientIntent) return '/admin';
    return fallback;
  } catch {
    return fallback;
  }
}

export default function Auth() {
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const rawRedirect = params.get('redirect') || '/app';
  const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/app';

  // CAS 1 — Session déjà active : on redirige immédiatement et on n'affiche
  // jamais la page de connexion (évite l'écran figé après un retour OAuth).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.user) {
        const dest = await resolvePostLoginRoute(session.user.id, redirectTo);
        navigate(dest, { replace: true });
        return;
      }
      setSessionChecked(true);
    })();
    return () => { cancelled = true; };
  }, [navigate, redirectTo]);

  // Toast d'erreur si AuthCallback nous renvoie avec ?error=oauth_failed.
  useEffect(() => {
    if (params.get('error') === 'oauth_failed') {
      toast.error('Connexion échouée. Réessayez.');
    }
  }, [params]);

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setLoadingProvider(provider);
    try {
      // Mémorise la destination post-login pour AuthCallback.
      try { sessionStorage.setItem('post_auth_redirect', redirectTo); } catch {}

      // Lovable Cloud managed OAuth — utilise le broker /~oauth.
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}/auth/callback`,
      });

      if (result.redirected) {
        // Navigateur va rediriger — on garde le loader.
        return;
      }
      if (result.error) {
        toast.error(result.error.message || `Connexion ${provider === 'google' ? 'Google' : 'Apple'} échouée`);
        setLoadingProvider(null);
        return;
      }
      // Tokens reçus directement (rare) → on route immédiatement.
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const dest = await resolvePostLoginRoute(session.user.id, redirectTo);
        navigate(dest, { replace: true });
      }
    } catch (e: any) {
      toast.error(e?.message || 'Impossible de démarrer la connexion');
      setLoadingProvider(null);
    }
  };


  // Tant qu'on n'a pas vérifié la session, on n'affiche rien (anti-flash).
  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-yellow-400" />
      </div>
    );
  }


  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      {/* ── Background: animated gradient mesh + grid ── */}
      <div className="absolute inset-0 -z-10">
        <div
          className="absolute -top-40 -left-40 w-[40rem] h-[40rem] rounded-full opacity-50 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(168 70% 45% / 0.6), transparent 60%)' }}
        />
        <div
          className="absolute -bottom-40 -right-40 w-[40rem] h-[40rem] rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(45 100% 55% / 0.55), transparent 60%)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="min-h-screen grid lg:grid-cols-2">
        {/* ── Left brand panel (desktop only) ── */}
        <aside className="hidden lg:flex flex-col justify-between p-12 relative">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors w-fit">
            <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <Link to="/" className="block">
              <span className="inline-flex items-center gap-3">
                <img src={logoYobbante} alt="Yobbanté" width={48} height={48} className="w-12 h-12 object-contain" />
                <span className="text-xl font-bold tracking-tight">YOBBANTÉ</span>
              </span>
              <h1 className="mt-6 text-5xl xl:text-6xl font-bold leading-[1.05] tracking-tight">
                Le monde devient<br />simple à <span className="text-yellow-400">livrer</span>.
              </h1>
            </Link>
            <p className="text-base text-white/65 max-w-md leading-relaxed">
              Connectez-vous pour suivre vos envois, recevoir vos commandes internationales
              et piloter votre logistique en temps réel.
            </p>

            <div className="space-y-3 pt-4">
              {[
                { Icon: Globe2, t: 'Réseau mondial', d: 'France · Chine · USA · Dubai · Turquie' },
                { Icon: Sparkles, t: 'Suivi en temps réel', d: 'Notifications WhatsApp & email à chaque étape' },
                { Icon: ShieldCheck, t: 'Paiement à la réception', d: 'Vous validez après pesée et photo' },
              ].map(({ Icon, t, d }, i) => (
                <motion.div
                  key={t}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.08, duration: 0.5 }}
                  className="flex items-start gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t}</p>
                    <p className="text-xs text-white/55">{d}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <p className="text-xs text-white/40">© {new Date().getFullYear()} Yobbanté · Logistique sans frontières</p>
        </aside>

        {/* ── Right form panel ── */}
        <main className="flex items-center justify-center p-6 sm:p-10 relative">
          <Link
            to="/"
            className="lg:hidden absolute top-6 left-6 inline-flex items-center gap-1.5 text-xs text-white/65 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Accueil
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-sm"
          >
            <div className="lg:hidden text-center mb-8">
              <img src={logoYobbante} alt="Yobbanté" width={56} height={56} className="w-14 h-14 mx-auto mb-3 object-contain" />
              <p className="text-[10px] uppercase tracking-[0.3em] text-yellow-400 font-bold">Yobbanté</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">Bienvenue</h2>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
              <h3 className="text-xl font-bold tracking-tight">Connexion sécurisée</h3>
              <p className="mt-1 text-xs text-white/55">
                Choisissez votre méthode pour accéder à votre espace.
              </p>

              <div className="mt-6 space-y-3">
                <Button
                  variant="outline"
                  onClick={() => handleOAuth('google')}
                  disabled={loadingProvider !== null}
                  className="w-full h-11 bg-white text-zinc-900 hover:bg-white/90 border-white/0 rounded-xl font-semibold gap-2"
                >
                  {loadingProvider === 'google'
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><GoogleIcon /> Continuer avec Google</>}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleOAuth('apple')}
                  disabled={loadingProvider !== null}
                  className="w-full h-11 bg-zinc-950 text-white hover:bg-zinc-900 border border-white/15 rounded-xl font-semibold gap-2"
                >
                  {loadingProvider === 'apple'
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><AppleIcon /> Continuer avec Apple</>}
                </Button>
              </div>

              <p className="text-center text-[11px] text-white/40 mt-6 leading-relaxed">
                En continuant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité.
              </p>
            </div>

            <p className="text-center text-[11px] text-white/45 mt-6 leading-relaxed">
              Yobbanté utilise une connexion sociale sécurisée — aucun mot de passe à retenir.
            </p>
          </motion.div>
        </main>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.69 4.1-5.5 4.1-3.31 0-6.01-2.74-6.01-6.12S8.69 5.96 12 5.96c1.88 0 3.14.8 3.86 1.49l2.63-2.53C16.86 3.39 14.65 2.4 12 2.4 6.78 2.4 2.55 6.6 2.55 12s4.23 9.6 9.45 9.6c5.46 0 9.07-3.83 9.07-9.22 0-.62-.07-1.1-.16-1.58H12z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.42 2.21-1.16 3.02-.78.86-2.06 1.52-3.13 1.43-.13-1.11.4-2.27 1.15-3.06.83-.88 2.18-1.5 3.14-1.39zm3.96 16.16c-.59 1.36-.87 1.97-1.63 3.18-1.06 1.69-2.55 3.79-4.4 3.81-1.65.02-2.07-1.07-4.31-1.06-2.24.01-2.71 1.08-4.36 1.06-1.85-.02-3.27-1.92-4.33-3.6C-.79 16.42-1.04 11.07 1.6 8.21c1.84-2 4.81-2.5 6.87-2.5 1.94 0 3.32 1.06 4.96 1.06 1.6 0 2.58-1.06 4.83-1.06 1.7 0 3.5.93 4.78 2.54-4.21 2.31-3.52 8.34-2.71 9.34z" />
    </svg>
  );
}
