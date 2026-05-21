import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Search, Inbox, ArrowRightLeft, MapPin, Pencil, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CityPicker } from '@/components/quote/CityPicker';
import { ALL_CITIES, HUB_DAKAR } from '@/lib/worldCities';

/* =========================================================================
   ExpedierSearchBar
   Sticky, theme-aware search bar acting as entry point of /expedier.
   - 3 tabs: Envoyer / Sourcing / Réception
   - Switching Envoyer ↔ Recevoir = inline mode swap (URL synced by parent)
   - Sourcing tab triggers navigation to /sourcing
   - On "Continuer" : writes preset stores read by SendFlow / ReceiveFlow
   - 2 states: 'expanded' (full inputs) and 'collapsed' (summary chips)
   ========================================================================= */

export type ExpedierMode = 'envoyer' | 'recevoir';
export type ExpedierTab = ExpedierMode | 'sourcing';

const MERCHANTS = ['Amazon', 'AliExpress', 'eBay', 'SHEIN', 'Temu', 'Autre…'];
const MERCHANT_COUNTRIES: { code: 'US' | 'CN' | 'FR' | 'AE' | 'TR'; label: string; flag: string }[] = [
  { code: 'US', label: 'USA', flag: '🇺🇸' },
  { code: 'CN', label: 'Chine', flag: '🇨🇳' },
  { code: 'FR', label: 'France', flag: '🇫🇷' },
  { code: 'AE', label: 'Émirats', flag: '🇦🇪' },
  { code: 'TR', label: 'Turquie', flag: '🇹🇷' },
];

const TABS: { key: ExpedierTab; Icon: typeof Package; label: string; shortLabel: string }[] = [
  { key: 'envoyer',   Icon: Package, label: 'Envoyer un colis',  shortLabel: 'Envoyer'   },
  { key: 'sourcing',  Icon: Search,  label: 'Sourcing',          shortLabel: 'Sourcing'  },
  { key: 'recevoir',  Icon: Inbox,   label: 'Réception',         shortLabel: 'Réception' },
];

const SEND_PRESET_KEY = 'send-flow:preset';
const LANDING_HUB_KEY = 'yobbante.landing.preferredHub';

function resolveCityToCountry(cityLabel: string): { country: string; city: string } | null {
  if (!cityLabel) return null;
  if (cityLabel === 'Dakar, Sénégal') return { country: 'SN', city: 'Dakar' };
  const match = ALL_CITIES.find(
    c => cityLabel === `${c.city}, ${c.countryLabel}` || cityLabel === c.city,
  );
  if (match) return { country: match.country, city: match.city };
  return null;
}

interface Props {
  mode: ExpedierMode;
  /** Called when user clicks Envoyer/Recevoir tab — parent updates URL + remounts flow. */
  onModeChange: (next: ExpedierMode) => void;
  /** Called after the user presses "Continuer" so parent can bump the flow key. */
  onApply?: () => void;
  /** Initial expanded state. Default: true on first mount. */
  defaultExpanded?: boolean;
}

