import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BottomNav } from '@/components/BottomNav';
import { DesktopNav } from '@/components/DesktopNav';
import { DevPanel } from '@/components/DevPanel';
import { HomeView } from '@/pages/HomeView';
import { ShipmentsView } from '@/pages/ShipmentsView';
import { ProfileView } from '@/pages/ProfileView';

type View = 'home' | 'shipments' | 'profile';

export default function Index() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // View is fully driven by ?view=... so refresh + deep-links + bottom nav stay in sync.
  const rawView = searchParams.get('view');
  const view: View = rawView === 'shipments' || rawView === 'profile' ? rawView : 'home';

  const setView = (next: View) => {
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
      <main className="max-w-3xl mx-auto px-4 md:px-6 pt-6 md:pt-8">
        {view === 'home' && <HomeView onNavigateShipments={() => setView('shipments')} />}
        {view === 'shipments' && <ShipmentsView />}
        {view === 'profile' && <ProfileView />}
      </main>
      <BottomNav active={view} onChange={setView} />
      <DevPanel />
    </div>
  );
}
