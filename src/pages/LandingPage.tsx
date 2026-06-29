import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, MapPin, CreditCard, FileEdit, UserCheck, PackageCheck, Star } from 'lucide-react';
import { HubsWorldMap, type HubId } from '@/components/HubsWorldMap';
import { LandingWorldMap } from '@/components/LandingWorldMap';
import { QuoteForm } from '@/components/quote/QuoteForm';
import { LiveDeparturesTicker } from '@/components/LiveDeparturesTicker';
import { useSeo } from '@/hooks/useSeo';
import { useHasDossiers } from '@/hooks/useHasDossiers';
import yobbanteLogoAsset from '@/assets/yobbante-logo-mark.png.asset.json';

const YELLOW = '#F5C518';
const NAVY = '#0D1B2A';
const DISPLAY_FONT =
  '"Anton","Bebas Neue",-apple-system,BlinkMacSystemFont,sans-serif';
const BODY_FONT = '"Inter",-apple-system,BlinkMacSystemFont,system-ui,sans-serif';

const NAV_LINKS: { label: string; to: string }[] = [
  { label: 'Expédier', to: '/expedier' },
  { label: 'Tarifs', to: '/tarifs' },
  { label: 'Suivre mon colis', to: '/track' },
  { label: 'Boutique Dëkk', to: '/boutique' },
];

const DESTINATIONS: { flag: string; name: string; hub: HubId | null }[] = [
  { flag: '🇫🇷', name: 'Paris', hub: 'FR' },
  { flag: '🇺🇸', name: 'New York', hub: 'US' },
  { flag: '🇨🇦', name: 'Montréal', hub: null },
  { flag: '🇦🇪', name: 'Dubai', hub: 'AE' },
  { flag: '🇨🇳', name: 'Shanghai', hub: 'CN' },
  { flag: '🇨🇮', name: 'Abidjan', hub: null },
];

const STEPS = [
  {
    n: '01',
    Icon: FileEdit,
    title: 'Créez votre dossier',
    body:
      'En ligne en 3 minutes. Remplissez les infos de votre colis, choisissez votre destination.',
  },
  {
    n: '02',
    Icon: UserCheck,
    title: 'Un transporteur collecte',
    body:
      'Un de nos partenaires vérifiés récupère votre colis à Dakar et le transporte dans sa soute.',
  },
  {
    n: '03',
    Icon: PackageCheck,
    title: 'Livré à destination',
    body:
      'Votre destinataire reçoit le colis. Vous suivez chaque étape en temps réel sur WhatsApp.',
  },
];

const TRUST = [
  {
    Icon: Lock,
    title: 'Transporteurs vérifiés',
    body: 'Chaque partenaire est validé avant sa première mission.',
  },
  {
    Icon: MapPin,
    title: 'Suivi en temps réel',
    body: 'Notifications WhatsApp à chaque étape jusqu’à livraison.',
  },
  {
    Icon: CreditCard,
    title: 'Prix transparent',
    body: 'Devis instantané. Aucun frais caché. Paiement Wave ou Orange Money.',
  },
];

const TESTIMONIALS = [
  {
    quote:
      "J'ai envoyé des médicaments à ma mère à Paris. Livré en 4 jours, suivi en temps réel. Je recommande.",
    name: 'Aminata D., Dakar',
  },
  {
    quote:
      'Prix imbattable versus DHL. Et le suivi WhatsApp rassure vraiment.',
    name: 'Moussa K., Dakar',
  },
  {
    quote: "Simple, rapide, honnête. C'est tout ce qu'on demande.",
    name: 'Fatou S., Dakar',
  },
];

