import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { COUNTRY_FLAGS, COUNTRY_NAMES, type WarehouseCountry } from '@/lib/types';
import {
  ShoppingBag, Package, Layers, ArrowLeft, Loader2, CheckCircle2,
  Sparkles, Zap, Clock, ShieldCheck, Link2, MapPin,
} from 'lucide-react';
import { useDossiers } from '@/hooks/useDossiers';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTypewriter } from '@/hooks/useTypewriter';
import { whatsappLink, YOBBANTE_WHATSAPP_DISPLAY } from '@/lib/contact';
import { MessageCircle } from 'lucide-react';

interface ParsedProduct {
  title: string;
  platform: string;
  estimatedPriceEur: number;
  estimatedWeightKg: number;
  category: string;
  imageUrl: string;
  suggestedQuantity: number;
}

interface DossierPreset {
  product?: string;
  estimatedWeight?: string;
  origin?: WarehouseCountry;
  destination?: string;
  estimatedCost?: number;
}

interface DossierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset?: DossierPreset;
}

type Intent = 'buy' | 'ship' | 'both';
type Urgency = 'normal' | 'express';

const ORIGINS: WarehouseCountry[] = ['CN', 'FR', 'US', 'AE', 'DE', 'CA'];
const DESTINATIONS = [
  { code: 'SN', label: 'Dakar, Sénégal', flag: '🇸🇳' },
  { code: 'CI', label: 'Abidjan, Côte d\'Ivoire', flag: '🇨🇮' },
  { code: 'ML', label: 'Bamako, Mali', flag: '🇲🇱' },
  { code: 'TG', label: 'Lomé, Togo', flag: '🇹🇬' },
  { code: 'BJ', label: 'Cotonou, Bénin', flag: '🇧🇯' },
  { code: 'GN', label: 'Conakry, Guinée', flag: '🇬🇳' },
];

const TOTAL_STEPS = 5; // 1.intent 2.input 3.details 4.summary 5.contact (success = post)

function detectPlatform(url: string): string | null {
  const u = url.toLowerCase();
  if (u.includes('alibaba') || u.includes('1688')) return 'Alibaba';
  if (u.includes('amazon')) return 'Amazon';
  if (u.includes('aliexpress')) return 'AliExpress';
  if (u.includes('shein')) return 'Shein';
  if (u.includes('temu')) return 'Temu';
  if (u.includes('ebay')) return 'eBay';
  return null;
}

