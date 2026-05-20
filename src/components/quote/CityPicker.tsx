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

/** Selector for focusable elements inside the sheet (for focus trap). */
const FOCUSABLE_SEL =
  'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function CityPicker({
  value, onChange, placeholder = 'Choisir une ville…',
  ariaLabel = 'Choisir une ville', excludeCity, className,
}: CityPickerProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Debounce search input ~180ms to keep typing buttery on low-end devices.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 180);
    return () => clearTimeout(t);
  }, [q]);

  const cities = useMemo(
    () => ALL_CITIES.filter(c => !excludeCity || c.city !== excludeCity),
    [excludeCity],
  );

  const filtered = useMemo(() => {
    const nq = norm(debouncedQ.trim());
    const list = nq
      ? cities.filter(c => norm(c.city).includes(nq) || norm(c.countryLabel).includes(nq))
      : cities;
    if (!nq) {
      const pop = list.filter(c => POPULAR_IDS.has(c.id));
      const rest = list.filter(c => !POPULAR_IDS.has(c.id))
        .sort((a, b) => a.city.localeCompare(b.city, 'fr'));
      return { pop, rest };
    }
    const sorted = [...list].sort((a, b) => a.city.localeCompare(b.city, 'fr'));
    return { pop: [], rest: sorted };
  }, [cities, debouncedQ]);

  // Lock body scroll, focus the input, and trap focus while open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const t = setTimeout(() => inputRef.current?.focus(), 80);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !sheetRef.current) return;
      const focusables = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SEL),
      ).filter(el => el.offsetParent !== null || el === document.activeElement);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !sheetRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
      // Restore focus to the trigger after close for keyboard users.
      triggerRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  const select = (label: string) => {
    onChange(label);
    setOpen(false);
    setQ('');
    setDebouncedQ('');
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
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
          {/* backdrop — click to close */}
          <div
            className="absolute inset-0 bg-black/50 animate-in fade-in-0"
            onMouseDown={() => setOpen(false)}
            onTouchStart={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* sheet */}
          <div
            ref={sheetRef}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'relative w-full sm:w-[440px] bg-background flex flex-col',
              // dvh keeps the sheet visible above the iOS keyboard
              'h-[100dvh] sm:h-[70dvh] sm:max-h-[560px]',
              'mt-auto sm:mt-0 rounded-t-2xl sm:rounded-2xl shadow-xl',
              'animate-in slide-in-from-bottom-4 sm:zoom-in-95',
            )}
            style={{ border: '0.5px solid hsl(var(--color-border-tertiary))' }}
          >
            {/* drag handle (mobile) */}
            <div className="sm:hidden pt-2 pb-1 flex justify-center shrink-0">
              <span className="block h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            {/* sticky search — shrink-0 so it doesn't shift when keyboard opens */}
            <div
              className="px-3 pt-2 pb-3 bg-background z-10 shrink-0"
              style={{ borderBottom: '0.5px solid hsl(var(--color-border-tertiary))' }}
            >
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
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
                    aria-label="Rechercher une ville ou un pays"
                    className="w-full h-11 pl-9 pr-9 rounded-lg bg-secondary text-[16px] outline-none focus:ring-2 focus:ring-ring"
                    style={{ border: '0.5px solid hsl(var(--color-border-tertiary))' }}
                  />
                  {q && (
                    <button
                      type="button"
                      onClick={() => { setQ(''); inputRef.current?.focus(); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                      aria-label="Effacer la recherche"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setOpen(false); }}
                  onTouchStart={(e) => { e.preventDefault(); setOpen(false); }}
                  className="text-[13px] px-2 py-1 text-muted-foreground hover:text-foreground rounded focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  Annuler
                </button>
              </div>
            </div>

            {/* list — its own scroll container, contains overscroll so the
                page underneath doesn't jump when keyboard shows */}
            <div
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]"
              style={{ WebkitOverflowScrolling: 'touch' as any }}
            >
              {filtered.pop.length > 0 && (
                <Section title="Populaires">
                  {filtered.pop.map(c => (
                    <CityRow
                      key={c.id}
                      flag={c.flag}
                      city={c.city}
                      country={c.countryLabel}
                      selected={value === `${c.city}, ${c.countryLabel}` || value === c.city}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); requestAnimationFrame(() => select(`${c.city}, ${c.countryLabel}`)); }}
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
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); requestAnimationFrame(() => select(`${c.city}, ${c.countryLabel}`)); }}
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
}: { flag: string; city: string; country: string; selected: boolean; onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-secondary focus:outline-none focus:bg-secondary',
        selected ? 'bg-secondary' : 'hover:bg-secondary/60',
      )}
    >
      <span className="text-[20px] leading-none" aria-hidden>{flag}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-medium text-foreground truncate">{city}</span>
        <span className="block text-[12px] text-muted-foreground truncate">{country}</span>
      </span>
      {selected && <MapPin className="w-4 h-4 text-foreground/70" aria-hidden />}
    </button>
  );
}
