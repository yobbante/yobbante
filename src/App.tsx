import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "./pages/LandingPage";
import EnterprisesPage from "./pages/EnterprisesPage";
import DevisEntreprisePage from "./pages/DevisEntreprisePage";
import ExpedierPage from "./pages/ExpedierPage";
import AcheterPage from "./pages/AcheterPage";
import SourcingPage from "./pages/SourcingPage";
import TarifsPage from "./pages/TarifsPage";
import DevisPage from "./pages/DevisPage";
import DevisConfirmerPage from "./pages/DevisConfirmerPage";
import TrackPage from "./pages/TrackPage";
import BoutiquePage from "./pages/BoutiquePage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderConfirmationPage from "./pages/OrderConfirmationPage";
import { CookieBanner } from "@/components/CookieBanner";
import { FloatingWhatsApp } from "@/components/FloatingWhatsApp";

import { MaintenanceGate } from "@/components/MaintenanceGate";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import DossierDetail from "./pages/DossierDetail";
import AdminPage from "./pages/AdminPage";
import InboxImportPage from "./pages/admin/InboxImportPage";
import DeparturesWeekPage from "./pages/admin/DeparturesWeekPage";
import RelaisPage from "./pages/admin/RelaisPage";
import ParametresPage from "./pages/admin/ParametresPage";
import GuidePage from "./pages/admin/GuidePage";
import FlyersPage from "./pages/admin/FlyersPage";
import ForfaitsPage from "./pages/admin/ForfaitsPage";
import SuivreEntry from "./pages/SuivreEntry";
import AvisPage from "./pages/AvisPage";
import PayPage from "./pages/PayPage";
import BusinessPage from "./pages/BusinessPage";
import BusinessJoinPage from "./pages/BusinessJoinPage";
import BusinessPricingPage from "./pages/BusinessPricingPage";
import NotFound from "./pages/NotFound";
import RejoindreKonnektPage from "./pages/RejoindreKonnektPage";
import KonnektLandingPage from "./pages/KonnektLandingPage";
import { isKonnektDomain } from "@/lib/konnektDomain";
import ModifierPage from "./pages/ModifierPage";
import GpDepartPage from "./pages/gp/GpDepartPage";
import GpDashboardPage from "./pages/gp/GpDashboardPage";
import { usePackageNotifier } from "@/hooks/usePackageNotifier";
import { AdminOnlyGuard } from "@/components/AdminOnlyGuard";
import ConfidentialitePage from "./pages/legal/ConfidentialitePage";
import MentionsLegalesPage from "./pages/legal/MentionsLegalesPage";
import CguPage from "./pages/legal/CguPage";
import CgvPage from "./pages/legal/CgvPage";
import CookiesPage from "./pages/legal/CookiesPage";
import { isDekkSubdomain } from "@/lib/dekkDomain";
import { DekkLayout } from "@/components/dekk/DekkLayout";
import { DekkBoutiqueRedirect } from "@/components/dekk/DekkBoutiqueRedirect";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // 30s : évite les refetch en chaîne
      gcTime: 5 * 60_000,          // 5 min en cache mémoire
      refetchOnWindowFocus: false, // pas de refetch au focus (admin = onglets multiples)
      retry: 1,
    },
  },
});

function GlobalNotifiers() {
  usePackageNotifier();
  return null;
}

