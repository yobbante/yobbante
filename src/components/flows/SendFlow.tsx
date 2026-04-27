import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, FileText, Boxes, Zap, Clock, Sparkles, ShieldCheck, MapPin, Phone, User } from 'lucide-react';
import { toast } from 'sonner';
import {
  FlowShell, FlowHero, FlowSection, ChipGroup, CitySelector, NumberSlider,
  TextField, MatchOptionCard, LiveSummaryBar, FlowSuccess,
  type MatchOptionView,
} from './FlowPrimitives';
import { useMatchOptions } from './useMatchOptions';
import { QuoteEstimate } from './QuoteEstimate';
import { useQuote } from '@/hooks/useQuote';
import { useDossiers } from '@/hooks/useDossiers';
import { useShipments } from '@/hooks/useShipments';
import { useFlowDraft, clearDraft, saveDraft } from '@/hooks/useFlowDraft';
import { supabase } from '@/integrations/supabase/client';
import { ORIGIN_CITIES, DESTINATION_CITIES, findCity, POPULAR_ORIGIN_IDS, POPULAR_DEST_IDS } from '@/lib/worldCities';
import type { WarehouseCountry } from '@/lib/types';

const TYPES = [
  { id: 'documents' as const, label: 'Documents', desc: 'Plis, contrats',     icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'package'   as const, label: 'Colis',     desc: 'Petit / moyen',      icon: <Package  className="w-3.5 h-3.5" /> },
  { id: 'bulk'      as const, label: 'Volume',    desc: 'Cartons / palette',  icon: <Boxes    className="w-3.5 h-3.5" /> },
];

const OPTION_ICONS = {
  fast:    <Zap   className="w-4 h-4" />,
  economy: <Clock className="w-4 h-4" />,
  volume:  <Boxes className="w-4 h-4" />,
} as const;

