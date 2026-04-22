import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, FileText, Boxes, Zap, Clock, Crown, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  FlowShell, FlowHero, FlowSection, ChipGroup, CountryGrid, NumberSlider,
  TextField, MatchOptionCard, LiveSummaryBar, FlowSuccess,
  type MatchOptionView,
} from './FlowPrimitives';
import { useMatchOptions } from './useMatchOptions';
import { useDossiers } from '@/hooks/useDossiers';
import { useShipments } from '@/hooks/useShipments';
import { supabase } from '@/integrations/supabase/client';
import type { WarehouseCountry } from '@/lib/types';

const ORIGINS = [
  { id: 'CN', flag: '🇨🇳', label: 'Chine' },
  { id: 'FR', flag: '🇫🇷', label: 'France' },
  { id: 'AE', flag: '🇦🇪', label: 'Dubai' },
  { id: 'US', flag: '🇺🇸', label: 'USA' },
  { id: 'DE', flag: '🇩🇪', label: 'Allemagne' },
  { id: 'CA', flag: '🇨🇦', label: 'Canada' },
];
const DESTINATIONS = [
  { id: 'SN', flag: '🇸🇳', label: 'Sénégal' },
  { id: 'CI', flag: '🇨🇮', label: "Côte d'Ivoire" },
  { id: 'ML', flag: '🇲🇱', label: 'Mali' },
  { id: 'GN', flag: '🇬🇳', label: 'Guinée' },
  { id: 'BF', flag: '🇧🇫', label: 'Burkina' },
  { id: 'TG', flag: '🇹🇬', label: 'Togo' },
];

const TYPES = [
  { id: 'documents' as const, label: 'Documents', desc: 'Plis, contrats', icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'package'   as const, label: 'Colis',     desc: 'Petit / moyen', icon: <Package className="w-3.5 h-3.5" /> },
  { id: 'bulk'      as const, label: 'Volume',    desc: 'Cartons / palette', icon: <Boxes className="w-3.5 h-3.5" /> },
];
const PRIORITIES = [
  { id: 'flexible' as const, label: 'Flexible', desc: 'Délai souple, prix doux', icon: <Clock className="w-3.5 h-3.5" /> },
  { id: 'normal'   as const, label: 'Standard', desc: 'Équilibre temps / prix', icon: <Zap className="w-3.5 h-3.5" /> },
  { id: 'fast'     as const, label: 'Rapide',   desc: 'Priorité absolue', icon: <Crown className="w-3.5 h-3.5" /> },
];

const ORIGIN_CITY: Record<string, string> = { CN: 'Shenzhen', FR: 'Paris', AE: 'Dubai', US: 'Miami', DE: 'Hambourg', CA: 'Montréal' };
const DEST_CITY:   Record<string, string> = { SN: 'Dakar', CI: 'Abidjan', ML: 'Bamako', GN: 'Conakry', BF: 'Ouagadougou', TG: 'Lomé' };
const COUNTRY_NAME = (id: string) =>
  [...ORIGINS, ...DESTINATIONS].find(c => c.id === id)?.label ?? id;

const OPTION_ICONS = {
  fast:    <Zap className="w-4 h-4" />,
  economy: <Clock className="w-4 h-4" />,
  volume:  <Boxes className="w-4 h-4" />,
} as const;

