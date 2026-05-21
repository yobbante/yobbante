import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Search, Inbox, ArrowRightLeft, MapPin, Pencil, ArrowLeft, ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CityPicker } from '@/components/quote/CityPicker';
import { ALL_CITIES } from '@/lib/worldCities';

/* =========================================================================
   ExpedierSearchBar — sticky, theme-aware, 100% responsive search bar
   acting as the entry point for /expedier and /sourcing.

   - 3 tabs: Envoyer / Sourcing / Réception
   - Each tab has a true inline mode (no forced navigation away)
   - Switching to a tab whose canonical page differs from `currentPage`
     triggers navigation through `onModeChange` (parent resolves the URL).
   - Sticky bar, collapses to summary chips after submit.
   ========================================================================= */

export type ExpedierMode = 'envoyer' | 'recevoir' | 'sourcing';

const MERCHANTS = ['Amazon', 'AliExpress', 'eBay', 'SHEIN', 'Temu', 'Autre…'];
const MERCHANT_COUNTRIES: { code: 'US' | 'CN' | 'FR' | 'AE' | 'TR'; label: string; flag: string }[] = [
  { code: 'US', label: 'USA', flag: '🇺🇸' },
  { code: 'CN', label: 'Chine', flag: '🇨🇳' },
  { code: 'FR', label: 'France', flag: '🇫🇷' },
  { code: 'AE', label: 'Émirats', flag: '🇦🇪' },
  { code: 'TR', label: 'Turquie', flag: '🇹🇷' },
];
const SOURCING_ORIGINS: { code: 'CN' | 'FR' | 'AE' | 'US'; label: string; flag: string }[] = [
  { code: 'CN', label: 'Chine', flag: '🇨🇳' },
  { code: 'FR', label: 'France', flag: '🇫🇷' },
  { code: 'AE', label: 'Dubai', flag: '🇦🇪' },
  { code: 'US', label: 'USA', flag: '🇺🇸' },
];

const TABS: { key: ExpedierMode; Icon: typeof Package; label: string; shortLabel: string }[] = [
  { key: 'envoyer',   Icon: Package, label: 'Envoyer un colis',  shortLabel: 'Envoyer'   },
  { key: 'sourcing',  Icon: Search,  label: 'Sourcing produit',  shortLabel: 'Sourcing'  },
  { key: 'recevoir',  Icon: Inbox,   label: 'Recevoir',          shortLabel: 'Recevoir' },
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
  /** Called when the user picks a different tab. Parent navigates & remounts. */
  onModeChange: (next: ExpedierMode) => void;
  /** Called after the user presses "Continuer" so parent can bump the flow key. */
  onApply?: () => void;
  /** Initial expanded state. Default: true on first mount. */
  defaultExpanded?: boolean;
}

