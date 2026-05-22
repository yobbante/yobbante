import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Search, Inbox, ArrowRightLeft, MapPin } from 'lucide-react';
import {
  type QuoteInput, type ServiceMode, type TransportMode, type GoodsType,
  saveDraft,
} from '@/lib/quote';
import { CityPicker } from './CityPicker';
import { ALL_CITIES } from '@/lib/worldCities';

const SEND_PRESET_KEY = 'send-flow:preset';

function resolveCityToCountry(label: string): { country: string; city: string } | null {
  if (!label) return null;
  if (label === 'Dakar, Sénégal' || label === 'Dakar') return { country: 'SN', city: 'Dakar' };
  const m = ALL_CITIES.find(c => label === `${c.city}, ${c.countryLabel}` || label === c.city);
  return m ? { country: m.country, city: m.city } : null;
}

function sourcingCountryToCode(label: string): 'CN' | 'FR' | 'AE' | 'US' {
  switch (label) {
    case 'Chine': return 'CN';
    case 'USA': return 'US';
    case 'Europe': return 'FR';
    default: return 'CN';
  }
}

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
  shortLabel: string;
  subtitle?: string;
}
const TABS: TabDef[] = [
  { key: 'send', Icon: Package, label: 'Envoyer un colis', shortLabel: 'Envoyer' },
  { key: 'sourcing', Icon: Search, label: 'Sourcing', shortLabel: 'Sourcing', subtitle: 'On achète pour vous' },
  { key: 'reception', Icon: Inbox, label: 'Réception de commande', shortLabel: 'Réception', subtitle: 'Amazon, AliExpress…' },
];

