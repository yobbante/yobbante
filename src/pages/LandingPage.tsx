import { Link, useNavigate } from 'react-router-dom';
import { PublicNav } from '@/components/PublicNav';
import { PricingSimulator } from '@/components/PricingSimulator';

const YELLOW = '#F5C518';
const BG = '#0A0A0A';
const BG_ALT = '#080808';
const CARD = '#111111';
const BORDER = '#1E1E1E';
const MUTED = '#AAAAAA';
const FAINT = '#555555';

const STATS = [
  { n: '847+', l: 'Colis livrés' },
  { n: '12+', l: 'Pays desservis' },
  { n: '48h', l: 'Délai réponse' },
  { n: '200+', l: 'Transporteurs' },
];

const SERVICES = [
  {
    icon: '📬', highlight: true,
    title: 'Recevoir une commande',
    body: "Vous achetez sur Amazon, AliExpress, SHEIN... Donnez notre adresse relais. On réceptionne, regroupe et vous livre au Sénégal.",
    to: '/expedier/recevoir',
  },
  {
    icon: '📦',
    title: 'Expédier un colis',
    body: "D'un point A à un point B, partout dans le monde. On collecte, on dédouane, on livre. Vous suivez en temps réel.",
    to: '/expedier',
  },
  {
    icon: '🔍',
    title: 'Sourcer un produit',
    body: "Vous cherchez un produit introuvable au Sénégal ? Notre IA trouve le meilleur fournisseur au meilleur prix, on s'occupe du reste.",
    to: '/acheter',
  },
];

const STEPS = [
  { n: '01', t: 'Créez votre dossier', b: "Décrivez votre envoi ou votre achat en ligne. Notre système calcule le meilleur itinéraire et le prix estimé." },
  { n: '02', t: 'On prend en charge', b: "Collecte, transit, dédouanement — Yobbanté gère chaque étape avec nos partenaires locaux et internationaux." },
  { n: '03', t: 'Vous recevez et suivez', b: "Notifications WhatsApp à chaque étape. Livraison à domicile ou retrait au point relais. Vous choisissez." },
];

const TESTIMONIALS = [
  { q: "J'ai reçu mon MacBook depuis la France en 5 jours. Tout était géré, je n'ai rien eu à faire.", a: 'Amadou D.', s: 'Dakar · Client particulier' },
  { q: "On importe du matériel électronique chaque mois. Yobbanté nous a fait économiser 15% sur nos coûts logistiques.", a: 'Mariama S.', s: 'Dakar · Directrice achats' },
  { q: "Le sourcing IA m'a trouvé un fournisseur en 48h. Impossible à faire seul.", a: 'Cheikh N.', s: 'Thiès · Commerçant' },
];

