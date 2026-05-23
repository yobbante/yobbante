import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { PricingSimulator, RATES, fmt, type Corridor, type Mode } from '@/components/PricingSimulator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useSeo } from '@/hooks/useSeo';

export default function TarifsPage() {
  useSeo({
    title: "Tarifs d'expédition Dakar ↔ Monde | Yobbanté",
    description: "Prix d'expédition clairs et transparents. Aérien, maritime, routier depuis Dakar vers le monde entier.",
    path: '/tarifs',
  });
  const navigate = useNavigate();
  const [tableTab, setTableTab] = useState<Mode>('air');

  const tableRows = (m: Mode) =>
    (['FR_SN', 'US_SN', 'BE_SN', 'MA_SN', 'SN_FR', 'SN_US'] as Corridor[]).map(c => ({
      corridor: RATES[c].corridorLabel,
      delay: m === 'air' ? RATES[c].delayAir : RATES[c].delaySea,
      price: m === 'air' ? RATES[c].air : RATES[c].sea,
      min: m === 'air' ? RATES[c].minAir : RATES[c].minSea,
    }));

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav />

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-8 pb-32 md:pb-12 space-y-10">
        <header className="space-y-3">
          <div className="text-label">TARIFS</div>
          <h1 className="max-w-[460px]">Des prix clairs. Pas de surprise.</h1>
          <p className="text-[14px] max-w-[420px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Tous nos tarifs sont estimatifs et confirmés à réception du colis. Aucun frais caché.
          </p>
        </header>

        <section className="space-y-4">
          <h2>Estimez votre envoi</h2>
          <PricingSimulator />
        </section>

        <section className="space-y-3">
          <h2>Tarifs indicatifs — Dakar → Monde</h2>
          <p className="text-[12px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Prix par kg, hors enlèvement (gratuit à Dakar centre).
          </p>
          <div
            className="rounded-[12px] overflow-hidden"
            style={{ background: 'hsl(var(--background-surface))', border: '0.5px solid hsl(var(--color-border-tertiary))' }}
          >
            <div
              className="grid grid-cols-[1.4fr_1fr_1fr] px-4 py-2.5 text-label"
              style={{ borderBottom: '0.5px solid hsl(var(--color-border-tertiary))' }}
            >
              <span>Route</span><span>Standard</span><span>Express</span>
            </div>
            {INDICATIVE_ROUTES.map((r, i) => (
              <div
                key={r.label}
                className="grid grid-cols-[1.4fr_1fr_1fr] px-4 py-3 text-[13px] items-center"
                style={{
                  background: i % 2 === 0 ? 'transparent' : 'hsl(var(--secondary))',
                  borderTop: i === 0 ? 'none' : '0.5px solid hsl(var(--color-border-tertiary))',
                }}
              >
                <span className="text-foreground">{r.label}</span>
                <span className="font-medium text-foreground">{fmt(r.standard)} FCFA</span>
                <span className="font-medium" style={{ color: '#F5C518' }}>{fmt(Math.round(r.standard * 1.45))} FCFA</span>
              </div>
            ))}
          </div>
          <p className="text-[11px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
            Tarifs définitifs confirmés à la soumission de votre commande.
          </p>
        </section>

        <section className="space-y-4">
          <h2>Grille de référence</h2>
          <div className="flex gap-2">
            <TabBtn active={tableTab === 'air'} onClick={() => setTableTab('air')}>✈️ Aérien</TabBtn>
            <TabBtn active={tableTab === 'sea'} onClick={() => setTableTab('sea')}>🚢 Maritime</TabBtn>
          </div>
          <div
            className="rounded-[12px] overflow-hidden"
            style={{ background: 'hsl(var(--background-surface))', border: '0.5px solid hsl(var(--color-border-tertiary))' }}
          >
            <div
              className="grid grid-cols-[1.4fr_0.7fr_1fr_0.8fr] px-4 py-2.5 text-label"
              style={{ borderBottom: '0.5px solid hsl(var(--color-border-tertiary))' }}
            >
              <span>Corridor</span><span>Délai</span><span>Prix / kg</span><span>Min.</span>
            </div>
            {tableRows(tableTab).map((r, i) => (
              <div
                key={r.corridor}
                className="grid grid-cols-[1.4fr_0.7fr_1fr_0.8fr] px-4 py-3 text-[13px] items-center"
                style={{
                  background: i % 2 === 0 ? 'transparent' : 'hsl(var(--secondary))',
                  borderTop: i === 0 ? 'none' : '0.5px solid hsl(var(--color-border-tertiary))',
                  color: 'hsl(var(--muted-foreground))',
                }}
              >
                <span className="text-foreground">{r.corridor}</span>
                <span>{r.delay}</span>
                <span className="font-medium text-foreground">{fmt(r.price)} FCFA</span>
                <span>{r.min} kg</span>
              </div>
            ))}
          </div>
          <p className="text-[11px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
            Ces tarifs s'appliquent aux colis standard. Des majorations s'appliquent selon le type de marchandise.
          </p>
        </section>

        <section className="space-y-4">
          <h2>Frais additionnels</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <FeeCard title="Frais de dossier" value="5 000 FCFA" sub="Par envoi · Inclut le suivi et les documents de base" />
            <FeeCard title="Dédouanement" value="Sur devis" sub="Calculé selon la valeur déclarée et le type de produit" />
            <FeeCard title="Assurance colis" value="À partir de 1 500 FCFA" sub="Optionnelle · Calculée selon la valeur déclarée" />
          </div>
        </section>

        <section className="space-y-4">
          <h2>Questions fréquentes</h2>
          <Accordion
            type="single"
            collapsible
            className="rounded-[12px] overflow-hidden"
            style={{ background: 'hsl(var(--background-surface))', border: '0.5px solid hsl(var(--color-border-tertiary))' }}
          >
            {FAQ.map((f, idx) => (
              <AccordionItem
                key={idx}
                value={`q-${idx}`}
                className="px-4"
                style={{ borderBottom: idx === FAQ.length - 1 ? 'none' : '0.5px solid hsl(var(--color-border-tertiary))' }}
              >
                <AccordionTrigger className="text-[14px] font-medium hover:no-underline py-4">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent
                  className="text-[13px] pt-3 pb-4"
                  style={{
                    color: 'hsl(var(--muted-foreground))',
                    borderTop: '0.5px solid hsl(var(--color-border-tertiary))',
                  }}
                >
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <p className="text-[13px] mt-3" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Une question&nbsp;?{' '}
            <a
              href="https://wa.me/221786078080?text=Bonjour%20Yobbant%C3%A9%2C%20j%27ai%20une%20question%20sur%20vos%20tarifs."
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              Écrivez-nous sur WhatsApp →
            </a>
          </p>
        </section>
      </main>

      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-5 py-3"
        style={{ background: 'hsl(var(--background-primary))', borderTop: '0.5px solid hsl(var(--color-border-tertiary))' }}
      >
        <button onClick={() => navigate('/expedier')} className="btn-cta w-full">
          Créer un envoi →
        </button>
      </div>

      <div className="hidden md:block">
        <PublicFooter />
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3.5 text-[12px] font-medium transition-colors"
      style={{
        height: 32,
        background: active ? 'hsl(var(--background-primary))' : 'transparent',
        color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
        border: active ? '0.5px solid hsl(var(--foreground))' : '0.5px solid hsl(var(--color-border-tertiary))',
      }}
    >
      {children}
    </button>
  );
}

function FeeCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="surface-card space-y-1.5">
      <div className="text-[14px] font-medium text-foreground">{title}</div>
      <div className="text-[15px] font-medium text-foreground">{value}</div>
      <div className="text-[12px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{sub}</div>
    </div>
  );
}

