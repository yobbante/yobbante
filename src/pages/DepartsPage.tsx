import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Ship, Truck, Luggage, Search, ArrowRight, CalendarClock, Package } from 'lucide-react';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { useSeo } from '@/hooks/useSeo';
import { useJsonLd } from '@/hooks/useJsonLd';
import { usePublicDepartures, useFretTarifZones, type DepartMode, type PublicDeparture } from '@/hooks/usePublicDepartures';
import { getDepartureCountdown } from '@/lib/departureTime';
import { cn } from '@/lib/utils';

const MODES: { key: DepartMode; label: string; short: string; Icon: typeof Plane; blurb: string }[] = [
  { key: 'gp',   label: 'GP · bagage accompagné', short: 'GP',       Icon: Luggage, blurb: 'Un voyageur transporte votre colis. Le plus rapide et le moins cher pour 1 à 25 kg.' },
  { key: 'air',  label: 'Cargo aérien',           short: 'Cargo aérien',   Icon: Plane,   blurb: 'Fret aérien classique, sans limite de poids, avec documents et dédouanement.' },
  { key: 'sea',  label: 'Maritime',               short: 'Maritime', Icon: Ship,    blurb: 'Groupage ou conteneur complet pour les volumes importants.' },
  { key: 'road', label: 'Routier · Terminal D',   short: 'Routier',  Icon: Truck,   blurb: 'Départs quotidiens depuis Dakar vers tout le Sénégal et les pays voisins.' },
];

