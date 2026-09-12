import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Luggage, Plane, Ship, Truck } from 'lucide-react';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { fmt } from '@/components/PricingSimulator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useSeo } from '@/hooks/useSeo';
import { useJsonLd } from '@/hooks/useJsonLd';
import { supabase } from '@/integrations/supabase/client';
import { useFretTarifZones } from '@/hooks/usePublicDepartures';
import { AIR_ZONES, AIR_VOLUMETRIC_HINT } from '@/lib/airFreight';
import { SEA_ZONES, SEA_WM_HINT } from '@/lib/seaFreight';
import { COLIS_SIZES } from '@/lib/fretPricing';

type TabKey = 'gp' | 'air' | 'sea' | 'road';

const TABS: { key: TabKey; label: string; Icon: typeof Plane; sub: string }[] = [
  { key: 'gp',   label: 'GP',       Icon: Luggage, sub: '1 à 25 kg · le moins cher' },
  { key: 'air',  label: 'Cargo aérien',   Icon: Plane,   sub: 'sans limite de poids' },
  { key: 'sea',  label: 'Maritime', Icon: Ship,    sub: 'gros volumes' },
  { key: 'road', label: 'Routier',  Icon: Truck,   sub: 'Sénégal & pays voisins' },
];

/** Marge appliquée au tarif de référence pour obtenir le prix client indicatif. */
const CLIENT_MARGIN = 1.2;

interface ZoneRate {
  zone_label: string;
  default_rate_per_kg: number;
  express_coefficient: number | null;
  cities: string[] | null;
}

function useGpRates() {
  return useQuery({
    queryKey: ['route-default-rates-public'],
    queryFn: async (): Promise<ZoneRate[]> => {
      const { data } = await supabase
        .from('route_default_rates')
        .select('zone_label, default_rate_per_kg, express_coefficient, cities')
        .eq('active', true);
      return ((data as any[]) || []).sort((a, b) => a.default_rate_per_kg - b.default_rate_per_kg);
    },
    staleTime: 600_000,
  });
}

