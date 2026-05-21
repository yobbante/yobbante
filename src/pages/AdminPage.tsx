import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Menu, X, LogOut } from 'lucide-react';
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
import { TransporteursTab } from '@/components/admin/TransporteursTab';
import { GpOperationsTab } from '@/components/admin/GpOperationsTab';
import { EnterpriseQuotesTab } from '@/components/admin/EnterpriseQuotesTab';
import { BoutiqueTab } from '@/components/admin/BoutiqueTab';
import { ManualQuotesTab } from '@/components/admin/ManualQuotesTab';
import { InboxTab } from '@/components/admin/inbox/InboxTab';
import { MessagesTab } from '@/components/admin/MessagesTab';
import { FinancesTab } from '@/components/admin/FinancesTab';
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb';
import { cn } from '@/lib/utils';

const ALLOWED: AdminSection[] = ADMIN_NAV.map(n => n.id);

/** URL slug → internal section key. Slugs not listed here fall through to `slug as AdminSection`. */
const SLUG_TO_SECTION: Record<string, AdminSection> = {
  dossiers: 'requests',
};

export default function AdminPage() {
  const navigate = useNavigate();
  const { isStaff, isAdmin, isLoading: roleLoading } = useUserRole();
  const [authChecked, setAuthChecked] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { section: pathSlug } = useParams<{ section?: string }>();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Priority : URL path /admin/:section > legacy ?section= query > overview
  const queryRaw = searchParams.get('section');
  const pathSection = pathSlug ? (SLUG_TO_SECTION[pathSlug] ?? (pathSlug as AdminSection)) : null;
  const requested = pathSection ?? (queryRaw as AdminSection | null);
  const section: AdminSection = requested && ALLOWED.includes(requested) ? requested : 'overview';
  const isUnknownSection = !!pathSlug && !ALLOWED.includes(pathSection as AdminSection);

  const setSection = (s: AdminSection) => {
    // Always navigate using the clean path form so URLs are shareable.
    if (s === 'overview') {
      navigate('/admin');
    } else {
      navigate(`/admin/${s}`);
    }
    // Clean any legacy ?section= param.
    if (searchParams.has('section')) {
      const sp = new URLSearchParams(searchParams);
      sp.delete('section');
      setSearchParams(sp, { replace: true });
    }
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
    <div className="h-screen overflow-hidden bg-background flex">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col border-r border-border h-screen flex-shrink-0">
        <div className="px-4 py-4 border-b border-border">
          <button onClick={() => navigate('/app')} className="flex items-center gap-2 text-sm font-bold tracking-tight text-foreground">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            <span>YOBBANTÉ</span>
          </button>
          <p className="text-[11px] text-muted-foreground mt-1 ml-6">Console opérations</p>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">

          <AdminSidebar active={section} onChange={setSection} isAdmin={isAdmin} />
        </div>
        <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary bg-primary/8 px-2 py-1 rounded">
            <ShieldCheck className="w-3 h-3" /> {isAdmin ? 'Admin' : 'Staff'}
          </span>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate('/auth'); }}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-2 py-1 rounded transition-colors"
            aria-label="Se déconnecter"
          >
            <LogOut className="w-3.5 h-3.5" />
            Déconnexion
          </button>
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
            <div className="flex-1 min-h-0 overflow-y-auto">
              <AdminSidebar active={section} onChange={setSection} isAdmin={isAdmin} />
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-40 bg-background/80 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded text-muted-foreground hover:text-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold tracking-tight">YOBBANTÉ — Admin</span>
          <div className="flex items-center gap-1">
            <button
              onClick={async () => { await supabase.auth.signOut(); navigate('/auth'); }}
              aria-label="Se déconnecter"
              className="p-2 rounded text-muted-foreground hover:text-destructive"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <button onClick={() => navigate('/app')} className="p-2 -mr-2 rounded text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className={cn('flex-1 w-full flex flex-col min-h-0', section === 'messages' ? 'p-0 max-w-none' : 'px-4 md:px-8 py-6 md:py-8 max-w-6xl')}>
          {isUnknownSection ? (
            <div className="py-20 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Erreur 404</p>
              <h1 className="mt-2 text-2xl font-semibold text-foreground">Section admin introuvable</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                La section « <span className="font-mono">{pathSlug}</span> » n'existe pas.
              </p>
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 mt-6 text-sm font-medium text-primary hover:underline"
              >
                <ArrowLeft className="w-4 h-4" /> Retour au dashboard
              </Link>
            </div>
          ) : (
            <>
              {section !== 'messages' && <AdminBreadcrumb section={section} />}
              {section === 'overview'   && <OverviewTab onJump={setSection} />}
              {section === 'inbox'      && <InboxTab />}
              {section === 'messages'   && <MessagesTab />}
              {section === 'requests'   && <RequestsTab />}
              {section === 'shipments'  && <ShipmentsWorkflowTab />}
              {section === 'orders'     && <OrdersTab />}
              {section === 'reception'  && <ReceptionKanbanTab />}
              {section === 'hubs'       && <HubsTab />}
              {section === 'transport'  && <KonnektMonitorTab />}
              {section === 'departures' && <DeparturesTab />}
              {section === 'transporteurs' && isAdmin && <TransporteursTab />}
              {section === 'gp-operations' && isAdmin && <GpOperationsTab />}
              {section === 'sourcing'   && <SourcingTab />}
              {section === 'boutique'   && <BoutiqueTab />}
              {section === 'tracking'   && <TrackingTab />}
              {section === 'clients'    && <ClientsTab />}
              {section === 'enterprise' && <EnterpriseQuotesTab />}
              {section === 'manual-quotes' && <ManualQuotesTab />}
              {section === 'finances' && isAdmin && <FinancesTab />}
              {section === 'settings'   && <SettingsTab />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