const DekkRoutes = () => (
  <Routes>
    {/* Boutique = home sur le sous-domaine */}
    <Route path="/" element={<DekkLayout><BoutiquePage /></DekkLayout>} />
    <Route path="/boutique" element={<Navigate to="/" replace />} />
    <Route path="/boutique/:id" element={<DekkLayout><ProductDetailPage /></DekkLayout>} />
    {/* Alias SEO-friendly futur */}
    <Route path="/produit/:id" element={<DekkLayout><ProductDetailPage /></DekkLayout>} />
    <Route path="/panier" element={<DekkLayout><CartPage /></DekkLayout>} />
    <Route path="/panier/checkout" element={<DekkLayout><CheckoutPage /></DekkLayout>} />
    <Route path="/panier/confirmation/:reference" element={<DekkLayout><OrderConfirmationPage /></DekkLayout>} />

    {/* Compte client mutualisé */}
    <Route path="/auth" element={<Auth />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/mon-compte" element={<Index />} />
    <Route path="/app" element={<Index />} />
    <Route path="/app/mes-envois" element={<Navigate to="/app?view=envois" replace />} />
    <Route path="/app/mes-receptions" element={<Navigate to="/app?view=receptions" replace />} />
    <Route path="/app/mon-sourcing" element={<Navigate to="/app?view=sourcing" replace />} />
    <Route path="/app/profil" element={<Navigate to="/app?view=profile" replace />} />
    <Route path="/app/dossier/:id" element={<DossierDetail />} />

    {/* Suivi colis partagé */}
    <Route path="/suivre" element={<SuivreEntry />} />
    <Route path="/suivre/:trackingNumber" element={<SuivreEntry />} />
    <Route path="/track" element={<TrackPage />} />
    <Route path="/track/:id" element={<TrackPage />} />
    <Route path="/avis/:trackingId" element={<AvisPage />} />
    <Route path="/pay/:trackingId" element={<PayPage />} />
    <Route path="/modifier/:token" element={<ModifierPage />} />
    <Route path="/gp/depart/:ref" element={<GpDepartPage />} />
    <Route path="/gp/:ref" element={<GpDashboardPage />} />
    <Route path="/gp/:ref/departures" element={<GpDashboardPage />} />



    {/* Admin accessible des deux côtés (session partagée) */}
    <Route path="/admin" element={<AdminPage />} />
    <Route path="/admin/inbox/import" element={<InboxImportPage />} />
    <Route path="/admin/departs-semaine" element={<DeparturesWeekPage />} />
    <Route path="/admin/relais" element={<RelaisPage />} />
    <Route path="/admin/parametres" element={<ParametresPage />} />
    <Route path="/admin/guide" element={<GuidePage />} />
    <Route path="/admin/flyers" element={<FlyersPage />} />
    <Route path="/admin/:section" element={<AdminPage />} />

    {/* Pages légales mutualisées */}
    <Route path="/confidentialite" element={<ConfidentialitePage />} />
    <Route path="/mentions-legales" element={<MentionsLegalesPage />} />
    <Route path="/cgu" element={<CguPage />} />
    <Route path="/cgv" element={<CgvPage />} />
    <Route path="/cookies" element={<CookiesPage />} />

    {/* Toute autre URL renvoie vers le site principal */}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const MainRoutes = () => (
  <Routes>
    <Route path="/" element={<LandingPage />} />
    {/* New 2-CTAs entry points */}
    <Route path="/expedier" element={<ExpedierPage />} />
    <Route path="/expedier/:mode" element={<ExpedierPage />} />
    {/* Sourcing — canonical URL. /acheter kept as alias for the merchant-mode selection page only when ?mode=recevoir is needed. */}
    <Route path="/sourcing" element={<SourcingPage />} />
    <Route path="/acheter" element={<Navigate to="/sourcing" replace />} />
    <Route path="/acheter/sourcing" element={<Navigate to="/sourcing" replace />} />
    <Route path="/acheter/recevoir" element={<AcheterPage />} />
    <Route path="/tarifs" element={<TarifsPage />} />
    <Route path="/devis" element={<DevisPage />} />
    <Route path="/devis/confirmer" element={<DevisConfirmerPage />} />
    <Route path="/track" element={<TrackPage />} />
    <Route path="/track/:id" element={<TrackPage />} />
    {/* Boutique : en prod redirige vers dekk.yobbante.com, sinon rend en local */}
    <Route path="/boutique" element={<DekkBoutiqueRedirect><DekkLayout><BoutiquePage /></DekkLayout></DekkBoutiqueRedirect>} />
    <Route path="/boutique/:id" element={<DekkBoutiqueRedirect><DekkLayout><ProductDetailPage /></DekkLayout></DekkBoutiqueRedirect>} />
    <Route path="/panier" element={<DekkBoutiqueRedirect><DekkLayout><CartPage /></DekkLayout></DekkBoutiqueRedirect>} />
    <Route path="/panier/checkout" element={<DekkBoutiqueRedirect><DekkLayout><CheckoutPage /></DekkLayout></DekkBoutiqueRedirect>} />
    <Route path="/panier/confirmation/:reference" element={<DekkBoutiqueRedirect><DekkLayout><OrderConfirmationPage /></DekkLayout></DekkBoutiqueRedirect>} />
    {/* Spec route aliases → existing pages */}
    <Route path="/confirmation" element={<Navigate to="/devis/confirmer" replace />} />
    <Route path="/reception" element={<Navigate to="/expedier/recevoir" replace />} />
    <Route path="/mon-compte" element={<Navigate to="/app" replace />} />
    <Route path="/mon-compte/envois" element={<Navigate to="/app?view=envois" replace />} />
    {/* Legacy public URLs → folded into the 2 user-facing flows */}
    <Route path="/obtenir-adresse" element={<Navigate to="/expedier" replace />} />
    <Route path="/confier-dossier" element={<Navigate to="/acheter" replace />} />
    <Route path="/services" element={<Navigate to="/" replace />} />
    <Route path="/simulateur" element={<Navigate to="/expedier" replace />} />
    {/* B2B funnel kept for sales — not part of the public 2-CTA promise */}
    <Route path="/entreprises" element={<EnterprisesPage />} />
    <Route path="/devis-entreprise" element={<DevisEntreprisePage />} />
    <Route path="/auth" element={<Auth />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/app" element={<Index />} />
    <Route path="/app/mes-envois" element={<Navigate to="/app?view=envois" replace />} />
    <Route path="/app/mes-receptions" element={<Navigate to="/app?view=receptions" replace />} />
    <Route path="/app/mon-sourcing" element={<Navigate to="/app?view=sourcing" replace />} />
    <Route path="/app/profil" element={<Navigate to="/app?view=profile" replace />} />
    <Route path="/app/dossier/:id" element={<DossierDetail />} />
    <Route path="/admin" element={<AdminPage />} />
    <Route path="/admin/inbox/import" element={<InboxImportPage />} />
    <Route path="/admin/departs-semaine" element={<DeparturesWeekPage />} />
    <Route path="/admin/relais" element={<RelaisPage />} />
    <Route path="/admin/parametres" element={<ParametresPage />} />
    <Route path="/admin/guide" element={<GuidePage />} />
    <Route path="/admin/flyers" element={<FlyersPage />} />
    <Route path="/admin/:section" element={<AdminPage />} />
    {/* Canonical tracking URL — /suivre redirects to /track */}
    <Route path="/suivre" element={<SuivreEntry />} />
    <Route path="/suivre/:trackingNumber" element={<SuivreEntry />} />
    {/* Public review + payment pages (WhatsApp deep links) */}
    <Route path="/avis/:trackingId" element={<AvisPage />} />
    <Route path="/pay/:trackingId" element={<PayPage />} />
    <Route path="/modifier/:token" element={<ModifierPage />} />
    <Route path="/gp/depart/:ref" element={<GpDepartPage />} />
    <Route path="/gp/:ref" element={<GpDashboardPage />} />
    <Route path="/gp/:ref/departures" element={<GpDashboardPage />} />


    <Route path="/business" element={<BusinessPage />} />
    <Route path="/business/join" element={<BusinessJoinPage />} />
    <Route path="/business/pricing" element={<BusinessPricingPage />} />
    <Route path="/rejoindre-konnekt" element={<RejoindreKonnektPage />} />
    <Route path="/konnekt" element={<KonnektLandingPage />} />
    <Route path="/konnekt/inscription" element={<Navigate to="/konnekt#inscription" replace />} />
    {/* Legal pages */}
    <Route path="/confidentialite" element={<ConfidentialitePage />} />
    <Route path="/mentions-legales" element={<MentionsLegalesPage />} />
    <Route path="/cgu" element={<CguPage />} />
    <Route path="/cgv" element={<CgvPage />} />
    <Route path="/cookies" element={<CookiesPage />} />
    {/* Legacy legal aliases */}
    <Route path="/legal/cgu" element={<Navigate to="/cgu" replace />} />
    <Route path="/legal/confidentialite" element={<Navigate to="/confidentialite" replace />} />
    <Route path="/legal/mentions" element={<Navigate to="/mentions-legales" replace />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const KonnektRoutes = () => (
  <Routes>
    <Route path="/" element={<KonnektLandingPage />} />
    <Route path="/inscription" element={<Navigate to="/#inscription" replace />} />
    <Route path="*" element={<KonnektLandingPage />} />
  </Routes>
);

const App = () => {
  const dekkMode = isDekkSubdomain();
  const konnektMode = !dekkMode && isKonnektDomain();
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <MaintenanceGate>
          <GlobalNotifiers />
          <AdminOnlyGuard />
          {dekkMode ? <DekkRoutes /> : konnektMode ? <KonnektRoutes /> : <MainRoutes />}
          {!dekkMode && !konnektMode && <FloatingWhatsApp />}
          <CookieBanner />
          
        </MaintenanceGate>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
