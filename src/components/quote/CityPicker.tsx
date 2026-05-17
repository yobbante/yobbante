import { useMemo, useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X, MapPin } from 'lucide-react';
import { ALL_CITIES } from '@/lib/worldCities';
import { cn } from '@/lib/utils';

interface CityPickerProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** City to exclude from list (e.g. Dakar locked on other side) */
  excludeCity?: string;
  className?: string;
}

const POPULAR_IDS = new Set([
  'FR-Paris', 'CA-Montréal', 'FR-Lyon', 'AE-Dubaï',
  'CI-Abidjan', 'FR-Marseille', 'ML-Bamako', 'CM-Douala',
]);

/** Normalize accents + lower-case for fluent search. */
function norm(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function CityPicker({
  value, onChange, placeholder = 'Choisir une ville…',
  ariaLabel = 'Choisir une ville', excludeCity, className,
}: CityPickerProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const cities = useMemo(
    () => ALL_CITIES.filter(c => !excludeCity || c.city !== excludeCity),
    [excludeCity],
  );

  const filtered = useMemo(() => {
    const nq = norm(q.trim());
    const list = nq
      ? cities.filter(c => norm(c.city).includes(nq) || norm(c.countryLabel).includes(nq))
      : cities;
    // Pinned popular first when no query
    if (!nq) {
      const pop = list.filter(c => POPULAR_IDS.has(c.id));
      const rest = list.filter(c => !POPULAR_IDS.has(c.id))
        .sort((a, b) => a.city.localeCompare(b.city, 'fr'));
      return { pop, rest };
    }
    const sorted = [...list].sort((a, b) => a.city.localeCompare(b.city, 'fr'));
    return { pop: [], rest: sorted };
  }, [cities, q]);

  // Lock body scroll while open + focus input after open paint.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [open]);

  const select = (label: string) => {
    onChange(label);
    setOpen(false);
    setQ('');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel}
        className={cn(
          'input-base w-full text-left flex items-center justify-between gap-2',
          !value && 'text-muted-foreground',
          className,
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className="w-4 h-4 shrink-0 opacity-60" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
        >
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/50 animate-in fade-in-0"
            onClick={() => setOpen(false)}
          />
          {/* sheet */}
          <div
            className={cn(
              'relative w-full sm:w-[440px] bg-background flex flex-col',
              'h-[85dvh] sm:h-[70dvh] sm:max-h-[560px]',
              'mt-auto sm:mt-0 rounded-t-2xl sm:rounded-2xl shadow-xl',
              'animate-in slide-in-from-bottom-4 sm:zoom-in-95',
            )}
            style={{ border: '0.5px solid hsl(var(--color-border-tertiary))' }}
          >
            {/* drag handle (mobile) */}
            <div className="sm:hidden pt-2 pb-1 flex justify-center">
              <span className="block h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            {/* sticky search */}
            <div
              className="px-3 pt-2 pb-3 sticky top-0 bg-background z-10"
              style={{ borderBottom: '0.5px solid hsl(var(--color-border-tertiary))' }}
            >
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder="Rechercher une ville ou un pays…"
                    className="w-full h-11 pl-9 pr-9 rounded-lg bg-secondary text-[15px] outline-none"
                    style={{ border: '0.5px solid hsl(var(--color-border-tertiary))' }}
                  />
                  {q && (
                    <button
                      type="button"
                      onClick={() => { setQ(''); inputRef.current?.focus(); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
                      aria-label="Effacer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-[13px] px-2 py-1 text-muted-foreground hover:text-foreground"
                >
                  Annuler
                </button>
              </div>
            </div>

            {/* list — own scroll container, stays visible above mobile keyboard */}
            <div className="flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
              {filtered.pop.length > 0 && (
                <Section title="Populaires">
                  {filtered.pop.map(c => (
                    <CityRow
                      key={c.id}
                      flag={c.flag}
                      city={c.city}
                      country={c.countryLabel}
                      selected={value === `${c.city}, ${c.countryLabel}` || value === c.city}
                      onClick={() => select(`${c.city}, ${c.countryLabel}`)}
                    />
                  ))}
                </Section>
              )}
              {filtered.rest.length > 0 ? (
                <Section title={filtered.pop.length ? 'Toutes les villes' : undefined}>
                  {filtered.rest.map(c => (
                    <CityRow
                      key={c.id}
                      flag={c.flag}
                      city={c.city}
                      country={c.countryLabel}
                      selected={value === `${c.city}, ${c.countryLabel}` || value === c.city}
                      onClick={() => select(`${c.city}, ${c.countryLabel}`)}
                    />
                  ))}
                </Section>
              ) : (
                filtered.pop.length === 0 && (
                  <div className="px-4 py-12 text-center text-[13px] text-muted-foreground">
                    Aucune ville trouvée pour « {q} ».
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      {title && (
        <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function CityRow({
  flag, city, country, selected, onClick,
}: { flag: string; city: string; country: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-secondary',
        selected ? 'bg-secondary' : 'hover:bg-secondary/60',
      )}
    >
      <span className="text-[20px] leading-none" aria-hidden>{flag}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-medium text-foreground truncate">{city}</span>
        <span className="block text-[12px] text-muted-foreground truncate">{country}</span>
      </span>
      {selected && <MapPin className="w-4 h-4 text-foreground/70" />}
    </button>
  );
}
