import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { SmartImportDialog } from '@/components/SmartImportDialog';
import { DossierDialog } from '@/components/DossierDialog';
import { SmartImportInline } from '@/components/SmartImportInline';
import { Sparkles, ArrowRight, ExternalLink, FolderPlus, MapPin } from 'lucide-react';
import type { WarehouseCountry } from '@/lib/types';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

const SERVICES = [
  { num: '01', title: 'Import Complet', desc: 'Sourcing, achat, réception, transport, dédouanement, livraison. Yobbanté gère chaque maillon.' },
  { num: '02', title: 'Sourcing International', desc: 'Recherche, qualification et négociation avec les usines en Chine, Dubai, Europe et USA.' },
  { num: '03', title: 'Adresses Internationales', desc: 'Une adresse dédiée dans 6 pays pour acheter sur Amazon, Alibaba, 1688 et tout site marchand.' },
  { num: '04', title: 'Groupage', desc: 'Consolidation maritime, aérienne ou routière. Économisez jusqu\'à 70% sur vos coûts de transport.' },
  { num: '05', title: 'Dédouanement', desc: 'Préparation documentaire, optimisation des taxes, conformité réglementaire à l\'import et à l\'export.' },
  { num: '06', title: 'Entreposage', desc: 'Stockage temporaire ou longue durée dans nos entrepôts internationaux.' },
  { num: '07', title: 'Livraison Finale', desc: 'À domicile, en point relais ou en entreprise. Réseau partenaire en Afrique de l\'Ouest et au-delà.' },
];

const WAREHOUSES = [
  { flag: '🇫🇷', country: 'France', desc: 'Hub européen' },
  { flag: '🇨🇦', country: 'Canada', desc: 'Amérique du Nord' },
  { flag: '🇨🇳', country: 'Chine', desc: 'Direct usines' },
  { flag: '🇦🇪', country: 'Dubai', desc: 'Moyen-Orient' },
  { flag: '🇩🇪', country: 'Allemagne', desc: 'Europe avancée' },
  { flag: '🇺🇸', country: 'États-Unis', desc: 'E-commerce US' },
];

const ADDRESS_STEPS = [
  'Recevez votre adresse Yobbanté unique dans le pays de votre choix',
  'Commandez sur Amazon, Alibaba, 1688 ou toute boutique en ligne',
  'Nous réceptionnons et vérifions votre colis',
  'Stockage, regroupement ou reconditionnement selon vos besoins',
  'Expédition vers votre destination finale',
];

const METRICS = [
  { value: '6', label: 'Entrepôts' },
  { value: '150+', label: 'Pays desservis' },
  { value: '48h', label: 'Réponse dossier' },
  { value: '10K+', label: 'Colis traités' },
];

