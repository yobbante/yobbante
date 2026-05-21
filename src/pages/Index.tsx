import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BottomNav, type TabId } from '@/components/BottomNav';
import { DesktopNav } from '@/components/DesktopNav';
import { DevPanel } from '@/components/DevPanel';
import { HomeView } from '@/pages/HomeView';
import { OrdersView } from '@/pages/OrdersView';
import { ProfileView } from '@/pages/ProfileView';
import { IntentSearchBar } from '@/components/IntentSearchBar';
import { markInApp } from '@/lib/homeHref';

const ALLOWED: TabId[] = ['home', 'envois', 'receptions', 'sourcing', 'profile'];

/** Tab → kind for OrdersView. */
const TAB_TO_KIND: Partial<Record<TabId, 'sourcing' | 'receive' | 'send'>> = {
  envois: 'send',
  receptions: 'receive',
  sourcing: 'sourcing',
};

/** Map legacy ?view= values to the new tab schema. */
const LEGACY: Record<string, { tab: TabId }> = {
  dossiers:  { tab: 'sourcing' },
  shipments: { tab: 'envois' },
  orders:    { tab: 'envois' },
};

export default function Index() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawView = searchParams.get('view');
  let view: TabId = 'home';
  if (rawView && ALLOWED.includes(rawView as TabId)) {
    view = rawView as TabId;
  } else if (rawView && LEGACY[rawView]) {
    view = LEGACY[rawView].tab;
  }

  // Auto-rewrite legacy URLs once on mount.
  useEffect(() => {
    if (rawView && LEGACY[rawView]) {
      const sp = new URLSearchParams(searchParams);
      sp.set('view', LEGACY[rawView].tab);
      // For legacy ?view=orders, preserve any existing ?kind=
      const legacyKind = searchParams.get('kind');
      if (rawView === 'orders' && legacyKind === 'sourcing') sp.set('view', 'sourcing');
      if (rawView === 'orders' && legacyKind === 'receive') sp.set('view', 'receptions');
      sp.delete('kind');
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
    sp.delete('kind');
    sp.delete('origin');
    sp.delete('destination');
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

  const ordersKind = TAB_TO_KIND[view];
  const isOrdersTab = !!ordersKind;

  return (
    <div className="min-h-screen bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <DesktopNav active={view} onChange={setView} onSignOut={async () => { await supabase.auth.signOut(); navigate('/'); }} />
      <div
        className="sticky top-0 md:top-[57px] z-30"
        style={{
          background: 'hsl(var(--background-primary))',
          borderBottom: '0.5px solid hsl(var(--color-border-tertiary))',
        }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-5 md:px-8 py-2">
          <IntentSearchBar variant="compact" />
        </div>
      </div>
      <main className="max-w-4xl mx-auto px-4 sm:px-5 md:px-8 pt-5 md:pt-8">
        {view === 'home' && (
          <HomeView
            onNavigateOrders={(kind) => {
              const next: TabId =
                kind === 'sourcing' ? 'sourcing'
                : kind === 'receive' ? 'receptions'
                : 'envois';
              setView(next);
            }}
          />
        )}
        {isOrdersTab && <OrdersView fixedKind={ordersKind} />}
        {view === 'profile' && <ProfileView />}
      </main>
      <BottomNav active={view} onChange={setView} />
      {import.meta.env.DEV && <DevPanel />}
    </div>
  );
}
