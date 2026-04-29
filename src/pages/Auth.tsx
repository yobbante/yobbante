import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Globe2, Sparkles, ShieldCheck, Loader2, ArrowLeft, Mail, Lock, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import logoYobbante from '@/assets/logo-yobbante.png';

/**
 * Resolve the post-login route.
 * Admins (role=admin in public.user_roles) ALWAYS land on /admin,
 * regardless of any ?redirect= param. Other users use the requested redirect.
 */
async function resolvePostLoginRoute(userId: string, fallback: string): Promise<string> {
  try {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    const isAdmin = (data ?? []).some((r) => r.role === 'admin');
    return isAdmin ? '/admin' : fallback;
  } catch {
    return fallback;
  }
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const rawRedirect = params.get('redirect') || '/app';
  const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/app';

  // If a session already exists when landing on /auth (e.g. OAuth return),
  // route admins straight to /admin and others to the intended page.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || cancelled) return;
      const dest = await resolvePostLoginRoute(session.user.id, redirectTo);
      navigate(dest, { replace: true });
    })();
    return () => { cancelled = true; };
  }, [navigate, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const dest = data.user
          ? await resolvePostLoginRoute(data.user.id, redirectTo)
          : redirectTo;
        navigate(dest, { replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}${redirectTo}` },
        });
        if (error) throw error;
        toast.success('Vérifiez votre email pour confirmer votre compte.');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // Always return to /auth so we can dispatch admins to /admin afterwards.
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: `${window.location.origin}/auth?redirect=${encodeURIComponent(redirectTo)}`,
    });
    if (result.error) {
      toast.error(result.error.message || 'Connexion Google échouée');
      return;
    }
    if (result.redirected) return;
    const { data: { user } } = await supabase.auth.getUser();
    const dest = user ? await resolvePostLoginRoute(user.id, redirectTo) : redirectTo;
    navigate(dest, { replace: true });
  };

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
              {/* Tabs */}
              <div className="flex p-1 rounded-xl bg-white/5 border border-white/10 mb-6">
                <button
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    isLogin ? 'bg-yellow-400 text-zinc-950 shadow' : 'text-white/65 hover:text-white'
                  }`}
                >
                  Connexion
                </button>
                <button
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    !isLogin ? 'bg-yellow-400 text-zinc-950 shadow' : 'text-white/65 hover:text-white'
                  }`}
                >
                  Créer un compte
                </button>
              </div>

              <h3 className="text-xl font-bold tracking-tight">
                {isLogin ? 'Heureux de vous revoir' : 'Rejoignez Yobbanté'}
              </h3>
              <p className="mt-1 text-xs text-white/55">
                {isLogin ? 'Connectez-vous pour accéder à votre espace.' : 'Créez votre compte en 30 secondes.'}
              </p>

              <form onSubmit={handleSubmit} className="space-y-3 mt-6">
                {!isLogin && (
                  <Field icon={<User className="w-3.5 h-3.5" />} label="Nom complet" htmlFor="fullName">
                    <Input
                      id="fullName" type="text" required value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-yellow-400/40 focus-visible:border-yellow-400/40"
                      placeholder="Aïssatou Diop"
                    />
                  </Field>
                )}
                <Field icon={<Mail className="w-3.5 h-3.5" />} label="Email" htmlFor="email">
                  <Input
                    id="email" type="email" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-yellow-400/40 focus-visible:border-yellow-400/40"
                    placeholder="vous@exemple.com"
                  />
                </Field>
                <Field icon={<Lock className="w-3.5 h-3.5" />} label="Mot de passe" htmlFor="password">
                  <Input
                    id="password" type="password" required minLength={6} value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-yellow-400/40 focus-visible:border-yellow-400/40"
                    placeholder="••••••••"
                  />
                </Field>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-bold rounded-xl shadow-[0_10px_30px_-8px_hsl(45_100%_55%/0.6)]"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isLogin ? 'Se connecter' : 'Créer mon compte')}
                </Button>
              </form>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-zinc-950/60 px-3 text-[10px] uppercase tracking-wider text-white/40 font-bold">
                    ou
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={handleGoogleLogin}
                className="w-full h-11 bg-white text-zinc-900 hover:bg-white/90 border-white/0 rounded-xl font-semibold gap-2"
              >
                <GoogleIcon /> Continuer avec Google
              </Button>

              <p className="text-center text-[11px] text-white/40 mt-5 leading-relaxed">
                En continuant, vous acceptez nos conditions et notre politique de confidentialité.
              </p>
            </div>

            <p className="text-center text-xs text-white/55 mt-6">
              {isLogin ? 'Pas encore de compte ?' : 'Déjà inscrit ?'}{' '}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-yellow-400 font-semibold hover:underline"
              >
                {isLogin ? 'Créer un compte' : 'Se connecter'}
              </button>
            </p>
          </motion.div>
        </main>
      </div>
    </div>
  );
}

function Field({
  icon, label, htmlFor, children,
}: { icon: React.ReactNode; label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={htmlFor} className="text-[11px] font-semibold text-white/65 inline-flex items-center gap-1.5 mb-1.5">
        <span className="text-yellow-400/80">{icon}</span>
        {label}
      </Label>
      {children}
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