export default function LandingPage() {
  useSeo({
    title: 'Yobbanté — Envoyer un colis de Dakar vers le monde',
    description:
      'Yobbanté livre vos colis de Dakar vers Paris, New York, Dubai et plus. Prix instantané, paiement Wave ou Orange Money, suivi WhatsApp.',
    path: '/',
  });

  const navigate = useNavigate();
  const [selectedHub, setSelectedHub] = useState<HubId | null>(null);

  useEffect(() => {
    document.title = 'Yobbanté — Envoyez partout depuis Dakar.';
  }, []);

  const goExpedier = (destinationHub?: HubId | null) => {
    if (destinationHub) {
      try {
        sessionStorage.setItem(
          'yobbante.landing.preferredHub',
          destinationHub,
        );
      } catch {
        /* */
      }
    }
    navigate('/expedier');
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#FFFFFF', color: NAVY, fontFamily: BODY_FONT }}
    >
      <LandingNav onExpedier={() => goExpedier()} />
      <ReturningClientBanner />

      {/* ───── DEPARTURES TICKER ───── */}
      <section
        style={{
          background: YELLOW,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: '100%' }}>
          <LiveDeparturesTicker />
        </div>
      </section>

      {/* ───── HERO ───── */}

      <section
        style={{
          minHeight: 'calc(100vh - 64px)',
          display: 'flex',
          alignItems: 'center',
          padding: '48px 20px',
        }}
      >
        <div className="w-full max-w-[1180px] mx-auto flex flex-col items-center text-center">
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 999,
              background: '#F4F4F5',
              color: '#52525B',
              fontSize: 13,
              letterSpacing: '0.06em',
              fontWeight: 500,
            }}
          >
            Dakar · Abidjan · Paris · New York · Dubai
          </span>

          <h1
            style={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 400,
              fontSize: 'clamp(52px, 9vw, 96px)',
              lineHeight: 0.95,
              letterSpacing: '-0.01em',
              margin: '28px 0 20px',
              textTransform: 'uppercase',
            }}
          >
            <span style={{ display: 'block', color: NAVY }}>YOBBANTÉ.</span>
            <span style={{ display: 'block', color: '#A1A1AA' }}>
              Envoyez partout
            </span>
            <span style={{ display: 'block', color: YELLOW }}>
              depuis Dakar.
            </span>
          </h1>

          <p
            style={{
              maxWidth: 440,
              fontSize: 18,
              lineHeight: 1.55,
              color: '#52525B',
              margin: '0 0 36px',
            }}
          >
            Vos colis voyagent avec des personnes de confiance. Prix
            instantané. Pas d'appel.
          </p>

          {/* Search card (kept) */}
          <div
            id="hero-quote-form"
            style={{
              width: '100%',
              maxWidth: 720,
              background: '#FFFFFF',
              borderRadius: 16,
              padding: 'clamp(16px, 3vw, 24px)',
              boxShadow:
                '0 1px 2px rgba(13,27,42,0.04), 0 8px 32px rgba(13,27,42,0.08)',
              border: '1px solid #F1F1F4',
            }}
          >
            <QuoteForm />
          </div>

          <p
            style={{
              marginTop: 16,
              fontSize: 12,
              color: '#71717A',
              letterSpacing: '0.02em',
            }}
          >
            Prix instantané · Confirmation en 24h · Suivi en temps réel
          </p>
        </div>
      </section>

      {/* ───── WORLD MAP ───── */}
      <section style={{ background: NAVY, padding: '80px 20px' }}>
        <div className="max-w-[1180px] mx-auto">
          <p
            style={{
              color: YELLOW,
              fontSize: 12,
              letterSpacing: '0.24em',
              fontWeight: 600,
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            NOS CORRIDORS
          </p>
          <h2
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 'clamp(40px, 6vw, 64px)',
              lineHeight: 1,
              color: '#FFFFFF',
              textAlign: 'center',
              letterSpacing: '-0.01em',
              margin: 0,
              textTransform: 'uppercase',
            }}
          >
            36 destinations.
          </h2>
          <p
            style={{
              color: 'rgba(255,255,255,0.6)',
              textAlign: 'center',
              fontSize: 18,
              marginTop: 12,
            }}
          >
            De Dakar vers le monde entier.
          </p>

          <div style={{ marginTop: 48 }}>
            <LandingWorldMap />
          </div>

        </div>
      </section>

      {/* ───── COMMENT ÇA MARCHE ───── */}

      <section style={{ background: '#FFFFFF', padding: '96px 20px' }}>
        <div className="max-w-[1180px] mx-auto">
          <p
            style={{
              fontSize: 12,
              letterSpacing: '0.24em',
              color: '#71717A',
              fontWeight: 600,
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            PROCESSUS
          </p>
          <h2
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 'clamp(40px, 6vw, 64px)',
              lineHeight: 1,
              color: NAVY,
              textAlign: 'center',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '-0.01em',
            }}
          >
            Simple comme bonjour.
          </h2>

          <div
            style={{
              marginTop: 56,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
              gap: 20,
            }}
          >
            {STEPS.map(({ n, Icon, title, body }) => (
              <article
                key={n}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #F1F1F4',
                  borderRadius: 16,
                  padding: 28,
                  boxShadow:
                    '0 1px 2px rgba(13,27,42,0.03), 0 6px 24px rgba(13,27,42,0.05)',
                }}
              >
                <div
                  style={{
                    fontFamily: DISPLAY_FONT,
                    fontSize: 80,
                    lineHeight: 1,
                    color: '#E4E4E7',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {n}
                </div>
                <Icon
                  size={28}
                  strokeWidth={1.8}
                  style={{ color: NAVY, marginTop: 8 }}
                />
                <h3
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: NAVY,
                    marginTop: 16,
                    marginBottom: 8,
                  }}
                >
                  {title}
                </h3>
                <p style={{ color: '#52525B', fontSize: 15, lineHeight: 1.6 }}>
                  {body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ───── CONFIANCE ───── */}
      <section style={{ background: NAVY, padding: '96px 20px' }}>
        <div className="max-w-[1180px] mx-auto">
          <p
            style={{
              fontSize: 12,
              letterSpacing: '0.24em',
              color: YELLOW,
              fontWeight: 600,
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            CONFIANCE
          </p>
          <h2
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 'clamp(40px, 6vw, 72px)',
              lineHeight: 1.05,
              color: '#FFFFFF',
              textAlign: 'center',
              margin: 0,
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
            }}
          >
            Sécurité et transparence,
            <br />
            <span
              style={{
                fontStyle: 'italic',
                color: 'rgba(255,255,255,0.6)',
                fontFamily:
                  '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                fontWeight: 300,
                textTransform: 'none',
                fontSize: 'clamp(28px, 4.5vw, 52px)',
              }}
            >
              au cœur de Yobbanté.
            </span>
          </h2>

          <div
            style={{
              marginTop: 64,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
              gap: 32,
            }}
          >
            {TRUST.map(({ Icon, title, body }) => (
              <div key={title}>
                <Icon
                  size={28}
                  strokeWidth={1.8}
                  style={{ color: YELLOW }}
                />
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#FFFFFF',
                    marginTop: 16,
                    marginBottom: 8,
                  }}
                >
                  {title}
                </h3>
                <p
                  style={{
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: 15,
                    lineHeight: 1.6,
                  }}
                >
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── TÉMOIGNAGES ───── */}
      <section style={{ background: '#F8F8F8', padding: '96px 20px' }}>
        <div className="max-w-[1180px] mx-auto">
          <p
            style={{
              fontSize: 12,
              letterSpacing: '0.24em',
              color: '#71717A',
              fontWeight: 600,
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            TÉMOIGNAGES
          </p>
          <h2
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 'clamp(40px, 6vw, 64px)',
              lineHeight: 1,
              color: NAVY,
              textAlign: 'center',
              margin: 0,
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
            }}
          >
            Ce qu'ils en disent.
          </h2>

          <div
            style={{
              marginTop: 56,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
              gap: 20,
            }}
          >
            {TESTIMONIALS.map((t, i) => (
              <article
                key={i}
                style={{
                  background: '#FFFFFF',
                  borderRadius: 16,
                  padding: 28,
                  boxShadow:
                    '0 1px 2px rgba(13,27,42,0.03), 0 6px 24px rgba(13,27,42,0.05)',
                }}
              >
                <div
                  style={{ display: 'inline-flex', gap: 2, marginBottom: 16 }}
                >
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star
                      key={s}
                      size={16}
                      style={{ color: YELLOW, fill: YELLOW }}
                    />
                  ))}
                </div>
                <p
                  style={{
                    fontSize: 16,
                    lineHeight: 1.6,
                    color: NAVY,
                    minHeight: 96,
                  }}
                >
                  "{t.quote}"
                </p>
                <p
                  style={{
                    marginTop: 24,
                    fontSize: 13,
                    color: '#71717A',
                    fontWeight: 500,
                  }}
                >
                  — {t.name}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ───── FINAL CTA ───── */}
      <section
        style={{
          background: YELLOW,
          padding: '80px 20px',
          textAlign: 'center',
        }}
      >
        <div className="max-w-[760px] mx-auto">
          <h2
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 'clamp(40px, 6vw, 64px)',
              lineHeight: 1.05,
              color: NAVY,
              margin: 0,
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
            }}
          >
            Prêt à envoyer votre premier colis ?
          </h2>
          <p
            style={{
              fontSize: 18,
              color: NAVY,
              opacity: 0.85,
              marginTop: 16,
              lineHeight: 1.55,
            }}
          >
            Obtenez un prix en 30 secondes. Sans inscription. Sans appel.
          </p>
          <button
            type="button"
            onClick={() => goExpedier()}
            style={{
              marginTop: 32,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 32px',
              height: 56,
              borderRadius: 999,
              background: NAVY,
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: 16,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(13,27,42,0.25)',
            }}
          >
            Expédier maintenant <ArrowRight size={18} />
          </button>
          <p
            style={{
              marginTop: 20,
              fontSize: 13,
              color: NAVY,
              opacity: 0.7,
            }}
          >
            Prix instantané · Suivi WhatsApp · Paiement Wave / Orange Money
          </p>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

