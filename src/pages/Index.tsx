import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BottomNav, type TabId } from '@/components/BottomNav';
import { DesktopNav } from '@/components/DesktopNav';
import { DevPanel } from '@/components/DevPanel';
import { HomeView } from '@/pages/HomeView';
import { OrdersView } from '@/pages/OrdersView';
import { ProfileView } from '@/pages/ProfileView';

const ALLOWED: TabId[] = ['home', 'orders', 'profile'];

/** Map legacy ?view= values (dossiers, shipments) to the new "orders" tab,
 *  optionally pre-selecting the right kind on the Mes envois screen. */
const LEGACY: Record<string, { tab: TabId; kind?: 'sourcing' | 'receive' | 'send' }> = {
  dossiers: { tab: 'orders', kind: 'sourcing' },
  shipments: { tab: 'orders', kind: 'send' },
};

export default function Index() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // View is fully driven by ?view=... so refresh + deep-links + bottom nav stay in sync.
  const rawView = searchParams.get('view');
  let view: TabId = 'home';
  if (rawView && ALLOWED.includes(rawView as TabId)) {
    view = rawView as TabId;
  } else if (rawView && LEGACY[rawView]) {
    // Auto-rewrite legacy URLs (?view=dossiers / ?view=shipments) to the new schema.
    const legacy = LEGACY[rawView];
    view = legacy.tab;
  }

  // Auto-rewrite legacy URLs once on mount.
  useEffect(() => {
    if (rawView && LEGACY[rawView]) {
      const sp = new URLSearchParams(searchParams);
      sp.set('view', LEGACY[rawView].tab);
      const k = LEGACY[rawView].kind;
      if (k && !sp.get('kind')) sp.set('kind', k);
      setSearchParams(sp, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setView = (next: TabId) => {
    const sp = new URLSearchParams(searchParams);
    if (next === 'home') {
      sp.delete('view');
    } else {
      sp.set('view', next);
    }
    // Drop tab-specific filters when leaving so they don't leak.
    if (next !== 'orders') {
      sp.delete('kind');
      sp.delete('origin');
      sp.delete('destination');
    }
    setSearchParams(sp, { replace: false });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        const here = location.pathname + location.search;
        navigate(`/auth?redirect=${encodeURIComponent(here)}`, { replace: true });
      }
    });
  }, [navigate, location.pathname, location.search]);

  return (
    <div className="min-h-screen bg-background">
      <DesktopNav active={view} onChange={setView} onSignOut={async () => { await supabase.auth.signOut(); navigate('/'); }} />
      <main className="max-w-4xl mx-auto px-4 sm:px-5 md:px-8 pt-5 md:pt-10">
        {view === 'home' && (
          <HomeView
            onNavigateOrders={(kind) => {
              const sp = new URLSearchParams(searchParams);
              sp.set('view', 'orders');
              if (kind) sp.set('kind', kind);
              setSearchParams(sp, { replace: false });
              if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
            }}
          />
        )}
        {view === 'orders' && <OrdersView />}
        {view === 'profile' && <ProfileView />}
      </main>
      <BottomNav active={view} onChange={setView} />
      <DevPanel />
    </div>
  );
}
