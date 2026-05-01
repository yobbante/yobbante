import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { whatsappLink } from '@/lib/contact';

/* ============================================================
   YOBBANTÉ BUSINESS — Pricing page (standalone, dark theme)
   Self-contained styles: does not touch the global design system.
   ============================================================ */

const COLORS = {
  bg: '#0A0A0A',
  card: '#111111',
  cardAlt: '#0F0F0F',
  border: '#1E1E1E',
  borderSoft: '#2A2A2A',
  headerRow: '#161616',
  text: '#FFFFFF',
  textSec: '#AAAAAA',
  muted: '#555555',
  mutedDash: '#333333',
  yellow: '#F5C518',
  yellowHover: '#FFD740',
  yellowSoft: 'rgba(245,197,24,0.06)',
  yellowSoft2: 'rgba(245,197,24,0.08)',
  green: '#22C55E',
};

const FONT_UI = "'DM Sans', system-ui, -apple-system, sans-serif";
const FONT_MONO = "'DM Mono', 'JetBrains Mono', ui-monospace, monospace";

const fmt = (n: number) => n.toLocaleString('fr-FR').replace(/\u202f/g, ' ').replace(/,/g, ' ');

type Billing = 'monthly' | 'annual';

interface Plan {
  id: 'starter' | 'business' | 'enterprise';
  name: string;
  price: string;
  priceMonthly?: number;
  priceSub?: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref?: string;
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: `${fmt(29900)} FCFA`,
    priceMonthly: 29900,
    description: 'Pour les commerçants et PME qui importent régulièrement.',
    features: [
      'Compte Business vérifié (NINEA)',
      "2 membres d'équipe",
      'Traitement prioritaire des dossiers',
      'Tarifs transport -8% vs particulier',
      'Documents douaniers inclus (5/mois)',
      'Chargé de compte partagé',
      'Facturation mensuelle consolidée',
      'Support WhatsApp — réponse sous 4h',
    ],
    cta: "Démarrer l'essai gratuit",
    ctaHref: '/business',
  },
  {
    id: 'business',
    name: 'Business',
    price: `${fmt(89900)} FCFA`,
    priceMonthly: 89900,
    description: "Pour les entreprises import/export actives avec volumes réguliers.",
    features: [
      'Tout le plan Starter',
      "10 membres d'équipe",
      'Tarifs transport -15% vs particulier',
      'Documents douaniers illimités',
      'Chargé de compte dédié (pas partagé)',
      'Sourcing avec mandat de négociation (3/mois)',
      'Stockage hub 7 jours offerts par dossier',
      'Mise en relation acheteurs export (1/mois)',
      'Rapport mensuel activité détaillé',
      'Accès API tracking',
      'Support WhatsApp — réponse sous 1h',
    ],
    cta: 'Choisir Business',
    ctaHref: '/business',
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Sur devis',
    priceSub: `À partir de ${fmt(250000)} FCFA / mois`,
    description: 'Pour les grandes entreprises, groupes industriels et importateurs volume.',
    features: [
      'Tout le plan Business',
      "Membres d'équipe illimités",
      'Tarifs transport sur mesure',
      'Dédouanement géré de A à Z',
      'Entrepôt dédié au hub Yobbanté',
      'Fulfillment e-commerce complet',
      'Contrats cadres fournisseurs gérés',
      'Chargé de compte senior dédié',
      'SLA garanti contractuellement',
      'Intégration ERP / système comptable',
      'Facturation en devise (EUR · USD)',
    ],
    cta: 'Nous contacter',
    ctaHref: whatsappLink('Bonjour Yobbanté, je souhaite discuter du plan Enterprise.'),
  },
];

const TABLE_ROWS: { label: string; values: [string, string, string]; check?: [boolean, boolean, boolean] }[] = [
  { label: 'Prix / mois', values: [`${fmt(29900)}`, `${fmt(89900)}`, 'Sur devis'] },
  { label: 'Membres équipe', values: ['2', '10', 'Illimité'] },
  { label: 'Réduction transport', values: ['-8%', '-15%', 'Sur mesure'] },
  { label: 'Docs douaniers/mois', values: ['5', 'Illimité', 'Illimité'] },
  { label: 'Chargé de compte', values: ['Partagé', 'Dédié', 'Senior'] },
  { label: 'Sourcing/mois', values: ['—', '3', 'Illimité'] },
  { label: 'Stockage hub offert', values: ['—', '7j/dossier', 'Sur mesure'] },
  { label: 'Mise en relation export', values: ['—', '1/mois', 'Illimité'] },
  { label: 'Rapport mensuel', values: ['—', '✓', '✓'] },
  { label: 'API tracking', values: ['—', '✓', '✓'] },
  { label: 'Fulfillment e-commerce', values: ['—', '—', '✓'] },
  { label: 'SLA garanti', values: ['—', '—', '✓'] },
  { label: 'Support WhatsApp', values: ['4h', '1h', 'SLA'] },
];

