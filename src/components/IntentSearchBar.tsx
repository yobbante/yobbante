import { useState, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Search, Inbox, ArrowRight, ArrowRightLeft, MapPin } from 'lucide-react';
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

/** Best-effort match for a free-text city input against the catalog. */
function matchCity(input: string) {
  const v = input.trim().toLowerCase();
  if (!v) return null;
  return (
    ALL_CITIES.find(c => c.city.toLowerCase() === v) ??
    ALL_CITIES.find(c => c.city.toLowerCase().startsWith(v)) ??
    ALL_CITIES.find(c => c.city.toLowerCase().includes(v) || c.countryLabel.toLowerCase().includes(v)) ??
    null
  );
}

/**
 * Unified entry point — 3 intents (Envoyer · Sourcing · Réception) → flows.
 * For "Envoyer", Dakar est toujours verrouillé sur l'une des deux extrémités.
 */
export function IntentSearchBar({
  variant = 'compact',
  defaultIntent = 'send',
  className,
}: IntentSearchBarProps) {
  const navigate = useNavigate();
  const [intent, setIntent] = useState<IntentKey>(defaultIntent);
  const [query, setQuery] = useState('');
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

  const submit = () => {
    const q = query.trim();
    if (intent === 'sourcing') {
      navigate(`/sourcing${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      return;
    }
    if (intent === 'receive') {
      navigate(`/expedier/recevoir${q ? `?origin=${encodeURIComponent(q)}` : ''}`);
      return;
    }
    // SEND — Dakar toujours sur une extrémité.
    const matched = matchCity(q);
    const foreignCountry = matched?.country ?? undefined;
    const foreignCity    = matched?.city ?? (q || undefined);
    const preset = direction === 'from_dakar'
      ? { origin: 'SN', origin_city: HUB_DAKAR.city, destination: foreignCountry, destination_city: foreignCity, source: 'intent_bar' }
      : { origin: foreignCountry, origin_city: foreignCity, destination: 'SN', destination_city: HUB_DAKAR.city, source: 'intent_bar' };
    navigate('/expedier/envoyer', { state: { preset } });
  };

  return (
    <div
      className={cn(
        'w-full',
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
              onClick={() => setIntent(t.id)}
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
        className="flex items-stretch gap-2"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          list={intent === 'send' ? `${id}-cities` : undefined}
          className={cn(
            'flex-1 min-w-0 bg-transparent outline-none px-3 text-foreground placeholder:text-muted-foreground',
            isHero ? 'h-11 text-[14px]' : 'h-10 text-[13px]',
          )}
          style={{
            border: '0.5px solid hsl(var(--color-border-tertiary))',
            borderRadius: 8,
          }}
        />
        {intent === 'send' && (
          <datalist id={`${id}-cities`}>
            {ALL_CITIES.map(c => (
              <option key={c.id} value={c.city}>{c.flag} {c.countryLabel}</option>
            ))}
          </datalist>
        )}
        <button
          type="button"
          onClick={submit}
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
