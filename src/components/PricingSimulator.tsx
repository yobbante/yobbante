import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export type Corridor =
  | 'FR_SN' | 'US_SN' | 'BE_SN' | 'MA_SN' | 'SN_FR' | 'SN_US' | 'OTHER';
export type Mode = 'air' | 'sea';
export type Merch = 'standard' | 'electronique' | 'fragile' | 'textile' | 'cosmetiques' | 'forte_valeur';

export const CORRIDORS: { value: Corridor; label: string }[] = [
  { value: 'FR_SN', label: 'France 🇫🇷' },
  { value: 'US_SN', label: 'USA 🇺🇸' },
  { value: 'BE_SN', label: 'Belgique 🇧🇪' },
  { value: 'MA_SN', label: 'Maroc 🇲🇦' },
  { value: 'SN_FR', label: 'Sénégal 🇸🇳' },
  { value: 'SN_US', label: 'Sénégal → USA 🇺🇸' },
  { value: 'OTHER', label: 'Autre' },
];

export const RATES: Record<Corridor, { air: number; sea: number; delayAir: string; delaySea: string; minAir: number; minSea: number; corridorLabel: string }> = {
  FR_SN: { air: 8500, sea: 4200, delayAir: '3-7j', delaySea: '18-25j', minAir: 1, minSea: 5, corridorLabel: 'France → Sénégal' },
  US_SN: { air: 11000, sea: 5500, delayAir: '5-10j', delaySea: '25-35j', minAir: 1, minSea: 5, corridorLabel: 'USA → Sénégal' },
  BE_SN: { air: 9000, sea: 4500, delayAir: '3-7j', delaySea: '18-25j', minAir: 1, minSea: 5, corridorLabel: 'Belgique → Sénégal' },
  MA_SN: { air: 6500, sea: 3200, delayAir: '2-5j', delaySea: '10-15j', minAir: 0.5, minSea: 3, corridorLabel: 'Maroc → Sénégal' },
  SN_FR: { air: 9500, sea: 4800, delayAir: '3-7j', delaySea: '18-25j', minAir: 1, minSea: 5, corridorLabel: 'Sénégal → France' },
  SN_US: { air: 12000, sea: 6000, delayAir: '5-10j', delaySea: '25-35j', minAir: 1, minSea: 5, corridorLabel: 'Sénégal → USA' },
  OTHER: { air: 13000, sea: 6500, delayAir: '7-14j', delaySea: '25-40j', minAir: 1, minSea: 5, corridorLabel: 'Autre corridor' },
};

export const MERCH: { value: Merch; label: string; mult: number }[] = [
  { value: 'standard', label: 'Standard', mult: 1.0 },
  { value: 'electronique', label: 'Électronique', mult: 1.4 },
  { value: 'fragile', label: 'Fragile', mult: 1.5 },
  { value: 'textile', label: 'Textile', mult: 1.1 },
  { value: 'cosmetiques', label: 'Cosmétiques', mult: 1.2 },
  { value: 'forte_valeur', label: 'Forte valeur', mult: 1.6 },
];

export const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR').replace(/,/g, ' ');
export const round500 = (n: number) => Math.round(n / 500) * 500;

function pickCorridor(origin: Corridor, destination: Corridor): Corridor {
  const direct: Corridor[] = ['FR_SN', 'US_SN', 'BE_SN', 'MA_SN', 'SN_FR', 'SN_US'];
  if (origin === 'FR_SN' && (destination === 'SN_FR' || destination === 'OTHER' || destination === 'FR_SN')) return 'FR_SN';
  if (direct.includes(origin)) return origin;
  return 'OTHER';
}