export function SendFlow({ compactHeader }: { compactHeader?: React.ReactNode } = {}) {
  const navigate = useNavigate();
  const { createDossier } = useDossiers();
  const { createShipment } = useShipments();

  const [type, setType] = useState<typeof TYPES[number]['id'] | null>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const [weight, setWeight] = useState(5);
  const [declaredValue, setDeclaredValue] = useState('');
  const [priority, setPriority] = useState<typeof PRIORITIES[number]['id'] | null>(null);
  const [chosen, setChosen] = useState<MatchOptionView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const matchInput = useMemo(() => {
    if (!origin || !destination || !weight || !priority) return null;
    return {
      origin_city: ORIGIN_CITY[origin] ?? COUNTRY_NAME(origin),
      destination_city: DEST_CITY[destination] ?? COUNTRY_NAME(destination),
      weight_kg: weight,
      urgency: priority,
    };
  }, [origin, destination, weight, priority]);

  const { options, next_departure_in_days, loading: matching } = useMatchOptions(matchInput);

  // Auto-pre-select the recommended (economy) option once results arrive
  useEffect(() => {
    if (!chosen && options.length > 0) {
      const reco = options.find(o => o.id === 'economy') ?? options[0];
      setChosen(reco);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length]);

  const summary = chosen
    ? `${COUNTRY_NAME(origin!)} → ${COUNTRY_NAME(destination!)} · ${chosen.label} · livraison ${chosen.eta_days} · ${chosen.price_eur}€`
    : '';

  async function submit() {
    if (!chosen || !origin || !destination || !type) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Connectez-vous pour valider');
        navigate(`/auth?redirect=${encodeURIComponent('/expedier/envoyer')}`);
        return;
      }

      const dossier = await createDossier.mutateAsync({
        product_description: `Expédition ${type} — ${COUNTRY_NAME(origin)} → ${COUNTRY_NAME(destination)}`,
        estimated_weight: weight,
        origin_country: origin as WarehouseCountry,
        destination_country: destination,
        notes: [
          `Type: ${type}`, `Poids: ${weight} kg`,
          declaredValue ? `Valeur: ${declaredValue}€` : '',
          `Priorité: ${priority}`, `Option: ${chosen.label} (${chosen.price_eur}€)`,
        ].filter(Boolean).join('\n'),
      });

      // Persist the chosen Konnekt option as a real shipment
      await createShipment.mutateAsync({
        origin_country: origin as 'FR' | 'CN' | 'US',
        destination_country: destination,
        origin_city: ORIGIN_CITY[origin],
        destination_city: DEST_CITY[destination],
        match_option: chosen,
      });

      setReference(dossier.reference);
      toast.success('Expédition enregistrée 🚀');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur');
    } finally { setSubmitting(false); }
  }

  if (reference) {
    return (
      <FlowShell theme="light" compactHeader={compactHeader}>
        <FlowSuccess
          reference={reference}
          title="Votre expédition est lancée."
          subtitle="Notre équipe organise tout et vous recontacte sous 24h. Suivez l'avancement dans votre espace."
          ctaHref="/app" ctaLabel="Voir mon espace"
        />
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
      <FlowSection revealed step={1} total={6} title="Que souhaitez-vous envoyer ?" hint="Sélectionnez la nature de votre envoi.">
        <ChipGroup options={TYPES} value={type} onChange={(v) => setType(v)} />
      </FlowSection>

      <FlowSection revealed={!!type} step={2} total={6} title="D'où part votre envoi ?">
        <CountryGrid countries={ORIGINS} value={origin} onChange={setOrigin} />
      </FlowSection>

      <FlowSection revealed={!!origin} step={3} total={6} title="Où doit-il arriver ?">
        <CountryGrid countries={DESTINATIONS} value={destination} onChange={setDestination} />
      </FlowSection>

      <FlowSection revealed={!!destination} step={4} total={6} title="Combien pèse votre envoi ?" hint="Vous pourrez l'ajuster plus tard.">
        <div className="space-y-5 max-w-md">
          <NumberSlider label="Poids estimé" value={weight} onChange={setWeight} min={1} max={500} unit=" kg" />
          <TextField
            label="Valeur déclarée (optionnel)"
            value={declaredValue} onChange={setDeclaredValue}
            placeholder="ex. 250" suffix="€" type="number"
          />
        </div>
      </FlowSection>

      <FlowSection revealed={!!destination} step={5} total={6} title="Quelle priorité ?">
        <ChipGroup options={PRIORITIES} value={priority} onChange={(v) => setPriority(v)} />
      </FlowSection>

      <FlowSection
        revealed={!!matchInput}
        step={6} total={6}
        title="Options disponibles"
        hint={matching ? 'Recherche des meilleures options en cours…' : 'Choisissez l\'offre qui vous convient.'}
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
                  key={o.id} opt={o}
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
      </FlowSection>

      <LiveSummaryBar
        visible={!!chosen}
        summary={summary}
        ctaLabel="Confirmer l'expédition"
        onSubmit={submit}
        submitting={submitting}
        sideContent={next_departure_in_days != null ? `Prochain départ dans ${next_departure_in_days} j` : undefined}
      />
    </FlowShell>
  );
}
