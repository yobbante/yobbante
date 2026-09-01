import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, MapPin, ShoppingBag, Factory, Inbox, ArrowRight } from 'lucide-react';
import {
  type QuoteInput, type ServiceMode, type TransportMode, type GoodsType,
  saveDraft,
} from '@/lib/quote';
import { CityPicker, type CityOption } from './CityPicker';
import { TransportModeSelector, type SendTransportMode } from './TransportModeSelector';
import { ALL_CITIES } from '@/lib/worldCities';
import { useCustomCities } from '@/hooks/useCustomCities';
import { useFretTarifs } from '@/hooks/useFretTarifs';
import { estimateTransport } from '@/lib/pricing';
import { lowestStartingPriceFcfa } from '@/lib/startingPrice';
import { ManualQuoteDialog } from '@/components/flows/ManualQuoteDialog';
import {
  AIR_CITIES, AIR_QUOTE_DISCLAIMER, AIR_VOLUMETRIC_HINT,
  estimateAirFreight, findAirZone, fmtFcfaAir,
} from '@/lib/airFreight';
import { SEA_CITIES } from '@/lib/seaFreight';

/** Modes ouverts au public — les 4 modes partagent désormais le même parcours. */
const PUBLIC_LIVE_MODES: SendTransportMode[] = ['gp', 'air', 'sea', 'road'];

/** Villes desservies en maritime (source unique : grille tarifaire seaFreight). */
const SEA_PORTS: { city: string; country: string; countryLabel: string }[] =
  SEA_CITIES.map(c => ({ city: c.city, country: '', countryLabel: c.zoneLabel }));



const SEND_PRESET_KEY = 'send-flow:preset';

function resolveCityToCountry(label: string, customs: { city: string; country: string; countryLabel: string }[] = []): { country: string; city: string } | null {
  if (!label) return null;
  if (label === 'Dakar, Sénégal' || label === 'Dakar') return { country: 'SN', city: 'Dakar' };
  const pool = [...ALL_CITIES, ...customs];
  const m = pool.find(c => label === `${c.city}, ${c.countryLabel}` || label === c.city);
  return m ? { country: m.country, city: m.city } : null;
}

const TYPES: { value: GoodsType; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'fragile', label: 'Fragile' },
  { value: 'electronique', label: 'Électronique' },
  { value: 'auto', label: 'Auto / Pièces' },
  { value: 'haute_valeur', label: 'Haute valeur' },
];

interface TabDef {
  key: ServiceMode;
  Icon: typeof Package;
  label: string;
  shortLabel: string;
  subtitle?: string;
}
const TABS: TabDef[] = [
  { key: 'send', Icon: Package, label: 'Envoyer un colis', shortLabel: 'Envoyer' },
  { key: 'reception', Icon: ShoppingBag, label: 'Relais D — acheter & recevoir', shortLabel: 'Relais D', subtitle: 'Amazon, AliExpress, sourcing Chine' },
];

/** Les 3 chemins Relais D, identiques à /relais-d — un seul point d'entrée. */
const RELAIS_D_PATHS: {
  id: 'shop' | 'sourcing' | 'recevoir';
  Icon: typeof Package;
  title: string;
  desc: string;
  hint: string;
  primary?: boolean;
}[] = [
  {
    id: 'shop', Icon: ShoppingBag, primary: true,
    title: 'Commander en ligne',
    desc: 'Amazon, AliExpress, Temu, Shein… on vérifie le prix réel et on achète pour vous.',
    hint: '10 sites intégrés · Devis sous 24h',
  },
  {
    id: 'sourcing', Icon: Factory,
    title: 'Sourcing D',
    desc: 'Photo + description + budget : on recherche le produit en Chine et on négocie.',
    hint: 'Short-list fournisseurs sous 24-48h',
  },
  {
    id: 'recevoir', Icon: Inbox,
    title: "J'ai déjà commandé",
    desc: 'Utilisez votre adresse relais Yobbanté : on réceptionne puis on livre à Dakar.',
    hint: 'Adresse relais USA · Chine · Europe · UAE',
  },
];


