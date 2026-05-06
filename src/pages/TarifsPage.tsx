import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

type Corridor =
  | 'FR_SN'
  | 'US_SN'
  | 'BE_SN'
  | 'MA_SN'
  | 'SN_FR'
  | 'SN_US'
  | 'OTHER';

type Mode = 'air' | 'sea';
type Merch = 'standard' | 'electronique' | 'fragile' | 'textile' | 'cosmetiques' | 'forte_valeur';

const CORRIDORS: { value: Corridor; label: string }[] = [
  { value: 'FR_SN', label: 'France 🇫🇷' },
  { value: 'US_SN', label: 'USA 🇺🇸' },
  { value: 'BE_SN', label: 'Belgique 🇧🇪' },
  { value: 'MA_SN', label: 'Maroc 🇲🇦' },
  { value: 'SN_FR', label: 'Sénégal 🇸🇳' },
  { value: 'SN_US', label: 'Sénégal → USA 🇺🇸' },
  { value: 'OTHER', label: 'Autre' },
];

const RATES: Record<Corridor, { air: number; sea: number; delayAir: string; delaySea: string; minAir: number; minSea: number; corridorLabel: string }> = {
  FR_SN: { air: 8500, sea: 4200, delayAir: '3-7j', delaySea: '18-25j', minAir: 1, minSea: 5, corridorLabel: 'France → Sénégal' },
  US_SN: { air: 11000, sea: 5500, delayAir: '5-10j', delaySea: '25-35j', minAir: 1, minSea: 5, corridorLabel: 'USA → Sénégal' },
  BE_SN: { air: 9000, sea: 4500, delayAir: '3-7j', delaySea: '18-25j', minAir: 1, minSea: 5, corridorLabel: 'Belgique → Sénégal' },
  MA_SN: { air: 6500, sea: 3200, delayAir: '2-5j', delaySea: '10-15j', minAir: 0.5, minSea: 3, corridorLabel: 'Maroc → Sénégal' },
  SN_FR: { air: 9500, sea: 4800, delayAir: '3-7j', delaySea: '18-25j', minAir: 1, minSea: 5, corridorLabel: 'Sénégal → France' },
  SN_US: { air: 12000, sea: 6000, delayAir: '5-10j', delaySea: '25-35j', minAir: 1, minSea: 5, corridorLabel: 'Sénégal → USA' },
  OTHER: { air: 13000, sea: 6500, delayAir: '7-14j', delaySea: '25-40j', minAir: 1, minSea: 5, corridorLabel: 'Autre corridor' },
};

const MERCH: { value: Merch; label: string; mult: number }[] = [
  { value: 'standard', label: 'Standard', mult: 1.0 },
  { value: 'electronique', label: 'Électronique', mult: 1.4 },
  { value: 'fragile', label: 'Fragile', mult: 1.5 },
  { value: 'textile', label: 'Textile', mult: 1.1 },
  { value: 'cosmetiques', label: 'Cosmétiques', mult: 1.2 },
  { value: 'forte_valeur', label: 'Forte valeur', mult: 1.6 },
];

const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR').replace(/,/g, ' ');
const round500 = (n: number) => Math.round(n / 500) * 500;

function pickCorridor(origin: Corridor, destination: Corridor): Corridor {
  const direct: Corridor[] = ['FR_SN', 'US_SN', 'BE_SN', 'MA_SN', 'SN_FR', 'SN_US'];
  if (origin === 'FR_SN' && (destination === 'SN_FR' || destination === 'OTHER' || destination === 'FR_SN')) return 'FR_SN';
  if (direct.includes(origin)) return origin;
  return 'OTHER';
}

