import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Menu, X, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useUserRole } from '@/hooks/useUserRole';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminLiveBadge } from '@/components/admin/AdminLiveBadge';
import { AdminNotificationBell } from '@/components/admin/AdminNotificationBell';

/**
 * Shared shell for standalone admin pages so the left navigation sidebar
 * stays visible (just like /admin/:section). Drop a page inside <AdminShell>.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { isStaff, isAdmin, isLoading: roleLoading } = useUserRole();
  const [authChecked, setAuthChecked] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/auth?redirect=' + encodeURIComponent(window.location.pathname));
      else setAuthChecked(true);
    });
  }, [navigate]);

  const goto = (s: string) => {
    setMobileOpen(false);
    if (s === 'overview') navigate('/admin');
    else navigate(`/admin/${s}`);
  };

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
          <Button onClick={() => navigate('/app')} variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-background flex">
      <aside className="hidden lg:flex lg:w-60 lg:flex-col border-r border-border h-screen flex-shrink-0">
        <div className="px-4 py-4 border-b border-border">
          <button onClick={() => navigate('/app')} className="flex items-center gap-2 text-sm font-bold tracking-tight text-foreground">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            <span>YOBBANTÉ</span>
          </button>
          <p className="text-[11px] text-muted-foreground mt-1 ml-6">Console opérations</p>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <AdminSidebar active={'overview' as any} onChange={goto} isAdmin={isAdmin} />
        </div>
        <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary bg-primary/8 px-2 py-1 rounded">
            <ShieldCheck className="w-3 h-3" /> {isAdmin ? 'Admin' : 'Staff'}
          </span>
          <AdminLiveBadge />
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

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-background border-r border-border flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-bold tracking-tight">YOBBANTÉ</span>
              <button onClick={() => setMobileOpen(false)} className="p-1 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <AdminSidebar active={'overview' as any} onChange={goto} isAdmin={isAdmin} />
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
        <header className="lg:hidden sticky top-0 z-40 bg-background/80 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded text-muted-foreground hover:text-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold tracking-tight">YOBBANTÉ — Admin</span>
          <div className="flex items-center gap-1">
            <AdminLiveBadge className="mr-1" />
            <AdminNotificationBell />
            <button onClick={() => navigate('/admin')} className="p-2 -mr-2 rounded text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="hidden lg:flex sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border px-6 py-2 items-center justify-end gap-1">
          <AdminNotificationBell />
        </div>

        <main className="flex-1 w-full min-h-0 px-4 md:px-8 py-6 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
