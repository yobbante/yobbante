import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BottomNav } from '@/components/BottomNav';
import { DesktopNav } from '@/components/DesktopNav';
import { DevPanel } from '@/components/DevPanel';
import { HomeView } from '@/pages/HomeView';
import { ShipmentsView } from '@/pages/ShipmentsView';
import { ProfileView } from '@/pages/ProfileView';

type View = 'home' | 'shipments' | 'profile';

export default function Index() {
  const [view, setView] = useState<View>('home');
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/auth');
    });
  }, [navigate]);

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
