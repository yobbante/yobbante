import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { HubsWorldMap, WORLD_HUBS, type HubId } from '@/components/HubsWorldMap';
import { PricingSimulator } from '@/components/PricingSimulator';
import {
  Package, Factory, ArrowRight, MapPin, Inbox, Search, ShieldCheck, Check, Zap,
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

const HERO_STATS = [
  { value: '+10 000', label: 'Colis livrés' },
  { value: '6', label: 'Pays' },
  { value: '24h', label: 'Réponse' },
  { value: '200+', label: 'Transporteurs' },
];

const SERVICES = [
  {
    Icon: Inbox, accent: true, title: 'Recevoir une commande',
    desc: 'Achetez sur Amazon, AliExpress, SHEIN… On réceptionne à notre adresse relais et on vous livre au Sénégal.',
    href: '/expedier/recevoir',
  },
  {
    Icon: Package, accent: false, title: 'Expédier un colis',
    desc: "D'un point A à un point B, partout dans le monde. Collecte, transit, dédouanement — on gère tout.",
    href: '/expedier',
  },
  {
    Icon: Search, accent: false, title: 'Sourcer un produit',
    desc: "Notre IA trouve le meilleur fournisseur au meilleur prix. Vous validez, on s'occupe de l'import.",
    href: '/acheter',
  },
];

const STEPS = [
  { n: '01', title: 'Créez votre dossier', desc: 'Décrivez votre envoi en 2 minutes. Prix estimé calculé instantanément.' },
  { n: '02', title: 'On prend en charge', desc: 'Collecte, transit, dédouanement. Chaque étape gérée par notre équipe et nos partenaires certifiés.' },
  { n: '03', title: 'Vous recevez et suivez', desc: 'Notifications WhatsApp à chaque étape. Livraison à domicile ou point relais. Vous choisissez.' },
];

const TESTIMONIALS = [
  { quote: "J'ai reçu mon MacBook depuis la France en 5 jours. Tout était géré.", name: 'Amadou D.', sub: 'Dakar · Particulier' },
  { quote: "On importe du matériel chaque mois. Yobbanté nous a fait économiser 15% sur nos coûts logistiques.", name: 'Mariama S.', sub: 'Dakar · Directrice achats' },
  { quote: "Le sourcing IA m'a trouvé un fournisseur en 48h. Impossible à faire seul.", name: 'Cheikh N.', sub: 'Thiès · Commerçant' },
];

const METRICS = [
  { value: '+10 000', label: 'colis livrés' },
  { value: '6', label: "pays d'origine" },
  { value: '24h', label: 'réponse garantie' },
  { value: '98%', label: 'satisfaction client' },
];

const TICKER_LINE =
  "DÉPARTS RÉGULIERS · FRANCE · USA · MAROC · DUBAI · CHINE · SÉNÉGAL · ";

const LANDING_HUB_KEY = 'yobbante.landing.preferredHub';

export default function LandingPage() {
  const navigate = useNavigate();
  const [selectedHub, setSelectedHub] = useState<HubId | null>(null);

  useEffect(() => {
    document.title = "Yobbanté · Expédiez ou achetez à l'international, simplement.";
  }, []);

  const goShip = () => navigate('/expedier');
  const goBuy = () => navigate('/acheter');

  const handleHubPick = (id: HubId) => {
    setSelectedHub(id);
    try { localStorage.setItem(LANDING_HUB_KEY, id); } catch { /* noop */ }
  };
  const goReceiveWithHub = () => navigate('/expedier/recevoir');
  const selectedHubMeta = selectedHub ? WORLD_HUBS.find(h => h.id === selectedHub) : null;

  const tickerItems = Array.from({ length: 8 }, () => TICKER_LINE).join('');

  return (
    <div className="min-h-screen text-white" style={{ background: '#0A0A0A' }}>
      <PublicNav />

      {/* ───── TICKER ───── */}
      <div className="relative overflow-hidden border-y" style={{ background: '#0A0A0A', borderColor: '#1E1E1E' }}>
        <div className="py-2.5">
          <div className="flex w-max animate-marquee whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: '#F5C518' }}>
            <span>{tickerItems}</span>
            <span>{tickerItems}</span>
          </div>
        </div>
      </div>

      {/* ───── HERO ───── */}
      <section className="relative overflow-hidden" style={{ background: '#0A0A0A' }}>
        <div className="relative max-w-5xl mx-auto px-5 sm:px-6 pt-14 pb-12 md:pt-28 md:pb-20 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.05 }}
            className="text-[2.5rem] sm:text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.02] text-balance text-white"
          >
            Le monde devient<br className="hidden sm:block" /> simple à livrer.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-6 text-base md:text-xl max-w-xl mx-auto leading-relaxed text-pretty"
            style={{ color: '#AAAAAA' }}
          >
            Expédiez, recevez ou achetez à l'international. Yobbanté gère tout, de A à Z.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-10 flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto sm:max-w-none"
          >
            <button onClick={goShip}
              className="group inline-flex items-center justify-center gap-2.5 text-base font-semibold px-7 py-4 rounded-2xl hover:opacity-90 hover:-translate-y-0.5 transition-all"
              style={{ background: '#F5C518', color: '#0A0A0A' }}>
              <Package className="w-5 h-5" />
              Expédier un colis
              <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button onClick={goBuy}
              className="group inline-flex items-center justify-center gap-2.5 text-base font-semibold px-7 py-4 rounded-2xl hover:-translate-y-0.5 transition-all"
              style={{ background: '#161616', color: '#FFFFFF', border: '1px solid #2A2A2A' }}>
              <Factory className="w-5 h-5" />
              Acheter un produit
              <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </motion.div>
          <p className="mt-3 text-[11px]" style={{ color: '#555555' }}>
            Sourcing fournisseur ou réception d'une commande en ligne
          </p>

          {/* Hero stats row */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35 }}
            className="mt-10 -mx-5 sm:mx-0 px-5 sm:px-0 overflow-x-auto no-scrollbar"
          >
            <div className="flex sm:grid sm:grid-cols-4 gap-3 min-w-max sm:min-w-0">
              {HERO_STATS.map(s => (
                <div key={s.label} className="rounded-[10px] px-4 py-3 min-w-[120px] text-left"
                  style={{ background: '#111111', border: '0.5px solid #1E1E1E' }}>
                  <div className="font-mono text-[20px] font-extrabold text-white">{s.value}</div>
                  <div className="font-mono text-[10px] uppercase mt-1" style={{ color: '#555555', letterSpacing: '0.08em' }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ───── NOS SERVICES ───── */}
      <section style={{ background: '#080808' }}>
        <div className="max-w-3xl mx-auto px-5 py-14 md:py-20">
          <p className="text-center font-mono text-[10px] uppercase mb-2" style={{ color: '#F5C518', letterSpacing: '0.14em' }}>
            CE QU'ON FAIT
          </p>
          <h2 className="text-center text-[22px] md:text-3xl font-extrabold text-white mb-8 leading-tight">
            Tout ce dont vous avez besoin.<br />En un seul endroit.
          </h2>
          <div className="space-y-2.5">
            {SERVICES.map(({ Icon, accent, title, desc, href }, i) => (
              <motion.button
                key={title}
                onClick={() => navigate(href)}
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                className="w-full text-left rounded-[14px] p-4 hover:-translate-y-0.5 transition-transform"
                style={{ background: '#111111', border: '0.5px solid #1E1E1E' }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={accent
                      ? { background: '#F5C518', color: '#0A0A0A' }
                      : { background: '#161616', color: '#F5C518', border: '0.5px solid #2A2A2A' }}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-bold text-white">{title}</div>
                    <p className="text-[12px] mt-1 leading-relaxed" style={{ color: '#AAAAAA' }}>{desc}</p>
                    <div className="text-[12px] font-semibold mt-2" style={{ color: '#F5C518' }}>Démarrer →</div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* ───── HUB MAP ───── */}
      <section style={{ background: '#0A0A0A' }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-24">
          <div className="grid md:grid-cols-[1fr_1.4fr] gap-10 md:gap-14 items-center">
            <div>
              <p className="font-mono text-[10px] uppercase mb-3" style={{ color: '#F5C518', letterSpacing: '0.14em' }}>
                RÉSEAU GLOBAL
              </p>
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05] text-balance text-white">
                Un réseau global,<br className="hidden sm:block" /> proche de vos achats.
              </h2>
              <p className="mt-5 text-base leading-relaxed text-pretty max-w-md" style={{ color: '#AAAAAA' }}>
                Yobbanté s'appuie sur un réseau de hubs internationaux pour réceptionner,
                consolider et expédier vos colis rapidement.
              </p>
              <ul className="mt-6 space-y-2.5 text-[13px]">
                {[
                  'Adresses dédiées dans 6 pays',
                  'Consolidation multi-colis automatique',
                  "Départs réguliers vers l'Afrique de l'Ouest",
                ].map(t => (
                  <li key={t} className="flex items-start gap-2.5" style={{ color: '#AAAAAA' }}>
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#F5C518' }} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <HubsWorldMap value={selectedHub} onChange={handleHubPick} variant="dark" />
              <AnimatePresence>
                {selectedHubMeta && (
                  <motion.div
                    key={selectedHubMeta.id}
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl p-4"
                    style={{ background: 'rgba(245,197,24,0.06)', border: '1.5px solid rgba(245,197,24,0.3)' }}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                        style={{ background: 'rgba(245,197,24,0.15)' }}>
                        {selectedHubMeta.flag}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">
                          Hub <span style={{ color: '#F5C518' }}>{selectedHubMeta.label}</span> sélectionné
                        </p>
                        <p className="text-xs truncate" style={{ color: '#AAAAAA' }}>
                          <MapPin className="w-3 h-3 inline -mt-0.5 mr-1" />
                          {selectedHubMeta.city} · {selectedHubMeta.tagline}
                        </p>
                      </div>
                    </div>
                    <button onClick={goReceiveWithHub}
                      className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 hover:-translate-y-0.5 transition-all shrink-0"
                      style={{ background: '#F5C518', color: '#0A0A0A' }}>
                      Continuer avec ce hub <ArrowRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* ───── COMMENT ÇA MARCHE ───── */}
      <section style={{ background: '#080808' }}>
        <div className="max-w-2xl mx-auto px-5 py-14 md:py-20">
          <p className="text-center font-mono text-[10px] uppercase mb-2" style={{ color: '#F5C518', letterSpacing: '0.14em' }}>
            COMMENT ÇA MARCHE
          </p>
          <h2 className="text-center text-[22px] md:text-3xl font-extrabold text-white mb-10 leading-tight">
            3 étapes. Pas une de plus.
          </h2>
          <div className="space-y-0">
            {STEPS.map((s, i) => (
              <div key={s.n}>
                <motion.div
                  variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                  className="flex gap-4"
                >
                  <div className="font-mono text-[28px] font-bold leading-none shrink-0 w-12"
                    style={{ color: 'rgba(245,197,24,0.25)' }}>{s.n}</div>
                  <div className="flex-1 pb-1">
                    <div className="text-[15px] font-bold text-white">{s.title}</div>
                    <p className="text-[13px] mt-1 leading-relaxed" style={{ color: '#AAAAAA' }}>{s.desc}</p>
                  </div>
                </motion.div>
                {i < STEPS.length - 1 && (
                  <div className="ml-[22px] my-3" style={{ width: '2px', height: '24px', background: '#1E1E1E' }} />
                )}
              </div>
            ))}
          </div>
          <button onClick={goShip}
            className="w-full mt-10 rounded-[10px] py-3.5 text-[14px] font-bold transition-opacity hover:opacity-90"
            style={{ background: '#F5C518', color: '#0A0A0A' }}>
            Créer mon premier dossier →
          </button>
        </div>
      </section>

      {/* ───── TÉMOIGNAGES ───── */}
      <section style={{ background: '#0A0A0A' }}>
        <div className="max-w-5xl mx-auto px-5 py-12 md:py-16">
          <p className="text-center font-mono text-[10px] uppercase mb-2" style={{ color: '#F5C518', letterSpacing: '0.14em' }}>
            ILS NOUS FONT CONFIANCE
          </p>
          <h2 className="text-center text-[22px] md:text-3xl font-extrabold text-white mb-8 leading-tight">
            Ce que disent nos clients.
          </h2>
          <div className="-mx-5 px-5 overflow-x-auto no-scrollbar">
            <div className="flex md:grid md:grid-cols-3 gap-3 min-w-max md:min-w-0">
              {TESTIMONIALS.map((t, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                  className="rounded-[14px] p-[18px] min-w-[260px] md:min-w-0"
                  style={{ background: '#111111', border: '0.5px solid #1E1E1E' }}
                >
                  <div className="text-[12px]" style={{ color: '#F5C518' }}>★★★★★</div>
                  <p className="text-[13px] italic mt-3 leading-[1.6]" style={{ color: '#AAAAAA' }}>
                    "{t.quote}"
                  </p>
                  <div className="mt-4">
                    <div className="text-[12px] font-semibold text-white">{t.name}</div>
                    <div className="font-mono text-[10px] mt-0.5" style={{ color: '#555555' }}>{t.sub}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───── SIMULATEUR ───── */}
      <section className="px-5 py-12 md:py-16"
        style={{ background: '#111111', borderTop: '1px solid #1E1E1E', borderBottom: '1px solid #1E1E1E' }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-center text-[20px] md:text-3xl font-extrabold text-white">
            Combien coûte votre envoi ?
          </h2>
          <p className="text-center mt-2 mb-6 font-mono text-[11px]" style={{ color: '#555555' }}>
            Estimation instantanée · Sans inscription
          </p>
          <PricingSimulator compact />
        </div>
      </section>

      {/* ───── STATS ───── */}
      <section style={{ background: '#080808' }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-14 md:py-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
            {METRICS.map((m, i) => (
              <motion.div key={m.label}
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                className="text-center md:text-left"
              >
                <p className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">{m.value}</p>
                <p className="text-xs md:text-sm mt-1.5" style={{ color: '#AAAAAA' }}>{m.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── FINAL CTA ───── */}
      <section style={{ background: '#0A0A0A' }}>
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-16 md:py-24 text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-balance text-white">
            Prêt à simplifier votre prochain envoi ?
          </h2>
          <p className="text-base mt-4 max-w-md mx-auto text-pretty" style={{ color: '#AAAAAA' }}>
            Choisissez votre besoin, on s'occupe du reste.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={goShip}
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-6 py-3.5 rounded-xl hover:opacity-90 hover:-translate-y-0.5 transition-all"
              style={{ background: '#F5C518', color: '#0A0A0A' }}>
              <Package className="w-4 h-4" /> Expédier un colis
            </button>
            <button onClick={goBuy}
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-6 py-3.5 rounded-xl hover:-translate-y-0.5 transition-all"
              style={{ background: '#161616', color: '#FFFFFF', border: '1px solid #2A2A2A' }}>
              <Factory className="w-4 h-4" /> Acheter un produit
            </button>
          </div>

          {/* Trust badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {[
              { Icon: ShieldCheck, label: 'Données protégées' },
              { Icon: Check, label: 'Sans engagement' },
              { Icon: Zap, label: 'Réponse sous 24h' },
            ].map(({ Icon, label }) => (
              <span key={label}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px]"
                style={{ background: '#161616', border: '0.5px solid #2A2A2A', color: '#AAAAAA' }}>
                <Icon className="w-3 h-3" style={{ color: '#F5C518' }} />
                {label}
              </span>
            ))}
          </div>

          <p className="mt-6 text-xs" style={{ color: '#AAAAAA' }}>
            Vous êtes une entreprise ?{' '}
            <Link to="/business" className="font-semibold hover:underline" style={{ color: '#F5C518' }}>
              Découvrez Yobbanté Business →
            </Link>
          </p>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