export default function LandingPage() {
  const [smartOpen, setSmartOpen] = useState(false);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [preset, setPreset] = useState<{ product: string; estimatedWeight: string; origin: WarehouseCountry; destination: string; estimatedCost: number } | undefined>();

  const openDossierWithPreset = (p: { product: string; weight: number; origin: WarehouseCountry; destination: string; estimatedCost: number }) => {
    setPreset({ product: p.product, estimatedWeight: String(p.weight), origin: p.origin, destination: p.destination, estimatedCost: p.estimatedCost });
    setDossierOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ───── 1. Nav ───── */}
      <nav className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold tracking-tight text-foreground">YOBBANTÉ</Link>
          <div className="hidden md:flex items-center gap-7">
            <Link to="/services" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Services</Link>
            <a href="#warehouses" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Adresses</a>
            <Link to="/simulateur" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Simulateur</Link>
            <button onClick={() => setDossierOpen(true)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Dossier</button>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Connexion</Link>
            <Link to="/auth" className="text-sm font-semibold bg-foreground text-background px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
              Commencer
            </Link>
          </div>
        </div>
      </nav>

      {/* ───── 2. Hero ───── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 pt-14 pb-20 md:pt-32 md:pb-32">
        <div className="grid md:grid-cols-[1.2fr_1fr] gap-10 md:gap-16 items-center">
          <div className="text-center md:text-left">
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-xs font-medium text-muted-foreground mb-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Opérateur logistique international
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
              className="text-[2.5rem] sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] md:leading-[1.02] text-foreground text-balance"
            >
              Importez depuis n'importe quel pays.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-5 md:mt-6 text-base md:text-lg text-muted-foreground max-w-md mx-auto md:mx-0 leading-relaxed text-pretty"
            >
              Yobbanté gère votre chaîne logistique de A à Z — sourcing, achat, groupage, transport, dédouanement et livraison finale.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-7 md:mt-8 flex flex-col sm:flex-row gap-3 sm:justify-center md:justify-start"
            >
              <button
                onClick={() => setDossierOpen(true)}
                className="inline-flex items-center justify-center gap-2 text-sm font-semibold bg-foreground text-background px-6 py-3.5 rounded-xl hover:opacity-90 transition-opacity"
              >
                <FolderPlus className="w-4 h-4" /> Confier mon dossier
              </button>
              <Link
                to="/auth"
                className="inline-flex items-center justify-center gap-2 text-sm font-semibold border border-border text-foreground px-6 py-3.5 rounded-xl hover:bg-secondary transition-colors"
              >
                <MapPin className="w-4 h-4" /> Obtenir une adresse
              </Link>
            </motion.div>
          </div>

          {/* Hero visual: 3 product previews */}
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className="space-y-3 hidden md:block"
          >
            <div className="bg-foreground text-background rounded-xl p-5">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider opacity-60 mb-2">
                <FolderPlus className="w-3.5 h-3.5" /> Dossier YBT-2026-0173
              </div>
              <p className="text-sm font-semibold">50 smartphones · Chine → Dakar</p>
              <div className="mt-3 h-1 bg-background/20 rounded-full overflow-hidden">
                <div className="h-full w-1/2 bg-background rounded-full" />
              </div>
              <p className="text-[11px] opacity-60 mt-2">En transit · ETA 6 jours</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                <Sparkles className="w-3.5 h-3.5" /> Smart estimation
              </div>
              <p className="text-sm font-semibold text-foreground">12 kg · CN → SN</p>
              <div className="flex items-baseline gap-3 mt-2">
                <span className="text-2xl font-bold text-foreground">175 €</span>
                <span className="text-xs text-muted-foreground">5–8 jours</span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                <MapPin className="w-3.5 h-3.5" /> Adresse internationale
              </div>
              <p className="text-sm font-semibold text-foreground">🇫🇷 Yobbanté France</p>
              <p className="text-xs font-mono font-semibold text-foreground mt-1">YBT-FR-7842</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ───── 3. Two Pillars ───── */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3 text-center md:text-left">Deux façons de travailler avec nous</p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight max-w-2xl text-balance text-center md:text-left mx-auto md:mx-0">Confiez-nous tout. Ou juste le transport.</h2>

          <div className="grid md:grid-cols-2 gap-px bg-border mt-16 rounded-2xl overflow-hidden">
            {/* Pilier 1 */}
            <div className="bg-background p-8 md:p-10">
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-3">A · ENTREPRISES</div>
              <h3 className="text-2xl md:text-3xl font-bold tracking-tight">Confier mon import</h3>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-md">
                Vous nous décrivez votre besoin. Nous sourçons, achetons, expédions, dédouanons et livrons.
                Un seul interlocuteur pour toute la chaîne logistique.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-foreground">
                <li className="flex items-start gap-2"><span className="text-muted-foreground">→</span> Sourcing fournisseur inclus</li>
                <li className="flex items-start gap-2"><span className="text-muted-foreground">→</span> Gestion documentaire douane</li>
                <li className="flex items-start gap-2"><span className="text-muted-foreground">→</span> Optimisation transport multi-modal</li>
              </ul>
              <button
                onClick={() => setDossierOpen(true)}
                className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:gap-3 transition-all"
              >
                Confier mon dossier <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            {/* Pilier 2 */}
            <div className="bg-background p-8 md:p-10">
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-3">B · PARTICULIERS & E-COMMERCE</div>
              <h3 className="text-2xl md:text-3xl font-bold tracking-tight">Adresses + groupage</h3>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-md">
                Recevez gratuitement une adresse dans 6 pays. Achetez où vous voulez, nous réceptionnons,
                groupons et expédions vers votre destination.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-foreground">
                <li className="flex items-start gap-2"><span className="text-muted-foreground">→</span> 6 adresses internationales offertes</li>
                <li className="flex items-start gap-2"><span className="text-muted-foreground">→</span> Groupage automatique pour économiser</li>
                <li className="flex items-start gap-2"><span className="text-muted-foreground">→</span> Suivi temps réel par colis</li>
              </ul>
              <Link
                to="/auth"
                className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:gap-3 transition-all"
              >
                Créer mon compte <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ───── 4. 7 Services ───── */}
      <section id="services" className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="grid md:grid-cols-[1fr_2fr] gap-12">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Services</p>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.05]">7 maillons,<br />une chaîne.</h2>
              <Link
                to="/services"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:gap-3 transition-all"
              >
                Tous les détails <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div>
              {SERVICES.map((s, i) => (
                <motion.div
                  key={s.num}
                  variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                  className="grid grid-cols-[40px_1fr] gap-6 py-5 border-t border-border first:border-t-0"
                >
                  <span className="text-xs font-mono text-muted-foreground pt-1">{s.num}</span>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{s.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───── 5. Warehouses ───── */}
      <section id="warehouses" className="bg-secondary border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <motion.h2 variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0}
            className="text-3xl md:text-5xl font-bold tracking-tight text-balance text-center md:text-left">
            6 entrepôts. Une logistique mondiale.
          </motion.h2>
          <motion.p variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1}
            className="text-base text-muted-foreground mt-4 max-w-lg mx-auto md:mx-0 text-pretty text-center md:text-left">
            Une adresse dédiée gratuite dans chaque pays. Commandez où vous voulez, nous réceptionnons.
          </motion.p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-12">
            {WAREHOUSES.map((w, i) => (
              <motion.div
                key={w.country}
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                className="bg-card rounded-xl p-5 hover:shadow-md transition-shadow"
              >
                <span className="text-3xl">{w.flag}</span>
                <p className="text-sm font-semibold text-foreground mt-3">{w.country}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{w.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── 6. How Addresses Work ───── */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-start">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Comment ça marche</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight mb-10">
                Vos adresses internationales.
              </h2>
              <div className="space-y-6">
                {ADDRESS_STEPS.map((step, i) => (
                  <motion.div key={i}
                    variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                    className="flex gap-4"
                  >
                    <span className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-sm text-foreground leading-relaxed pt-1">{step}</p>
                  </motion.div>
                ))}
              </div>
            </div>
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={2}
              className="hidden md:block"
            >
              <div className="bg-secondary rounded-2xl p-6">
                <p className="text-xs text-muted-foreground mb-4 font-medium">Exemple d'adresse</p>
                <div className="bg-card rounded-xl p-5 border border-border">
                  <p className="text-xs text-muted-foreground">Destinataire</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">Yobbanté — Amadou Diallo</p>
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground">Adresse</p>
                    <p className="text-sm text-foreground mt-0.5">12 Rue du Commerce</p>
                    <p className="text-sm text-foreground">75015 Paris, France</p>
                  </div>
                  <div className="mt-3 bg-secondary rounded-lg px-3 py-2">
                    <p className="text-xs text-muted-foreground">Code identifiant</p>
                    <p className="text-sm font-mono font-bold text-foreground mt-0.5">YBT-FR-7842</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ───── 7. Smart Import — full bleed ───── */}
      <section className="bg-secondary border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card text-xs font-medium text-muted-foreground mb-5">
              <Sparkles className="w-3.5 h-3.5" /> Smart Import Assistant
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.05]">
              Estimez votre import.<br />En direct.
            </h2>
            <p className="text-base text-muted-foreground mt-4 max-w-lg mx-auto">
              Décrivez votre produit. Notre IA propose 3 routes — express, équilibrée, économique — avec coût et délai.
            </p>
          </div>
          <SmartImportInline onConfideDossier={openDossierWithPreset} />
          <div className="mt-6 text-center">
            <Link to="/simulateur" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Ouvrir le simulateur en plein écran →
            </Link>
          </div>
        </div>
      </section>

      {/* ───── 8. Numbers — Dark inversion ───── */}
      <section className="bg-foreground py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {METRICS.map((m, i) => (
              <motion.div key={m.label}
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                className="text-center"
              >
                <p className="text-4xl md:text-6xl font-bold text-background tracking-tight">{m.value}</p>
                <p className="text-sm text-background/60 mt-2">{m.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── 9. Konnekt Bridge ───── */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="rounded-2xl border border-border p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-5 md:gap-8">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Petit colis ?</p>
              <h3 className="text-xl md:text-2xl font-bold text-foreground mt-2">
                Moins de 30 kg ? Utilisez Konnekt.
              </h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                Notre app sœur Konnekt est optimisée pour les petits envois individuels.
                Yobbanté reste votre choix pour les imports complets et le B2B.
              </p>
            </div>
            <a
              href="https://konnekt.app"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold border border-border text-foreground px-5 py-3 rounded-xl hover:bg-secondary transition-colors"
            >
              Découvrir Konnekt <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* ───── 10. Final CTA ───── */}
      <section className="border-t border-border">
        <div className="max-w-3xl mx-auto px-6 py-24 md:py-32 text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            Prêt à importer<br />sans stress ?
          </h2>
          <p className="text-base text-muted-foreground mt-4 max-w-md mx-auto">
            Confiez votre dossier en 3 minutes ou créez un compte gratuit pour vos adresses internationales.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setDossierOpen(true)}
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold bg-foreground text-background px-6 py-3.5 rounded-xl hover:opacity-90 transition-opacity"
            >
              <FolderPlus className="w-4 h-4" /> Confier mon dossier
            </button>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center text-sm font-semibold border border-border text-foreground px-6 py-3.5 rounded-xl hover:bg-secondary transition-colors"
            >
              Créer un compte gratuit
            </Link>
          </div>
        </div>
      </section>

      {/* ───── 11. Footer ───── */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <p className="text-base font-bold text-foreground">YOBBANTÉ</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                Opérateur logistique international. Sourcing, transport, dédouanement, livraison — un seul partenaire.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Solutions</p>
              <div className="space-y-2">
                <Link to="/services" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Particuliers</Link>
                <Link to="/services" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">E-commerçants</Link>
                <Link to="/services" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Entreprises</Link>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Plateforme</p>
              <div className="space-y-2">
                <Link to="/services" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Services</Link>
                <Link to="/simulateur" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Simulateur</Link>
                <button onClick={() => setDossierOpen(true)} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Confier un dossier</button>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row justify-between gap-3">
            <p className="text-xs text-muted-foreground">© 2026 Yobbanté. Tous droits réservés.</p>
            <div className="flex gap-5">
              <span className="text-xs text-muted-foreground">Conditions générales</span>
              <span className="text-xs text-muted-foreground">Confidentialité</span>
            </div>
          </div>
        </div>
      </footer>

      <SmartImportDialog open={smartOpen} onOpenChange={setSmartOpen} onConfideDossier={openDossierWithPreset} />
      <DossierDialog open={dossierOpen} onOpenChange={setDossierOpen} preset={preset} />
    </div>
  );
}
