import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { enableAnalytics } from '@/lib/analytics';

const STORAGE_KEY = 'yobbante.cookies.v1';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');

  useEffect(() => {
    if (isAdmin) return;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const t = setTimeout(() => setVisible(true), 600);
        return () => clearTimeout(t);
      }
    } catch {
      // localStorage unavailable, skip
    }
  }, [isAdmin]);

  const dismiss = (choice: 'accept' | 'decline') => {
    try { localStorage.setItem(STORAGE_KEY, choice); } catch { /* ignore */ }
    if (choice === 'accept') enableAnalytics();
    setVisible(false);
  };

  if (isAdmin || !visible) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 z-[60] sm:max-w-sm animate-fade-in">
      <div className="bg-foreground text-background rounded-2xl shadow-2xl p-4 sm:p-5 border border-background/10">
        <div className="flex items-start gap-3">
          <p className="text-xs sm:text-sm leading-relaxed flex-1 text-pretty">
            Nous utilisons des cookies essentiels pour améliorer votre expérience. Aucun tracking publicitaire.
          </p>
          <button
            onClick={() => dismiss('decline')}
            aria-label="Fermer"
            className="flex-shrink-0 -mt-1 -mr-1 p-1 rounded-md hover:bg-background/10 transition-colors"
          >
            <X className="w-4 h-4 text-background/70" />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => dismiss('accept')}
            className="flex-1 text-xs font-semibold bg-background text-foreground px-3 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            Accepter
          </button>
          <button
            onClick={() => dismiss('decline')}
            className="text-xs font-medium text-background/80 hover:text-background px-3 py-2 transition-colors"
          >
            Refuser
          </button>
        </div>
      </div>
    </div>
  );
}