export function DossierDialog({ open, onOpenChange, preset }: DossierDialogProps) {
  const [step, setStep] = useState(1);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [productInput, setProductInput] = useState('');
  const [origin, setOrigin] = useState<WarehouseCountry>('CN');
  const [destination, setDestination] = useState('Dakar, Sénégal');
  const [budget, setBudget] = useState<number>(500);
  const [budgetSet, setBudgetSet] = useState(false);
  const [urgency, setUrgency] = useState<Urgency>('normal');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const { createDossier } = useDossiers();

  const platform = useMemo(() => detectPlatform(productInput), [productInput]);

  // Reset & preset
  useEffect(() => {
    if (open) {
      setStep(1);
      setIntent(null);
      setProductInput(preset?.product ?? '');
      setOrigin(preset?.origin ?? 'CN');
      setDestination(preset?.destination ?? 'Dakar, Sénégal');
      setBudget(500);
      setBudgetSet(false);
      setUrgency('normal');
      setContact('');
      setEmail('');
      setSuccess(false);
      setReference(null);
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email) setEmail(user.email);
      });
    }
  }, [open, preset]);

  // Auto-progress on intent select
  const selectIntent = (i: Intent) => {
    setIntent(i);
    setTimeout(() => setStep(2), 220);
  };

  const canStep2Continue = (): boolean => {
    if (intent === 'buy') return productInput.trim().length > 2;
    if (intent === 'ship') return !!origin && !!destination;
    return productInput.trim().length > 2 && !!origin && !!destination;
  };

  const estimateRange = useMemo(() => {
    const base = budgetSet ? budget : 500;
    const factor = urgency === 'express' ? 1.35 : 1.0;
    const low = Math.round(base * 0.85 * factor);
    const high = Math.round(base * 1.25 * factor);
    return { low, high };
  }, [budget, budgetSet, urgency]);

  const eta = urgency === 'express' ? '7–12 jours' : '18–28 jours';

  const handleSubmit = async () => {
    if (!contact.trim()) {
      toast.error('Ajoutez un numéro WhatsApp ou téléphone.');
      return;
    }
    setSubmitting(true);
    try {
      const intentLabel = intent === 'buy' ? 'Achat' : intent === 'ship' ? 'Expédition' : 'Achat + Expédition';
      const dossier = await createDossier.mutateAsync({
        product_description: productInput || `${intentLabel} — ${COUNTRY_NAMES[origin]} → ${destination}`,
        origin_country: origin,
        destination_country: destination,
        budget_eur: budgetSet ? budget : null,
        needs_sourcing: intent !== 'ship',
        contact_phone: contact,
        contact_email: email || null,
        notes: [
          `Intent: ${intentLabel}`,
          `Urgence: ${urgency}`,
          platform && `Plateforme détectée: ${platform}`,
          preset?.estimatedCost && `Estimation simulateur: ${preset.estimatedCost}€`,
        ].filter(Boolean).join('\n'),
        estimated_cost: preset?.estimatedCost ?? null,
      });
      setReference(dossier.reference);
      setSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Not authenticated')) {
        toast.error('Connectez-vous pour soumettre votre dossier.');
      } else {
        toast.error('Erreur lors de l\'envoi. Réessayez.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => setStep(s => Math.max(1, s - 1));
  const goNext = () => setStep(s => Math.min(TOTAL_STEPS, s + 1));

  const progress = success ? 100 : (step / TOTAL_STEPS) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden border-border/60 bg-card/95 backdrop-blur-xl">
        {/* Progress bar */}
        <div className="h-1 bg-border/40 relative overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/70"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>

        {/* Header */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step > 1 && !success && (
              <button
                onClick={goBack}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                aria-label="Retour"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                {success ? 'Dossier confirmé' : `Étape ${step} sur ${TOTAL_STEPS}`}
              </p>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Concierge Yobbanté
              </h2>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5" />
            +1 000 colis livrés
          </div>
        </div>

        <ScrollArea className="max-h-[70vh]">
          <div className="px-6 pb-6 min-h-[340px]">
            <AnimatePresence mode="wait">
              {success ? (
                <SuccessScreen key="success" reference={reference} onClose={() => onOpenChange(false)} />
              ) : step === 1 ? (
                <StepIntent key="s1" onSelect={selectIntent} selected={intent} />
              ) : step === 2 ? (
                <StepInput
                  key="s2"
                  intent={intent!}
                  productInput={productInput}
                  setProductInput={setProductInput}
                  platform={platform}
                  origin={origin}
                  setOrigin={setOrigin}
                  destination={destination}
                  setDestination={setDestination}
                  onContinue={() => { if (canStep2Continue()) goNext(); }}
                  canContinue={canStep2Continue()}
                />
              ) : step === 3 ? (
                <StepDetails
                  key="s3"
                  budget={budget}
                  setBudget={(v) => { setBudget(v); setBudgetSet(true); }}
                  budgetSet={budgetSet}
                  urgency={urgency}
                  setUrgency={setUrgency}
                  onContinue={goNext}
                />
              ) : step === 4 ? (
                <StepSummary
                  key="s4"
                  intent={intent!}
                  origin={origin}
                  destination={destination}
                  productInput={productInput}
                  estimateRange={estimateRange}
                  eta={eta}
                  urgency={urgency}
                  onConfirm={goNext}
                />
              ) : (
                <StepContact
                  key="s5"
                  contact={contact}
                  setContact={setContact}
                  email={email}
                  setEmail={setEmail}
                  onSubmit={handleSubmit}
                  submitting={submitting}
                />
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================ */
/* STEP 1 — Intent                                                */
/* ============================================================ */
function StepIntent({ onSelect, selected }: { onSelect: (i: Intent) => void; selected: Intent | null }) {
  const options: { id: Intent; icon: typeof ShoppingBag; title: string; desc: string }[] = [
    { id: 'buy', icon: ShoppingBag, title: 'Acheter un produit', desc: 'Sourcing, négociation, achat à votre place.' },
    { id: 'ship', icon: Package, title: 'Expédier un colis', desc: 'Transport optimisé depuis nos hubs.' },
    { id: 'both', icon: Layers, title: 'Les deux', desc: 'Achat + transport, tout pris en charge.' },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      <div>
        <h3 className="text-xl font-semibold text-foreground">Que souhaitez-vous faire ?</h3>
        <p className="text-sm text-muted-foreground mt-1">Choisissez, on s'occupe du reste.</p>
      </div>
      <div className="space-y-2.5">
        {options.map(({ id, icon: Icon, title, desc }, i) => (
          <motion.button
            key={id}
            onClick={() => onSelect(id)}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              'w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-4 group',
              selected === id
                ? 'border-primary bg-primary/5 shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]'
                : 'border-border hover:border-primary/40 hover:bg-secondary/40',
            )}
          >
            <div className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors',
              selected === id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground group-hover:bg-primary/10 group-hover:text-primary',
            )}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

/* ============================================================ */
/* STEP 2 — Smart Input                                           */
/* ============================================================ */
function StepInput({
  intent, productInput, setProductInput, platform,
  origin, setOrigin, destination, setDestination,
  onContinue, canContinue,
}: {
  intent: Intent;
  productInput: string;
  setProductInput: (v: string) => void;
  platform: string | null;
  origin: WarehouseCountry;
  setOrigin: (c: WarehouseCountry) => void;
  destination: string;
  setDestination: (d: string) => void;
  onContinue: () => void;
  canContinue: boolean;
}) {
  const showProduct = intent === 'buy' || intent === 'both';
  const showRoute = intent === 'ship' || intent === 'both';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      <div>
        <h3 className="text-xl font-semibold text-foreground">
          {intent === 'buy' ? 'Quel produit ?' : intent === 'ship' ? 'D\'où vers où ?' : 'Produit & route'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Collez un lien ou décrivez en quelques mots.
        </p>
      </div>

      {showProduct && (
        <div className="space-y-2">
          <div className="relative">
            <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              value={productInput}
              onChange={(e) => setProductInput(e.target.value)}
              placeholder="https://alibaba.com/… ou « 50 smartphones Samsung »"
              className="pl-10 h-12 text-sm rounded-xl"
              onKeyDown={(e) => e.key === 'Enter' && canContinue && onContinue()}
            />
          </div>
          <AnimatePresence>
            {platform && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-xs text-primary"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Plateforme détectée : <span className="font-medium">{platform}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {showRoute && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">
              Origine
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {ORIGINS.map(c => (
                <button
                  key={c}
                  onClick={() => setOrigin(c)}
                  className={cn(
                    'p-2 rounded-lg border text-xs transition-all',
                    origin === c
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border hover:border-primary/40 text-muted-foreground',
                  )}
                >
                  <div className="text-base leading-none">{COUNTRY_FLAGS[c]}</div>
                  <div className="mt-0.5 font-medium">{c}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">
              Destination
            </label>
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
              {DESTINATIONS.map(d => (
                <button
                  key={d.code}
                  onClick={() => setDestination(d.label)}
                  className={cn(
                    'w-full p-2 rounded-lg border text-xs transition-all flex items-center gap-2 text-left',
                    destination === d.label
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border hover:border-primary/40 text-muted-foreground',
                  )}
                >
                  <span className="text-base">{d.flag}</span>
                  <span className="truncate">{d.label.split(',')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <Button
        onClick={onContinue}
        disabled={!canContinue}
        className="w-full h-11 rounded-xl"
      >
        Continuer
      </Button>
    </motion.div>
  );
}

/* ============================================================ */
/* STEP 3 — Details (sliders / toggles)                           */
/* ============================================================ */
function StepDetails({
  budget, setBudget, budgetSet, urgency, setUrgency, onContinue,
}: {
  budget: number;
  setBudget: (v: number) => void;
  budgetSet: boolean;
  urgency: Urgency;
  setUrgency: (u: Urgency) => void;
  onContinue: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <div>
        <h3 className="text-xl font-semibold text-foreground">Quelques détails</h3>
        <p className="text-sm text-muted-foreground mt-1">Optionnel — vous pouvez passer.</p>
      </div>

      {/* Budget slider */}
      <div className="p-4 rounded-2xl border border-border bg-secondary/30 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Budget indicatif</span>
          <span className="text-sm font-semibold text-primary">
            {budgetSet ? `${budget.toLocaleString('fr-FR')} €` : 'Non précisé'}
          </span>
        </div>
        <Slider
          value={[budget]}
          onValueChange={(v) => setBudget(v[0])}
          min={100}
          max={10000}
          step={100}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>100 €</span>
          <span>10 000 €</span>
        </div>
      </div>

      {/* Urgency toggle */}
      <div className="space-y-2">
        <span className="text-sm font-medium text-foreground">Délai souhaité</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setUrgency('normal')}
            className={cn(
              'p-3 rounded-xl border text-left transition-all',
              urgency === 'normal'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40',
            )}
          >
            <Clock className="w-4 h-4 mb-1.5 text-foreground" />
            <p className="text-sm font-medium text-foreground">Standard</p>
            <p className="text-[11px] text-muted-foreground">18–28 jours</p>
          </button>
          <button
            onClick={() => setUrgency('express')}
            className={cn(
              'p-3 rounded-xl border text-left transition-all',
              urgency === 'express'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40',
            )}
          >
            <Zap className="w-4 h-4 mb-1.5 text-primary" />
            <p className="text-sm font-medium text-foreground">Express</p>
            <p className="text-[11px] text-muted-foreground">7–12 jours</p>
          </button>
        </div>
      </div>

      <Button onClick={onContinue} className="w-full h-11 rounded-xl">
        Voir le récapitulatif
      </Button>
    </motion.div>
  );
}

/* ============================================================ */
/* STEP 4 — Live Summary                                          */
/* ============================================================ */
function StepSummary({
  intent, origin, destination, productInput, estimateRange, eta, urgency, onConfirm,
}: {
  intent: Intent;
  origin: WarehouseCountry;
  destination: string;
  productInput: string;
  estimateRange: { low: number; high: number };
  eta: string;
  urgency: Urgency;
  onConfirm: () => void;
}) {
  const services = [
    intent !== 'ship' && 'Trouver et négocier le meilleur fournisseur',
    intent !== 'ship' && 'Gérer l\'achat et le contrôle qualité',
    'Optimiser le transport via notre réseau',
    'Dédouaner et livrer chez vous',
  ].filter(Boolean) as string[];

  const destCity = destination.split(',')[0];
  const destFlag = DESTINATIONS.find(d => d.label === destination)?.flag ?? '🌍';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      <div>
        <h3 className="text-xl font-semibold text-foreground">Votre dossier</h3>
        <p className="text-sm text-muted-foreground mt-1">Voici ce que nous allons faire pour vous.</p>
      </div>

      {/* Route */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20">
        <div className="flex items-center justify-between gap-2">
          <div className="text-center flex-1">
            <div className="text-3xl">{COUNTRY_FLAGS[origin]}</div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Origine</p>
            <p className="text-xs font-medium text-foreground">{COUNTRY_NAMES[origin]}</p>
          </div>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex-1 h-px bg-gradient-to-r from-primary/30 via-primary to-primary/30 origin-left relative"
          >
            <MapPin className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 text-primary" />
          </motion.div>
          <div className="text-center flex-1">
            <div className="text-3xl">{destFlag}</div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Destination</p>
            <p className="text-xs font-medium text-foreground">{destCity}</p>
          </div>
        </div>
        {productInput && (
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/40 line-clamp-2">
            <span className="font-medium text-foreground">Produit :</span> {productInput}
          </p>
        )}
      </div>

      {/* Services */}
      <div className="space-y-2">
        {services.map((s, i) => (
          <motion.div
            key={s}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="flex items-center gap-2.5 text-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span className="text-foreground">{s}</span>
          </motion.div>
        ))}
      </div>

      {/* Estimates */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-xl border border-border bg-secondary/30">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Délai estimé</p>
          <p className="text-sm font-semibold text-foreground mt-0.5 flex items-center gap-1">
            {urgency === 'express' && <Zap className="w-3.5 h-3.5 text-primary" />}
            {eta}
          </p>
        </div>
        <div className="p-3 rounded-xl border border-border bg-secondary/30">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Coût indicatif</p>
          <p className="text-sm font-semibold text-foreground mt-0.5">
            {estimateRange.low}–{estimateRange.high} €
          </p>
        </div>
      </div>

      <Button onClick={onConfirm} className="w-full h-11 rounded-xl">
        Confirmer mon dossier
      </Button>
      <p className="text-[11px] text-center text-muted-foreground">
        Estimation indicative — devis ferme sous 24h.
      </p>
    </motion.div>
  );
}

/* ============================================================ */
/* STEP 5 — Contact                                                */
/* ============================================================ */
function StepContact({
  contact, setContact, email, setEmail, onSubmit, submitting,
}: {
  contact: string;
  setContact: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      <div>
        <h3 className="text-xl font-semibold text-foreground">Comment vous joindre ?</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Un agent vous recontacte sous 24h avec un devis détaillé.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">
            WhatsApp ou téléphone *
          </label>
          <Input
            autoFocus
            type="tel"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="+221 77 000 00 00"
            className="h-12 rounded-xl"
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">
            Email <span className="normal-case text-muted-foreground/70">(optionnel)</span>
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
            className="h-12 rounded-xl"
          />
        </div>
      </div>

      <Button
        onClick={onSubmit}
        disabled={submitting || !contact.trim()}
        className="w-full h-11 rounded-xl"
      >
        {submitting ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Envoi…</>
        ) : (
          'Envoyer mon dossier'
        )}
      </Button>

      <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Données protégées</span>
        <span>•</span>
        <span>Réponse &lt; 24h</span>
      </div>
    </motion.div>
  );
}

/* ============================================================ */
/* SUCCESS                                                         */
/* ============================================================ */
function SuccessScreen({ reference, onClose }: { reference: string | null; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="py-6 text-center space-y-5"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center relative"
      >
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        <CheckCircle2 className="w-10 h-10 text-primary relative" />
      </motion.div>

      <div>
        <h3 className="text-xl font-semibold text-foreground">
          Votre dossier est pris en charge 🚀
        </h3>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
          Un agent dédié analyse votre demande et vous contacte sous 24h.
        </p>
      </div>

      {reference && (
        <div className="inline-flex flex-col items-center gap-1 px-5 py-3 rounded-xl bg-secondary/60 border border-border">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Référence</span>
          <span className="font-mono text-base font-semibold text-foreground">{reference}</span>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-2">
        <Button onClick={onClose} className="w-full h-11 rounded-xl">
          Suivre mon dossier
        </Button>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Fermer
        </button>
      </div>
    </motion.div>
  );
}
