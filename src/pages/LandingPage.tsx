import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { HubsWorldMap, WORLD_HUBS, type HubId } from '@/components/HubsWorldMap';
import {
  Package, Factory, Inbox, ArrowRight, ShieldCheck, Sparkles, Globe2, Headset, MapPin,
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

const SHIP_STEPS = [
  { n: '01', title: 'Vous indiquez votre besoin', desc: 'Origine, destination, ce que vous envoyez. En 1 minute.' },
  { n: '02', title: 'Yobbanté organise tout', desc: 'Transport, douane, suivi — vous n\'avez rien à gérer.' },
  { n: '03', title: 'Vous recevez votre colis', desc: 'À domicile, en point relais, ou en entreprise.' },
];

const BUY_STEPS = [
  { n: '01', title: 'Vous décrivez votre besoin', desc: 'Quantité, qualité, budget — un brief suffit.' },
  { n: '02', title: 'On source et négocie',       desc: '3-5 fournisseurs qualifiés, meilleur prix obtenu.' },
  { n: '03', title: 'Production, contrôle, livraison', desc: 'Inspection qualité puis livraison directe à votre porte.' },
];

const RECEIVE_STEPS = [
  { n: '01', title: 'Vous commandez en ligne', desc: 'Amazon, AliExpress, RockAuto — où vous voulez.' },
  { n: '02', title: 'On réceptionne au relais', desc: 'Adresse Yobbanté à l\'étranger. Photo + pesée à l\'arrivée.' },
  { n: '03', title: 'Vous payez puis recevez', desc: 'Prix réel calculé, vous validez, on livre en Afrique.' },
];

const REASONS = [
  { Icon: Globe2,      title: 'End-to-end',  desc: 'Un seul partenaire, du fournisseur à votre porte.' },
  { Icon: Sparkles,    title: 'Simplicité',  desc: 'Pas de jargon, pas de surprises. Vous décidez, on agit.' },
  { Icon: ShieldCheck, title: 'Fiabilité',   desc: 'Chaque colis est suivi, vérifié, assuré.' },
  { Icon: Headset,     title: 'Réseau mondial', desc: 'France, Chine, USA, Dubai, Allemagne, Canada.' },
];

const METRICS = [
  { value: '+10 000', label: 'colis livrés' },
  { value: '6',       label: 'pays d\'origine' },
  { value: '24h',     label: 'réponse garantie' },
  { value: '98%',     label: 'satisfaction client' },
];

const LANDING_HUB_KEY = 'yobbante.landing.preferredHub';

export default function LandingPage() {
  const navigate = useNavigate();
  const [selectedHub, setSelectedHub] = useState<HubId | null>(null);

  useEffect(() => {
    document.title = 'Yobbanté · Expédiez ou achetez à l\'international, simplement.';
  }, []);

  const goShip = () => navigate('/expedier');
  const goBuy = () => navigate('/acheter');
  const goReceive = () => navigate('/expedier/recevoir');

  const handleHubPick = (id: HubId) => {
    setSelectedHub(id);
    try { localStorage.setItem(LANDING_HUB_KEY, id); } catch { /* noop */ }
  };
  const goReceiveWithHub = () => navigate('/expedier/recevoir');
  const selectedHubMeta = selectedHub ? WORLD_HUBS.find(h => h.id === selectedHub) : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />

      {/* ───── HERO ───── */}
      <section className="relative overflow-hidden">
        <div className="relative max-w-5xl mx-auto px-5 sm:px-6 pt-16 pb-20 md:pt-32 md:pb-36 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-xs font-medium text-muted-foreground mb-7"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Logistique internationale, sans complexité
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.05 }}
            className="text-[2.75rem] sm:text-5xl md:text-7xl font-bold tracking-tight leading-[1.02] text-foreground text-balance"
          >
            Le monde devient<br className="hidden sm:block" /> simple à livrer.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-6 text-base md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed text-pretty"
          >
            Expédiez, recevez ou achetez à l'international.
            Yobbanté gère tout, de A à Z.
          </motion.p>

          {/* The 2 — and only 2 — entry points */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-10 flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto sm:max-w-none"
          >
            <button
              onClick={goShip}
              className="group inline-flex items-center justify-center gap-2.5 text-base font-semibold bg-foreground text-background px-7 py-4 rounded-2xl hover:opacity-90 hover:-translate-y-0.5 transition-all"
            >
              <Package className="w-5 h-5" />
              Expédier un colis
              <ArrowRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={goBuy}
              className="group inline-flex items-center justify-center gap-2.5 text-base font-semibold border-2 border-foreground text-foreground px-7 py-4 rounded-2xl hover:bg-foreground hover:text-background hover:-translate-y-0.5 transition-all"
            >
              <Factory className="w-5 h-5" />
              Lancer un sourcing produit
              <ArrowRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </motion.div>
          <p className="mt-3 text-[11px] text-muted-foreground">Pour les entreprises et projets · achats fournisseurs en gros</p>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.4 }}
            className="mt-6 text-xs text-muted-foreground"
          >
            Sans engagement · Réponse sous 24h · Données protégées
          </motion.p>
        </div>
      </section>

      {/* ───── HOW IT WORKS ───── */}
      <section className="border-t border-border bg-secondary/40">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-20 md:py-28">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Comment ça marche</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-balance">
              Trois étapes. Aucun jargon.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-px bg-border rounded-2xl overflow-hidden">
            {/* Ship */}
            <div className="bg-background p-8 md:p-10">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-9 h-9 rounded-xl bg-foreground text-background flex items-center justify-center">
                  <Package className="w-4.5 h-4.5" />
                </div>
                <h3 className="text-lg font-bold tracking-tight">Pour expédier</h3>
              </div>
              <ol className="space-y-5">
                {SHIP_STEPS.map((s, i) => (
                  <motion.li
                    key={s.n}
                    variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                    className="flex gap-4"
                  >
                    <span className="text-xs font-mono text-muted-foreground pt-1 shrink-0 w-7">{s.n}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{s.title}</p>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.desc}</p>
                    </div>
                  </motion.li>
                ))}
              </ol>
              <button
                onClick={goShip}
                className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:gap-3 transition-all"
              >
                Commencer une expédition <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Buy */}
            <div className="bg-background p-8 md:p-10">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-9 h-9 rounded-xl bg-foreground text-background flex items-center justify-center">
                  <Factory className="w-4.5 h-4.5" />
                </div>
                <h3 className="text-lg font-bold tracking-tight">Pour sourcer</h3>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Entreprises & projets</span>
              </div>
              <ol className="space-y-5">
                {BUY_STEPS.map((s, i) => (
                  <motion.li
                    key={s.n}
                    variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                    className="flex gap-4"
                  >
                    <span className="text-xs font-mono text-muted-foreground pt-1 shrink-0 w-7">{s.n}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{s.title}</p>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.desc}</p>
                    </div>
                  </motion.li>
                ))}
              </ol>
              <button
                onClick={goBuy}
                className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:gap-3 transition-all"
              >
                Lancer un sourcing <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ───── GLOBAL NETWORK ───── */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-20 md:py-28">
          <div className="grid md:grid-cols-[1fr_1.4fr] gap-10 md:gap-14 items-center">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Réseau global</p>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.05] text-balance">
                Un réseau global,<br className="hidden sm:block" /> proche de vos achats.
              </h2>
              <p className="mt-5 text-base text-muted-foreground leading-relaxed text-pretty max-w-md">
                Yobbanté s'appuie sur un réseau de hubs internationaux pour réceptionner,
                consolider et expédier vos colis rapidement — sans que vous ayez à comprendre
                la moindre ligne de logistique.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm">
                {[
                  'Adresses dédiées dans 6 pays',
                  'Consolidation multi-colis automatique',
                  'Départs réguliers vers l\'Afrique de l\'Ouest',
                ].map(t => (
                  <li key={t} className="flex items-start gap-2.5 text-foreground/80">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate('/expedier/recevoir')}
                className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:gap-3 transition-all"
              >
                Voir vos hubs disponibles <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div>
              <HubsWorldMap
                value={selectedHub}
                onChange={handleHubPick}
                variant="dark"
              />
              <AnimatePresence>
                {selectedHubMeta && (
                  <motion.div
                    key={selectedHubMeta.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border-2 border-primary/30 bg-primary/[0.06] p-4"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-lg shrink-0">
                        {selectedHubMeta.flag}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          Hub <span className="text-primary">{selectedHubMeta.label}</span> sélectionné
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          <MapPin className="w-3 h-3 inline -mt-0.5 mr-1" />
                          {selectedHubMeta.city} · {selectedHubMeta.tagline}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={goReceiveWithHub}
                      className="inline-flex items-center justify-center gap-2 text-sm font-semibold bg-primary text-primary-foreground px-4 py-2.5 rounded-xl hover:opacity-90 hover:-translate-y-0.5 transition-all shrink-0"
                    >
                      Continuer avec ce hub <ArrowRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* ───── WHY YOBBANTÉ ───── */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-20 md:py-28">
          <div className="grid md:grid-cols-[1fr_2fr] gap-12">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Pourquoi Yobbanté</p>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.05]">
                Une seule promesse :<br /> ça marche.
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-px bg-border rounded-2xl overflow-hidden">
              {REASONS.map(({ Icon, title, desc }, i) => (
                <motion.div
                  key={title}
                  variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                  className="bg-background p-6"
                >
                  <Icon className="w-5 h-5 text-foreground" />
                  <p className="text-sm font-semibold text-foreground mt-4">{title}</p>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───── TRUST ───── */}
      <section className="border-t border-border bg-foreground text-background">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-24">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
            {METRICS.map((m, i) => (
              <motion.div
                key={m.label}
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                className="text-center md:text-left"
              >
                <p className="text-3xl md:text-5xl font-bold tracking-tight">{m.value}</p>
                <p className="text-xs md:text-sm text-background/60 mt-1.5">{m.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── FINAL CTA ───── */}
      <section className="border-t border-border">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-20 md:py-28 text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-balance">
            Prêt à simplifier votre prochain envoi ?
          </h2>
          <p className="text-base text-muted-foreground mt-4 max-w-md mx-auto text-pretty">
            Choisissez votre besoin, on s'occupe du reste.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={goShip}
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold bg-foreground text-background px-6 py-3.5 rounded-xl hover:opacity-90 hover:-translate-y-0.5 transition-all"
            >
              <Package className="w-4 h-4" /> Expédier un colis
            </button>
            <button
              onClick={goBuy}
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold border-2 border-foreground text-foreground px-6 py-3.5 rounded-xl hover:bg-foreground hover:text-background hover:-translate-y-0.5 transition-all"
            >
              <Factory className="w-4 h-4" /> Lancer un sourcing produit
            </button>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Vous êtes une entreprise ? <Link to="/entreprises" className="underline-offset-2 hover:underline">Demandez un devis volume</Link>.
          </p>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