export default function TarifsPage() {
  useSeo({
    title: 'Tarifs Yobbanté — GP, aérien, maritime et routier depuis Dakar',
    description: 'Grilles tarifaires à jour : GP dès 4 200 FCFA/kg, fret aérien, maritime et routier Terminal D. Simulateur de prix inclus.',
    path: '/tarifs',
  });
  useJsonLd('jsonld-tarifs-faq', {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  });

  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('gp');
  const { data: gpRates = [], isLoading: gpLoading } = useGpRates();
  const { data: fretZones = [] } = useFretTarifZones();

  const nationalZones = useMemo(() => fretZones.filter(z => z.scope === 'national'), [fretZones]);
  const interZones = useMemo(() => fretZones.filter(z => z.scope === 'international'), [fretZones]);

  const cheapest = useMemo(() => {
    if (!gpRates.length) return null;
    return Math.round(gpRates[0].default_rate_per_kg * CLIENT_MARGIN);
  }, [gpRates]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav />

      <main className="flex-1 max-w-4xl w-full mx-auto px-5 sm:px-6 py-8 pb-32 md:pb-12 space-y-10">
        <header className="space-y-3">
          <div className="text-label">TARIFS</div>
          <h1 className="max-w-[520px]">Des prix clairs, mode par mode.</h1>
          <p className="text-[14px] max-w-[520px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Quatre façons d'envoyer, quatre grilles simples.
            {cheapest ? ` Le GP démarre à ${fmt(cheapest)} FCFA/kg.` : ''} Tous les prix sont
            indicatifs et confirmés après pesée — aucun frais caché.
          </p>
        </header>


        {/* Sélecteur de mode */}
        <section className="space-y-4">
          <h2>Nos grilles à jour</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {TABS.map(t => {
              const on = t.key === tab;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  aria-pressed={on}
                  className="rounded-[12px] px-3 py-3 text-left transition-colors"
                  style={{
                    background: on ? 'hsl(var(--foreground))' : 'hsl(var(--background-surface))',
                    color: on ? 'hsl(var(--background))' : 'hsl(var(--foreground))',
                    border: '0.5px solid hsl(var(--color-border-tertiary))',
                  }}
                >
                  <t.Icon className="w-4 h-4 mb-1.5" />
                  <div className="text-[13px] font-medium">{t.label}</div>
                  <div className="text-[11px] opacity-70">{t.sub}</div>
                </button>
              );
            })}
          </div>

          {tab === 'gp' && (
            <div className="space-y-3">
              <Note>
                GP = bagage accompagné. Un voyageur emporte votre colis : prix au kilo, délai court,
                idéal jusqu'à 25 kg. Prix Express = prix standard × 1,45 (départ prioritaire).
              </Note>
              <Table
                head={['Zone', 'Standard / kg', 'Express / kg']}
                cols="1.6fr 1fr 1fr"
                rows={
                  gpLoading
                    ? []
                    : gpRates.map(z => {
                        const std = Math.round(z.default_rate_per_kg * CLIENT_MARGIN);
                        const exp = Math.round(std * (z.express_coefficient ?? 1.45));
                        return {
                          key: z.zone_label,
                          cells: [
                            <span key="z">
                              <span className="text-foreground">{z.zone_label}</span>
                              {z.cities?.length ? (
                                <span className="block text-[11px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
                                  {z.cities.slice(0, 4).join(' · ')}
                                  {z.cities.length > 4 ? ` +${z.cities.length - 4}` : ''}
                                </span>
                              ) : null}
                            </span>,
                            <strong key="s" className="font-medium text-foreground">{fmt(std)} FCFA</strong>,
                            <span key="e" className="font-medium" style={{ color: '#F5C518' }}>{fmt(exp)} FCFA</span>,
                          ],
                        };
                      })
                }
                empty={gpLoading ? 'Chargement des tarifs…' : 'Tarifs en cours de mise à jour.'}
              />
              <Small>Poids minimum facturé : 1 kg. Collecte gratuite à Dakar centre.</Small>
            </div>
          )}

          {tab === 'air' && (
            <div className="space-y-3">
              <Note>
                Fret aérien classique : le prix baisse quand le poids augmente. On facture le poids
                taxable = le plus élevé entre le poids réel et le poids volumétrique (L×l×H / 6000).
              </Note>
              {AIR_ZONES.map(z => (
                <div
                  key={z.id}
                  className="rounded-[12px] p-4 space-y-2"
                  style={{ background: 'hsl(var(--background-surface))', border: '0.5px solid hsl(var(--color-border-tertiary))' }}
                >
                  <div className="text-[14px] font-medium">{z.label}</div>
                  <div className="text-[11px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{z.cities.join(' · ')}</div>
                  <div className="grid sm:grid-cols-3 gap-2 pt-1">
                    {z.brackets.map(b => (
                      <div key={b.from} className="rounded-[10px] px-3 py-2" style={{ background: 'hsl(var(--secondary))' }}>
                        <div className="text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                          {b.from === 0 ? `jusqu'à ${b.to} kg` : `${b.from} à ${b.to} kg`}
                        </div>
                        <div className="text-[14px] font-medium">{fmt(b.pricePerKg)} FCFA/kg</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <Small>{AIR_VOLUMETRIC_HINT} Au-delà de 300 kg : devis sur mesure.</Small>
            </div>
          )}

          {tab === 'sea' && (
            <div className="space-y-3">
              <Note>
                Maritime : groupage (LCL, vous payez au m³) ou conteneur complet (FCL). Le meilleur
                choix pour les volumes importants et le mobilier.
              </Note>
              <Table
                head={['Zone', 'Groupage / m³', 'Conteneur 20"', 'Délai']}
                cols="1.4fr 1fr 1fr 0.9fr"
                rows={SEA_ZONES.map(z => ({
                  key: z.id,
                  cells: [
                    <span key="z" className="text-foreground">{z.label}</span>,
                    <strong key="l" className="font-medium text-foreground">{fmt(z.lclPerM3)} FCFA</strong>,
                    <span key="f">{fmt(z.fcl['20'])} FCFA</span>,
                    <span key="d">{z.transitDays[0]}–{z.transitDays[1]} j</span>,
                  ],
                }))}
              />
              <Small>{SEA_WM_HINT} Conteneur 40" et taux du jour sur devis.</Small>
            </div>
          )}

          {tab === 'road' && (
            <div className="space-y-4">
              <Note>
                Terminal D — transport routier depuis Dakar. Enlèvement à votre adresse, départs
                quotidiens. Au Sénégal : prix fixe selon la taille du colis. Pays voisins : au kilo,
                minimum 3 kg facturés.
              </Note>
              <div className="grid sm:grid-cols-3 gap-2">
                {COLIS_SIZES.map(s => (
                  <div key={s.key} className="surface-card space-y-1">
                    <div className="text-[13px] font-medium">Colis {s.label} ({s.key})</div>
                    <div className="text-[12px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{s.weight} · {s.dims}</div>
                  </div>
                ))}
              </div>
              <Table
                head={['Zone Sénégal', 'Petit', 'Moyen', 'Grand']}
                cols="1.6fr 1fr 1fr 1fr"
                rows={nationalZones.map(z => ({
                  key: z.id,
                  cells: [
                    <span key="z">
                      <span className="text-foreground">{z.label}</span>
                      <span className="block text-[11px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
                        {z.destinations.join(' · ')}
                      </span>
                    </span>,
                    <span key="s" className="text-foreground">{fmt(z.price_s_fcfa ?? 0)} F</span>,
                    <span key="m" className="text-foreground">{fmt(z.price_m_fcfa ?? 0)} F</span>,
                    <span key="l" className="text-foreground">{fmt(z.price_l_fcfa ?? 0)} F</span>,
                  ],
                }))}
                empty="Chargement des zones…"
              />
              <Table
                head={['Pays voisins', 'Prix / kg', 'Min. facturé']}
                cols="1.6fr 1fr 1fr"
                rows={interZones.map(z => ({
                  key: z.id,
                  cells: [
                    <span key="z">
                      <span className="text-foreground">{z.label}</span>
                      <span className="block text-[11px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
                        {z.destinations.join(' · ')}
                      </span>
                    </span>,
                    <strong key="p" className="font-medium text-foreground">{fmt(z.price_per_kg_fcfa ?? 0)} FCFA</strong>,
                    <span key="m">{z.min_billable_kg ?? 3} kg</span>,
                  ],
                }))}
                empty="Chargement des zones…"
              />
              <button onClick={() => navigate('/terminal-d')} className="btn-cta">Réserver un enlèvement →</button>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2>Frais additionnels</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <FeeCard title="Frais de dossier" value="5 000 FCFA" sub="Par envoi · suivi et documents de base inclus" />
            <FeeCard title="Dédouanement" value="Sur devis" sub="Selon la valeur déclarée et le type de produit" />
            <FeeCard title="Assurance colis" value="Dès 1 500 FCFA" sub="Optionnelle · calculée sur la valeur déclarée" />
          </div>
        </section>

        <section className="space-y-4">
          <h2>Questions fréquentes</h2>
          <Accordion
            type="single"
            collapsible
            className="rounded-[12px] overflow-hidden"
            style={{ background: 'hsl(var(--background-surface))', border: '0.5px solid hsl(var(--color-border-tertiary))' }}
          >
            {FAQ.map((f, idx) => (
              <AccordionItem
                key={idx}
                value={`q-${idx}`}
                className="px-4"
                style={{ borderBottom: idx === FAQ.length - 1 ? 'none' : '0.5px solid hsl(var(--color-border-tertiary))' }}
              >
                <AccordionTrigger className="text-[14px] font-medium hover:no-underline py-4">{f.q}</AccordionTrigger>
                <AccordionContent
                  className="text-[13px] pt-3 pb-4"
                  style={{ color: 'hsl(var(--muted-foreground))', borderTop: '0.5px solid hsl(var(--color-border-tertiary))' }}
                >
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section
          className="rounded-[12px] p-4 flex flex-col sm:flex-row sm:items-center gap-3"
          style={{ background: 'hsl(var(--background-surface))', border: '0.5px solid hsl(var(--color-border-tertiary))' }}
        >
          <div className="flex-1">
            <div className="text-[14px] font-medium">Un cas particulier&nbsp;?</div>
            <div className="text-[12px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Volume important, marchandise spéciale, envoi régulier : on vous fait un prix.
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/departs')} className="btn-secondary whitespace-nowrap">Voir les départs</button>
            <button onClick={() => navigate('/demande-devis')} className="btn-cta whitespace-nowrap">Demander un devis →</button>
          </div>
        </section>
      </main>

      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-5 py-3"
        style={{ background: 'hsl(var(--background-primary))', borderTop: '0.5px solid hsl(var(--color-border-tertiary))' }}
      >
        <button onClick={() => navigate('/expedier')} className="btn-cta w-full">Créer un envoi →</button>
      </div>

      <div className="hidden md:block">
        <PublicFooter />
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[12px] p-3 text-[13px]"
      style={{ background: 'hsl(var(--secondary))', border: '0.5px solid hsl(var(--color-border-tertiary))', color: 'hsl(var(--muted-foreground))' }}
    >
      {children}
    </div>
  );
}

function Small({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{children}</p>;
}

function Table({
  head, cols, rows, empty,
}: {
  head: string[];
  cols: string;
  rows: { key: string; cells: React.ReactNode[] }[];
  empty?: string;
}) {
  return (
    <div
      className="rounded-[12px] overflow-hidden"
      style={{ background: 'hsl(var(--background-surface))', border: '0.5px solid hsl(var(--color-border-tertiary))' }}
    >
      <div
        className="grid px-4 py-2.5 text-label"
        style={{ gridTemplateColumns: cols, borderBottom: '0.5px solid hsl(var(--color-border-tertiary))' }}
      >
        {head.map(h => <span key={h}>{h}</span>)}
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-5 text-[13px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{empty}</div>
      ) : (
        rows.map((r, i) => (
          <div
            key={r.key}
            className="grid px-4 py-3 text-[13px] items-center gap-2"
            style={{
              gridTemplateColumns: cols,
              background: i % 2 === 0 ? 'transparent' : 'hsl(var(--secondary))',
              borderTop: i === 0 ? 'none' : '0.5px solid hsl(var(--color-border-tertiary))',
              color: 'hsl(var(--muted-foreground))',
            }}
          >
            {r.cells}
          </div>
        ))
      )}
    </div>
  );
}

function FeeCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="surface-card space-y-1.5">
      <div className="text-[14px] font-medium text-foreground">{title}</div>
      <div className="text-[15px] font-medium text-foreground">{value}</div>
      <div className="text-[12px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{sub}</div>
    </div>
  );
}

const FAQ = [
  { q: 'Quel mode choisir ?', a: "Jusqu'à 25 kg vers une ville desservie par un voyageur : le GP est le plus rapide et le moins cher. Au-delà, ou si aucun départ GP n'existe : l'aérien. Pour les gros volumes et le mobilier : le maritime. Pour le Sénégal et les pays voisins : le routier Terminal D." },
  { q: 'Comment sont calculés les tarifs ?', a: "Selon le poids (réel ou volumétrique pour l'aérien), la zone de destination et le type de marchandise. Le prix affiché est une estimation — le prix définitif est confirmé après pesée au relais." },
  { q: 'Y a-t-il des frais cachés ?', a: "Non. Transport, frais de dossier, douane estimée et assurance si vous la choisissez sont affichés avant confirmation. Rien ne s'ajoute sans votre accord." },
  { q: 'Quand est-ce que je paye ?', a: 'Particuliers : à la confirmation du dossier. Clients Business : facturation mensuelle consolidée.' },
  { q: 'Les prix sont-ils les mêmes pour tout le monde ?', a: 'Les particuliers bénéficient des tarifs affichés. Les clients Business bénéficient de -8 % (Starter) à -15 % (Business) sur tous les transports.' },
  { q: 'Que se passe-t-il si mon colis est plus lourd que déclaré ?', a: "Le poids est vérifié à réception. Au-delà de 10 % d'écart, une régularisation est appliquée — vous êtes notifié avant tout débit supplémentaire." },
];
