import { useEffect, useMemo, useRef, useState, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Search, Inbox, ArrowRight, ArrowRightLeft, MapPin, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ALL_CITIES, HUB_DAKAR } from '@/lib/worldCities';
import { useCustomCities } from '@/hooks/useCustomCities';

export type IntentKey = 'send' | 'sourcing' | 'receive';

interface IntentSearchBarProps {
  /** Visual density. `compact` = sticky strip, `hero` = landing hero. */
  variant?: 'compact' | 'hero';
  /** Initial active tab. */
  defaultIntent?: IntentKey;
  className?: string;
}

const INTENTS: Array<{
  id: IntentKey;
  label: string;
  icon: typeof Send;
}> = [
  { id: 'send',     label: 'Envoyer',   icon: Send },
  { id: 'sourcing', label: 'Sourcing',  icon: Search },
  { id: 'receive',  label: 'Réception', icon: Inbox },
];

function norm(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Best-effort match for a free-text city input against the catalog. */
function matchCity(input: string, customs: typeof ALL_CITIES = []) {
  const v = input.trim().toLowerCase();
  if (!v) return null;
  const pool = [...ALL_CITIES, ...customs];
  return (
    pool.find(c => c.city.toLowerCase() === v) ??
    pool.find(c => c.city.toLowerCase().startsWith(v)) ??
    pool.find(c => c.city.toLowerCase().includes(v) || c.countryLabel.toLowerCase().includes(v)) ??
    null
  );
}

/**
 * Unified entry point — 3 intents (Envoyer · Sourcing · Réception) → flows.
 * For "Envoyer", Dakar est toujours verrouillé sur l'une des deux extrémités.
 *
 * CORRECTION #2 — Le champ destination en mode "Envoyer" utilise un vrai
 * combobox filtré (le `<datalist>` natif filtrait mal "Paris" sur certains
 * navigateurs mobiles).
 */
export function IntentSearchBar({
  variant = 'compact',
  defaultIntent = 'send',
  className,
}: IntentSearchBarProps) {
  const navigate = useNavigate();
  const { cities: customCities } = useCustomCities();
  const [intent, setIntent] = useState<IntentKey>(defaultIntent);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Send-only: 'from_dakar' = Dakar → ville étrangère ; 'to_dakar' = ville → Dakar
  const [direction, setDirection] = useState<'from_dakar' | 'to_dakar'>('from_dakar');
  const id = useId();

  const isHero = variant === 'hero';

  const placeholder =
    intent === 'sourcing' ? 'Quel produit cherchez-vous ?' :
    intent === 'receive'  ? 'Pays d\'origine (Amazon, AliExpress…)' :
    direction === 'from_dakar' ? 'Ville de destination (Paris, Lyon…)' : 'Ville d\'origine (Paris, Lyon…)';

  const ctaLabel =
    intent === 'sourcing' ? 'Sourcer' :
    intent === 'receive'  ? 'Recevoir' : 'Envoyer';

  const pool = useMemo(
    () => [...ALL_CITIES, ...customCities].filter(c => c.city !== HUB_DAKAR.city),
    [customCities],
  );

  const suggestions = useMemo(() => {
    if (intent !== 'send') return [];
    const nq = norm(query.trim());
    if (!nq) {
      // Curated short list when empty
      const popularIds = new Set([
        'FR-Paris', 'FR-Lyon', 'CA-Montréal', 'AE-Dubaï',
        'CI-Abidjan', 'FR-Marseille', 'ML-Bamako', 'CM-Douala',
      ]);
      return pool.filter(c => popularIds.has(c.id)).slice(0, 8);
    }
    return pool
      .filter(c => norm(c.city).includes(nq) || norm(c.countryLabel).includes(nq))
      .slice(0, 10);
  }, [pool, query, intent]);

  // Reset cursor when results change
  useEffect(() => { setActiveIdx(0); }, [query, intent]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const submit = (override?: string) => {
    const q = (override ?? query).trim();
    if (intent === 'sourcing') {
      navigate(`/sourcing${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      return;
    }
    if (intent === 'receive') {
      navigate(`/expedier/recevoir${q ? `?origin=${encodeURIComponent(q)}` : ''}`);
      return;
    }
    // SEND — Dakar toujours sur une extrémité.
    const matched = matchCity(q, customCities);
    const foreignCountry = matched?.country ?? undefined;
    const foreignCity    = matched?.city ?? (q || undefined);
    const preset = direction === 'from_dakar'
      ? { origin: 'SN', origin_city: HUB_DAKAR.city, destination: foreignCountry, destination_city: foreignCity, source: 'intent_bar' }
      : { origin: foreignCountry, origin_city: foreignCity, destination: 'SN', destination_city: HUB_DAKAR.city, source: 'intent_bar' };
    setOpen(false);
    navigate('/expedier/envoyer', { state: { preset } });
  };

  const pickSuggestion = (s: typeof pool[number]) => {
    setQuery(s.city);
    setOpen(false);
    requestAnimationFrame(() => submit(s.city));
  };

  return (
    <div
      ref={wrapRef}
      className={cn(
        'w-full relative',
        isHero ? 'rounded-2xl p-3 sm:p-4' : 'rounded-xl p-2',
        className,
      )}
      style={{
        background: 'hsl(var(--background-surface))',
        border: '0.5px solid hsl(var(--color-border-tertiary))',
      }}
      role="search"
      aria-label="Que voulez-vous faire ?"
    >
      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Type de demande"
        className={cn('flex gap-1', isHero ? 'mb-3' : 'mb-2')}
      >
        {INTENTS.map((t) => {
          const Icon = t.icon;
          const active = t.id === intent;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              aria-controls={`${id}-panel`}
              type="button"
              onClick={() => { setIntent(t.id); setOpen(false); }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full transition-colors whitespace-nowrap',
                isHero ? 'h-9 px-3.5 text-[13px]' : 'h-8 px-3 text-[12px]',
                active
                  ? 'bg-foreground text-background font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              style={
                !active
                  ? { border: '0.5px solid hsl(var(--color-border-tertiary))' }
                  : undefined
              }
            >
              <Icon className={isHero ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Send — Dakar lock chip + direction swap */}
      {intent === 'send' && (
        <div className="flex items-center gap-2 mb-2 text-[11px]">
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
            onClick={() => setDirection(d => d === 'from_dakar' ? 'to_dakar' : 'from_dakar')}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-muted-foreground hover:text-foreground"
            style={{ border: '0.5px solid hsl(var(--color-border-tertiary))' }}
            aria-label="Inverser le sens"
          >
            <ArrowRightLeft className="w-3 h-3" />
            Inverser
          </button>
        </div>
      )}

      {/* Input + CTA */}
      <div
        id={`${id}-panel`}
        role="tabpanel"
        className="flex items-stretch gap-2 relative"
      >
        <div className="relative flex-1 min-w-0">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (intent === 'send') setOpen(true); }}
            onFocus={() => { if (intent === 'send') setOpen(true); }}
            onKeyDown={(e) => {
              if (intent === 'send' && open && suggestions.length > 0) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(suggestions.length - 1, i + 1)); return; }
                if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1)); return; }
                if (e.key === 'Escape')    { setOpen(false); return; }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const s = suggestions[activeIdx];
                  if (s) { pickSuggestion(s); return; }
                  submit();
                  return;
                }
              }
              if (e.key === 'Enter') { e.preventDefault(); submit(); }
            }}
            placeholder={placeholder}
            aria-label={placeholder}
            role={intent === 'send' ? 'combobox' : undefined}
            aria-expanded={intent === 'send' ? open : undefined}
            aria-controls={intent === 'send' ? `${id}-listbox` : undefined}
            aria-autocomplete={intent === 'send' ? 'list' : undefined}
            aria-activedescendant={intent === 'send' && open && suggestions[activeIdx] ? `${id}-opt-${activeIdx}` : undefined}
            autoComplete="off"
            className={cn(
              'w-full bg-transparent outline-none px-3 text-foreground placeholder:text-muted-foreground',
              isHero ? 'h-11 text-[14px]' : 'h-10 text-[13px]',
              query && 'pr-8',
            )}
            style={{
              border: '0.5px solid hsl(var(--color-border-tertiary))',
              borderRadius: 8,
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              aria-label="Effacer"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Suggestions dropdown — send only */}
          {intent === 'send' && open && suggestions.length > 0 && (
            <ul
              id={`${id}-listbox`}
              role="listbox"
              className="absolute left-0 right-0 top-full mt-1 z-50 max-h-72 overflow-y-auto rounded-lg shadow-lg"
              style={{
                background: 'hsl(var(--background))',
                border: '0.5px solid hsl(var(--color-border-tertiary))',
              }}
            >
              {suggestions.map((s, i) => {
                const active = i === activeIdx;
                return (
                  <li
                    key={s.id}
                    id={`${id}-opt-${i}`}
                    role="option"
                    aria-selected={active}
                    onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s); }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2.5 cursor-pointer text-[13px]',
                      active ? 'bg-secondary' : 'hover:bg-secondary/60',
                    )}
                  >
                    <span className="text-base leading-none" aria-hidden>{s.flag}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium text-foreground truncate">{s.city}</span>
                      <span className="block text-[11px] text-muted-foreground truncate">{s.countryLabel}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() => submit()}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium shrink-0',
            isHero ? 'h-11 px-4 text-[13px]' : 'h-10 px-3 text-[12px]',
          )}
          style={{
            background: 'hsl(var(--foreground))',
            color: 'hsl(var(--background))',
          }}
        >
          {ctaLabel}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
