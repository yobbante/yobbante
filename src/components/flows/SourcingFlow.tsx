import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Factory, Search, Handshake, BadgeCheck, Truck, Sparkles, Loader2,
  Boxes, Crown, Zap, Clock, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  FlowShell, FlowHero, FlowSection, ChipGroup, CountryGrid, NumberSlider,
  TextField, MatchOptionCard, LiveSummaryBar, FlowSuccess, type MatchOptionView,
} from './FlowPrimitives';
import { useMatchOptions } from './useMatchOptions';
import { useDossiers } from '@/hooks/useDossiers';
import { useShipments } from '@/hooks/useShipments';
import { useFlowDraft, clearDraft, saveDraft } from '@/hooks/useFlowDraft';
import { supabase } from '@/integrations/supabase/client';
import { getDepartureCountdown, formatDepartureDate } from '@/lib/departureTime';
import type { WarehouseCountry } from '@/lib/types';

const ORIGINS = [
  { id: 'CN', flag: '🇨🇳', label: 'Chine' },
  { id: 'FR', flag: '🇫🇷', label: 'France' },
  { id: 'AE', flag: '🇦🇪', label: 'Dubai' },
  { id: 'US', flag: '🇺🇸', label: 'USA' },
];
const DESTINATIONS = [
  { id: 'SN', flag: '🇸🇳', label: 'Sénégal' },
  { id: 'CI', flag: '🇨🇮', label: "Côte d'Ivoire" },
  { id: 'ML', flag: '🇲🇱', label: 'Mali' },
  { id: 'GN', flag: '🇬🇳', label: 'Guinée' },
  { id: 'BF', flag: '🇧🇫', label: 'Burkina' },
  { id: 'TG', flag: '🇹🇬', label: 'Togo' },
];
const QUALITIES = [
  { id: 'standard' as const, label: 'Standard', desc: 'Bon rapport qualité-prix' },
  { id: 'premium'  as const, label: 'Premium',  desc: 'Fournisseurs vérifiés haut de gamme' },
  { id: 'custom'   as const, label: 'Sur mesure', desc: 'Personnalisation, OEM' },
];
const URGENCIES = [
  { id: 'flexible' as const, label: 'Flexible', desc: 'Délai souple' },
  { id: 'standard' as const, label: 'Standard', desc: 'Sous 2-3 semaines' },
  { id: 'urgent'   as const, label: 'Urgent',   desc: 'Priorité maximale' },
];

const ROLES = [
  { Icon: Search,     title: 'Sourcing fournisseurs', desc: '3 à 5 fournisseurs identifiés et qualifiés.' },
  { Icon: Handshake,  title: 'Négociation prix',     desc: 'Meilleur tarif obtenu, MOQ optimisé.' },
  { Icon: BadgeCheck, title: 'Contrôle qualité',     desc: 'Inspection avant expédition.' },
  { Icon: Truck,      title: 'Logistique complète',  desc: 'Transport, douane, livraison à votre porte.' },
];

const ORIGIN_CITY: Record<string, string> = { CN: 'Shenzhen', FR: 'Paris', AE: 'Dubai', US: 'Miami' };
const DEST_CITY:   Record<string, string> = { SN: 'Dakar', CI: 'Abidjan', ML: 'Bamako', GN: 'Conakry', BF: 'Ouagadougou', TG: 'Lomé' };
const COUNTRY_NAME = (id: string) =>
  [...ORIGINS, ...DESTINATIONS].find(c => c.id === id)?.label ?? id;

const OPTION_ICONS = {
  fast:    <Zap className="w-4 h-4" />,
  economy: <Clock className="w-4 h-4" />,
  volume:  <Boxes className="w-4 h-4" />,
} as const;

