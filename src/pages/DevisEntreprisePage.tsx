import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Building2, Package2, Truck, FileCheck2, Headset, ShieldCheck,
  ArrowRight, ArrowLeft, Check, Loader2, Sparkles, Calendar,
  Boxes, Globe2, Phone, Mail,
} from 'lucide-react';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { whatsappLink } from '@/lib/contact';
import heroBg from '@/assets/hero-bg-devis.jpg';

type Frequency = 'one_off' | 'monthly' | 'weekly' | 'continuous';
type Volume = '<500kg' | '500-2t' | '2t-conteneur' | '>conteneur';
type Origin = 'CN' | 'AE' | 'FR' | 'DE' | 'US' | 'CA' | 'multi';
type Service = 'sourcing' | 'transport' | 'customs' | 'storage' | 'lastmile';

const ORIGINS: { value: Origin; flag: string; label: string }[] = [
  { value: 'CN', flag: '🇨🇳', label: 'Chine' },
  { value: 'AE', flag: '🇦🇪', label: 'Dubai' },
  { value: 'FR', flag: '🇫🇷', label: 'France' },
  { value: 'DE', flag: '🇩🇪', label: 'Allemagne' },
  { value: 'US', flag: '🇺🇸', label: 'USA' },
  { value: 'CA', flag: '🇨🇦', label: 'Canada' },
  { value: 'multi', flag: '🌍', label: 'Multi-origines' },
];

const VOLUMES: { value: Volume; label: string; desc: string }[] = [
  { value: '<500kg', label: 'Moins de 500 kg', desc: 'Express ou groupage' },
  { value: '500-2t', label: '500 kg – 2 tonnes', desc: 'LCL / palettes' },
  { value: '2t-conteneur', label: '2 t – 1 conteneur', desc: 'LCL gros volume / FCL 20\'' },
  { value: '>conteneur', label: 'Plusieurs conteneurs', desc: 'FCL multi / contrat-cadre' },
];

const FREQUENCIES: { value: Frequency; label: string; desc: string }[] = [
  { value: 'one_off', label: 'Ponctuel', desc: 'Un import unique' },
  { value: 'monthly', label: 'Mensuel', desc: '1 expédition / mois' },
  { value: 'weekly', label: 'Hebdomadaire', desc: 'Flux régulier' },
  { value: 'continuous', label: 'Continu', desc: 'Pipeline permanent' },
];

const SERVICES: { value: Service; icon: typeof Package2; label: string; desc: string }[] = [
  { value: 'sourcing', icon: Sparkles, label: 'Sourcing usine', desc: 'Trouver fournisseurs + audit qualité' },
  { value: 'transport', icon: Truck, label: 'Transport international', desc: 'Aérien, maritime, conteneurs' },
  { value: 'customs', icon: FileCheck2, label: 'Dédouanement', desc: 'Sénégal, Côte d\'Ivoire, Mali…' },
  { value: 'storage', icon: Boxes, label: 'Stockage tampon', desc: 'Entrepôts hub avant livraison' },
  { value: 'lastmile', icon: Package2, label: 'Livraison finale', desc: 'Porte-à-porte destinataire' },
];

const STEPS = [
  { num: 1, label: 'Profil entreprise' },
  { num: 2, label: 'Vos flux' },
  { num: 3, label: 'Services' },
  { num: 4, label: 'Contact' },
] as const;

const TRUST = [
  { icon: Headset, label: 'Account manager dédié', desc: 'Un interlocuteur unique pour tous vos flux.' },
  { icon: Calendar, label: 'Devis sous 24h ouvrées', desc: 'Réponse personnalisée par un commercial.' },
  { icon: ShieldCheck, label: 'Tarifs négociés volume', desc: '−15 à −25% vs marché spot dès le 2e envoi.' },
  { icon: Globe2, label: '6 hubs internationaux', desc: 'Routes optimisées CN, AE, EU, US, CA → AO.' },
];

