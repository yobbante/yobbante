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
  // Match + submit
  const [chosen, setChosen]               = useState<MatchOptionView | null>(null);
  const [submitting, setSubmitting]       = useState(false);
  const [confirmed, setConfirmed]         = useState<{ reference: string; price: number; eta: string } | null>(null);
  const [manualQuoteOpen, setManualQuoteOpen] = useState(false);

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
    if (d.direction === 'from_dakar' || d.direction === 'to_dakar') setDirection(d.direction);
    if (d.originCountry) setOriginCountry(d.originCountry);
    if (d.originCityId) setOriginCity(d.originCityId);
    if (d.pickupAddress) setPickup(d.pickupAddress);
    if (d.pickupDate) setPickupDate(d.pickupDate);
    if (d.pickupSlot) setPickupSlot(d.pickupSlot);
    if (d.destCityId) setDestCity(d.destCityId);
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

  // ── Reveal logic per step
  const step1Ok = !!senderKind && !!direction;
  const step2Ok = step1Ok && !!originCity && !!pickupAddress.trim() && !!pickupDate && !!pickupSlot;
  const step3Ok = step2Ok && !!destCity;
  const step4Ok = step3Ok && !!recipientName.trim() && !!recipientPhone.trim() && (destIsSenegal || !!deliveryAddress.trim());
  const step5Ok = step4Ok && !!description.trim() && !!declaredLocal && weightTouched;
  const goodsAutoConfident = !!goodsAutoDetected && (goodsAutoDetected.confidence === 'high' || goodsAutoDetected.confidence === 'medium') && !goodsManualOverride;
  const skipGoodsStep = goodsAutoConfident && !!goodsType;
  const step6Ok = step5Ok && !!goodsType;
  const step7Ok = step6Ok;
  const step8Ok = step7Ok && (!showInsuranceStep || true);
  const allReady = step8Ok && !!senderName.trim() && !!senderPhone.trim();

  const summary = originCity && destCity
    ? `${originCity.city} → ${destCity.city}${transportMode ? ` · ${TRANSPORT_MODES.find(t => t.id === transportMode)?.label}` : ''} · ${formatLocalAmount(totalEur, originProfile)}`
    : '';

  const corridorWarning = corridorRisk(goodsType, originProfile.code, destProfile.code);

  // ── Submit ──────────────────────────────────────────────────────
  async function submit() {
    if (!step3Ok || !originCity || !destCity || !goodsType) {
      toast.error('Étapes incomplètes', { description: 'Vérifiez les informations avant de confirmer.' });
      return;
    }
    if (!dakarRouteOk) {
      toast('Choisissez Dakar', { description: "Yobbanté opère uniquement les trajets avec Dakar au départ ou à l'arrivée." });
      return;
    }
    if (!senderName.trim() || !senderPhone.trim()) {
      toast.error('Coordonnées expéditeur manquantes');
      return;
    }
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
          origin: originCity?.city || '',
          destination: destCity?.city || '',
          weight: weight,
          recipient_phone: '+221786078080'
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
          <RecapRow label="Expéditeur" value={`${senderName} · ${originProfile.flag} ${originCity?.city}, ${originProfile.name}`} />
          <RecapRow label="Collecte"   value={`${pickupDate} · ${pickupSlot === 'morning' ? 'Matin' : 'Après-midi'} · ${pickupAddress}`} />
          <RecapRow label="Destinataire" value={`${recipientName} · ${destProfile.flag} ${destCity?.city}, ${destProfile.name}`} />
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

      {/* ─── Step 1 — Sens du trajet ─── */}
      <FlowSection revealed step={1} total={10} title="Sens du trajet" hint="Yobbanté opère entre Dakar et 36 villes internationales.">
        <div className="mt-5 max-w-md">
          <span className="block text-xs mb-1.5 font-medium text-muted-foreground inline-flex items-center gap-1.5">
            <Globe2 className="w-3 h-3" /> Sens du trajet *
          </span>
          <ChipGroup
            options={[
              { id: 'to_dakar'   as const, label: 'Vers Dakar',    desc: 'Depuis l\'étranger → Dakar' },
              { id: 'from_dakar' as const, label: 'Depuis Dakar',  desc: 'Dakar → ville étrangère' },
            ]}
            value={direction}
            onChange={(v) => {
              setDirection(v);
              // Reset cities lorsque le sens change pour éviter incohérences.
              setOriginCity(null);
              setDestCity(null);
              setOriginCountry(v === 'from_dakar' ? 'SN' : 'FR');
            }}
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Yobbanté opère uniquement entre <strong>Dakar</strong> et l'une des 36 villes desservies.
          </p>
        </div>
      </FlowSection>

      {/* ─── Step 2 — Origine + collecte ─── */}
      <FlowSection revealed={step1Ok} step={2} total={10} title="D'où part le colis ?" hint="Adresse de collecte + créneau souhaité.">
        {direction === 'from_dakar' ? (
          <DakarHubLock role="origin" />
        ) : (
          <CitySelector
            cities={ORIGIN_CITIES}
            value={originCityId}
            onChange={setOriginCity}
            placeholder="Ex. Paris, Marseille, Bruxelles…"
            popularIds={POPULAR_ORIGIN_IDS}
          />
        )}
        {originCity && (
          <div className="mt-4 space-y-4 max-w-xl">
            <CoverageBadge level={coverage.level} city={originCity.city} loading={coverage.loading} />

            <AddressField
              label="Adresse de collecte *"
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
          </div>
        )}
      </FlowSection>

      {/* ─── Step 3 — Destination ─── */}
      <FlowSection revealed={step2Ok} step={3} total={10} title="Où va le colis ?" hint="Destination de la livraison.">
        {direction === 'to_dakar' ? (
          <DakarHubLock role="destination" />
        ) : (
          <CitySelector
            cities={DESTINATION_CITIES}
            value={destCityId} onChange={setDestCity}
            placeholder="Ex. Paris, Abidjan, Dubaï…"
            popularIds={POPULAR_DEST_IDS}
          />
        )}
        {destCity && originCity && originCity.country === destCity.country && (
          <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-900 inline-flex items-center gap-2">
            <Truck className="w-3.5 h-3.5" /> Livraison locale détectée — flow simplifié appliqué.
          </div>
        )}
      </FlowSection>

      {/* ─── Step 4 — Recipient ─── */}
      <FlowSection revealed={step3Ok} step={4} total={10} title="Informations du destinataire" hint={destIsSenegal ? "Au Sénégal, le téléphone fait foi pour la livraison." : "Coordonnées complètes pour la livraison."}>
        <div className="space-y-3 max-w-xl">
          <div className="grid sm:grid-cols-2 gap-3">
            <TextField label="Nom complet *" value={recipientName} onChange={setRecipientName} placeholder="Ex. Ahmed Diallo" />
            <TextField label={`Téléphone * (${destProfile.phonePrefix})`} value={recipientPhone} onChange={setRecipientPhone}
              placeholder={`${destProfile.phonePrefix} 6 · · · · · ·`} type="tel" icon={<Phone className="w-3.5 h-3.5" />} />
          </div>
          <AddressField
            label={destIsSenegal ? 'Adresse / Quartier (optionnel)' : 'Adresse complète *'}
            value={deliveryAddress} onChange={setDelivery}
            placeholder={destIsSenegal ? 'Ex. Liberté 6, près de la pharmacie…' : 'N°, rue, code postal, ville'}
          />
          <TextField label="Email (notifications de livraison)" value={recipientEmail} onChange={setRecipientEmail}
            placeholder="ahmed@example.com" type="email" />
        </div>
      </FlowSection>

      {/* ─── Step 5 — Package description ─── */}
      <FlowSection revealed={step3Ok} step={5} total={10} title="Qu'est-ce que vous expédiez ?" hint="Description, valeur et poids estimés.">
        <div className="space-y-4 max-w-xl">
          <TextField label="Description *" value={description} onChange={setDescription}
            placeholder="Ex. 3 robes, 2 pantalons, chaussures" />

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
                ℹ️ Utilisée pour la douane et l'assurance. Conversion automatique côté système.
              </p>
            </div>
          </div>

          <NumberSlider
            label="Poids estimé"
            value={weight}
            onChange={(v) => { setWeight(v); setWeightTouched(true); }}
            min={1} max={500} unit=" kg"
          />
          {!weightTouched && (
            <button type="button" onClick={() => setWeightTouched(true)}
              className="inline-flex items-center justify-center rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-semibold shadow-sm hover:opacity-90 transition">
              Valider le poids ({weight} kg)
            </button>
          )}

          <label className="block max-w-[180px]">
            <span className="block text-xs mb-1.5 font-medium text-muted-foreground">Nombre de colis</span>
            <input type="number" min={1} max={50} value={parcelCount}
              onChange={(e) => setParcelCount(Math.max(1, Number(e.target.value) || 1))}
              className="w-full border-2 rounded-xl px-4 py-3 text-sm bg-card border-border focus:outline-none focus:border-foreground transition-all" />
          </label>

          <p className="text-[11px] text-muted-foreground">
            ℹ️ Le poids est ajusté à réception si différent de l'estimation. Tolérance 10 %.
          </p>
        </div>
      </FlowSection>

      {/* ─── Step 6 — Goods type (skipped when AI is confident) ─── */}
      {!skipGoodsStep ? (
        <FlowSection revealed={step5Ok} step={6} total={10} title="Type de marchandise" hint="Important pour la douane et l'assurance.">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {GOODS_TYPES.map(g => (
              <button key={g.id} type="button" onClick={() => { setGoodsType(g.id); setGoodsManualOverride(true); }}
                className={`text-left rounded-xl border-2 px-4 py-3.5 transition-all ${
                  goodsType === g.id
                    ? 'border-foreground bg-foreground text-background shadow-sm'
                    : 'border-border bg-card hover:border-foreground/40'
                }`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{g.label}</p>
                  {g.risk === 'high' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                </div>
                <p className={`mt-0.5 text-[11px] ${goodsType === g.id ? 'text-background/70' : 'text-muted-foreground'}`}>{g.desc}</p>
              </button>
            ))}
          </div>
          {corridorWarning && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{corridorWarning}</span>
            </div>
          )}
        </FlowSection>
      ) : corridorWarning ? (
        <div className="mx-auto max-w-2xl px-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{corridorWarning}</span>
          </div>
        </div>
      ) : null}

      {/* ─── Step 7 — Transport & priority ─── */}
      <FlowSection revealed={step6Ok} step={7} total={10} title="Transport & priorité" hint="Mode de transport et urgence.">
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

          return (
            <div className="space-y-4">
              <DoorToDoorBanner
                origin={originCoverageCheck}
                destination={destCoverageCheck}
                variant="subtle"
              />
              <div className="grid sm:grid-cols-2 gap-3">
                {cards.map(c => {
                  const active = priority === c.id;
                  return (
                    <button key={c.id} type="button"
                      onClick={() => {
                        setPriority(c.id);
                        // Auto-pick transport: Express -> AIR, Standard -> keep (or AIR by default).
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
                  💡 Pour {weight} kg, le mode Standard peut diviser le coût par 2.
                </p>
              )}

              {!matching && options.length === 0 && originCity && destCity && weightTouched && (
                <div className="rounded-2xl border border-border bg-card p-5 space-y-3 max-w-md">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-10 h-10 rounded-full bg-secondary grid place-items-center"><Search className="w-4 h-4" /></div>
                    <div>
                      <p className="text-sm font-semibold">Aucun départ instantané — devis sur mesure</p>
                      <p className="text-xs text-muted-foreground">Réponse personnalisée sous 2 h ouvrées.</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setManualQuoteOpen(true)}
                    className="w-full inline-flex items-center justify-center rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition">
                    Demander un devis
                  </button>
                </div>
              )}

              <NextDepartureNotice date={next_departure_date} trailing="Suivi inclus" />
            </div>
          );
        })()}
      </FlowSection>

      {/* ─── Step 8 — Insurance (conditional) ─── */}
      {showInsuranceStep && (
        <FlowSection revealed={step7Ok} step={8} total={10} title="Protégez votre envoi" hint={`Valeur déclarée : ${declaredLocal} ${originProfile.currencySymbol}`}>
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

      {/* ─── Step 9 — Recap & payment ─── */}
      <FlowSection revealed={step7Ok} step={9} total={10} title="Récapitulatif & paiement" hint="Vérifiez et choisissez votre mode de paiement.">
        <div className="space-y-5 max-w-2xl">
          <div className="rounded-2xl border-2 border-border bg-card p-5 sm:p-6 space-y-2.5 text-sm">
            <RecapRow label="Expéditeur"   value={`${originProfile.flag} ${originCity?.city}, ${originProfile.name}`} />
            <RecapRow label="Collecte"     value={pickupDate ? `${pickupDate} · ${pickupSlot === 'morning' ? 'Matin' : 'Après-midi'}` : '—'} />
            <RecapRow label="Destinataire" value={destCity ? `${recipientName || '—'} · ${destProfile.flag} ${destCity.city}, ${destProfile.name}` : '—'} />
            <RecapRow label="Article"      value={`${GOODS_TYPES.find(g => g.id === goodsType)?.label ?? '—'} — ${description || '—'}`} />
            <RecapRow label="Poids"        value={`${weight} kg · ${parcelCount} colis`} />
            <RecapRow label="Transport"    value={`${TRANSPORT_MODES.find(t => t.id === transportMode)?.label} · ${priority === 'express' ? 'Express' : 'Standard'}`} />
            <RecapRow label="Assurance"    value={insurance === 'none' ? 'Sans' : insurance === 'standard' ? 'Standard' : 'Premium'} />
            <div className="pt-3 mt-2 border-t border-border space-y-1.5">
              <RecapRow label="Collecte"  value="Incluse" />
              <RecapRow label="Transport" value={formatLocalAmount(transportPriceEur, originProfile)} />
              {priorityCostEur > 0 && <RecapRow label="Express" value={`+ ${formatLocalAmount(priorityCostEur, originProfile)}`} />}
              {insuranceCostEur > 0 && <RecapRow label="Assurance" value={`+ ${formatLocalAmount(insuranceCostEur, originProfile)}`} />}
            </div>
            <div className="pt-3 border-t-2 border-foreground/10">
              <RecapRow label="Total estimé" value={formatLocalAmount(totalEur, originProfile)} strong />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Prix définitif confirmé après pesée. Si différence &gt; 10 %, notification avant facturation.
              </p>
            </div>
          </div>

          <DoorToDoorBanner
            origin={originCoverageCheck}
            destination={destCoverageCheck}
            detailed
          />

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Mode de paiement</p>
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

          <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vos coordonnées d'expéditeur</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <TextField label="Nom complet *" value={senderName} onChange={setSenderName} placeholder="Votre nom" />
              <TextField label={`Téléphone * (${originProfile.phonePrefix})`} value={senderPhone} onChange={setSenderPhone}
                placeholder={`${originProfile.phonePrefix} · · · · · ·`} type="tel" icon={<Phone className="w-3.5 h-3.5" />} />
            </div>
          </div>
        </div>
      </FlowSection>

      <LiveSummaryBar
        visible={step7Ok}
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
      <span className={strong ? 'text-base font-bold tabular-nums' : 'font-medium text-right'}>{value}</span>
    </div>
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