function fmtDay(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' });
}
function fmtShort(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function DepartsPage() {
  useSeo({
    title: 'Prochains départs — GP, aérien, maritime, routier | Yobbanté',
    description: 'Consultez tous les prochains départs Yobbanté depuis et vers Dakar : GP, aérien, maritime et routier. Réservez votre place en 2 clics.',
    path: '/departs',
  });

  const navigate = useNavigate();
  const { data: departures = [], isLoading } = usePublicDepartures();
  const { data: fretZones = [] } = useFretTarifZones();

  const [mode, setMode] = useState<DepartMode>('gp');
  const [direction, setDirection] = useState<'all' | 'from_dakar' | 'to_dakar'>('all');
  const [query, setQuery] = useState('');

  useJsonLd('jsonld-departs', {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Prochains départs Yobbanté',
    itemListElement: departures.slice(0, 20).map((d, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `${d.origin_city} → ${d.destination_city} · ${fmtShort(d.departure_date)}`,
    })),
  });

  const counts = useMemo(() => {
    const c: Record<DepartMode, number> = { gp: 0, air: 0, sea: 0, road: 0 };
    for (const d of departures) c[d.mode] += 1;
    c.road = fretZones.reduce((n, z) => n + z.destinations.length, 0);
    return c;
  }, [departures, fretZones]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return departures
      .filter(d => d.mode === mode)
      .filter(d => {
        const fromDakar = d.origin_city.toLowerCase().includes('dakar');
        if (direction === 'from_dakar') return fromDakar;
        if (direction === 'to_dakar') return !fromDakar;
        return true;
      })
      .filter(d => !q || `${d.origin_city} ${d.destination_city} ${d.short_ref ?? ''}`.toLowerCase().includes(q));
  }, [departures, mode, direction, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, PublicDeparture[]>();
    for (const d of filtered) {
      const list = map.get(d.departure_date) || [];
      list.push(d);
      map.set(d.departure_date, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const reserve = (d: PublicDeparture) => {
    navigate('/expedier/envoyer', {
      state: {
        preset: {
          type: 'package',
          origin: d.origin_country ?? (d.origin_city.toLowerCase().includes('dakar') ? 'SN' : undefined),
          destination: d.destination_country ?? undefined,
          origin_city: d.origin_city,
          destination_city: d.destination_city,
          transport: d.mode === 'gp' ? 'GP' : d.mode === 'sea' ? 'SEA' : 'AIR',
          departure_date: d.departure_date,
          source: 'departures-ticker',
        },
      },
    });
  };

  const active = MODES.find(m => m.key === mode)!;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav />

      <main className="flex-1 w-full max-w-4xl mx-auto px-5 sm:px-6 py-8 pb-32 md:pb-12 space-y-8">
        <header className="space-y-3">
          <div className="text-label">PROCHAINS DÉPARTS</div>
          <h1 className="max-w-[520px]">Choisissez un départ. On s'occupe du reste.</h1>
          <p className="text-[14px] max-w-[520px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Tous nos départs confirmés, mis à jour en temps réel. Cliquez sur un départ pour
            démarrer votre envoi avec la route et la date déjà pré-remplies.
          </p>
        </header>

        {/* Sélecteur de mode */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {MODES.map(m => {
            const on = m.key === mode;
            return (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                aria-pressed={on}
                className="rounded-[12px] px-3 py-3 text-left transition-colors"
                style={{
                  background: on ? 'hsl(var(--foreground))' : 'hsl(var(--background-surface))',
                  color: on ? 'hsl(var(--background))' : 'hsl(var(--foreground))',
                  border: '0.5px solid hsl(var(--color-border-tertiary))',
                }}
              >
                <m.Icon className="w-4 h-4 mb-1.5" />
                <div className="text-[13px] font-medium leading-tight">{m.short}</div>
                <div className="text-[11px] opacity-70">
                  {counts[m.key]} {m.key === 'road' ? 'destinations' : 'départs'}
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-[13px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{active.blurb}</p>

        {mode === 'road' ? (
          <RoadSection zones={fretZones} />
        ) : (
          <>
            {/* Filtres */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'hsl(var(--muted-foreground))' }} />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Rechercher une ville (Paris, Abidjan, New York…)"
                  className="w-full rounded-[10px] pl-9 pr-3 text-[13px]"
                  style={{
                    height: 40,
                    background: 'hsl(var(--background-surface))',
                    border: '0.5px solid hsl(var(--color-border-tertiary))',
                    color: 'hsl(var(--foreground))',
                  }}
                />
              </div>
              <div className="flex gap-2">
                {([['all', 'Tous'], ['from_dakar', 'Depuis Dakar'], ['to_dakar', 'Vers Dakar']] as const).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setDirection(k)}
                    className="rounded-full px-3.5 text-[12px] font-medium transition-colors"
                    style={{
                      height: 40,
                      background: direction === k ? 'hsl(var(--foreground))' : 'transparent',
                      color: direction === k ? 'hsl(var(--background))' : 'hsl(var(--muted-foreground))',
                      border: '0.5px solid hsl(var(--color-border-tertiary))',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map(i => (
                  <div key={i} className="rounded-[12px] animate-pulse" style={{ height: 78, background: 'hsl(var(--secondary))' }} />
                ))}
              </div>
            ) : grouped.length === 0 ? (
              <EmptyMode mode={mode} />
            ) : (
              <div className="space-y-6">
                {grouped.map(([date, list]) => {
                  const cd = getDepartureCountdown(date);
                  return (
                    <section key={date} className="space-y-2">
                      <div className="flex items-baseline gap-2">
                        <h2 className="text-[15px] font-medium capitalize">{fmtDay(date)}</h2>
                        {cd && !cd.isPast && (
                          <span className="text-[11px]" style={{ color: cd.under48h ? '#F5C518' : 'hsl(var(--muted-foreground))' }}>
                            {cd.label}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {list.map(d => (
                          <DepartureCard key={d.id} d={d} onSelect={() => reserve(d)} />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}

        <section
          className="rounded-[12px] p-4 flex flex-col sm:flex-row sm:items-center gap-3"
          style={{ background: 'hsl(var(--background-surface))', border: '0.5px solid hsl(var(--color-border-tertiary))' }}
        >
          <div className="flex-1">
            <div className="text-[14px] font-medium">Aucun départ ne correspond à votre besoin&nbsp;?</div>
            <div className="text-[12px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Demandez un devis sur mesure — réponse sous 24 h ouvrées.
            </div>
          </div>
          <button onClick={() => navigate('/demande-devis')} className="btn-cta whitespace-nowrap">
            Demander un devis →
          </button>
        </section>
      </main>

      <div className="hidden md:block">
        <PublicFooter />
      </div>
      <div className="md:hidden">
        <PublicFooter />
      </div>
    </div>
  );
}

function DepartureCard({ d, onSelect }: { d: PublicDeparture; onSelect: () => void }) {
  const cd = getDepartureCountdown(d.departure_date);
  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded-[12px] p-4 transition-colors group"
      style={{ background: 'hsl(var(--background-surface))', border: '0.5px solid hsl(var(--color-border-tertiary))' }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[15px] font-medium">
            <span className="truncate">{d.origin_city}</span>
            <span style={{ color: '#F5C518' }}>→</span>
            <span className="truncate">{d.destination_city}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="w-3.5 h-3.5" /> Départ {fmtShort(d.departure_date)}
            </span>
            {d.arrival_estimate && <span>Arrivée estimée {fmtShort(d.arrival_estimate)}</span>}
            {d.available_capacity_kg != null && (
              <span className="inline-flex items-center gap-1">
                <Package className="w-3.5 h-3.5" /> {d.available_capacity_kg} kg dispo
              </span>
            )}
            {d.capacity_cbm != null && (
              <span className="inline-flex items-center gap-1">
                <Package className="w-3.5 h-3.5" /> {d.capacity_cbm} CBM
              </span>
            )}
            {d.short_ref && <span>Réf. {d.short_ref}</span>}
          </div>
          {(d.carrier_company || d.flight_or_vessel || d.cutoff_date || d.container_type || d.price_per_kg_xof || d.price_per_cbm_xof) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {d.carrier_company && <span className="font-medium">{d.carrier_company}</span>}
              {d.flight_or_vessel && <span>{d.mode === 'sea' ? 'Navire' : 'Vol'} {d.flight_or_vessel}</span>}
              {d.container_type && <span>{d.container_type}</span>}
              {d.cutoff_date && <span>Dépôt jusqu’au {fmtShort(d.cutoff_date)}</span>}
              {d.price_per_kg_xof != null && <span>{d.price_per_kg_xof.toLocaleString('fr-FR')} F/kg</span>}
              {d.price_per_cbm_xof != null && <span>{d.price_per_cbm_xof.toLocaleString('fr-FR')} F/CBM</span>}
            </div>
          )}
          {cd && !cd.isPast && cd.under48h && (
            <div className="mt-1.5 text-[11px] font-medium" style={{ color: '#F5C518' }}>
              Dernière ligne droite — {cd.label}
            </div>
          )}
        </div>
        <span
          className={cn('shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-medium')}
          style={{ background: 'hsl(var(--foreground))', color: 'hsl(var(--background))' }}
        >
          Réserver <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </button>
  );
}

function EmptyMode({ mode }: { mode: DepartMode }) {
  const navigate = useNavigate();
  return (
    <div
      className="rounded-[12px] p-6 text-center space-y-3"
      style={{ background: 'hsl(var(--background-surface))', border: '0.5px dashed hsl(var(--color-border-tertiary))' }}
    >
      <div className="text-[14px] font-medium">Aucun départ publié pour ce mode actuellement</div>
      <p className="text-[13px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
        Nous ouvrons de nouveaux départs chaque semaine. Envoyez-nous votre besoin&nbsp;: nous
        positionnons un départ {mode === 'sea' ? 'maritime' : mode === 'air' ? 'aérien' : 'GP'} dès que possible.
      </p>
      <button onClick={() => navigate(`/demande-devis?mode=${mode}`)} className="btn-cta">
        Demander un devis →
      </button>
    </div>
  );
}

function RoadSection({ zones }: { zones: ReturnType<typeof useFretTarifZones>['data'] }) {
  const navigate = useNavigate();
  const list = zones ?? [];
  const national = list.filter(z => z.scope === 'national');
  const inter = list.filter(z => z.scope === 'international');

  const Group = ({ title, rows, kg }: { title: string; rows: typeof national; kg?: boolean }) => (
    <section className="space-y-2">
      <h2 className="text-[15px] font-medium">{title}</h2>
      <div className="grid sm:grid-cols-2 gap-2">
        {rows.map(z => (
          <div
            key={z.id}
            className="rounded-[12px] p-4 space-y-2"
            style={{ background: 'hsl(var(--background-surface))', border: '0.5px solid hsl(var(--color-border-tertiary))' }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[14px] font-medium">{z.label}</span>
              <span className="text-[12px]" style={{ color: '#F5C518' }}>
                {kg
                  ? `${z.price_per_kg_fcfa?.toLocaleString('fr-FR')} FCFA/kg`
                  : `dès ${z.price_s_fcfa?.toLocaleString('fr-FR')} FCFA`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {z.destinations.map(d => (
                <button
                  key={d}
                  onClick={() => navigate(`/terminal-d?ville=${encodeURIComponent(d)}`)}
                  className="rounded-full px-2.5 py-1 text-[12px] transition-colors"
                  style={{ background: 'hsl(var(--secondary))', border: '0.5px solid hsl(var(--color-border-tertiary))' }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      <div
        className="rounded-[12px] p-4 text-[13px]"
        style={{ background: 'hsl(var(--secondary))', border: '0.5px solid hsl(var(--color-border-tertiary))' }}
      >
        Départs <strong>quotidiens</strong> depuis Dakar. Enlèvement à votre adresse à Dakar, puis
        acheminement routier. Cliquez sur une destination pour réserver votre enlèvement.
      </div>
      <Group title="Sénégal" rows={national} />
      <Group title="Pays voisins" rows={inter} kg />
      <button onClick={() => navigate('/terminal-d')} className="btn-cta w-full sm:w-auto">
        Ouvrir Terminal D →
      </button>
    </div>
  );
}