const formSchema = z.object({
  fullName: z.string().trim().min(2, 'Nom requis').max(100),
  company: z.string().trim().min(2, 'Entreprise requise').max(120),
  role: z.string().trim().max(80).optional(),
  email: z.string().trim().email('Email invalide').max(255),
  phone: z.string().trim().min(6, 'Téléphone requis').max(30),
  notes: z.string().trim().max(1500).optional(),
});

export default function DevisEntreprisePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [company, setCompany] = useState('');
  const [sector, setSector] = useState('');
  // Step 2
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [volume, setVolume] = useState<Volume | ''>('');
  const [frequency, setFrequency] = useState<Frequency | ''>('');
  // Step 3
  const [services, setServices] = useState<Service[]>([]);
  // Step 4
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const toggleOrigin = (o: Origin) =>
    setOrigins(p => p.includes(o) ? p.filter(x => x !== o) : [...p, o]);
  const toggleService = (s: Service) =>
    setServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const canNext1 = company.trim().length >= 2 && sector.trim().length >= 2;
  const canNext2 = origins.length > 0 && !!volume && !!frequency;
  const canNext3 = services.length > 0;

  const handleSubmit = async () => {
    const result = formSchema.safeParse({ fullName, company, role, email, phone, notes });
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const summary =
      `Entreprise: ${company} (${sector})\n` +
      `Contact: ${fullName}${role ? ` — ${role}` : ''}\n` +
      `Email: ${email} | Tél: ${phone}\n\n` +
      `Origines: ${origins.map(o => ORIGINS.find(x => x.value === o)?.label).join(', ')}\n` +
      `Volume: ${VOLUMES.find(v => v.value === volume)?.label}\n` +
      `Fréquence: ${FREQUENCIES.find(f => f.value === frequency)?.label}\n` +
      `Services demandés: ${services.map(s => SERVICES.find(x => x.value === s)?.label).join(', ')}\n\n` +
      `Notes:\n${notes || '(aucune)'}`;
    const subject = `Devis entreprise — ${company}`;
    window.location.href = `mailto:contact@yobbante.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summary)}`;
    setTimeout(() => {
      setSubmitting(false);
      setStep(5);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav />

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0 bg-center bg-cover opacity-20 dark:opacity-25 pointer-events-none"
            style={{ backgroundImage: `url(${heroBg})` }}
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/75 to-background pointer-events-none" aria-hidden />
          <div className="relative max-w-6xl mx-auto px-5 sm:px-6 pt-10 md:pt-16 pb-10 md:pb-16">
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 lg:gap-12 items-start">
            {/* LEFT — narrative */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="lg:sticky lg:top-24"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-xs font-medium text-primary mb-5">
                <Building2 className="w-3.5 h-3.5" /> Devis entreprise
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-[1.05] text-balance">
                Vos flux d'import.<br />Notre opération.
              </h1>
              <p className="mt-4 md:mt-5 text-base text-muted-foreground max-w-md text-pretty">
                Décrivez vos volumes en 4 étapes. Un account manager Yobbanté vous rappelle sous 24h
                avec une grille tarifaire personnalisée.
              </p>

              <div className="mt-8 space-y-3">
                {TRUST.map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => navigate(-1)}
                className="mt-6 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Retour
              </button>
            </motion.div>

            {/* RIGHT — multi-step flow */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden"
            >
              {/* Stepper */}
              {step <= 4 && (
                <div className="px-5 sm:px-7 pt-6 pb-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    {STEPS.map((s, i) => (
                      <div key={s.num} className="flex items-center gap-2 flex-1 last:flex-none">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                          step === s.num ? 'bg-primary text-primary-foreground'
                          : step > s.num ? 'bg-primary/15 text-primary'
                          : 'bg-secondary text-muted-foreground'
                        }`}>
                          {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
                        </div>
                        {i < STEPS.length - 1 && (
                          <div className={`flex-1 h-px ${step > s.num ? 'bg-primary/30' : 'bg-border'}`} />
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Étape {step} / 4 — <span className="text-foreground font-medium">{STEPS[step - 1].label}</span>
                  </p>
                </div>
              )}

              <div className="p-5 sm:p-7 min-h-[420px]">
                <AnimatePresence mode="wait">
                  {/* STEP 1 — Company profile */}
                  {step === 1 && (
                    <motion.div
                      key="s1"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-5"
                    >
                      <div>
                        <h2 className="text-xl font-semibold tracking-tight">Parlez-nous de votre entreprise</h2>
                        <p className="text-sm text-muted-foreground mt-1">Quelques infos pour personnaliser votre devis.</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-1.5 block">Nom de l'entreprise *</Label>
                        <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="NIMSA Group" autoFocus />
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-1.5 block">Secteur d'activité *</Label>
                        <Input value={sector} onChange={e => setSector(e.target.value)} placeholder="Distribution électronique, BTP, retail…" />
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 2 — Flows */}
                  {step === 2 && (
                    <motion.div
                      key="s2"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-6"
                    >
                      <div>
                        <h2 className="text-xl font-semibold tracking-tight">Vos flux d'import</h2>
                        <p className="text-sm text-muted-foreground mt-1">Origines, volume, fréquence — sélection rapide.</p>
                      </div>

                      <div>
                        <Label className="text-sm font-medium mb-2.5 block">Pays d'origine * (multi)</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {ORIGINS.map(o => {
                            const active = origins.includes(o.value);
                            return (
                              <button
                                key={o.value}
                                type="button"
                                onClick={() => toggleOrigin(o.value)}
                                className={`p-3 rounded-xl border text-left transition-all ${
                                  active ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                         : 'border-border bg-background hover:border-foreground/30'
                                }`}
                              >
                                <span className="text-lg">{o.flag}</span>
                                <p className="text-sm font-medium mt-1">{o.label}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium mb-2.5 block">Volume mensuel estimé *</Label>
                        <div className="grid sm:grid-cols-2 gap-2">
                          {VOLUMES.map(v => {
                            const active = volume === v.value;
                            return (
                              <button
                                key={v.value}
                                type="button"
                                onClick={() => setVolume(v.value)}
                                className={`p-3 rounded-xl border text-left transition-all ${
                                  active ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                         : 'border-border bg-background hover:border-foreground/30'
                                }`}
                              >
                                <p className="text-sm font-semibold">{v.label}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{v.desc}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium mb-2.5 block">Fréquence *</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {FREQUENCIES.map(f => {
                            const active = frequency === f.value;
                            return (
                              <button
                                key={f.value}
                                type="button"
                                onClick={() => setFrequency(f.value)}
                                className={`p-3 rounded-xl border text-left transition-all ${
                                  active ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                         : 'border-border bg-background hover:border-foreground/30'
                                }`}
                              >
                                <p className="text-sm font-semibold">{f.label}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">{f.desc}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 3 — Services */}
                  {step === 3 && (
                    <motion.div
                      key="s3"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-5"
                    >
                      <div>
                        <h2 className="text-xl font-semibold tracking-tight">Quels services vous intéressent ?</h2>
                        <p className="text-sm text-muted-foreground mt-1">Sélectionnez tous les services à inclure dans votre devis.</p>
                      </div>
                      <div className="space-y-2">
                        {SERVICES.map(({ value, icon: Icon, label, desc }) => {
                          const active = services.includes(value);
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => toggleService(value)}
                              className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                                active ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                       : 'border-border bg-background hover:border-foreground/30'
                              }`}
                            >
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                              }`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold">{label}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                              </div>
                              <div className={`w-5 h-5 rounded-md border flex items-center justify-center mt-0.5 ${
                                active ? 'bg-primary border-primary' : 'border-border'
                              }`}>
                                {active && <Check className="w-3 h-3 text-primary-foreground" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 4 — Contact */}
                  {step === 4 && (
                    <motion.div
                      key="s4"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-5"
                    >
                      <div>
                        <h2 className="text-xl font-semibold tracking-tight">Vos coordonnées</h2>
                        <p className="text-sm text-muted-foreground mt-1">Un commercial vous rappelle sous 24h ouvrées.</p>
                      </div>

                      {/* Recap */}
                      <div className="rounded-xl bg-secondary/60 border border-border p-3.5 space-y-1.5 text-xs">
                        <p><span className="text-muted-foreground">Entreprise :</span> <span className="font-medium text-foreground">{company} ({sector})</span></p>
                        <p><span className="text-muted-foreground">Origines :</span> <span className="font-medium text-foreground">{origins.map(o => ORIGINS.find(x => x.value === o)?.flag).join(' ')}</span></p>
                        <p><span className="text-muted-foreground">Volume :</span> <span className="font-medium text-foreground">{VOLUMES.find(v => v.value === volume)?.label}</span> · <span className="text-muted-foreground">Fréquence :</span> <span className="font-medium text-foreground">{FREQUENCIES.find(f => f.value === frequency)?.label}</span></p>
                        <p><span className="text-muted-foreground">Services :</span> <span className="font-medium text-foreground">{services.length}</span></p>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm font-medium mb-1.5 block">Nom complet *</Label>
                          <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Amadou Diallo" />
                        </div>
                        <div>
                          <Label className="text-sm font-medium mb-1.5 block">Fonction</Label>
                          <Input value={role} onChange={e => setRole(e.target.value)} placeholder="Resp. Achats" />
                        </div>
                        <div>
                          <Label className="text-sm font-medium mb-1.5 block">Email pro *</Label>
                          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="amadou@nimsa.sn" />
                        </div>
                        <div>
                          <Label className="text-sm font-medium mb-1.5 block">Téléphone *</Label>
                          <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+221 77 000 00 00" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-1.5 block">Notes (optionnel)</Label>
                        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contraintes, délais, produits sensibles…" rows={3} maxLength={1500} />
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 5 — Success */}
                  {step === 5 && (
                    <motion.div
                      key="s5"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className="text-center py-8"
                    >
                      <motion.div
                        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring' }}
                        className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto"
                      >
                        <Check className="w-7 h-7" />
                      </motion.div>
                      <h2 className="text-2xl font-bold tracking-tight mt-5">Demande transmise</h2>
                      <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto text-pretty">
                        Un commercial Yobbanté vous rappelle sous 24h ouvrées avec une grille tarifaire personnalisée pour <span className="font-medium text-foreground">{company}</span>.
                      </p>
                      <div className="mt-6 flex flex-col sm:flex-row gap-2.5 justify-center">
                        <a
                          href={WHATSAPP_URL}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 text-sm font-semibold bg-foreground text-background px-5 py-3 rounded-xl hover:opacity-90"
                        >
                          <Phone className="w-4 h-4" /> Échanger sur WhatsApp
                        </a>
                        <a
                          href="mailto:contact@yobbante.com"
                          className="inline-flex items-center justify-center gap-2 text-sm font-semibold border border-border px-5 py-3 rounded-xl hover:bg-secondary"
                        >
                          <Mail className="w-4 h-4" /> contact@yobbante.com
                        </a>
                      </div>
                      <button
                        onClick={() => navigate('/')}
                        className="mt-6 text-xs text-muted-foreground hover:text-foreground"
                      >
                        ← Retour à l'accueil
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer actions */}
              {step <= 4 && (
                <div className="px-5 sm:px-7 py-4 border-t border-border bg-secondary/40 flex items-center justify-between gap-3">
                  <button
                    onClick={() => step > 1 ? setStep((step - 1) as 1 | 2 | 3) : navigate(-1)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" /> {step === 1 ? 'Annuler' : 'Précédent'}
                  </button>
                  {step < 4 ? (
                    <button
                      onClick={() => setStep((step + 1) as 2 | 3 | 4)}
                      disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2) || (step === 3 && !canNext3)}
                      className="inline-flex items-center gap-2 text-sm font-semibold bg-foreground text-background px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Continuer <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="inline-flex items-center gap-2 text-sm font-semibold bg-primary text-primary-foreground px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</> : <>Envoyer ma demande <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