export default function TarifsPage() {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState<Corridor>('FR_SN');
  const [destination, setDestination] = useState<Corridor>('SN_FR');
  const [weight, setWeight] = useState<string>('2.5');
  const [merch, setMerch] = useState<Merch>('standard');
  const [mode, setMode] = useState<Mode>('air');
  const [tableTab, setTableTab] = useState<Mode>('air');
  const [result, setResult] = useState<null | {
    transport: number;
    dossier: number;
    douane: number;
    total: number;
    weight: number;
    corridor: string;
  }>(null);

  const calculate = () => {
    const w = Math.max(0.1, parseFloat(weight) || 0);
    const c = pickCorridor(origin, destination);
    const rate = RATES[c][mode];
    const mult = MERCH.find(m => m.value === merch)?.mult ?? 1;
    const transport = round500(w * rate * mult);
    const dossier = 5000;
    let douaneRate = 0.08;
    if (transport >= 50000 && transport <= 200000) douaneRate = 0.12;
    else if (transport > 200000) douaneRate = 0.18;
    const douane = round500(transport * douaneRate);
    const total = round500(transport + dossier + douane);
    setResult({
      transport,
      dossier,
      douane,
      total,
      weight: w,
      corridor: `${CORRIDORS.find(o => o.value === origin)?.label ?? ''} → ${CORRIDORS.find(o => o.value === destination)?.label ?? ''}`,
    });
  };

  const eur = useMemo(() => result ? (result.total / 655.957).toFixed(2) : '0', [result]);
  const usd = useMemo(() => result ? (result.total / 600).toFixed(2) : '0', [result]);

  const tableRows = (m: Mode) =>
    (['FR_SN', 'US_SN', 'BE_SN', 'MA_SN', 'SN_FR', 'SN_US'] as Corridor[]).map(c => ({
      corridor: RATES[c].corridorLabel,
      delay: m === 'air' ? RATES[c].delayAir : RATES[c].delaySea,
      price: m === 'air' ? RATES[c].air : RATES[c].sea,
      min: m === 'air' ? RATES[c].minAir : RATES[c].minSea,
    }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />

      <main className="max-w-[480px] md:max-w-3xl mx-auto px-5 py-8 pb-32 md:pb-12 space-y-10">
        <header className="space-y-3">
          <div
            className="text-[10px] uppercase font-mono"
            style={{ letterSpacing: '0.14em', color: '#F5C518' }}
          >
            TARIFS
          </div>
          <h1
            className="text-[28px] font-extrabold text-white leading-tight"
            style={{ letterSpacing: '-0.03em' }}
          >
            Des prix clairs. Pas de surprise.
          </h1>
          <p className="text-[13px] max-w-[340px]" style={{ color: '#AAAAAA' }}>
            Tous nos tarifs sont estimatifs et confirmés à réception du colis. Aucun frais caché.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-base font-bold text-white">Estimez votre envoi</h2>
          <div
            className="rounded-2xl p-6 space-y-4"
            style={{ background: '#111111', border: '0.5px solid #1E1E1E' }}
          >
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Origine *">
                <select
                  value={origin}
                  onChange={e => setOrigin(e.target.value as Corridor)}
                  className="w-full bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg px-3 py-2.5 text-sm text-white"
                >
                  {CORRIDORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Destination *">
                <select
                  value={destination}
                  onChange={e => setDestination(e.target.value as Corridor)}
                  className="w-full bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg px-3 py-2.5 text-sm text-white"
                >
                  {CORRIDORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Poids estimé (kg) *">
                <input
                  type="number"
                  step={0.5}
                  min={0.5}
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg px-3 py-2.5 text-sm text-white font-mono"
                />
              </Field>
              <Field label="Type de marchandise *">
                <select
                  value={merch}
                  onChange={e => setMerch(e.target.value as Merch)}
                  className="w-full bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg px-3 py-2.5 text-sm text-white"
                >
                  {MERCH.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Mode de transport *">
              <div className="flex gap-2">
                <ModeBtn active={mode === 'air'} onClick={() => setMode('air')}>
                  ✈️ Aérien
                </ModeBtn>
                <ModeBtn active={mode === 'sea'} onClick={() => setMode('sea')}>
                  🚢 Maritime
                </ModeBtn>
              </div>
            </Field>

            <button
              onClick={calculate}
              className="w-full rounded-lg py-3 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: '#F5C518', color: '#0A0A0A' }}
            >
              Calculer l'estimation →
            </button>

            {result && (
              <div
                className="rounded-xl p-5 mt-4 space-y-3"
                style={{
                  background: 'rgba(245,197,24,0.06)',
                  border: '1.5px solid rgba(245,197,24,0.2)',
                }}
              >
                <div className="text-[12px] font-mono" style={{ color: '#555555' }}>
                  Estimation pour {result.weight} kg · {result.corridor}
                </div>
                <div className="space-y-2">
                  <Line label={`Transport ${mode === 'air' ? 'aérien' : 'maritime'}`} value={`${fmt(result.transport)} FCFA`} />
                  <Line label="Frais de dossier" value={`${fmt(result.dossier)} FCFA`} />
                  <Line label="Douane estimée" value={`${fmt(result.douane)} FCFA`} />
                  <div className="border-t border-[#1E1E1E] my-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-[14px] font-bold text-white">Total estimé</span>
                    <span className="font-mono text-base font-bold" style={{ color: '#F5C518' }}>
                      {fmt(result.total)} FCFA
                    </span>
                  </div>
                  <div className="text-right text-[11px] font-mono" style={{ color: '#888' }}>
                    ≈ {eur} € · ≈ {usd} $
                  </div>
                </div>
                <div className="text-[10px] font-mono text-center" style={{ color: '#555555' }}>
                  Prix estimatifs · Confirmés à réception du colis · TVA non incluse
                </div>
                <button
                  onClick={() => navigate('/app')}
                  className="w-full rounded-lg py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ background: '#F5C518', color: '#0A0A0A' }}
                >
                  Créer un dossier avec cette estimation →
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-bold text-white">Grille de référence</h2>
          <div className="flex gap-2">
            <TabBtn active={tableTab === 'air'} onClick={() => setTableTab('air')}>✈️ Aérien</TabBtn>
            <TabBtn active={tableTab === 'sea'} onClick={() => setTableTab('sea')}>🚢 Maritime</TabBtn>
          </div>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#111111' }}
          >
            <div
              className="grid grid-cols-[1.4fr_0.7fr_1fr_0.8fr] px-4 py-3 text-[11px] font-mono uppercase"
              style={{ background: '#161616', color: '#888', letterSpacing: '0.08em' }}
            >
              <span>Corridor</span>
              <span>Délai</span>
              <span>Prix / kg</span>
              <span>Min.</span>
            </div>
            {tableRows(tableTab).map((r, i) => (
              <div
                key={r.corridor}
                className="grid grid-cols-[1.4fr_0.7fr_1fr_0.8fr] px-4 py-3 text-[13px] font-mono items-center"
                style={{ background: i % 2 === 0 ? '#111111' : '#0F0F0F', color: '#AAAAAA' }}
              >
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
              <AccordionItem
                key={idx}
                value={`q-${idx}`}
                className="border-b border-[#1E1E1E] last:border-b-0 px-4"
              >
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

      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-5 py-3"
        style={{ background: '#111111', borderTop: '1px solid #1E1E1E' }}
      >
        <button
          onClick={() => navigate('/expedier')}
          className="w-full rounded-lg py-3 text-sm font-semibold"
          style={{ background: '#F5C518', color: '#0A0A0A' }}
        >
          Créer un envoi →
        </button>
      </div>

      <div className="hidden md:block">
        <PublicFooter />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-medium" style={{ color: '#AAAAAA' }}>{label}</span>
      {children}
    </label>
  );
}

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-full px-4 py-2 text-sm font-medium transition-all"
      style={
        active
          ? { background: '#F5C518', color: '#0A0A0A' }
          : { background: '#161616', color: '#888', border: '1px solid #2A2A2A' }
      }
    >
      {children}
    </button>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-4 py-2 text-sm font-medium transition-all"
      style={
        active
          ? { background: '#F5C518', color: '#0A0A0A' }
          : { background: '#161616', color: '#888', border: '1px solid #2A2A2A' }
      }
    >
      {children}
    </button>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[13px]" style={{ color: '#AAAAAA' }}>{label}</span>
      <span className="font-mono text-[13px] text-white">{value}</span>
    </div>
  );
}

function FeeCard({ icon, title, value, sub }: { icon: string; title: string; value: string; sub: string }) {
  return (
    <div
      className="rounded-xl p-4 space-y-2"
      style={{ background: '#111111', border: '0.5px solid #1E1E1E' }}
    >
      <div className="text-2xl">{icon}</div>
      <div className="text-[13px] font-semibold text-white">{title}</div>
      <div className="font-mono text-[15px]" style={{ color: '#F5C518' }}>{value}</div>
      <div className="text-[12px]" style={{ color: '#888' }}>{sub}</div>
    </div>
  );
}

const FAQ = [
  {
    q: 'Comment sont calculés les tarifs ?',
    a: "Nos tarifs sont basés sur le poids réel du colis, le corridor (origine → destination), et le type de marchandise. Le prix affiché est une estimation — le prix définitif est confirmé après pesée au relais.",
  },
  {
    q: 'Y a-t-il des frais cachés ?',
    a: "Non. Tous les frais sont affichés avant confirmation : transport, dossier, douane estimée, et assurance si vous la choisissez. Aucun frais ne s'ajoute sans votre accord.",
  },
  {
    q: 'Quand est-ce que je paye ?',
    a: 'Pour les particuliers : au moment de la confirmation du dossier. Pour les entreprises Business : facturation mensuelle consolidée.',
  },
  {
    q: 'Les prix sont-ils les mêmes pour tout le monde ?',
    a: 'Les particuliers bénéficient des tarifs affichés. Les clients Business bénéficient de réductions : -8% (Starter) à -15% (Business) sur tous les transports.',
  },
  {
    q: 'Que se passe-t-il si mon colis est plus lourd que déclaré ?',
    a: "Le poids est vérifié à réception au relais. Si le poids réel dépasse de plus de 10% le poids déclaré, une régularisation est appliquée. Vous êtes notifié avant tout débit supplémentaire.",
  },
];
