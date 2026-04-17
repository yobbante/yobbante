import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Sparkles, ShieldCheck, Loader2, Copy, Check,
  Globe, Package as PackageIcon, Truck, Home as HomeIcon, ShoppingBag,
  FolderPlus, MessageCircle, Mail, Phone,
} from 'lucide-react';
import { COUNTRY_FLAGS, COUNTRY_NAMES, type WarehouseCountry } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { z } from 'zod';

interface GeneratedAddress {
  country: WarehouseCountry;
  address_line: string;
  identifier_code: string;
}

interface GetAddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfideDossier?: () => void;
}

const TOTAL = 5; // 1.value 2.contact 3.reveal 4.education 5.action

const contactSchema = z.union([
  z.string().trim().email({ message: 'Email invalide' }),
  z.string().trim().regex(/^\+?[0-9 .()-]{7,20}$/, { message: 'Téléphone invalide' }),
]);

export function GetAddressDialog({ open, onOpenChange, onConfideDossier }: GetAddressDialogProps) {
  const [step, setStep] = useState(1);
  const [contact, setContact] = useState('');
  const [contactError, setContactError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [addresses, setAddresses] = useState<GeneratedAddress[]>([]);
  const [authedUser, setAuthedUser] = useState<{ id: string; email?: string } | null>(null);

  useEffect(() => {
    if (open) {
      setStep(1);
      setContact('');
      setContactError(null);
      setAddresses([]);
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          setAuthedUser({ id: user.id, email: user.email ?? undefined });
          if (user.email) setContact(user.email);
        } else {
          setAuthedUser(null);
        }
      });
    }
  }, [open]);

  const progress = (step / TOTAL) * 100;

  const goNext = () => setStep(s => Math.min(TOTAL, s + 1));
  const goBack = () => setStep(s => Math.max(1, s - 1));

  const handleStartGeneration = async () => {
    // Validate contact
    const parsed = contactSchema.safeParse(contact);
    if (!parsed.success) {
      setContactError(parsed.error.issues[0]?.message ?? 'Entrée invalide');
      return;
    }
    setContactError(null);
    setStep(3);
    setLoading(true);

    try {
      if (authedUser) {
        // Fetch existing addresses for connected user
        const { data, error } = await supabase
          .from('addresses')
          .select('country, address_line, identifier_code')
          .eq('user_id', authedUser.id);
        if (error) throw error;
        // Slight artificial delay for the magic moment
        await new Promise(r => setTimeout(r, 1200));
        setAddresses((data ?? []).filter(a => ['FR', 'CN', 'US'].includes(a.country)) as GeneratedAddress[]);
      } else {
        // Generate preview addresses (not persisted — user creates account later to claim)
        await new Promise(r => setTimeout(r, 1400));
        const preview: GeneratedAddress[] = [
          { country: 'FR', address_line: '12 Rue de la Logistique, 93200 Saint-Denis, France', identifier_code: previewCode('FR') },
          { country: 'CN', address_line: 'Room 501, Building 3, Nanshan District, Shenzhen 518000, China', identifier_code: previewCode('CN') },
          { country: 'US', address_line: '1200 NW 78th Ave, Suite 200, Miami, FL 33126, USA', identifier_code: previewCode('US') },
        ];
        setAddresses(preview);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la génération. Réessayez.');
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden border-border/60 bg-card/95 backdrop-blur-xl">
        {/* Progress */}
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
            {step > 1 && step !== 3 && (
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
                Étape {step} sur {TOTAL}
              </p>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-primary" />
                Vos adresses internationales
              </h2>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5" />
            Génération sécurisée
          </div>
        </div>

        <ScrollArea className="max-h-[72vh]">
          <div className="px-6 pb-6 min-h-[360px]">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <StepValue key="s1" onContinue={goNext} />
              )}
              {step === 2 && (
                <StepContact
                  key="s2"
                  contact={contact}
                  setContact={(v) => { setContact(v); setContactError(null); }}
                  error={contactError}
                  isAuthed={!!authedUser}
                  onContinue={handleStartGeneration}
                />
              )}
              {step === 3 && (
                <StepReveal
                  key="s3"
                  loading={loading}
                  addresses={addresses}
                  onContinue={goNext}
                  isAuthed={!!authedUser}
                />
              )}
              {step === 4 && (
                <StepEducation key="s4" onContinue={goNext} />
              )}
              {step === 5 && (
                <StepAction
                  key="s5"
                  isAuthed={!!authedUser}
                  onConfideDossier={() => {
                    onOpenChange(false);
                    setTimeout(() => onConfideDossier?.(), 200);
                  }}
                  onClose={() => onOpenChange(false)}
                />
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function previewCode(country: WarehouseCountry) {
  const rnd = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${country}-${rnd.slice(0, 8)}`;
}

/* ============================================================ */
/* STEP 1 — Value Projection                                      */
/* ============================================================ */
function StepValue({ onContinue }: { onContinue: () => void }) {
  const cards = [
    { country: 'FR' as WarehouseCountry, hub: 'Hub Europe' },
    { country: 'CN' as WarehouseCountry, hub: 'Direct usines' },
    { country: 'US' as WarehouseCountry, hub: 'E-commerce US' },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <div>
        <h3 className="text-2xl font-semibold text-foreground tracking-tight">
          Recevez vos adresses internationales en quelques secondes
        </h3>
        <p className="text-sm text-muted-foreground mt-2">
          France 🇫🇷 · Chine 🇨🇳 · USA 🇺🇸 — Achetez et recevez vos colis comme un local.
        </p>
      </div>

      {/* Floating country cards */}
      <div className="relative h-44 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center gap-3 sm:gap-5">
          {cards.map((c, i) => (
            <motion.div
              key={c.country}
              initial={{ opacity: 0, y: 20, rotate: -6 + i * 6 }}
              animate={{ opacity: 1, y: 0, rotate: -6 + i * 6 }}
              transition={{ delay: 0.1 + i * 0.12, type: 'spring', stiffness: 120 }}
              className="bg-card border border-border rounded-2xl p-3 sm:p-4 shadow-xl w-24 sm:w-28"
            >
              <div className="text-3xl sm:text-4xl text-center">{COUNTRY_FLAGS[c.country]}</div>
              <p className="text-[10px] sm:text-xs font-medium text-foreground text-center mt-1.5">
                {COUNTRY_NAMES[c.country]}
              </p>
              <p className="text-[9px] text-muted-foreground text-center">{c.hub}</p>
            </motion.div>
          ))}
        </div>
        {/* Subtle pulse */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Réseau actif
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { v: '< 30s', l: 'Création' },
          { v: '6', l: 'Pays' },
          { v: '0€', l: 'Frais' },
        ].map(s => (
          <div key={s.l} className="p-2 rounded-xl bg-secondary/40 border border-border">
            <p className="text-sm font-semibold text-foreground">{s.v}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.l}</p>
          </div>
        ))}
      </div>

      <Button onClick={onContinue} className="w-full h-11 rounded-xl">
        Commencer <ArrowRight className="w-4 h-4 ml-1.5" />
      </Button>
    </motion.div>
  );
}

/* ============================================================ */
/* STEP 2 — Light Contact Capture                                  */
/* ============================================================ */
function StepContact({
  contact, setContact, error, isAuthed, onContinue,
}: {
  contact: string;
  setContact: (v: string) => void;
  error: string | null;
  isAuthed: boolean;
  onContinue: () => void;
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
        <h3 className="text-xl font-semibold text-foreground">
          {isAuthed ? 'On confirme votre identité' : 'Comment vous joindre ?'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1.5">
          {isAuthed
            ? 'Vos adresses sont déjà liées à votre compte.'
            : 'Email ou téléphone — on vous envoie vos adresses tout de suite.'}
        </p>
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">
          Email ou téléphone
        </label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            autoFocus
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="vous@exemple.com ou +221 77 000 00 00"
            className={cn('pl-10 h-12 rounded-xl', error && 'border-destructive focus-visible:ring-destructive')}
            onKeyDown={(e) => { if (e.key === 'Enter') onContinue(); }}
            maxLength={255}
            inputMode="email"
          />
        </div>
        {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
      </div>

      <Button onClick={onContinue} disabled={!contact.trim()} className="w-full h-11 rounded-xl">
        Générer mes adresses <Sparkles className="w-4 h-4 ml-1.5" />
      </Button>

      <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Données protégées</span>
        <span>•</span>
        <span>Aucun spam</span>
      </div>
    </motion.div>
  );
}

/* ============================================================ */
/* STEP 3 — Magic Reveal                                           */
/* ============================================================ */
function StepReveal({
  loading, addresses, onContinue, isAuthed,
}: {
  loading: boolean;
  addresses: GeneratedAddress[];
  onContinue: () => void;
  isAuthed: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [allCopied, setAllCopied] = useState(false);

  const copyOne = async (addr: GeneratedAddress) => {
    const text = `${COUNTRY_NAMES[addr.country]} (${addr.identifier_code})\n${addr.address_line}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(addr.identifier_code);
      toast.success('Adresse copiée');
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error('Impossible de copier');
    }
  };

  const copyAll = async () => {
    const text = addresses.map(a => `${COUNTRY_NAMES[a.country]} — ${a.identifier_code}\n${a.address_line}`).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setAllCopied(true);
      toast.success('Toutes les adresses copiées');
      setTimeout(() => setAllCopied(false), 1800);
    } catch {
      toast.error('Impossible de copier');
    }
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      `Mes adresses Yobbanté:\n\n${addresses.map(a => `${COUNTRY_FLAGS[a.country]} ${COUNTRY_NAMES[a.country]} — ${a.identifier_code}\n${a.address_line}`).join('\n\n')}`,
    );
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <motion.div
        key="loading"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="py-16 flex flex-col items-center justify-center text-center"
      >
        <div className="relative w-16 h-16 mb-5">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
          <Loader2 className="absolute inset-0 w-16 h-16 text-primary animate-spin" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Création de vos adresses…</h3>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">
          Connexion sécurisée à nos hubs internationaux.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-foreground">Vos adresses sont prêtes ✨</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isAuthed ? 'Liées à votre compte.' : 'Créez votre compte pour les sauvegarder.'}
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {addresses.map((addr, i) => (
          <motion.div
            key={addr.identifier_code}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.18, type: 'spring', stiffness: 110, damping: 16 }}
            className="p-4 rounded-2xl border border-border bg-secondary/30 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-2xl">{COUNTRY_FLAGS[addr.country]}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{COUNTRY_NAMES[addr.country]}</p>
                  <div className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                    <span className="text-[11px] font-mono font-semibold text-primary">{addr.identifier_code}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => copyOne(addr)}
                className="shrink-0 p-2 rounded-lg hover:bg-secondary transition-colors"
                aria-label="Copier"
              >
                {copied === addr.identifier_code ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{addr.address_line}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: addresses.length * 0.18 + 0.1 }}
        className="p-3 rounded-xl bg-primary/5 border border-primary/15 flex gap-2.5"
      >
        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-foreground/90 leading-relaxed">
          <span className="font-semibold">Astuce :</span> ajoutez votre <span className="font-mono font-medium">code identifiant</span> au nom du destinataire lors de votre commande pour qu'on associe le colis automatiquement.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={copyAll} className="h-10 rounded-xl">
          {allCopied ? <Check className="w-4 h-4 mr-1.5 text-green-500" /> : <Copy className="w-4 h-4 mr-1.5" />}
          Tout copier
        </Button>
        <Button variant="outline" onClick={shareWhatsApp} className="h-10 rounded-xl">
          <MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp
        </Button>
      </div>

      <Button onClick={onContinue} className="w-full h-11 rounded-xl">
        Comment ça marche <ArrowRight className="w-4 h-4 ml-1.5" />
      </Button>
    </motion.div>
  );
}

