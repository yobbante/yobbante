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
import { InstallAppPrompt } from "@/components/InstallAppPrompt";
import { MaintenanceGate } from "@/components/MaintenanceGate";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import DossierDetail from "./pages/DossierDetail";
import AdminPage from "./pages/AdminPage";
import InboxImportPage from "./pages/admin/InboxImportPage";
import DeparturesWeekPage from "./pages/admin/DeparturesWeekPage";
import SuivreEntry from "./pages/SuivreEntry";
import AvisPage from "./pages/AvisPage";
import PayPage from "./pages/PayPage";
import BusinessPage from "./pages/BusinessPage";
import BusinessJoinPage from "./pages/BusinessJoinPage";
import BusinessPricingPage from "./pages/BusinessPricingPage";
import NotFound from "./pages/NotFound";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <MaintenanceGate>
          <GlobalNotifiers />
          <AdminOnlyGuard />
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
            <Route path="/boutique" element={<BoutiquePage />} />
            <Route path="/boutique/:id" element={<ProductDetailPage />} />
            <Route path="/panier" element={<CartPage />} />
            <Route path="/panier/checkout" element={<CheckoutPage />} />
            <Route path="/panier/confirmation/:reference" element={<OrderConfirmationPage />} />
            {/* Spec route aliases → existing pages */}
            <Route path="/confirmation" element={<Navigate to="/devis/confirmer" replace />} />
            <Route path="/reception" element={<Navigate to="/expedier/recevoir" replace />} />
            <Route path="/sourcing" element={<Navigate to="/acheter" replace />} />
            <Route path="/mon-compte" element={<Navigate to="/app" replace />} />
            <Route path="/mon-compte/envois" element={<Navigate to="/app?view=envois" replace />} />
            {/* Legacy admin alias removed — handled by /admin/:section below */}
            {/* Legacy public URLs → folded into the 2 user-facing flows */}
            <Route path="/obtenir-adresse" element={<Navigate to="/expedier" replace />} />
            <Route path="/confier-dossier" element={<Navigate to="/acheter" replace />} />
            <Route path="/services" element={<Navigate to="/" replace />} />
            <Route path="/simulateur" element={<Navigate to="/expedier" replace />} />
            {/* B2B funnel kept for sales — not part of the public 2-CTA promise */}
            <Route path="/entreprises" element={<EnterprisesPage />} />
            <Route path="/devis-entreprise" element={<DevisEntreprisePage />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/app" element={<Index />} />
            <Route path="/app/dossier/:id" element={<DossierDetail />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/inbox/import" element={<InboxImportPage />} />
            <Route path="/admin/departs-semaine" element={<DeparturesWeekPage />} />
            <Route path="/admin/:section" element={<AdminPage />} />
            {/* Canonical tracking URL — /suivre redirects to /track */}
            <Route path="/suivre" element={<SuivreEntry />} />
            <Route path="/suivre/:trackingNumber" element={<SuivreEntry />} />
            {/* Public review + payment pages (WhatsApp deep links) */}
            <Route path="/avis/:trackingId" element={<AvisPage />} />
            <Route path="/pay/:trackingId" element={<PayPage />} />
            <Route path="/business" element={<BusinessPage />} />
            <Route path="/business/join" element={<BusinessJoinPage />} />
            <Route path="/business/pricing" element={<BusinessPricingPage />} />
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
          <FloatingWhatsApp />
          <CookieBanner />
          <InstallAppPrompt />
        </MaintenanceGate>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
