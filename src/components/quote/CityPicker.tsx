import { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X, MapPin } from 'lucide-react';
import { ALL_CITIES, HUB_DAKAR } from '@/lib/worldCities';
import { useCustomCities } from '@/hooks/useCustomCities';
import { cn } from '@/lib/utils';

interface CityPickerProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** City to exclude from list (e.g. Dakar locked on other side) */
  excludeCity?: string;
  /** Inclure Dakar (hub) dans la liste — utile côté admin où les 2 sens existent */
  includeHub?: boolean;
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
  ariaLabel = 'Choisir une ville', excludeCity, includeHub = false, className,
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

  const { cities: customCities } = useCustomCities();
  const cities = useMemo(() => {
    const seen = new Set<string>();
    return [...(includeHub ? [HUB_DAKAR] : []), ...ALL_CITIES, ...customCities]
      .filter(c => !excludeCity || c.city !== excludeCity)
      .filter(c => {
        const key = `${c.country}-${c.city}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [excludeCity, customCities, includeHub]);

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

  /**
   * When the picker lives inside a Radix Dialog/Sheet, portalling to <body>
   * puts the search input outside the Radix focus trap: every keystroke loses
   * focus and the field stays empty. Portalling into the Radix content node
   * keeps it inside the trap.
   */
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const host = triggerRef.current?.closest<HTMLElement>('[data-radix-dialog-content],[role="dialog"]');
    setPortalTarget(host ?? document.body);
  }, [open]);

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

  /** Ferme le picker si le clic vise le fond ou un élément marqué « dismiss ». */
  const maybeDismiss = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (el && el.closest('[data-city-picker-dismiss]')) setOpen(false);
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

      {open && portalTarget && createPortal(
        <div
          className="fixed inset-0 z-[100] flex sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          // Marker used by parent Radix dialogs/sheets to opt out of their
          // focus trap while this portal is open (otherwise typing is stolen).
          data-city-picker-portal=""
          aria-label={ariaLabel}
          // Le portail vit hors du DOM d'un éventuel Dialog Radix parent :
          // Radix pose `pointer-events: none` sur le body et fermerait le
          // parent au premier clic. On réactive les events et on stoppe la
          // propagation vers la couche « dismissable » du parent.
          // NB : `stopPropagation` en phase capture empêche aussi l'événement
          // d'atteindre nos propres enfants (fond, bouton Annuler) — on gère
          // donc la fermeture ici, directement dans le handler de capture.
          style={{ pointerEvents: 'auto' }}
          onPointerDownCapture={(e) => { e.stopPropagation(); maybeDismiss(e.target); }}
          onMouseDownCapture={(e) => e.stopPropagation()}
          onTouchStartCapture={(e) => e.stopPropagation()}
          onFocusCapture={(e) => e.stopPropagation()}
        >
          {/* backdrop — click to close */}
          <div
            className="absolute inset-0 bg-black/50 animate-in fade-in-0"
            data-city-picker-dismiss=""
            aria-hidden="true"
          />
          <button
            type="button"
            aria-label="Fermer"
            data-city-picker-dismiss=""
            className="absolute inset-0 w-full h-full opacity-0 cursor-default"
            onClick={() => setOpen(false)}
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
                  data-city-picker-dismiss=""
                  onClick={() => setOpen(false)}
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
                  <div className="px-4 py-10 text-center text-[13px] text-muted-foreground space-y-2">
                    <div>Aucune ville trouvée pour « {q} ».</div>
                    <div>
                      Destination au Sénégal ou dans un pays voisin (Gambie, Mali, Mauritanie…) ?
                    </div>
                    <a
                      href="/terminal-d"
                      className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-[13px] font-medium border border-border text-foreground hover:bg-secondary"
                    >
                      → Transport routier (Terminal D)
                    </a>
                  </div>
                )
              )}
            </div>
          </div>
        </div>,
        portalTarget,
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
