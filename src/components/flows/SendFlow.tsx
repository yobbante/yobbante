import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Package, FileText, Boxes, Zap, Sparkles, ShieldCheck, MapPin, Phone, User,
  Search, Building2, Truck, Plane, Ship, Calendar as CalendarIcon, AlertTriangle,
  CheckCircle2, MessageCircle, Smartphone, CreditCard, ArrowRight, Globe2, Clock, Banknote,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  FlowShell, FlowHero, FlowSection, ChipGroup, CitySelector, NumberSlider,
  TextField, MatchOptionCard, LiveSummaryBar, FlowSuccess,
  type MatchOptionView,
} from './FlowPrimitives';
import { useMatchOptions } from './useMatchOptions';
import { ManualQuoteDialog } from './ManualQuoteDialog';
import { useQuote } from '@/hooks/useQuote';
import { useDossiers } from '@/hooks/useDossiers';
import { useShipments } from '@/hooks/useShipments';
import { useFlowDraft, clearDraft, saveDraft } from '@/hooks/useFlowDraft';
import { useCoverageZone } from '@/hooks/useCoverageZone';
import { checkDoorToDoor, INCLUDED_PERKS } from '@/lib/doorToDoor';
import { formatFcfa } from '@/lib/yobbantePricing';
import { ratePerKgForCorridor } from '@/lib/startingPrice';
import { calculatePricing, fcfaToEur, assertPriceCoherence, type PricingOutput } from '@/lib/pricingEngine';
import { getDeliveryDelay } from '@/lib/deliveryDelays';
import { calculerFraisEnlevement, QUARTIER_GROUPS, type DakarZoneCategory } from '@/lib/dakarZones';

import { getDepartureCountdown, formatDepartureDate } from '@/lib/departureTime';
import { DoorToDoorBanner } from '@/components/flows/DoorToDoorBanner';
import { NextDepartureNotice } from '@/components/flows/NextDepartureNotice';
import { AuthInterstitialModal } from '@/components/flows/AuthInterstitialModal';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { ORIGIN_CITIES, DESTINATION_CITIES, findCity, POPULAR_ORIGIN_IDS, POPULAR_DEST_IDS, HUB_DAKAR } from '@/lib/worldCities';
import { DakarHubLock } from './FlowPrimitives';
import { COUNTRY_OPTIONS, getProfile, formatLocalAmount, eurFromLocal, type CountryProfile } from '@/lib/countryProfile';
import { cn } from '@/lib/utils';
import type { WarehouseCountry } from '@/lib/types';


// ─────────────────────────── Static config ───────────────────────────

type SenderKind = 'individual' | 'business';

const TIME_SLOTS = [
  { id: 'morning'   as const, label: 'Matin · 8h-12h',     desc: 'Récupération matinale' },
  { id: 'afternoon' as const, label: 'Après-midi · 13h-18h', desc: 'Récupération après-midi' },
];

const GOODS_TYPES = [
  { id: 'standard'    as const, label: 'Standard',         desc: 'Articles courants',                    risk: 'low'    },
  { id: 'electronics' as const, label: 'Électronique',     desc: 'Téléphone, ordinateur, accessoires',   risk: 'medium' },
  { id: 'fragile'     as const, label: 'Fragile',          desc: 'Emballage renforcé recommandé',        risk: 'medium' },
  { id: 'fashion'     as const, label: 'Textile / Mode',   desc: 'Déclaration valeur obligatoire',       risk: 'low'    },
  { id: 'cosmetics'   as const, label: 'Cosmétiques',      desc: 'Vérification douanière requise',       risk: 'high'   },
  { id: 'food'        as const, label: 'Alimentation',     desc: 'Restrictions selon corridor',          risk: 'high'   },
  { id: 'high_value'  as const, label: 'Forte valeur',     desc: 'Assurance obligatoire dès 500 €',      risk: 'high'   },
  { id: 'documents'   as const, label: 'Documents',        desc: 'Traitement prioritaire possible',      risk: 'low'    },
  { id: 'auto_parts'  as const, label: 'Pièces auto',      desc: 'Maritime recommandé',                  risk: 'medium' },
];
type GoodsId = typeof GOODS_TYPES[number]['id'];

const TRANSPORT_MODES = [
  { id: 'AIR'  as const, label: 'Aérien',   eta: '3-7 jours',    icon: <Plane className="w-4 h-4" /> },
  { id: 'SEA'  as const, label: 'Maritime', eta: '18-25 jours',  icon: <Ship  className="w-4 h-4" /> },
  { id: 'ROAD' as const, label: 'Routier',  eta: '7-14 jours',   icon: <Truck className="w-4 h-4" /> },
];

const PRIORITIES = [
  { id: 'normal'  as const, label: 'Standard', desc: 'Inclus · Traitement 3-5j' },
  { id: 'express' as const, label: 'Express',  desc: '+4 000 FCFA · Traitement sous 24h' },
];

const PAYMENT_METHODS = [
  { id: 'wave',          label: 'Wave',          sub: 'Instantané',        icon: <Smartphone className="w-4 h-4" /> },
  { id: 'orange_money',  label: 'Orange Money',  sub: 'Instantané',        icon: <Smartphone className="w-4 h-4" /> },
  { id: 'cash',          label: 'Espèces',       sub: 'À la collecte',     icon: <Banknote   className="w-4 h-4" /> },
];

const OPTION_ICONS = {
  fast:    <Zap   className="w-4 h-4" />,
  economy: <Clock className="w-4 h-4" />,
  volume:  <Boxes className="w-4 h-4" />,
} as const;

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

// Sensitive corridor combinations → trigger contextual warning.
function corridorRisk(goods: GoodsId | null, originCountry?: string, destCountry?: string): string | null {
  if (!goods || !originCountry || !destCountry) return null;
  if (goods === 'cosmetics') return `Les cosmétiques vers ${destCountry} nécessitent une déclaration spécifique. Notre équipe vous contacte sous 2 h pour confirmer.`;
  if (goods === 'food')      return `L'alimentaire vers ${destCountry} est soumis à des restrictions. Vérification opérée avant collecte.`;
  if (goods === 'high_value') return `Forte valeur — assurance obligatoire et signature à la livraison.`;
  return null;
}

// ─────────────────────────── Main component ───────────────────────────