/* ───────────────────────────── NAV ───────────────────────────── */
function LandingNav({ onExpedier }: { onExpedier: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const allLinks = [
    ...NAV_LINKS,
    { label: 'Se connecter', to: '/auth' },
  ];

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: '#FFFFFF',
        borderBottom: '1px solid #F1F1F4',
        height: 64,
      }}
    >
      <div
        className="max-w-[1180px] mx-auto"
        style={{
          height: '100%',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <Link to="/" aria-label="Yobbanté — accueil" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <img
            src={yobbanteLogoAsset.url}
            alt="Yobbanté logo"
            style={{ height: 36, width: 'auto', background: 'transparent', display: 'block' }}
          />
        </Link>

        <nav
          className="hidden md:flex"
          style={{ alignItems: 'center', gap: 28 }}
        >
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: NAVY,
                transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.opacity = '0.6';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.opacity = '1';
              }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            to="/auth"
            className="hidden sm:inline-flex"
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: NAVY,
              padding: '8px 4px',
            }}
          >
            Se connecter
          </Link>
          <button
            type="button"
            onClick={onExpedier}
            className="hidden md:inline-flex"
            style={{
              alignItems: 'center',
              gap: 8,
              padding: '0 18px',
              height: 42,
              borderRadius: 999,
              background: YELLOW,
              color: NAVY,
              fontWeight: 700,
              fontSize: 14,
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Expédier maintenant <ArrowRight size={16} />
          </button>

          {/* Hamburger new-gen (mobile/tablet) */}
          <button
            type="button"
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden inline-flex"
            style={{
              position: 'relative',
              width: 44,
              height: 44,
              borderRadius: 14,
              background: menuOpen ? NAVY : '#F6F6F8',
              border: '1px solid',
              borderColor: menuOpen ? NAVY : '#ECECF0',
              cursor: 'pointer',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.35s ease, border-color 0.35s ease, transform 0.2s ease',
              transform: menuOpen ? 'scale(0.96)' : 'scale(1)',
            }}
          >
            <span
              style={{
                position: 'relative',
                width: 20,
                height: 14,
                display: 'inline-block',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: menuOpen ? 6 : 0,
                  width: '100%',
                  height: 2,
                  borderRadius: 2,
                  background: menuOpen ? '#FFFFFF' : NAVY,
                  transform: menuOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                  transition: 'top 0.25s ease, transform 0.35s cubic-bezier(0.65,0,0.35,1), background 0.2s ease',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 6,
                  width: '100%',
                  height: 2,
                  borderRadius: 2,
                  background: menuOpen ? '#FFFFFF' : NAVY,
                  opacity: menuOpen ? 0 : 1,
                  transform: menuOpen ? 'translateX(8px)' : 'translateX(0)',
                  transition: 'opacity 0.18s ease, transform 0.25s ease, background 0.2s ease',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: menuOpen ? 6 : 12,
                  width: '100%',
                  height: 2,
                  borderRadius: 2,
                  background: menuOpen ? '#FFFFFF' : NAVY,
                  transform: menuOpen ? 'rotate(-45deg)' : 'rotate(0deg)',
                  transition: 'top 0.25s ease, transform 0.35s cubic-bezier(0.65,0,0.35,1), background 0.2s ease',
                }}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Backdrop blur */}
      <div
        onClick={() => setMenuOpen(false)}
        aria-hidden
        className="md:hidden"
        style={{
          position: 'fixed',
          inset: 0,
          top: 64,
          background: 'rgba(13, 27, 42, 0.32)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? 'auto' : 'none',
          transition: 'opacity 0.35s ease',
          zIndex: 40,
        }}
      />

      {/* Dropdown panel */}
      <div
        className="md:hidden"
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          top: 72,
          background: '#FFFFFF',
          borderRadius: 20,
          boxShadow:
            '0 1px 0 rgba(13,27,42,0.04), 0 24px 48px -16px rgba(13,27,42,0.18), 0 8px 24px -8px rgba(13,27,42,0.10)',
          border: '1px solid #F1F1F4',
          padding: 14,
          transformOrigin: 'top right',
          transform: menuOpen ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.98)',
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? 'auto' : 'none',
          transition:
            'opacity 0.32s cubic-bezier(0.22,1,0.36,1), transform 0.42s cubic-bezier(0.22,1,0.36,1)',
          zIndex: 45,
        }}
      >
        <nav style={{ display: 'flex', flexDirection: 'column' }}>
          {allLinks.map((l, i) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 14px',
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                color: NAVY,
                letterSpacing: '-0.01em',
                transform: menuOpen ? 'translateY(0)' : 'translateY(6px)',
                opacity: menuOpen ? 1 : 0,
                transition: `opacity 0.4s ease ${80 + i * 50}ms, transform 0.45s cubic-bezier(0.22,1,0.36,1) ${80 + i * 50}ms, background 0.15s ease`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = '#F6F6F8';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
              }}
            >
              <span>{l.label}</span>
              <ArrowRight size={16} style={{ opacity: 0.4 }} />
            </Link>
          ))}

          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onExpedier();
            }}
            style={{
              marginTop: 10,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              height: 50,
              borderRadius: 14,
              background: YELLOW,
              color: NAVY,
              fontWeight: 700,
              fontSize: 15,
              border: 'none',
              cursor: 'pointer',
              transform: menuOpen ? 'translateY(0)' : 'translateY(8px)',
              opacity: menuOpen ? 1 : 0,
              transition: `opacity 0.4s ease ${80 + allLinks.length * 50}ms, transform 0.45s cubic-bezier(0.22,1,0.36,1) ${80 + allLinks.length * 50}ms`,
            }}
          >
            Expédier maintenant <ArrowRight size={16} />
          </button>
        </nav>
      </div>
    </header>
  );
}