export function SourcingFlow({ compactHeader }: { compactHeader?: React.ReactNode } = {}) {
  const navigate = useNavigate();
  const { createDossier } = useDossiers();
  const { createShipment } = useShipments();

  const [productInput, setProductInput] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<null | {
    title: string; platform: string; estimatedPriceEur: number;
    estimatedWeightKg: number; imageUrl: string; suggestedQuantity: number;
  }>(null);

  const [quantity, setQuantity] = useState(100);
  const [budget, setBudget] = useState('');
  const [quality, setQuality] = useState<typeof QUALITIES[number]['id'] | null>(null);
  const [urgency, setUrgency] = useState<typeof URGENCIES[number]['id'] | null>(null);
  const [origin, setOrigin] = useState<string | null>('CN');
  const [destination, setDestination] = useState<string | null>(null);
  const [chosen, setChosen] = useState<MatchOptionView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  // Persist work-in-progress so a /auth round-trip never loses input
  const DRAFT_KEY = 'sourcing-flow';
  const draftSnapshot = { productInput, quantity, budget, quality, urgency, origin, destination };
  useFlowDraft(DRAFT_KEY, draftSnapshot, (d) => {
    if (d.productInput) setProductInput(d.productInput);
    if (typeof d.quantity === 'number') setQuantity(d.quantity);
    if (d.budget) setBudget(d.budget);
    if (d.quality) setQuality(d.quality);
    if (d.urgency) setUrgency(d.urgency);
    if (d.origin) setOrigin(d.origin);
    if (d.destination) setDestination(d.destination);
  });

  async function runParse() {
    const v = productInput.trim();
    if (v.length < 4) return;
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-product', { body: { input: v } });
      if (error) throw error;
      if (data && !data.error) {
        setParsed(data);
        if (data.suggestedQuantity && quantity === 100) setQuantity(Math.max(50, data.suggestedQuantity * 50));
      }
    } catch { /* silent */ } finally { setParsing(false); }
  }

  useEffect(() => {
    const v = productInput.trim();
    if (v.length < 8 || !/^https?:\/\//i.test(v)) return;
    const t = setTimeout(runParse, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productInput]);

  // Total estimated weight for shipping match
  const totalWeight = useMemo(() => {
    const w = parsed?.estimatedWeightKg ?? 0.3;
    return Math.max(1, Math.round(w * quantity));
  }, [parsed, quantity]);

  const matchInput = useMemo(() => {
    if (!origin || !destination || !quality || !urgency) return null;
    return {
      origin_city: ORIGIN_CITY[origin] ?? COUNTRY_NAME(origin),
      destination_city: DEST_CITY[destination] ?? COUNTRY_NAME(destination),
      weight_kg: totalWeight,
      urgency: urgency === 'urgent' ? ('fast' as const) : urgency === 'flexible' ? ('flexible' as const) : ('normal' as const),
    };
  }, [origin, destination, quality, urgency, totalWeight]);

  const { options, next_departure_in_days, next_departure_date, loading: matching } = useMatchOptions(matchInput);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const countdown = useMemo(() => getDepartureCountdown(next_departure_date, now), [next_departure_date, now]);

  useEffect(() => {
    if (!chosen && options.length > 0) {
      setChosen(options.find(o => o.id === 'volume') ?? options[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length]);

  const summary = chosen && parsed && quantity && destination
    ? `Sourcing ${quantity} × ${parsed.title.slice(0, 24)}… · ${chosen.label} · ${chosen.price_eur}€`
    : quantity && productInput && destination
      ? `Sourcing ${quantity} unités · livraison vers ${COUNTRY_NAME(destination)}`
      : '';

  async function submit() {
    if (!quantity || !origin || !destination || !quality || !urgency) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        saveDraft(DRAFT_KEY, draftSnapshot);
        toast.message('Connectez-vous pour finaliser — votre brief reste enregistré.');
        navigate(`/auth?redirect=${encodeURIComponent('/acheter')}`);
        return;
      }

      const dossier = await createDossier.mutateAsync({
        product_description: parsed?.title ?? productInput.trim(),
        estimated_weight: totalWeight,
        origin_country: origin as WarehouseCountry,
        destination_country: destination,
        budget_eur: budget ? Number(budget) : null,
        needs_sourcing: true,
        notes: [
          `Brief: ${productInput}`,
          `Quantité: ${quantity}`,
          budget ? `Budget: ${budget}€` : '',
          `Qualité: ${quality}`, `Urgence: ${urgency}`,
          chosen ? `Option transport: ${chosen.label} (${chosen.price_eur}€)` : '',
        ].filter(Boolean).join('\n'),
      });

      if (chosen) {
        await createShipment.mutateAsync({
          origin_country: origin as 'FR' | 'CN' | 'US',
          destination_country: destination,
          origin_city: ORIGIN_CITY[origin],
          destination_city: DEST_CITY[destination],
          departure_date: chosen.departure_date ?? next_departure_date ?? null,
          match_option: chosen,
        });
      }

      setReference(dossier.reference);
      clearDraft(DRAFT_KEY);
      toast.success('Sourcing lancé 🏭');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur');
    } finally { setSubmitting(false); }
  }

  if (reference) {
    return (
      <FlowShell theme="light" compactHeader={compactHeader}>
        <FlowSuccess
          reference={reference}
          title="Votre sourcing est lancé."
          subtitle="Notre équipe identifie les meilleurs fournisseurs et vous présente une short-list sous 48h."
          ctaHref="/app" ctaLabel="Voir mon espace"
        />
      </FlowShell>
    );
  }

  return (
    <FlowShell theme="light" compactHeader={compactHeader}>
      {!compactHeader && (
        <FlowHero
          eyebrow="Sourcing · Pour les entreprises et projets"
          title="Trouvez et importez vos produits directement auprès des fournisseurs."
          subtitle="Yobbanté s'occupe du sourcing, de la négociation, du contrôle qualité et de la livraison."
          info={<><strong className="text-foreground">Ce service est destiné aux achats auprès de fournisseurs (grossistes, fabricants).</strong> Pour recevoir une commande Amazon, Shein ou similaire, utilisez plutôt « Expédier · Recevoir ».</>}
        />
      )}
      <FlowSection revealed step={1} total={7} title="Que souhaitez-vous sourcer ?" hint="Décrivez le produit ou collez un lien Alibaba, 1688, Made-in-China…">
        <div className="space-y-3 max-w-xl">
          <TextField
            value={productInput} onChange={setProductInput}
            placeholder="ex. « 500 t-shirts coton bio brodés » ou https://alibaba.com/…"
            icon={<Factory className="w-4 h-4" />}
          />
          {!parsed && productInput.trim().length >= 4 && !/^https?:\/\//i.test(productInput) && (
            <button
              onClick={runParse} disabled={parsing}
              className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:opacity-70 disabled:opacity-50"
            >
              {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Analyser ce besoin
            </button>
          )}
        </div>

        {parsing && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours…
          </div>
        )}

        {parsed && (
          <div className="mt-5 rounded-2xl border-2 border-border bg-card p-4 sm:p-5 flex gap-4 max-w-xl animate-fade-in">
            <div className="w-20 h-20 rounded-xl bg-secondary overflow-hidden shrink-0 flex items-center justify-center">
              {parsed.imageUrl
                ? <img src={parsed.imageUrl} alt={parsed.title} className="w-full h-full object-cover" />
                : <Factory className="w-7 h-7 text-muted-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{parsed.platform}</p>
              <p className="mt-1 text-sm font-semibold leading-snug line-clamp-2 text-foreground">{parsed.title}</p>
              <div className="mt-2 text-xs text-muted-foreground">
                ~{parsed.estimatedWeightKg} kg / unité
              </div>
            </div>
          </div>
        )}
      </FlowSection>

      <FlowSection revealed={productInput.trim().length >= 4} step={2} total={7} title="Combien d'unités ?" hint="La quantité est essentielle pour obtenir le meilleur prix fournisseur.">
        <div className="space-y-5 max-w-md">
          <NumberSlider label="Quantité" value={quantity} onChange={setQuantity} min={10} max={5000} step={10} unit=" u." />
          <TextField
            label="Budget cible (optionnel)"
            value={budget} onChange={setBudget}
            placeholder="ex. 5000" suffix="€" type="number"
          />
        </div>
        {parsed && (
          <p className="mt-4 text-xs text-muted-foreground">
            👉 Vous recherchez <span className="text-foreground font-semibold">{quantity} unités</span> de <span className="text-foreground font-semibold">{parsed.title.slice(0, 50)}</span>
          </p>
        )}
      </FlowSection>

      <FlowSection revealed={!!parsed || productInput.trim().length >= 4} step={3} total={7} title="Niveau de qualité">
        <ChipGroup options={QUALITIES} value={quality} onChange={(v) => setQuality(v)} />
      </FlowSection>

      <FlowSection revealed={!!quality} step={4} total={7} title="Urgence du projet">
        <ChipGroup options={URGENCIES} value={urgency} onChange={(v) => setUrgency(v)} />
      </FlowSection>

      <FlowSection revealed={!!urgency} step={5} total={7} title="Le rôle de Yobbanté" hint="On gère ces 4 missions, de bout en bout.">
        <div className="grid sm:grid-cols-2 gap-2.5">
          {ROLES.map((r, i) => (
            <motion.div
              key={r.title}
              initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.4 }}
              className="flex items-start gap-3 rounded-xl border-2 border-border bg-card p-4"
            >
              <div className="w-9 h-9 rounded-lg bg-foreground text-background flex items-center justify-center shrink-0">
                <r.Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{r.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </FlowSection>

      <FlowSection revealed={!!urgency} step={6} total={7} title="Origine du sourcing">
        <CountryGrid countries={ORIGINS} value={origin} onChange={setOrigin} />
      </FlowSection>

      <FlowSection revealed={!!origin} step={7} total={7} title="Destination de livraison">
        <CountryGrid countries={DESTINATIONS} value={destination} onChange={setDestination} />
      </FlowSection>

      <FlowSection
        revealed={!!matchInput}
        title="Estimation logistique"
        hint={matching ? 'Calcul des options en cours…' : `Pour ${quantity} unités · ~${totalWeight} kg total.`}
      >
        {matching && (
          <div className="grid sm:grid-cols-3 gap-3">
            {[1,2,3].map(i => <div key={i} className="h-44 rounded-2xl border border-border bg-secondary/40 animate-pulse" />)}
          </div>
        )}
        {!matching && options.length > 0 && (
          <>
            <div className="grid sm:grid-cols-3 gap-3">
              {options.map(o => (
                <MatchOptionCard
                  key={o.id} opt={o} active={chosen?.id === o.id}
                  onClick={() => setChosen(o)} icon={OPTION_ICONS[o.id]}
                />
              ))}
            </div>
            {next_departure_date && (
              <div className="mt-5 space-y-2">
                <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="w-3.5 h-3.5 text-foreground" />
                  Prochain départ : {formatDepartureDate(next_departure_date)}
                  {countdown && !countdown.isPast && ` · ${countdown.label}`} · contrôle qualité inclus
                </p>
                {countdown?.under24h && (
                  <p role="status" className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    <Clock className="w-3.5 h-3.5" />
                    Départ dans moins de 24 h — confirmez vite.
                  </p>
                )}
                {countdown?.under48h && (
                  <p role="status" className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    Départ dans moins de 48 h — places limitées.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </FlowSection>

      <LiveSummaryBar
        visible={!!destination && !!quality && !!urgency}
        summary={summary}
        ctaLabel="Lancer le sourcing"
        onSubmit={submit}
        submitting={submitting}
        sideContent={chosen ? `Livraison ${chosen.eta_days} après production` : undefined}
      />
    </FlowShell>
  );
}
