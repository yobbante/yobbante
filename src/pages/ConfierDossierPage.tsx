import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Clock, Users, Sparkles } from 'lucide-react';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { DossierDialog } from '@/components/DossierDialog';
import { StickyWhatsAppBar } from '@/components/StickyWhatsAppBar';
import type { WarehouseCountry } from '@/lib/types';
import heroBg from '@/assets/hero-bg-dossier.jpg';

interface PresetState {
  product?: string;
  estimatedWeight?: string;
  origin?: WarehouseCountry;
  destination?: string;
  estimatedCost?: number;
}

const TRUST = [
  { icon: Clock, label: 'Devis sous 24h', desc: 'Réponse personnalisée par un agent dédié.' },
  { icon: ShieldCheck, label: 'Données protégées', desc: 'Conformité RGPD, aucune revente.' },
  { icon: Users, label: '+1 000 dossiers traités', desc: 'PME, e-commerçants, importateurs.' },
];

export default function ConfierDossierPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const preset = (location.state as { preset?: PresetState } | null)?.preset;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav />

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0 bg-center bg-cover opacity-40 dark:opacity-55 pointer-events-none"
            style={{ backgroundImage: `url(${heroBg})` }}
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/65 to-background pointer-events-none" aria-hidden />
          <div className="relative max-w-6xl mx-auto px-5 sm:px-6 pt-10 md:pt-16 pb-28 md:pb-16">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-12 items-start">
            {/* LEFT — narrative */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="lg:sticky lg:top-24"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-xs font-medium text-primary mb-5">
                <Sparkles className="w-3.5 h-3.5" /> Concierge logistique
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-[1.05] text-balance">
                Confiez-nous votre dossier d'import.
              </h1>
              <p className="mt-4 md:mt-5 text-base text-muted-foreground max-w-md text-pretty">
                Décrivez ce que vous voulez. Yobbanté gère sourcing, achat, transport, dédouanement et livraison —
                avec un seul interlocuteur.
              </p>

              <div className="mt-8 space-y-3">
                {TRUST.map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => navigate(-1)}
                className="mt-6 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Retour
              </button>
            </motion.div>

            {/* RIGHT — flow */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <DossierDialog
                open
                onOpenChange={(o) => { if (!o) navigate(-1); }}
                preset={preset}
                mode="page"
              />
            </motion.div>
          </div>
          </div>
        </section>
      </main>

      <PublicFooter />

      {/* Mobile-only sticky WhatsApp escalation */}
      <StickyWhatsAppBar
        message="Bonjour Yobbanté, j'ai une question pendant que je remplis mon dossier d'import."
        context="Besoin d'aide ? On répond en 5 min"
      />
    </div>
  );
}
