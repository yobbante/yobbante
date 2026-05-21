import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { PublicNav } from '@/components/PublicNav';

import { PublicFooter } from '@/components/PublicFooter';
import { TransporteurSignupSection } from '@/components/TransporteurSignupSection';
import { HubsWorldMap, WORLD_HUBS, type HubId } from '@/components/HubsWorldMap';
import { QuoteForm } from '@/components/quote/QuoteForm';
import { TrustBar } from '@/components/quote/TrustBar';
import { ArrowRight, MapPin } from 'lucide-react';
import { useSeo } from '@/hooks/useSeo';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.45 },
  }),
};

const STEPS = [
  { n: '01', title: 'Créez votre dossier', desc: 'Décrivez votre envoi en 2 minutes. Prix instantané.' },
  { n: '02', title: 'On prend en charge', desc: 'Collecte, transit, dédouanement — gérés par notre équipe et nos partenaires certifiés.' },
  { n: '03', title: 'Vous recevez et suivez', desc: 'Notifications WhatsApp à chaque étape. Livraison à domicile ou point relais.' },
];

const TESTIMONIALS = [
  { quote: "J'ai reçu mon MacBook depuis la France en 5 jours. Tout était géré.", name: 'Amadou D.', sub: 'Dakar · Particulier' },
  { quote: 'On importe du matériel chaque mois. Yobbanté nous a fait économiser 15 % sur nos coûts logistiques.', name: 'Mariama S.', sub: 'Dakar · Directrice achats' },
  { quote: "Le sourcing IA m'a trouvé un fournisseur en 48 h. Impossible à faire seul.", name: 'Cheikh N.', sub: 'Thiès · Commerçant' },
];

const METRICS = [
  { value: '+10 000', label: 'colis livrés' },
  { value: '6', label: "pays d'origine" },
  { value: '24h', label: 'réponse garantie' },
  { value: '98 %', label: 'satisfaction client' },
];

const LANDING_HUB_KEY = 'yobbante.landing.preferredHub';