/** Origin countries supported by the warehouse network (constraint of the DB enum). */
const SUPPORTED_ORIGIN_COUNTRIES: ReadonlyArray<WarehouseCountry> = ['FR', 'CN', 'US', 'AE', 'DE', 'CA'];

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export function SendFlow({ compactHeader }: { compactHeader?: React.ReactNode } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { createDossier } = useDossiers();
  const { createShipment } = useShipments();

  const preset = (location.state as {
    preset?: { type?: typeof TYPES[number]['id']; origin?: string; destination?: string; weight?: number };
  } | null)?.preset;

  // Map legacy country preset → city id (default city for that country)
  const presetOriginCityId = useMemo(() => {
    if (!preset?.origin) return null;
    return ORIGIN_CITIES.find(c => c.country === preset.origin)?.id ?? null;
  }, [preset?.origin]);
  const presetDestCityId = useMemo(() => {
    if (!preset?.destination) return null;
    return DESTINATION_CITIES.find(c => c.country === preset.destination)?.id ?? null;
  }, [preset?.destination]);

  const [type, setType]               = useState<typeof TYPES[number]['id'] | null>(preset?.type ?? null);
  const [originCityId, setOriginCity] = useState<string | null>(presetOriginCityId);
  const [destCityId, setDestCity]     = useState<string | null>(presetDestCityId);
  const [weight, setWeight]           = useState(preset?.weight ?? 5);
  const [weightTouched, setWeightTouched] = useState<boolean>(!!preset?.weight);
  const [declaredValue, setDeclared]  = useState('');

  // Contact / addresses
  const [senderName, setSenderName]       = useState('');
  const [senderPhone, setSenderPhone]     = useState('');
  const [pickupAddress, setPickup]        = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [deliveryAddress, setDelivery]    = useState('');

  const [chosen, setChosen]   = useState<MatchOptionView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed]   = useState<{ reference: string; price: number; eta: string } | null>(null);

  // ── Persist work-in-progress so the user keeps everything after a login round-trip
  const DRAFT_KEY = 'send-flow';
  const draftSnapshot = {
    type, originCityId, destCityId, weight, declaredValue,
    senderName, senderPhone, pickupAddress,
    recipientName, recipientPhone, deliveryAddress,
    chosenId: chosen?.id ?? null,
  };
  useFlowDraft(DRAFT_KEY, draftSnapshot, (d) => {
    if (d.type) setType(d.type);
    if (d.originCityId) setOriginCity(d.originCityId);
    if (d.destCityId) setDestCity(d.destCityId);
    if (typeof d.weight === 'number') { setWeight(d.weight); setWeightTouched(true); }
    if (d.declaredValue) setDeclared(d.declaredValue);
    if (d.senderName) setSenderName(d.senderName);
    if (d.senderPhone) setSenderPhone(d.senderPhone);
    if (d.pickupAddress) setPickup(d.pickupAddress);
    if (d.recipientName) setRecipientName(d.recipientName);
    if (d.recipientPhone) setRecipientPhone(d.recipientPhone);
    if (d.deliveryAddress) setDelivery(d.deliveryAddress);
  });

  const originCity = findCity(ORIGIN_CITIES, originCityId);
  const destCity   = findCity(DESTINATION_CITIES, destCityId);

  // Yobbanté opère depuis Dakar : Dakar doit être au départ OU à l'arrivée.
  const isDakar = (c?: { city?: string } | null) => !!c?.city && c.city.toLowerCase().includes('dakar');
  const dakarRouteOk = !originCity || !destCity ? true : (isDakar(originCity) || isDakar(destCity));

  // Step 5 only fetches options once the user has actually confirmed a weight
  // (otherwise the default value of 5 kg would auto-reveal step 5 and skip step 4).
  const matchInput = useMemo(() => {
    if (!originCity || !destCity || !weight || !weightTouched) return null;
    return {
      origin_city: originCity.city,
      destination_city: destCity.city,
      origin_country: originCity.country,
      destination_country: destCity.country,
      weight_kg: weight,
      urgency: 'normal' as const,
    };
  }, [originCity, destCity, weight, weightTouched]);

  const { options, next_departure_in_days, loading: matching } = useMatchOptions(matchInput);

  const quoteInput = useMemo(() => {
    if (!originCity || !destCity || !weight) return null;
    const transport: 'AIR' | 'SEA' | 'ROAD' | null =
      chosen?.id === 'volume' ? 'SEA' : chosen?.id === 'fast' ? 'AIR' : chosen?.id === 'economy' ? 'ROAD' : null;
    return {
      origin_country: originCity.country,
      destination_country: destCity.country,
      weight_kg: weight,
      transport_type: transport,
      priority: 'normal' as const,
      origin_city: originCity.city,
      destination_city: destCity.city,
    };
  }, [originCity, destCity, weight, chosen?.id]);
  const { quote, loading: quoting, error: quoteError } = useQuote(quoteInput);

  // Auto-pre-select the recommended (economy) option once results arrive
  useEffect(() => {
    if (!chosen && options.length > 0) {
      const reco = options.find(o => o.id === 'economy') ?? options[0];
      setChosen(reco);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length]);

  const finalPriceEur = quote ? Math.round(quote.price_eur) : chosen ? Math.round(chosen.price_eur) : null;
  const finalPriceXof = quote ? Math.round(quote.price_xof) : null;

  // Recap section appears once a transport option is chosen.
  const recapRevealed = !!chosen;
  // Submit eligible when contacts/addresses are filled.
  const contactsComplete =
    senderName.trim() && senderPhone.trim() && pickupAddress.trim() &&
    recipientName.trim() && recipientPhone.trim() && deliveryAddress.trim();

  const priceLabel = finalPriceXof != null
    ? `${new Intl.NumberFormat('fr-FR').format(finalPriceXof)} XOF${finalPriceEur != null ? ` (≈ ${fmtEur(finalPriceEur)})` : ''}`
    : finalPriceEur != null ? fmtEur(finalPriceEur) : '';
  const summary = chosen && originCity && destCity
    ? `${originCity.city} → ${destCity.city} · ${chosen.label}${priceLabel ? ` · ${priceLabel}` : ''}`
    : '';

  async function submit() {
    if (!chosen || !originCity || !destCity || !type) return;
    if (!originCountrySupported) {
      toast.error(`Origine ${originCity.countryLabel} indisponible — choisissez une ville en FR / CN / US / AE / DE / CA.`);
      return;
    }
    if (!contactsComplete) {
      toast.error('Renseignez les coordonnées d\'expéditeur et de destinataire.');
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Save snapshot so the user comes back with everything intact.
        saveDraft(DRAFT_KEY, draftSnapshot);
        toast.message('Connectez-vous pour finaliser — votre dossier reste enregistré.');
        navigate(`/auth?redirect=${encodeURIComponent('/expedier/envoyer')}`);
        return;
      }

      const dossier = await createDossier.mutateAsync({
        product_description: `Expédition ${type} — ${originCity.city} → ${destCity.city}`,
        estimated_weight: weight,
        origin_country: originCity.country as WarehouseCountry,
        destination_country: destCity.country,
        notes: [
          `Type: ${type}`,
          `Poids: ${weight} kg`,
          declaredValue ? `Valeur déclarée: ${declaredValue}€` : '',
          `Option: ${chosen.label} (${Math.round(chosen.price_eur)}€)`,
          '',
          '— Expéditeur —',
          `${senderName} · ${senderPhone}`,
          pickupAddress,
          '',
          '— Destinataire —',
          `${recipientName} · ${recipientPhone}`,
          deliveryAddress,
        ].filter(Boolean).join('\n'),
      });

      await createShipment.mutateAsync({
        origin_country: originCity.country as 'FR' | 'CN' | 'US',
        destination_country: destCity.country,
        origin_city: originCity.city,
        destination_city: destCity.city,
        match_option: chosen,
      });

      setConfirmed({
        reference: dossier.reference,
        price: finalPriceEur ?? Math.round(chosen.price_eur),
        eta: chosen.eta_days,
      });
      clearDraft(DRAFT_KEY);
      toast.success('Expédition confirmée 🚀');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur');
    } finally { setSubmitting(false); }
  }

  // ─────────── Confirmation page ───────────
  if (confirmed) {
    return (
      <FlowShell theme="light" compactHeader={compactHeader}>
        <FlowSuccess
          reference={confirmed.reference}
          title="Votre expédition est confirmée."
          subtitle={`${originCity?.city} → ${destCity?.city} · livraison estimée ${confirmed.eta} · ${fmtEur(confirmed.price)} tout inclus. Notre équipe vous recontacte sous 24h.`}
          ctaHref="/app" ctaLabel="Voir mon espace"
        />
        <section className="mt-8 mb-20 rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 text-sm">
          <h3 className="text-base font-semibold tracking-tight">Récapitulatif de l'expédition</h3>
          <RecapRow label="Type" value={TYPES.find(t => t.id === type)?.label ?? type ?? ''} />
          <RecapRow label="Trajet" value={`${originCity?.city} (${originCity?.countryLabel}) → ${destCity?.city} (${destCity?.countryLabel})`} />
          <RecapRow label="Poids" value={`${weight} kg`} />
          {declaredValue && <RecapRow label="Valeur déclarée" value={`${declaredValue} €`} />}
          <RecapRow label="Option" value={`${chosen?.label} · ${chosen?.eta_days}`} />
          <RecapRow label="Prix total" value={fmtEur(confirmed.price)} strong />
          <div className="grid sm:grid-cols-2 gap-4 pt-3 border-t border-border">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">Expéditeur</p>
              <p className="mt-1.5 font-semibold">{senderName}</p>
              <p className="text-muted-foreground">{senderPhone}</p>
              <p className="text-muted-foreground mt-1 whitespace-pre-line">{pickupAddress}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">Destinataire</p>
              <p className="mt-1.5 font-semibold">{recipientName}</p>
              <p className="text-muted-foreground">{recipientPhone}</p>
              <p className="text-muted-foreground mt-1 whitespace-pre-line">{deliveryAddress}</p>
            </div>
          </div>
        </section>
      </FlowShell>
    );
  }

  return (
    <FlowShell theme="light" compactHeader={compactHeader}>
      {!compactHeader && (
        <FlowHero
          eyebrow="Expédier · Envoyer"
          title="Envoyez un colis n'importe où dans le monde."
          subtitle="Décrivez votre envoi. Yobbanté trouve la meilleure option et gère transport, douane et livraison."
        />
      )}

      <FlowSection revealed step={1} total={5} title="Que souhaitez-vous envoyer ?" hint="Sélectionnez la nature de votre envoi.">
        <ChipGroup options={TYPES} value={type} onChange={(v) => setType(v)} />
      </FlowSection>

      <FlowSection revealed={!!type} step={2} total={5} title="D'où part votre envoi ?" hint="Recherchez la ville de départ, puis indiquez l'expéditeur.">
        <CitySelector
          cities={ORIGIN_CITIES}
          value={originCityId}
          onChange={setOriginCity}
          placeholder="Ex. Shenzhen, Paris, Dubai…"
          popularIds={POPULAR_ORIGIN_IDS}
        />
        {originCity && !originCountrySupported && (
          <p className="mt-3 text-xs text-amber-600">
            Cette origine n'est pas encore couverte par notre réseau d'entrepôts. Choisissez une ville en France, Chine, USA, Émirats, Allemagne ou Canada pour valider.
          </p>
        )}
        {originCity && (
          <motion.fieldset
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
            className="mt-5 space-y-3 rounded-2xl border border-border bg-card p-4 max-w-xl"
          >
            <legend className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground inline-flex items-center gap-1.5 px-1">
              <User className="w-3 h-3" /> Expéditeur à {originCity.city}
            </legend>
            <TextField label="Nom complet" value={senderName} onChange={setSenderName} placeholder="Ex. Awa Diop" />
            <TextField label="Téléphone" value={senderPhone} onChange={setSenderPhone} placeholder="+221 77 000 00 00" type="tel" icon={<Phone className="w-3.5 h-3.5" />} />
            <AddressField label="Adresse de retrait" value={pickupAddress} onChange={setPickup} placeholder="N°, rue, quartier, ville, code postal" />
          </motion.fieldset>
        )}
      </FlowSection>

      <FlowSection revealed={!!originCity} step={3} total={5} title="Où doit-il arriver ?" hint="Recherchez la ville d'arrivée, puis indiquez le destinataire.">
        <CitySelector
          cities={DESTINATION_CITIES}
          value={destCityId}
          onChange={setDestCity}
          placeholder="Ex. Dakar, Abidjan, Bamako…"
          popularIds={POPULAR_DEST_IDS}
        />
        {destCity && (
          <motion.fieldset
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
            className="mt-5 space-y-3 rounded-2xl border border-border bg-card p-4 max-w-xl"
          >
            <legend className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground inline-flex items-center gap-1.5 px-1">
              <MapPin className="w-3 h-3" /> Destinataire à {destCity.city}
            </legend>
            <TextField label="Nom complet" value={recipientName} onChange={setRecipientName} placeholder="Ex. Mamadou Sall" />
            <TextField label="Téléphone" value={recipientPhone} onChange={setRecipientPhone} placeholder="+221 77 000 00 00" type="tel" icon={<Phone className="w-3.5 h-3.5" />} />
            <AddressField label="Adresse de livraison" value={deliveryAddress} onChange={setDelivery} placeholder="N°, rue, quartier, ville, code postal" />
          </motion.fieldset>
        )}
      </FlowSection>

      <FlowSection revealed={!!destCity} step={4} total={5} title="Combien pèse votre envoi ?" hint="Indiquez le poids — c'est obligatoire pour calculer le prix.">
        <div className="space-y-5 max-w-md">
          <NumberSlider
            label="Poids estimé"
            value={weight}
            onChange={(v) => { setWeight(v); setWeightTouched(true); }}
            min={1} max={500} unit=" kg"
          />
          <TextField
            label="Valeur déclarée (optionnel)"
            value={declaredValue} onChange={setDeclared}
            placeholder="ex. 250" suffix="€" type="number"
          />
          {!weightTouched && (
            <button
              type="button"
              onClick={() => setWeightTouched(true)}
              className="inline-flex items-center justify-center rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-semibold shadow-sm hover:opacity-90 transition"
            >
              Valider le poids ({weight} kg)
            </button>
          )}
        </div>
      </FlowSection>

      <FlowSection
        revealed={!!matchInput}
        step={5} total={5}
        title="Options disponibles"
        hint={matching ? 'Recherche des meilleures options en cours…' : options.length > 0 ? "Choisissez l'offre qui vous convient." : "Aucun départ instantané — demandez un devis manuel."}
      >
        {matching && (
          <div className="grid sm:grid-cols-3 gap-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-44 rounded-2xl border border-border bg-secondary/40 animate-pulse" />
            ))}
          </div>
        )}
        {!matching && options.length > 0 && (
          <>
            <div className="grid sm:grid-cols-3 gap-3">
              {options.map(o => (
                <MatchOptionCard
                  key={o.id} opt={{ ...o, price_eur: Math.round(o.price_eur) }}
                  active={chosen?.id === o.id}
                  onClick={() => setChosen(o)}
                  icon={OPTION_ICONS[o.id]}
                />
              ))}
            </div>
            {next_departure_in_days != null && (
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                className="mt-5 inline-flex items-center gap-2 text-xs text-muted-foreground"
              >
                <Sparkles className="w-3.5 h-3.5 text-foreground" />
                Prochain départ dans {next_departure_in_days} jour{next_departure_in_days > 1 ? 's' : ''} ·
                <ShieldCheck className="w-3.5 h-3.5" /> Suivi & assurance inclus
              </motion.p>
            )}
          </>
        )}
        {!matching && options.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
            <div>
              <p className="text-sm font-semibold">Aucun départ direct trouvé pour ce trajet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Notre équipe peut vous proposer une option sur-mesure sous 24 h. Le prix indicatif ci-dessous est calculé à partir de votre poids et de la zone de destination.
              </p>
            </div>
            <QuoteEstimate quote={quote} loading={quoting} error={quoteError} />
            <button
              type="button"
              onClick={() => {
                // Synthesize a "manual" option so the rest of the flow (contacts, recap) unlocks.
                setChosen({
                  id: 'economy',
                  label: 'Sur devis',
                  eta_days: '7–14 jours',
                  price_eur: quote?.price_eur ?? 0,
                  highlight: 'Devis manuel sous 24h',
                  transport_type: 'ROAD',
                } as MatchOptionView);
              }}
              className="inline-flex items-center justify-center rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-semibold shadow-sm hover:opacity-90 transition"
            >
              Demander un devis manuel
            </button>
          </div>
        )}
      </FlowSection>



      {/* Recap step, before confirmation */}
      <FlowSection
        revealed={recapRevealed && !!contactsComplete}
        title="Récapitulatif"
        hint="Vérifiez les informations avant de confirmer."
      >
        <div className="rounded-2xl border-2 border-border bg-card p-5 sm:p-6 space-y-3 text-sm">
          <RecapRow label="Type" value={TYPES.find(t => t.id === type)?.label ?? '—'} />
          <RecapRow
            label="Trajet"
            value={originCity && destCity ? `${originCity.city} (${originCity.countryLabel}) → ${destCity.city} (${destCity.countryLabel})` : '—'}
          />
          <RecapRow label="Poids" value={`${weight} kg`} />
          {declaredValue && <RecapRow label="Valeur déclarée" value={`${declaredValue} €`} />}
          {chosen && <RecapRow label="Option" value={`${chosen.label} · ${chosen.eta_days}`} />}
          {finalPriceEur != null && <RecapRow label="Prix total" value={fmtEur(finalPriceEur)} strong />}
          <div className="grid sm:grid-cols-2 gap-4 pt-3 border-t border-border">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">Expéditeur</p>
              <p className="mt-1.5 font-semibold">{senderName}</p>
              <p className="text-muted-foreground">{senderPhone}</p>
              <p className="text-muted-foreground mt-1 whitespace-pre-line">{pickupAddress}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">Destinataire</p>
              <p className="mt-1.5 font-semibold">{recipientName}</p>
              <p className="text-muted-foreground">{recipientPhone}</p>
              <p className="text-muted-foreground mt-1 whitespace-pre-line">{deliveryAddress}</p>
            </div>
          </div>
        </div>
      </FlowSection>

      <LiveSummaryBar
        visible={!!chosen}
        summary={summary}
        ctaLabel={contactsComplete ? "Confirmer l'expédition" : 'Compléter les coordonnées'}
        onSubmit={submit}
        submitting={submitting}
        sideContent={next_departure_in_days != null ? `Prochain départ dans ${next_departure_in_days} j` : undefined}
        details={
          <div className="space-y-2.5 text-sm">
            <RecapRow label="Type" value={TYPES.find(t => t.id === type)?.label ?? '—'} />
            <RecapRow
              label="Trajet"
              value={originCity && destCity ? `${originCity.city} → ${destCity.city}` : '—'}
            />
            <RecapRow label="Poids" value={`${weight} kg`} />
            {chosen && <RecapRow label="Option" value={`${chosen.label} · ${chosen.eta_days}`} />}
            {finalPriceEur != null && <RecapRow label="Prix total" value={fmtEur(finalPriceEur)} strong />}
            {contactsComplete && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">Expéditeur</p>
                  <p className="mt-1 font-semibold">{senderName}</p>
                  <p className="text-muted-foreground">{senderPhone}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">Destinataire</p>
                  <p className="mt-1 font-semibold">{recipientName}</p>
                  <p className="text-muted-foreground">{recipientPhone}</p>
                </div>
              </div>
            )}
          </div>
        }
      />
    </FlowShell>
  );
}

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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full border-2 rounded-xl px-4 py-3 text-sm bg-card border-border placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground transition-all resize-none"
      />
    </label>
  );
}
