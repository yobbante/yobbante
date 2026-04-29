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
import { supabase } from '@/integrations/supabase/client';
import { ORIGIN_CITIES, DESTINATION_CITIES, findCity, POPULAR_ORIGIN_IDS, POPULAR_DEST_IDS } from '@/lib/worldCities';
import { COUNTRY_OPTIONS, getProfile, formatLocalAmount, eurFromLocal, type CountryProfile } from '@/lib/countryProfile';
import type { WarehouseCountry } from '@/lib/types';

// ─────────────────────────── Static config ───────────────────────────

const SENDER_KINDS = [
  { id: 'individual' as const, label: 'Particulier',            desc: 'Envoi personnel',         icon: <User      className="w-3.5 h-3.5" /> },
  { id: 'business'   as const, label: 'Entreprise / Commerçant', desc: 'Activité professionnelle', icon: <Building2 className="w-3.5 h-3.5" /> },
];

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
  // Step 1 — sender profile
  const [senderKind, setSenderKind]       = useState<typeof SENDER_KINDS[number]['id'] | null>(null);
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
  const originProfile = useMemo<CountryProfile>(() => getProfile(originCountry), [originCountry]);
  const originCity    = findCity(ORIGIN_CITIES, originCityId);
  const destCity      = findCity(DESTINATION_CITIES, destCityId);
  const destProfile   = useMemo<CountryProfile>(() => getProfile(destCity?.country), [destCity?.country]);

  const coverage = useCoverageZone({ country: originCountry, city: originCity?.city });

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
    senderKind, originCountry, originCityId, pickupAddress, pickupDate, pickupSlot,
    destCityId, recipientName, recipientPhone, recipientEmail, deliveryAddress,
    description, declaredLocal, weight, parcelCount, goodsType,
    transportMode, priority, insurance, paymentMethod,
    senderName, senderPhone, chosenId: chosen?.id ?? null,
  };
  useFlowDraft(DRAFT_KEY, draftSnapshot, (d) => {
    if (d.senderKind) setSenderKind(d.senderKind);
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

  // Yobbanté opère depuis Dakar : Dakar doit être au départ OU à l'arrivée.
  const isDakar = (c?: { city?: string } | null) => !!c?.city && c.city.toLowerCase().includes('dakar');
  const dakarRouteOk = !originCity || !destCity ? true : (isDakar(originCity) || isDakar(destCity));

  // Match options reveal once weight is confirmed
  const matchInput = useMemo(() => {
    if (!originCity || !destCity || !weight || !weightTouched) return null;
    return {
      origin_city: originCity.city, destination_city: destCity.city,
      origin_country: originCity.country, destination_country: destCity.country,
      weight_kg: weight, urgency: priority === 'express' ? 'fast' as const : 'normal' as const,
    };
  }, [originCity, destCity, weight, weightTouched, priority]);
  const { options, next_departure_in_days, loading: matching } = useMatchOptions(matchInput);

  const quoteInput = useMemo(() => {
    if (!originCity || !destCity || !weight) return null;
    const transport: 'AIR' | 'SEA' | 'ROAD' = transportMode;
    return {
      origin_country: originCity.country, destination_country: destCity.country,
      weight_kg: weight, transport_type: transport,
      priority: priority === 'express' ? 'urgent' as const : 'normal' as const,
      origin_city: originCity.city, destination_city: destCity.city,
    };
  }, [originCity, destCity, weight, transportMode, priority]);
  const { quote } = useQuote(quoteInput);

  useEffect(() => {
    if (!chosen && options.length > 0) {
      const reco = options.find(o => o.id === 'economy') ?? options[0];
      setChosen(reco);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length]);

  // ── Pricing breakdown (in EUR for internal math)
  const transportPriceEur = quote ? Math.round(quote.price_eur) : chosen ? Math.round(chosen.price_eur) : 0;
  const insuranceCostEur = insurance === 'standard' ? 3 : insurance === 'premium' ? 5 : 0;
  const priorityCostEur  = priority === 'express' ? 6 : 0;
  const totalEur = transportPriceEur + insuranceCostEur + priorityCostEur;
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
  const step1Ok = !!senderKind && !!originCountry;
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
      };

      await createShipment.mutateAsync({
        origin_country: originCity.country as 'FR' | 'CN' | 'US',
        destination_country: destCity.country,
        origin_city: originCity.city,
        destination_city: destCity.city,
        match_option: {
          ...matchOption,
          meta: {
            ...(matchOption.meta ?? {}),
            true_direction: {
              origin_city: originCity.city, origin_country: originCity.country,
              destination_city: destCity.city, destination_country: destCity.country,
            },
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
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur');
    } finally { setSubmitting(false); }
  }

  // ── Confirmation page ─────────────────────────────────────────────
  if (confirmed) {
    return (
      <FlowShell theme="light" compactHeader={compactHeader}>
        <FlowSuccess
          reference={confirmed.reference}
          title="Expédition enregistrée."
          subtitle={`${originCity?.city} → ${destCity?.city} · ${formatLocalAmount(confirmed.price, originProfile)} · ETA ${confirmed.eta}. Notre équipe vous contacte sous 2 h pour confirmer le créneau de collecte.`}
          ctaHref="/app" ctaLabel="Voir mon espace"
        />
        <section className="mt-8 mb-20 rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-3 text-sm">
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

      {/* ─── Step 1 — Sender profile ─── */}
      <FlowSection revealed step={1} total={10} title="Vous expédiez en tant que ?" hint="Cette étape n'est demandée qu'une seule fois.">
        <ChipGroup options={SENDER_KINDS} value={senderKind} onChange={(v) => setSenderKind(v)} />
        <div className="mt-5 max-w-md">
          <label className="block">
            <span className="block text-xs mb-1.5 font-medium text-muted-foreground inline-flex items-center gap-1.5">
              <Globe2 className="w-3 h-3" /> Votre pays d'origine *
            </span>
            <select
              value={originCountry}
              onChange={(e) => setOriginCountry(e.target.value)}
              className="w-full border-2 rounded-xl px-4 py-3.5 text-base bg-card border-border focus:outline-none focus:border-foreground transition-all"
            >
              {COUNTRY_OPTIONS.map(p => (
                <option key={p.code} value={p.code}>{p.flag} {p.name} · {p.currencySymbol}</option>
              ))}
            </select>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Définit la devise ({originProfile.currencySymbol}), le format téléphone ({originProfile.phonePrefix}) et les règles douanières applicables.
            </p>
          </label>
        </div>
      </FlowSection>

      {/* ─── Step 2 — Origin & pickup ─── */}
      <FlowSection revealed={step1Ok} step={2} total={10} title="D'où part le colis ?" hint="Adresse de collecte + créneau souhaité.">
        <CitySelector
          cities={ORIGIN_CITIES.filter(c => c.country === originCountry || originCountry === 'SN')}
          value={originCityId}
          onChange={setOriginCity}
          placeholder={`Ex. ${originCountry === 'SN' ? 'Dakar, Thiès…' : 'votre ville'}`}
          popularIds={POPULAR_ORIGIN_IDS}
        />
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
      <FlowSection revealed={step2Ok} step={3} total={10} title="Où va le colis ?" hint="Sélectionnez le pays et la ville d'arrivée.">
        <CitySelector
          cities={DESTINATION_CITIES}
          value={destCityId} onChange={setDestCity}
          placeholder="Ex. Dakar, Paris, Abidjan…"
          popularIds={POPULAR_DEST_IDS}
        />
        {originCity && destCity && !dakarRouteOk && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="text-xs text-amber-600">
              ⚠️ Yobbanté opère uniquement les trajets avec Dakar au départ ou à l'arrivée.
            </p>
            {(() => {
              const dakarDest = DESTINATION_CITIES.find(c => c.city.toLowerCase().includes('dakar'));
              if (!dakarDest) return null;
              return (
                <button type="button" onClick={() => setDestCity(dakarDest.id)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition">
                  <MapPin className="w-3 h-3" /> Choisir Dakar comme destination
                </button>
              );
            })()}
          </div>
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

      {/* ─── Step 6 — Goods type ─── */}
      <FlowSection revealed={step5Ok} step={6} total={10} title="Type de marchandise" hint="Important pour la douane et l'assurance.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {GOODS_TYPES.map(g => (
            <button key={g.id} type="button" onClick={() => setGoodsType(g.id)}
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

      {/* ─── Step 7 — Transport & priority ─── */}
      <FlowSection revealed={step6Ok} step={7} total={10} title="Transport & priorité" hint="Mode de transport et urgence.">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Mode de transport</p>
            <div className="grid sm:grid-cols-3 gap-3">
              {TRANSPORT_MODES.map(m => {
                const hidden = (m.id === 'SEA' && (weight < 0.5 || goodsType === 'documents'));
                if (hidden) return null;
                return (
                  <button key={m.id} type="button" onClick={() => setTransportMode(m.id)}
                    className={`text-left rounded-xl border-2 p-4 transition-all ${
                      transportMode === m.id
                        ? 'border-foreground bg-foreground text-background shadow-sm'
                        : 'border-border bg-card hover:border-foreground/40'
                    }`}>
                    <div className="flex items-center gap-2">{m.icon}<p className="font-semibold">{m.label}</p></div>
                    <p className={`mt-1 text-xs ${transportMode === m.id ? 'text-background/70' : 'text-muted-foreground'}`}>{m.eta}</p>
                  </button>
                );
              })}
            </div>
            {weight >= 30 && transportMode === 'AIR' && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                💡 Pour {weight} kg, le maritime peut diviser le coût par 2 (délai 3× plus long).
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Priorité</p>
            <ChipGroup options={PRIORITIES} value={priority} onChange={(v) => setPriority(v)} />
          </div>

          {matching && (
            <p className="text-xs text-muted-foreground">Recherche des meilleures options en cours…</p>
          )}
          {!matching && options.length > 0 && (
            <div className="grid sm:grid-cols-3 gap-3">
              {options.map(o => (
                <MatchOptionCard key={o.id} opt={{ ...o, price_eur: Math.round(o.price_eur) }}
                  active={chosen?.id === o.id} onClick={() => setChosen(o)} icon={OPTION_ICONS[o.id]} />
              ))}
            </div>
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
          {next_departure_in_days != null && (
            <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5" /> Prochain départ dans {next_departure_in_days} j ·
              <ShieldCheck className="w-3.5 h-3.5" /> Suivi inclus
            </p>
          )}
        </div>
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
        sideContent={next_departure_in_days != null ? `Prochain départ dans ${next_departure_in_days} j` : undefined}
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