const FAQ = [
  {
    q: 'Puis-je changer de plan à tout moment ?',
    a: 'Oui. Vous pouvez upgrader immédiatement ou downgrader en fin de période. Aucun engagement minimum.',
  },
  {
    q: "Que se passe-t-il après l'essai gratuit ?",
    a: 'À la fin des 30 jours, vous choisissez un plan ou repassez en compte particulier. Vos dossiers et historique sont conservés.',
  },
  {
    q: 'Le NINEA est-il obligatoire ?',
    a: 'Oui. Yobbanté Business est réservé aux entreprises légalement enregistrées au Sénégal. Le NINEA garantit l\'accès aux documents douaniers professionnels.',
  },
];

/* ─── Components ─────────────────────────────────────────── */

function BillingToggle({ value, onChange }: { value: Billing; onChange: (b: Billing) => void }) {
  const base: React.CSSProperties = {
    fontFamily: FONT_UI,
    fontSize: 12,
    fontWeight: 600,
    padding: '8px 16px',
    borderRadius: 999,
    cursor: 'pointer',
    border: 'none',
    transition: 'all 160ms ease',
  };
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 4,
        background: COLORS.card,
        border: `0.5px solid ${COLORS.border}`,
        borderRadius: 999,
        gap: 4,
      }}
    >
      <button
        onClick={() => onChange('monthly')}
        style={{
          ...base,
          background: value === 'monthly' ? COLORS.yellow : 'transparent',
          color: value === 'monthly' ? '#0A0A0A' : COLORS.textSec,
        }}
      >
        Mensuel
      </button>
      <button
        onClick={() => onChange('annual')}
        style={{
          ...base,
          background: value === 'annual' ? COLORS.yellow : 'transparent',
          color: value === 'annual' ? '#0A0A0A' : COLORS.textSec,
        }}
      >
        Annuel <span style={{ opacity: 0.7, marginLeft: 4 }}>-2 mois offerts</span>
      </button>
    </div>
  );
}