/* ───────────────────────────── FOOTER ───────────────────────────── */
function LandingFooter() {
  const cols: { title: string; items: { label: string; to: string; external?: boolean }[] }[] = [
    {
      title: 'Services',
      items: [
        { label: 'Expédier un colis', to: '/expedier' },
        { label: 'Tarifs', to: '/tarifs' },
        { label: 'Suivre mon colis', to: '/track' },
        { label: 'Boutique Dëkk', to: '/boutique' },
      ],
    },
    {
      title: 'Légal',
      items: [
        { label: 'Mentions légales', to: '/mentions-legales' },
        { label: 'Confidentialité', to: '/confidentialite' },
        { label: 'CGU · CGV', to: '/cgu' },
        { label: 'Cookies', to: '/cookies' },
      ],
    },
  ];

  return (
    <footer style={{ background: NAVY, color: '#FFFFFF', padding: '64px 20px 32px' }}>
      <div className="max-w-[1180px] mx-auto">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 32,
          }}
        >
          <div>
            <img
              src={yobbanteLogoAsset.url}
              alt="Yobbanté logo"
              style={{ height: 36, width: 'auto', display: 'block', marginBottom: 16 }}
            />
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.55, maxWidth: 220 }}>
              La logistique humaine depuis Dakar.
            </p>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <h4
                style={{
                  fontSize: 12,
                  letterSpacing: '0.18em',
                  color: YELLOW,
                  fontWeight: 600,
                  marginBottom: 16,
                }}
              >
                {c.title.toUpperCase()}
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.items.map((i) => (
                  <li key={i.label}>
                    <Link
                      to={i.to}
                      style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}
                    >
                      {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h4
              style={{
                fontSize: 12,
                letterSpacing: '0.18em',
                color: YELLOW,
                fontWeight: 600,
                marginBottom: 16,
              }}
            >
              CONTACT
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <li>
                <a
                  href="https://wa.me/221786078080"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}
                >
                  WhatsApp : +221 78 607 80 80
                </a>
              </li>
              <li>
                <a
                  href="mailto:contact@yobbante.com"
                  style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}
                >
                  contact@yobbante.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div
          style={{
            marginTop: 48,
            paddingTop: 24,
            borderTop: '1px solid rgba(255,255,255,0.1)',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.5)',
            fontSize: 13,
          }}
        >
          © 2026 Yobbanté · Tous droits réservés
        </div>
      </div>
    </footer>
  );
}

/* ──────────────────────── Returning client ribbon ──────────────────────── */
function ReturningClientBanner() {
  const navigate = useNavigate();
  const { hasDossiers } = useHasDossiers();
  if (!hasDossiers) return null;
  return (
    <button
      type="button"
      onClick={() => navigate('/app')}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '10px 16px',
        background: YELLOW,
        color: NAVY,
        fontWeight: 600,
        fontSize: 13,
        border: 'none',
        cursor: 'pointer',
      }}
    >
      Suivre mes commandes <ArrowRight size={14} />
    </button>
  );
}
