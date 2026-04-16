import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { DossierDialog } from '@/components/DossierDialog';

const SERVICES = [
  {
    num: '01',
    title: 'Import Complet',
    tagline: 'De l\'idée au colis livré.',
    desc: 'Vous nous confiez votre projet d\'import — nous gérons sourcing, achat, réception, groupage, transport, dédouanement et livraison finale. Aucun intermédiaire, un seul interlocuteur.',
    forWho: 'Entreprises, grossistes, e-commerçants',
  },
  {
    num: '02',
    title: 'Sourcing International',
    tagline: 'Trouvez le bon fournisseur.',
    desc: 'Recherche, qualification et négociation avec les usines et grossistes en Chine, Dubai, Europe et Amérique. Vérification qualité avant expédition.',
    forWho: 'Importateurs B2B, marques privées',
  },
  {
    num: '03',
    title: 'Adresses Internationales',
    tagline: '6 entrepôts. Une adresse par pays.',
    desc: 'Recevez gratuitement une adresse dédiée en France, Chine, USA, Canada, Dubai et Allemagne. Commandez sur Amazon, Alibaba, 1688 ou tout site marchand — nous réceptionnons pour vous.',
    forWho: 'Particuliers, e-commerçants, professionnels',
  },
  {
    num: '04',
    title: 'Groupage (LCL · Air · Routier)',
    tagline: 'Économisez en consolidant.',
    desc: 'Plusieurs colis depuis le même pays ? Nous les regroupons en une seule expédition pour réduire vos coûts jusqu\'à 70%. Choix optimisé entre maritime LCL, aérien et routier.',
    forWho: 'Tous volumes, tous budgets',
  },
  {
    num: '05',
    title: 'Dédouanement',
    tagline: 'Conformité, sans tracas.',
    desc: 'Préparation documentaire, optimisation des taxes et droits de douane, conformité réglementaire. Yobbanté gère les formalités douanières dans les pays d\'origine et de destination.',
    forWho: 'Imports professionnels et personnels',
  },
  {
    num: '06',
    title: 'Entreposage',
    tagline: 'Stockage sécurisé.',
    desc: 'Stockage temporaire ou longue durée dans nos entrepôts internationaux. Idéal pour attendre d\'autres colis, organiser un groupage ou différer une livraison.',
    forWho: 'E-commerçants, importateurs réguliers',
  },
  {
    num: '07',
    title: 'Livraison Finale',
    tagline: 'À votre porte.',
    desc: 'Livraison à domicile, en point relais ou en entreprise. Réseau partenaire dans toute l\'Afrique de l\'Ouest et au-delà. Suivi temps réel jusqu\'à réception.',
    forWho: 'Tous destinataires',
  },
];

export default function ServicesPage() {
  const [dossierOpen, setDossierOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold tracking-tight text-foreground">YOBBANTÉ</Link>
          <div className="hidden md:flex items-center gap-8">
            <Link to="/services" className="text-sm font-medium text-foreground">Services</Link>
            <Link to="/simulateur" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Simulateur</Link>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Accueil</Link>
          </div>
          <Link to="/auth" className="text-sm font-semibold bg-foreground text-background px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">Commencer</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-5 sm:px-6 pt-14 pb-10 md:pt-28 md:pb-16 text-center md:text-left">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Services</p>
        <h1 className="text-[2.25rem] sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] mt-3 text-balance">
          Un opérateur logistique pour toute votre chaîne.
        </h1>
        <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed text-pretty mx-auto md:mx-0">
          Yobbanté n'est pas un intermédiaire. Nous opérons chaque maillon : du sourcing en usine jusqu'à la livraison finale.
        </p>
      </section>

      {/* Services list */}
      <section className="max-w-4xl mx-auto px-5 sm:px-6 pb-20 md:pb-24">
        <div className="space-y-0 divide-y divide-border">
          {SERVICES.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="grid md:grid-cols-[80px_1fr] gap-3 md:gap-6 py-8 md:py-10"
            >
              <div>
                <span className="text-2xl md:text-3xl font-mono font-bold text-foreground">{s.num}</span>
              </div>
              <div>
                <h2 className="text-xl md:text-3xl font-bold tracking-tight text-foreground text-balance">{s.title}</h2>
                <p className="text-sm md:text-base text-foreground/80 mt-1.5 font-medium">{s.tagline}</p>
                <p className="text-sm text-muted-foreground mt-3 md:mt-4 leading-relaxed max-w-2xl text-pretty">{s.desc}</p>
                <div className="mt-3 md:mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                  <span>Pour : {s.forWho}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 rounded-2xl bg-foreground text-background p-8 md:p-12 text-center">
          <h3 className="text-2xl md:text-3xl font-bold tracking-tight">Prêt à confier votre import ?</h3>
          <p className="text-sm opacity-70 mt-3 max-w-md mx-auto">
            Réponse sous 24h avec une proposition détaillée et chiffrée.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setDossierOpen(true)}
              className="inline-flex items-center justify-center text-sm font-semibold bg-background text-foreground px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
            >
              Confier mon dossier
            </button>
            <Link
              to="/simulateur"
              className="inline-flex items-center justify-center text-sm font-semibold border border-background/30 px-6 py-3 rounded-xl hover:bg-background/10 transition-colors"
            >
              Estimer un import
            </Link>
          </div>
        </div>
      </section>

      <DossierDialog open={dossierOpen} onOpenChange={setDossierOpen} />
    </div>
  );
}