export function SendFlow({ compactHeader }: { compactHeader?: React.ReactNode } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { createDossier } = useDossiers();
  const { createShipment } = useShipments();

  // ── Preset (from departures ticker, restored after auth round-trip)
  const PRESET_KEY = 'send-flow:preset';
  const navPreset = (location.state as {
    preset?: {
      origin?: string; destination?: string;
      origin_city?: string; destination_city?: string;
      transport?: 'AIR' | 'SEA' | 'ROAD';
      departure_date?: string; weight?: number;
      source?: string;
    };
  } | null)?.preset;
  const restoredPreset = useMemo(() => {
    if (navPreset) return navPreset;
    try { const raw = sessionStorage.getItem(PRESET_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }, [navPreset]);
  const preset = restoredPreset ?? undefined;
  useEffect(() => {
    if (navPreset) { try { sessionStorage.setItem(PRESET_KEY, JSON.stringify(navPreset)); } catch {} }
  }, [navPreset]);

  // Match preset cities to known catalog cities for prefill.
  const presetOriginCityId = useMemo(() => {
    if (!preset?.origin) return null;
    if (preset.origin_city) {
      const m = ORIGIN_CITIES.find(c => c.country === preset.origin && c.city.toLowerCase() === preset.origin_city!.toLowerCase());
      if (m) return m.id;
    }
    return ORIGIN_CITIES.find(c => c.country === preset.origin)?.id ?? null;
  }, [preset?.origin, preset?.origin_city]);
  const presetDestCityId = useMemo(() => {
    if (!preset?.destination) return null;
    if (preset.destination_city) {
      const m = DESTINATION_CITIES.find(c => c.country === preset.destination && c.city.toLowerCase() === preset.destination_city!.toLowerCase());
      if (m) return m.id;
    }
    return DESTINATION_CITIES.find(c => c.country === preset.destination)?.id ?? null;
  }, [preset?.destination, preset?.destination_city]);

  // ── Form state (10 steps) ────────────────────────────────────────
  // Step 1 — sender profile + direction
  const [senderKind, setSenderKind]       = useState<SenderKind>('individual');
  // Direction: 'from_dakar' = Dakar → ville étrangère ; 'to_dakar' = ville étrangère → Dakar.
  // Détection initiale via preset (rétrocompat) : si preset.origin === 'SN' → from_dakar, sinon to_dakar.
  const [direction, setDirection] = useState<'from_dakar' | 'to_dakar'>(
    preset?.origin === 'SN' ? 'from_dakar' : 'to_dakar'
  );
  const [originCountry, setOriginCountry] = useState<string>(preset?.origin ?? 'SN');
  // Step 2 — pickup
  const [originCityId, setOriginCity]     = useState<string | null>(presetOriginCityId);
  const [pickupAddress, setPickup]        = useState('');
  const [pickupQuartier, setPickupQuartier] = useState<string>('');
  const [pickupDate, setPickupDate]       = useState<string>(preset?.departure_date ?? '');
  const [pickupSlot, setPickupSlot]       = useState<typeof TIME_SLOTS[number]['id'] | null>(null);
  // Step 3 — destination
  const [destCityId, setDestCity]         = useState<string | null>(presetDestCityId);
  // Step 4 — recipient
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [deliveryAddress, setDelivery]    = useState('');
  // Mode de reception finale
  const [deliveryMode, setDeliveryMode]   = useState<'pickup_gp' | 'relay_point' | 'home_delivery'>('pickup_gp');
  const [relayPointId, setRelayPointId]   = useState<string>('');
  const [relayPointName, setRelayPointName] = useState('');
  const [relayPointAddress, setRelayPointAddress] = useState('');
  const [deliveryCarrier, setDeliveryCarrier] = useState<string>('');
  // Liste des points relais actifs (chargée depuis Supabase)
  const [activeRelayPoints, setActiveRelayPoints] = useState<Array<{ id: string; name: string; quartier: string; address: string }>>([]);
  // Step 5 — package description
  const [description, setDescription]     = useState('');
  const [declaredLocal, setDeclaredLocal] = useState('');
  const [weight, setWeight]               = useState(preset?.weight ?? 5);
  const [weightTouched, setWeightTouched] = useState<boolean>(!!preset?.weight);
  const [parcelCount, setParcelCount]     = useState(1);
  // Step 3 bis — dimensions (obligatoires en SEA/ROAD pour CBM + poids volumétrique)
  const [lengthCm, setLengthCm]   = useState<string>('');
  const [widthCm, setWidthCm]     = useState<string>('');
  const [heightCm, setHeightCm]   = useState<string>('');
  // Nature exacte de la marchandise (douane) — utilisée en SEA
  const [natureDouane, setNatureDouane] = useState<string>('');
  // Step 6 — goods type
  const [goodsType, setGoodsType]         = useState<GoodsId | null>(null);
  const [isGift, setIsGift]               = useState<boolean>(false);

  // Forfait produit (optionnel) — remplace le calcul au poids quand sélectionné.
  const [forfaitId, setForfaitId]   = useState<string | null>(null);
  const [forfaitQty, setForfaitQty] = useState<number>(1);
  const [forfaits, setForfaits]     = useState<Array<{
    id: string; nom: string; description: string | null;
    destination: string; mode: string; prix_fcfa: number;
  }>>([]);
  // (analyse IA de la description retirée — sélection manuelle du type)
  // Step 7 — transport
  const [transportMode, setTransportMode] = useState<typeof TRANSPORT_MODES[number]['id']>(preset?.transport ?? 'AIR');
  const [priority, setPriority]           = useState<typeof PRIORITIES[number]['id']>('normal');
  // Step 8 — insurance (jamais pré-sélectionnée)
  const [insurance, setInsurance]         = useState<'none' | 'standard' | 'premium'>('none');
  // Step 9 — payment (Wave par défaut)
  const [paymentMethod, setPaymentMethod] = useState<string>('wave');
  // Modale interstitielle d'authentification (pas de redirect brutal vers /auth)
  const [authModalOpen, setAuthModalOpen] = useState(false);
  // Sender contact
  const [senderName, setSenderName]       = useState('');
  const [senderPhone, setSenderPhone]     = useState('');
  // Récap par email (optionnel)
  const [wantRecapEmail, setWantRecapEmail] = useState(false);
  const [recapEmail, setRecapEmail]         = useState('');
  // Identité de la personne qui remplit le formulaire
  // 'sender' = je suis dans la ville d'origine (j'expédie)
  // 'recipient' = je suis dans la ville de destination (je recevrai)
  // 'third'  = je remplis pour quelqu'un d'autre
  const [userRole, setUserRole] = useState<'sender' | 'recipient' | 'third'>('sender');
  const [identityCollapsed, setIdentityCollapsed] = useState(false);
  // Tracks which step is currently being edited (null = use collapsed summaries when complete)
  const [editingStep, setEditingStep] = useState<number | null>(null);
  // Sequential step gating — only the current step is expanded; past steps
  // collapse to a summary, future steps show a locked placeholder.
  const [currentStep, setCurrentStep] = useState<number>(1);
  // Match + submit
  const [chosen, setChosen]               = useState<MatchOptionView | null>(null);
  const [submitting, setSubmitting]       = useState(false);
  const [confirmed, setConfirmed]         = useState<{ reference: string; trackingId: string; price: number; eta: string; dossierId?: string; arrivalDate?: string } | null>(null);
  const [manualQuoteOpen, setManualQuoteOpen] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // ── Role-aware identity binding ────────────────────────────────
  // The identity block writes to the slot corresponding to the user's role:
  //   - sender    → senderName / senderPhone
  //   - recipient → recipientName / recipientPhone (Step 2 then collapses)
  //   - third     → senderName / senderPhone (intermediary acts as the sender contact)
  const isRecipientRole = userRole === 'recipient';
  const identityName  = isRecipientRole ? recipientName  : senderName;
  const identityPhone = isRecipientRole ? recipientPhone : senderPhone;
  const setIdentityName  = (v: string) => (isRecipientRole ? setRecipientName(v)  : setSenderName(v));
  const setIdentityPhone = (v: string) => (isRecipientRole ? setRecipientPhone(v) : setSenderPhone(v));


  // ── Derived ──────────────────────────────────────────────────────
  // Direction enforces Dakar as the locked endpoint:
  //  - from_dakar → origin = Dakar (locked), destination = chosen city
  //  - to_dakar   → origin = chosen city, destination = Dakar (locked)
  const foreignCity = direction === 'from_dakar'
    ? findCity(DESTINATION_CITIES, destCityId)
    : findCity(ORIGIN_CITIES, originCityId);
  const originCity = direction === 'from_dakar' ? HUB_DAKAR : foreignCity;
  const destCity   = direction === 'from_dakar' ? foreignCity : HUB_DAKAR;
  const originProfile = useMemo<CountryProfile>(() => getProfile(originCity?.country ?? 'SN'), [originCity?.country]);
  const destProfile   = useMemo<CountryProfile>(() => getProfile(destCity?.country), [destCity?.country]);

  // Garde originCountry en sync avec la ville sélectionnée (utilisé par certaines mutations / drafts).
  useEffect(() => {
    if (originCity?.country && originCity.country !== originCountry) setOriginCountry(originCity.country);
  }, [originCity?.country]);

  const coverage = useCoverageZone({ country: originCity?.country ?? 'SN', city: originCity?.city });
  const destCoverage = useCoverageZone({ country: destCity?.country, city: destCity?.city });
  const originCoverageCheck = useMemo(
    () => checkDoorToDoor(coverage.level, coverage.loading, originCity?.city),
    [coverage.level, coverage.loading, originCity?.city],
  );
  const destCoverageCheck = useMemo(
    () => checkDoorToDoor(destCoverage.level, destCoverage.loading, destCity?.city),
    [destCoverage.level, destCoverage.loading, destCity?.city],
  );

  const localCalendarMin = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() + (coverage.minLeadHours || 24));
    return d.toISOString().slice(0, 10);
  }, [coverage.minLeadHours]);

  // Senegal heuristic: phone is the primary contact, address can be loose
  const destIsSenegal = destCity?.country === 'SN';
  // Dakar = seule destination ou point relais et livraison à domicile sont disponibles
  const destIsDakar = destIsSenegal && (destCity?.city?.toLowerCase() === 'dakar');

  // Charger les points relais actifs (uniquement quand destination Dakar)
  useEffect(() => {
    if (!destIsDakar) { setActiveRelayPoints([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('relay_points')
        .select('id, name, quartier, address')
        .eq('is_active', true)
        .order('quartier', { ascending: true });
      if (!cancelled) setActiveRelayPoints((data ?? []) as any);
    })();
    return () => { cancelled = true; };
  }, [destIsDakar]);

  // Si destination change et n'est plus Dakar, forcer pickup_gp
  useEffect(() => {
    if (!destIsDakar && deliveryMode !== 'pickup_gp') {
      setDeliveryMode('pickup_gp');
      setRelayPointId('');
    }
  }, [destIsDakar, deliveryMode]);

  // ── Persist draft for auth round-trip
  const DRAFT_KEY = 'send-flow';
  const draftSnapshot = {
    // ⚠️ senderKind volontairement exclu : à chaque nouvel envoi l'utilisateur
    // doit refaire ce choix explicitement (peut varier d'un colis à l'autre).
    direction, originCountry, originCityId, pickupAddress, pickupDate, pickupSlot,
    destCityId, recipientName, recipientPhone, recipientEmail, deliveryAddress,
    description, declaredLocal, weight, parcelCount, goodsType,
    transportMode, priority, insurance, paymentMethod,
    senderName, senderPhone, chosenId: chosen?.id ?? null,
  };
  useFlowDraft(DRAFT_KEY, draftSnapshot, (d) => {
    // ⚠️ On ne restaure PAS les villes (originCityId / destCityId) ni la
    // direction depuis un ancien draft. Les villes doivent toujours venir
    // du choix utilisateur dans la barre de recherche (preset), sinon un
    // ancien envoi laisse une ville (ex. "Casablanca") coller à toutes les sessions.
    if (d.pickupAddress) setPickup(d.pickupAddress);
    if (d.pickupDate) setPickupDate(d.pickupDate);
    if (d.pickupSlot) setPickupSlot(d.pickupSlot);
    if (d.recipientName) setRecipientName(d.recipientName);
    if (d.recipientPhone) setRecipientPhone(d.recipientPhone);
    if (d.recipientEmail) setRecipientEmail(d.recipientEmail);
    if (d.deliveryAddress) setDelivery(d.deliveryAddress);
    if (d.description) setDescription(d.description);
    if (d.declaredLocal) setDeclaredLocal(d.declaredLocal);
    if (typeof d.weight === 'number') { setWeight(d.weight); setWeightTouched(true); }
    if (typeof d.parcelCount === 'number') setParcelCount(d.parcelCount);
    if (d.goodsType) setGoodsType(d.goodsType);
    if (d.transportMode) setTransportMode(d.transportMode);
    if (d.priority) setPriority(d.priority);
    if (d.insurance) setInsurance(d.insurance);
    if (d.paymentMethod) setPaymentMethod(d.paymentMethod);
    if (d.senderName) setSenderName(d.senderName);
    if (d.senderPhone) setSenderPhone(d.senderPhone);
  });

  // ── Resume snapshot (full state stored before /auth round-trip).
  // Unlike the regular draft, this includes cities + direction so the user
  // lands on the exact same quote without re-picking anything.
  const RESUME_KEY = 'send-flow:resume';
  // CORRECTION #1 — quand on revient de /auth après login Google/Apple, on
  // hydrate l'état complet ET on relance automatiquement submit() une fois
  // que tous les champs sont à nouveau valides. Plus de "retour au step 1".
  const autoSubmitRef = useRef(false);
  // Restore once on mount when ?resume=1 is present in the URL.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('resume') !== '1') return;
    try {
      const raw = sessionStorage.getItem(RESUME_KEY);
      if (raw) {
        const r = JSON.parse(raw);
        if (r.direction) setDirection(r.direction);
        if (r.originCountry) setOriginCountry(r.originCountry);
        if (r.originCityId) setOriginCity(r.originCityId);
        if (r.destCityId) setDestCity(r.destCityId);
      }
    } catch {}
    // Marqueur pour auto-submit dès que la session + le formulaire sont prêts.
    autoSubmitRef.current = true;
    // Scroll to the sticky CTA so the user just confirms — they don't
    // need to scroll up and re-check anything.
    const t = window.setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 600);
    // Strip ?resume=1 so a manual reload doesn't keep re-triggering.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('resume');
      window.history.replaceState({}, '', url.toString());
    } catch {}
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to top whenever the confirmation screen appears, so users see
  // the « Commande confirmée ! » banner first.
  useEffect(() => {
    if (!confirmed) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [confirmed]);


  // Dakar est toujours une extrémité grâce au verrou de direction.
  const dakarRouteOk = true;

  // Match options reveal once weight is confirmed
  const matchInput = useMemo(() => {
    if (!originCity || !destCity || !weight || !weightTouched) return null;
    return {
      origin_city: originCity.city, destination_city: destCity.city,
      origin_country: originCity.country, destination_country: destCity.country,
      weight_kg: weight, urgency: priority === 'express' ? 'fast' as const : 'normal' as const,
    };
  }, [originCity, destCity, weight, weightTouched, priority]);
  const { options, next_departure_in_days, next_departure_date, loading: matching } = useMatchOptions(matchInput);

  // Standard quote (priority=standard) — toujours demandée
  const quoteInputStandard = useMemo(() => {
    if (!originCity || !destCity || !weight) return null;
    const transport: 'AIR' | 'SEA' | 'ROAD' = transportMode;
    return {
      origin_country: originCity.country, destination_country: destCity.country,
      weight_kg: weight, transport_type: transport,
      priority: 'standard' as const,
      origin_city: originCity.city, destination_city: destCity.city,
    };
  }, [originCity, destCity, weight, transportMode]);
  const { quote: quoteStandard } = useQuote(quoteInputStandard);

  // Express quote (priority=express) — moteur applique urgency_mult=1.35
  const quoteInputExpress = useMemo(() => {
    if (!quoteInputStandard) return null;
    return { ...quoteInputStandard, priority: 'express' as const };
  }, [quoteInputStandard]);
  const { quote: quoteExpress } = useQuote(quoteInputExpress);

  // Quote actif selon priorité choisie
  const quote = priority === 'express' ? quoteExpress : quoteStandard;

  useEffect(() => {
    if (!chosen && options.length > 0) {
      const reco = options.find(o => o.id === 'economy') ?? options[0];
      setChosen(reco);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length]);

  // Listen to sticky search bar updates — when the user changes route /
  // poids / mode in the top bar, we hot-patch the preset fields WITHOUT
  // resetting the steps already filled in below.
  useEffect(() => {
    function refreshFromStorage() {
      try {
        const raw = sessionStorage.getItem(PRESET_KEY);
        if (!raw) return;
        const p = JSON.parse(raw) as {
          origin?: string; destination?: string;
          origin_city?: string; destination_city?: string;
          transport?: 'AIR' | 'SEA' | 'ROAD'; weight?: number;
        };
        // Enforce: Dakar must always be one of the two endpoints.
        const dakarSide: 'origin' | 'destination' | null =
          p.origin === 'SN' ? 'origin' : p.destination === 'SN' ? 'destination' : null;
        if (!dakarSide) {
          toast.message('Yobbanté opère depuis Dakar.', {
            description: "L'origine a été ajustée à Dakar.",
          });
        }
        const newDirection: 'from_dakar' | 'to_dakar' = dakarSide === 'destination' ? 'to_dakar' : 'from_dakar';
        setDirection(newDirection);
        if (p.origin) setOriginCountry(p.origin);
        const newOriginCityId = (() => {
          if (!p.origin || !p.origin_city) return null;
          const m = ORIGIN_CITIES.find(c => c.country === p.origin && c.city.toLowerCase() === p.origin_city!.toLowerCase());
          return m?.id ?? ORIGIN_CITIES.find(c => c.country === p.origin)?.id ?? null;
        })();
        const newDestCityId = (() => {
          if (!p.destination || !p.destination_city) return null;
          const m = DESTINATION_CITIES.find(c => c.country === p.destination && c.city.toLowerCase() === p.destination_city!.toLowerCase());
          return m?.id ?? DESTINATION_CITIES.find(c => c.country === p.destination)?.id ?? null;
        })();
        if (newOriginCityId) setOriginCity(newOriginCityId);
        if (newDestCityId) setDestCity(newDestCityId);
        if (p.transport) setTransportMode(p.transport);
        if (typeof p.weight === 'number') { setWeight(p.weight); setWeightTouched(true); }
      } catch {}
    }
    window.addEventListener('send-preset-updated', refreshFromStorage);
    return () => window.removeEventListener('send-preset-updated', refreshFromStorage);
  }, []);

  // ── Pricing breakdown (in EUR for internal math)
  // Le moteur gère TOUT (zone, poids, urgency, supply, marge) → pas de majoration locale.
  const rawTransportEur = quote ? Math.round(quote.price_eur) : chosen ? Math.round(chosen.price_eur) : 0;
  // Volatilité ±3 % appliquée UNIQUEMENT quand aucun GP n'est assigné (chosen=null).
  // Coefficient stable pour la session (useMemo sans deps) — tracé en BDD à la création.
  const priceVolatilityCoeff = useMemo(() => Math.random() * 0.06 + 0.97, []);
  const transportPriceEur = chosen
    ? rawTransportEur
    : Math.round(rawTransportEur * priceVolatilityCoeff);
  // Coût d'assurance basé sur la valeur déclarée (en FCFA) :
  //  - Standard : 0,5 % avec minimum 500 FCFA
  //  - Premium  : 1 %   avec minimum 1 000 FCFA
  const declaredFcfaForInsurance = Math.max(0, Math.round(((declaredLocal ? eurFromLocal(Number(declaredLocal) || 0, originProfile) : 0)) * 655));
  const insuranceCostFcfa = insurance === 'standard'
    ? Math.max(Math.round(declaredFcfaForInsurance * 0.005), 500)
    : insurance === 'premium'
      ? Math.max(Math.round(declaredFcfaForInsurance * 0.01), 1000)
      : 0;
  const insuranceCostEur = Math.round(insuranceCostFcfa / 655);
  const priorityCostEur  = 0; // déprécié — urgency_mult appliqué côté moteur

  // ── Surcoût enlèvement / livraison à Dakar (zone-based, only when one side is Dakar)
  const isFromDakar = direction === 'from_dakar';
  const dakarAddress = isFromDakar
    ? (pickupQuartier || pickupAddress)
    : (pickupQuartier || deliveryAddress); // to_dakar : livraison à Dakar
  const fraisEnlevement = (isFromDakar ? pickupAddress.trim() || pickupQuartier
                                       : deliveryAddress.trim() || pickupQuartier)
    ? calculerFraisEnlevement(dakarAddress)
    : { montant: 5000, surcharge: 0, gratuit: true, zone: 'dakar_centre' as DakarZoneCategory, message: '' };
  // Surcharge en EUR (655 FCFA / €)
  const surchargeEur = Math.round(fraisEnlevement.surcharge / 655);

  // ── Forfaits produits — fetch les forfaits actifs correspondant à destination+mode.
  useEffect(() => {
    const destCountry = destCity?.country;
    if (!destCountry) { setForfaits([]); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('product_forfaits' as never)
        .select('id, nom, description, destination, mode, prix_fcfa')
        .eq('actif', true)
        .in('destination', [destCountry, 'ALL'])
        .in('mode', [transportMode, 'ALL']);
      if (cancelled || error) return;
      setForfaits((data as unknown as typeof forfaits) || []);
    })();
    return () => { cancelled = true; };
  }, [destCity?.country, transportMode]);

  // Reset forfait si plus dispo
  const selectedForfait = useMemo(
    () => forfaits.find(f => f.id === forfaitId) ?? null,
    [forfaits, forfaitId],
  );
  useEffect(() => {
    if (forfaitId && !forfaits.find(f => f.id === forfaitId)) setForfaitId(null);
  }, [forfaits, forfaitId]);

  // Coefficient marchandise (pour calculer le tarif synthétique)
  const _goodsCoef = (() => {
    // MARCHANDISE_COEF importé indirectement via getMarchandiseCoef — calcule à part.
    const map: Record<string, number> = {
      standard: 1, electronics: 1.08, fragile: 1.10, fashion: 1.02,
      cosmetics: 1.02, food: 0.98, high_value: 1.12, documents: 0.95, auto_parts: 1.07,
    };
    return goodsType ? (map[goodsType] ?? 1) : 1;
  })();

  // ── SOURCE UNIQUE DE VÉRITÉ — pricing engine v3 (FCFA).
  // Si un forfait produit est sélectionné, on injecte un tarif/kg synthétique :
  //   fret_cible = prix_fcfa × qty × MARGE(1.20)
  //   et fret_moteur = w × rate × 1.20 × coef  → rate = (prix_fcfa × qty) / (w × coef)
  // Toutes les autres lignes (billet, agence, dossier, tva) sont calculées normalement.
  const effectiveTarifGP = useMemo(() => {
    if (selectedForfait) {
      const w = Math.max(0.5, weight);
      const qty = Math.max(1, forfaitQty);
      return Math.max(1, (selectedForfait.prix_fcfa * qty) / (w * _goodsCoef));
    }
    return ratePerKgForCorridor(originCity?.country, destCity?.country);
  }, [selectedForfait, forfaitQty, weight, _goodsCoef, originCity?.country, destCity?.country]);

  const pricing: PricingOutput = useMemo(() => calculatePricing({
    tarifGPFcfa: effectiveTarifGP,
    weightKg: weight,
    marchandise: goodsType,
    enlevementFcfa: fraisEnlevement.surcharge,
    assuranceFcfa: insuranceCostFcfa,
    transportMode: transportMode,
  }, priority === 'express' ? 'express' : 'standard'),
    [effectiveTarifGP, weight, goodsType, fraisEnlevement.surcharge, insuranceCostFcfa, priority, transportMode]);

  const toEurFcfa = (fcfa: number) => fcfaToEur(fcfa);
  const totalEur = toEurFcfa(pricing.total_ttc);

  // ── DEV : garde-fou anti-divergence. Recalcule la pricing engine côté
  // affichage et compare au TTC mémoïsé. Bloque silencieusement (warn) si
  // une UI commençait à composer le prix à partir d'une autre source.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const check = calculatePricing({
      tarifGPFcfa: effectiveTarifGP,
      weightKg: weight,
      marchandise: goodsType,
      enlevementFcfa: fraisEnlevement.surcharge,
      assuranceFcfa: insuranceCostFcfa,
      transportMode: transportMode,
    }, priority === 'express' ? 'express' : 'standard');
    assertPriceCoherence('SendFlow.pricing', check.total_ttc, pricing.total_ttc);
    assertPriceCoherence('SendFlow.prix_standard', check.prix_standard, pricing.prix_standard);
    assertPriceCoherence('SendFlow.prix_express', check.prix_express, pricing.prix_express);
  }, [pricing, originCity?.country, destCity?.country, weight, goodsType, fraisEnlevement.surcharge, insuranceCostFcfa, priority]);

  const declaredEur = declaredLocal ? eurFromLocal(Number(declaredLocal) || 0, originProfile) : 0;
  // Étape « Protection colis » TOUJOURS affichée entre Transport et Récapitulatif.
  const showInsuranceStep = true;

  // Auto-suggest mode based on weight
  useEffect(() => {
    if (weightTouched && weight >= 30 && transportMode === 'AIR' && goodsType !== 'documents') {
      // hint only — don't override
    }
  }, [weight, weightTouched, transportMode, goodsType]);

  // Express réservé à l'aérien — bascule en "normal" si on passe à SEA/ROAD
  useEffect(() => {
    if (transportMode !== 'AIR' && priority === 'express') {
      setPriority('normal');
    }
  }, [transportMode, priority]);

  // ── Validation (sections are all visible, gates only block submit)
  const routeOk = !!originCity && !!destCity;
  const isAir = transportMode === 'AIR';
  // SEA / ROAD : dépôt entrepôt, pas de créneau de collecte à domicile
  const collecteOk = routeOk && !!pickupAddress.trim() && !!pickupDate && (isAir ? !!pickupSlot : true);
  const recipientOk = !!recipientName.trim() && !!recipientPhone.trim() && (destIsSenegal || !!deliveryAddress.trim());
  // Dimensions obligatoires pour SEA + ROAD
  const dimsOk = isAir || (Number(lengthCm) > 0 && Number(widthCm) > 0 && Number(heightCm) > 0);
  // Nature douane obligatoire en SEA uniquement
  const natureOk = transportMode === 'SEA' ? !!natureDouane.trim() : true;
  const packageOk = !!description.trim() && weightTouched && dimsOk && natureOk;
  const goodsAutoConfident = false;
  const skipGoodsStep = false;
  const goodsOk = !!goodsType;
  const allReady = routeOk && collecteOk && recipientOk && packageOk && goodsOk && !!senderName.trim() && !!senderPhone.trim();

  // CORRECTION #1 — Auto-relance de submit() après login Google/Apple.
  // Conditions : marqueur autoSubmitRef + tous les champs requis OK + utilisateur connecté.
  useEffect(() => {
    if (!autoSubmitRef.current) return;
    if (!allReady) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      autoSubmitRef.current = false;
      // submit() est une déclaration de fonction hoistée dans le composant.
      submit();
    })();
    return () => { cancelled = true; };
  }, [allReady]);

  const summary = originCity && destCity
    ? `${originCity.city} → ${destCity.city}${transportMode ? ` · ${TRANSPORT_MODES.find(t => t.id === transportMode)?.label}` : ''} · ${formatLocalAmount(totalEur, originProfile)}`
    : '';

  const corridorWarning = corridorRisk(goodsType, originProfile.code, destProfile.code);

  // ── Submit ──────────────────────────────────────────────────────
  // Map: id of section → boolean indicating it currently has unmet required fields.
  // We compute it here so both the visual highlight and the scroll-on-submit work.
  const sectionErrors = {
    'section-collecte':    !collecteOk,
    'section-recipient':   !recipientOk,
    'section-package':     !packageOk,
    'section-goods':       !goodsOk,
    'section-final':       !senderName.trim() || !senderPhone.trim(),
  } as const;
  // Per-field validation map — only populated after a failed submit so the form
  // doesn't shout at the user before they've tried.
  const fieldErrors = submitAttempted ? {
    identityName:    !identityName.trim(),
    identityPhone:   !identityPhone.trim(),
    senderName:      !senderName.trim(),
    senderPhone:     !senderPhone.trim(),
    recipientName:   !recipientName.trim(),
    recipientPhone:  !recipientPhone.trim(),
    deliveryAddress: !destIsSenegal && !deliveryAddress.trim(),
    pickupAddress:   !pickupAddress.trim(),
    pickupDate:      !pickupDate,
    pickupSlot:      isAir && !pickupSlot,
    description:     !description.trim(),
    declaredLocal:   false, // CORRECTION 7 — champ optionnel
    goodsType:       !goodsType,
    lengthCm:        !isAir && !(Number(lengthCm) > 0),
    widthCm:         !isAir && !(Number(widthCm) > 0),
    heightCm:        !isAir && !(Number(heightCm) > 0),
    natureDouane:    transportMode === 'SEA' && !natureDouane.trim(),
  } : {} as Record<string, boolean>;

  // step number → DOM id for scroll-to + edit handling from the recap tab.
  const STEP_DOM_ID: Record<number, string> = {
    1: 'section-package',
    2: 'section-goods',
    3: 'tarifs',
    4: 'section-collecte',
    5: 'section-recipient',
    7: 'section-final',
  };
  function goToStep(step: number) {
    setCurrentStep(step);
    setEditingStep(step);
    requestAnimationFrame(() => {
      document.getElementById(STEP_DOM_ID[step])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  // Mark step N as done and advance to N+1, scrolling to the next section.
  function advanceFromStep(step: number) {
    const next = step + 1;
    setEditingStep(null);
    setCurrentStep(s => Math.max(s, next));
    requestAnimationFrame(() => {
      const id = STEP_DOM_ID[next] ?? STEP_DOM_ID[7];
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  // True only when step N is the one the user should currently be editing.
  // Past steps render their collapsed summary; future steps render a locked card.
  const stepIsActive = (n: number) => currentStep === n;
  const stepIsPast = (n: number) => currentStep > n;
  const stepIsFuture = (n: number) => currentStep < n;
  const stepValidity: Record<number, boolean> = {
    1: packageOk, 2: goodsOk, 3: true,
    4: collecteOk, 5: recipientOk, 6: true,
    7: !!senderName.trim() && !!senderPhone.trim(),
  };
  function scrollToFirstError(preferredSectionId?: string) {
    const firstBadId = (preferredSectionId && (sectionErrors as Record<string, boolean>)[preferredSectionId])
      ? preferredSectionId
      : (Object.entries(sectionErrors).find(([, bad]) => bad)?.[0]) || null;
    if (!firstBadId) return;
    requestAnimationFrame(() => {
      const section = document.getElementById(firstBadId);
      if (!section) return;
      // Find first invalid input inside the failing section and focus it.
      const invalid = section.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        '[aria-invalid="true"], [data-invalid="true"], input:invalid, textarea:invalid'
      );
      const target: HTMLElement = invalid || section;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Focus after the scroll has had a beat
      setTimeout(() => {
        if (invalid && typeof (invalid as HTMLElement).focus === 'function') {
          (invalid as HTMLElement).focus({ preventScroll: true });
        }
      }, 400);
    });
  }


  async function submit() {
    if (!routeOk || !collecteOk || !recipientOk || !packageOk || !goodsOk || !senderName.trim() || !senderPhone.trim()) {
      setSubmitAttempted(true);
      // Scroll first, then toast — so the user sees the error context immediately.
      scrollToFirstError();
      setTimeout(() => {
        toast.error('Étapes incomplètes', { description: 'Les champs manquants sont surlignés en rouge.' });
      }, 350);
      return;
    }
    if (!dakarRouteOk) {
      toast('Choisissez Dakar', { description: "Yobbanté opère uniquement les trajets avec Dakar au départ ou à l'arrivée." });
      return;
    }
    setSubmitAttempted(false);
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Sauvegarde du draft + ouverture de la modale interstitielle
        // (pas de redirection silencieuse vers /auth).
        saveDraft(DRAFT_KEY, draftSnapshot);
        if (preset) { try { sessionStorage.setItem(PRESET_KEY, JSON.stringify(preset)); } catch {} }
        // Snapshot complet (cities + direction) pour retrouver le devis
        // pré-rempli après le round-trip Google/Apple → /auth → /expedier?resume=1.
        try {
          sessionStorage.setItem(RESUME_KEY, JSON.stringify({
            direction, originCountry, originCityId, destCityId,
          }));
        } catch {}
        setSubmitting(false);
        setAuthModalOpen(true);
        return;
      }


      const dossier = await createDossier.mutateAsync({
        product_description: `Expédition ${description} — ${originCity.city} → ${destCity.city}`,
        estimated_weight: weight,
        origin_country: originCity.country as WarehouseCountry,
        destination_country: destCity.country,
        origin_city: originCity.city,
        destination_city: destCity.city,
        app_source: 'expedier',
        needs_sourcing: false,
        delivery_mode: deliveryMode,
        relay_point_id: deliveryMode === 'relay_point' ? (relayPointId || null) : null,
        relay_point_name: deliveryMode === 'relay_point' ? relayPointName : null,
        relay_point_address: deliveryMode === 'relay_point' ? relayPointAddress : null,
        delivery_carrier: deliveryMode === 'home_delivery' ? (deliveryCarrier || null) : null,
        pickup_quartier: pickupQuartier || null,
        pickup_zone: fraisEnlevement.zone,
        enlevement_surcharge: fraisEnlevement.surcharge,
        is_outside_dakar: fraisEnlevement.zone !== 'dakar_centre',
        is_gift: isGift,
        price_volatility_coefficient: chosen ? null : Number(priceVolatilityCoeff.toFixed(4)),
        sender_name: senderName || null,
        sender_phone: senderPhone || null,
        sender_address: pickupAddress || null,
        recipient_name: recipientName || null,
        recipient_phone: recipientPhone || null,
        recipient_address: deliveryAddress || null,
        contact_phone: senderPhone || null,
        contact_email: recipientEmail || null,
        pickup_date: pickupDate || null,
        notes: [
          `Profil: ${senderKind === 'business' ? 'Entreprise' : 'Particulier'}`,
          `Type marchandise: ${goodsType}`,
          `Description: ${description}`,
          `Poids: ${weight} kg · ${parcelCount} colis`,
          declaredLocal ? `Valeur déclarée: ${declaredLocal} ${originProfile.currencySymbol}` : '',
          `Transport: ${transportMode} · ${priority}`,
          `Assurance: ${insurance}`,
          `Paiement: ${paymentMethod}`,
          `Collecte: ${pickupDate} · ${pickupSlot}`,
        ].filter(Boolean).join('\n'),
      });

      const matchOption: MatchOptionView = chosen ?? {
        id: transportMode === 'SEA' ? 'volume' : transportMode === 'ROAD' ? 'economy' : 'fast',
        label: TRANSPORT_MODES.find(t => t.id === transportMode)?.label ?? 'Standard',
        eta_days: TRANSPORT_MODES.find(t => t.id === transportMode)?.eta ?? '3-7 jours',
        price_eur: totalEur,
        departure_date: next_departure_date ?? null,
      };

      await createShipment.mutateAsync({
        origin_country: originCity.country as 'FR' | 'CN' | 'US',
        destination_country: destCity.country,
        origin_city: originCity.city,
        destination_city: destCity.city,
        // Persist the exact Konnekt departure date when available — the hook
        // also reads it from match_option.departure_date but we pass it
        // explicitly so it's never dropped if the option is synthesized.
        departure_date: matchOption.departure_date ?? next_departure_date ?? null,
        match_option: {
          ...matchOption,
          meta: {
            ...(matchOption.meta ?? {}),
            send_flow: true,
            dossier_reference: dossier.reference,
            true_direction: {
              origin_city: originCity.city, origin_country: originCity.country,
              destination_city: destCity.city, destination_country: destCity.country,
            },
            sender: { name: senderName, phone: senderPhone, address: pickupAddress },
            recipient: { name: recipientName, phone: recipientPhone, email: recipientEmail, address: deliveryAddress },
            description, weight_kg: weight, parcel_count: parcelCount,
            declared_local: declaredLocal, declared_currency: originProfile.currencySymbol,
            transport_mode: transportMode,
            pickup_date: pickupDate, pickup_slot: pickupSlot,
            insurance, payment_method: paymentMethod, priority, goods_type: goodsType,
          },
        },
      });

      const trackingId = (dossier as any).tracking_id || dossier.reference;
      const arrival = (await import('@/lib/deliveryEta')).estimateArrivalDate({
        destinationCountry: destCity?.country,
        departureDate: matchOption.departure_date ?? null,
      });
      const arrivalLabel = (await import('@/lib/deliveryEta')).formatFrenchDate(arrival);

      setConfirmed({
        reference: dossier.reference,
        trackingId,
        price: totalEur,
        eta: matchOption.eta_days,
        dossierId: (dossier as any).id,
        arrivalDate: arrivalLabel,
      });
      clearDraft(DRAFT_KEY);
      try { sessionStorage.removeItem(PRESET_KEY); } catch {}
      try { sessionStorage.removeItem(RESUME_KEY); } catch {}
      toast.success(`Commande créée — ${trackingId}`);

      // Auto WhatsApp récap au numéro de l'expéditeur (sans accents).
      const prenom = (senderName || 'Client').split(' ')[0];
      const waPhone = (senderPhone || '').trim();
      if (waPhone) {
        const recap = `Bonjour ${prenom},\nVotre expedition Yobbante est enregistree !\n\nRef suivi : ${trackingId}\nTrajet : ${originCity?.city ?? '?'} -> ${destCity?.city ?? '?'}\nPoids : ${weight}kg\nPrix : ${formatLocalAmount(totalEur, originProfile)}\n\nSuivez votre colis :\nyobbante.com/suivre/${trackingId}\n\nQuestions : +221786078080`;
        supabase.functions.invoke('send-whatsapp', {
          body: { recipient_phone: waPhone, message: recap, template: 'free_text' },
        }).catch((e) => console.error('WA recap error', e));
      }

      // Récap email automatique si demandé
      if (wantRecapEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recapEmail) && (dossier as any)?.id) {
        supabase.functions.invoke('send-confirmation-email', {
          body: { dossier_id: (dossier as any).id, email: recapEmail.trim() },
        }).then(({ error }) => {
          if (error) console.error('Email recap error', error);
          else toast.success('Récapitulatif envoyé par email');
        }).catch((e) => console.error('Email recap error', e));
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur');
    } finally { setSubmitting(false); }
  }

  // ── Confirmation page ─────────────────────────────────────────────
  if (confirmed) {
    const waMessage = `Bonjour Yobbanté, je viens de créer l'expédition ${confirmed.reference} (${originCity?.city} → ${destCity?.city}). Je souhaite confirmer le créneau de collecte.`;
    const waHref = `https://wa.me/221786078080?text=${encodeURIComponent(waMessage)}`;
    const nextSteps = [
      {
        icon: <Phone className="w-4 h-4" />,
        title: 'Appel de confirmation',
        desc: 'Notre équipe vous contacte sous 2 h pour valider le créneau de collecte.',
        eta: 'Sous 2 h',
        active: true,
      },
      {
        icon: <Truck className="w-4 h-4" />,
        title: 'Collecte à domicile',
        desc: `Un coursier passe le ${pickupDate || 'jour convenu'} (${pickupSlot === 'morning' ? 'matin' : 'après-midi'}) à l'adresse indiquée.`,
        eta: pickupDate || 'À programmer',
      },
      {
        icon: <Package className="w-4 h-4" />,
        title: 'Réception en hub',
        desc: 'Votre colis est pesé, scellé et préparé pour le départ groupé.',
        eta: '24-48 h',
      },
      {
        icon: <Plane className="w-4 h-4" />,
        title: 'Transport international',
        desc: `Acheminement ${TRANSPORT_MODES.find(t => t.id === transportMode)?.label.toLowerCase() ?? ''} vers ${destCity?.city}, suivi en temps réel.`,
        eta: `${confirmed.eta}`,
      },
      {
        icon: <CheckCircle2 className="w-4 h-4" />,
        title: 'Livraison au destinataire',
        desc: `${recipientName || 'Le destinataire'} est notifié à chaque étape jusqu'à la remise.`,
        eta: 'Sur RDV',
      },
    ];

    return (
      <FlowShell theme="light" compactHeader={compactHeader}>
        <FlowSuccess
          reference={confirmed.trackingId}
          title="Commande confirmée !"
          subtitle="Votre commande est enregistrée. Notre équipe vous contacte sous 24h pour organiser la collecte."
          ctaHref="/app" ctaLabel="Suivre ma commande →"
        />

        {/* Dual reference block — tracking + order */}
        <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            🔍 Pour suivre votre colis
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Référence suivi</p>
              <p className="font-mono text-sm font-bold">{confirmed.trackingId}</p>
              <p className="text-[11px] text-muted-foreground mt-1">À utiliser sur la page de suivi.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Référence commande</p>
              <p className="font-mono text-sm font-bold">{confirmed.reference}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Pour vos échanges avec notre équipe.</p>
            </div>
          </div>
          <p className="text-[12px] text-foreground/80 break-all">
            <span className="text-muted-foreground">Lien direct&nbsp;: </span>
            <a href={`/suivre/${confirmed.trackingId}`} className="underline font-medium">
              yobbante.com/suivre/{confirmed.trackingId}
            </a>
          </p>
        </div>

        {/* Email récap optionnel */}
        {confirmed.dossierId && <EmailRecapCard dossierId={confirmed.dossierId} />}

        {/* Quick actions */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-2">
          <a
            href={waHref}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card hover:bg-accent transition-colors px-3 py-2.5 text-sm font-medium"
          >
            <MessageCircle className="w-4 h-4 text-primary" /> WhatsApp
          </a>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(confirmed.trackingId);
              toast.success('Référence suivi copiée');
            }}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card hover:bg-accent transition-colors px-3 py-2.5 text-sm font-medium"
          >
            <FileText className="w-4 h-4 text-primary" /> Copier la réf.
          </button>
          <button
            type="button"
            onClick={() => navigate(`/suivre/${confirmed.trackingId}`)}
            className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 rounded-xl border border-border bg-card hover:bg-accent transition-colors px-3 py-2.5 text-sm font-medium"
          >
            <Search className="w-4 h-4 text-primary" /> Suivre l'envoi
          </button>
        </div>

        {/* Next steps timeline */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold tracking-tight">Prochaines étapes</h3>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Suivi en direct</span>
          </div>
          <ol className="space-y-0">
            {nextSteps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${
                    s.active
                      ? 'bg-primary text-primary-foreground border-primary ring-4 ring-primary/15'
                      : 'bg-secondary text-muted-foreground border-border'
                  }`}>
                    {s.icon}
                  </div>
                  {i < nextSteps.length - 1 && (
                    <div className="w-px flex-1 min-h-[24px] bg-border my-1" />
                  )}
                </div>
                <div className={`flex-1 pb-5 ${s.active ? '' : 'opacity-90'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{s.title}</p>
                    <span className="text-[11px] font-medium text-muted-foreground bg-secondary border border-border rounded-full px-2 py-0.5 whitespace-nowrap">
                      {s.eta}
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-[13px] text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Support card */}
        <section className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Une question ? On reste joignable.</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Notre équipe support répond 7j/7 sur WhatsApp et par téléphone au +221 78 607 80 80.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={waHref}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Discuter sur WhatsApp
              </a>
              <a
                href="tel:+221786078080"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <Phone className="w-3.5 h-3.5" /> Appeler
              </a>
            </div>
          </div>
        </section>

        {/* Recap */}
        <section className="mt-4 mb-20 rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-3 text-sm">
          <h3 className="text-base font-semibold tracking-tight">Récapitulatif</h3>
          <RecapRow label="Trajet"       value={`${originProfile.flag} ${originCity?.city} → ${destProfile.flag} ${destCity?.city}`} />
          <RecapRow label="Expéditeur"   value={`${senderName} · ${senderPhone} · ${originCity?.city}`} />
          <RecapRow label="Collecte"     value={`${pickupDate} · ${pickupSlot === 'morning' ? 'Matin' : 'Après-midi'} · ${pickupAddress}`} />
          <RecapRow label="Destinataire" value={`${recipientName} · ${recipientPhone} · ${destCity?.city}`} />

          <RecapRow label="Article"    value={`${GOODS_TYPES.find(g => g.id === goodsType)?.label} — ${description}`} />
          <RecapRow label="Poids"      value={`${weight} kg · ${parcelCount} colis`} />
          <RecapRow label="Transport"  value={`${TRANSPORT_MODES.find(t => t.id === transportMode)?.label} · ${priority === 'express' ? 'Express' : 'Standard'}`} />
          <RecapRow label="Assurance"  value={insurance === 'none' ? 'Sans' : insurance === 'standard' ? 'Standard' : 'Premium'} />
          <RecapRow label="Total"      value={formatLocalAmount(confirmed.price, originProfile)} strong />
        </section>
      </FlowShell>
    );
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <FlowShell theme="light" compactHeader={compactHeader}>
      {!compactHeader && (
        <FlowHero
          eyebrow="Expédier · Envoyer"
          title="Envoyez un colis n'importe où dans le monde."
          subtitle="On vient le chercher chez vous, on gère le transport, la douane et la livraison."
        />
      )}

      {preset?.source === 'departures-ticker' && destCity && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
          className="mb-5 sm:mb-6 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 sm:px-5 sm:py-3.5 flex items-start gap-3"
        >
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm sm:text-base font-semibold text-foreground">Envoi vers {destCity.city} sélectionné</p>
            <p className="mt-0.5 text-xs sm:text-[13px] text-muted-foreground">
              Basé sur un départ {preset.transport === 'AIR' ? 'aérien' : preset.transport === 'SEA' ? 'maritime' : 'routier'}
              {preset.departure_date
                ? ` disponible le ${new Date(preset.departure_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
                : ' disponible prochainement'}
              {originCity ? ` depuis ${originCity.city}` : ''}.
            </p>
          </div>
        </motion.div>
      )}

      {/* ─── Route summary banner — réseau Dakar + 36 villes ─── */}
      <section className="py-6 border-b border-border">
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/30 px-4 py-3.5">
          <Globe2 className="w-4 h-4 text-foreground shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {originCity && destCity
                ? `${originProfile.flag} ${originCity.city} → ${destProfile.flag} ${destCity.city}`
                : 'Choisissez votre itinéraire dans la barre ci-dessus'}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Yobbanté opère entre <strong>Dakar</strong> et 36 villes internationales — l'une des deux extrémités est toujours Dakar.
            </p>
          </div>
          {originCity && destCity && (
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Modifier
            </button>
          )}
        </div>
        {!routeOk && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Renseignez origine, destination et poids dans la barre de recherche pour démarrer.
          </div>
        )}
      </section>

      {/* ─── Identity block — adaptive to userRole ─── */}
      {routeOk && (
        <section className="mt-5">
          {identityCollapsed && identityName.trim() && identityPhone.trim() ? (
            <button
              type="button"
              onClick={() => setIdentityCollapsed(false)}
              className="w-full text-left rounded-2xl border border-border bg-card hover:bg-secondary/40 transition-colors px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {userRole === 'sender'    && `Vous expédiez depuis ${originCity?.city}`}
                  {userRole === 'recipient' && `Vous recevrez à ${destCity?.city}`}
                  {userRole === 'third'     && `Vous remplissez pour un tiers`}
                </p>
                <p className="text-sm font-semibold text-foreground truncate mt-0.5">
                  {identityName} · {identityPhone}
                </p>
              </div>
              <span className="text-[11px] underline underline-offset-2 text-muted-foreground shrink-0">Modifier</span>
            </button>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2.5">
                  Qui complète ce formulaire ?
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {([
                    { id: 'sender'    as const, label: `Je suis à ${originCity?.city}`, sub: "J'expédie le colis" },
                    { id: 'recipient' as const, label: `Je suis à ${destCity?.city}`,    sub: 'Je recevrai le colis' },
                    { id: 'third'     as const, label: 'Je suis intermédiaire',          sub: 'Je remplis pour un tiers' },
                  ]).map(opt => {
                    const active = userRole === opt.id;
                    return (
                      <button key={opt.id} type="button"
                        onClick={() => setUserRole(opt.id)}
                        className={`text-left rounded-xl border-2 px-3.5 py-2.5 transition-all ${
                          active ? 'border-foreground bg-foreground text-background' : 'border-border bg-card hover:border-foreground/40'
                        }`}>
                        <p className="text-sm font-semibold leading-tight">{opt.label}</p>
                        <p className={`mt-0.5 text-[11px] ${active ? 'text-background/70' : 'text-muted-foreground'}`}>{opt.sub}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {userRole === 'sender'    && 'Vos coordonnées (expéditeur)'}
                  {userRole === 'recipient' && 'Vos coordonnées (destinataire)'}
                  {userRole === 'third'     && 'Vos coordonnées (intermédiaire)'}
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <TextField label="Nom complet *" value={identityName} onChange={setIdentityName} placeholder="Votre nom"
                    invalid={fieldErrors.identityName} />
                  <TextField
                    label={`Téléphone * (${isRecipientRole ? destProfile.phonePrefix : originProfile.phonePrefix})`}
                    value={identityPhone} onChange={setIdentityPhone}
                    placeholder={`${isRecipientRole ? destProfile.phonePrefix : originProfile.phonePrefix} · · · · · ·`}
                    type="tel" icon={<Phone className="w-3.5 h-3.5" />}
                    invalid={fieldErrors.identityPhone} />
                </div>
                {identityName.trim() && identityPhone.trim() && (
                  <button type="button" onClick={() => setIdentityCollapsed(true)}
                    className="text-[11px] underline underline-offset-2 text-muted-foreground hover:text-foreground">
                    Replier ce bloc
                  </button>
                )}

                {/* Récap par email — optionnel */}
                <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wantRecapEmail}
                      onChange={(e) => setWantRecapEmail(e.target.checked)}
                      className="mt-1 w-4 h-4 accent-foreground"
                    />
                    <span className="text-[13px] font-medium">
                      📧 Recevoir le récapitulatif par email
                      <span className="block text-[11px] text-muted-foreground font-normal mt-0.5">
                        En complément du WhatsApp envoyé automatiquement.
                      </span>
                    </span>
                  </label>
                  {wantRecapEmail && (
                    <TextField
                      label="Votre email"
                      value={recapEmail}
                      onChange={setRecapEmail}
                      placeholder="votre@email.com"
                      type="email"
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}



      {/* ─── Step 1 — Collecte (incl. sender contact when user is recipient/third) ─── */}
      <div id="section-collecte" className={cn('rounded-2xl transition-shadow', submitAttempted && sectionErrors['section-collecte'] && 'ring-2 ring-red-400/70 ring-offset-4 ring-offset-background')}>
      <FlowSection
        revealed={routeOk}
        step={4}
        total={7}
        title={userRole === 'sender' ? 'Collecte du colis' : `Collecte chez l'expéditeur à ${originCity?.city ?? '—'}`}
        hint={userRole === 'sender'
          ? 'Adresse + créneau souhaité pour la prise en charge.'
          : "Renseignez les coordonnées de la personne qui remet le colis et l'adresse où nous le récupérons."}
      >
        {originCity ? (
          collecteOk && editingStep !== 4 && !stepIsActive(4) ? (
            <StepCollapsed
              title="Collecte programmée"
              lines={[
                `${pickupDate} · ${pickupSlot === 'morning' ? 'Matin' : 'Après-midi'}`,
                pickupAddress,
                userRole === 'recipient' ? `Expéditeur : ${senderName || '—'} · ${senderPhone || '—'}` : null,
              ].filter(Boolean) as string[]}
              onEdit={() => { setCurrentStep(4); setEditingStep(4); }}
            />
          ) : (
            <div className="mt-2 space-y-4 max-w-xl">
              <CoverageBadge level={coverage.level} city={originCity.city} loading={coverage.loading} />

              {/* Dépôt entrepôt — SEA / ROAD : pas de collecte à domicile */}
              {!isAir && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-blue-900">
                  <p className="text-[11px] uppercase tracking-wider font-semibold flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" /> Dépôt au point d'enlèvement
                  </p>
                  <p className="mt-1.5 text-sm font-semibold">
                    Entrepôt Yobbanté — Dakar
                  </p>
                  <p className="text-xs leading-relaxed mt-1">
                    Km 4,5 Boulevard du Centenaire, Dakar (face station Total)<br />
                    Lundi → Vendredi : 9h – 18h · Samedi : 9h – 13h
                  </p>
                  <p className="mt-2 text-[11px] italic">
                    {transportMode === 'SEA' ? 'Maritime' : 'Routier'} — la collecte à domicile n'est pas disponible. Apportez le colis au dépôt à la date choisie.
                  </p>
                </div>
              )}


              {/* Sender contact (only when user is the recipient — identity already covers sender/third) */}
              {userRole === 'recipient' && (
                <div className="rounded-xl border border-border bg-secondary/30 p-3.5 space-y-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Coordonnées de l'expéditeur à {originCity.city}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <TextField label="Nom complet *" value={senderName} onChange={setSenderName}
                      placeholder={`Personne qui remet le colis à ${originCity.city}`}
                      invalid={fieldErrors.senderName} />
                    <div>
                      <TextField label={`Téléphone * (${originProfile.phonePrefix})`} value={senderPhone} onChange={setSenderPhone}
                        placeholder="771234567" type="tel" icon={<Phone className="w-3.5 h-3.5" />}
                        invalid={fieldErrors.senderPhone} />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Saisissez les 9 chiffres sans le 0 (ex. 771234567).
                      </p>
                    </div>
                  </div>
                </div>
              )}


              {isFromDakar && (
                <QuartierDakarPicker
                  value={pickupQuartier}
                  onChange={setPickupQuartier}
                />
              )}

              <AddressField
                label={isAir
                  ? `Adresse de collecte à ${originCity.city} *`
                  : `Adresse de l'expéditeur à ${originCity.city} * (réf. dossier — dépôt à l'entrepôt)`}
                value={pickupAddress} onChange={setPickup}
                placeholder="N°, rue, quartier (ex: Villa 45, HLM Grand Yoff)"
                invalid={fieldErrors.pickupAddress}
              />

              {isFromDakar && (pickupAddress.trim() || pickupQuartier) && (
                <ZoneBadge frais={fraisEnlevement} />
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs mb-1.5 font-medium text-muted-foreground inline-flex items-center gap-1.5">
                    <CalendarIcon className="w-3 h-3" />
                    {isAir ? 'Date de collecte *' : 'Date de dépôt à l\'entrepôt *'}
                  </span>
                  <input
                    type="date" value={pickupDate} min={localCalendarMin} max="2099-12-31"
                    onChange={(e) => {
                      // CORRECTION 4 — bloque les années aberrantes (ex: 60620)
                      const v = e.target.value;
                      if (!v) { setPickupDate(''); return; }
                      const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                      if (!m) return;
                      const y = Number(m[1]);
                      if (y < 2024 || y > 2099) return;
                      setPickupDate(v);
                    }}
                    aria-invalid={fieldErrors.pickupDate || undefined}
                    className={cn(
                      'w-full border-2 rounded-xl px-4 py-3 text-sm bg-card focus:outline-none transition-all',
                      fieldErrors.pickupDate ? 'border-danger focus:border-danger' : 'border-border focus:border-foreground',
                    )}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {isAir ? `Délai min ${coverage.minLeadHours}h selon votre zone.` : 'Horaires entrepôt : Lun-Ven 9h-18h, Sam 9h-13h.'}
                  </p>
                </label>
                {isAir && (
                  <div>
                    <span className="block text-xs mb-1.5 font-medium text-muted-foreground">Créneau *</span>
                    <ChipGroup options={TIME_SLOTS} value={pickupSlot} onChange={(v) => setPickupSlot(v)} />
                  </div>
                )}
              </div>

              <StepSupportLink />
            </div>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Sélectionnez l'itinéraire dans la barre pour activer la collecte.</p>
        )}
      </FlowSection>
      </div>



      {/* ─── Step 2 — Recipient ─── */}
      {routeOk && stepIsFuture(5) ? (
        <div className="mt-6"><LockedStep step={5} total={7} title={userRole === 'recipient' ? 'Vos coordonnées de livraison' : 'Informations du destinataire'} /></div>
      ) : (
      <div id="section-recipient" className={cn('rounded-2xl transition-shadow', submitAttempted && sectionErrors['section-recipient'] && 'ring-2 ring-red-400/70 ring-offset-4 ring-offset-background')}>
      <FlowSection
        revealed={routeOk}
        step={5}
        total={7}
        title={userRole === 'recipient' ? 'Vos coordonnées de livraison' : 'Informations du destinataire'}
        hint={userRole === 'recipient'
          ? 'C\'est vous qui recevrez — vérifiez l\'adresse de livraison.'
          : (destIsSenegal ? 'Au Sénégal, le téléphone fait foi pour la livraison.' : 'Coordonnées complètes pour la livraison.')}
      >
        {recipientOk && editingStep !== 5 && !stepIsActive(5) ? (
          <StepCollapsed
            title={userRole === 'recipient' ? 'Vous recevrez ce colis' : 'Destinataire confirmé'}
            lines={[
              `${recipientName} · ${recipientPhone}`,
              deliveryAddress || (destIsSenegal ? 'Adresse précisée par téléphone' : ''),
              recipientEmail || null,
            ].filter(Boolean) as string[]}
            onEdit={() => { setCurrentStep(5); setEditingStep(5); }}
          />
        ) : (
          <div className="space-y-3 max-w-xl">
            {userRole === 'recipient' && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[11px] text-emerald-900">
                Vos nom et téléphone ont été repris du bloc d'identité ci-dessus. Complétez juste l'adresse de livraison.
              </p>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <TextField label="Nom complet *" value={recipientName} onChange={setRecipientName}
                placeholder={`Ex. destinataire à ${destCity?.city ?? '—'}`}
                invalid={fieldErrors.recipientName} />
              <TextField label={`Téléphone * (${destProfile.phonePrefix})`} value={recipientPhone} onChange={setRecipientPhone}
                placeholder={`${destProfile.phonePrefix} 6 · · · · · ·`} type="tel" icon={<Phone className="w-3.5 h-3.5" />}
                invalid={fieldErrors.recipientPhone} />
            </div>
            {!isFromDakar && destIsSenegal && (
              <QuartierDakarPicker
                value={pickupQuartier}
                onChange={setPickupQuartier}
                label="Quartier de livraison à Dakar"
              />
            )}
            <AddressField
              label={destIsSenegal ? `Adresse / Quartier à ${destCity?.city ?? ''} (optionnel)` : `Adresse complète à ${destCity?.city ?? ''} *`}
              value={deliveryAddress} onChange={setDelivery}
              placeholder={destIsSenegal ? 'Ex. Liberté 6, près de la pharmacie…' : 'N°, rue, code postal, ville'}
              invalid={fieldErrors.deliveryAddress}
            />
            {!isFromDakar && destIsSenegal && (deliveryAddress.trim() || pickupQuartier) && (
              <ZoneBadge frais={fraisEnlevement} mode="livraison" />
            )}
            <TextField label="Email (notifications de livraison)" value={recipientEmail} onChange={setRecipientEmail}
              placeholder="ahmed@example.com" type="email" />

            {/* Mode de reception finale */}
            <div className="rounded-2xl border-2 border-border bg-card p-4 space-y-3">
              <p className="text-xs font-semibold text-foreground">Mode de réception à l'arrivée</p>
              {(() => {
                const hasRelays = activeRelayPoints.length > 0;
                const options: Array<{ id: 'pickup_gp' | 'relay_point' | 'home_delivery'; label: string; sub: string; disabled?: boolean; disabledNote?: string; hidden?: boolean }> = [
                  {
                    id: 'pickup_gp',
                    label: 'Récupérer chez notre partenaire',
                    sub: 'Gratuit — adresse communiquée à l\'arrivée',
                  },
                  {
                    id: 'relay_point',
                    label: 'Livraison à un point relais',
                    sub: destIsDakar
                      ? (hasRelays ? 'Choisissez un relais à Dakar' : 'Points relais bientôt disponibles à Dakar. Contactez-nous.')
                      : 'Disponible uniquement à Dakar',
                    disabled: !destIsDakar || !hasRelays,
                    disabledNote: !destIsDakar ? 'Disponible uniquement à Dakar' : (!hasRelays ? 'Points relais bientôt disponibles à Dakar' : undefined),
                    // CORRECTION 6 — masquer complètement l'option pour toute
                    // destination hors Sénégal/Dakar. On ne propose un relais
                    // que pour la livraison locale Dakar.
                    hidden: !destIsDakar || (destIsDakar && !hasRelays),
                  },
                  {
                    id: 'home_delivery',
                    label: 'Livraison à domicile',
                    sub: destIsDakar ? 'Frais selon zone et transporteur' : 'Disponible uniquement à Dakar',
                    disabled: !destIsDakar,
                    disabledNote: !destIsDakar ? 'Disponible uniquement à Dakar' : undefined,
                    hidden: !destIsDakar,
                  },
                ];
                return options.filter(o => !o.hidden).map(opt => {
                  const selected = deliveryMode === opt.id;
                  return (
                    <label
                      key={opt.id}
                      title={opt.disabledNote}
                      className={cn(
                        'flex items-start gap-3 rounded-xl border-2 p-3 transition-colors',
                        opt.disabled
                          ? 'border-border bg-muted/30 cursor-not-allowed opacity-60'
                          : 'cursor-pointer',
                        !opt.disabled && (selected ? 'border-foreground bg-secondary/40' : 'border-border hover:border-muted-foreground/40'),
                      )}
                    >
                      <input
                        type="radio" name="delivery_mode" value={opt.id}
                        checked={selected}
                        disabled={opt.disabled}
                        onChange={() => { if (!opt.disabled) setDeliveryMode(opt.id); }}
                        className="mt-1 accent-foreground"
                      />
                      <span className="flex-1">
                        <span className="block text-sm font-medium text-foreground">{opt.label}</span>
                        <span className={cn('block text-[11px]', opt.disabled ? 'text-muted-foreground/80 italic' : 'text-muted-foreground')}>{opt.sub}</span>
                      </span>
                    </label>
                  );
                });
              })()}

              {deliveryMode === 'relay_point' && destIsDakar && activeRelayPoints.length > 0 && (
                <div className="space-y-2 pt-1">
                  <label className="block">
                    <span className="text-xs font-medium text-muted-foreground mb-1.5 block">Point relais *</span>
                    <select
                      value={relayPointId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setRelayPointId(id);
                        const rp = activeRelayPoints.find(r => r.id === id);
                        if (rp) { setRelayPointName(rp.name); setRelayPointAddress(rp.address); }
                      }}
                      className="w-full border-2 border-border rounded-xl px-4 py-3 text-sm bg-card focus:outline-none focus:border-foreground transition-colors"
                    >
                      <option value="">— Choisir un point relais —</option>
                      {activeRelayPoints.map(rp => (
                        <option key={rp.id} value={rp.id}>{rp.name} — {rp.quartier}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {deliveryMode === 'home_delivery' && destIsDakar && (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] text-muted-foreground">
                    Choisissez un transporteur. Les tarifs seront calculés et confirmés avant le départ.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {['Yobbanté', 'DHL', 'FedEx'].map(c => (
                      <button
                        type="button" key={c}
                        onClick={() => setDeliveryCarrier(c)}
                        className={cn(
                          'rounded-xl border-2 px-3 py-2 text-xs font-medium transition-colors',
                          deliveryCarrier === c ? 'border-foreground bg-secondary/40 text-foreground' : 'border-border text-muted-foreground hover:border-muted-foreground/40',
                        )}
                      >{c}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>


            <StepSupportLink />
          </div>
        )}
      </FlowSection>
      </div>
      )}



      {/* ─── Step 3 — Package description ─── */}
      {routeOk && stepIsFuture(1) ? (
        <div className="mt-6"><LockedStep step={1} total={7} title="Qu'est-ce que vous expédiez ?" /></div>
      ) : (
      <div id="section-package" className={cn('rounded-2xl transition-shadow', submitAttempted && sectionErrors['section-package'] && 'ring-2 ring-red-400/70 ring-offset-4 ring-offset-background')}>
      <FlowSection revealed={routeOk} step={1} total={7} title="Qu'est-ce que vous expédiez ?" hint="Description, valeur et poids estimés.">
        {packageOk && editingStep !== 1 && !stepIsActive(1) ? (
          <StepCollapsed
            title={`${description} — ${weight} kg`}
            lines={[
              `${parcelCount} colis · ${declaredLocal} ${originProfile.currencySymbol}`,
            ]}
            onEdit={() => { setCurrentStep(1); setEditingStep(1); }}
          />
        ) : (
        <div className="space-y-4 max-w-xl">

          {/* Description — textarea avec compteur (max 140) */}
          <label className="block">
            <span className="flex items-center justify-between mb-1.5">
              <span className={cn('text-xs font-medium', fieldErrors.description ? 'text-danger' : 'text-muted-foreground')}>Description *</span>
              <span className={cn(
                'text-[10px] tabular-nums',
                description.length > 140 ? 'text-danger font-semibold' : 'text-muted-foreground/70',
              )}>{description.length}/140</span>
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 140))}
              maxLength={140}
              rows={2}
              placeholder="Ex. 3 robes, 2 pantalons, chaussures"
              aria-invalid={fieldErrors.description || undefined}
              className={cn(
                'w-full border-2 rounded-xl px-4 py-3 text-sm bg-card placeholder:text-muted-foreground/60 focus:outline-none transition-all resize-none',
                fieldErrors.description ? 'border-danger focus:border-danger' : 'border-border focus:border-foreground',
              )}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">Soyez précis : aide la douane et l'identification du contenu.</p>
          </label>


          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-1 mb-1 text-[12px] font-medium">
                <span>Valeur déclarée</span>
                <span className="text-muted-foreground">({originProfile.currencySymbol})</span>
                <span className="text-[10px] text-muted-foreground italic">— optionnel</span>
                <span
                  className="cursor-help text-muted-foreground"
                  title="Valeur marchande approximative du contenu. Utilisée pour la douane et l'assurance. En cas de sinistre, c'est cette valeur qui sera prise en compte."
                  aria-label="Aide valeur déclarée"
                >ⓘ</span>
              </div>
              <TextField
                label=""
                value={declaredLocal} onChange={setDeclaredLocal}
                placeholder={originProfile.currency === 'XOF' ? 'Ex. : 50 000 FCFA' : 'Ex. : 120'}
                suffix={originProfile.currencySymbol}
                type="number"
              />
              <p className="mt-1 text-[11px] text-muted-foreground italic">
                Optionnel — recommandé pour l'assurance. Laissez vide si non applicable.
              </p>
            </div>
            <div className="flex items-end">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Utilisée pour la douane et l'assurance. En cas de sinistre, c'est cette valeur qui sera prise en compte.
              </p>
            </div>
          </div>


          {/* Poids — slider classique + saisie manuelle */}
          <div className="space-y-2">
            <NumberSlider
              label="Poids estimé *"
              value={weight}
              onChange={(v) => { setWeight(v); setWeightTouched(true); }}
              min={1} max={100} step={1} unit=" kg"
            />
            <div className="flex items-center gap-2">
              <input
                type="number" min={1} max={500} value={weight}
                onChange={(e) => { const v = Math.max(1, Math.min(500, Number(e.target.value) || 1)); setWeight(v); setWeightTouched(true); }}
                className="w-24 border-2 rounded-xl px-3 py-2 text-sm bg-card border-border focus:outline-none focus:border-foreground transition-all tabular-nums" />
              <span className="text-[11px] text-muted-foreground">ou saisie précise (1-500 kg)</span>
            </div>
          </div>


          <label className="block max-w-[180px]">
            <span className="block text-xs mb-1.5 font-medium text-muted-foreground">Nombre de colis</span>
            <input type="number" min={1} max={50} value={parcelCount}
              onChange={(e) => setParcelCount(Math.max(1, Number(e.target.value) || 1))}
              className="w-full border-2 rounded-xl px-4 py-3 text-sm bg-card border-border focus:outline-none focus:border-foreground transition-all" />
          </label>

          {/* Dimensions — obligatoires en SEA/ROAD (CBM + poids volumétrique) */}
          {!isAir && (() => {
            const L = Number(lengthCm) || 0;
            const W = Number(widthCm) || 0;
            const H = Number(heightCm) || 0;
            const cbm = (L * W * H) / 1_000_000;
            return (
              <div className="rounded-xl border border-border bg-secondary/30 p-3.5 space-y-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Dimensions du colis * (cm) — obligatoire en {transportMode === 'SEA' ? 'Maritime' : 'Routier'}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {transportMode === 'SEA'
                      ? 'Le volume (CBM) détermine le tarif maritime et le seuil conteneur complet (> 5 CBM).'
                      : 'Sert au calcul du poids volumétrique (L × l × H / 5000).'}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="block">
                    <span className="block text-[11px] mb-1 text-muted-foreground">Longueur</span>
                    <input type="number" min={1} max={500} value={lengthCm}
                      onChange={(e) => setLengthCm(e.target.value)}
                      placeholder="cm"
                      aria-invalid={fieldErrors.lengthCm || undefined}
                      className={cn('w-full border-2 rounded-xl px-3 py-2 text-sm bg-card focus:outline-none transition-all tabular-nums',
                        fieldErrors.lengthCm ? 'border-danger' : 'border-border focus:border-foreground')} />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] mb-1 text-muted-foreground">Largeur</span>
                    <input type="number" min={1} max={500} value={widthCm}
                      onChange={(e) => setWidthCm(e.target.value)}
                      placeholder="cm"
                      aria-invalid={fieldErrors.widthCm || undefined}
                      className={cn('w-full border-2 rounded-xl px-3 py-2 text-sm bg-card focus:outline-none transition-all tabular-nums',
                        fieldErrors.widthCm ? 'border-danger' : 'border-border focus:border-foreground')} />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] mb-1 text-muted-foreground">Hauteur</span>
                    <input type="number" min={1} max={500} value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      placeholder="cm"
                      aria-invalid={fieldErrors.heightCm || undefined}
                      className={cn('w-full border-2 rounded-xl px-3 py-2 text-sm bg-card focus:outline-none transition-all tabular-nums',
                        fieldErrors.heightCm ? 'border-danger' : 'border-border focus:border-foreground')} />
                  </label>
                </div>
                {cbm > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-card border border-border px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Volume calculé (CBM)</span>
                    <span className="font-bold tabular-nums">{cbm.toFixed(3)} m³</span>
                  </div>
                )}
                {transportMode === 'SEA' && cbm > 5 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] px-3 py-2">
                    Volume supérieur à 5 CBM — éligible <strong>conteneur complet sur devis</strong> (étape suivante).
                  </div>
                )}

                {transportMode === 'SEA' && (
                  <div>
                    <label className="block">
                      <span className="block text-[11px] mb-1 font-medium text-muted-foreground">
                        Nature exacte de la marchandise * (douane)
                      </span>
                      <input type="text" value={natureDouane}
                        onChange={(e) => setNatureDouane(e.target.value.slice(0, 140))}
                        placeholder="Ex. Vêtements neufs en coton — origine France"
                        aria-invalid={fieldErrors.natureDouane || undefined}
                        className={cn('w-full border-2 rounded-xl px-3 py-2 text-sm bg-card focus:outline-none transition-all',
                          fieldErrors.natureDouane ? 'border-danger' : 'border-border focus:border-foreground')} />
                    </label>
                    <p className="mt-1 text-[10px] text-muted-foreground italic">
                      Description précise exigée par la douane maritime (matière, état, origine).
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          <p className="text-[11px] text-muted-foreground">
            Le poids est ajusté à réception si différent de l'estimation. Tolérance 10 %.
          </p>
          <StepSupportLink />
        </div>
        )}
      </FlowSection>
      </div>
      )}


      {/* ─── Step 4 — Goods type (skipped when AI is confident) ─── */}
      {!skipGoodsStep ? (
        routeOk && stepIsFuture(2) ? (
          <div className="mt-6"><LockedStep step={2} total={7} title="Type de marchandise" /></div>
        ) : (
        <div id="section-goods" className={cn('rounded-2xl transition-shadow', submitAttempted && sectionErrors['section-goods'] && 'ring-2 ring-red-400/70 ring-offset-4 ring-offset-background')}>
        <FlowSection revealed={routeOk} step={2} total={7} title="Type de marchandise" hint="Important pour la douane et l'assurance.">

          {goodsOk && editingStep !== 2 && !stepIsActive(2) ? (
            <StepCollapsed
              title={GOODS_TYPES.find(g => g.id === goodsType)?.label ?? '—'}
              lines={[
                GOODS_TYPES.find(g => g.id === goodsType)?.desc ?? '',
                goodsAutoConfident ? 'Détecté automatiquement à partir de votre description' : '',
              ].filter(Boolean)}
              onEdit={() => { setCurrentStep(2); setEditingStep(2); }}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                {GOODS_TYPES.map(g => {
                  const active = goodsType === g.id;
                  const dotColor = g.risk === 'high' ? 'bg-amber-400' : g.risk === 'medium' ? 'bg-blue-400' : 'bg-emerald-400';
                  return (
                    <button key={g.id} type="button"
                      title={g.desc}
                      onClick={() => { setGoodsType(g.id); advanceFromStep(4); }}
                      className={cn(
                        'group relative text-left rounded-lg border px-2.5 py-2 transition-all',
                        active
                          ? 'border-foreground bg-foreground text-background shadow-sm'
                          : 'border-border bg-card hover:border-foreground/40',
                      )}>
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[12px] font-semibold leading-tight truncate">{g.label}</span>
                        <span className={cn(
                          'shrink-0 w-1.5 h-1.5 rounded-full',
                          active ? 'bg-background/70' : dotColor,
                        )} />
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Standard</span>
                <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Vérif. requise</span>
                <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Restriction douanière</span>
              </div>
              {corridorWarning && !(originCity && destCity && weight > 0) && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{corridorWarning}</span>
                </div>
              )}

              {/* Toggle cadeau / don personnel — déclaration douanière simplifiée */}
              <div className="mt-4 rounded-xl border border-border bg-card p-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <span className="text-sm font-medium">🎁 C'est un cadeau ou don personnel</span>
                  <input
                    type="checkbox"
                    className="h-5 w-9 appearance-none rounded-full bg-border transition-colors checked:bg-foreground relative cursor-pointer
                      before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:h-4 before:w-4 before:rounded-full before:bg-background before:transition-transform
                      checked:before:translate-x-4"
                    checked={isGift}
                    onChange={(e) => setIsGift(e.target.checked)}
                  />
                </label>
                {isGift && (
                  <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-900 text-xs p-3 leading-relaxed">
                    ✅ Déclaration douanière simplifiée applicable pour les envois personnels. La valeur déclarée doit rester inférieure à 45&nbsp;€ pour l'exonération de droits de douane en France.
                  </div>
                )}
              </div>

              {/* Forfait produit (optionnel) — remplace le calcul au poids */}
              {forfaits.length > 0 && goodsType && (
                <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
                  <div>
                    <p className="text-sm font-semibold">Produit spécifique (optionnel)</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Si votre envoi correspond à un de ces produits, son tarif forfaitaire s'applique.
                    </p>
                  </div>
                  <div className="grid grid-cols-[1fr,90px] gap-2">
                    <select
                      value={forfaitId ?? ''}
                      onChange={(e) => setForfaitId(e.target.value || null)}
                      className="w-full border-2 border-border rounded-xl px-3 py-2 text-sm bg-card focus:outline-none focus:border-foreground"
                    >
                      <option value="">— Aucun (calcul au poids) —</option>
                      {forfaits.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.nom} — {f.prix_fcfa.toLocaleString('fr-FR')} FCFA
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={forfaitQty}
                      onChange={(e) => setForfaitQty(Math.max(1, Number(e.target.value) || 1))}
                      disabled={!forfaitId}
                      className="w-full border-2 border-border rounded-xl px-3 py-2 text-sm bg-card text-center tabular-nums disabled:opacity-40 focus:outline-none focus:border-foreground"
                      title="Quantité"
                    />
                  </div>
                  {selectedForfait && (
                    <div className="rounded-lg bg-card border border-border px-3 py-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">
                          {selectedForfait.nom} × {forfaitQty}
                        </span>
                        <span className="font-bold tabular-nums">
                          {(selectedForfait.prix_fcfa * forfaitQty).toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                      {selectedForfait.description && (
                        <p className="mt-1 text-[10px] text-muted-foreground">{selectedForfait.description}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <StepSupportLink />
            </>
          )}
        </FlowSection>
        </div>
        )


      ) : corridorWarning && !(originCity && destCity && weight > 0) ? (
        <div className="mx-auto max-w-2xl px-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{corridorWarning}</span>
          </div>
        </div>
      ) : null}

      {/* ─── Step 5 — Transport & priority ─── */}
      {routeOk && stepIsFuture(3) ? (
        <div className="mt-6"><LockedStep step={3} total={7} title="Transport & priorité" /></div>
      ) : (
      <div id="tarifs" className="scroll-mt-32">
      <FlowSection revealed={routeOk} step={3} total={7} title="Transport & priorité" hint="Mode de transport et urgence.">


        {(() => {
          // ── Prix venant du moteur (pricing engine v2). Le surcoût d'enlèvement
          // (banlieue / hors-Dakar) est déjà calculé en haut (surchargeEur).
          // Prix STRICTEMENT issus du pricing engine (source unique).
          // standardPrice / expressPrice sont exprimés en FCFA puis convertis
          // en devise locale pour l'affichage. Le récap et la LiveSummaryBar
          // utilisent EXACTEMENT le même calcul.
          const outsideDakar = fraisEnlevement.zone !== 'dakar_centre';
          const standardPriceFcfa = pricing.prix_standard;
          const expressPriceFcfa = pricing.prix_express;
          const standardPrice = toEurFcfa(standardPriceFcfa);
          const expressPrice = toEurFcfa(expressPriceFcfa);

          const standardEtaMin = quoteStandard?.eta_min_days ?? 5;
          const standardEtaMax = quoteStandard?.eta_max_days ?? 9;
          const expressEtaMin  = quoteExpress?.eta_min_days  ?? Math.max(1, Math.ceil(standardEtaMin * 0.6));
          const expressEtaMax  = quoteExpress?.eta_max_days  ?? Math.max(expressEtaMin + 1, Math.ceil(standardEtaMax * 0.6));

          const STANDARD_PERKS = [
            'Groupé avec d\'autres colis · meilleur tarif',
            'Départ au prochain vol disponible',
            'Enlèvement gratuit à Dakar centre',
            'Suivi en temps réel à chaque étape',
          ];
          const EXPRESS_PERKS = [
            'Embarqué sur le tout premier vol',
            'Traitement prioritaire en agence (passe devant)',
            'Dédouanement accéléré à l\'arrivée',
            'Notifications SMS + WhatsApp à chaque étape',
          ];

          const standardDelay = getDeliveryDelay(destCity?.city, 'standard');
          const expressDelay  = getDeliveryDelay(destCity?.city, 'express');

          // Cards mode-aware : AIR garde Standard/Express, SEA = Groupage (+ conteneur sur devis),
          // ROAD = Groupage routier uniquement.
          const SEA_PERKS = [
            'Groupage maritime — meilleur tarif au volume',
            'Dépôt au point d\'enlèvement à Dakar',
            'Suivi conteneur + traitement douane inclus',
            'Délai 21-30 jours porte à porte',
          ];
          const ROAD_PERKS = [
            'Groupage routier — meilleur tarif sans frais portuaires',
            'Dépôt au point d\'enlèvement à Dakar',
            'Suivi camion + traitement douane inclus',
            `Délai estimé ${transportMode === 'ROAD' ? (TRANSPORT_MODES.find(t => t.id === 'ROAD')?.eta ?? '7-14 jours') : '7-14 jours'} selon destination`,
          ];

          const cards = transportMode === 'SEA' ? [
            {
              id: 'normal' as const,
              label: 'Groupage',
              tagline: 'Maritime · partagé en conteneur',
              icon: <Clock className="w-4 h-4" />,
              eta: 'Livraison en 21-30 jours',
              price: standardPrice,
              perks: SEA_PERKS,
              recommended: true,
            },
          ] : transportMode === 'ROAD' ? [
            {
              id: 'normal' as const,
              label: 'Groupage routier',
              tagline: 'Camion partagé · sans frais portuaires',
              icon: <Truck className="w-4 h-4" />,
              eta: destCity
                ? `Livraison estimée ${TRANSPORT_MODES.find(t => t.id === 'ROAD')?.eta ?? '7-14 jours'} vers ${destCity.city}`
                : 'Livraison estimée 7-14 jours',
              price: standardPrice,
              perks: ROAD_PERKS,
              recommended: true,
            },
          ] : [
            {
              id: 'normal' as const,
              label: 'Standard',
              tagline: 'Via transporteur partenaire',
              icon: <Clock className="w-4 h-4" />,
              eta: destCity ? `Livraison en ${standardDelay.label}` : `${standardEtaMin}-${standardEtaMax} jours`,
              price: standardPrice,
              perks: STANDARD_PERKS,
              recommended: true,
            },
            {
              id: 'express' as const,
              label: 'Express ⚡',
              tagline: 'Priorité absolue — premier départ',
              icon: <Zap className="w-4 h-4" />,
              eta: destCity ? `Livraison en ${expressDelay.label}` : `${expressEtaMin}-${expressEtaMax} jours`,
              price: expressPrice,
              perks: EXPRESS_PERKS,
            },
          ];

          // CBM pour le seuil "conteneur complet" en SEA
          const cbmTotal = (Number(lengthCm) * Number(widthCm) * Number(heightCm)) / 1_000_000;


          const hasInstantDeparture = options.length > 0;
          const noInstant = !matching && !hasInstantDeparture && originCity && destCity && weightTouched;

          return (
            <div className="space-y-4">
              <DoorToDoorBanner
                origin={originCoverageCheck}
                destination={destCoverageCheck}
                variant="subtle"
              />
              {noInstant ? (
                <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-10 h-10 rounded-full bg-secondary grid place-items-center"><Search className="w-4 h-4" /></div>
                    <div>
                      <p className="text-sm font-semibold">Aucun départ instantané sur ce trajet</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Pas de tarif instantané affiché. Notre équipe vous propose un devis personnalisé sous 2 h ouvrées.
                      </p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setManualQuoteOpen(true)}
                    className="w-full inline-flex items-center justify-center rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition">
                    Demander un devis sur mesure
                  </button>
                </div>
              ) : (
                <>
                  {/* ── Choix Standard / Express (AIR) — Groupage seul (SEA/ROAD) ── */}
                  <div className={cards.length > 1 ? 'grid sm:grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3'}>
                    {cards.map(c => {
                      const active = priority === c.id;
                      const isStandard = c.id === 'normal';
                      const perksMobile = c.perks.slice(0, 2);
                      const perksDesktop = c.perks.slice(0, 3);
                      return (
                        <button key={c.id} type="button"
                          onClick={() => {
                            setPriority(c.id);
                            if (c.id === 'express') setTransportMode('AIR');
                          }}
                          className={`text-left rounded-2xl border-2 p-5 transition-all relative ${
                            active
                              ? 'border-[#F5C518] bg-card shadow-[0_0_0_2px_rgba(245,197,24,0.15)]'
                              : 'border-border bg-card hover:border-foreground/40'
                          }`}>
                          {isStandard ? (
                            <span className="absolute -top-2 right-3 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
                              style={{ background: '#22C55E', color: '#fff' }}>
                              Recommandé
                            </span>
                          ) : (
                            <span className="absolute -top-2 right-3 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
                              style={{ background: '#F5C518', color: '#0D1B2A' }}>
                              Le plus rapide
                            </span>
                          )}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {c.icon}
                              <p className="text-base font-bold truncate">{c.label}</p>
                            </div>
                            {active && <CheckCircle2 className="w-4 h-4 shrink-0 text-[#F5C518]" />}
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{c.tagline}</p>

                          <div className="mt-4">
                            <span className="block text-xl sm:text-2xl font-bold tabular-nums whitespace-nowrap leading-tight">
                              {formatLocalAmount(c.price, originProfile)}
                            </span>
                            {outsideDakar && fraisEnlevement.surcharge > 0 && (
                              <span className="block mt-0.5 text-[11px] text-muted-foreground">
                                dont +{formatFcfa(fraisEnlevement.surcharge)} déplacement hors zone
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {c.eta}
                          </p>

                          <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                            {perksMobile.map(p => (
                              <li key={`m-${p}`} className="sm:hidden flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-current opacity-60" /> {p}
                              </li>
                            ))}
                            {perksDesktop.map(p => (
                              <li key={`d-${p}`} className="hidden sm:flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-current opacity-60" /> {p}
                              </li>
                            ))}
                          </ul>
                        </button>
                      );
                    })}
                  </div>

                  {/* Conteneur complet — SEA uniquement, sur devis */}
                  {transportMode === 'SEA' && (
                    <div className="rounded-2xl border-2 border-dashed border-border bg-secondary/30 p-4 space-y-2">
                      <div className="flex items-start gap-3">
                        <Ship className="w-5 h-5 shrink-0 mt-0.5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold">Conteneur complet — sur devis</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Volumes &gt; 5 CBM : tarif négocié, conteneur 20' ou 40' dédié.
                            {cbmTotal > 0 && (
                              <> Votre volume actuel : <strong className="tabular-nums">{cbmTotal.toFixed(3)} m³</strong>{cbmTotal > 5 ? ' — éligible.' : ' — palettisez pour atteindre 5 CBM.'}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setManualQuoteOpen(true)}
                        className="w-full inline-flex items-center justify-center rounded-full border-2 border-foreground text-foreground px-5 py-2 text-xs font-semibold hover:bg-foreground hover:text-background transition">
                        Demander un devis conteneur complet
                      </button>
                    </div>
                  )}


                  {weight >= 30 && priority === 'express' && (
                    <p className="text-[11px] text-muted-foreground">
                      Pour {weight} kg, le mode Standard peut diviser le coût par 2.
                    </p>
                  )}

                  {/* ── Choix du départ — liste compacte ── */}
                  {options.length >= 1 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {options.length > 1 ? `${options.length} départs disponibles` : 'Départs disponibles'}
                        </p>
                        {options.length > 1 && chosen && (
                          <span className="text-[10px] text-muted-foreground">Touchez pour choisir</span>
                        )}
                      </div>
                      <div role="radiogroup" aria-label="Choix du départ" className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
                        {(() => {
                          const priorityLabel = priority === 'express' ? 'Express ⚡' : 'Standard';
                          const priorityDelay = getDeliveryDelay(destCity?.city, priority === 'express' ? 'express' : 'standard');
                          const priorityEtaLabel = priorityDelay.label;
                          const priorityEtaMaxMatch = /(\d+)\s*[–-]\s*(\d+)/.exec(priorityEtaLabel);
                          const priorityEtaMaxDays = priorityEtaMaxMatch
                            ? Number(priorityEtaMaxMatch[2])
                            : Number((priorityEtaLabel.match(/\d+/) || [0])[0]) || 0;
                          return options.map((opt, idx) => {
                            const active = chosen?.id === opt.id;
                            const dep = opt.departure_date
                              ? new Date(opt.departure_date + 'T00:00:00')
                              : null;
                            const arr = dep && priorityEtaMaxDays
                              ? new Date(dep.getTime() + priorityEtaMaxDays * 86_400_000)
                              : null;
                            const isFirst = idx === 0 && options.length > 1;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => setChosen(opt)}
                                className={cn(
                                  'w-full text-left px-4 py-3 flex items-center gap-3 transition-colors',
                                  active ? 'bg-[#F5C518]/[0.07]' : 'hover:bg-secondary/40'
                                )}
                              >
                                {/* Radio indicator */}
                                <span
                                  aria-hidden
                                  className={cn(
                                    'shrink-0 w-4 h-4 rounded-full border-2 grid place-items-center transition-colors',
                                    active ? 'border-[#F5C518]' : 'border-muted-foreground/40'
                                  )}
                                >
                                  {active && <span className="w-2 h-2 rounded-full bg-[#F5C518]" />}
                                </span>
                                {/* Icon */}
                                <span className={cn('shrink-0', active ? 'text-foreground' : 'text-muted-foreground')}>
                                  {OPTION_ICONS[opt.id as keyof typeof OPTION_ICONS] ?? <Plane className="w-4 h-4" />}
                                </span>
                                {/* Date + label */}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-sm font-semibold truncate">
                                      {dep ? dep.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : opt.label}
                                      {arr && (
                                        <span className="text-muted-foreground font-normal">
                                          {' '}→ {arr.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                        </span>
                                      )}
                                    </p>
                                    {isFirst && (
                                      <span className="text-[9px] font-semibold uppercase tracking-wide rounded-full px-1.5 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                        Le plus tôt
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                    {priorityLabel} · {priorityEtaLabel}
                                  </p>
                                </div>
                                {active && <CheckCircle2 className="w-4 h-4 shrink-0 text-[#F5C518]" />}
                              </button>
                            );
                          });
                        })()}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Délai et libellé suivent le mode <span className="font-medium text-foreground">{priority === 'express' ? 'Express' : 'Standard'}</span> choisi ci-dessus · tarif total dans le récapitulatif.
                      </p>
                    </div>
                  )}


                  <NextDepartureNotice date={next_departure_date} trailing="Suivi inclus" />
                  <StepSupportLink />
                </>
              )}
            </div>
          );
        })()}
      </FlowSection>
      </div>
      )}



      {/* ─── Step 6 — Protection colis (toggle OFF par défaut) ─── */}
      {showInsuranceStep && (
        routeOk && stepIsFuture(6) ? (
          <div className="mt-6"><LockedStep step={6} total={7} title="Protection colis" /></div>
        ) : (

        <FlowSection
          revealed={routeOk}
          step={6}
          total={7}
          title="Protection colis"
          hint={declaredLocal
            ? `Valeur déclarée : ${declaredLocal} ${originProfile.currencySymbol}`
            : 'Optionnel — protégez votre envoi contre la perte ou les dommages.'}
        >
          {(() => {
            const insuranceOn = insurance !== 'none';
            const declaredFcfa = declaredFcfaForInsurance;
            const recommended = declaredFcfa > 50000;
            const stdFcfa = Math.max(Math.round(declaredFcfa * 0.005), 500);
            const premFcfa = Math.max(Math.round(declaredFcfa * 0.01), 1000);
            return (
              <div className="space-y-4 max-w-xl">
                {/* Toggle principal */}
                <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
                  <Switch
                    checked={insuranceOn}
                    onCheckedChange={(v) => setInsurance(v ? 'standard' : 'none')}
                    aria-label="Activer la protection colis"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">Protéger mon colis</p>
                      {recommended && (
                        <span
                          className="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5"
                          style={{ background: 'rgba(245,197,24,0.15)', color: '#F5C518' }}
                        >
                          Recommandé pour ce colis
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {insuranceOn
                        ? 'Choisissez le niveau de couverture ci-dessous.'
                        : 'Sans protection, les risques sont à votre charge.'}
                    </p>
                  </div>
                </div>

                {/* Options affichées seulement si ON */}
                {insuranceOn && (
                  <div className="space-y-2.5">
                    {[
                      {
                        id: 'standard' as const,
                        label: 'Standard',
                        rate: '0,5 % de la valeur déclarée',
                        desc: 'Remboursement si perte totale',
                        priceFcfa: stdFcfa,
                        minLabel: 'min. 500 FCFA',
                      },
                      {
                        id: 'premium' as const,
                        label: 'Premium',
                        rate: '1 % de la valeur déclarée',
                        desc: 'Remboursement perte + dommages',
                        priceFcfa: premFcfa,
                        minLabel: 'min. 1 000 FCFA',
                      },
                    ].map((opt) => {
                      const active = insurance === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setInsurance(opt.id)}
                          aria-pressed={active}
                          className="w-full text-left rounded-xl border-2 px-4 py-3.5 transition-all flex items-start justify-between gap-3"
                          style={{
                            borderColor: active ? '#F5C518' : 'hsl(var(--border))',
                            background: active ? 'rgba(245,197,24,0.08)' : 'hsl(var(--card))',
                          }}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                              {active && <CheckCircle2 className="w-4 h-4" style={{ color: '#F5C518' }} />}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{opt.rate}</p>
                            <p className="text-xs text-foreground/80 mt-1">{opt.desc}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold tabular-nums text-foreground">
                              + {new Intl.NumberFormat('fr-FR').format(opt.priceFcfa)} FCFA
                            </p>
                            <p className="text-[10px] text-muted-foreground">{opt.minLabel}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
          <StepSupportLink />
        </FlowSection>
        )
      )}



      {/* ─── Step 7 — Coordonnées + paiement + récapitulatif ─── */}
      {routeOk && stepIsFuture(7) ? (
        <div className="mt-6"><LockedStep step={7} total={7} title="Paiement & récapitulatif" /></div>
      ) : (
      <div id="section-final" className={cn('rounded-2xl transition-shadow', submitAttempted && sectionErrors['section-final'] && 'ring-2 ring-red-400/70 ring-offset-4 ring-offset-background')}>
      <FlowSection revealed={routeOk} step={7} total={7} title="Confirmer et payer" hint="Vérifiez le résumé puis choisissez votre mode de règlement.">


        <div className="max-w-2xl space-y-5">
          {/* Coordonnées expéditeur — rappel si manquant */}
          {(!senderName.trim() || !senderPhone.trim()) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Coordonnées expéditeur manquantes — complétez-les en haut de page (bloc d'identité).</span>
            </div>
          )}

          {/* ─── Section 1 — Récapitulatif de commande ─── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Récapitulatif de commande
            </p>
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              {/* Header avec itinéraire */}
              <div className="bg-foreground text-background px-5 py-4">
                <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-background/60">Itinéraire</p>
                <p className="mt-1 text-base font-semibold">
                  {originCity && destCity ? `${originProfile.flag} ${originCity.city} → ${destProfile.flag} ${destCity.city}` : '—'}
                </p>
                <p className="mt-0.5 text-[11px] text-background/70">
                  {TRANSPORT_MODES.find(t => t.id === transportMode)?.label} · {priority === 'express' ? 'Express' : 'Standard'}
                  {next_departure_date && ` · Départ ${formatDepartureDate(next_departure_date, { day: 'numeric', month: 'short' })}`}
                </p>
              </div>

              {/* Personnes */}
              <RecapGroup
                icon={<User className="w-3.5 h-3.5" />}
                title="Personnes"
                onEdit={() => goToStep(2)}
                incomplete={!recipientOk || !senderName.trim() || !senderPhone.trim()}
                missingLabel="à compléter"
              >
                <RecapRow label="Expéditeur" value={senderName || senderPhone
                  ? `${senderName || '—'} · ${senderPhone || '—'} · ${originCity?.city ?? '—'}`
                  : '— (à renseigner)'} />
                <RecapRow label="Destinataire" value={recipientName || recipientPhone
                  ? `${recipientName || '—'} · ${recipientPhone || '—'} · ${destCity?.city ?? '—'}`
                  : '— (à renseigner)'} />
              </RecapGroup>

              {/* Collecte */}
              <RecapGroup
                icon={<MapPin className="w-3.5 h-3.5" />}
                title="Collecte & livraison"
                onEdit={() => goToStep(1)}
                incomplete={!collecteOk}
                missingLabel="à compléter"
              >
                <RecapRow label="Collecte" value={pickupDate ? `${pickupDate} · ${pickupSlot === 'morning' ? 'Matin' : 'Après-midi'}` : '—'} />
                {pickupAddress && <RecapRow label="Adresse" value={pickupAddress} />}
                {deliveryAddress && <RecapRow label="Livraison" value={deliveryAddress} />}
              </RecapGroup>

              {/* Colis */}
              <RecapGroup
                icon={<Package className="w-3.5 h-3.5" />}
                title="Colis"
                onEdit={() => goToStep(3)}
                incomplete={!packageOk || !goodsOk}
                missingLabel="à compléter"
              >
                <RecapRow label="Article" value={`${GOODS_TYPES.find(g => g.id === goodsType)?.label ?? '—'} — ${description || '—'}`} />
                <RecapRow label="Poids" value={`${weight} kg · ${parcelCount} colis`} />
                <RecapRow label="Assurance" value={insurance === 'none' ? 'Sans' : insurance === 'standard' ? 'Standard' : 'Premium'} />
              </RecapGroup>

              {/* Coût */}
              {(() => {
                const breakdown = pricing;
                const toEur = toEurFcfa;
                return (
                  <div className="px-5 py-4 bg-secondary/30 space-y-1.5">
                    <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-muted-foreground mb-2 inline-flex items-center gap-1.5">
                      <CreditCard className="w-3 h-3" /> Détail du coût · {priority === 'express' ? 'Express' : 'Standard'}
                    </p>
                    {breakdown.lines
                      // Correction 2 : on ne montre PAS la ligne "Protection colis"
                      // quand l'utilisateur n'a pas activé d'assurance.
                      .filter((l) => !(insurance === 'none' && l.label === 'Protection colis'))
                      .map((l) => (
                        <RecapRow key={l.label} label={l.label} value={formatLocalAmount(toEur(l.amountFcfa), originProfile)} />
                      ))}
                    {/* Correction 3 — Ligne enlèvement (statut clair selon zone) */}
                    {fraisEnlevement.zone === 'dakar_centre' ? (
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">Enlèvement Dakar</span>
                        <span className="font-medium text-emerald-500">Inclus</span>
                      </div>
                    ) : fraisEnlevement.zone === 'dakar_banlieue' ? (
                      <RecapRow
                        label="Enlèvement zone élargie"
                        value={`+ ${formatLocalAmount(toEur(5000), originProfile)}`}
                      />
                    ) : (
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">Dépôt hub Yobbanté</span>
                        <span className="font-medium text-muted-foreground">À confirmer</span>
                      </div>
                    )}
                    {deliveryMode === 'home_delivery' && deliveryCarrier && (
                      <RecapRow
                        label={`Livraison ${destCity?.city ?? ''} (${deliveryCarrier})`}
                        value="Sur devis"
                      />
                    )}
                    <div className="pt-2 mt-1 border-t border-border/60">
                      <RecapRow label="Sous-total HT" value={formatLocalAmount(toEur(breakdown.sous_total_ht), originProfile)} />
                      <RecapRow label={`TVA ${Math.round(breakdown.tva_rate * 100)} %`} value={formatLocalAmount(toEur(breakdown.tva), originProfile)} />
                    </div>
                    <div className="pt-2.5 mt-1 border-t border-border">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-bold uppercase tracking-wider" style={{ color: '#F5C518' }}>Total TTC</span>
                        <span className="text-xl sm:text-2xl font-bold tabular-nums" style={{ color: '#F5C518' }}>
                          {formatLocalAmount(toEur(breakdown.total_ttc), originProfile)}
                        </span>
                      </div>
                    </div>
                    {/* Correction 2 — note de base affichée si pas d'assurance optionnelle */}
                    {insurance === 'none' && (
                      <p className="mt-1.5 text-[11px] text-muted-foreground italic">
                        Protection de base incluse (voir conditions).
                      </p>
                    )}
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {chosen ? 'Prix confirmé · Transporteur assigné.' : 'Prix estimatif — confirmé après pesée. Si différence > 10 %, notification avant facturation.'}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground italic">
                      Inclut la collecte, le dédouanement et la livraison à destination.
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ─── Section 2 — Mode de règlement ─── */}
          <div>
            <p className="text-sm font-semibold text-foreground">Comment souhaitez-vous payer ?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Le paiement s'effectue après pesée réelle de votre colis.
            </p>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {PAYMENT_METHODS.map(m => {
                const active = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    aria-pressed={active}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 px-3 py-4 transition-all"
                    style={{
                      borderColor: active ? '#F5C518' : 'hsl(var(--border))',
                      background: active ? 'rgba(245,197,24,0.08)' : 'hsl(var(--card))',
                    }}
                  >
                    <span style={{ color: active ? '#F5C518' : 'hsl(var(--foreground))' }}>{m.icon}</span>
                    <span className="text-xs font-semibold">{m.label}</span>
                    <span className="text-[10px] font-medium text-muted-foreground">{m.sub}</span>
                    {active && (
                      <span className="text-[10px] font-medium" style={{ color: '#F5C518' }}>Sélectionné</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <DoorToDoorBanner origin={originCoverageCheck} destination={destCoverageCheck} detailed />
        </div>
      </FlowSection>
      </div>
      )}



      {(() => {
        const LAST_STEP = 7;
        const isLastStep = currentStep >= LAST_STEP;
        const smartCtaLabel = isLastStep
          ? (allReady ? 'Confirmer ma commande' : 'Compléter les coordonnées')
          : 'Continuer';
        const STEP_SECTION_ID: Record<number, string> = {
          1: 'section-package',
          2: 'section-goods',
          3: 'tarifs',
          4: 'section-collecte',
          5: 'section-recipient',
          7: 'section-final',
        };
        function handleSummaryAction() {
          if (!isLastStep) {
            const valid = stepValidity[currentStep];
            if (!valid) {
              setSubmitAttempted(true);
              scrollToFirstError(STEP_SECTION_ID[currentStep]);
              setTimeout(() => {
                toast.error('Étape incomplète', { description: 'Remplissez les champs surlignés en rouge.' });
              }, 350);
              return;
            }
            advanceFromStep(currentStep);
          } else if (allReady) {
            submit();
          } else {
            setSubmitAttempted(true);
            scrollToFirstError();
            setTimeout(() => {
              toast.error('Étapes incomplètes', { description: 'Les champs manquants sont surlignés en rouge.' });
            }, 350);
          }
        }

        return (

      <LiveSummaryBar
        visible={routeOk}
        summary={summary || `${originProfile.flag} ${originCity?.city ?? ''} → ${destCity ? `${destProfile.flag} ${destCity.city}` : '…'}`}
        ctaLabel={smartCtaLabel}
        onSubmit={handleSummaryAction}
        submitting={submitting}
        priceLabel={pricing.total_ttc > 0 ? formatLocalAmount(toEurFcfa(pricing.total_ttc), originProfile) : undefined}
        priceHint={destCity
          ? `${priority === 'express' ? 'Express' : 'Standard'} · ${getDeliveryDelay(destCity.city, priority === 'express' ? 'express' : 'standard').label}`
          : 'Estimation'}
        sideContent={next_departure_date ? `Départ ${formatDepartureDate(next_departure_date, { day: 'numeric', month: 'short' })}` : undefined}
        topCard={
          originCity && destCity ? (
            <PriorityCarousel
              priority={priority === 'express' ? 'express' : 'normal'}
              standardPrice={toEurFcfa(pricing.prix_standard)}
              expressPrice={toEurFcfa(pricing.prix_express)}
              standardEta={`Livraison en ${getDeliveryDelay(destCity.city, 'standard').label}`}
              expressEta={`Livraison en ${getDeliveryDelay(destCity.city, 'express').label}`}
              originProfile={originProfile}
              outsideDakarSurchargeFcfa={fraisEnlevement.zone !== 'dakar_centre' ? fraisEnlevement.surcharge : 0}
              onSelect={(p) => {
                setPriority(p);
                if (p === 'express') setTransportMode('AIR');
              }}
            />
          ) : undefined
        }
        details={
          (() => {
            const bd = pricing;
            const toEur = toEurFcfa;
            return (
              <div className="space-y-2 text-sm">

                <RecapRow label="Trajet" value={originCity && destCity ? `${originCity.city} → ${destCity.city}` : '—'} />
                <RecapRow label="Poids" value={`${weight} kg · ${parcelCount} colis`} />
                <RecapRow label="Transport" value={`${TRANSPORT_MODES.find(t => t.id === transportMode)?.label} · ${priority === 'express' ? 'Express' : 'Standard'}`} />
                <div className="pt-2 mt-1 border-t border-border/60 space-y-1.5">
                  {bd.lines.map(l => (
                    <RecapRow key={l.label} label={l.label} value={formatLocalAmount(toEur(l.amountFcfa), originProfile)} />
                  ))}
                </div>
                <div className="pt-2 mt-1 border-t border-border/60">
                  <RecapRow label="Sous-total HT" value={formatLocalAmount(toEur(bd.sous_total_ht), originProfile)} />
                  <RecapRow label={`TVA ${Math.round(bd.tva_rate * 100)} %`} value={formatLocalAmount(toEur(bd.tva), originProfile)} />
                </div>
                <div className="pt-2 mt-1 border-t border-border">
                  <RecapRow label="Total TTC" value={formatLocalAmount(toEur(bd.total_ttc), originProfile)} strong />
                </div>
                <p className="text-[11px] text-muted-foreground pt-1">Estimation non contractuelle — confirmée après pesée.</p>
              </div>
            );
          })()
        }
      />
    );
  })()}

      {originCity && destCity && (
        <ManualQuoteDialog
          open={manualQuoteOpen} onOpenChange={setManualQuoteOpen}
          prefill={{
            origin_country: originCity.country, origin_city: originCity.city,
            destination_country: destCity.country, destination_city: destCity.city,
            weight_kg: weight, transport_mode: transportMode, priority,
            sender_name: senderName || null,
            sender_phone: senderPhone || null,
            sender_address: pickupAddress || null,
            recipient_name: recipientName || null,
            recipient_phone: recipientPhone || null,
            recipient_address: deliveryAddress || null,
            description: description || null,
            declared_value: declaredLocal || null,
            declared_currency: originProfile?.currencySymbol || null,
            parcel_count: parcelCount,
            goods_type: goodsType || null,
            insurance,
            pickup_date: pickupDate || null,
            pickup_slot: pickupSlot || null,
          }}
          defaultName={senderName || recipientName}
          defaultPhone={senderPhone || recipientPhone}
        />
      )}

      {/* Modale interstitielle — auth Google/Apple sans redirect brutal */}
      <AuthInterstitialModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        resumePath="/expedier/envoyer"
      />
    </FlowShell>
  );
}

// ─────────────────────────── Sub-components ───────────────────────────

function PriorityCarousel({
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

  // Sync scroll position when priority changes externally (e.g. user picked
  // Express on the in-page card, then opens the sticky recap sheet).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const child = el.children[activeIdx] as HTMLElement | undefined;
    if (!child) return;
    const targetLeft = child.offsetLeft - el.offsetLeft;
    if (Math.abs(el.scrollLeft - targetLeft) < 4) return;
    // Mute onScroll while the programmatic scroll animates — otherwise the
    // intermediate positions get interpreted as the user choosing Standard
    // and we silently reset the parent's priority back to 'normal'.
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

function RecapRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={strong ? 'text-base font-bold tabular-nums' : 'font-medium text-right text-sm'}>{value}</span>
    </div>
  );
}

function RecapGroup({
  icon, title, children, onEdit, incomplete, missingLabel,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  onEdit?: () => void;
  incomplete?: boolean;
  missingLabel?: string;
}) {
  return (
    <div className={cn('px-5 py-4 border-t border-border space-y-1.5', incomplete && 'bg-danger/5')}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[10px] uppercase tracking-[0.18em] font-medium inline-flex items-center gap-1.5 text-muted-foreground">
          {incomplete && <span className="w-1.5 h-1.5 rounded-full bg-danger" aria-hidden />}
          <span className="inline-flex items-center gap-1.5">{icon} {title}</span>
          {incomplete && (
            <span className="ml-1 text-[10px] normal-case tracking-normal text-danger font-medium">
              · {missingLabel ?? 'champs manquants'}
            </span>
          )}
        </p>
        {onEdit && (
          <button type="button" onClick={onEdit}
            className="text-[11px] font-medium text-foreground hover:underline underline-offset-2 shrink-0">
            Modifier
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function EmailRecapCard({ dossierId }: { dossierId: string }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const onSend = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Email invalide'); return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-confirmation-email', {
        body: { dossier_id: dossierId, email },
      });
      if (error) throw error;
      setSent(true);
      toast.success('Récapitulatif envoyé !');
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur d'envoi");
    } finally { setSending(false); }
  };
  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <p className="text-sm font-semibold mb-1">📧 Recevoir votre récapitulatif</p>
      <p className="text-[11px] text-muted-foreground mb-3">Recommandé si vous n'avez pas de compte Yobbanté.</p>
      {sent ? (
        <p className="text-sm text-emerald-600">Envoyé ✓</p>
      ) : (
        <div className="flex gap-2">
          <input type="email" inputMode="email" placeholder="votre@email.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button onClick={onSend} disabled={sending}
            className="rounded-lg bg-foreground text-background px-3 py-2 text-sm font-semibold disabled:opacity-60">
            {sending ? '…' : 'Envoyer →'}
          </button>
        </div>
      )}
    </div>
  );
}

function StepCollapsed({ title, lines, onEdit }: { title: string; lines: string[]; onEdit: () => void }) {
  return (
    <button type="button" onClick={onEdit}
      className="w-full text-left rounded-2xl border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <p className="text-sm font-semibold text-foreground truncate">{title}</p>
        </div>
        {lines.length > 0 && (
          <p className="mt-1 text-[11.5px] text-muted-foreground line-clamp-2 pl-5">
            {lines.join(' · ')}
          </p>
        )}
      </div>
      <span className="text-[11px] underline underline-offset-2 text-muted-foreground shrink-0">Modifier</span>
    </button>
  );
}

function LockedStep({ step, total, title }: { step: number; total: number; title: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-3 flex items-center justify-between gap-3 opacity-70">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-muted-foreground">
          Étape {step} / {total}
        </p>
        <p className="mt-0.5 text-sm font-medium text-muted-foreground truncate">{title}</p>
      </div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">À venir</span>
    </div>
  );
}

function StepSupportLink() {
  return (
    <div className="mt-5 flex items-center justify-center">
      <a
        href="https://wa.me/221786078080?text=Bonjour%20Yobbant%C3%A9%2C%20j%27ai%20besoin%20d%27aide%20pour%20ma%20commande%20en%20cours"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
      >
        Besoin d'aide ? → Contacter le support
      </a>
    </div>
  );
}



function AddressField({
  label, value, onChange, placeholder, invalid,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; invalid?: boolean }) {
  return (
    <label className="block">
      <span className={cn('block text-xs mb-1.5 font-medium', invalid ? 'text-danger' : 'text-muted-foreground')}>{label}</span>
      <textarea
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} rows={2}
        aria-invalid={invalid || undefined}
        className={cn(
          'w-full border-2 rounded-xl px-4 py-3 text-sm bg-card placeholder:text-muted-foreground/60 focus:outline-none transition-all resize-none',
          invalid ? 'border-danger focus:border-danger' : 'border-border focus:border-foreground',
        )}
      />
    </label>
  );
}

function CoverageBadge({ level, city, loading }: { level: 'direct' | 'partner' | 'none'; city: string; loading: boolean }) {
  if (loading) return <div className="h-9 w-64 rounded-xl bg-secondary/40 animate-pulse" />;
  if (level === 'direct') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900 inline-flex items-center gap-2">
        <CheckCircle2 className="w-3.5 h-3.5" /> Collecte disponible à {city}
      </div>
    );
  }
  if (level === 'partner') {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs text-blue-900 inline-flex items-center gap-2">
        <ArrowRight className="w-3.5 h-3.5" /> Collecte via partenaire local — délai +24h
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 flex items-center gap-2 flex-wrap">
      <AlertTriangle className="w-3.5 h-3.5" />
      Zone non couverte directement.
      <a
        href={`https://wa.me/221786078080?text=${encodeURIComponent("Bonjour Yobbanté, je souhaite expédier un colis mais ma zone semble non couverte. Pouvez-vous m'aider ?")}`}
        target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-1 font-semibold underline">
        <MessageCircle className="w-3 h-3" /> Nous contacter
      </a>
    </div>
  );
}

// ─── Quartier Dakar picker (dropdown groupé) ───────────────────────────
function QuartierDakarPicker({
  value, onChange, label,
}: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <label className="block">
      <span className="block text-xs mb-1.5 font-medium text-muted-foreground">
        {label ?? 'Quartier de collecte'} <span className="text-muted-foreground/60">(optionnel)</span>
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-2 border-border rounded-xl px-4 py-3 text-sm bg-card focus:outline-none focus:border-foreground transition-all"
      >
        <option value="">— Sélectionner un quartier —</option>
        {QUARTIER_GROUPS.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.quartiers.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

// ─── Zone Dakar badge — affiche frais d'enlèvement / livraison ─────────
function ZoneBadge({
  frais, mode = 'enlevement',
}: {
  frais: { zone: DakarZoneCategory; surcharge: number; gratuit: boolean; message: string };
  mode?: 'enlevement' | 'livraison';
}) {
  if (frais.gratuit) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-[12px] text-emerald-300 inline-flex items-center gap-2">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {mode === 'livraison'
          ? 'Livraison gratuite à Dakar centre'
          : 'Enlèvement gratuit à Dakar centre'}
      </div>
    );
  }
  const icon = frais.zone === 'hors_dakar' ? '⚠️' : '📍';
  const label = mode === 'livraison'
    ? (frais.zone === 'hors_dakar' ? 'Livraison hors Dakar' : 'Livraison en banlieue')
    : (frais.zone === 'hors_dakar' ? 'Adresse hors Dakar' : 'Zone périphérique Dakar');
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-[12px] text-amber-300 flex items-start gap-2">
      <span aria-hidden>{icon}</span>
      <span>
        {label} — frais de déplacement&nbsp;:
        <strong className="ml-1">+ {formatFcfa(frais.surcharge)}</strong>
      </span>
    </div>
  );
}
