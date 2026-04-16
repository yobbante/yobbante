import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { SmartImportDialog } from '@/components/SmartImportDialog';
import { Sparkles } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

function AddressCardPreview({ flag, country, code }: { flag: string; country: string; code: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{flag}</span>
        <span className="text-sm font-semibold text-foreground">{country}</span>
      </div>
      <div className="bg-secondary rounded-lg px-3 py-2">
        <p className="text-xs text-muted-foreground mb-0.5">Votre adresse</p>
        <p className="text-sm font-mono font-semibold text-foreground">YBT-{code}</p>
      </div>
    </div>
  );
}

const SERVICES = [
  { num: '01', title: 'Import Complet', desc: 'Gestion de A à Z : sourcing, achat, réception, transport, dédouanement et livraison finale.' },
  { num: '02', title: 'Adresses Internationales', desc: 'Recevez une adresse dans 6 pays. Commandez partout, nous réceptionnons pour vous.' },
  { num: '03', title: 'Groupage', desc: 'Consolidez vos colis pour réduire les coûts. LCL, aérien ou routier selon vos besoins.' },
  { num: '04', title: 'Sourcing International', desc: 'Recherche fournisseur, négociation et vérification qualité avant expédition.' },
  { num: '05', title: 'Dédouanement', desc: 'Gestion documentaire, optimisation des taxes et conformité réglementaire.' },
  { num: '06', title: 'Livraison Finale', desc: 'À domicile, en point relais ou en entreprise. Partout dans le monde.' },
];

const WAREHOUSES = [
  { flag: '🇫🇷', country: 'France', desc: 'Hub européen principal' },
  { flag: '🇨🇦', country: 'Canada', desc: 'Accès Amérique du Nord' },
  { flag: '🇨🇳', country: 'Chine', desc: 'Direct usines et fournisseurs' },
  { flag: '🇦🇪', country: 'Dubai', desc: 'Carrefour Moyen-Orient' },
  { flag: '🇩🇪', country: 'Allemagne', desc: 'Logistique européenne avancée' },
  { flag: '🇺🇸', country: 'États-Unis', desc: 'E-commerce US simplifié' },
];

