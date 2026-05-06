import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';

interface Event {
  status: 'done' | 'current' | 'pending';
  label: string;
  date: string;
}

const MOCK_EVENTS: Event[] = [
  { status: 'done', label: 'Envoi confirmé', date: '27 avr. 2026 · 14h32' },
  { status: 'done', label: 'Colis assigné au départ du 1 mai', date: '27 avr. 2026 · 14h33' },
  { status: 'done', label: 'En cours de préparation', date: '30 avr. 2026 · 09h15' },
  { status: 'current', label: 'En transit — Dakar → Paris', date: '1 mai 2026 · 06h50' },
  { status: 'pending', label: 'Arrivée à Paris', date: 'Estimé : 4–6 mai 2026' },
  { status: 'pending', label: 'Livraison au destinataire', date: 'Estimé : 5–7 mai 2026' },
];

export default function TrackPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState('');

  useEffect(() => {
    document.title = id ? `Yobbanté · Suivi ${id}` : 'Yobbanté · Suivre mon colis';
  }, [id]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav />

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-6">
        {!id ? (
          <div className="surface-card max-w-[480px] mx-auto">
            <h2 className="mb-3">Suivre mon colis</h2>
            <input
              className="input-base w-full mb-3"
              placeholder="YOB-2026-XXXXX"
              value={input}
              onChange={e => setInput(e.target.value)}
              style={{ height: 40 }}
            />
            <button
              className="btn-cta w-full"
              onClick={() => input.trim() && navigate(`/track/${input.trim()}`)}
            >
              Suivre →
            </button>
          </div>
        ) : (
          <>
            {/* Hero */}
            <div
              className="rounded-[12px] p-5 mb-5 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-start sm:justify-between"
              style={{ background: 'hsl(var(--secondary))' }}
            >
              <div>
                <div className="text-label">{id}</div>
                <h2 className="mt-1">Dakar → Paris</h2>
                <p className="text-[13px] mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  12 kg · Économique · Départ 1 mai
                </p>
              </div>
              <span className="badge-success self-start" style={{ fontSize: 12, padding: '4px 14px' }}>En transit</span>
            </div>

            {/* Timeline */}
            <ol>
              {MOCK_EVENTS.map((e, i) => {
                const isLast = i === MOCK_EVENTS.length - 1;
                const dotStyle =
                  e.status === 'done'
                    ? { background: '#1D9E75' }
                    : e.status === 'current'
                      ? { background: 'hsl(var(--foreground))' }
                      : { background: 'transparent', border: '1.5px solid hsl(var(--color-border-tertiary))' };
                return (
                  <li key={i} className="flex gap-3.5 mb-4">
                    <div className="flex flex-col items-center">
                      <span className="rounded-full" style={{ width: 10, height: 10, marginTop: 3, ...dotStyle }} />
                      {!isLast && (
                        <span style={{ width: 1, minHeight: 28, flex: 1, background: 'hsl(var(--color-border-tertiary))' }} />
                      )}
                    </div>
                    <div className="flex-1 pb-1">
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: e.status === 'pending' ? 400 : 500,
                          color: e.status === 'pending' ? 'hsl(var(--text-tertiary))' : 'hsl(var(--foreground))',
                        }}
                      >
                        {e.label}
                      </div>
                      <div className="mt-0.5" style={{ fontSize: 12, color: 'hsl(var(--text-tertiary))' }}>
                        {e.date}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