const FAQ = [
  { q: 'Comment sont calculés les tarifs ?', a: "Nos tarifs sont basés sur le poids réel du colis, le corridor (origine → destination), et le type de marchandise. Le prix affiché est une estimation — le prix définitif est confirmé après pesée au relais." },
  { q: 'Y a-t-il des frais cachés ?', a: "Non. Tous les frais sont affichés avant confirmation : transport, dossier, douane estimée, et assurance si vous la choisissez. Aucun frais ne s'ajoute sans votre accord." },
  { q: 'Quand est-ce que je paye ?', a: 'Pour les particuliers : au moment de la confirmation du dossier. Pour les entreprises Business : facturation mensuelle consolidée.' },
  { q: 'Les prix sont-ils les mêmes pour tout le monde ?', a: 'Les particuliers bénéficient des tarifs affichés. Les clients Business bénéficient de réductions : -8% (Starter) à -15% (Business) sur tous les transports.' },
  { q: 'Que se passe-t-il si mon colis est plus lourd que déclaré ?', a: "Le poids est vérifié à réception au relais. Si le poids réel dépasse de plus de 10% le poids déclaré, une régularisation est appliquée. Vous êtes notifié avant tout débit supplémentaire." },
];

// Tarifs indicatifs Standard (FCFA/kg) — Express = Standard × 1.45.
// Calculés depuis route_default_rates × 1.20 marge.
const INDICATIVE_ROUTES = [
  { label: 'Dakar → Paris',   standard: 8500 },
  { label: 'Dakar → New York', standard: 11000 },
  { label: 'Dakar → Dubai',   standard: 9500 },
  { label: 'Dakar → Abidjan', standard: 4500 },
  { label: 'Dakar → Londres', standard: 9000 },
];
