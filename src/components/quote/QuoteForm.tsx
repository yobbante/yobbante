import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Search, Inbox } from 'lucide-react';
import {
  type QuoteInput, type ServiceMode, type TransportMode, type GoodsType,
  saveDraft,
} from '@/lib/quote';

const TYPES: { value: GoodsType; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'fragile', label: 'Fragile' },
  { value: 'electronique', label: 'Électronique' },
  { value: 'auto', label: 'Auto / Pièces' },
  { value: 'haute_valeur', label: 'Haute valeur' },
];

const RECEPTION_TYPES: { value: GoodsType; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'electronique', label: 'Électronique' },
  { value: 'auto', label: 'Auto / Pièces' },
  { value: 'cosmetiques', label: 'Cosmétiques' },
  { value: 'haute_valeur', label: 'Haute valeur' },
];

const MERCHANTS = ['Amazon', 'AliExpress', 'eBay', 'SHEIN', 'Temu', 'Etsy', 'RockAuto', 'iHerb', 'Autre…'];
const MERCHANT_COUNTRIES = ['USA', 'Chine', 'UK', 'France', 'UAE', 'Autre'];
const SOURCING_COUNTRIES = ['Chine', 'USA', 'Europe', 'Autre'];

interface TabDef {
  key: ServiceMode;
  Icon: typeof Package;
  label: string;
  subtitle?: string;
}
const TABS: TabDef[] = [
  { key: 'send', Icon: Package, label: 'Envoyer un colis' },
  { key: 'sourcing', Icon: Search, label: 'Sourcing', subtitle: 'On achète pour vous' },
  { key: 'reception', Icon: Inbox, label: 'Réception de commande', subtitle: 'Amazon, AliExpress, eBay…' },
];

