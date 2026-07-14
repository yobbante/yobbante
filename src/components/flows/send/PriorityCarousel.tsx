import { useEffect, useRef } from 'react';
import { Clock, Zap, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFcfa } from '@/lib/yobbantePricing';
import { formatLocalAmount, type CountryProfile } from '@/lib/countryProfile';

export function PriorityCarousel({
  priority, standardPrice, expressPrice, standardEta, expressEta, originProfile,
  outsideDakarSurchargeFcfa, onSelect,
}: {
  priority: 'normal' | 'express';
  standardPrice: number;
  expressPrice: number;
  standardEta: string;
  expressEta: string;
  originProfile: CountryProfile;
  outsideDakarSurchargeFcfa: number;
  onSelect: (p: 'normal' | 'express') => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  // activeIdx is derived from priority — single source of truth lives in the parent.
  const activeIdx = priority === 'express' ? 1 : 0;
  // Guard to ignore scroll events triggered by our own programmatic scrollTo.
  const programmaticScrollRef = useRef(false);
  const programmaticTimerRef = useRef<number | null>(null);

  const cards = [
    {
      id: 'normal' as const,
      label: 'Standard',
      tagline: 'Via transporteur partenaire',
      eta: standardEta,
      price: standardPrice,
      perks: ['Groupé avec d\'autres colis · meilleur tarif', 'Départ au prochain vol disponible'],
      badge: { text: 'Recommandé', bg: '#22C55E', fg: '#fff' },
    },
    {
      id: 'express' as const,
      label: 'Express ⚡',
      tagline: 'Priorité absolue — premier départ',
      eta: expressEta,
      price: expressPrice,
      perks: ['Embarqué sur le tout premier vol', 'Traitement prioritaire en agence'],
      badge: { text: 'Le plus rapide', bg: '#F5C518', fg: '#0D1B2A' },
    },
  ];

  // Sync scroll position when priority changes externally.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const child = el.children[activeIdx] as HTMLElement | undefined;
    if (!child) return;
    const targetLeft = child.offsetLeft - el.offsetLeft;
    if (Math.abs(el.scrollLeft - targetLeft) < 4) return;
    programmaticScrollRef.current = true;
    if (programmaticTimerRef.current) window.clearTimeout(programmaticTimerRef.current);
    el.scrollTo({ left: targetLeft, behavior: 'smooth' });
    programmaticTimerRef.current = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 600);
    return () => {
      if (programmaticTimerRef.current) window.clearTimeout(programmaticTimerRef.current);
    };
  }, [activeIdx]);

  // Detect active card from scroll position (user drag only).
  const onScroll = () => {
    if (programmaticScrollRef.current) return;
    const el = scrollerRef.current;
    if (!el) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let best = 0; let bestDist = Infinity;
    Array.from(el.children).forEach((c, i) => {
      const child = c as HTMLElement;
      const childCenter = child.offsetLeft - el.offsetLeft + child.clientWidth / 2;
      const dist = Math.abs(childCenter - center);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    const newPriority = best === 1 ? 'express' : 'normal';
    if (newPriority !== priority) onSelect(newPriority);
  };

  return (
    <div>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 pb-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none' }}
      >
        {cards.map((c) => {
          const active = priority === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                'snap-center shrink-0 w-[88%] sm:w-[420px] text-left rounded-2xl border-2 p-5 transition-all relative bg-card',
                active ? 'border-[#F5C518] shadow-[0_0_0_2px_rgba(245,197,24,0.18)]' : 'border-border'
              )}
            >
              <span
                className="absolute -top-2 right-3 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
                style={{ background: c.badge.bg, color: c.badge.fg }}
              >
                {c.badge.text}
              </span>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {c.id === 'normal' ? <Clock className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                  <p className="text-base font-bold truncate">{c.label}</p>
                </div>
                {active && <CheckCircle2 className="w-4 h-4 shrink-0 text-[#F5C518]" />}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{c.tagline}</p>
              <div className="mt-3">
                <span className="block text-2xl font-bold tabular-nums leading-tight">
                  {formatLocalAmount(c.price, originProfile)}
                </span>
                {outsideDakarSurchargeFcfa > 0 && (
                  <span className="block mt-0.5 text-[11px] text-muted-foreground">
                    dont +{formatFcfa(outsideDakarSurchargeFcfa)} déplacement hors zone
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Livraison estimée · {c.eta}</p>
              <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                {c.perks.map(p => (
                  <li key={p} className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-current opacity-60" /> {p}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
      {/* Dots */}
      <div className="flex items-center justify-center gap-1.5 mt-2">
        {cards.map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 rounded-full transition-all',
              i === activeIdx ? 'w-5 bg-foreground' : 'w-1.5 bg-border'
            )}
          />
        ))}
      </div>
      <p className="text-center text-[10px] text-muted-foreground mt-1.5">
        Glissez pour comparer · Touchez pour choisir
      </p>
    </div>
  );
}
