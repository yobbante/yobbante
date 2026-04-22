import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Package, FileText, Boxes,
  ShoppingCart, Truck, Plane, Ship, Send, Clock, Zap, Crown, Loader2,
  Phone, MessageCircle, User, Mail, Link2, Sparkles, ShieldCheck,
  Search, Handshake, BadgeCheck, MapPin, ImageIcon, Wand2,
} from 'lucide-react';
import { useDossiers } from '@/hooks/useDossiers';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { WarehouseCountry } from '@/lib/types';
import { estimateTransport, type Transport as TransportMode } from '@/lib/pricing';

interface DossierWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * When provided, skip the intent split screen and start directly on step 1 of that flow.
   * - 'ship'         → generic ship flow (legacy)
   * - 'ship-send'    → user is sending a package out
   * - 'ship-receive' → user is receiving an order from abroad
   * - 'buy'          → Yobbanté sources & buys for the user
   */
  presetIntent?: 'ship' | 'ship-send' | 'ship-receive' | 'buy';
}

type Intent = 'ship' | 'buy';
type ShipmentType = 'package' | 'documents' | 'bulk';
type Transport = TransportMode;
type Urgency = 'standard' | 'express' | 'priority';

const ORIGINS: { id: WarehouseCountry; flag: string; label: string }[] = [
  { id: 'CN', flag: '🇨🇳', label: 'Chine' },
  { id: 'FR', flag: '🇫🇷', label: 'France' },
  { id: 'AE', flag: '🇦🇪', label: 'Dubai' },
  { id: 'US', flag: '🇺🇸', label: 'États-Unis' },
  { id: 'DE', flag: '🇩🇪', label: 'Allemagne' },
  { id: 'CA', flag: '🇨🇦', label: 'Canada' },
];

const DESTINATIONS = [
  { id: 'SN', flag: '🇸🇳', label: 'Sénégal' },
  { id: 'CI', flag: '🇨🇮', label: "Côte d'Ivoire" },
  { id: 'ML', flag: '🇲🇱', label: 'Mali' },
  { id: 'GN', flag: '🇬🇳', label: 'Guinée' },
  { id: 'BF', flag: '🇧🇫', label: 'Burkina Faso' },
  { id: 'TG', flag: '🇹🇬', label: 'Togo' },
];

const SHIPMENT_TYPES: { id: ShipmentType; label: string; desc: string; Icon: typeof Package }[] = [
  { id: 'package', label: 'Colis', desc: 'Petit ou moyen colis', Icon: Package },
  { id: 'documents', label: 'Documents', desc: 'Plis, papiers, contrats', Icon: FileText },
  { id: 'bulk', label: 'Volume important', desc: 'Plusieurs cartons / palette', Icon: Boxes },
];

const TRANSPORTS: { id: Transport; label: string; desc: string; Icon: typeof Truck; price: string; eta: string; tag?: string }[] = [
  { id: 'gp',   label: 'GP',       desc: 'Groupage personnel — flexible & économique', Icon: Send,  price: 'Dès 8 €/kg',  eta: '7–14 j', tag: 'Recommandé' },
  { id: 'air',  label: 'Aérien',   desc: 'Rapide pour priorités',                       Icon: Plane, price: 'Dès 14 €/kg', eta: '3–6 j' },
  { id: 'sea',  label: 'Maritime', desc: 'Pour gros volumes',                           Icon: Ship,  price: 'Dès 1.2 €/kg', eta: '35–55 j' },
  { id: 'road', label: 'Routier',  desc: 'Régional & frontalier',                       Icon: Truck, price: 'Sur devis',   eta: '5–10 j' },
];

const URGENCIES: { id: Urgency; label: string; desc: string; Icon: typeof Clock }[] = [
  { id: 'standard', label: 'Standard', desc: 'Délai normal', Icon: Clock },
  { id: 'express',  label: 'Express',  desc: 'Priorité',     Icon: Zap },
  { id: 'priority', label: 'Priorité absolue', desc: 'Le plus rapide possible', Icon: Crown },
];

const intentLabel = (i: Intent | null) => i === 'ship' ? 'Expédier un colis' : i === 'buy' ? 'Acheter un produit' : '';

