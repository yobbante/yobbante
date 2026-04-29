import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share, Plus, X, Smartphone } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';

/**
 * Floating "Installer l'app" banner shown on mobile only.
 * - Android/Chrome/Edge: triggers the native beforeinstallprompt.
 * - iOS Safari: shows the "Partager → Ajouter à l'écran d'accueil" hint.
 * Hidden inside Lovable preview iframes and once installed/dismissed.
 */
export function InstallAppPrompt() {
  const { canInstall, showIosHint, dismissed, installed, promptInstall, dismiss } = usePwaInstall();
  const [iosOpen, setIosOpen] = useState(false);
  const [delayedShow, setDelayedShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDelayedShow(true), 1500);
    return () => clearTimeout(t);
  }, []);

  if (installed || dismissed || !delayedShow) return null;
  if (!canInstall && !showIosHint) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          key="install-banner"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 24 }}
          className="md:hidden fixed bottom-20 left-3 right-3 z-40"
          role="region"
          aria-label="Installer l'application Yobbanté"
        >
          <div className="rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-lg p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">Installer Yobbanté</p>
              <p className="text-[11px] text-muted-foreground leading-snug truncate">
                Accès rapide, plein écran, sans navigateur.
              </p>
            </div>
            <button
              onClick={async () => {
                if (canInstall) await promptInstall();
                else setIosOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity shrink-0"
            >
              <Download className="w-3.5 h-3.5" /> Installer
            </button>
            <button
              onClick={dismiss}
              aria-label="Fermer"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* iOS hint sheet */}
      <AnimatePresence>
        {iosOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setIosOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-base font-bold tracking-tight">Installer sur iPhone</p>
                <button onClick={() => setIosOpen(false)} aria-label="Fermer" className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="space-y-3 text-sm text-foreground">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-muted text-foreground text-xs font-bold flex items-center justify-center shrink-0">1</span>
                  <span className="flex-1">Appuyez sur <Share className="inline w-4 h-4 mx-1" /> <strong>Partager</strong> dans la barre Safari.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-muted text-foreground text-xs font-bold flex items-center justify-center shrink-0">2</span>
                  <span className="flex-1">Choisissez <Plus className="inline w-4 h-4 mx-1" /> <strong>Sur l'écran d'accueil</strong>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-muted text-foreground text-xs font-bold flex items-center justify-center shrink-0">3</span>
                  <span className="flex-1">Confirmez avec <strong>Ajouter</strong>. L'icône apparaît sur votre écran d'accueil.</span>
                </li>
              </ol>
              <button
                onClick={() => { setIosOpen(false); dismiss(); }}
                className="w-full py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold"
              >
                Compris
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