const CARRIERS = ['DHL', 'UPS', 'FedEx', 'La Poste', 'CMA CGM', 'Maersk', 'Chronopost'];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen text-white" style={{ background: BG }}>
      <PublicNav hideActions />

      {/* HERO */}
      <section className="px-5 pt-10 pb-12 max-w-[480px] md:max-w-3xl mx-auto text-center">
        <div className="font-mono uppercase text-[10px] mb-4" style={{ letterSpacing: '0.2em', color: YELLOW }}>
          YOBBANTÉ · DAKAR, SÉNÉGAL
        </div>
        <h1 className="text-[36px] md:text-[48px] font-extrabold leading-[1.1] text-white"
          style={{ letterSpacing: '-0.03em' }}>
          Votre logistique<br />internationale,<br />enfin simple.
        </h1>
        <p className="mt-5 text-[14px] leading-[1.6] mx-auto max-w-[320px]" style={{ color: MUTED }}>
          Réceptionnez, expédiez et sourcez depuis et vers n'importe où dans le monde. On gère tout.
        </p>

        <div className="mt-7 flex flex-col gap-3 max-w-[340px] mx-auto">
          <button onClick={() => navigate('/auth')}
            className="w-full rounded-[10px] py-[14px] text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: YELLOW, color: BG }}>
            Créer mon compte gratuit →
          </button>
          <Link to="/tarifs"
            className="w-full rounded-[10px] py-[14px] text-sm text-white text-center"
            style={{ background: 'transparent', border: `1px solid #2A2A2A` }}>
            Voir les tarifs
          </Link>
        </div>

        <p className="font-mono text-[11px] mt-3" style={{ color: FAINT }}>
          ✓ Sans engagement · ✓ Réponse sous 24h · ✓ 100% en ligne
        </p>

        {/* Stats */}
        <div className="mt-8 flex md:grid md:grid-cols-4 gap-3 overflow-x-auto -mx-5 px-5 snap-x">
          {STATS.map(s => (
            <div key={s.l} className="flex-shrink-0 min-w-[120px] snap-start rounded-[10px] p-3 text-left"
              style={{ background: CARD, border: `0.5px solid ${BORDER}` }}>
              <div className="font-mono text-[22px] font-extrabold text-white">{s.n}</div>
              <div className="font-mono text-[10px] uppercase mt-1" style={{ color: FAINT }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <Section bg={BG_ALT} label="NOS SERVICES" title={<>Tout ce dont vous avez besoin.<br />En un seul endroit.</>}>
        <div className="space-y-3 md:grid md:grid-cols-3 md:gap-4 md:space-y-0">
          {SERVICES.map(s => (
            <Link key={s.title} to={s.to}
              className="block rounded-2xl p-5 transition-colors hover:border-[#2A2A2A]"
              style={{ background: CARD, border: `0.5px solid ${BORDER}` }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
                style={{ background: s.highlight ? YELLOW : '#161616' }}>
                {s.icon}
              </div>
              <div className="text-[16px] font-bold text-white mb-2">{s.title}</div>
              <p className="text-[13px] leading-[1.6] mb-3" style={{ color: MUTED }}>{s.body}</p>
              <span className="text-[12px]" style={{ color: YELLOW }}>En savoir plus →</span>
            </Link>
          ))}
        </div>
      </Section>

      {/* COMMENT ÇA MARCHE */}
      <Section bg={BG} label="COMMENT ÇA MARCHE" title="3 étapes. Pas une de plus.">
        <div className="space-y-2">
          {STEPS.map((s, i) => (
            <div key={s.n}>
              <div className="rounded-2xl p-5" style={{ background: CARD, border: `0.5px solid ${BORDER}` }}>
                <div className="font-mono text-[32px] font-bold leading-none mb-2" style={{ color: 'rgba(245,197,24,0.2)' }}>{s.n}</div>
                <div className="text-[15px] font-bold text-white mb-2">{s.t}</div>
                <p className="text-[13px] leading-[1.6]" style={{ color: MUTED }}>{s.b}</p>
              </div>
              {i < STEPS.length - 1 && (
                <div className="mx-auto w-[2px] h-8" style={{ background: BORDER }} />
              )}
            </div>
          ))}
        </div>
        <button onClick={() => navigate('/auth')}
          className="mt-6 w-full rounded-[10px] py-[14px] text-sm font-bold transition-opacity hover:opacity-90"
          style={{ background: YELLOW, color: BG }}>
          Créer mon premier dossier →
        </button>
      </Section>

      {/* POUR QUI */}
      <Section bg={BG_ALT} label="POUR QUI" title={<>Particulier ou entreprise,<br />Yobbanté s'adapte.</>}>
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          <div className="rounded-2xl p-5" style={{ background: CARD, border: `0.5px solid ${BORDER}` }}>
            <div className="text-2xl mb-3">👤</div>
            <div className="text-[16px] font-bold text-white mb-3">Particulier</div>
            <ul className="space-y-2 text-[13px] mb-5" style={{ color: MUTED }}>
              <li>✓ Achats en ligne depuis l'étranger</li>
              <li>✓ Envois vers la famille à l'étranger</li>
              <li>✓ Sourcing de produits introuvables</li>
              <li>✓ Suivi en temps réel sur WhatsApp</li>
            </ul>
            <button onClick={() => navigate('/auth')}
              className="w-full rounded-[10px] py-3 text-sm font-bold"
              style={{ background: YELLOW, color: BG }}>
              Commencer gratuitement →
            </button>
          </div>

          <div className="rounded-2xl p-5"
            style={{ background: 'rgba(245,197,24,0.04)', border: `1.5px solid ${YELLOW}` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-2xl">🏢</div>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                style={{ background: YELLOW, color: BG }}>Business</span>
            </div>
            <div className="text-[16px] font-bold text-white mb-3">Entreprise</div>
            <ul className="space-y-2 text-[13px] mb-5" style={{ color: MUTED }}>
              <li>✓ Import/export commercial</li>
              <li>✓ Gestion d'équipe multi-utilisateurs</li>
              <li>✓ Tarifs négociés -8% à -15%</li>
              <li>✓ Chargé de compte dédié</li>
              <li>✓ Documents douaniers inclus</li>
            </ul>
            <button onClick={() => navigate('/business/pricing')}
              className="w-full rounded-[10px] py-3 text-sm font-medium text-white"
              style={{ background: 'transparent', border: '1px solid #2A2A2A' }}>
              Voir les offres Business →
            </button>
          </div>
        </div>
      </Section>

      {/* TÉMOIGNAGES */}
      <Section bg={BG} label="ILS NOUS FONT CONFIANCE" title="Ce que disent nos clients.">
        <div className="flex md:grid md:grid-cols-3 gap-3 overflow-x-auto -mx-5 px-5 snap-x pb-2">
          {TESTIMONIALS.map(t => (
            <div key={t.a} className="flex-shrink-0 min-w-[280px] snap-start rounded-[14px] p-5"
              style={{ background: CARD, border: `0.5px solid ${BORDER}` }}>
              <div className="text-[14px] mb-3" style={{ color: YELLOW }}>★★★★★</div>
              <p className="text-[13px] italic leading-[1.6] mb-4" style={{ color: MUTED }}>"{t.q}"</p>
              <div className="text-[12px] font-semibold text-white">{t.a}</div>
              <div className="font-mono text-[10px] mt-1" style={{ color: FAINT }}>{t.s}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* SIMULATEUR */}
      <section className="px-5 py-12" style={{ background: CARD, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-[480px] md:max-w-3xl mx-auto">
          <h2 className="text-[20px] font-extrabold text-white text-center">Combien coûte votre envoi ?</h2>
          <p className="font-mono text-[12px] text-center mt-1 mb-5" style={{ color: FAINT }}>
            Estimation instantanée · Sans inscription
          </p>
          <PricingSimulator ctaTo="/auth" />
        </div>
      </section>

      {/* PARTENAIRES */}
      <Section bg={BG} label="NOS PARTENAIRES" title={null}>
        <div className="flex gap-3 overflow-x-auto -mx-5 px-5 pb-2">
          {CARRIERS.map(c => (
            <span key={c} className="flex-shrink-0 font-mono text-[11px] px-4 py-2 rounded-lg"
              style={{ background: '#161616', border: '0.5px solid #2A2A2A', color: FAINT }}>
              {c}
            </span>
          ))}
        </div>
      </Section>

      {/* CTA FINAL */}
      <section className="px-5 py-20 text-center"
        style={{ background: `linear-gradient(180deg, ${BG} 0%, ${CARD} 100%)` }}>
        <h2 className="text-[28px] font-extrabold text-white" style={{ letterSpacing: '-0.03em' }}>
          Prêt à simplifier<br />votre logistique ?
        </h2>
        <p className="text-[13px] mt-4 max-w-[320px] mx-auto" style={{ color: MUTED }}>
          Créez votre compte en 2 minutes. Sans engagement. Sans carte bancaire.
        </p>
        <button onClick={() => navigate('/auth')}
          className="mt-7 rounded-[10px] px-8 py-4 text-[15px] font-bold transition-opacity hover:opacity-90"
          style={{ background: YELLOW, color: BG }}>
          Créer mon compte gratuit →
        </button>
        <p className="text-[13px] mt-5" style={{ color: MUTED }}>
          Déjà un compte ? <Link to="/auth" style={{ color: YELLOW }}>Se connecter →</Link>
        </p>
      </section>

      {/* FOOTER */}
      <footer className="px-5 py-8" style={{ background: BG_ALT, borderTop: `1px solid ${BORDER}` }}>
        <div className="max-w-[480px] md:max-w-3xl mx-auto">
          <div className="font-mono text-[11px] mb-1 text-white font-bold">YOBBANTÉ</div>
          <p className="text-[11px]" style={{ color: FAINT }}>Logistique internationale depuis Dakar.</p>

          <div className="grid grid-cols-3 gap-4 mt-8">
            <FooterCol title="Produit" links={[
              { label: 'Recevoir', to: '/expedier/recevoir' },
              { label: 'Expédier', to: '/expedier' },
              { label: 'Sourcing', to: '/acheter' },
              { label: 'Tarifs', to: '/tarifs' },
            ]} />
            <FooterCol title="Business" links={[
              { label: 'Offres entreprise', to: '/business/pricing' },
              { label: 'Se connecter', to: '/auth' },
              { label: 'Créer un compte', to: '/auth' },
            ]} />
            <FooterCol title="Contact" links={[
              { label: 'WhatsApp', href: 'https://wa.me/221786078080' },
              { label: 'Email', href: 'mailto:contact@yobbante.com' },
            ]} />
          </div>

          <div className="mt-8 pt-5 text-center font-mono text-[10px] space-y-1" style={{ color: '#333333', borderTop: `1px solid ${BORDER}` }}>
            <p>© 2026 Yobbanté Sénégal · Tous droits réservés</p>
            <p>Politique de confidentialité · CGU</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ bg, label, title, children }: { bg: string; label: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="px-5 py-[60px]" style={{ background: bg }}>
      <div className="max-w-[480px] md:max-w-3xl mx-auto">
        <div className="font-mono text-[10px] uppercase text-center mb-2" style={{ letterSpacing: '0.14em', color: YELLOW }}>
          {label}
        </div>
        {title && (
          <h2 className="text-[22px] font-extrabold text-white text-center mb-8">{title}</h2>
        )}
        {children}
      </div>
    </section>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; to?: string; href?: string }[] }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase mb-3" style={{ color: YELLOW, letterSpacing: '0.14em' }}>{title}</div>
      <ul className="space-y-2">
        {links.map(l => (
          <li key={l.label}>
            {l.to ? (
              <Link to={l.to} className="text-[11px] hover:text-white transition-colors" style={{ color: MUTED }}>{l.label}</Link>
            ) : (
              <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-[11px] hover:text-white transition-colors" style={{ color: MUTED }}>{l.label}</a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
