import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, Loader2, Copy, Check, Inbox, ShieldCheck, Zap, Clock, Boxes, Sparkles, X, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  FlowShell, FlowHero, FlowSection, CountryGrid, ToggleRow, TextField,
  MatchOptionCard, LiveSummaryBar, FlowSuccess, type MatchOptionView,
} from './FlowPrimitives';
import { useMatchOptions } from './useMatchOptions';
import { useDossiers } from '@/hooks/useDossiers';
import { useShipments } from '@/hooks/useShipments';
import { useAddresses } from '@/hooks/useAddresses';
import { supabase } from '@/integrations/supabase/client';
import type { WarehouseCountry } from '@/lib/types';

const HUBS = [
  { id: 'CN', flag: '🇨🇳', label: 'Chine' },
  { id: 'FR', flag: '🇫🇷', label: 'France' },
  { id: 'US', flag: '🇺🇸', label: 'USA' },
  { id: 'AE', flag: '🇦🇪', label: 'Dubai' },
];
const DESTINATIONS = [
  { id: 'SN', flag: '🇸🇳', label: 'Sénégal' },
  { id: 'CI', flag: '🇨🇮', label: "Côte d'Ivoire" },
  { id: 'ML', flag: '🇲🇱', label: 'Mali' },
  { id: 'GN', flag: '🇬🇳', label: 'Guinée' },
  { id: 'BF', flag: '🇧🇫', label: 'Burkina' },
  { id: 'TG', flag: '🇹🇬', label: 'Togo' },
];
const ORIGIN_CITY: Record<string, string> = { CN: 'Shenzhen', FR: 'Paris', US: 'Miami', AE: 'Dubai' };
const DEST_CITY:   Record<string, string> = { SN: 'Dakar', CI: 'Abidjan', ML: 'Bamako', GN: 'Conakry', BF: 'Ouagadougou', TG: 'Lomé' };
const COUNTRY_NAME = (id: string) =>
  [...HUBS, ...DESTINATIONS].find(c => c.id === id)?.label ?? id;

const OPTION_ICONS = {
  fast:    <Zap className="w-4 h-4" />,
  economy: <Clock className="w-4 h-4" />,
  volume:  <Boxes className="w-4 h-4" />,
} as const;

type ParsedItem = {
  id: string;
  source: string; // raw input (URL or description)
  title: string;
  platform: string;
  estimatedPriceEur: number;
  estimatedWeightKg: number;
  imageUrl: string;
};

