import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { DossierDialog } from '@/components/DossierDialog';
import { PublicNav } from '@/components/PublicNav';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ExternalLink, ArrowRight } from 'lucide-react';

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

const PROCESS_STEPS = [
  { n: '1', t: 'Vous décrivez votre besoin', d: 'Formulaire dossier en 3 minutes : produit, volume, origine, destination, budget.' },
  { n: '2', t: 'Devis chiffré sous 24h', d: 'Notre équipe analyse, propose la route optimale et un coût all-in (transport + douane + livraison).' },
  { n: '3', t: 'Validation & lancement', d: 'Vous validez. On commande, sourçe, réceptionne, groupe et expédie selon le plan.' },
  { n: '4', t: 'Suivi temps réel', d: 'Timeline en ligne, pièces douane partagées, messagerie directe avec votre dossier manager.' },
  { n: '5', t: 'Livraison & clôture', d: 'Livraison finale, transmission des documents, facturation. Dossier archivé et consultable.' },
];

const USE_CASES = [
  {
    tag: 'E-commerce',
    title: '500 unités de cosmétiques · Chine → Dakar',
    desc: 'Sourcing usine + contrôle qualité + groupage maritime LCL + dédouanement Sénégal + livraison entrepôt client.',
    metric: '−42% vs achat direct',
  },
  {
    tag: 'Grossiste',
    title: 'Conteneur FCL d\'électronique · Dubai → Abidjan',
    desc: 'Négociation fournisseur, conteneur 20\' complet, transit maritime + dédouanement Côte d\'Ivoire, livraison hub.',
    metric: 'Délai 28 jours',
  },
  {
    tag: 'Particulier',
    title: 'Achats Amazon US groupés · USA → Bamako',
    desc: 'Adresse Yobbanté USA, 7 colis réceptionnés, regroupement, expédition aérienne consolidée.',
    metric: '−58% vs envois séparés',
  },
];

const FAQ = [
  {
    q: 'Quelle différence entre Yobbanté et Konnekt ?',
    a: 'Yobbanté est un opérateur logistique : nous gérons des dossiers complets (sourcing, dédouanement, conteneurs). Konnekt est notre app sœur — une marketplace pour petits envois individuels via voyageurs et transporteurs.',
  },
  {
    q: 'Combien de temps pour recevoir un devis ?',
    a: 'Sous 24h ouvrées après réception de votre dossier. Pour les demandes complexes (conteneurs, sourcing usine), nous pouvons demander des précisions complémentaires.',
  },
  {
    q: 'Quels pays couvrez-vous ?',
    a: 'Hubs en France, Chine, USA, Canada, Dubai et Allemagne. Livraison finale dans toute l\'Afrique de l\'Ouest (Sénégal, Côte d\'Ivoire, Mali, Togo, Bénin, Guinée) et au-delà sur demande.',
  },
  {
    q: 'Quels volumes minimums acceptez-vous ?',
    a: 'Aucun minimum. Pour les petits envois (< 30 kg), Konnekt est souvent plus économique. Au-delà, Yobbanté optimise via groupage.',
  },
  {
    q: 'Comment se passe le paiement ?',
    a: 'Devis validé, acompte 30% au lancement, solde à la livraison. Conditions négociables pour les contrats récurrents B2B.',
  },
  {
    q: 'Puis-je suivre mon dossier en temps réel ?',
    a: 'Oui. Espace client avec timeline détaillée, documents douane, colis liés et messagerie directe avec votre dossier manager.',
  },
];

export default function ServicesPage() {
  const [dossierOpen, setDossierOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav extraItems={[{ label: 'Confier un dossier', onClick: () => setDossierOpen(true) }]} />

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 pt-14 pb-10 md:pt-24 md:pb-16 text-center md:text-left">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Services</p>
        <h1 className="text-[2.25rem] sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] mt-3 text-balance">
          Un opérateur logistique pour toute votre chaîne.
        </h1>
        <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed text-pretty mx-auto md:mx-0">
          Yobbanté n'est pas un intermédiaire. Nous opérons chaque maillon : du sourcing en usine jusqu'à la livraison finale.
        </p>
      </section>

      {/* Services list */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 pb-16 md:pb-20">
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
      </section>

      {/* ───── Process en étapes ───── */}
      <section className="border-t border-border bg-secondary">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-20 md:py-24">
          <div className="text-center md:text-left max-w-2xl mx-auto md:mx-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Process</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mt-3 text-balance">
              Du brief à la livraison, en 5 étapes.
            </h2>
          </div>
          <div className="grid md:grid-cols-5 gap-4 mt-10">
            {PROCESS_STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="bg-card border border-border rounded-xl p-5"
              >
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-foreground text-background text-xs font-bold">
                  {s.n}
                </span>
                <p className="text-sm font-semibold text-foreground mt-4 text-balance">{s.t}</p>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed text-pretty">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Cas d'usage ───── */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-20 md:py-24">
          <div className="text-center md:text-left max-w-2xl mx-auto md:mx-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Cas d'usage</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mt-3 text-balance">
              Ce qu'on fait, concrètement.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mt-10">
            {USE_CASES.map((u, i) => (
              <motion.div
                key={u.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="border border-border rounded-2xl p-6 flex flex-col"
              >
                <span className="self-start text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-full bg-secondary text-foreground">
                  {u.tag}
                </span>
                <h3 className="text-base font-semibold text-foreground mt-4 text-balance">{u.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed flex-1 text-pretty">{u.desc}</p>
                <p className="text-xs font-mono font-semibold text-foreground mt-4">{u.metric}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── FAQ ───── */}
      <section className="border-t border-border bg-secondary">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-20 md:py-24">
          <div className="text-center md:text-left">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Questions fréquentes</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mt-3 text-balance">
              Tout ce qu'on nous demande.
            </h2>
          </div>
          <Accordion type="single" collapsible className="mt-8">
            {FAQ.map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-border">
                <AccordionTrigger className="text-left text-base font-semibold text-foreground hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed text-pretty">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ───── Konnekt cross-sell ───── */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-12">
          <div className="rounded-2xl border border-border p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-5">
            <div className="flex-1 text-center md:text-left">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Petit envoi ?</p>
              <h3 className="text-lg md:text-xl font-bold text-foreground mt-2 text-balance">
                Moins de 30 kg ou envoi ponctuel ? Konnekt est plus rapide.
              </h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto md:mx-0 text-pretty">
                Marketplace de voyageurs et transporteurs pour les petits colis. Yobbanté reste votre choix pour les imports complets.
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

      {/* ───── Final CTA ───── */}
      <section className="max-w-4xl mx-auto px-5 sm:px-6 pb-20 md:pb-24">
        <div className="rounded-2xl bg-foreground text-background p-8 md:p-12 text-center">
          <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">Prêt à confier votre import ?</h3>
          <p className="text-sm opacity-70 mt-3 max-w-md mx-auto text-pretty">
            Réponse sous 24h avec une proposition détaillée et chiffrée.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setDossierOpen(true)}
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold bg-background text-foreground px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
            >
              Confier mon dossier <ArrowRight className="w-4 h-4" />
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
