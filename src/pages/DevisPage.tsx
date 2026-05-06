import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { computeQuote, fmtEur, fmtXof, loadDraft, saveDraft, type QuoteOption } from '@/lib/quote';

const TONES: Record<NonNullable<QuoteOption['supplyTone']>, string> = {
  success: '#1D9E75',
  warning: '#BA7517',
  muted: 'hsl(var(--text-tertiary))',
};

export default function DevisPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => loadDraft());
  const [selected, setSelected] = useState<QuoteOption['key']>(draft?.selected ?? 'eco');

  useEffect(() => {
    document.title = 'Yobbanté · Votre estimation';
    if (!draft) navigate('/', { replace: true });
  }, [draft, navigate]);

  const result = useMemo(() => draft ? computeQuote(draft.input) : null, [draft]);
  const selectedOption = result?.options.find(o => o.key === selected) ?? result?.options[0];

  if (!draft || !result || !selectedOption) return null;
  const { input } = draft;

  const routeLabel = `${input.origin || 'Origine'} → ${input.destination || 'Destination'}`;
  const metaLabel = `${result.taxableWeight} kg · ${labelMode(input.mode)} · ${labelType(input.type)} · Zone ${result.zone}`;

  const onConfirm = () => {
    saveDraft(input, selected);
    navigate('/devis/confirmer');
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav />

      {/* Route bar */}
      <div className="flex items-center justify-between px-6 py-3"
        style={{ borderBottom: '0.5px solid hsl(var(--color-border-tertiary))' }}>
        <div className="text-[13px] truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {routeLabel} · {result.taxableWeight} kg · {labelMode(input.mode)}
        </div>
        <Link to="/" className="text-[12px] hover:underline shrink-0 ml-3"
          style={{ color: 'hsl(var(--muted-foreground))' }}>Modifier</Link>
      </div>

      {/* Results */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-6 pb-32">
        <p className="text-label">Votre estimation</p>
        <h2 className="mt-1">{routeLabel}</h2>
        <p className="text-[13px] mt-1 mb-5" style={{ color: 'hsl(var(--muted-foreground))' }}>{metaLabel}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 items-stretch">
          {result.options.map(opt => {
            const isSel = selected === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSelected(opt.key)}
                className="text-left transition-colors h-full flex flex-col"
                style={{
                  background: 'hsl(var(--background-surface))',
                  borderRadius: 12,
                  padding: 14,
                  border: opt.featured
                    ? '2px solid #1D9E75'
                    : isSel
                      ? '1px solid hsl(var(--foreground))'
                      : '0.5px solid hsl(var(--color-border-tertiary))',
                }}
              >
                {opt.badge ? (
                  <span
                    className="inline-block mb-2 self-start"
                    style={{
                      fontSize: 9,
                      fontWeight: 500,
                      borderRadius: 20,
                      padding: '3px 8px',
                      background: opt.badgeTone === 'warning' ? '#FAEEDA' : '#E1F5EE',
                      color: opt.badgeTone === 'warning' ? '#633806' : '#085041',
                    }}
                  >
                    {opt.badge}
                  </span>
                ) : (
                  <span aria-hidden className="inline-block mb-2" style={{ height: 17 }} />
                )}
                <div className="text-[13px] font-medium">{opt.label}</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>{opt.delay}</div>
                <div className="text-price mt-2.5">{fmtEur(opt.priceEur)}</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>{fmtXof(opt.priceXof)}</div>
                <div className="text-[11px] mt-2" style={{ color: 'hsl(var(--muted-foreground))' }}>{opt.departure}</div>
                <div className="text-[10px] mt-1" style={{ color: TONES[opt.supplyTone] }}>{opt.supply}</div>
              </button>
            );
          })}
        </div>

        <p className="text-[12px] mt-3" style={{ color: 'hsl(var(--text-tertiary))' }}>
          Poids taxable : {result.taxableWeight} kg · Volumétrique : {result.volumetricWeight} kg · Dédouanement inclus · Marge incluse
        </p>
      </main>

      {/* Sticky bar — 64px · bg background-primary */}
      <div
        className="sticky bottom-0 z-40 flex items-center justify-between gap-3 px-6"
        style={{
          height: 64,
          background: 'hsl(var(--background-primary))',
          borderTop: '0.5px solid hsl(var(--color-border-tertiary))',
        }}
      >
        <div className="text-[13px] font-medium truncate" style={{ color: 'hsl(var(--foreground))' }}>
          {selectedOption.label}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-[15px] font-medium leading-tight" style={{ color: 'hsl(var(--foreground))' }}>
              {fmtEur(selectedOption.priceEur)}
            </div>
            <div className="text-[11px] leading-tight" style={{ color: 'hsl(var(--text-tertiary))' }}>
              {fmtXof(selectedOption.priceXof)}
            </div>
          </div>
          <button onClick={onConfirm} className="btn-cta">Continuer →</button>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}

function labelMode(m: string) {
  if (m === 'air') return 'Aérien';
  if (m === 'sea') return 'Maritime';
  if (m === 'road') return 'Route';
  return m;
}
function labelType(t: string) {
  const map: Record<string, string> = {
    standard: 'Standard', fragile: 'Fragile', electronique: 'Électronique',
    auto: 'Auto', haute_valeur: 'Haute valeur', cosmetiques: 'Cosmétiques',
  };
  return map[t] || t;
}