export function ReceiveFlow({ compactHeader }: { compactHeader?: React.ReactNode } = {}) {
  const navigate = useNavigate();
  const { createDossier } = useDossiers();
  const { createShipment } = useShipments();
  const { addresses } = useAddresses();

  const [productInput, setProductInput] = useState('');
  const [parsing, setParsing] = useState(false);
  const [items, setItems] = useState<ParsedItem[]>([]);

  const [hub, setHub] = useState<string | null>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const [consolidate, setConsolidate] = useState(false);
  const [inspect, setInspect] = useState(true);
  const [chosen, setChosen] = useState<MatchOptionView | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const hasItems = items.length > 0;
  const totalWeight = useMemo(
    () => items.reduce((s, it) => s + (it.estimatedWeightKg || 0.5), 0),
    [items]
  );
  const totalValue = useMemo(
    () => items.reduce((s, it) => s + (it.estimatedPriceEur || 0), 0),
    [items]
  );

  const hubAddress = useMemo(
    () => hub ? addresses.find(a => a.country === hub) : null,
    [hub, addresses]
  );

  async function runParse(input?: string) {
    const v = (input ?? productInput).trim();
    if (v.length < 4) return;
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-product', { body: { input: v } });
      if (error) throw error;
      if (data && !data.error) {
        const item: ParsedItem = {
          id: crypto.randomUUID(),
          source: v,
          title: data.title,
          platform: data.platform,
          estimatedPriceEur: data.estimatedPriceEur ?? 0,
          estimatedWeightKg: data.estimatedWeightKg ?? 0.5,
          imageUrl: data.imageUrl ?? '',
        };
        setItems(prev => [...prev, item]);
        setProductInput(''); // ready for next link
        toast.success('Produit ajouté');
      } else {
        toast.error('Produit non reconnu');
      }
    } catch {
      toast.error('Analyse échouée');
    } finally { setParsing(false); }
  }

  // Refs for keyboard navigation: input → first item → next/prev item.
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);

  function focusItem(index: number) {
    itemRefs.current[index]?.focus();
  }

  function removeItem(id: string) {
    const idx = items.findIndex(it => it.id === id);
    if (idx < 0) return;
    const removed = items[idx];
    setItems(prev => prev.filter(it => it.id !== id));
    // Undo snackbar — restore at original position if user changed mind.
    toast('Produit retiré', {
      description: removed.title,
      action: {
        label: 'Annuler',
        onClick: () => {
          setItems(prev => {
            if (prev.some(it => it.id === removed.id)) return prev;
            const next = [...prev];
            next.splice(Math.min(idx, next.length), 0, removed);
            return next;
          });
        },
      },
      duration: 5000,
    });
  }

  // Input keyboard handler: Enter parses, ArrowDown jumps into the items list.
  function onInputKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (productInput.trim().length >= 4 && !parsing) runParse();
    } else if (e.key === 'ArrowDown' && items.length > 0) {
      e.preventDefault();
      focusItem(0);
    }
  }

  // Item keyboard handler: Arrow keys to move focus, Backspace/Delete removes.
  function onItemKey(e: KeyboardEvent<HTMLLIElement>, index: number) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (index + 1 < items.length) focusItem(index + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (index > 0) focusItem(index - 1);
      else inputRef.current?.focus();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      const id = items[index]?.id;
      if (id) removeItem(id);
    }
  }

  // Auto-parse when user pastes a URL
  useEffect(() => {
    const v = productInput.trim();
    if (v.length < 8) return;
    if (!/^https?:\/\//i.test(v)) return;
    const t = setTimeout(() => runParse(v), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productInput]);

  const matchInput = useMemo(() => {
    if (!hub || !destination || !hasItems) return null;
    return {
      origin_city: ORIGIN_CITY[hub] ?? COUNTRY_NAME(hub),
      destination_city: DEST_CITY[destination] ?? COUNTRY_NAME(destination),
      weight_kg: Math.max(0.5, totalWeight),
      urgency: 'normal' as const,
    };
  }, [hub, destination, hasItems, totalWeight]);

  const { options, next_departure_in_days, loading: matching } = useMatchOptions(matchInput);

  useEffect(() => {
    if (!chosen && options.length > 0) {
      setChosen(options.find(o => o.id === 'economy') ?? options[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length]);

  function copyAddress() {
    if (!hubAddress) return;
    const text = `${hubAddress.address_line}\nRéf: ${hubAddress.identifier_code}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Adresse copiée');
    setTimeout(() => setCopied(false), 1800);
  }

  const summary = chosen && hasItems && hub && destination
    ? `${items.length} produit${items.length > 1 ? 's' : ''} · ${COUNTRY_NAME(hub)} → ${COUNTRY_NAME(destination)} · ${chosen.label} · ${chosen.price_eur}€`
    : '';

  async function submit() {
    if (!chosen || !hub || !destination || !hasItems) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Connectez-vous pour valider');
        navigate(`/auth?redirect=${encodeURIComponent('/expedier/recevoir')}`);
        return;
      }

      const productSummary = items.map(it => `• ${it.title} (${it.platform}, ~${it.estimatedWeightKg}kg)`).join('\n');
      const dossier = await createDossier.mutateAsync({
        product_description: items.length === 1
          ? `Réception: ${items[0].title}`
          : `Réception groupée: ${items.length} produits`,
        estimated_weight: totalWeight,
        origin_country: hub as WarehouseCountry,
        destination_country: destination,
        budget_eur: totalValue || null,
        notes: [
          `Produits:\n${productSummary}`,
          `Consolidation: ${consolidate ? 'oui' : 'non'}`,
          `Inspection: ${inspect ? 'oui' : 'non'}`,
          `Option: ${chosen.label} (${chosen.price_eur}€)`,
        ].join('\n'),
      });

      await createShipment.mutateAsync({
        origin_country: hub as 'FR' | 'CN' | 'US',
        destination_country: destination,
        origin_city: ORIGIN_CITY[hub],
        destination_city: DEST_CITY[destination],
        match_option: chosen,
      });

      setReference(dossier.reference);
      toast.success('Réception préparée 📦');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur');
    } finally { setSubmitting(false); }
  }

  if (reference) {
    return (
      <FlowShell theme="dark" compactHeader={compactHeader}>
        <FlowSuccess
          reference={reference}
          title="Votre commande va être réceptionnée."
          subtitle="Utilisez l'adresse Yobbanté pour vous faire livrer. Nous vous notifions à chaque étape."
          ctaHref="/app" ctaLabel="Voir mon espace"
        />
      </FlowShell>
    );
  }

  const TOTAL = 5;

  return (
    <FlowShell theme="dark" compactHeader={compactHeader}>
      {!compactHeader && (
        <FlowHero
          eyebrow="Expédier · Recevoir"
          title="Recevez votre commande, où qu'elle soit achetée."
          subtitle="Donnez-nous le lien. On réceptionne, regroupe, vérifie et vous livre chez vous."
          info={<><strong className="text-white">Pour les commandes Amazon, Shein, Alibaba, etc.</strong> Pour du sourcing fournisseur en gros, utilisez plutôt « Lancer un sourcing produit ».</>}
        />
      )}
      <FlowSection
        revealed step={1} total={TOTAL}
        title={hasItems ? 'Ajouter un autre produit ?' : 'Collez le lien de votre commande'}
        hint="Amazon, Shein, AliExpress, Alibaba… ou décrivez le produit. Vous pouvez en ajouter plusieurs."
      >
        <div className="space-y-3 max-w-xl">
          <TextField
            value={productInput} onChange={setProductInput}
            placeholder="https://… ou « casque audio sans fil »"
            icon={<Link2 className="w-4 h-4" />}
          />
          {productInput.trim().length >= 4 && !/^https?:\/\//i.test(productInput) && (
            <button
              onClick={() => runParse()}
              disabled={parsing}
              className="inline-flex items-center gap-2 text-sm font-semibold text-yellow-400 hover:text-yellow-300 disabled:opacity-50"
            >
              {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Ajouter ce produit
            </button>
          )}
        </div>

        {parsing && (
          <div className="mt-5 flex items-center gap-2 text-sm text-white/60">
            <Loader2 className="w-4 h-4 animate-spin" /> Analyse du produit en cours…
          </div>
        )}

        {/* Parsed items list */}
        <AnimatePresence initial={false}>
          {items.length > 0 && (
            <motion.ul
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="mt-6 space-y-2.5 max-w-xl"
            >
              {items.map((it) => (
                <motion.li
                  key={it.id}
                  layout
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                  className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4 flex gap-3 sm:gap-4 hover:border-white/20 transition-colors"
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                    {it.imageUrl
                      ? <img src={it.imageUrl} alt={it.title} className="w-full h-full object-cover" />
                      : <Inbox className="w-6 h-6 text-white/30" />}
                  </div>
                  <div className="min-w-0 flex-1 pr-7">
                    <p className="text-[10px] uppercase tracking-wider text-yellow-400/80 font-medium">{it.platform}</p>
                    <p className="mt-0.5 text-sm font-semibold leading-snug line-clamp-2 text-white">{it.title}</p>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-white/55">
                      {it.estimatedPriceEur > 0 && <span className="font-semibold text-white">{it.estimatedPriceEur}€</span>}
                      <span>~{it.estimatedWeightKg} kg</span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(it.id)}
                    aria-label="Supprimer ce produit"
                    className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-white/35 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>

        {hasItems && (
          <p className="mt-3 text-[11px] text-white/45 max-w-xl">
            {items.length} produit{items.length > 1 ? 's' : ''} · ~{totalWeight.toFixed(1)} kg total
            {totalValue > 0 && ` · ~${totalValue}€`}
          </p>
        )}
      </FlowSection>

      <FlowSection
        revealed={hasItems} step={2} total={TOTAL}
        title="Adresse de réception Yobbanté" hint="Choisissez l'entrepôt où vous voulez vous faire livrer."
      >
        <CountryGrid countries={HUBS} value={hub} onChange={setHub} />

        {hubAddress && (
          <div className="mt-5 rounded-2xl border-2 border-yellow-400/40 bg-yellow-400/5 p-5 max-w-xl animate-fade-in">
            <p className="text-[10px] uppercase tracking-wider text-yellow-400 font-semibold">Votre adresse {COUNTRY_NAME(hub!)}</p>
            <p className="mt-2 text-sm text-white whitespace-pre-line leading-relaxed">{hubAddress.address_line}</p>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="text-white/50">Réf:</span>
              <code className="font-mono font-semibold text-yellow-400">{hubAddress.identifier_code}</code>
            </div>
            <button
              onClick={copyAddress}
              className="mt-4 inline-flex items-center gap-2 text-xs font-semibold bg-yellow-400 text-zinc-950 rounded-lg px-3 py-2 hover:bg-yellow-300 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copié' : 'Copier l\'adresse'}
            </button>
          </div>
        )}
      </FlowSection>

      <FlowSection revealed={!!hub} step={3} total={TOTAL} title="Options de réception">
        <div className="space-y-2.5 max-w-xl">
          <ToggleRow
            label="Consolidation" desc="Regrouper plusieurs commandes en une seule expédition."
            value={consolidate} onChange={setConsolidate}
          />
          <ToggleRow
            label="Contrôle qualité" desc="Vérification visuelle avant expédition."
            value={inspect} onChange={setInspect}
          />
        </div>
      </FlowSection>

      <FlowSection revealed={!!hub} step={4} total={TOTAL} title="Où vous livrer ?">
        <CountryGrid countries={DESTINATIONS} value={destination} onChange={setDestination} />
      </FlowSection>

      <FlowSection
        revealed={!!matchInput} step={5} total={TOTAL}
        title="Options de livraison"
        hint={matching ? 'Recherche des meilleures options…' : 'Choisissez votre offre.'}
      >
        {matching && (
          <div className="grid sm:grid-cols-3 gap-3">
            {[1,2,3].map(i => <div key={i} className="h-44 rounded-2xl border border-white/10 bg-white/[0.02] animate-pulse" />)}
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
              <p className="mt-5 inline-flex items-center gap-2 text-xs text-white/55">
                <ShieldCheck className="w-3.5 h-3.5 text-yellow-400" />
                Prochain départ dans {next_departure_in_days} j · suivi inclus
              </p>
            )}
          </>
        )}
      </FlowSection>

      <LiveSummaryBar
        visible={!!chosen}
        summary={summary}
        ctaLabel="Confirmer la réception"
        onSubmit={submit}
        submitting={submitting}
        sideContent={next_departure_in_days != null ? `Prochain départ dans ${next_departure_in_days} j` : undefined}
      />
    </FlowShell>
  );
}
