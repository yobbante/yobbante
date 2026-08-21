import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Menu, X, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserRole } from '@/hooks/useUserRole';
import { AdminSidebar, ADMIN_NAV, AGENT_SECTIONS, TERRAIN_AGENT_SECTIONS, type AdminSection } from '@/components/admin/AdminSidebar';
import { OverviewTab } from '@/components/admin/OverviewTab';
import { DossiersHubTab } from '@/components/admin/DossiersHubTab';
import { DepartsHubTab } from '@/components/admin/DepartsHubTab';
import { TerrainHubTab } from '@/components/admin/TerrainHubTab';
import { LeadsHubTab } from '@/components/admin/LeadsHubTab';
import { HubsHubTab } from '@/components/admin/HubsHubTab';
import { ClientsTab } from '@/components/admin/ClientsTab';
import { MessagesTab } from '@/components/admin/MessagesTab';
import { BoutiqueTab } from '@/components/admin/BoutiqueTab';
import { SettingsTab } from '@/components/admin/SettingsTab';
import { FinancesHubTab } from '@/components/admin/FinancesHubTab';
import { DevisAdminTab } from '@/components/admin/DevisAdminTab';
import { Ship } from 'lucide-react';
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb';
import { AdminLiveBadge } from '@/components/admin/AdminLiveBadge';
import { AdminNotificationBell } from '@/components/admin/AdminNotificationBell';
import { AdminMobileNav } from '@/components/admin/AdminMobileNav';
import { useAdminBrief } from '@/hooks/useAdminBrief';
import { cn } from '@/lib/utils';


const ALLOWED: AdminSection[] = ADMIN_NAV.map(n => n.id);

/**
 * URL slug → { section, tab? } resolver.
 * - Direct matches: new section IDs map to themselves.
 * - Legacy slugs (old structure) redirect to the unified hub + corresponding tab.
 */
type Resolved = { section: AdminSection; tab?: string };

const LEGACY_REDIRECTS: Record<string, Resolved> = {
  // Old dossier-related pages → unified Dossiers hub
  inbox:           { section: 'dossiers', tab: 'demandes' },
  requests:        { section: 'dossiers' },
  'dossiers-tous': { section: 'dossiers', tab: 'tous' },
  shipments:       { section: 'dossiers' },
  orders:          { section: 'dossiers' },
  reception:       { section: 'dossiers', tab: 'reception' },
  sourcing:        { section: 'dossiers', tab: 'sourcing' },

  // Terrain
  transporteurs:   { section: 'terrain', tab: 'gp' },
  livreurs:        { section: 'terrain', tab: 'livreurs' },
  'gp-operations': { section: 'terrain', tab: 'operations' },
  fret:            { section: 'terrain', tab: 'fret' },
  routier:         { section: 'dossiers', tab: 'routier' },

  // Départs
  departures:      { section: 'departs', tab: 'liste' },
  'departs-semaine': { section: 'departs', tab: 'semaine' },
  transport:       { section: 'hubs', tab: 'konnekt' },
  tracking:        { section: 'hubs', tab: 'tracking' },

  // Leads
  'manual-quotes': { section: 'leads', tab: 'particuliers' },
  enterprise:      { section: 'leads', tab: 'b2b' },

  // Finances — fusion Revenus + Paiements GP
  revenus:         { section: 'finances', tab: 'revenus' },
  'paiements-gp':  { section: 'finances', tab: 'paiements-gp' },
};

