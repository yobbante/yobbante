import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Menu, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserRole } from '@/hooks/useUserRole';
import { AdminSidebar, ADMIN_NAV, type AdminSection } from '@/components/admin/AdminSidebar';
import { OverviewTab } from '@/components/admin/OverviewTab';
import { RequestsTab } from '@/components/admin/RequestsTab';
import { OrdersTab } from '@/components/admin/OrdersTab';
import { HubsTab } from '@/components/admin/HubsTab';
import { SourcingTab } from '@/components/admin/SourcingTab';
import { KonnektMonitorTab } from '@/components/admin/KonnektMonitorTab';
import { DeparturesTab } from '@/components/admin/DeparturesTab';
import { TrackingTab } from '@/components/admin/TrackingTab';
import { ClientsTab } from '@/components/admin/ClientsTab';
import { SettingsTab } from '@/components/admin/SettingsTab';
import { ShipmentsWorkflowTab } from '@/components/admin/ShipmentsWorkflowTab';
import { ReceptionKanbanTab } from '@/components/admin/ReceptionKanbanTab';
import { cn } from '@/lib/utils';

const ALLOWED: AdminSection[] = ADMIN_NAV.map(n => n.id);

export default function AdminPage() {
  const navigate = useNavigate();
  const { isStaff, isAdmin, isLoading: roleLoading } = useUserRole();
  const [authChecked, setAuthChecked] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  const raw = searchParams.get('section') as AdminSection | null;
  const section: AdminSection = raw && ALLOWED.includes(raw) ? raw : 'overview';

  const setSection = (s: AdminSection) => {
    const sp = new URLSearchParams(searchParams);
    if (s === 'overview') sp.delete('section'); else sp.set('section', s);
    setSearchParams(sp);
    setMobileOpen(false);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/auth?redirect=/admin');
      else setAuthChecked(true);
    });
  }, [navigate]);

  if (!authChecked || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <ShieldCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-base font-semibold text-foreground">Accès réservé</p>
          <p className="text-sm text-muted-foreground mt-1">
            Cet espace est réservé à l'équipe Yobbanté.
          </p>
          <Button onClick={() => navigate('/app')} variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col border-r border-border sticky top-0 h-screen">
        <div className="px-4 py-4 border-b border-border">
          <button onClick={() => navigate('/app')} className="flex items-center gap-2 text-sm font-bold tracking-tight text-foreground">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            <span>YOBBANTÉ</span>
          </button>
          <p className="text-[11px] text-muted-foreground mt-1 ml-6">Console opérations</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <AdminSidebar active={section} onChange={setSection} isAdmin={isAdmin} />
        </div>
        <div className="px-4 py-3 border-t border-border">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary bg-primary/8 px-2 py-1 rounded">
            <ShieldCheck className="w-3 h-3" /> {isAdmin ? 'Admin' : 'Staff'}
          </span>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-background border-r border-border flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-bold tracking-tight">YOBBANTÉ</span>
              <button onClick={() => setMobileOpen(false)} className="p-1 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AdminSidebar active={section} onChange={setSection} isAdmin={isAdmin} />
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-40 bg-background/80 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded text-muted-foreground hover:text-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold tracking-tight">YOBBANTÉ — Admin</span>
          <button onClick={() => navigate('/app')} className="p-2 -mr-2 rounded text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </header>

        <main className={cn('flex-1 px-4 md:px-8 py-6 md:py-8 max-w-6xl w-full')}>
          {section === 'overview'   && <OverviewTab onJump={setSection} />}
          {section === 'requests'   && <RequestsTab />}
          {section === 'shipments'  && <ShipmentsWorkflowTab />}
          {section === 'orders'     && <OrdersTab />}
          {section === 'hubs'       && <HubsTab />}
          {section === 'transport'  && <KonnektMonitorTab />}
          {section === 'departures' && <DeparturesTab />}
          {section === 'sourcing'   && <SourcingTab />}
          {section === 'tracking'   && <TrackingTab />}
          {section === 'clients'    && <ClientsTab />}
          {section === 'settings'   && <SettingsTab />}
        </main>
      </div>
    </div>
  );
}