export function DossierWizard({ open, onOpenChange, presetIntent }: DossierWizardProps) {
  const { createDossier } = useDossiers();
  const navigate = useNavigate();

  // 0 = intent split. Then 1..N depending on intent.
  const [step, setStep] = useState(0);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  // Shared
  const [origin, setOrigin] = useState<WarehouseCountry | null>(null);
  const [destination, setDestination] = useState<string>('SN');
  const [transport, setTransport] = useState<Transport | null>(null);
  const [urgency, setUrgency] = useState<Urgency>('standard');

  // Flow A — ship
  const [shipType, setShipType] = useState<ShipmentType | null>(null);
  const [weight, setWeight] = useState<number>(5);

  // Flow B — buy
  const [productInput, setProductInput] = useState('');
  const [budget, setBudget] = useState<number>(500);
  const [quantity, setQuantity] = useState<number>(1);
  const [includeShipping, setIncludeShipping] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<null | {
    title: string; platform: string; estimatedPriceEur: number;
    estimatedWeightKg: number; category: string; imageUrl: string; suggestedQuantity: number;
  }>(null);

  // Final contact
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');

  // Reset on open
  useEffect(() => {
    if (open) {
      // Map sub-intents to internal canonical intent
      const canonicalIntent: Intent | null = presetIntent
        ? presetIntent === 'buy' ? 'buy' : 'ship'
        : null;
      setStep(canonicalIntent ? 1 : 0);
      setIntent(canonicalIntent);
      setReference(null);
      setOrigin(null);
      setDestination('SN');
      setTransport(null);
      setUrgency('standard');
      // Pre-select shipment type for "receive" flow (almost always a package)
      setShipType(presetIntent === 'ship-receive' ? 'package' : null);
      setWeight(5);
      setProductInput('');
      setBudget(500);
      setQuantity(1);
      setIncludeShipping(true);
      setParsing(false);
      setParsed(null);
      setName(''); setPhone(''); setWhatsapp(''); setEmail('');
    }
  }, [open, presetIntent]);

  const totalSteps = 6;

  const canNext = useMemo(() => {
    if (step === 0) return intent !== null;
    if (intent === 'ship') {
      if (step === 1) return shipType !== null;
      if (step === 2) return origin !== null && destination.length > 0;
      if (step === 3) return transport !== null && weight > 0;
      if (step === 4) return true;
      if (step === 5) return name.trim().length >= 2 && phone.trim().length >= 6;
    }
    if (intent === 'buy') {
      if (step === 1) return productInput.trim().length >= 4 && !parsing;
      if (step === 2) return budget > 0 && quantity > 0;
      if (step === 3) return true;
      if (step === 4) return includeShipping ? transport !== null : true;
      if (step === 5) return name.trim().length >= 2 && phone.trim().length >= 6;
    }
    return false;
  }, [step, intent, shipType, origin, destination, transport, weight, productInput, parsing, budget, quantity, includeShipping, name, phone]);

  const next = () => {
    if (!canNext) return;
    if (step === 5) return submit();
    setStep(s => s + 1);
  };
  const prev = () => setStep(s => Math.max(0, s - 1));

  const pickIntent = (i: Intent) => {
    setIntent(i);
    setTimeout(() => setStep(1), 180);
  };

  // Product parsing — calls existing parse-product edge function
  async function runParse() {
    const input = productInput.trim();
    if (input.length < 4) return;
    setParsing(true);
    setParsed(null);
    try {
      const { data, error } = await supabase.functions.invoke('parse-product', { body: { input } });
      if (error) throw error;
      if (data && !data.error) {
        setParsed(data);
        if (data.suggestedQuantity && quantity === 1) setQuantity(data.suggestedQuantity);
        if (data.estimatedPriceEur && budget === 500) {
          setBudget(Math.max(50, Math.round(data.estimatedPriceEur * (data.suggestedQuantity || 1))));
        }
      }
    } catch (e) {
      console.warn('parse-product failed:', e);
    } finally {
      setParsing(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Connectez-vous pour valider votre dossier');
        navigate('/auth');
        return;
      }

      const isBuy = intent === 'buy';
      const product_description = isBuy
        ? productInput.trim()
        : `Expédition ${shipType ?? ''} de ${origin ?? ''} → ${destination}`;

      const notesLines: string[] = [
        `Intent: ${intent}`,
        isBuy ? `Quantité: ${quantity}` : `Type: ${shipType}`,
        isBuy ? `Inclut livraison: ${includeShipping ? 'oui' : 'non'}` : `Poids estimé: ${weight} kg`,
        transport ? `Transport: ${transport.toUpperCase()}` : '',
        `Urgence: ${urgency}`,
        whatsapp ? `WhatsApp: ${whatsapp}` : '',
        name ? `Contact: ${name}` : '',
      ].filter(Boolean);

      const created = await createDossier.mutateAsync({
        product_description,
        estimated_weight: isBuy ? null : weight,
        origin_country: (origin ?? 'CN') as WarehouseCountry,
        destination_country: destination,
        budget_eur: isBuy ? budget : null,
        needs_sourcing: isBuy,
        contact_phone: phone || whatsapp || null,
        contact_email: email || null,
        notes: notesLines.join('\n'),
      });

      setReference(created.reference);
      setStep(6);
      toast.success('Dossier pris en charge 🚀');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur lors de la création du dossier');
    } finally {
      setSubmitting(false);
    }
  }

  const progressPct = step === 0 ? 0 : Math.min(100, (step / totalSteps) * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 max-w-2xl w-[calc(100vw-1rem)] sm:w-full max-h-[92vh] overflow-hidden border-0 bg-zinc-950 text-white rounded-2xl"
      >
        {/* Header / progress */}
        <div className="px-5 sm:px-7 pt-5 pb-3 border-b border-white/10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-yellow-400/15 text-yellow-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-white/50">Confier mon dossier</p>
                <p className="text-sm font-semibold truncate">
                  {step === 0 ? 'Que souhaitez-vous faire ?' : intentLabel(intent)}
                </p>
              </div>
            </div>
            {step > 0 && step <= totalSteps && (
              <span className="text-[11px] text-white/50 shrink-0">
                Étape {Math.min(step, totalSteps - 1)} / {totalSteps - 1}
              </span>
            )}
          </div>
          <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-yellow-400"
              initial={false}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="px-5 sm:px-7 py-5 overflow-y-auto max-h-[calc(92vh-9.5rem)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${intent ?? 'i'}-${step}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {/* STEP 0 — Intent split */}
              {step === 0 && (
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    Dites-nous ce dont vous avez besoin.
                  </h2>
                  <p className="text-sm text-white/60 mt-1.5">On s'occupe du reste, de A à Z.</p>

                  <div className="mt-6 grid sm:grid-cols-2 gap-3">
                    <IntentCard
                      Icon={Package}
                      title="Expédier un colis"
                      desc="On choisit le mode le plus adapté. Vous suivez en temps réel."
                      onClick={() => pickIntent('ship')}
                      active={intent === 'ship'}
                    />
                    <IntentCard
                      Icon={ShoppingCart}
                      title="Acheter un produit"
                      desc="On trouve, négocie et expédie pour vous."
                      onClick={() => pickIntent('buy')}
                      active={intent === 'buy'}
                    />
                  </div>

                  <div className="mt-6 flex items-center gap-2 text-xs text-white/40">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Sans engagement · Réponse sous 24h · Données protégées
                  </div>
                </div>
              )}

              {/* ───── FLOW A: SHIP ───── */}
              {intent === 'ship' && step === 1 && (
                <StepBlock title="Quel type d'envoi ?" subtitle="Sélectionnez la nature de votre colis.">
                  <div className="grid sm:grid-cols-3 gap-3">
                    {SHIPMENT_TYPES.map(t => (
                      <ChoiceCard
                        key={t.id}
                        Icon={t.Icon}
                        label={t.label}
                        desc={t.desc}
                        active={shipType === t.id}
                        onClick={() => { setShipType(t.id); setTimeout(() => setStep(2), 150); }}
                      />
                    ))}
                  </div>
                </StepBlock>
              )}

              {intent === 'ship' && step === 2 && (
                <StepBlock title="Origine et destination" subtitle="D'où part votre colis et où va-t-il ?">
                  <CountryGrid label="Origine" countries={ORIGINS} value={origin} onChange={(v) => setOrigin(v as WarehouseCountry)} />
                  <CountryGrid label="Destination" countries={DESTINATIONS} value={destination} onChange={setDestination} />
                </StepBlock>
              )}

              {intent === 'ship' && step === 3 && (
                <StepBlock title="Mode de transport recommandé" subtitle="Estimation en temps réel selon le poids.">
                  <div>
                    <div className="flex items-baseline justify-between">
                      <label className="text-xs text-white/60">Poids estimé</label>
                      <span className="text-sm text-white font-semibold">{weight} kg</span>
                    </div>
                    <input
                      type="range" min={1} max={500} step={1}
                      value={weight}
                      onChange={(e) => setWeight(Number(e.target.value))}
                      className="w-full accent-yellow-400 mt-2"
                    />
                    <div className="flex justify-between text-[10px] text-white/40 mt-1">
                      <span>1 kg</span><span>500 kg</span>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 mt-5">
                    {TRANSPORTS.map(t => {
                      const est = estimateTransport(t.id, weight, urgency);
                      return (
                        <TransportCard
                          key={t.id}
                          {...t}
                          estimate={est.formatted}
                          active={transport === t.id}
                          onClick={() => setTransport(t.id)}
                        />
                      );
                    })}
                  </div>
                </StepBlock>
              )}

              {intent === 'ship' && step === 4 && (
                <StepBlock title="Niveau d'urgence" subtitle="Standard, Express ou Priorité absolue.">
                  <div className="grid sm:grid-cols-3 gap-2">
                    {URGENCIES.map(u => (
                      <ChoiceCard key={u.id} Icon={u.Icon} label={u.label} desc={u.desc}
                        active={urgency === u.id} onClick={() => setUrgency(u.id)} compact />
                    ))}
                  </div>
                  {transport && (
                    <div className="mt-5 p-4 rounded-xl bg-yellow-400/10 border border-yellow-400/30">
                      <p className="text-[11px] uppercase tracking-wider text-yellow-400/80">Estimation actuelle</p>
                      <p className="text-2xl font-bold text-white mt-1">{estimateTransport(transport, weight, urgency).formatted}</p>
                      <p className="text-[11px] text-white/50 mt-1">
                        {TRANSPORTS.find(t => t.id === transport)?.label} · {weight} kg · {URGENCIES.find(u => u.id === urgency)?.label}
                      </p>
                    </div>
                  )}
                </StepBlock>
              )}

              {intent === 'ship' && step === 5 && (
                <ContactStep
                  name={name} setName={setName}
                  phone={phone} setPhone={setPhone}
                  whatsapp={whatsapp} setWhatsapp={setWhatsapp}
                  email={email} setEmail={setEmail}
                  recap={
                    <RecapShip
                      type={shipType} origin={origin} destination={destination}
                      transport={transport} weight={weight} urgency={urgency}
                    />
                  }
                />
              )}

              {/* ───── FLOW B: BUY ───── */}
              {intent === 'buy' && step === 1 && (
                <StepBlock title="Que souhaitez-vous acheter ?" subtitle="Collez un lien produit ou décrivez ce que vous cherchez.">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link2 className="w-4 h-4 absolute left-3 top-3 text-white/40" />
                      <Input
                        autoFocus
                        placeholder="ex: https://alibaba.com/... ou « 50 lampes solaires LED »"
                        value={productInput}
                        onChange={(e) => { setProductInput(e.target.value); setParsed(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') runParse(); }}
                        className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 input-glow h-11"
                      />
                    </div>
                    <button
                      onClick={runParse}
                      disabled={parsing || productInput.trim().length < 4}
                      className="h-11 px-4 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-40 transition"
                    >
                      {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                      Analyser
                    </button>
                  </div>
                  <p className="text-[11px] text-white/40 mt-2">Amazon, Alibaba, 1688, AliExpress — ou simple description.</p>

                  <AnimatePresence>
                    {parsed && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-4 p-3 rounded-xl bg-white/5 border border-yellow-400/30 flex gap-3"
                      >
                        {parsed.imageUrl ? (
                          <img
                            src={parsed.imageUrl}
                            alt={parsed.title}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            className="w-16 h-16 rounded-lg object-cover bg-white/5 shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                            <ImageIcon className="w-5 h-5 text-white/30" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-yellow-400 text-zinc-950 font-bold">
                              {parsed.platform}
                            </span>
                            <span className="text-[10px] text-white/40">{parsed.category}</span>
                          </div>
                          <p className="text-sm font-semibold text-white mt-1 line-clamp-2">{parsed.title}</p>
                          <div className="flex gap-3 mt-1.5 text-[11px]">
                            {parsed.estimatedPriceEur > 0 && (
                              <span className="text-yellow-400 font-medium">~{parsed.estimatedPriceEur} €/u</span>
                            )}
                            {parsed.estimatedWeightKg > 0 && (
                              <span className="text-white/50">~{parsed.estimatedWeightKg} kg/u</span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </StepBlock>
              )}

              {intent === 'buy' && step === 2 && (
                <StepBlock title="Vos attentes" subtitle="Budget cible, quantité et niveau d'urgence.">
                  <div>
                    <label className="text-xs text-white/60">Budget cible : <span className="text-white font-semibold">{budget} €</span></label>
                    <input
                      type="range" min={50} max={20000} step={50}
                      value={budget}
                      onChange={(e) => setBudget(Number(e.target.value))}
                      className="w-full accent-yellow-400 mt-2"
                    />
                    <div className="flex justify-between text-[10px] text-white/40 mt-1">
                      <span>50 €</span><span>20 000 €</span>
                    </div>
                  </div>
                  <div className="mt-5">
                    <label className="text-xs text-white/60">Quantité</label>
                    <Input
                      type="number" min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                      className="mt-1 bg-white/5 border-white/10 text-white input-glow h-11"
                    />
                  </div>
                  <div className="mt-5">
                    <p className="text-xs text-white/60 mb-2">Urgence</p>
                    <div className="grid sm:grid-cols-3 gap-2">
                      {URGENCIES.map(u => (
                        <ChoiceCard key={u.id} Icon={u.Icon} label={u.label} desc={u.desc}
                          active={urgency === u.id} onClick={() => setUrgency(u.id)} compact />
                      ))}
                    </div>
                  </div>
                </StepBlock>
              )}

              {intent === 'buy' && step === 3 && (
                <StepBlock title="Voici ce que Yobbanté va faire pour vous" subtitle="Service end-to-end, un seul interlocuteur.">
                  <ul className="space-y-3">
                    {[
                      { Icon: Search, text: 'Trouver le bon fournisseur (Chine, Dubai, Europe…)' },
                      { Icon: Handshake, text: 'Négocier le meilleur prix selon votre budget' },
                      { Icon: BadgeCheck, text: 'Vérifier la qualité avant expédition' },
                      { Icon: Truck, text: 'Gérer l\'expédition jusqu\'à votre adresse' },
                    ].map(({ Icon, text }) => (
                      <li key={text} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="w-8 h-8 rounded-lg bg-yellow-400/15 text-yellow-400 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm text-white/90">{text}</span>
                      </li>
                    ))}
                  </ul>
                </StepBlock>
              )}

              {intent === 'buy' && step === 4 && (
                <StepBlock title="Souhaitez-vous que nous gérions aussi la livraison ?" subtitle="Recommandé pour un suivi 100% intégré.">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <ChoiceCard
                      Icon={Truck}
                      label="Oui, gérer la livraison"
                      desc="Yobbanté livre jusqu'à vous"
                      active={includeShipping}
                      onClick={() => setIncludeShipping(true)}
                    />
                    <ChoiceCard
                      Icon={MapPin}
                      label="Non, je récupère moi-même"
                      desc="Vous gérez le transport final"
                      active={!includeShipping}
                      onClick={() => { setIncludeShipping(false); setTransport(null); }}
                    />
                  </div>
                  {includeShipping && (
                    <div className="mt-5">
                      <p className="text-xs text-white/60 mb-2">Mode de transport</p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {TRANSPORTS.map(t => {
                          const w = parsed?.estimatedWeightKg ? Math.max(1, Math.round(parsed.estimatedWeightKg * quantity)) : 5;
                          const est = estimateTransport(t.id, w, urgency);
                          return (
                            <TransportCard key={t.id} {...t} estimate={est.formatted} active={transport === t.id} onClick={() => setTransport(t.id)} />
                          );
                        })}
                      </div>
                      <div className="mt-4">
                        <p className="text-xs text-white/60 mb-1">Destination</p>
                        <CountryGrid label="" countries={DESTINATIONS} value={destination} onChange={setDestination} compact />
                      </div>
                    </div>
                  )}
                </StepBlock>
              )}

              {intent === 'buy' && step === 5 && (
                <ContactStep
                  name={name} setName={setName}
                  phone={phone} setPhone={setPhone}
                  whatsapp={whatsapp} setWhatsapp={setWhatsapp}
                  email={email} setEmail={setEmail}
                  recap={
                    <RecapBuy
                      product={productInput} budget={budget} quantity={quantity}
                      includeShipping={includeShipping} transport={transport}
                      destination={destination} urgency={urgency}
                    />
                  }
                />
              )}

              {/* ───── SUCCESS ───── */}
              {step === 6 && (
                <SuccessScreen reference={reference} intent={intent} onClose={() => onOpenChange(false)} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        {step > 0 && step < 6 && (
          <div className="px-5 sm:px-7 py-3.5 border-t border-white/10 flex items-center justify-between bg-zinc-950">
            <button
              onClick={prev}
              className="text-sm text-white/60 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> Retour
            </button>
            <button
              onClick={next}
              disabled={!canNext || submitting}
              className="btn-cta-yellow disabled:opacity-40"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  {step === 5 ? 'Valider mon dossier' : 'Continuer'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ───────────── Subcomponents ───────────── */

function StepBlock({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h3>
      {subtitle && <p className="text-sm text-white/60 mt-1">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function IntentCard({ Icon, title, desc, onClick, active }: {
  Icon: any; title: string; desc: string; onClick: () => void; active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group text-left p-5 rounded-2xl border transition-all duration-200",
        "bg-white/5 hover:bg-white/[0.08] hover:-translate-y-0.5",
        active ? "border-yellow-400 bg-yellow-400/10" : "border-white/10",
      )}
    >
      <div className={cn(
        "w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-colors",
        active ? "bg-yellow-400 text-zinc-950" : "bg-white/10 text-white group-hover:bg-yellow-400/20 group-hover:text-yellow-400",
      )}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-white/60 mt-1">{desc}</p>
    </button>
  );
}

function ChoiceCard({ Icon, label, desc, active, onClick, compact }: {
  Icon: any; label: string; desc?: string; active: boolean; onClick: () => void; compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left rounded-xl border transition-all duration-150 hover:-translate-y-0.5",
        compact ? "p-3" : "p-4",
        active ? "border-yellow-400 bg-yellow-400/10" : "border-white/10 bg-white/5 hover:bg-white/[0.08]",
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          active ? "bg-yellow-400 text-zinc-950" : "bg-white/10 text-white",
        )}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{label}</p>
          {desc && <p className="text-[11px] text-white/55 truncate">{desc}</p>}
        </div>
      </div>
    </button>
  );
}

function TransportCard({ id, label, desc, Icon, price, eta, tag, estimate, active, onClick }: {
  id: Transport; label: string; desc: string; Icon: any; price: string; eta: string;
  tag?: string; estimate?: string;
  active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left p-4 rounded-xl border transition-all duration-150 relative hover:-translate-y-0.5",
        active ? "border-yellow-400 bg-yellow-400/10" : "border-white/10 bg-white/5 hover:bg-white/[0.08]",
      )}
    >
      {tag && (
        <span className="absolute top-2.5 right-2.5 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-yellow-400 text-zinc-950 font-bold">
          {tag}
        </span>
      )}
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
          active ? "bg-yellow-400 text-zinc-950" : "bg-white/10 text-white",
        )}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-[11px] text-white/55 mt-0.5">{desc}</p>
          {estimate ? (
            <div className="mt-2">
              <motion.p
                key={estimate}
                initial={{ opacity: 0.4 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="text-base font-bold text-yellow-400"
              >
                {estimate}
              </motion.p>
              <p className="text-[10px] text-white/40 mt-0.5">{price} · {eta}</p>
            </div>
          ) : (
            <div className="flex gap-3 mt-2 text-[11px]">
              <span className="text-yellow-400 font-medium">{price}</span>
              <span className="text-white/40">· {eta}</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function CountryGrid({ label, countries, value, onChange, compact }: {
  label: string; countries: { id: string; flag: string; label: string }[];
  value: string | null; onChange: (v: string) => void; compact?: boolean;
}) {
  return (
    <div className={compact ? '' : 'mb-4'}>
      {label && <p className="text-xs text-white/60 mb-2">{label}</p>}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {countries.map(c => (
          <button
            key={c.id}
            onClick={() => onChange(c.id)}
            className={cn(
              "p-2.5 rounded-lg border text-center transition-all hover:-translate-y-0.5",
              value === c.id ? "border-yellow-400 bg-yellow-400/10" : "border-white/10 bg-white/5 hover:bg-white/[0.08]",
            )}
          >
            <div className="text-xl leading-none">{c.flag}</div>
            <p className="text-[10px] text-white/70 mt-1 truncate">{c.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ContactStep({ name, setName, phone, setPhone, whatsapp, setWhatsapp, email, setEmail, recap }: {
  name: string; setName: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  whatsapp: string; setWhatsapp: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  recap: React.ReactNode;
}) {
  return (
    <StepBlock title="Confirmation" subtitle="Un expert Yobbanté vous recontacte sous 24h.">
      <div className="space-y-3">
        <div className="relative">
          <User className="w-4 h-4 absolute left-3 top-3 text-white/40" />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom"
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 input-glow h-11" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="relative">
            <Phone className="w-4 h-4 absolute left-3 top-3 text-white/40" />
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone"
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 input-glow h-11" />
          </div>
          <div className="relative">
            <MessageCircle className="w-4 h-4 absolute left-3 top-3 text-white/40" />
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp (optionnel)"
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 input-glow h-11" />
          </div>
        </div>
        <div className="relative">
          <Mail className="w-4 h-4 absolute left-3 top-3 text-white/40" />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optionnel)" type="email"
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 input-glow h-11" />
        </div>
      </div>

      <div className="mt-5 p-4 rounded-xl bg-white/5 border border-white/10">
        <p className="text-[11px] uppercase tracking-wider text-white/50 mb-2">Récapitulatif</p>
        {recap}
      </div>
    </StepBlock>
  );
}

function RecapShip({ type, origin, destination, transport, weight, urgency }: {
  type: ShipmentType | null; origin: WarehouseCountry | null; destination: string;
  transport: Transport | null; weight: number; urgency: Urgency;
}) {
  return (
    <ul className="text-sm space-y-1.5 text-white/80">
      <li>📦 Type : <span className="text-white">{SHIPMENT_TYPES.find(s => s.id === type)?.label ?? '—'}</span></li>
      <li>🌍 Trajet : <span className="text-white">{ORIGINS.find(o => o.id === origin)?.label ?? '—'} → {DESTINATIONS.find(d => d.id === destination)?.label ?? destination}</span></li>
      <li>🚚 Transport : <span className="text-white">{TRANSPORTS.find(t => t.id === transport)?.label ?? '—'}</span></li>
      <li>⚖️ Poids : <span className="text-white">{weight} kg</span></li>
      <li>⏱️ Urgence : <span className="text-white">{URGENCIES.find(u => u.id === urgency)?.label}</span></li>
    </ul>
  );
}

function RecapBuy({ product, budget, quantity, includeShipping, transport, destination, urgency }: {
  product: string; budget: number; quantity: number;
  includeShipping: boolean; transport: Transport | null; destination: string; urgency: Urgency;
}) {
  return (
    <ul className="text-sm space-y-1.5 text-white/80">
      <li>🛒 Produit : <span className="text-white line-clamp-2">{product}</span></li>
      <li>💰 Budget : <span className="text-white">{budget} €</span> · Quantité : <span className="text-white">{quantity}</span></li>
      <li>🚚 Livraison : <span className="text-white">{includeShipping ? `${TRANSPORTS.find(t => t.id === transport)?.label ?? '—'} → ${DESTINATIONS.find(d => d.id === destination)?.label ?? destination}` : 'Récup. sur place'}</span></li>
      <li>⏱️ Urgence : <span className="text-white">{URGENCIES.find(u => u.id === urgency)?.label}</span></li>
    </ul>
  );
}

function SuccessScreen({ reference, intent, onClose }: { reference: string | null; intent: Intent | null; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="text-center py-6"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }}
        className="mx-auto w-16 h-16 rounded-full bg-yellow-400 text-zinc-950 flex items-center justify-center mb-4"
      >
        <CheckCircle2 className="w-9 h-9" strokeWidth={2.5} />
      </motion.div>
      <h3 className="text-2xl font-bold">Votre dossier est pris en charge 🚀</h3>
      {reference && (
        <p className="text-sm text-white/60 mt-1">Référence : <span className="text-yellow-400 font-mono">{reference}</span></p>
      )}
      <div className="mt-5 max-w-sm mx-auto p-4 rounded-xl bg-white/5 border border-white/10 text-left text-sm text-white/80 space-y-2">
        <p className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" /> Un expert Yobbanté vous est assigné</p>
        <p className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" /> Réponse personnalisée sous 24h</p>
        <p className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" /> {intent === 'buy' ? 'Sourcing lancé immédiatement' : 'Préparation du transport en cours'}</p>
      </div>
      <button onClick={onClose} className="btn-cta-yellow mt-6">Fermer</button>
    </motion.div>
  );
}