const STEPS = [
  { num: '1', title: 'Achetez', desc: 'Sur n\'importe quel site mondial' },
  { num: '2', title: 'Adresse Yobbanté', desc: 'Utilisez votre adresse dédiée' },
  { num: '3', title: 'Réception', desc: 'Nous réceptionnons vos colis' },
  { num: '4', title: 'Groupage', desc: 'Consolidation et vérification' },
  { num: '5', title: 'Livraison', desc: 'Expédié chez vous' },
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
  { value: '48h', label: 'Livraison express' },
  { value: '10K+', label: 'Colis traités' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold tracking-tight text-foreground">
            YOBBANTÉ
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#services" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Services</a>
            <a href="#warehouses" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Adresses</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Comment ça marche</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Connexion
            </Link>
            <Link
              to="/auth"
              className="text-sm font-semibold bg-foreground text-background px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
              Commencer
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24 md:pt-32 md:pb-32">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-xs font-medium text-muted-foreground mb-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Opérationnel dans 6 pays
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-foreground"
            >
              Achetez partout.
              <br />
              Recevez chez vous.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-5 text-lg text-muted-foreground max-w-md leading-relaxed"
            >
              Yobbanté gère toute votre chaîne logistique : réception, groupage, transport et livraison depuis 6 entrepôts internationaux.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-8 flex flex-col sm:flex-row gap-3"
            >
              <Link
                to="/auth"
                className="inline-flex items-center justify-center text-sm font-semibold bg-foreground text-background px-6 py-3.5 rounded-xl hover:opacity-90 transition-opacity"
              >
                Confier mon dossier
              </Link>
              <a
                href="#how-addresses-work"
                className="inline-flex items-center justify-center text-sm font-semibold border border-border text-foreground px-6 py-3.5 rounded-xl hover:bg-secondary transition-colors"
              >
                Obtenir une adresse
              </a>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="space-y-3 hidden md:block"
          >
            <AddressCardPreview flag="🇫🇷" country="France" code="FR-7842" />
            <AddressCardPreview flag="🇨🇳" country="Chine" code="CN-3291" />
            <AddressCardPreview flag="🇺🇸" country="États-Unis" code="US-5103" />
          </motion.div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-20 md:py-28">
        <motion.h2
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          custom={0}
          className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-16 text-center"
        >
          Comment ça marche
        </motion.h2>
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-8 md:gap-0">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-4 left-[10%] right-[10%] h-px bg-border" />
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={i}
              className="relative flex md:flex-col items-center md:items-center gap-4 md:gap-3 flex-1 text-left md:text-center"
            >
              <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold flex-shrink-0 relative z-10">
                {step.num}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="max-w-6xl mx-auto px-6 py-20 md:py-28">
        <motion.h2
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          custom={0}
          className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-12"
        >
          Nos services
        </motion.h2>
        <div className="grid md:grid-cols-2 gap-x-16 gap-y-0">
          {SERVICES.map((service, i) => (
            <motion.div
              key={service.num}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={i}
              className="py-6 border-l-2 border-border pl-6 hover:border-foreground transition-colors"
            >
              <span className="text-xs font-mono text-muted-foreground">{service.num}</span>
              <h3 className="text-base font-semibold text-foreground mt-1">{service.title}</h3>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{service.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Warehouses */}
      <section id="warehouses" className="bg-secondary py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <motion.h2
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={0}
            className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-4"
          >
            6 entrepôts dans le monde
          </motion.h2>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
            className="text-sm text-muted-foreground mb-12 max-w-lg"
          >
            Recevez une adresse dédiée dans chacun de nos entrepôts. Commandez depuis n'importe quel site.
          </motion.p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {WAREHOUSES.map((w, i) => (
              <motion.div
                key={w.country}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
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

      {/* How Addresses Work */}
      <section id="how-addresses-work" className="max-w-6xl mx-auto px-6 py-20 md:py-28">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-start">
          <div>
            <motion.h2
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={0}
              className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-10"
            >
              Vos adresses internationales
            </motion.h2>
            <div className="space-y-6">
              {ADDRESS_STEPS.map((step, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  custom={i}
                  className="flex gap-4"
                >
                  <span className="w-6 h-6 rounded-full bg-secondary text-foreground flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step}</p>
                </motion.div>
              ))}
            </div>
          </div>
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={2}
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
      </section>

      {/* Numbers — Dark inversion */}
      <section className="bg-foreground py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {METRICS.map((m, i) => (
              <motion.div
                key={m.label}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                className="text-center"
              >
                <p className="text-3xl md:text-5xl font-bold text-background">{m.value}</p>
                <p className="text-sm text-background/60 mt-1">{m.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 md:py-28 text-center">
        <motion.h2
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          custom={0}
          className="text-2xl md:text-4xl font-bold tracking-tight text-foreground"
        >
          Commencez aujourd'hui
        </motion.h2>
        <motion.p
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          custom={1}
          className="text-sm text-muted-foreground mt-3 max-w-md mx-auto"
        >
          Créez votre compte et recevez vos adresses internationales en quelques minutes.
        </motion.p>
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          custom={2}
        >
          <Link
            to="/auth"
            className="inline-flex items-center justify-center mt-8 text-sm font-semibold bg-foreground text-background px-8 py-3.5 rounded-xl hover:opacity-90 transition-opacity"
          >
            Créer mon compte
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <p className="text-base font-bold text-foreground">YOBBANTÉ</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                Votre partenaire logistique international. Achetez partout, recevez chez vous.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Navigation</p>
              <div className="space-y-2">
                <a href="#services" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Services</a>
                <a href="#warehouses" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Adresses</a>
                <a href="#how-it-works" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Comment ça marche</a>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Légal</p>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Conditions générales</p>
                <p className="text-sm text-muted-foreground">Politique de confidentialité</p>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground">© 2026 Yobbanté. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