export function QuoteForm() {
  const navigate = useNavigate();
  const { cities: customCities } = useCustomCities();
  const [service, setService] = useState<ServiceMode>('send');

  // Shared — Dakar est toujours verrouillé sur une extrémité de la route.
  const DAKAR = 'Dakar, Sénégal';
  const [direction, setDirection] = useState<'from_dakar' | 'to_dakar'>('from_dakar');
  const [origin, setOrigin] = useState(DAKAR);
  const [destination, setDestination] = useState('');
  /**
   * Sélection fluide : plus de bouton « Inverser ».
   * Dakar reste toujours à une extrémité — dès qu'on choisit une autre ville,
   * l'autre champ bascule automatiquement sur Dakar.
   */
  const pickCity = (field: 'origin' | 'destination', v: string) => {
    if (v === DAKAR) {
      if (field === 'origin') {
        setDirection('from_dakar'); setOrigin(DAKAR);
        if (destination === DAKAR) setDestination('');
      } else {
        setDirection('to_dakar'); setDestination(DAKAR);
        if (origin === DAKAR) setOrigin('');
      }
      return;
    }
    if (field === 'origin') {
      setDirection('to_dakar'); setOrigin(v); setDestination(DAKAR);
    } else {
      setDirection('from_dakar'); setDestination(v); setOrigin(DAKAR);
    }
  };

  const [weight, setWeight] = useState('');
  const [mode, setMode] = useState<SendTransportMode>('gp');
  const [type, setType] = useState<GoodsType>('standard');
  const weightInputRef = useRef<HTMLInputElement>(null);

  // Dimensions (fret aérien / maritime) — poids volumétrique.
  const [airL, setAirL] = useState('');
  const [airW, setAirW] = useState('');
  const [airH, setAirH] = useState('');
  const [airQuoteOpen, setAirQuoteOpen] = useState(false);

  /** Ville hors Dakar de la route en cours. */
  const otherCityLabel = direction === 'from_dakar' ? destination : origin;
  const otherCity = (otherCityLabel || '').split(',')[0].trim();
  const routeLabelShort = direction === 'from_dakar' ? '🇸🇳 Dakar →' : '→ 🇸🇳 Dakar';

  const airEstimate = useMemo(
    () => estimateAirFreight({
      zone: findAirZone(otherCity),
      realKg: parseFloat(weight),
      lengthCm: parseFloat(airL),
      widthCm: parseFloat(airW),
      heightCm: parseFloat(airH),
    }),
    [otherCity, weight, airL, airW, airH],
  );

  // Villes desservies par mode — même sélecteur, catalogue différent.
  const { destinations: fretDestinations } = useFretTarifs();
  const modeOptions = useMemo<CityOption[] | undefined>(() => {
    if (mode === 'gp') return undefined; // catalogue mondial complet
    const dakar: CityOption = { id: 'SN-Dakar', city: 'Dakar', country: 'SN', countryLabel: 'Sénégal' };
    if (mode === 'air') {
      return [dakar, ...AIR_CITIES.map(c => ({
        id: `AIR-${c.city}`, city: c.city, country: '', countryLabel: c.zoneLabel,
      }))];
    }
    if (mode === 'sea') {
      return [dakar, ...SEA_PORTS.map(p => ({
        id: `SEA-${p.city}`, city: p.city, country: p.country, countryLabel: p.countryLabel,
      }))];
    }
    // road (Terminal D)
    return [dakar, ...fretDestinations.map(d => ({
      id: `ROAD-${d.id}`,
      city: d.name,
      country: d.country_code ?? 'SN',
      countryLabel: d.scope === 'national' ? 'Sénégal' : 'Pays voisins',
    }))];
  }, [mode, fretDestinations]);

  const modeCitiesHint = useMemo(() => {
    if (mode === 'gp') return 'Navettes GP · toutes destinations couvertes';
    if (mode === 'air') return `Aérien · ${AIR_CITIES.length} villes desservies`;
    if (mode === 'sea') return `Maritime · ${SEA_PORTS.length} ports desservis`;
    return `Routier · ${fretDestinations.length || '50+'} destinations Terminal D`;
  }, [mode, fretDestinations.length]);

  /** Routier = Terminal D : le flow continue sur la page dédiée. */
  const goTerminalD = () => {
    navigate(otherCity && otherCity !== 'Dakar' ? `/terminal-d?ville=${encodeURIComponent(otherCity)}` : '/terminal-d');
  };
  const handleModeChange = (m: SendTransportMode) => {
    setMode(m);
    // Réinitialise la ville hors Dakar : les villes desservies changent selon le mode.
    if (direction === 'from_dakar') setDestination('');
    else setOrigin('');
  };

  const estimateCard = useMemo(() => {
    const w = Number(weight);
    if (!origin || !destination) return null;
    if (mode === 'gp') {
      if (!w || w <= 0) return null;
      const o = resolveCityToCountry(origin, customCities);
      const d = resolveCityToCountry(destination, customCities);
      const starting = lowestStartingPriceFcfa(w, o?.country, d?.country);
      return {
        title: 'À partir de',
        value: `${starting.toLocaleString('fr-FR')} FCFA`,
        detail: `${o?.city ?? '—'} → ${d?.city ?? '—'} · ${w} kg · prix confirmé à l'étape suivante`,
      };
    }
    if (mode === 'air') {
      return {
        title: 'Estimation indicative',
        value: airEstimate.price != null ? fmtFcfaAir(airEstimate.price) : '—',
        detail: airEstimate.detail || AIR_QUOTE_DISCLAIMER,
      };
    }
    if (mode === 'sea') {
      return {
        title: 'Maritime',
        value: 'Devis sur mesure',
        detail: 'Groupage LCL · 18-25 jours · tarif confirmé par notre équipe.',
      };
    }
    return {
      title: 'Terminal D',
      value: 'Prix calculé à l’étape suivante',
      detail: `Dakar ↔ ${otherCity || '—'} · enlèvement à domicile inclus.`,
    };
  }, [mode, origin, destination, weight, customCities, airEstimate, otherCity]);


  // External trigger from the landing world map (or destination pills):
  // prefill the SEND tab with Dakar → <city> and focus the weight field.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { city?: string; countryLabel?: string }
        | undefined;
      if (!detail?.city || !detail?.countryLabel) return;
      setService('send');
      setDirection('from_dakar');
      setOrigin(DAKAR);
      setDestination(`${detail.city}, ${detail.countryLabel}`);
      setTimeout(() => weightInputRef.current?.focus(), 350);
    };
    window.addEventListener('yobbante:prefill-destination', handler as EventListener);
    return () => window.removeEventListener('yobbante:prefill-destination', handler as EventListener);
  }, []);

  /** Relais D — chaque chemin continue sur la page dédiée /relais-d/<mode>. */
  const goRelaisD = (path: 'shop' | 'sourcing' | 'recevoir') => navigate(`/relais-d/${path}`);

  const submit = () => {
    if (service === 'send') {
      if (!origin || !destination) return;
      // Routier = Terminal D : le parcours continue sur la page dédiée.
      if (mode === 'road') { goTerminalD(); return; }
      // Aérien / Maritime : même parcours, finalisé par une demande de devis.
      if (mode === 'air' || mode === 'sea') { setAirQuoteOpen(true); return; }
      if (!weight) return;

      // Hand off directly to /expedier/envoyer with the same preset
      // shape ExpedierSearchBar consumes, so the flow shows the price
      // section without a separate /devis detour.
      const o = resolveCityToCountry(origin, customCities);
      const d = resolveCityToCountry(destination, customCities);
      if (!o || !d) return;
      // GP (bagage accompagné) = ancien "AIR" côté moteur de prix.
      const transport: 'AIR' | 'SEA' = 'AIR';

      const preset = {
        origin: o.country, destination: d.country,
        origin_city: o.city, destination_city: d.city,
        transport, weight: Number(weight) || undefined,
        source: 'landing-quote-form',
      };
      try { sessionStorage.setItem(SEND_PRESET_KEY, JSON.stringify(preset)); } catch {}
      // Persist legacy draft too, for users who still navigate to /devis later.
      saveDraft({
        service, origin, destination,
        weightKg: Number(weight) || 0,
        mode: 'air' as TransportMode, type,
      });
      // Land on Étape 1 (Collecte) — the sticky bar resume bar will already
      // show the route/poids/mode chosen here. We don't want to skip ahead
      // to the pricing section before the user fills in collecte/destinataire.
      navigate('/expedier/envoyer');
      return;
    }
    // Relais D (sourcing / réception) : parcours dédié, pas de submit ici.
  };

  return (
    <div
      className="rounded-[12px] p-3 sm:p-5 max-w-[580px] w-full mx-auto overflow-hidden"
      style={{ background: 'hsl(var(--secondary))', border: '0.5px solid hsl(var(--color-border-tertiary))' }}
    >
      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1.5 mb-4">
        {TABS.map(t => {
          const active = service === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setService(t.key)}
              className="text-left transition-colors min-w-0"
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                background: active ? '#ffffff' : 'transparent',
                border: active
                  ? '1px solid hsl(var(--foreground))'
                  : '0.5px solid hsl(var(--color-border-tertiary))',
                boxShadow: active ? 'inset 0 0 0 1px rgba(0,0,0,0.08)' : 'none',
                color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                fontWeight: active ? 600 : 400,
              }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <t.Icon className="w-4 h-4 shrink-0" />
                <span className="text-[12px] sm:text-[13px] font-medium leading-tight truncate">
                  <span className="sm:hidden">{t.shortLabel}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                </span>
              </div>
              {t.subtitle && (
                <div
                  className="text-[10px] mt-0.5 leading-tight hidden sm:block truncate"
                  style={{ color: active ? 'hsl(var(--muted-foreground))' : 'hsl(var(--text-tertiary))' }}
                >
                  {t.subtitle}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1 — SEND : un seul et même parcours pour les 4 modes */}
      {service === 'send' && (
        <div className="space-y-3">
          <TransportModeSelector value={mode} onChange={handleModeChange} liveModes={PUBLIC_LIVE_MODES} />

          {/* Route — Dakar est automatiquement verrouillé sur une extrémité */}
          <div className="flex items-center gap-2 text-[11px]">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium"
              style={{ background: 'hsl(var(--background))', border: '0.5px solid hsl(var(--color-border-tertiary))', color: 'hsl(var(--foreground))' }}
            >
              <MapPin className="w-3 h-3" />
              {routeLabelShort}
            </span>
            <span className="text-muted-foreground truncate">{modeCitiesHint}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Field label="Origine *">
              <CityPicker
                value={origin}
                onChange={(v) => pickCity('origin', v)}
                options={modeOptions}
                placeholder="Choisir une ville d'origine…"
                ariaLabel="Choisir la ville d'origine"
                excludeCity={direction === 'to_dakar' ? 'Dakar' : undefined}
              />
            </Field>
            <Field label="Destination *">
              <CityPicker
                value={destination}
                onChange={(v) => pickCity('destination', v)}
                options={modeOptions}
                placeholder="Choisir une ville de destination…"
                ariaLabel="Choisir la ville de destination"
                excludeCity={direction === 'from_dakar' ? 'Dakar' : undefined}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Field label="Poids (kg) *">
              <input ref={weightInputRef} type="number" inputMode="decimal" className="input-base w-full" placeholder="ex: 5"
                value={weight} onChange={e => setWeight(e.target.value)} />
            </Field>
            <Field label="Type de colis">
              <select aria-label="Type de colis" className="input-base w-full" value={type} onChange={e => setType(e.target.value as GoodsType)}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
          </div>

          {/* Dimensions — utiles uniquement en fret aérien / maritime (poids volumétrique) */}
          {(mode === 'air' || mode === 'sea') && (
            <>
              <div className="grid grid-cols-3 gap-2.5">
                <Field label="Long. (cm)">
                  <input type="number" inputMode="decimal" className="input-base w-full" placeholder="40" value={airL} onChange={e => setAirL(e.target.value)} />
                </Field>
                <Field label="Larg. (cm)">
                  <input type="number" inputMode="decimal" className="input-base w-full" placeholder="30" value={airW} onChange={e => setAirW(e.target.value)} />
                </Field>
                <Field label="Haut. (cm)">
                  <input type="number" inputMode="decimal" className="input-base w-full" placeholder="30" value={airH} onChange={e => setAirH(e.target.value)} />
                </Field>
              </div>
              <p className="text-[10.5px] text-muted-foreground leading-snug">{AIR_VOLUMETRIC_HINT}</p>
            </>
          )}

          {/* Estimation — même encart pour tous les modes */}
          {estimateCard && (
            <div
              className="rounded-[10px] px-3 py-2.5"
              style={{ background: '#FFF8DC', border: '0.5px solid #F5C518' }}
            >
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                {estimateCard.title}
              </div>
              <div className="text-[15px] font-bold text-foreground leading-tight truncate">
                {estimateCard.value}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{estimateCard.detail}</div>
            </div>
          )}

          <SubmitBtn onClick={submit}>Obtenir mon prix →</SubmitBtn>
        </div>
      )}



      {/* TAB 2 — RELAIS D : les 3 chemins du point d'entrée unique */}
      {service === 'reception' && (
        <div className="space-y-2.5">
          <p className="text-[11.5px] text-muted-foreground leading-snug">
            Un seul service pour vos achats internationaux : on achète, on réceptionne, on livre à Dakar.
          </p>
          {RELAIS_D_PATHS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => goRelaisD(p.id)}
              className="w-full text-left rounded-[10px] p-3 transition-colors group"
              style={{
                background: p.primary ? 'hsl(var(--foreground))' : 'hsl(var(--background-surface))',
                border: p.primary
                  ? '0.5px solid hsl(var(--foreground))'
                  : '0.5px solid hsl(var(--color-border-tertiary))',
                color: p.primary ? 'hsl(var(--background))' : 'hsl(var(--foreground))',
              }}
            >
              <div className="flex items-start gap-2.5">
                <p.Icon className="w-4.5 h-4.5 shrink-0 mt-0.5" style={{ width: 18, height: 18 }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold leading-tight">{p.title}</div>
                  <div
                    className="text-[11.5px] leading-snug mt-1"
                    style={{ color: p.primary ? 'hsl(var(--background) / 0.7)' : 'hsl(var(--muted-foreground))' }}
                  >
                    {p.desc}
                  </div>
                  <div
                    className="text-[10px] uppercase tracking-wider font-semibold mt-1.5"
                    style={{ color: p.primary ? 'hsl(var(--background) / 0.6)' : 'hsl(var(--text-tertiary))' }}
                  >
                    {p.hint}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
          <p className="text-[10.5px] text-muted-foreground text-center pt-0.5">
            Sans engagement · L'achat n'est déclenché qu'après validation de votre devis
          </p>
        </div>
      )}

      <ManualQuoteDialog
        open={airQuoteOpen}
        onOpenChange={setAirQuoteOpen}
        prefill={{
          origin_city: (origin || '—').split(',')[0].trim(),
          origin_country: direction === 'from_dakar' ? 'SN' : null,
          destination_city: (destination || '—').split(',')[0].trim(),
          destination_country: direction === 'to_dakar' ? 'SN' : null,
          weight_kg: Number(weight) || 0,
          transport_mode: mode === 'sea' ? 'sea' : 'air',
          description: [
            mode === 'air' && airEstimate.taxableKg != null && `Poids taxable ${airEstimate.taxableKg} kg`,
            (airL || airW || airH) && `Dimensions ${airL || '?'}×${airW || '?'}×${airH || '?'} cm`,
            mode === 'air' && airEstimate.price != null && `Estimation indicative ${fmtFcfaAir(airEstimate.price)}`,
          ].filter(Boolean).join(' · ') || null,
        }}

      />
    </div>

  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-label block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function SubmitBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="btn-cta w-full" style={{ padding: '11px 20px', fontSize: 14 }}>
      {children}
    </button>
  );
}