export function QuoteForm() {
  const navigate = useNavigate();
  const [service, setService] = useState<ServiceMode>('send');

  // Shared
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [weight, setWeight] = useState('');
  const [mode, setMode] = useState<TransportMode>('air');
  const [type, setType] = useState<GoodsType>('standard');

  // Sourcing
  const [query, setQuery] = useState('');
  const [budget, setBudget] = useState('');
  const [sourcingCountry, setSourcingCountry] = useState('Chine');

  // Reception
  const [merchant, setMerchant] = useState<string>('Amazon');
  const [merchantCountry, setMerchantCountry] = useState('USA');
  const [recMode, setRecMode] = useState<TransportMode>('air');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [recType, setRecType] = useState<GoodsType>('standard');

  const submit = () => {
    let input: QuoteInput;
    if (service === 'send') {
      if (!origin || !destination || !weight) return;
      input = {
        service, origin, destination,
        weightKg: Number(weight) || 0,
        mode, type,
      };
    } else if (service === 'sourcing') {
      if (!query || !budget) return;
      input = {
        service,
        origin: sourcingCountry,
        destination: 'Dakar, Sénégal',
        weightKg: 2,
        mode: 'air',
        type: 'standard',
        query, budgetEur: Number(budget) || 0, sourcingCountry,
      };
    } else {
      if (!estimatedValue) return;
      // Reception flow has its own dedicated registration page that
      // inserts into reception_orders + relay_addresses. Hand off there
      // with prefilled query params instead of the quote/devis pipeline.
      const params = new URLSearchParams({
        merchant: merchant || '',
        country: merchantCountry || '',
        value: estimatedValue || '',
        mode: recMode,
        type: recType,
      });
      navigate(`/expedier/recevoir?${params.toString()}`);
      return;
    }
    saveDraft(input);
    navigate('/devis');
  };

  return (
    <div
      className="rounded-[12px] p-5 max-w-[580px] w-full"
      style={{ background: 'hsl(var(--secondary))', border: '0.5px solid hsl(var(--color-border-tertiary))' }}
    >
      {/* Tabs */}
      <div className="flex gap-1.5 mb-4">
        {TABS.map(t => {
          const active = service === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setService(t.key)}
              className="flex-1 text-left transition-colors"
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                background: active ? '#ffffff' : 'transparent',
                border: active
                  ? '1px solid hsl(var(--foreground))'
                  : '0.5px solid hsl(var(--color-border-tertiary))',
                boxShadow: active ? 'inset 0 0 0 1px rgba(0,0,0,0.08)' : 'none',
                color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                fontWeight: active ? 600 : 400,
              }}
            >
              <div className="flex items-center gap-1.5">
                <t.Icon className="w-4 h-4 shrink-0" />
                <span className="text-[13px] font-medium leading-tight">{t.label}</span>
              </div>
              {t.subtitle && (
                <div
                  className="text-[10px] mt-0.5 leading-tight"
                  style={{ color: active ? 'hsl(var(--muted-foreground))' : 'hsl(var(--text-tertiary))' }}
                >
                  {t.subtitle}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1 — SEND */}
      {service === 'send' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Field label="Origine *">
              <input className="input-base w-full" placeholder="Dakar, Sénégal"
                value={origin} onChange={e => setOrigin(e.target.value)} />
            </Field>
            <Field label="Destination *">
              <input className="input-base w-full" placeholder="Ville, Pays…"
                value={destination} onChange={e => setDestination(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <Field label="Poids (kg) *">
              <input type="number" inputMode="decimal" className="input-base w-full" placeholder="ex: 5"
                value={weight} onChange={e => setWeight(e.target.value)} />
            </Field>
            <Field label="Mode">
              <select className="input-base w-full" value={mode} onChange={e => setMode(e.target.value as TransportMode)}>
                <option value="air">Air</option>
                <option value="sea">Mer LCL</option>
                <option value="road">Route</option>
              </select>
            </Field>
            <Field label="Type">
              <select className="input-base w-full" value={type} onChange={e => setType(e.target.value as GoodsType)}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
          </div>
          <SubmitBtn onClick={submit}>Obtenir mon prix →</SubmitBtn>
        </div>
      )}

      {/* TAB 2 — SOURCING */}
      {service === 'sourcing' && (
        <div className="space-y-3">
          <Field label="Que cherchez-vous ?">
            <textarea
              rows={2}
              className="w-full bg-[hsl(var(--background-surface))] rounded-lg px-3 py-2 text-[14px]"
              style={{ border: '0.5px solid hsl(var(--color-border-tertiary))' }}
              placeholder="Ex: Nike Air Max 90 taille 42, coloris blanc…"
              value={query} onChange={e => setQuery(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Field label="Budget max">
              <input type="number" inputMode="decimal" className="input-base w-full" placeholder="ex: 150 €"
                value={budget} onChange={e => setBudget(e.target.value)} />
            </Field>
            <Field label="Pays d'origine">
              <select className="input-base w-full" value={sourcingCountry} onChange={e => setSourcingCountry(e.target.value)}>
                {SOURCING_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <SubmitBtn onClick={submit}>Demander un devis sourcing →</SubmitBtn>
        </div>
      )}

      {/* TAB 3 — RECEPTION */}
      {service === 'reception' && (
        <div className="space-y-3">
          <div>
            <div className="text-label mb-2">Marchand</div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
              {MERCHANTS.map(m => {
                const active = merchant === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMerchant(m)}
                    className="shrink-0 transition-colors"
                    style={{
                      height: 32,
                      padding: '0 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 500,
                      background: active ? 'hsl(var(--background-surface))' : 'transparent',
                      border: active
                        ? '0.5px solid hsl(var(--foreground))'
                        : '0.5px solid hsl(var(--color-border-tertiary))',
                      color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                    }}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Field label="Pays du marchand *">
              <select className="input-base w-full" value={merchantCountry} onChange={e => setMerchantCountry(e.target.value)}>
                {MERCHANT_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Mode *">
              <select className="input-base w-full" value={recMode} onChange={e => setRecMode(e.target.value as TransportMode)}>
                <option value="air">Aérien (3-7j)</option>
                <option value="sea">Maritime LCL (18-25j)</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Field label="Valeur estimée *">
              <input type="number" inputMode="decimal" className="input-base w-full" placeholder="ex: 200 €"
                value={estimatedValue} onChange={e => setEstimatedValue(e.target.value)} />
            </Field>
            <Field label="Type de colis">
              <select className="input-base w-full" value={recType} onChange={e => setRecType(e.target.value as GoodsType)}>
                {RECEPTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
          </div>
          <SubmitBtn onClick={submit}>Créer mon adresse relais →</SubmitBtn>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-label block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function SubmitBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="btn-cta w-full" style={{ padding: '11px 20px', fontSize: 14 }}>
      {children}
    </button>
  );
}
