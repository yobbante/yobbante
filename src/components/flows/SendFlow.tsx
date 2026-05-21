import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Package, FileText, Boxes, Zap, Sparkles, ShieldCheck, MapPin, Phone, User,
  Search, Building2, Truck, Plane, Ship, Calendar as CalendarIcon, AlertTriangle,
  CheckCircle2, MessageCircle, Smartphone, CreditCard, ArrowRight, Globe2, Clock,
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
import { getDepartureCountdown, formatDepartureDate } from '@/lib/departureTime';
import { DoorToDoorBanner } from '@/components/flows/DoorToDoorBanner';
import { NextDepartureNotice } from '@/components/flows/NextDepartureNotice';
import { supabase } from '@/integrations/supabase/client';
import { ORIGIN_CITIES, DESTINATION_CITIES, findCity, POPULAR_ORIGIN_IDS, POPULAR_DEST_IDS, HUB_DAKAR } from '@/lib/worldCities';
import { DakarHubLock } from './FlowPrimitives';
import { COUNTRY_OPTIONS, getProfile, formatLocalAmount, eurFromLocal, type CountryProfile } from '@/lib/countryProfile';
import { cn } from '@/lib/utils';
import type { WarehouseCountry } from '@/lib/types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

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
  { id: 'wave',          label: 'Wave',          icon: <Smartphone className="w-4 h-4" /> },
  { id: 'orange_money',  label: 'Orange Money',  icon: <Smartphone className="w-4 h-4" /> },
  { id: 'card',          label: 'Carte bancaire', icon: <CreditCard className="w-4 h-4" /> },
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
  const [pickupDate, setPickupDate]       = useState<string>(preset?.departure_date ?? '');
  const [pickupSlot, setPickupSlot]       = useState<typeof TIME_SLOTS[number]['id'] | null>(null);
  // Step 3 — destination
  const [destCityId, setDestCity]         = useState<string | null>(presetDestCityId);
  // Step 4 — recipient
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [deliveryAddress, setDelivery]    = useState('');
  // Step 5 — package description
  const [description, setDescription]     = useState('');
  const [declaredLocal, setDeclaredLocal] = useState('');
  const [weight, setWeight]               = useState(preset?.weight ?? 5);
  const [weightTouched, setWeightTouched] = useState<boolean>(!!preset?.weight);
  const [parcelCount, setParcelCount]     = useState(1);
  // Step 6 — goods type
  const [goodsType, setGoodsType]         = useState<GoodsId | null>(null);
  const [goodsAutoDetected, setGoodsAutoDetected] = useState<{ id: GoodsId; confidence: 'high'|'medium'|'low'; rationale: string } | null>(null);
  const [goodsManualOverride, setGoodsManualOverride] = useState(false);
  const [goodsDetecting, setGoodsDetecting] = useState(false);
  // Step 7 — transport
  const [transportMode, setTransportMode] = useState<typeof TRANSPORT_MODES[number]['id']>(preset?.transport ?? 'AIR');
  const [priority, setPriority]           = useState<typeof PRIORITIES[number]['id']>('normal');
  // Step 8 — insurance
  const [insurance, setInsurance]         = useState<'none' | 'standard' | 'premium'>('standard');
  // Step 9 — payment
  const [paymentMethod, setPaymentMethod] = useState<string>('wave');
  // Sender contact
  const [senderName, setSenderName]       = useState('');
  const [senderPhone, setSenderPhone]     = useState('');
  // Identité de la personne qui remplit le formulaire
  // 'sender' = je suis dans la ville d'origine (j'expédie)
  // 'recipient' = je suis dans la ville de destination (je recevrai)
  // 'third'  = je remplis pour quelqu'un d'autre
  const [userRole, setUserRole] = useState<'sender' | 'recipient' | 'third'>('sender');
  const [identityCollapsed, setIdentityCollapsed] = useState(false);
  // Tracks which step is currently being edited (null = use collapsed summaries when complete)
  const [editingStep, setEditingStep] = useState<number | null>(null);
  // Match + submit
  const [chosen, setChosen]               = useState<MatchOptionView | null>(null);
  const [submitting, setSubmitting]       = useState(false);
  const [confirmed, setConfirmed]         = useState<{ reference: string; price: number; eta: string } | null>(null);
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

  // ── Pricing breakdown (in EUR for internal math)
  // Le moteur gère TOUT (zone, poids, urgency, supply, marge) → pas de majoration locale.
  const transportPriceEur = quote ? Math.round(quote.price_eur) : chosen ? Math.round(chosen.price_eur) : 0;
  const insuranceCostEur = insurance === 'standard' ? 3 : insurance === 'premium' ? 5 : 0;
  const priorityCostEur  = 0; // déprécié — urgency_mult appliqué côté moteur
  const totalEur = transportPriceEur + insuranceCostEur;
  const declaredEur = declaredLocal ? eurFromLocal(Number(declaredLocal) || 0, originProfile) : 0;
  const showInsuranceStep = declaredEur >= 100 || (goodsType && ['high_value', 'electronics', 'fragile'].includes(goodsType));

  // Auto-suggest mode based on weight
  useEffect(() => {
    if (weightTouched && weight >= 30 && transportMode === 'AIR' && goodsType !== 'documents') {
      // hint only — don't override
    }
  }, [weight, weightTouched, transportMode, goodsType]);

  // ── AI: classify goods type from description (debounced)
  useEffect(() => {
    const desc = description.trim();
    if (desc.length < 4 || goodsManualOverride) return;
    const handle = setTimeout(async () => {
      try {
        setGoodsDetecting(true);
        const { data, error } = await supabase.functions.invoke('classify-goods', {
          body: { description: desc, declared_value_eur: declaredEur || null },
        });
        if (error) throw error;
        const id = data?.goods_type as GoodsId | null;
        const conf = data?.confidence as 'high'|'medium'|'low' | undefined;
        if (id && GOODS_TYPES.some(g => g.id === id) && conf) {
          setGoodsAutoDetected({ id, confidence: conf, rationale: data?.rationale ?? '' });
          // Auto-select only when confidence is high or medium
          if ((conf === 'high' || conf === 'medium') && !goodsManualOverride) {
            setGoodsType(id);
          }
        }
      } catch (e) {
        console.warn('classify-goods failed', e);
      } finally {
        setGoodsDetecting(false);
      }
    }, 700);
    return () => clearTimeout(handle);
  }, [description, declaredEur, goodsManualOverride]);

  // ── Validation (sections are all visible, gates only block submit)
  const routeOk = !!originCity && !!destCity;
  const collecteOk = routeOk && !!pickupAddress.trim() && !!pickupDate && !!pickupSlot;
  const recipientOk = !!recipientName.trim() && !!recipientPhone.trim() && (destIsSenegal || !!deliveryAddress.trim());
  const packageOk = !!description.trim() && !!declaredLocal && weightTouched;
  const goodsAutoConfident = !!goodsAutoDetected && (goodsAutoDetected.confidence === 'high' || goodsAutoDetected.confidence === 'medium') && !goodsManualOverride;
  const skipGoodsStep = goodsAutoConfident && !!goodsType;
  const goodsOk = !!goodsType;
  const allReady = routeOk && collecteOk && recipientOk && packageOk && goodsOk && !!senderName.trim() && !!senderPhone.trim();

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
  function scrollToFirstError() {
    const firstBadId = (Object.entries(sectionErrors).find(([, bad]) => bad)?.[0]) || null;
    if (!firstBadId) return;
    requestAnimationFrame(() => {
      document.getElementById(firstBadId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async function submit() {
    if (!routeOk || !collecteOk || !recipientOk || !packageOk || !goodsOk || !senderName.trim() || !senderPhone.trim()) {
      setSubmitAttempted(true);
      toast.error('Étapes incomplètes', { description: 'Les champs manquants sont surlignés en rouge.' });
      scrollToFirstError();
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
        saveDraft(DRAFT_KEY, draftSnapshot);
        if (preset) { try { sessionStorage.setItem(PRESET_KEY, JSON.stringify(preset)); } catch {} }
        toast.message('Connectez-vous pour finaliser', {
          description: 'On garde votre départ et votre dossier — vous reprendrez exactement ici.',
        });
        navigate(`/auth?redirect=${encodeURIComponent('/expedier/envoyer?resume=1')}`);
        return;
      }

      const dossier = await createDossier.mutateAsync({
        product_description: `Expédition ${description} — ${originCity.city} → ${destCity.city}`,
        estimated_weight: weight,
        origin_country: originCity.country as WarehouseCountry,
        destination_country: destCity.country,
        app_source: 'expedier',
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
          '',
          '— Expéditeur —',
          `${senderName} · ${senderPhone}`,
          pickupAddress,
          '',
          '— Destinataire —',
          `${recipientName} · ${recipientPhone}${recipientEmail ? ` · ${recipientEmail}` : ''}`,
          deliveryAddress,
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

      setConfirmed({
        reference: dossier.reference,
        price: totalEur,
        eta: matchOption.eta_days,
      });
      clearDraft(DRAFT_KEY);
      try { sessionStorage.removeItem(PRESET_KEY); } catch {}
      toast.success('Expédition confirmée 🚀');
      console.log('WA_INVOKE_START');
      supabase.functions.invoke('send-whatsapp', {
        body: {
          client_name: senderName || 'Client',
          service_type: 'Expédition',
          origin: originCity?.city || originCity?.country || 'Non précisé',
          destination: destCity?.city || destCity?.country || 'Non précisé',
          weight: weight,
          recipient_phone: '+221781221891'
        }
      }).then(({ data, error }) => {
        if (error) console.error('WA_INVOKE_ERROR:', error);
        else console.log('WA_INVOKE_SUCCESS:', JSON.stringify(data));
      });
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
          reference={confirmed.reference}
          title="Expédition enregistrée."
          subtitle={`${originCity?.city} → ${destCity?.city} · ${formatLocalAmount(confirmed.price, originProfile)} · ETA ${confirmed.eta}.`}
          ctaHref="/app" ctaLabel="Voir mon espace"
        />

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
              navigator.clipboard.writeText(confirmed.reference);
              toast.success('Référence copiée');
            }}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card hover:bg-accent transition-colors px-3 py-2.5 text-sm font-medium"
          >
            <FileText className="w-4 h-4 text-primary" /> Copier la réf.
          </button>
          <button
            type="button"
            onClick={() => navigate('/app')}
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
                  <TextField label="Nom complet *" value={identityName} onChange={setIdentityName} placeholder="Votre nom" />
                  <TextField
                    label={`Téléphone * (${isRecipientRole ? destProfile.phonePrefix : originProfile.phonePrefix})`}
                    value={identityPhone} onChange={setIdentityPhone}
                    placeholder={`${isRecipientRole ? destProfile.phonePrefix : originProfile.phonePrefix} · · · · · ·`}
                    type="tel" icon={<Phone className="w-3.5 h-3.5" />} />
                </div>
                {identityName.trim() && identityPhone.trim() && (
                  <button type="button" onClick={() => setIdentityCollapsed(true)}
                    className="text-[11px] underline underline-offset-2 text-muted-foreground hover:text-foreground">
                    Replier ce bloc
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      )}



      {/* ─── Step 1 — Collecte (incl. sender contact when user is recipient/third) ─── */}
      <div id="section-collecte" className={cn('rounded-2xl transition-shadow', submitAttempted && sectionErrors['section-collecte'] && 'ring-2 ring-red-400/70 ring-offset-4 ring-offset-background')}>
      <FlowSection
        revealed={routeOk}
        step={1}
        total={7}
        title={userRole === 'sender' ? 'Collecte du colis' : `Collecte chez l'expéditeur à ${originCity?.city ?? '—'}`}
        hint={userRole === 'sender'
          ? 'Adresse + créneau souhaité pour la prise en charge.'
          : "Renseignez les coordonnées de la personne qui remet le colis et l'adresse où nous le récupérons."}
      >
        {originCity ? (
          collecteOk && editingStep !== 1 ? (
            <StepCollapsed
              title="Collecte programmée"
              lines={[
                `${pickupDate} · ${pickupSlot === 'morning' ? 'Matin' : 'Après-midi'}`,
                pickupAddress,
                userRole !== 'sender' ? `Expéditeur : ${senderName || '—'} · ${senderPhone || '—'}` : null,
              ].filter(Boolean) as string[]}
              onEdit={() => setEditingStep(1)}
            />
          ) : (
            <div className="mt-2 space-y-4 max-w-xl">
              <CoverageBadge level={coverage.level} city={originCity.city} loading={coverage.loading} />

              {/* Sender contact (only when user is NOT the sender) */}
              {userRole !== 'sender' && (
                <div className="rounded-xl border border-border bg-secondary/30 p-3.5 space-y-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Coordonnées de l'expéditeur à {originCity.city}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <TextField label="Nom complet *" value={senderName} onChange={setSenderName}
                      placeholder={`Personne qui remet le colis à ${originCity.city}`} />
                    <TextField label={`Téléphone * (${originProfile.phonePrefix})`} value={senderPhone} onChange={setSenderPhone}
                      placeholder={`${originProfile.phonePrefix} · · · · · ·`} type="tel" icon={<Phone className="w-3.5 h-3.5" />} />
                  </div>
                </div>
              )}

              <AddressField
                label={`Adresse de collecte à ${originCity.city} *`}
                value={pickupAddress} onChange={setPickup}
                placeholder="N°, rue, quartier, code postal…"
              />

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs mb-1.5 font-medium text-muted-foreground inline-flex items-center gap-1.5">
                    <CalendarIcon className="w-3 h-3" /> Date de collecte *
                  </span>
                  <input
                    type="date" value={pickupDate} min={localCalendarMin}
                    onChange={(e) => setPickupDate(e.target.value)}
                    className="w-full border-2 rounded-xl px-4 py-3 text-sm bg-card border-border focus:outline-none focus:border-foreground transition-all"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Délai min {coverage.minLeadHours}h selon votre zone.
                  </p>
                </label>
                <div>
                  <span className="block text-xs mb-1.5 font-medium text-muted-foreground">Créneau *</span>
                  <ChipGroup options={TIME_SLOTS} value={pickupSlot} onChange={(v) => setPickupSlot(v)} />
                </div>
              </div>

              {collecteOk && (
                <button type="button" onClick={() => setEditingStep(null)}
                  className="text-[11px] underline underline-offset-2 text-muted-foreground hover:text-foreground">
                  Valider et replier
                </button>
              )}
            </div>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Sélectionnez l'itinéraire dans la barre pour activer la collecte.</p>
        )}
      </FlowSection>
      </div>


      {/* ─── Step 2 — Recipient ─── */}
      <div id="section-recipient" className={cn('rounded-2xl transition-shadow', submitAttempted && sectionErrors['section-recipient'] && 'ring-2 ring-red-400/70 ring-offset-4 ring-offset-background')}>
      <FlowSection
        revealed={routeOk}
        step={2}
        total={7}
        title={userRole === 'recipient' ? 'Vos coordonnées de livraison' : 'Informations du destinataire'}
        hint={userRole === 'recipient'
          ? 'C\'est vous qui recevrez — vérifiez l\'adresse de livraison.'
          : (destIsSenegal ? 'Au Sénégal, le téléphone fait foi pour la livraison.' : 'Coordonnées complètes pour la livraison.')}
      >
        {recipientOk && editingStep !== 2 ? (
          <StepCollapsed
            title={userRole === 'recipient' ? 'Vous recevrez ce colis' : 'Destinataire confirmé'}
            lines={[
              `${recipientName} · ${recipientPhone}`,
              deliveryAddress || (destIsSenegal ? 'Adresse précisée par téléphone' : ''),
              recipientEmail || null,
            ].filter(Boolean) as string[]}
            onEdit={() => setEditingStep(2)}
          />
        ) : (
          <div className="space-y-3 max-w-xl">
            {userRole === 'recipient' && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[11px] text-emerald-900">
                Vos nom et téléphone ont été repris du bloc d'identité ci-dessus. Complétez juste l'adresse de livraison.
              </p>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <TextField label="Nom complet *" value={recipientName} onChange={setRecipientName} placeholder={`Ex. destinataire à ${destCity?.city ?? '—'}`} />
              <TextField label={`Téléphone * (${destProfile.phonePrefix})`} value={recipientPhone} onChange={setRecipientPhone}
                placeholder={`${destProfile.phonePrefix} 6 · · · · · ·`} type="tel" icon={<Phone className="w-3.5 h-3.5" />} />
            </div>
            <AddressField
              label={destIsSenegal ? `Adresse / Quartier à ${destCity?.city ?? ''} (optionnel)` : `Adresse complète à ${destCity?.city ?? ''} *`}
              value={deliveryAddress} onChange={setDelivery}
              placeholder={destIsSenegal ? 'Ex. Liberté 6, près de la pharmacie…' : 'N°, rue, code postal, ville'}
            />
            <TextField label="Email (notifications de livraison)" value={recipientEmail} onChange={setRecipientEmail}
              placeholder="ahmed@example.com" type="email" />
            {recipientOk && (
              <button type="button" onClick={() => setEditingStep(null)}
                className="text-[11px] underline underline-offset-2 text-muted-foreground hover:text-foreground">
                Valider et replier
              </button>
            )}
          </div>
        )}
      </FlowSection>
      </div>


      {/* ─── Step 3 — Package description ─── */}
      <div id="section-package" className={cn('rounded-2xl transition-shadow', submitAttempted && sectionErrors['section-package'] && 'ring-2 ring-red-400/70 ring-offset-4 ring-offset-background')}>
      <FlowSection revealed={routeOk} step={3} total={7} title="Qu'est-ce que vous expédiez ?" hint="Description, valeur et poids estimés.">
        {packageOk && editingStep !== 3 ? (
          <StepCollapsed
            title={`${description} — ${weight} kg`}
            lines={[
              `${parcelCount} colis · ${declaredLocal} ${originProfile.currencySymbol}`,
            ]}
            onEdit={() => setEditingStep(3)}
          />
        ) : (
        <div className="space-y-4 max-w-xl">

          {/* Description — textarea avec compteur (max 140) */}
          <label className="block">
            <span className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">Description *</span>
              <span className={cn(
                'text-[10px] tabular-nums',
                description.length > 140 ? 'text-red-500 font-semibold' : 'text-muted-foreground/70',
              )}>{description.length}/140</span>
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 140))}
              maxLength={140}
              rows={2}
              placeholder="Ex. 3 robes, 2 pantalons, chaussures"
              className="w-full border-2 rounded-xl px-4 py-3 text-sm bg-card border-border placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground transition-all resize-none"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">Soyez précis : aide la douane et améliore la détection automatique.</p>
          </label>

          {/* AI auto-detection chip */}
          {description.trim().length >= 4 && (
            <div className="flex items-center gap-2 text-[11px]">
              {goodsDetecting ? (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Sparkles className="w-3 h-3 animate-pulse" />
                  Analyse de la description en cours…
                </span>
              ) : goodsAutoDetected ? (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border ${
                  goodsAutoConfident
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : 'border-amber-300 bg-amber-50 text-amber-900'
                }`}>
                  <Sparkles className="w-3 h-3" />
                  Type détecté&nbsp;: <strong>{GOODS_TYPES.find(g => g.id === goodsAutoDetected.id)?.label}</strong>
                  {!goodsAutoConfident && <span> · à confirmer</span>}
                  <button type="button" onClick={() => { setGoodsManualOverride(true); setGoodsAutoDetected(null); }}
                    className="ml-1 underline underline-offset-2 hover:opacity-80">Modifier</button>
                </span>
              ) : null}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <TextField
              label={`Valeur déclarée * (${originProfile.currencySymbol})`}
              value={declaredLocal} onChange={setDeclaredLocal}
              placeholder={originProfile.currency === 'XOF' ? '85 000' : '120'}
              suffix={originProfile.currencySymbol}
              type="number"
            />
            <div className="flex items-end">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Utilisée pour la douane et l'assurance. Conversion automatique côté système.
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

          <p className="text-[11px] text-muted-foreground">
            Le poids est ajusté à réception si différent de l'estimation. Tolérance 10 %.
          </p>
        </div>
      </FlowSection>
      </div>

      {/* ─── Step 4 — Goods type (skipped when AI is confident) ─── */}
      {!skipGoodsStep ? (
        <div id="section-goods" className={cn('rounded-2xl transition-shadow', submitAttempted && sectionErrors['section-goods'] && 'ring-2 ring-red-400/70 ring-offset-4 ring-offset-background')}>
        <FlowSection revealed={routeOk} step={4} total={7} title="Type de marchandise" hint="Important pour la douane et l'assurance.">
          {goodsOk && editingStep !== 4 ? (
            <StepCollapsed
              title={GOODS_TYPES.find(g => g.id === goodsType)?.label ?? '—'}
              lines={[
                GOODS_TYPES.find(g => g.id === goodsType)?.desc ?? '',
                goodsAutoConfident ? 'Détecté automatiquement à partir de votre description' : '',
              ].filter(Boolean)}
              onEdit={() => setEditingStep(4)}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {GOODS_TYPES.map(g => {
                  const active = goodsType === g.id;
                  const riskColor = g.risk === 'high' ? 'text-amber-500' : g.risk === 'medium' ? 'text-blue-500' : 'text-emerald-500';
                  return (
                    <button key={g.id} type="button"
                      onClick={() => { setGoodsType(g.id); setGoodsManualOverride(true); setEditingStep(null); }}
                      className={cn(
                        'group relative text-left rounded-xl border-2 p-3 transition-all overflow-hidden',
                        active
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border bg-card hover:border-foreground/40',
                      )}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold leading-tight">{g.label}</p>
                        <span className={cn(
                          'shrink-0 w-1.5 h-1.5 rounded-full mt-1.5',
                          active ? 'bg-background/70' : g.risk === 'high' ? 'bg-amber-400' : g.risk === 'medium' ? 'bg-blue-400' : 'bg-emerald-400',
                        )} />
                      </div>
                      <p className={cn('mt-1 text-[10.5px] leading-snug',
                        active ? 'text-background/70' : 'text-muted-foreground',
                      )}>{g.desc}</p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Standard</span>
                <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Vérif. requise</span>
                <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Restriction douanière</span>
              </div>
              {corridorWarning && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{corridorWarning}</span>
                </div>
              )}
            </>
          )}
        </FlowSection>
        </div>

      ) : corridorWarning ? (
        <div className="mx-auto max-w-2xl px-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{corridorWarning}</span>
          </div>
        </div>
      ) : null}

      {/* ─── Step 5 — Transport & priority ─── */}
      <FlowSection revealed={routeOk} step={5} total={7} title="Transport & priorité" hint="Mode de transport et urgence.">
        {(() => {
          // ── Prix venant directement du moteur (pricing engine v2)
          // Standard et Express sont calculés côté DB via urgency_mult.
          const fallbackBase = Math.max(15, Math.round(weight * 4));
          const standardPrice = quoteStandard ? Math.round(quoteStandard.price_eur) : fallbackBase;
          const expressPrice  = quoteExpress  ? Math.round(quoteExpress.price_eur)  : Math.round(fallbackBase * 1.35);

          const standardEtaMin = quoteStandard?.eta_min_days ?? 5;
          const standardEtaMax = quoteStandard?.eta_max_days ?? 9;
          const expressEtaMin  = quoteExpress?.eta_min_days  ?? Math.max(1, Math.ceil(standardEtaMin * 0.6));
          const expressEtaMax  = quoteExpress?.eta_max_days  ?? Math.max(expressEtaMin + 1, Math.ceil(standardEtaMax * 0.6));

          const cards = [
            {
              id: 'express' as const,
              label: 'Express',
              tagline: 'Le plus rapide',
              icon: <Zap className="w-4 h-4" />,
              eta: `${expressEtaMin}-${expressEtaMax} jours`,
              price: expressPrice,
              perks: [...INCLUDED_PERKS, 'Traitement prioritaire'],
            },
            {
              id: 'normal' as const,
              label: 'Standard',
              tagline: 'Le meilleur rapport qualité/prix',
              icon: <Clock className="w-4 h-4" />,
              eta: `${standardEtaMin}-${standardEtaMax} jours`,
              price: standardPrice,
              perks: [...INCLUDED_PERKS, 'Économique'],
              recommended: true,
            },
          ];

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
                  {/* ── Choix du départ — affiché dès qu'on a 1+ départ Konnekt ── */}
                  {options.length >= 1 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {options.length > 1 ? `${options.length} départs disponibles` : 'Départ disponible'}
                        </p>
                        {chosen && <span className="text-[10px] text-muted-foreground">Cliquez pour changer</span>}
                      </div>
                      <div className={cn('grid gap-2.5', options.length > 1 ? 'sm:grid-cols-2' : '')}>
                        {options.map((opt) => {
                          const active = chosen?.id === opt.id;
                          const dep = opt.departure_date
                            ? new Date(opt.departure_date + 'T00:00:00')
                            : null;
                          // Estimate arrival date from eta_days "3-7 jours" → take upper bound
                          const etaMaxMatch = /(\d+)\s*[–-]\s*(\d+)/.exec(opt.eta_days);
                          const etaMaxDays = etaMaxMatch ? Number(etaMaxMatch[2]) : Number((opt.eta_days.match(/\d+/) || [0])[0]);
                          const arr = dep && etaMaxDays
                            ? new Date(dep.getTime() + etaMaxDays * 86_400_000)
                            : null;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setChosen(opt)}
                              className={cn(
                                'text-left rounded-2xl border-2 p-4 transition-all relative',
                                active
                                  ? 'border-foreground bg-foreground text-background shadow-md'
                                  : 'border-border bg-card hover:border-foreground/40'
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  {OPTION_ICONS[opt.id as keyof typeof OPTION_ICONS] ?? <Plane className="w-4 h-4" />}
                                  <p className="text-sm font-bold truncate">{opt.label}</p>
                                </div>
                                {active && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                              </div>
                              <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px]">
                                <div>
                                  <p className={cn('uppercase tracking-wider', active ? 'text-background/60' : 'text-muted-foreground')}>Départ</p>
                                  <p className="font-semibold mt-0.5">
                                    {dep ? dep.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className={cn('uppercase tracking-wider', active ? 'text-background/60' : 'text-muted-foreground')}>Arrivée estimée</p>
                                  <p className="font-semibold mt-0.5">
                                    {arr ? arr.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : opt.eta_days}
                                  </p>
                                </div>
                              </div>
                              <p className={cn('mt-2 text-[11px]', active ? 'text-background/70' : 'text-muted-foreground')}>
                                Délai · {opt.eta_days}
                              </p>
                              <p className="mt-2 text-base font-bold tabular-nums">
                                {formatLocalAmount(Math.round(opt.price_eur), originProfile)}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}


                  <div className="grid sm:grid-cols-2 gap-3">
                    {cards.map(c => {
                      const active = priority === c.id;
                      return (
                        <button key={c.id} type="button"
                          onClick={() => {
                            setPriority(c.id);
                            if (c.id === 'express') setTransportMode('AIR');
                          }}
                          className={`text-left rounded-2xl border-2 p-5 transition-all relative ${
                            active
                              ? 'border-foreground bg-foreground text-background shadow-md'
                              : 'border-border bg-card hover:border-foreground/40'
                          }`}>
                          {c.recommended && !active && (
                            <span className="absolute -top-2 left-4 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-emerald-500 text-white px-2 py-0.5">
                              Recommandé
                            </span>
                          )}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {c.icon}
                              <p className="text-base font-bold truncate">{c.label}</p>
                            </div>
                            {active && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                          </div>
                          <p className={`mt-0.5 text-[11px] ${active ? 'text-background/70' : 'text-muted-foreground'}`}>{c.tagline}</p>

                          <div className="mt-4">
                            <span className="block text-xl sm:text-2xl font-bold tabular-nums whitespace-nowrap leading-tight">
                              {formatLocalAmount(c.price, originProfile)}
                            </span>
                          </div>
                          <p className={`mt-1 text-[11px] ${active ? 'text-background/70' : 'text-muted-foreground'}`}>
                            Livraison estimée · {c.eta}
                          </p>

                          <ul className={`mt-3 space-y-1 text-[11px] ${active ? 'text-background/80' : 'text-muted-foreground'}`}>
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

                  {weight >= 30 && priority === 'express' && (
                    <p className="text-[11px] text-muted-foreground">
                      Pour {weight} kg, le mode Standard peut diviser le coût par 2.
                    </p>
                  )}

                  <NextDepartureNotice date={next_departure_date} trailing="Suivi inclus" />
                </>
              )}
            </div>
          );
        })()}
      </FlowSection>



      {/* ─── Step 6 — Insurance (conditional) ─── */}
      {showInsuranceStep && (
        <FlowSection revealed={routeOk} step={6} total={7} title="Protégez votre envoi" hint={`Valeur déclarée : ${declaredLocal} ${originProfile.currencySymbol}`}>
          <div className="space-y-2.5 max-w-xl">
            {[
              { id: 'none'     as const, label: 'Sans assurance',  desc: 'Risque à charge de l\'expéditeur',                                price: 0 },
              { id: 'standard' as const, label: 'Standard',        desc: `Remboursement jusqu'à valeur déclarée`,                            price: 3 },
              { id: 'premium'  as const, label: 'Premium',         desc: 'Remboursement + frais de réexpédition couverts',                  price: 5 },
            ].map(opt => (
              <button key={opt.id} type="button" onClick={() => setInsurance(opt.id)}
                className={`w-full text-left rounded-xl border-2 px-4 py-3.5 transition-all flex items-center justify-between gap-3 ${
                  insurance === opt.id ? 'border-foreground bg-foreground text-background' : 'border-border bg-card hover:border-foreground/40'
                }`}>
                <div>
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className={`text-xs ${insurance === opt.id ? 'text-background/70' : 'text-muted-foreground'}`}>{opt.desc}</p>
                </div>
                <span className="text-sm font-bold tabular-nums">
                  {opt.price === 0 ? 'Gratuit' : `+ ${formatLocalAmount(opt.price, originProfile)}`}
                </span>
              </button>
            ))}
          </div>
        </FlowSection>
      )}

      {/* ─── Step 7 — Coordonnées + paiement + récapitulatif ─── */}
      <div id="section-final" className={cn('rounded-2xl transition-shadow', submitAttempted && sectionErrors['section-final'] && 'ring-2 ring-red-400/70 ring-offset-4 ring-offset-background')}>
      <FlowSection revealed={routeOk} step={7} total={7} title="Paiement & récapitulatif" hint="Choisissez votre paiement, puis vérifiez le résumé avant de confirmer.">

        <div className="max-w-2xl">
          <Tabs defaultValue="paiement" className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="paiement">Paiement</TabsTrigger>
              <TabsTrigger value="recap">Récapitulatif</TabsTrigger>
            </TabsList>

            <TabsContent value="paiement" className="mt-4 space-y-5">
              {/* Coordonnées expéditeur — déplacées plus haut, on rappelle simplement ici */}
              {(!senderName.trim() || !senderPhone.trim()) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Coordonnées expéditeur manquantes — complétez-les en haut de page (bloc d'identité).</span>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Mode de paiement</p>
                <div className="grid grid-cols-3 gap-2.5">
                  {PAYMENT_METHODS.map(m => (
                    <button key={m.id} type="button" onClick={() => setPaymentMethod(m.id)}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-4 transition-all ${
                        paymentMethod === m.id ? 'border-foreground bg-foreground text-background' : 'border-border bg-card hover:border-foreground/40'
                      }`}>
                      {m.icon}
                      <span className="text-xs font-semibold">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <DoorToDoorBanner origin={originCoverageCheck} destination={destCoverageCheck} detailed />
            </TabsContent>

            <TabsContent value="recap" className="mt-4">
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                {/* Header with route */}
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
                <RecapGroup icon={<User className="w-3.5 h-3.5" />} title="Personnes">
                  <RecapRow label="Expéditeur" value={senderName || senderPhone
                    ? `${senderName || '—'} · ${senderPhone || '—'} · ${originCity?.city ?? '—'}`
                    : '— (à renseigner)'} />
                  <RecapRow label="Destinataire" value={recipientName || recipientPhone
                    ? `${recipientName || '—'} · ${recipientPhone || '—'} · ${destCity?.city ?? '—'}`
                    : '— (à renseigner)'} />
                </RecapGroup>

                {/* Collecte */}
                <RecapGroup icon={<MapPin className="w-3.5 h-3.5" />} title="Collecte & livraison">
                  <RecapRow label="Collecte" value={pickupDate ? `${pickupDate} · ${pickupSlot === 'morning' ? 'Matin' : 'Après-midi'}` : '—'} />
                  {pickupAddress && <RecapRow label="Adresse" value={pickupAddress} />}
                  {deliveryAddress && <RecapRow label="Livraison" value={deliveryAddress} />}
                </RecapGroup>

                {/* Colis */}
                <RecapGroup icon={<Package className="w-3.5 h-3.5" />} title="Colis">
                  <RecapRow label="Article" value={`${GOODS_TYPES.find(g => g.id === goodsType)?.label ?? '—'} — ${description || '—'}`} />
                  <RecapRow label="Poids" value={`${weight} kg · ${parcelCount} colis`} />
                  <RecapRow label="Assurance" value={insurance === 'none' ? 'Sans' : insurance === 'standard' ? 'Standard' : 'Premium'} />
                </RecapGroup>

                {/* Coût */}
                <div className="px-5 py-4 bg-secondary/30 space-y-1.5">
                  <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-muted-foreground mb-2 inline-flex items-center gap-1.5">
                    <CreditCard className="w-3 h-3" /> Détail du coût
                  </p>
                  <RecapRow label="Collecte" value="Incluse" />
                  <RecapRow label="Transport" value={formatLocalAmount(transportPriceEur, originProfile)} />
                  {insuranceCostEur > 0 && <RecapRow label="Assurance" value={`+ ${formatLocalAmount(insuranceCostEur, originProfile)}`} />}
                  <RecapRow label="Paiement" value={PAYMENT_METHODS.find(p => p.id === paymentMethod)?.label ?? '—'} />
                  <div className="pt-2.5 mt-1 border-t border-border">
                    <RecapRow label="Total estimé" value={formatLocalAmount(totalEur, originProfile)} strong />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Prix définitif confirmé après pesée. Si différence &gt; 10 %, notification avant facturation.
                  </p>
                </div>
              </div>
            </TabsContent>

          </Tabs>
        </div>
      </FlowSection>
      </div>



      <LiveSummaryBar
        visible={routeOk}
        summary={summary || `${originProfile.flag} ${originCity?.city ?? ''} → ${destCity ? `${destProfile.flag} ${destCity.city}` : '…'}`}
        ctaLabel={allReady ? "Confirmer l'expédition" : 'Compléter les coordonnées'}
        onSubmit={submit}
        submitting={submitting}
        sideContent={next_departure_date ? `Départ ${formatDepartureDate(next_departure_date, { day: 'numeric', month: 'short' })}` : undefined}
        details={
          <div className="space-y-2.5 text-sm">
            <RecapRow label="Trajet" value={originCity && destCity ? `${originCity.city} → ${destCity.city}` : '—'} />
            <RecapRow label="Poids"  value={`${weight} kg · ${parcelCount} colis`} />
            <RecapRow label="Transport" value={`${TRANSPORT_MODES.find(t => t.id === transportMode)?.label}`} />
            <RecapRow label="Total estimé" value={formatLocalAmount(totalEur, originProfile)} strong />
          </div>
        }
      />

      {originCity && destCity && (
        <ManualQuoteDialog
          open={manualQuoteOpen} onOpenChange={setManualQuoteOpen}
          prefill={{
            origin_country: originCity.country, origin_city: originCity.city,
            destination_country: destCity.country, destination_city: destCity.city,
            weight_kg: weight, transport_mode: transportMode, priority,
          }}
          defaultName={senderName || recipientName}
          defaultPhone={senderPhone || recipientPhone}
        />
      )}
    </FlowShell>
  );
}

// ─────────────────────────── Sub-components ───────────────────────────

function RecapRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={strong ? 'text-base font-bold tabular-nums' : 'font-medium text-right text-sm'}>{value}</span>
    </div>
  );
}

function RecapGroup({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-t border-border space-y-1.5">
      <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-muted-foreground mb-2 inline-flex items-center gap-1.5">
        {icon} {title}
      </p>
      {children}
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


function AddressField({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-xs mb-1.5 font-medium text-muted-foreground">{label}</span>
      <textarea
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} rows={2}
        className="w-full border-2 rounded-xl px-4 py-3 text-sm bg-card border-border placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground transition-all resize-none"
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
      <a href="https://wa.me/221770000000" target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-1 font-semibold underline">
        <MessageCircle className="w-3 h-3" /> Nous contacter
      </a>
    </div>
  );
}