export function PricingSimulator({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState<Corridor>('FR_SN');
  const [destination, setDestination] = useState<Corridor>('SN_FR');
  const [weight, setWeight] = useState<string>('2.5');
  const [merch, setMerch] = useState<Merch>('standard');
  const [mode, setMode] = useState<Mode>('air');
  const [result, setResult] = useState<null | { transport: number; dossier: number; douane: number; total: number; weight: number; corridor: string; }>(null);

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
      transport, dossier, douane, total, weight: w,
      corridor: `${CORRIDORS.find(o => o.value === origin)?.label ?? ''} → ${CORRIDORS.find(o => o.value === destination)?.label ?? ''}`,
    });
  };

  const eur = useMemo(() => result ? (result.total / 655.957).toFixed(2) : '0', [result]);
  const usd = useMemo(() => result ? (result.total / 600).toFixed(2) : '0', [result]);

  return (
    <div className="rounded-2xl p-5 md:p-6 space-y-4" style={{ background: '#111111', border: '0.5px solid #1E1E1E' }}>
      <div className={compact ? 'grid grid-cols-1 gap-3' : 'grid md:grid-cols-2 gap-4'}>
        <Field label="Origine *">
          <select aria-label="Pays d'origine" value={origin} onChange={e => setOrigin(e.target.value as Corridor)}
            className="w-full bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg px-3 py-2.5 text-sm text-white">
            {CORRIDORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Destination *">
          <select aria-label="Destination" value={destination} onChange={e => setDestination(e.target.value as Corridor)}
            className="w-full bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg px-3 py-2.5 text-sm text-white">
            {CORRIDORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Poids estimé (kg) *">
          <input aria-label="Poids estimé en kilogrammes" type="number" step={0.5} min={0.5} value={weight} onChange={e => setWeight(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg px-3 py-2.5 text-sm text-white font-mono" />
        </Field>
        <Field label="Type de marchandise *">
          <select aria-label="Type de marchandise" value={merch} onChange={e => setMerch(e.target.value as Merch)}
            className="w-full bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg px-3 py-2.5 text-sm text-white">
            {MERCH.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Mode de transport *">
        <div className="flex gap-2">
          <ModeBtn active={mode === 'air'} onClick={() => setMode('air')}>✈️ Aérien</ModeBtn>
          <ModeBtn active={mode === 'sea'} onClick={() => setMode('sea')}>🚢 Maritime</ModeBtn>
        </div>
      </Field>

      <button onClick={calculate}
        className="w-full rounded-lg py-3 text-sm font-semibold transition-opacity hover:opacity-90"
        style={{ background: '#F5C518', color: '#0A0A0A' }}>
        Estimer mon envoi →
      </button>

      {result && (
        <div className="rounded-xl p-5 mt-2 space-y-3"
          style={{ background: 'rgba(245,197,24,0.06)', border: '1.5px solid rgba(245,197,24,0.2)' }}>
          <div className="text-[12px] font-mono" style={{ color: '#888' }}>
            Estimation pour {result.weight} kg · {result.corridor}
          </div>
          <Line label={`Transport ${mode === 'air' ? 'aérien' : 'maritime'}`} value={`${fmt(result.transport)} FCFA`} />
          <Line label="Frais de dossier" value={`${fmt(result.dossier)} FCFA`} />
          <Line label="Douane estimée" value={`${fmt(result.douane)} FCFA`} />
          <div className="border-t border-[#1E1E1E] my-2" />
          <div className="flex justify-between items-center">
            <span className="text-[14px] font-bold text-white">Total estimé</span>
            <span className="font-mono text-base font-bold" style={{ color: '#F5C518' }}>{fmt(result.total)} FCFA</span>
          </div>
          <div className="text-right text-[11px] font-mono" style={{ color: '#888' }}>≈ {eur} € · ≈ {usd} $</div>
          <button onClick={() => navigate('/auth')}
            className="w-full rounded-lg py-3 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: '#F5C518', color: '#0A0A0A' }}>
            Créer un dossier avec cette estimation →
          </button>
        </div>
      )}
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
    <button onClick={onClick} className="flex-1 rounded-full px-4 py-2 text-sm font-medium transition-all"
      style={active ? { background: '#F5C518', color: '#0A0A0A' } : { background: '#161616', color: '#888', border: '1px solid #2A2A2A' }}>
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
