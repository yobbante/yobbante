import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { claimPendingTracking } from '@/lib/claimTracking';
import { BottomNav, type TabId } from '@/components/BottomNav';
import { DesktopNav } from '@/components/DesktopNav';
import { DevPanel } from '@/components/DevPanel';
import { ClientSpaceView } from '@/pages/ClientSpaceView';
import { OrdersView } from '@/pages/OrdersView';
import { ProfileView } from '@/pages/ProfileView';
import { QuotesView } from '@/pages/QuotesView';
import { BillingView } from '@/pages/BillingView';

import { markInApp } from '@/lib/homeHref';

const ALLOWED: TabId[] = ['home', 'envois', 'receptions', 'sourcing', 'profile', 'devis', 'paiements', 'factures'];

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

  // Mark this session as "inside the app shell" so any subsequent
  // "Accueil" / "Retour" link (search bar, flow header, etc.) brings
  // the user back to /app instead of the public landing page.
  useEffect(() => { markInApp(); }, []);

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

  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  // Rattache le colis consulté en public avant l'inscription — quel que soit
  // l'onglet ouvert à l'arrivée dans l'espace client.
  useEffect(() => {
    let cancelled = false;
    claimPendingTracking().then((result) => {
      if (cancelled || !result) return;
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: ['dossiers'] });
        toast.success(`Le colis ${result.ref} a été ajouté à votre espace.`);
      } else if (result.reason === 'already_claimed') {
        toast.error('Ce colis est déjà rattaché à un autre compte.');
      } else if (result.reason === 'not_found') {
        toast.error('Le colis suivi est introuvable.');
      }
    });
    return () => { cancelled = true; };
  }, [queryClient]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (!session) {
        const here = location.pathname + location.search;
        navigate(`/auth?redirect=${encodeURIComponent(here)}`, { replace: true });
        return;
      }
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [navigate, location.pathname, location.search]);

  const ordersKind = TAB_TO_KIND[view];
  const isOrdersTab = !!ordersKind;

  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <Loader2 className="w-7 h-7 animate-spin text-[#F5C518]" aria-label="Chargement" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <DesktopNav active={view} onChange={setView} onSignOut={async () => { await supabase.auth.signOut(); navigate('/'); }} />
      <main className="max-w-4xl mx-auto px-4 sm:px-5 md:px-8 pt-5 md:pt-8 pb-safe-nav md:pb-safe-none">
        {view === 'home' && <ClientSpaceView />}
        {isOrdersTab && <OrdersView fixedKind={ordersKind} />}
        {view === 'profile' && <ProfileView />}
        {view === 'devis' && <QuotesView />}
        {view === 'paiements' && <BillingView mode="payments" />}
        {view === 'factures' && <BillingView mode="invoices" />}
      </main>
      <BottomNav active={view} onChange={setView} />
      {import.meta.env.DEV && <DevPanel />}
    </div>
  );
}