export default function LandingPage() {
  useSeo({
    title: 'Yobbanté — Expédition internationale depuis Dakar',
    description: "Expédiez, recevez ou achetez à l'international. Yobbanté gère tout, de A à Z, depuis Dakar vers le monde entier.",
    path: '/',
  });
  const navigate = useNavigate();
  const [selectedHub, setSelectedHub] = useState<HubId | null>(null);

  useEffect(() => {
    document.title = "Yobbanté · Envoyez partout dans le monde, simplement.";
  }, []);

  const handleHubPick = (id: HubId) => {
    setSelectedHub(id);
    try { localStorage.setItem(LANDING_HUB_KEY, id); } catch { /* */ }
  };
  const goReceiveWithHub = () => navigate('/expedier/recevoir');
  const selectedHubMeta = selectedHub ? WORLD_HUBS.find(h => h.id === selectedHub) : null;

  // ── Smart auto-swipe for the testimonials snap-scroller (mobile).
  // Cycles every 5s, pauses on user touch/hover and when the section is off-screen
  // or the tab is hidden. Falls back to no-op if reduced-motion is requested.
  const testimonialsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = testimonialsRef.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    let timer: number | undefined;
    let paused = false;
    let visible = false;

    const tick = () => {
      if (paused || !visible || document.hidden) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return; // nothing to swipe (desktop grid)
      const next = el.scrollLeft + el.clientWidth * 0.9;
      el.scrollTo({ left: next > max - 8 ? 0 : next, behavior: 'smooth' });
    };
    const start = () => { window.clearInterval(timer); timer = window.setInterval(tick, 5000); };
    const stop = () => { window.clearInterval(timer); timer = undefined; };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      visible ? start() : stop();
    }, { threshold: 0.4 });
    io.observe(el);

    const onEnter = () => { paused = true; };
    const onLeave = () => { paused = false; };
    el.addEventListener('pointerdown', onEnter);
    el.addEventListener('pointerup', onLeave);
    el.addEventListener('pointercancel', onLeave);
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    document.addEventListener('visibilitychange', tick);

    return () => {
      stop();
      io.disconnect();
      el.removeEventListener('pointerdown', onEnter);
      el.removeEventListener('pointerup', onLeave);
      el.removeEventListener('pointercancel', onLeave);
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav />

      {/* ───── HERO + QUOTE FORM ───── */}
      <section className="px-4 sm:px-6 pt-6 pb-10 md:pt-16 md:pb-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-[1fr_580px] gap-6 md:gap-12 items-start">
          <div className="order-1 md:order-1">
            <p
              className="text-[10px] sm:text-[11px] uppercase mb-2 sm:mb-3"
              style={{ letterSpacing: '0.1em', color: 'hsl(var(--text-tertiary))' }}
            >
              Dakar · Paris · New York · Dubai · Abidjan
            </p>
            <h1 className="max-w-[420px] mb-3 text-[28px] leading-[1.1] sm:text-[34px] md:text-[44px]">
              Envoyez partout dans le monde, simplement.
            </h1>
            <p
              className="max-w-[380px] mb-5 sm:mb-7"
              style={{ fontSize: 14, lineHeight: 1.6, color: 'hsl(var(--muted-foreground))' }}
            >
              Prix instantané. Aucun appel. Dédouanement inclus. Paiement en ligne.
            </p>
            {/* Duplicate mobile CTAs removed — first set in IntentSearchBar (under nav) is canonical */}
          </div>

          <div className="w-full order-2 md:order-2">
            <QuoteForm />
            <TrustBar />
          </div>
        </div>
      </section>

      {/* ───── HUB MAP ───── */}
      <section style={{ borderTop: '0.5px solid hsl(var(--color-border-tertiary))' }}>
        <div className="max-w-6xl mx-auto px-6 py-14 md:py-20">
          <div className="grid md:grid-cols-[1fr_1.4fr] gap-10 md:gap-14 items-center">
            <div>
              <p className="text-label mb-3">Réseau global</p>
              <h2 className="text-[24px] md:text-[32px] leading-[1.15]">
                Un réseau global,<br className="hidden sm:block" /> proche de vos achats.
              </h2>
              <p className="mt-4 max-w-md" style={{ fontSize: 14, lineHeight: 1.6, color: 'hsl(var(--muted-foreground))' }}>
                Yobbanté s'appuie sur un réseau de hubs internationaux pour réceptionner,
                consolider et expédier vos colis rapidement.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  'Adresses dédiées dans 6 pays',
                  'Consolidation multi-colis automatique',
                  "Départs réguliers vers l'Afrique de l'Ouest",
                ].map(t => (
                  <li key={t} className="flex items-start gap-2.5 text-[13px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#1D9E75' }} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <HubsWorldMap value={selectedHub} onChange={handleHubPick} variant="light" />
              <AnimatePresence>
                {selectedHubMeta && (
                  <motion.div
                    key={selectedHubMeta.id}
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-[12px] p-4"
                    style={{ background: 'hsl(var(--secondary))', border: '0.5px solid hsl(var(--color-border-tertiary))' }}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                        style={{ background: 'hsl(var(--background-surface))', border: '0.5px solid hsl(var(--color-border-tertiary))' }}>
                        {selectedHubMeta.flag}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium">Hub {selectedHubMeta.label} sélectionné</p>
                        <p className="text-[12px] truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>
                          <MapPin className="w-3 h-3 inline -mt-0.5 mr-1" />
                          {selectedHubMeta.city} · {selectedHubMeta.tagline}
                        </p>
                      </div>
                    </div>
                    <button onClick={goReceiveWithHub} className="btn-cta shrink-0">
                      Continuer <ArrowRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* ───── COMMENT ÇA MARCHE ───── */}
      <section style={{ background: 'hsl(var(--secondary))' }}>
        <div className="max-w-2xl mx-auto px-6 py-14 md:py-20">
          <p className="text-label text-center mb-2">Comment ça marche</p>
          <h2 className="text-center text-[22px] md:text-[28px] mb-10">3 étapes. Pas une de plus.</h2>
          <div>
            {STEPS.map((s, i) => (
              <div key={s.n}>
                <motion.div
                  variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                  className="flex gap-4"
                >
                  <div className="text-[22px] font-medium leading-none shrink-0 w-10"
                    style={{ color: 'hsl(var(--text-tertiary))' }}>{s.n}</div>
                  <div className="flex-1 pb-1">
                    <div className="text-[15px] font-medium">{s.title}</div>
                    <p className="mt-1" style={{ fontSize: 13, lineHeight: 1.6, color: 'hsl(var(--muted-foreground))' }}>{s.desc}</p>
                  </div>
                </motion.div>
                {i < STEPS.length - 1 && (
                  <div className="ml-[20px] my-3" style={{ width: '1px', height: '20px', background: 'hsl(var(--color-border-tertiary))' }} />
                )}
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/expedier')} className="btn-cta w-full mt-10">
            Créer mon premier dossier →
          </button>
        </div>
      </section>

      {/* ───── TRANSPORTEUR SIGNUP ───── */}
      <TransporteurSignupSection />

      {/* ───── TÉMOIGNAGES ───── */}
      <section>
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-14 md:py-16">
          <p className="text-label text-center mb-2">Ils nous font confiance</p>
          <h2 className="text-center text-[22px] md:text-[28px] mb-6 md:mb-8">Ce que disent nos clients.</h2>
          <div ref={testimonialsRef} className="-mx-5 sm:-mx-6 px-5 sm:px-6 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-px-5 scroll-smooth">
            <div className="flex md:grid md:grid-cols-3 gap-4 md:gap-3 min-w-max md:min-w-0 pb-2">
              {TESTIMONIALS.map((t, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                  className="surface-card snap-start flex flex-col w-[85vw] max-w-[320px] md:w-auto md:max-w-none md:min-w-0 p-5"
                >
                  <div className="text-[13px] tracking-wider" style={{ color: '#1D9E75' }}>★★★★★</div>
                  <p className="mt-3 flex-1" style={{ fontSize: 15, lineHeight: 1.65, color: 'hsl(var(--foreground))' }}>
                    "{t.quote}"
                  </p>
                  <div className="mt-5 pt-4" style={{ borderTop: '0.5px solid hsl(var(--color-border-tertiary))' }}>
                    <div className="text-[13px] font-medium">{t.name}</div>
                    <div className="text-[12px] mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>{t.sub}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───── STATS ───── */}
      <section style={{ background: 'hsl(var(--secondary))', borderTop: '0.5px solid hsl(var(--color-border-tertiary))' }}>
        <div className="max-w-6xl mx-auto px-6 py-14 md:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
            {METRICS.map((m, i) => (
              <motion.div key={m.label}
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                className="text-center md:text-left"
              >
                <p className="text-price">{m.value}</p>
                <p className="text-[12px] mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>{m.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── FINAL CTA ───── */}
      <section>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-20 text-center">
          <h2 className="text-[22px] sm:text-[24px] md:text-[32px] leading-tight">Prêt à simplifier votre prochain envoi&nbsp;?</h2>
          <p className="mt-3 max-w-md mx-auto" style={{ fontSize: 14, lineHeight: 1.6, color: 'hsl(var(--muted-foreground))' }}>
            Choisissez votre besoin, on s'occupe du reste.
          </p>
          <div className="mt-6 sm:mt-7 grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-xl mx-auto">
            <button onClick={() => navigate('/expedier')} className="btn-cta w-full">Expédier un colis</button>
            <button onClick={() => navigate('/sourcing')} className="btn-cta w-full"
              style={{ background: 'transparent', color: 'hsl(var(--foreground))', border: '0.5px solid hsl(var(--color-border-tertiary))' }}>
              Sourcing produit
            </button>
            <button onClick={() => navigate('/expedier/recevoir')} className="btn-cta w-full"
              style={{ background: 'transparent', color: 'hsl(var(--foreground))', border: '0.5px solid hsl(var(--color-border-tertiary))' }}>
              Réception
            </button>
          </div>
          <p className="mt-6 text-[12px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Vous êtes une entreprise ?{' '}
            <Link to="/business" className="font-medium underline">Découvrez Yobbanté Business →</Link>
          </p>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
