import { useState, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Search, Inbox, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  placeholder: string;
  cta: string;
  /** Build the destination URL from the query the user typed. */
  to: (q: string) => string;
}> = [
  {
    id: 'send',
    label: 'Envoyer',
    icon: Send,
    placeholder: 'Vers où ? (ex. Paris, Dakar…)',
    cta: 'Envoyer',
    to: (q) => `/expedier/envoyer${q ? `?destination=${encodeURIComponent(q)}` : ''}`,
  },
  {
    id: 'sourcing',
    label: 'Sourcing',
    icon: Search,
    placeholder: 'Quel produit cherchez-vous ?',
    cta: 'Sourcer',
    to: (q) => `/sourcing${q ? `?q=${encodeURIComponent(q)}` : ''}`,
  },
  {
    id: 'receive',
    label: 'Réception',
    icon: Inbox,
    placeholder: 'Pays d’origine (Amazon, AliExpress…)',
    cta: 'Recevoir',
    to: (q) => `/expedier/recevoir${q ? `?origin=${encodeURIComponent(q)}` : ''}`,
  },
];

/**
 * Unified entry point — 3 intents (Envoyer · Sourcing · Réception) → flows.
 * Used identically on the public landing and inside /app to keep the mental
 * model: one bar, three doors.
 */
export function IntentSearchBar({
  variant = 'compact',
  defaultIntent = 'send',
  className,
}: IntentSearchBarProps) {
  const navigate = useNavigate();
  const [intent, setIntent] = useState<IntentKey>(defaultIntent);
  const [query, setQuery] = useState('');
  const id = useId();

  const current = INTENTS.find((i) => i.id === intent)!;

  const submit = () => navigate(current.to(query.trim()));

  const isHero = variant === 'hero';

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
          placeholder={current.placeholder}
          aria-label={current.placeholder}
          className={cn(
            'flex-1 min-w-0 bg-transparent outline-none px-3 text-foreground placeholder:text-muted-foreground',
            isHero ? 'h-11 text-[14px]' : 'h-10 text-[13px]',
          )}
          style={{
            border: '0.5px solid hsl(var(--color-border-tertiary))',
            borderRadius: 8,
          }}
        />
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
          {current.cta}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