function PlanCard({ plan, billing }: { plan: Plan; billing: Billing }) {
  const isHighlight = !!plan.highlight;
  const annualPrice = plan.priceMonthly ? plan.priceMonthly * 10 : null;

  return (
    <div
      style={{
        position: 'relative',
        background: isHighlight ? COLORS.yellowSoft : COLORS.card,
        border: isHighlight ? `1.5px solid ${COLORS.yellow}` : `0.5px solid ${COLORS.border}`,
        borderRadius: 16,
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {isHighlight && (
        <div
          style={{
            position: 'absolute',
            top: -12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: COLORS.yellow,
            color: '#0A0A0A',
            fontFamily: FONT_MONO,
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '4px 12px',
            borderRadius: 20,
            whiteSpace: 'nowrap',
          }}
        >
          Le plus choisi
        </div>
      )}

      <div>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: isHighlight ? COLORS.yellow : COLORS.textSec,
            marginBottom: 12,
          }}
        >
          {plan.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: COLORS.text, letterSpacing: '-0.02em' }}>
            {plan.price}
          </span>
          {plan.priceMonthly && (
            <span style={{ fontSize: 13, color: COLORS.muted, fontFamily: FONT_MONO }}>/mois</span>
          )}
        </div>
        {billing === 'annual' && annualPrice && (
          <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: FONT_MONO, marginTop: 4 }}>
            {fmt(annualPrice)} FCFA / an
          </div>
        )}
        {plan.priceSub && (
          <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: FONT_MONO, marginTop: 4 }}>
            {plan.priceSub}
          </div>
        )}
      </div>

      <p style={{ fontSize: 13, color: COLORS.textSec, lineHeight: 1.5, margin: 0 }}>{plan.description}</p>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {plan.features.map((f) => (
          <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12, color: COLORS.text }}>
            <Check size={14} strokeWidth={2.5} color={COLORS.green} style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ lineHeight: 1.45 }}>{f}</span>
          </li>
        ))}
      </ul>

      <a
        href={plan.ctaHref || '#'}
        target={plan.ctaHref?.startsWith('http') ? '_blank' : undefined}
        rel={plan.ctaHref?.startsWith('http') ? 'noopener noreferrer' : undefined}
        className="ybp-cta"
        data-highlight={isHighlight ? 'true' : 'false'}
        style={{
          display: 'block',
          textAlign: 'center',
          width: '100%',
          padding: '12px 16px',
          borderRadius: 10,
          fontFamily: FONT_UI,
          fontSize: 13,
          fontWeight: isHighlight ? 700 : 600,
          textDecoration: 'none',
          background: isHighlight ? COLORS.yellow : 'transparent',
          color: isHighlight ? '#0A0A0A' : COLORS.text,
          border: isHighlight ? 'none' : `1px solid ${COLORS.borderSoft}`,
          transition: 'all 160ms ease',
        }}
      >
        {plan.cta}
      </a>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `0.5px solid ${COLORS.border}` }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: '18px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          color: COLORS.text,
          fontFamily: FONT_UI,
          fontSize: 14,
          fontWeight: 600,
          textAlign: 'left',
        }}
      >
        <span>{q}</span>
        <ChevronDown
          size={18}
          color={COLORS.textSec}
          style={{ transition: 'transform 200ms ease', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
        />
      </button>
      {open && (
        <p style={{ fontSize: 13, color: COLORS.textSec, lineHeight: 1.6, padding: '0 0 18px', margin: 0 }}>{a}</p>
      )}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────── */

export default function BusinessPricingPage() {
  const [billing, setBilling] = useState<Billing>('monthly');

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap"
      />
      <style>{`
        .ybp-cta:hover[data-highlight="false"] {
          border-color: ${COLORS.yellow} !important;
          color: ${COLORS.yellow} !important;
        }
        .ybp-cta:hover[data-highlight="true"] {
          background: ${COLORS.yellowHover} !important;
        }
        .ybp-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
          max-width: 480px;
          margin: 0 auto;
        }
        @media (min-width: 900px) {
          .ybp-grid {
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
            max-width: 1100px;
            align-items: stretch;
          }
          .ybp-card-business {
            transform: scale(1.02);
            z-index: 1;
          }
        }
        .ybp-table { width: 100%; border-collapse: collapse; }
        .ybp-table th, .ybp-table td {
          padding: 14px 16px;
          text-align: left;
          border-bottom: 0.5px solid ${COLORS.border};
        }
        .ybp-table thead th {
          background: ${COLORS.headerRow};
          font-family: ${FONT_MONO};
          font-size: 11px;
          text-transform: uppercase;
          color: ${COLORS.muted};
          letter-spacing: 0.08em;
          font-weight: 500;
        }
        .ybp-table tbody tr:nth-child(even) td { background: ${COLORS.cardAlt}; }
        .ybp-table tbody tr:nth-child(odd) td { background: ${COLORS.card}; }
        .ybp-table td.label { font-size: 13px; color: ${COLORS.textSec}; font-family: ${FONT_UI}; }
        .ybp-table td.val { font-family: ${FONT_MONO}; font-size: 12px; color: ${COLORS.text}; }
      `}</style>

      <main
        style={{
          background: COLORS.bg,
          color: COLORS.text,
          fontFamily: FONT_UI,
          minHeight: '100vh',
          padding: '64px 20px 96px',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {/* Header */}
          <header style={{ textAlign: 'center', marginBottom: 48 }}>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: COLORS.yellow,
                marginBottom: 16,
              }}
            >
              Yobbanté Business
            </div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: COLORS.text,
                margin: '0 0 12px',
                lineHeight: 1.15,
              }}
            >
              Choisissez votre plan
            </h1>
            <p
              style={{
                fontSize: 13,
                color: COLORS.textSec,
                maxWidth: 520,
                margin: '0 auto 28px',
                lineHeight: 1.6,
              }}
            >
              Pas un abonnement logiciel. Un opérateur logistique qui travaille pour vous.
            </p>
            <BillingToggle value={billing} onChange={setBilling} />
          </header>

          {/* Cards */}
          <section className="ybp-grid">
            {PLANS.map((p) => (
              <div key={p.id} className={p.highlight ? 'ybp-card-business' : ''}>
                <PlanCard plan={p} billing={billing} />
              </div>
            ))}
          </section>

          {/* Comparison table */}
          <section style={{ marginTop: 80 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 16 }}>
              Comparer les plans en détail
            </h2>
            <div
              style={{
                background: COLORS.card,
                borderRadius: 16,
                overflow: 'hidden',
                border: `0.5px solid ${COLORS.border}`,
              }}
            >
              <table className="ybp-table">
                <thead>
                  <tr>
                    <th style={{ width: '34%' }}></th>
                    <th>Starter</th>
                    <th>Business</th>
                    <th>Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {TABLE_ROWS.map((row) => (
                    <tr key={row.label}>
                      <td className="label">{row.label}</td>
                      {row.values.map((v, i) => (
                        <td key={i} className="val" style={{ color: v === '—' ? COLORS.mutedDash : v === '✓' ? COLORS.green : COLORS.text }}>
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* FAQ */}
          <section style={{ marginTop: 64, maxWidth: 720, margin: '64px auto 0' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>
              Questions fréquentes
            </h2>
            <div>
              {FAQ.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
