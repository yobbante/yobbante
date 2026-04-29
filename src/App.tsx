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
import { CookieBanner } from "@/components/CookieBanner";
import { InstallAppPrompt } from "@/components/InstallAppPrompt";
import { MaintenanceGate } from "@/components/MaintenanceGate";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import DossierDetail from "./pages/DossierDetail";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";
import { usePackageNotifier } from "@/hooks/usePackageNotifier";
import { AdminOnlyGuard } from "@/components/AdminOnlyGuard";

const queryClient = new QueryClient();

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
            <Route path="/acheter" element={<AcheterPage />} />
            <Route path="/acheter/:mode" element={<AcheterPage />} />
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
            <Route path="*" element={<NotFound />} />
          </Routes>
          <CookieBanner />
          <InstallAppPrompt />
        </MaintenanceGate>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
