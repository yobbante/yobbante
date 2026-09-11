import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Send, Inbox, Search, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Barre de navigation mobile globale — visible sur toutes les pages publiques
 * (accueil, expedier, demande-devis, sourcing, relais-d, tarifs…) et sur /app.
 * Cachée sur les routes admin, auth, tracking, paiement, boutique Dëkk, etc.
 */
const HIDDEN_PREFIXES = [
  '/admin', '/auth', '/gp/', '/chauffeur', '/suivre', '/track',
  '/pay/', '/avis/', '/modifier/', '/recu/', '/panier/',
  '/devis/confirmer', '/confidentialite', '/mentions-legales',
  '/cgu', '/cgv', '/cookies', '/konnekt', '/business',
];

const TABS = [
  { id: 'home',       icon: Home,   label: 'Accueil' },
  { id: 'envois',     icon: Send,   label: 'Envois' },
  { id: 'receptions', icon: Inbox,  label: 'Relais D' },
  { id: 'sourcing',   icon: Search, label: 'Sourcing' },
  { id: 'profile',    icon: User,   label: 'Profil' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** URL cible selon l'onglet et l'état d'authentification. */
function resolvePath(authed: boolean, tabId: TabId): string {
  if (!authed) {
    switch (tabId) {
      case 'home':       return '/';
      case 'envois':     return '/expedier';
      case 'receptions': return '/relais-d';
      case 'sourcing':   return '/sourcing';
      case 'profile':    return '/auth';
    }
  }
  switch (tabId) {
    case 'home':       return '/app';
    case 'envois':     return '/app?view=envois';
    case 'receptions': return '/app?view=receptions';
    case 'sourcing':   return '/app?view=sourcing';
    case 'profile':    return '/app?view=profile';
  }
  return '/app';
}

/** Onglet actif selon la route courante. */
function activeFromLocation(pathname: string, search: string): TabId {
  const view = new URLSearchParams(search).get('view');
  if (view === 'envois' || pathname.startsWith('/expedier')) return 'envois';
  if (view === 'receptions' || pathname.startsWith('/relais-d')) return 'receptions';
  if (view === 'sourcing' || pathname.startsWith('/sourcing')) return 'sourcing';
  if (view === 'profile') return 'profile';
  // Écrans secondaires (devis, paiements, factures, demande-devis, tarifs…) → Accueil
  return 'home';
}

export function GlobalMobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setAuthed(!!session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Masqué sur les routes spécialisées et sur l'espace app (qui a sa propre BottomNav).
  if (pathnameHidden(location.pathname)) return null;

  const active = activeFromLocation(location.pathname, location.search);

  const handleClick = (tabId: TabId) => {
    const path = resolvePath(authed, tabId);
    const here = location.pathname + location.search;
    if (path === here) return;
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  return (
    <nav
      role="navigation"
      aria-label="Navigation principale"
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{
        height: 56,
        background: 'hsl(var(--background-primary))',
        borderTop: '0.5px solid hsl(var(--color-border-tertiary))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="h-full flex items-stretch">
        {TABS.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleClick(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
              className="flex-1 flex flex-col items-center justify-center gap-1 focus:outline-none"
              style={{ color: isActive ? 'hsl(var(--foreground))' : 'hsl(var(--text-tertiary))' }}
            >
              <TabIcon
                size={20}
                strokeWidth={isActive ? 2.2 : 1.7}
                fill={isActive ? 'currentColor' : 'none'}
              />
              <span style={{ fontSize: 10, fontWeight: isActive ? 500 : 400, lineHeight: 1 }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function pathnameHidden(pathname: string): boolean {
  // /app a déjà sa propre BottomNav intégrée.
  if (pathname === '/app' || pathname.startsWith('/app/')) return true;
  return HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}
