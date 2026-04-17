import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Package, FileText, Boxes, Sparkles,
  MapPin, Clock, Zap, Crown, Loader2, Phone, MessageCircle, User,
} from 'lucide-react';
import { useDossiers } from '@/hooks/useDossiers';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LocalDeliveryWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ShipmentType = 'package' | 'documents' | 'bulk' | 'custom';
type Urgency = 'standard' | 'express' | 'priority';

const TOTAL_STEPS = 6;

const DAKAR_LOCATIONS = [
  'Plateau', 'Almadies', 'Mermoz', 'Yoff', 'Ouakam', 'Sacré-Cœur',
  'Liberté 6', 'Point E', 'Médina', 'Fann', 'Ngor', 'Hann',
  'Parcelles Assainies', 'Grand-Yoff', 'HLM', 'Sicap',
  'Pikine', 'Guédiawaye', 'Rufisque', 'Bargny', 'Diamniadio',
];

const SHIPMENT_TYPES: { id: ShipmentType; label: string; desc: string; Icon: typeof Package }[] = [
  { id: 'package', label: 'Colis', desc: 'Petit ou moyen colis', Icon: Package },
  { id: 'documents', label: 'Documents', desc: 'Plis, papiers, contrats', Icon: FileText },
  { id: 'bulk', label: 'Vrac / Volume', desc: 'Plusieurs cartons', Icon: Boxes },
  { id: 'custom', label: 'Sur mesure', desc: 'Autre besoin', Icon: Sparkles },
];

const URGENCIES: { id: Urgency; label: string; desc: string; Icon: typeof Clock; price: string }[] = [
  { id: 'standard', label: 'Standard', desc: 'Livraison sous 24–48h', Icon: Clock, price: 'À partir de 2 500 F' },
  { id: 'express', label: 'Express', desc: 'Livraison sous 4h', Icon: Zap, price: 'À partir de 5 000 F' },
  { id: 'priority', label: 'Priorité', desc: 'Coursier dédié sous 1h', Icon: Crown, price: 'À partir de 8 000 F' },
];