export function ExpedierSearchBar({ mode, onModeChange, onApply, defaultExpanded = true }: Props) {
  const navigate = useNavigate();
  const theme: 'light' | 'dark' = mode === 'recevoir' ? 'dark' : 'light';
  const isDark = theme === 'dark';
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Re-expand when switching mode so the user sees the inputs (skip first render)
  const firstModeRender = useRef(true);
  useEffect(() => { if (firstModeRender.current) { firstModeRender.current = false; return; } setExpanded(true); }, [mode]);

  // ── Envoyer state ────────────────────────────────────────────────
  const DAKAR = 'Dakar, Sénégal';
  // Hydrate previous preset so the choice persists across reloads / nav
  const hydratedSend = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try { const raw = sessionStorage.getItem(SEND_PRESET_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }, []);
  const buildCityLabel = (city?: string, country?: string) => {
    if (!city) return '';
    if (city === 'Dakar') return DAKAR;
    const m = ALL_CITIES.find(c => c.city === city && (!country || c.country === country));
    return m ? `${m.city}, ${m.countryLabel}` : city;
  };
  const [direction, setDirection] = useState<'from_dakar' | 'to_dakar'>(
    hydratedSend?.origin === 'SN' ? 'from_dakar' : hydratedSend?.destination === 'SN' ? 'to_dakar' : 'from_dakar'
  );
  const [origin, setOrigin] = useState(buildCityLabel(hydratedSend?.origin_city, hydratedSend?.origin) || DAKAR);
  const [destination, setDestination] = useState(buildCityLabel(hydratedSend?.destination_city, hydratedSend?.destination));
  const [weight, setWeight] = useState(hydratedSend?.weight ? String(hydratedSend.weight) : '');
  const [transport, setTransport] = useState<'AIR' | 'SEA' | 'ROAD'>(hydratedSend?.transport ?? 'AIR');
  // Auto-collapse on mount when a complete preset already exists
  useEffect(() => {
    if (hydratedSend?.origin && hydratedSend?.destination && hydratedSend?.weight) setExpanded(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  // Hydrate from URL on mount so deep links like /expedier/recevoir?merchant=Amazon&country=US&mode=air&value=120
  // pre-fill the bar and the underlying ReceiveFlow stays in sync.
  const initialRecParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [merchant, setMerchant] = useState<string>(() => initialRecParams.get('merchant') || 'Amazon');
  const [merchantCountry, setMerchantCountry] = useState<typeof MERCHANT_COUNTRIES[number]['code']>(() => {
    const c = (initialRecParams.get('country') || initialRecParams.get('origin') || '').toUpperCase();
    return (['US', 'CN', 'FR', 'AE', 'TR'] as const).includes(c as any) ? (c as any) : 'US';
  });
  const [recMode, setRecMode] = useState<'AIR' | 'SEA'>(() =>
    (initialRecParams.get('mode') || '').toLowerCase() === 'sea' ? 'SEA' : 'AIR'
  );
  const [estValue, setEstValue] = useState(() => initialRecParams.get('value') || '');

  useEffect(() => {
    // Only auto-pick a country when the merchant was changed *by the user* —
    // not when we just hydrated from URL params (which already includes country).
    const map: Record<string, typeof merchantCountry> = {
      Amazon: 'US', eBay: 'US', AliExpress: 'CN', SHEIN: 'CN', Temu: 'CN',
    };
    if (map[merchant]) setMerchantCountry(map[merchant]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant]);

  // ── Sourcing state ───────────────────────────────────────────────
  const [productQuery, setProductQuery] = useState(() => initialRecParams.get('q') ?? '');
  const [srcOrigin, setSrcOrigin] = useState<typeof SOURCING_ORIGINS[number]['code']>(() => {
    const c = (initialRecParams.get('origin') || '').toUpperCase();
    return (['CN', 'FR', 'AE', 'US'] as const).includes(c as any) ? (c as any) : 'CN';
  });

  // ── Submit handlers ──────────────────────────────────────────────
  function applyEnvoyer() {
    const o = resolveCityToCountry(origin);
    const d = resolveCityToCountry(destination);
    if (!o || !d || !weight) return;
    const preset = {
      origin: o.country, destination: d.country,
      origin_city: o.city, destination_city: d.city,
      transport, weight: Number(weight) || undefined,
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
    navigate(`/expedier/recevoir?${params.toString()}`, { replace: true });
    setExpanded(false);
    onApply?.();
  }
  function applySourcing() {
    const q = productQuery.trim();
    const params = new URLSearchParams({
      ...(q ? { q } : {}),
      origin: srcOrigin,
    });
    navigate(`/sourcing${params.toString() ? `?${params}` : ''}`, { replace: true });
    setExpanded(false);
    onApply?.();
  }

  const canSubmitSend = !!origin && !!destination && !!weight;
  const canSubmitRecv = !!merchant && !!merchantCountry;
  const canSubmitSrc  = productQuery.trim().length >= 2;

  // ── Summary chips ────────────────────────────────────────────────
  const summaryChips = useMemo(() => {
    if (mode === 'envoyer') {
      return [
        origin && destination ? `${origin.split(',')[0]} → ${destination.split(',')[0]}` : 'Itinéraire à définir',
        weight ? `${weight} kg` : 'Poids ?',
        transport === 'AIR' ? 'Air' : transport === 'SEA' ? 'Maritime' : 'Routier',
      ];
    }
    if (mode === 'sourcing') {
      return [
        productQuery.trim() || 'Produit ?',
        SOURCING_ORIGINS.find(c => c.code === srcOrigin)?.label ?? srcOrigin,
      ];
    }
    return [
      merchant,
      MERCHANT_COUNTRIES.find(c => c.code === merchantCountry)?.label ?? merchantCountry,
      recMode === 'AIR' ? 'Aérien' : 'Maritime',
      ...(estValue ? [`${estValue} €`] : []),
    ];
  }, [mode, origin, destination, weight, transport, merchant, merchantCountry, recMode, estValue, productQuery, srcOrigin]);

  // ── Shared field classes ─────────────────────────────────────────
  const fieldCls = cn(
    'w-full rounded-lg px-3 h-10 text-[13px] border outline-none transition-colors',
    isDark
      ? 'bg-white/[0.03] border-white/10 text-white placeholder:text-white/30 focus:border-yellow-400/60'
      : 'bg-card border-border text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/40',
  );
  const ctaCls = cn(
    'w-full rounded-lg h-10 px-3 text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed',
    isDark ? 'bg-yellow-400 text-zinc-950 hover:bg-yellow-300' : 'bg-foreground text-background hover:bg-foreground/90',
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className={cn(
        'sticky top-0 z-40 -mx-5 sm:-mx-8 px-5 sm:px-8 py-3 backdrop-blur-md border-b',
        isDark ? 'bg-zinc-950/90 border-white/10' : 'bg-background/90 border-border',
      )}
    >
      {/* Top toolbar */}
      <div className="flex items-center justify-between mb-1.5">
        <button
          type="button" onClick={() => navigate('/')}
          className={cn(
            'inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] font-medium transition-opacity',
            isDark ? 'text-white/55 hover:text-white' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <ArrowLeft className="w-3 h-3" /> Accueil
        </button>
        {mode === 'recevoir' && (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('yobbante:receive-flow:goto', { detail: { step: 'orders' } }))}
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] font-semibold rounded-md px-2 py-1 bg-yellow-400 text-zinc-950 hover:bg-yellow-300 transition-colors"
          >
            <ListChecks className="w-3 h-3" /> Mes commandes
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1 sm:gap-1.5 mb-2.5">
        {TABS.map(t => {
          const active = t.key === mode;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => { if (t.key !== mode) onModeChange(t.key); }}
              aria-pressed={active}
              className={cn(
                'group min-w-0 rounded-lg px-2 sm:px-2.5 h-9 inline-flex items-center justify-center sm:justify-start gap-1.5 text-[11.5px] sm:text-[13px] font-medium border transition-all',
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
            key={`expanded-${mode}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            {/* ENVOYER ─────────────────────────────────────────────── */}
            {mode === 'envoyer' && (
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
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
                      'inline-flex items-center gap-1 rounded-full px-2 py-1 border transition-colors',
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <input
                    type="number" inputMode="decimal" placeholder="Poids (kg)"
                    value={weight} onChange={e => setWeight(e.target.value)}
                    className={fieldCls}
                  />
                  <select
                    value={transport} onChange={e => setTransport(e.target.value as any)}
                    aria-label="Mode de transport"
                    className={fieldCls}
                  >
                    <option value="AIR">Aérien</option>
                    <option value="SEA">Maritime</option>
                    <option value="ROAD">Routier</option>
                  </select>
                  <button
                    onClick={applyEnvoyer} disabled={!canSubmitSend}
                    className={cn(ctaCls, 'col-span-2 sm:col-span-1')}
                  >
                    Continuer →
                  </button>
                </div>
              </div>
            )}

            {/* SOURCING ────────────────────────────────────────────── */}
            {mode === 'sourcing' && (
              <div className="space-y-2 pt-1">
                <div>
                  <div className={cn('text-[10px] uppercase tracking-[0.18em] mb-1.5', isDark ? 'text-yellow-400/80' : 'text-muted-foreground')}>Pays d'origine</div>
                  <div className="flex flex-wrap gap-1.5">
                    {SOURCING_ORIGINS.map(c => {
                      const active = srcOrigin === c.code;
                      return (
                        <button
                          key={c.code} type="button" onClick={() => setSrcOrigin(c.code)}
                          className={cn(
                            'rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors',
                            active
                              ? isDark ? 'bg-yellow-400 text-zinc-950 border-yellow-400' : 'bg-foreground text-background border-foreground'
                              : isDark ? 'border-white/10 text-white/70 hover:border-white/30' : 'border-border text-muted-foreground hover:border-foreground/40',
                          )}
                        >{c.flag} {c.label}</button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                  <input
                    type="text" placeholder="Quel produit cherchez-vous ? (ex. iPhone 15 Pro, machine à café…)"
                    value={productQuery} onChange={e => setProductQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && canSubmitSrc) applySourcing(); }}
                    className={fieldCls}
                  />
                  <button
                    onClick={applySourcing} disabled={!canSubmitSrc}
                    className={cn(ctaCls, 'sm:w-auto sm:px-5')}
                  >
                    Sourcer →
                  </button>
                </div>
              </div>
            )}

            {/* RECEVOIR ────────────────────────────────────────────── */}
            {mode === 'recevoir' && (
              <div className="space-y-2 pt-1">
                <div>
                  <div className={cn('text-[10px] uppercase tracking-[0.18em] mb-1.5', 'text-yellow-400/80')}>Marchand</div>
                  <div className="flex flex-wrap gap-1.5">
                    {MERCHANTS.map(m => {
                      const active = merchant === m;
                      return (
                        <button
                          key={m} type="button" onClick={() => setMerchant(m)}
                          className={cn(
                            'rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors',
                            active
                              ? 'bg-yellow-400 text-zinc-950 border-yellow-400'
                              : 'border-white/10 text-white/70 hover:border-white/30',
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
                    className={fieldCls}
                  >
                    {MERCHANT_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.label}</option>)}
                  </select>
                  <select
                    value={recMode} onChange={e => setRecMode(e.target.value as any)}
                    aria-label="Mode d'expédition"
                    className={fieldCls}
                  >
                    <option value="AIR">Aérien (3-7j)</option>
                    <option value="SEA">Maritime (18-25j)</option>
                  </select>
                  <input
                    type="number" inputMode="decimal" placeholder="Valeur (€)"
                    value={estValue} onChange={e => setEstValue(e.target.value)}
                    className={cn(fieldCls, 'col-span-2 sm:col-span-1')}
                  />
                  <button
                    onClick={applyRecevoir} disabled={!canSubmitRecv}
                    className={cn(ctaCls, 'col-span-2 sm:col-span-1')}
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
