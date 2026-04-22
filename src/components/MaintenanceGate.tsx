import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Loader2, Wrench, Lock } from 'lucide-react';

/**
 * Maintenance lock — wraps the entire app.
 * When active, every route is replaced by a fullscreen maintenance message.
 * A subtle gear icon (bottom-right) opens an access-code modal.
 * Correct code → unlock persisted in localStorage so refresh stays unlocked.
 *
 * To force-lock again from the console:
 *   localStorage.removeItem('yobbante_maint_pass'); location.reload();
 */
const ACCESS_CODE = '784604003';
const STORAGE_KEY = 'yobbante_maint_pass';

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      setUnlocked(v === ACCESS_CODE);
    } catch {
      setUnlocked(false);
    }
  }, []);

  // Allow ?bypass=<code> in the URL as a one-shot unlock (dev convenience).
  useEffect(() => {
    if (unlocked) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('bypass') === ACCESS_CODE) {
      try { localStorage.setItem(STORAGE_KEY, ACCESS_CODE); } catch { /* ignore */ }
      setUnlocked(true);
    }
  }, [unlocked]);

  // Loading flash — avoid flicker on hydrate.
  if (unlocked === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (unlocked) return <>{children}</>;

  function trySubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setChecking(true);
    setError(false);
    // small delay so submit feels deliberate
    setTimeout(() => {
      if (code.trim() === ACCESS_CODE) {
        try { localStorage.setItem(STORAGE_KEY, ACCESS_CODE); } catch { /* ignore */ }
        setUnlocked(true);
        setShowModal(false);
      } else {
        setError(true);
        setChecking(false);
      }
    }, 400);
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* Subtle ambient grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <main className="flex-1 flex items-center justify-center px-6 py-16 relative">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center max-w-lg"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-xs font-medium text-muted-foreground mb-7">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
            </span>
            Maintenance en cours
          </div>

          <div className="mx-auto w-14 h-14 rounded-2xl bg-foreground text-background flex items-center justify-center mb-6">
            <Wrench className="w-6 h-6" />
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.05] text-balance">
            Yobbanté revient<br className="hidden sm:block" /> très bientôt.
          </h1>
          <p className="mt-5 text-base text-muted-foreground max-w-md mx-auto leading-relaxed text-pretty">
            Nous améliorons la plateforme pour vous offrir une expérience encore plus fluide.
            Merci pour votre patience.
          </p>

          <div className="mt-8 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">contact@yobbante.com</span>
          </div>
        </motion.div>
      </main>

      {/* Subtle settings cog — bottom right */}
      <button
        onClick={() => { setShowModal(true); setCode(''); setError(false); }}
        aria-label="Accès paramètres"
        className="fixed bottom-5 right-5 w-9 h-9 rounded-full border border-border bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all flex items-center justify-center opacity-50 hover:opacity-100"
      >
        <Settings className="w-4 h-4" />
      </button>

      {/* Access modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-foreground/40 backdrop-blur-sm flex items-center justify-center px-5"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="inline-flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                    <Lock className="w-4 h-4 text-foreground" />
                  </div>
                  <h2 className="text-base font-semibold tracking-tight text-foreground">Accès restreint</h2>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  aria-label="Fermer"
                  className="w-8 h-8 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Saisissez votre code d'accès pour entrer sur la plateforme.
              </p>

              <form onSubmit={trySubmit} className="mt-5">
                <input
                  autoFocus
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={code}
                  onChange={(e) => { setCode(e.target.value); setError(false); }}
                  placeholder="•••••••••"
                  aria-label="Code d'accès"
                  className={`w-full bg-background border-2 rounded-xl px-4 py-3.5 text-center text-lg font-mono tracking-[0.4em] focus:outline-none transition-colors ${
                    error ? 'border-destructive' : 'border-border focus:border-foreground'
                  }`}
                />
                {error && (
                  <p className="mt-2 text-xs text-destructive font-medium">Code incorrect.</p>
                )}
                <button
                  type="submit"
                  disabled={checking || code.length === 0}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-foreground text-background font-semibold rounded-xl px-4 py-3 text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {checking && <Loader2 className="w-4 h-4 animate-spin" />}
                  Déverrouiller
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