export function LocalDeliveryWizard({ open, onOpenChange }: LocalDeliveryWizardProps) {
  const { createDossier } = useDossiers();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Step 1
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [sameWhatsapp, setSameWhatsapp] = useState(true);

  // Step 2
  const [type, setType] = useState<ShipmentType | null>(null);
  const [customDesc, setCustomDesc] = useState('');

  // Step 3
  const [pickup, setPickup] = useState('');
  const [pickupDetail, setPickupDetail] = useState('');

  // Step 4
  const [delivery, setDelivery] = useState('');
  const [deliveryDetail, setDeliveryDetail] = useState('');

  // Step 5
  const [urgency, setUrgency] = useState<Urgency>('standard');

  const pickupSuggestions = useMemo(() => {
    if (!pickup.trim()) return [] as string[];
    const q = pickup.toLowerCase();
    return DAKAR_LOCATIONS.filter(l => l.toLowerCase().includes(q) && l.toLowerCase() !== q).slice(0, 5);
  }, [pickup]);

  const deliverySuggestions = useMemo(() => {
    if (!delivery.trim()) return [] as string[];
    const q = delivery.toLowerCase();
    return DAKAR_LOCATIONS.filter(l => l.toLowerCase().includes(q) && l.toLowerCase() !== q).slice(0, 5);
  }, [delivery]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep(1); setSuccess(false); setSubmitting(false);
        setName(''); setPhone(''); setWhatsapp(''); setSameWhatsapp(true);
        setType(null); setCustomDesc('');
        setPickup(''); setPickupDetail(''); setDelivery(''); setDeliveryDetail('');
        setUrgency('standard');
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  const canNext = useMemo(() => {
    switch (step) {
      case 1: return name.trim().length >= 2 && phone.trim().length >= 6;
      case 2: return type !== null && (type !== 'custom' || customDesc.trim().length >= 3);
      case 3: return pickup.trim().length >= 2;
      case 4: return delivery.trim().length >= 2;
      case 5: return !!urgency;
      default: return true;
    }
  }, [step, name, phone, type, customDesc, pickup, delivery, urgency]);

  const next = () => setStep(s => Math.min(TOTAL_STEPS, s + 1));
  const prev = () => setStep(s => Math.max(1, s - 1));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Stash payload, redirect to auth
        sessionStorage.setItem('pending_local_delivery', JSON.stringify({
          name, phone, whatsapp: sameWhatsapp ? phone : whatsapp,
          type, customDesc, pickup, pickupDetail, delivery, deliveryDetail, urgency,
        }));
        toast.info('Connecte-toi pour finaliser ta demande');
        onOpenChange(false);
        navigate('/auth');
        return;
      }

      const wa = sameWhatsapp ? phone : whatsapp;
      const typeLabel = type === 'custom' ? `Sur mesure: ${customDesc}` : SHIPMENT_TYPES.find(t => t.id === type)?.label;
      const urgLabel = URGENCIES.find(u => u.id === urgency)?.label;

      const productDescription = `Livraison locale Dakar — ${typeLabel}`;
      const notes = [
        `Type: ${typeLabel}`,
        `Pickup: ${pickup}${pickupDetail ? ` — ${pickupDetail}` : ''}`,
        `Delivery: ${delivery}${deliveryDetail ? ` — ${deliveryDetail}` : ''}`,
        `Urgence: ${urgLabel}`,
        `Contact: ${name} · Tel ${phone}${wa && wa !== phone ? ` · WhatsApp ${wa}` : ''}`,
      ].join('\n');

      await createDossier.mutateAsync({
        product_description: productDescription,
        origin_country: 'FR', // placeholder enum (dossiers.origin_country requires warehouse_country)
        destination_country: 'SN',
        contact_phone: phone,
        contact_email: null,
        notes,
        needs_sourcing: false,
      });

      setSuccess(true);
      toast.success('Demande envoyée — un agent vous rappelle.');
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'envoi. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg p-0 gap-0 overflow-hidden border-border bg-background data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 data-[state=open]:duration-300"
      >
        {/* Progress bar */}
        <div className="h-1 bg-secondary relative overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0"
            style={{ backgroundColor: '#FFC300' }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        </div>

        <div className="px-6 pt-5 pb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium tracking-widest uppercase text-muted-foreground">
            Étape {success ? TOTAL_STEPS : step} / {TOTAL_STEPS}
          </span>
          <span className="text-[11px] font-semibold" style={{ color: '#B8860B' }}>
            Confier mon dossier
          </span>
        </div>

        <div className="px-6 pb-6 pt-3 min-h-[420px] flex flex-col">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex flex-col items-center justify-center text-center py-8"
              >
                <div className="w-16 h-16 rounded-full bg-[hsl(var(--cta)/0.15)] flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-9 h-9" style={{ color: 'hsl(var(--cta))' }} />
                </div>
                <h3 className="text-2xl font-bold tracking-tight">Demande envoyée 🎉</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                  Un agent Yobbanté vous rappelle au <span className="font-semibold text-foreground">{phone}</span> sous 15 min.
                </p>
                <button
                  onClick={() => onOpenChange(false)}
                  className="btn-cta mt-7"
                >
                  Parfait, fermer
                </button>
              </motion.div>
            ) : (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="flex-1"
              >
                {step === 1 && (
                  <Step
                    title="Vos coordonnées"
                    sub="On vous rappelle dans les 15 min."
                  >
                    <Field icon={User} label="Nom complet">
                      <Input value={name} onChange={e => setName(e.target.value)} placeholder="Aïssa Diop" className="input-glow" autoFocus />
                    </Field>
                    <Field icon={Phone} label="Téléphone">
                      <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+221 77 123 45 67" type="tel" className="input-glow" />
                    </Field>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={sameWhatsapp}
                        onChange={e => setSameWhatsapp(e.target.checked)}
                        className="w-4 h-4 accent-[hsl(var(--cta))]"
                      />
                      Mon WhatsApp est le même que mon téléphone
                    </label>
                    {!sameWhatsapp && (
                      <Field icon={MessageCircle} label="WhatsApp">
                        <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+221 77 123 45 67" type="tel" className="input-glow" />
                      </Field>
                    )}
                  </Step>
                )}

                {step === 2 && (
                  <Step title="Type d'envoi" sub="Choisissez la nature de votre envoi.">
                    <div className="grid grid-cols-2 gap-2.5">
                      {SHIPMENT_TYPES.map(({ id, label, desc, Icon }) => (
                        <button
                          key={id}
                          onClick={() => setType(id)}
                          className={cn(
                            'p-3.5 rounded-xl border-2 text-left transition-all duration-150',
                            'hover:-translate-y-0.5',
                            type === id
                              ? 'border-[hsl(var(--cta))] bg-[hsl(var(--cta)/0.06)]'
                              : 'border-border bg-card hover:border-muted-foreground/30'
                          )}
                        >
                          <Icon className="w-5 h-5 mb-2" style={{ color: type === id ? 'hsl(var(--cta))' : 'currentColor' }} />
                          <p className="text-sm font-semibold">{label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{desc}</p>
                        </button>
                      ))}
                    </div>
                    {type === 'custom' && (
                      <Field label="Décrivez votre besoin">
                        <Input value={customDesc} onChange={e => setCustomDesc(e.target.value)} placeholder="Ex : 3 cartons fragiles" className="input-glow" />
                      </Field>
                    )}
                  </Step>
                )}

                {step === 3 && (
                  <Step title="Lieu de récupération" sub="Où récupérer le colis à Dakar ?">
                    <Field icon={MapPin} label="Quartier / zone">
                      <Input
                        value={pickup}
                        onChange={e => setPickup(e.target.value)}
                        placeholder="Ex : Plateau, Almadies…"
                        className="input-glow"
                        autoFocus
                      />
                    </Field>
                    {pickupSuggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {pickupSuggestions.map(s => (
                          <button
                            key={s}
                            onClick={() => setPickup(s)}
                            className="text-xs px-2.5 py-1 rounded-full bg-secondary hover:bg-[hsl(var(--cta)/0.12)] hover:text-foreground transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                    <Field label="Adresse précise (optionnel)">
                      <Input value={pickupDetail} onChange={e => setPickupDetail(e.target.value)} placeholder="Rue, immeuble, contact sur place…" className="input-glow" />
                    </Field>
                  </Step>
                )}

                {step === 4 && (
                  <Step title="Lieu de livraison" sub="Où livrer ?">
                    <Field icon={MapPin} label="Quartier / zone">
                      <Input
                        value={delivery}
                        onChange={e => setDelivery(e.target.value)}
                        placeholder="Ex : Mermoz, Yoff…"
                        className="input-glow"
                        autoFocus
                      />
                    </Field>
                    {deliverySuggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {deliverySuggestions.map(s => (
                          <button
                            key={s}
                            onClick={() => setDelivery(s)}
                            className="text-xs px-2.5 py-1 rounded-full bg-secondary hover:bg-[hsl(var(--cta)/0.12)] hover:text-foreground transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                    <Field label="Adresse précise (optionnel)">
                      <Input value={deliveryDetail} onChange={e => setDeliveryDetail(e.target.value)} placeholder="Rue, immeuble, contact sur place…" className="input-glow" />
                    </Field>
                  </Step>
                )}

                {step === 5 && (
                  <Step title="Urgence" sub="Quand voulez-vous être livré ?">
                    <div className="space-y-2">
                      {URGENCIES.map(({ id, label, desc, Icon, price }) => (
                        <button
                          key={id}
                          onClick={() => setUrgency(id)}
                          className={cn(
                            'w-full p-3.5 rounded-xl border-2 text-left transition-all duration-150 flex items-center gap-3',
                            urgency === id
                              ? 'border-[hsl(var(--cta))] bg-[hsl(var(--cta)/0.06)]'
                              : 'border-border bg-card hover:border-muted-foreground/30'
                          )}
                        >
                          <Icon className="w-5 h-5 shrink-0" style={{ color: urgency === id ? 'hsl(var(--cta))' : 'currentColor' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{label}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                          </div>
                          <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">{price}</span>
                        </button>
                      ))}
                    </div>
                  </Step>
                )}

                {step === 6 && (
                  <Step title="Récapitulatif" sub="Vérifiez avant de valider.">
                    <div className="rounded-xl border border-border bg-card divide-y divide-border">
                      <Row label="Contact" value={`${name} · ${phone}`} />
                      <Row label="Type" value={type === 'custom' ? `Sur mesure — ${customDesc}` : SHIPMENT_TYPES.find(t => t.id === type)?.label || '—'} />
                      <Row label="Pickup" value={`${pickup}${pickupDetail ? ` · ${pickupDetail}` : ''}`} />
                      <Row label="Livraison" value={`${delivery}${deliveryDetail ? ` · ${deliveryDetail}` : ''}`} />
                      <Row label="Urgence" value={URGENCIES.find(u => u.id === urgency)?.label || '—'} />
                    </div>
                    <p className="text-[11px] text-muted-foreground text-center mt-3">
                      Tarif final confirmé par téléphone après vérification du volume.
                    </p>
                  </Step>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer nav */}
          {!success && (
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                onClick={prev}
                disabled={step === 1}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Retour
              </button>
              {step < TOTAL_STEPS ? (
                <button
                  onClick={next}
                  disabled={!canNext}
                  className="btn-cta-yellow"
                >
                  Continuer <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="btn-cta-yellow"
                >
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</> : <>Valider mon envoi <CheckCircle2 className="w-4 h-4" /></>}
                </button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Step({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {sub && <p className="text-sm text-muted-foreground mt-1">{sub}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ icon: Icon, label, children }: { icon?: typeof Package; label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="w-3.5 h-3.5" />} {label}
      </span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3.5 py-2.5 flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right text-foreground break-words">{value}</span>
    </div>
  );
}