export function QuoteForm() {
  const navigate = useNavigate();
  const [service, setService] = useState<ServiceMode>('send');

  // Shared — Dakar est toujours verrouillé sur une extrémité de la route.
  const DAKAR = 'Dakar, Sénégal';
  const [direction, setDirection] = useState<'from_dakar' | 'to_dakar'>('from_dakar');
  const [origin, setOrigin] = useState(DAKAR);
  const [destination, setDestination] = useState('');
  const swapDirection = () => {
    const bothFilled = origin && destination;
    if (bothFilled) {
      // Échange simple en gardant les deux villes
      const prevOrigin = origin;
      setOrigin(destination);
      setDestination(prevOrigin);
      setDirection(direction === 'from_dakar' ? 'to_dakar' : 'from_dakar');
      return;
    }
    if (direction === 'from_dakar') {
      setDirection('to_dakar');
      setOrigin('');
      setDestination(DAKAR);
    } else {
      setDirection('from_dakar');
      setOrigin(DAKAR);
      setDestination('');
    }
  };
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
    if (service === 'send') {
      if (!origin || !destination || !weight) return;
      // Hand off directly to /expedier/envoyer with the same preset
      // shape ExpedierSearchBar consumes, so the flow shows the price
      // section without a separate /devis detour. Hash #tarifs lets
      // SendFlow auto-scroll to the pricing step once the route is ready.
      const o = resolveCityToCountry(origin);
      const d = resolveCityToCountry(destination);
      if (!o || !d) return;
      const transport: 'AIR' | 'SEA' | 'ROAD' =
        mode === 'air' ? 'AIR' : mode === 'sea' ? 'SEA' : 'ROAD';
      const preset = {
        origin: o.country, destination: d.country,
        origin_city: o.city, destination_city: d.city,
        transport, weight: Number(weight) || undefined,
        source: 'landing-quote-form',
      };
      try { sessionStorage.setItem(SEND_PRESET_KEY, JSON.stringify(preset)); } catch {}
      // Persist legacy draft too, for users who still navigate to /devis later.
      saveDraft({
        service, origin, destination,
        weightKg: Number(weight) || 0,
        mode, type,
      });
      // Land on Étape 1 (Collecte) — the sticky bar resume bar will already
      // show the route/poids/mode chosen here. We don't want to skip ahead
      // to the pricing section before the user fills in collecte/destinataire.
      navigate('/expedier/envoyer');
      return;
    }
    if (service === 'sourcing') {
      if (!query || !budget) return;
      // Send users to the unified sourcing flow with prefilled query/origin
      // instead of /devis (which doesn't know about the sourcing pipeline).
      const params = new URLSearchParams({
        q: query,
        origin: sourcingCountryToCode(sourcingCountry),
        ...(budget ? { budget } : {}),
      });
      saveDraft({
        service,
        origin: sourcingCountry,
        destination: 'Dakar, Sénégal',
        weightKg: 2,
        mode: 'air',
        type: 'standard',
        query, budgetEur: Number(budget) || 0, sourcingCountry,
      });
      navigate(`/sourcing?${params.toString()}`);
      return;
    }
    // Réception
    if (!estimatedValue) return;
    const params = new URLSearchParams({
      merchant: merchant || '',
      country: merchantCountry || '',
      value: estimatedValue || '',
      mode: recMode,
      type: recType,
    });
    navigate(`/expedier/recevoir?${params.toString()}`);
  };

  return (
    <div
      className="rounded-[12px] p-3 sm:p-5 max-w-[580px] w-full overflow-hidden"
      style={{ background: 'hsl(var(--secondary))', border: '0.5px solid hsl(var(--color-border-tertiary))' }}
    >
      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1.5 mb-4">
        {TABS.map(t => {
          const active = service === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setService(t.key)}
              className="text-left transition-colors min-w-0"
              style={{
                padding: '8px 10px',
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
              <div className="flex items-center gap-1.5 min-w-0">
                <t.Icon className="w-4 h-4 shrink-0" />
                <span className="text-[12px] sm:text-[13px] font-medium leading-tight truncate">
                  <span className="sm:hidden">{t.shortLabel}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                </span>
              </div>
              {t.subtitle && (
                <div
                  className="text-[10px] mt-0.5 leading-tight hidden sm:block truncate"
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
          <div className="flex items-center gap-2 text-[11px]">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium"
              style={{ background: 'hsl(var(--background))', border: '0.5px solid hsl(var(--color-border-tertiary))', color: 'hsl(var(--foreground))' }}
              title="Dakar est toujours une extrémité de la route"
            >
              <MapPin className="w-3 h-3" />
              {direction === 'from_dakar' ? '🇸🇳 Dakar →' : '→ 🇸🇳 Dakar'}
            </span>
            <button
              type="button"
              onClick={swapDirection}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-muted-foreground hover:text-foreground"
              style={{ border: '0.5px solid hsl(var(--color-border-tertiary))' }}
              aria-label="Inverser le sens"
            >
              <ArrowRightLeft className="w-3 h-3" />
              Inverser
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Field label="Origine *">
              <CityPicker
                value={origin}
                onChange={(v) => {
                  if (v === DAKAR) {
                    setDirection('from_dakar');
                    setOrigin(DAKAR);
                    if (destination === DAKAR) setDestination('');
                  } else {
                    // Choisir une autre ville en origine ⇒ Dakar devient destination
                    setDirection('to_dakar');
                    setOrigin(v);
                    setDestination(DAKAR);
                  }
                }}
                placeholder="Choisir une ville d'origine…"
                ariaLabel="Choisir la ville d'origine"
                excludeCity={direction === 'to_dakar' ? 'Dakar' : undefined}
              />
            </Field>
            <Field label="Destination *">
              <CityPicker
                value={destination}
                onChange={(v) => {
                  if (v === DAKAR) {
                    setDirection('to_dakar');
                    setDestination(DAKAR);
                    if (origin === DAKAR) setOrigin('');
                  } else {
                    // Choisir une autre ville en destination ⇒ Dakar devient origine
                    setDirection('from_dakar');
                    setDestination(v);
                    setOrigin(DAKAR);
                  }
                }}
                placeholder="Choisir une ville de destination…"
                ariaLabel="Choisir la ville de destination"
                excludeCity={direction === 'from_dakar' ? 'Dakar' : undefined}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <Field label="Poids (kg) *">
              <input type="number" inputMode="decimal" className="input-base w-full" placeholder="ex: 5"
                value={weight} onChange={e => setWeight(e.target.value)} />
            </Field>
            <Field label="Mode">
              <select aria-label="Mode de transport" className="input-base w-full" value={mode} onChange={e => setMode(e.target.value as TransportMode)}>
                <option value="air">Air</option>
                <option value="sea">Mer LCL</option>
                <option value="road">Route</option>
              </select>
            </Field>
            <Field label="Type">
              <select aria-label="Type de marchandise" className="input-base w-full" value={type} onChange={e => setType(e.target.value as GoodsType)}>
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
              <select aria-label="Pays d'origine" className="input-base w-full" value={sourcingCountry} onChange={e => setSourcingCountry(e.target.value)}>
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
            <div className="flex flex-wrap gap-1.5">
              {MERCHANTS.map(m => {
                const active = merchant === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMerchant(m)}
                    className="shrink-0 transition-colors whitespace-nowrap"
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
              <select aria-label="Pays du marchand" className="input-base w-full" value={merchantCountry} onChange={e => setMerchantCountry(e.target.value)}>
                {MERCHANT_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Mode *">
              <select aria-label="Mode d'expédition" className="input-base w-full" value={recMode} onChange={e => setRecMode(e.target.value as TransportMode)}>
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
              <select aria-label="Type de colis" className="input-base w-full" value={recType} onChange={e => setRecType(e.target.value as GoodsType)}>
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