export function ExpedierSearchBar({ mode, onModeChange, onApply, defaultExpanded = true }: Props) {
  const navigate = useNavigate();
  const theme: 'light' | 'dark' = mode === 'envoyer' ? 'light' : 'dark';
  const [expanded, setExpanded] = useState(defaultExpanded);

  // ── Envoyer state ────────────────────────────────────────────────
  const DAKAR = 'Dakar, Sénégal';
  const [direction, setDirection] = useState<'from_dakar' | 'to_dakar'>('from_dakar');
  const [origin, setOrigin] = useState(DAKAR);
  const [destination, setDestination] = useState('');
  const [weight, setWeight] = useState('');
  const [transport, setTransport] = useState<'AIR' | 'SEA' | 'ROAD'>('AIR');
  const swapDirection = () => {
    if (origin && destination) {
      const prev = origin;
      setOrigin(destination); setDestination(prev);
      setDirection(direction === 'from_dakar' ? 'to_dakar' : 'from_dakar');
      return;
    }
    if (direction === 'from_dakar') { setDirection('to_dakar'); setOrigin(''); setDestination(DAKAR); }
    else { setDirection('from_dakar'); setOrigin(DAKAR); setDestination(''); }
  };

  // ── Recevoir state ───────────────────────────────────────────────
  const [merchant, setMerchant] = useState<string>('Amazon');
  const [merchantCountry, setMerchantCountry] = useState<typeof MERCHANT_COUNTRIES[number]['code']>('US');
  const [recMode, setRecMode] = useState<'AIR' | 'SEA'>('AIR');
  const [estValue, setEstValue] = useState('');

  // Default mapping: most relevant merchant country for merchant
  useEffect(() => {
    const map: Record<string, typeof merchantCountry> = {
      Amazon: 'US', eBay: 'US', AliExpress: 'CN', SHEIN: 'CN', Temu: 'CN',
    };
    if (map[merchant]) setMerchantCountry(map[merchant]);
  }, [merchant]);

  // ── Tab handler ──────────────────────────────────────────────────
  function handleTab(t: ExpedierTab) {
    if (t === 'sourcing') {
      navigate('/sourcing');
      return;
    }
    if (t !== mode) onModeChange(t);
    setExpanded(true);
  }

  // ── Submit (Continuer) ───────────────────────────────────────────
  function applyEnvoyer() {
    const o = resolveCityToCountry(origin);
    const d = resolveCityToCountry(destination);
    if (!o || !d || !weight) return;
    const preset = {
      origin: o.country,
      destination: d.country,
      origin_city: o.city,
      destination_city: d.city,
      transport,
      weight: Number(weight) || undefined,
      source: 'expedier-bar',
    };
    try { sessionStorage.setItem(SEND_PRESET_KEY, JSON.stringify(preset)); } catch {}
    setExpanded(false);
    onApply?.();
  }
  function applyRecevoir() {
    try { localStorage.setItem(LANDING_HUB_KEY, merchantCountry); } catch {}
    const params = new URLSearchParams({
      merchant, country: merchantCountry, mode: recMode.toLowerCase(),
      ...(estValue ? { value: estValue } : {}),
      origin: merchantCountry,
    });
    // Sync URL so ReceiveFlow.readLandingHub picks it up too.
    window.history.replaceState({}, '', `/expedier/recevoir?${params.toString()}`);
    setExpanded(false);
    onApply?.();
  }

  const canSubmitSend = !!origin && !!destination && !!weight;
  const canSubmitRecv = !!merchant && !!merchantCountry;

  // ── Summary chips (collapsed view) ───────────────────────────────
  const summaryChips = useMemo(() => {
    if (mode === 'envoyer') {
      return [
        origin && destination ? `${origin.split(',')[0]} → ${destination.split(',')[0]}` : 'Itinéraire à définir',
        weight ? `${weight} kg` : 'Poids ?',
        transport === 'AIR' ? 'Air' : transport === 'SEA' ? 'Maritime' : 'Routier',
      ];
    }
    return [
      merchant,
      MERCHANT_COUNTRIES.find(c => c.code === merchantCountry)?.label ?? merchantCountry,
      recMode === 'AIR' ? 'Aérien' : 'Maritime',
      ...(estValue ? [`${estValue} €`] : []),
    ];
  }, [mode, origin, destination, weight, transport, merchant, merchantCountry, recMode, estValue]);

  const isDark = theme === 'dark';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className={cn(
        'sticky top-0 z-40 -mx-5 sm:-mx-8 px-5 sm:px-8 py-3 backdrop-blur-md border-b',
        isDark ? 'bg-zinc-950/90 border-white/10' : 'bg-background/90 border-border',
      )}
    >
      {/* Tabs row */}
      <div className="grid grid-cols-3 gap-1.5 mb-2.5">
        {TABS.map(t => {
          const active = t.key === mode || (t.key === 'sourcing' && false);
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => handleTab(t.key)}
              className={cn(
                'group text-left transition-all min-w-0 rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1.5 text-[12px] sm:text-[13px] font-medium border',
                active
                  ? isDark
                    ? 'bg-yellow-400 text-zinc-950 border-yellow-400'
                    : 'bg-foreground text-background border-foreground'
                  : isDark
                    ? 'border-white/10 text-white/70 hover:text-white hover:border-white/30'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40',
              )}
            >
              <t.Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                <span className="sm:hidden">{t.shortLabel}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence initial={false} mode="wait">
        {expanded ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            {mode === 'envoyer' ? (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2 text-[11px]">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium border',
                      isDark ? 'bg-white/[0.04] border-white/15 text-white/80' : 'bg-secondary border-border text-foreground',
                    )}
                    title="Dakar est toujours une extrémité de la route"
                  >
                    <MapPin className="w-3 h-3" />
                    {direction === 'from_dakar' ? '🇸🇳 Dakar →' : '→ 🇸🇳 Dakar'}
                  </span>
                  <button
                    type="button" onClick={swapDirection}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-1 border',
                      isDark ? 'border-white/15 text-white/70 hover:text-white' : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <ArrowRightLeft className="w-3 h-3" /> Inverser
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <CityPicker
                    value={origin}
                    onChange={(v) => {
                      if (v === DAKAR) { setDirection('from_dakar'); setOrigin(DAKAR); if (destination === DAKAR) setDestination(''); }
                      else { setDirection('to_dakar'); setOrigin(v); setDestination(DAKAR); }
                    }}
                    placeholder="Origine…"
                    ariaLabel="Choisir la ville d'origine"
                    excludeCity={direction === 'to_dakar' ? 'Dakar' : undefined}
                  />
                  <CityPicker
                    value={destination}
                    onChange={(v) => {
                      if (v === DAKAR) { setDirection('to_dakar'); setDestination(DAKAR); if (origin === DAKAR) setOrigin(''); }
                      else { setDirection('from_dakar'); setDestination(v); setOrigin(DAKAR); }
                    }}
                    placeholder="Destination…"
                    ariaLabel="Choisir la ville de destination"
                    excludeCity={direction === 'from_dakar' ? 'Dakar' : undefined}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number" inputMode="decimal" placeholder="Poids (kg)"
                    value={weight} onChange={e => setWeight(e.target.value)}
                    className={cn(
                      'w-full rounded-lg px-3 py-2 text-[13px] border',
                      isDark ? 'bg-white/[0.03] border-white/10 text-white placeholder:text-white/30' : 'bg-card border-border text-foreground',
                    )}
                  />
                  <select
                    value={transport} onChange={e => setTransport(e.target.value as any)}
                    aria-label="Mode de transport"
                    className={cn(
                      'w-full rounded-lg px-3 py-2 text-[13px] border',
                      isDark ? 'bg-white/[0.03] border-white/10 text-white' : 'bg-card border-border text-foreground',
                    )}
                  >
                    <option value="AIR">Aérien</option>
                    <option value="SEA">Maritime</option>
                    <option value="ROAD">Routier</option>
                  </select>
                  <button
                    onClick={applyEnvoyer}
                    disabled={!canSubmitSend}
                    className={cn(
                      'w-full rounded-lg px-3 py-2 text-[13px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                      isDark ? 'bg-yellow-400 text-zinc-950 hover:bg-yellow-300' : 'bg-foreground text-background hover:bg-foreground/90',
                    )}
                  >
                    Continuer →
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <div>
                  <div className={cn('text-[10px] uppercase tracking-[0.18em] mb-1.5', isDark ? 'text-yellow-400/80' : 'text-muted-foreground')}>Marchand</div>
                  <div className="flex flex-wrap gap-1.5">
                    {MERCHANTS.map(m => {
                      const active = merchant === m;
                      return (
                        <button
                          key={m} type="button" onClick={() => setMerchant(m)}
                          className={cn(
                            'rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors',
                            active
                              ? isDark ? 'bg-yellow-400 text-zinc-950 border-yellow-400' : 'bg-foreground text-background border-foreground'
                              : isDark ? 'border-white/10 text-white/70 hover:border-white/30' : 'border-border text-muted-foreground hover:border-foreground/40',
                          )}
                        >{m}</button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <select
                    value={merchantCountry} onChange={e => setMerchantCountry(e.target.value as any)}
                    aria-label="Pays du marchand"
                    className={cn(
                      'w-full rounded-lg px-2 py-2 text-[13px] border',
                      isDark ? 'bg-white/[0.03] border-white/10 text-white' : 'bg-card border-border text-foreground',
                    )}
                  >
                    {MERCHANT_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.label}</option>)}
                  </select>
                  <select
                    value={recMode} onChange={e => setRecMode(e.target.value as any)}
                    aria-label="Mode d'expédition"
                    className={cn(
                      'w-full rounded-lg px-2 py-2 text-[13px] border',
                      isDark ? 'bg-white/[0.03] border-white/10 text-white' : 'bg-card border-border text-foreground',
                    )}
                  >
                    <option value="AIR">Aérien (3-7j)</option>
                    <option value="SEA">Maritime (18-25j)</option>
                  </select>
                  <input
                    type="number" inputMode="decimal" placeholder="Valeur estimée (€)"
                    value={estValue} onChange={e => setEstValue(e.target.value)}
                    className={cn(
                      'w-full rounded-lg px-3 py-2 text-[13px] border col-span-2 sm:col-span-1',
                      isDark ? 'bg-white/[0.03] border-white/10 text-white placeholder:text-white/30' : 'bg-card border-border text-foreground',
                    )}
                  />
                  <button
                    onClick={applyRecevoir}
                    disabled={!canSubmitRecv}
                    className={cn(
                      'w-full rounded-lg px-3 py-2 text-[13px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed col-span-2 sm:col-span-1',
                      isDark ? 'bg-yellow-400 text-zinc-950 hover:bg-yellow-300' : 'bg-foreground text-background hover:bg-foreground/90',
                    )}
                  >
                    Continuer →
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 pt-0.5 flex-wrap"
          >
            {summaryChips.map((c, i) => (
              <span
                key={i}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border',
                  isDark ? 'bg-white/[0.04] border-white/10 text-white/80' : 'bg-secondary border-border text-foreground',
                )}
              >{c}</span>
            ))}
            <button
              type="button" onClick={() => setExpanded(true)}
              className={cn(
                'ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition-all',
                isDark ? 'border-white/15 text-white/80 hover:border-white/40 hover:text-white' : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground',
              )}
            >
              <Pencil className="w-3 h-3" /> Modifier
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
