import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BottomNav, type TabId } from '@/components/BottomNav';
import { DesktopNav } from '@/components/DesktopNav';
import { DevPanel } from '@/components/DevPanel';
import { HomeView } from '@/pages/HomeView';
import { DossiersView } from '@/pages/DossiersView';
import { ShipmentsView } from '@/pages/ShipmentsView';
import { ProfileView } from '@/pages/ProfileView';

const ALLOWED: TabId[] = ['home', 'dossiers', 'shipments', 'profile'];

export default function Index() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // View is fully driven by ?view=... so refresh + deep-links + bottom nav stay in sync.
  const rawView = searchParams.get('view') as TabId | null;
  const view: TabId = rawView && ALLOWED.includes(rawView) ? rawView : 'home';

  const setView = (next: TabId) => {
    const sp = new URLSearchParams(searchParams);
    if (next === 'home') {
      sp.delete('view');
    } else {
      sp.set('view', next);
    }
    // Drop tracking filters when leaving the shipments tab so they don't leak.
    if (next !== 'shipments') {
      sp.delete('origin');
      sp.delete('destination');
    }
    setSearchParams(sp, { replace: false });
    // Scroll back to top on tab switch — feels native.
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
            onNavigateShipments={() => setView('shipments')}
            onNavigateDossiers={() => setView('dossiers')}
          />
        )}
        {view === 'dossiers' && <DossiersView />}
        {view === 'shipments' && <ShipmentsView />}
        {view === 'profile' && <ProfileView />}
      </main>
      <BottomNav active={view} onChange={setView} />
      <DevPanel />
    </div>
  );
}
