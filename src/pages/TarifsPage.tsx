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

export default function TarifsPage() {
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
    <div className="min-h-screen bg-background text-foreground" style={{ background: '#0A0A0A' }}>
      <PublicNav />

      <main className="max-w-[480px] md:max-w-3xl mx-auto px-5 py-8 pb-32 md:pb-12 space-y-10">
        <header className="space-y-3">
          <div className="text-[10px] uppercase font-mono" style={{ letterSpacing: '0.14em', color: '#F5C518' }}>
            TARIFS
          </div>
          <h1 className="text-[28px] font-extrabold text-white leading-tight" style={{ letterSpacing: '-0.03em' }}>
            Des prix clairs. Pas de surprise.
          </h1>
          <p className="text-[13px] max-w-[340px]" style={{ color: '#AAAAAA' }}>
            Tous nos tarifs sont estimatifs et confirmés à réception du colis. Aucun frais caché.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-base font-bold text-white">Estimez votre envoi</h2>
          <PricingSimulator />
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-bold text-white">Grille de référence</h2>
          <div className="flex gap-2">
            <TabBtn active={tableTab === 'air'} onClick={() => setTableTab('air')}>✈️ Aérien</TabBtn>
            <TabBtn active={tableTab === 'sea'} onClick={() => setTableTab('sea')}>🚢 Maritime</TabBtn>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ background: '#111111' }}>
            <div className="grid grid-cols-[1.4fr_0.7fr_1fr_0.8fr] px-4 py-3 text-[11px] font-mono uppercase"
              style={{ background: '#161616', color: '#888', letterSpacing: '0.08em' }}>
              <span>Corridor</span><span>Délai</span><span>Prix / kg</span><span>Min.</span>
            </div>
            {tableRows(tableTab).map((r, i) => (
              <div key={r.corridor}
                className="grid grid-cols-[1.4fr_0.7fr_1fr_0.8fr] px-4 py-3 text-[13px] font-mono items-center"
                style={{ background: i % 2 === 0 ? '#111111' : '#0F0F0F', color: '#AAAAAA' }}>
                <span>{r.corridor}</span>
                <span>{r.delay}</span>
                <span className="font-semibold text-white">{fmt(r.price)} FCFA</span>
                <span>{r.min} kg</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] font-mono" style={{ color: '#555555' }}>
            Ces tarifs s'appliquent aux colis standard. Des majorations s'appliquent selon le type de marchandise.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-bold text-white">Frais additionnels</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <FeeCard icon="📋" title="Frais de dossier" value="5 000 FCFA" sub="Par envoi · Inclut le suivi et les documents de base" />
            <FeeCard icon="🧾" title="Dédouanement" value="Sur devis" sub="Calculé selon la valeur déclarée et le type de produit" />
            <FeeCard icon="🛡️" title="Assurance colis" value="À partir de 1 500 FCFA" sub="Optionnelle · Calculée selon la valeur déclarée" />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-bold text-white">Questions fréquentes</h2>
          <Accordion type="single" collapsible className="rounded-2xl overflow-hidden" style={{ background: '#111111' }}>
            {FAQ.map((f, idx) => (
              <AccordionItem key={idx} value={`q-${idx}`}
                className="border-b border-[#1E1E1E] last:border-b-0 px-4">
                <AccordionTrigger className="text-[13px] font-semibold text-white hover:no-underline py-4 [&[data-state=open]>svg]:text-[#F5C518]">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-[13px] pt-3 pb-4 border-t border-[#1E1E1E]" style={{ color: '#AAAAAA' }}>
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </main>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-5 py-3"
        style={{ background: '#111111', borderTop: '1px solid #1E1E1E' }}>
        <button onClick={() => navigate('/expedier')}
          className="w-full rounded-lg py-3 text-sm font-semibold"
          style={{ background: '#F5C518', color: '#0A0A0A' }}>
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
    <button onClick={onClick} className="rounded-full px-4 py-2 text-sm font-medium transition-all"
      style={active ? { background: '#F5C518', color: '#0A0A0A' } : { background: '#161616', color: '#888', border: '1px solid #2A2A2A' }}>
      {children}
    </button>
  );
}

function FeeCard({ icon, title, value, sub }: { icon: string; title: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl p-4 space-y-2" style={{ background: '#111111', border: '0.5px solid #1E1E1E' }}>
      <div className="text-2xl">{icon}</div>
      <div className="text-[13px] font-semibold text-white">{title}</div>
      <div className="font-mono text-[15px]" style={{ color: '#F5C518' }}>{value}</div>
      <div className="text-[12px]" style={{ color: '#888' }}>{sub}</div>
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
