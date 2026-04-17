import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "./pages/LandingPage";
import ServicesPage from "./pages/ServicesPage";
import SimulatorPage from "./pages/SimulatorPage";
import EnterprisesPage from "./pages/EnterprisesPage";
import ConfierDossierPage from "./pages/ConfierDossierPage";
import ObtenirAdressePage from "./pages/ObtenirAdressePage";
import DevisEntreprisePage from "./pages/DevisEntreprisePage";
import { CookieBanner } from "@/components/CookieBanner";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import DossierDetail from "./pages/DossierDetail";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/simulateur" element={<SimulatorPage />} />
          <Route path="/entreprises" element={<EnterprisesPage />} />
          <Route path="/confier-dossier" element={<ConfierDossierPage />} />
          <Route path="/obtenir-adresse" element={<ObtenirAdressePage />} />
          <Route path="/devis-entreprise" element={<DevisEntreprisePage />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/app" element={<Index />} />
          <Route path="/app/dossier/:id" element={<DossierDetail />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <CookieBanner />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