/* ============================================================ */
/* STEP 4 — Education                                              */
/* ============================================================ */
function StepEducation({ onContinue }: { onContinue: () => void }) {
  const steps = [
    { icon: ShoppingBag, title: 'Vous commandez', desc: 'Sur Amazon, Alibaba, 1688 ou tout site marchand.' },
    { icon: PackageIcon, title: 'On réceptionne', desc: 'Le colis arrive à notre hub, vérifié et stocké.' },
    { icon: Truck, title: 'On optimise', desc: 'Groupage, route et transport au meilleur prix.' },
    { icon: HomeIcon, title: 'Livré chez vous', desc: 'À domicile, en relais ou en entreprise.' },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      <div>
        <h3 className="text-xl font-semibold text-foreground">Comment ça marche</h3>
        <p className="text-sm text-muted-foreground mt-1">4 étapes, zéro tracas.</p>
      </div>

      <div className="space-y-2.5">
        {steps.map(({ icon: Icon, title, desc }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex gap-3 items-start p-3 rounded-xl border border-border bg-secondary/20"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 relative">
              <Icon className="w-4 h-4" />
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <Button onClick={onContinue} className="w-full h-11 rounded-xl">
        Continuer <ArrowRight className="w-4 h-4 ml-1.5" />
      </Button>
    </motion.div>
  );
}

/* ============================================================ */
/* STEP 5 — First Action                                           */
/* ============================================================ */
function StepAction({
  isAuthed, onConfideDossier, onClose,
}: {
  isAuthed: boolean;
  onConfideDossier: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-5 py-2"
    >
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4 relative"
        >
          <div className="absolute inset-0 rounded-full bg-primary/15 animate-ping" />
          <Globe className="w-8 h-8 text-primary relative" />
        </motion.div>
        <h3 className="text-xl font-semibold text-foreground">Vous êtes prêt à importer 🚀</h3>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
          Lancez votre première opération maintenant.
        </p>
      </div>

      <div className="space-y-2">
        <button
          onClick={onConfideDossier}
          className="w-full p-4 rounded-2xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors flex items-center gap-3 text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <FolderPlus className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Confier un achat</p>
            <p className="text-xs text-muted-foreground">On trouve, on achète, on livre.</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </button>

        <a
          href={isAuthed ? '/app' : '/auth'}
          className="block p-4 rounded-2xl border border-border bg-secondary/30 hover:border-primary/40 transition-colors flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-secondary text-foreground flex items-center justify-center shrink-0">
            <PackageIcon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {isAuthed ? 'Voir mon espace' : 'Créer mon compte'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isAuthed ? 'Suivez vos colis et adresses.' : 'Sauvegardez vos adresses.'}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </a>
      </div>

      <button
        onClick={onClose}
        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        Plus tard
      </button>
    </motion.div>
  );
}
