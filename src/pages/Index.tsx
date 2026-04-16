import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import AuthPage from '@/pages/Auth';
import { HomeView } from '@/pages/HomeView';
import { ShipmentsView } from '@/pages/ShipmentsView';
import { ProfileView } from '@/pages/ProfileView';
import { BottomNav, TabId } from '@/components/BottomNav';
import { DesktopNav } from '@/components/DesktopNav';
import { DevPanel } from '@/components/DevPanel';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('home');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-background">
      <DesktopNav active={activeTab} onChange={setActiveTab} onSignOut={signOut} />
      <main className="max-w-2xl mx-auto px-5 pt-6">
        {activeTab === 'home' && <HomeView />}
        {activeTab === 'shipments' && <ShipmentsView />}
        {activeTab === 'profile' && <ProfileView />}
      </main>
      <BottomNav active={activeTab} onChange={setActiveTab} />
      <DevPanel />
    </div>
  );
};

export default Index;