function resolveSlug(slug: string | undefined): { section: AdminSection; tab?: string; unknown: boolean } {
  if (!slug) return { section: 'overview', unknown: false };
  const legacy = LEGACY_REDIRECTS[slug];
  if (legacy) return { section: legacy.section, tab: legacy.tab, unknown: false };
  if ((ALLOWED as string[]).includes(slug)) return { section: slug as AdminSection, unknown: false };
  return { section: 'overview', unknown: true };
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { isStaff, isAdmin, isAgentSupport, isAgentTerrain, isLoading: roleLoading } = useUserRole();
  const [authChecked, setAuthChecked] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { section: pathSlug } = useParams<{ section?: string }>();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: brief } = useAdminBrief();


  // Resolve slug (handles both new IDs and legacy redirects)
  const resolved = resolveSlug(pathSlug);
  const section = resolved.section;
  const isUnknownSection = resolved.unknown;

  // If a legacy slug was used, normalize the URL to the new canonical path.
  useEffect(() => {
    if (!pathSlug) return;
    const legacy = LEGACY_REDIRECTS[pathSlug];
    if (legacy) {
      const search = legacy.tab ? `?tab=${legacy.tab}` : '';
      navigate(`/admin/${legacy.section}${search}`, { replace: true });
    }
  }, [pathSlug, navigate]);

  const setSection = (s: string) => {
    // Resolve legacy IDs (passed by OverviewTab quick actions) through the redirect map.
    const legacy = LEGACY_REDIRECTS[s];
    const target: AdminSection = legacy
      ? legacy.section
      : (ALLOWED as string[]).includes(s) ? (s as AdminSection) : 'overview';
    const tab = legacy?.tab;
    const search = tab ? `?tab=${tab}` : '';
    if (target === 'overview') {
      navigate('/admin');
    } else {
      navigate(`/admin/${target}${search}`);
    }
    if (searchParams.has('section')) {
      const sp = new URLSearchParams(searchParams);
      sp.delete('section');
      setSearchParams(sp, { replace: true });
    }
    setMobileOpen(false);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };

  // Un agent support qui atterrit sur une section interdite est renvoyé vers les dossiers.
  useEffect(() => {
    if (isAgentSupport && !pathSlug) navigate('/admin/dossiers', { replace: true });
    if (isAgentTerrain && !pathSlug) navigate('/admin/terrain', { replace: true });
  }, [isAgentSupport, isAgentTerrain, pathSlug, navigate]);

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
          <AdminSidebar active={section} onChange={setSection} isAdmin={isAdmin} isAgent={isAgentSupport} isTerrainAgent={isAgentTerrain} />
        </div>
        <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary bg-primary/8 px-2 py-1 rounded">
            <ShieldCheck className="w-3 h-3" /> {isAdmin ? 'Admin' : isAgentSupport ? 'Agent support' : isAgentTerrain ? 'Agent terrain' : 'Staff'}
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
              <AdminSidebar active={section} onChange={setSection} isAdmin={isAdmin} isAgent={isAgentSupport} isTerrainAgent={isAgentTerrain} />
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
        {/* Mobile header — icônes uniquement */}
        <header className="lg:hidden sticky top-0 z-40 bg-background/80 backdrop-blur border-b border-border px-2 py-1.5 flex items-center justify-between">
          <button onClick={() => setMobileOpen(true)} aria-label="Menu" className="p-2 rounded text-muted-foreground hover:text-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-0.5">
            <AdminLiveBadge className="mr-1" />
            <AdminNotificationBell />
            <button
              onClick={async () => { await supabase.auth.signOut(); navigate('/auth'); }}
              aria-label="Se déconnecter"
              className="p-2 rounded text-muted-foreground hover:text-destructive"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <button onClick={() => navigate('/app')} aria-label="Retour à l'app" className="p-2 rounded text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Desktop topbar — notifications */}
        <div className="hidden lg:flex sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border px-6 py-2 items-center justify-end gap-1">
          <AdminNotificationBell />
        </div>


        <main className={cn('flex-1 w-full flex flex-col min-h-0 pb-safe-nav lg:pb-safe-none', section === 'messages' ? 'p-0 max-w-none' : 'px-3 md:px-8 py-3 md:py-8 max-w-6xl')}>

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
          ) : isAgentSupport && !AGENT_SECTIONS.includes(section) ? (
            <div className="py-20 text-center">
              <ShieldCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-base font-semibold text-foreground">Section non autorisée</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Votre rôle « Agent service client » donne accès aux Dossiers, Messages et Clients uniquement.
              </p>
              <Button onClick={() => setSection('dossiers')} variant="outline" className="mt-4">
                Aller aux dossiers
              </Button>
            </div>
          ) : isAgentTerrain && !TERRAIN_AGENT_SECTIONS.includes(section) ? (
            <div className="py-20 text-center">
              <ShieldCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-base font-semibold text-foreground">Section non autorisée</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Votre rôle « Agent terrain » donne accès au module Fret routier (Terminal D) uniquement.
              </p>
              <Button onClick={() => setSection('terrain')} variant="outline" className="mt-4">
                Aller au fret routier
              </Button>
            </div>
          ) : (
            <>
              {section !== 'messages' && <div className="hidden md:block"><AdminBreadcrumb section={section} /></div>}
              {section === 'overview' && <OverviewTab onJump={setSection} />}
              {section === 'dossiers' && <DossiersHubTab fretOnly={isAgentTerrain} />}
              {section === 'departs'  && <DepartsHubTab />}
              {section === 'terrain'  && (isAdmin || isAgentTerrain) && <TerrainHubTab fretOnly={isAgentTerrain} />}
              {section === 'clients'  && <ClientsTab />}
              {section === 'messages' && <MessagesTab />}
              {section === 'leads'    && <LeadsHubTab />}
              {section === 'devis'    && <DevisAdminTab readOnly={isAgentTerrain} fretOnly={isAgentTerrain} />}
              {section === 'maritime' && (
                <div className="py-20 text-center">
                  <Ship className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-base font-semibold text-foreground">Maritime — bientôt disponible</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                    L'espace de gestion du fret maritime sera activé prochainement.
                  </p>
                </div>
              )}
              {section === 'finances' && isAdmin && <FinancesHubTab />}
              {section === 'boutique' && <BoutiqueTab />}
              {section === 'hubs'     && <HubsHubTab />}
              {section === 'settings' && <SettingsTab />}
            </>
          )}
        </main>
      </div>

      <AdminMobileNav
        active={section}
        onChange={setSection}
        onMore={() => setMobileOpen(true)}
        isAgent={isAgentSupport}
        isTerrainAgent={isAgentTerrain}
        unread={brief?.unreadMessages ?? 0}
      />
    </div>

  );
}

