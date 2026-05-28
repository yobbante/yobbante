import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import heroBg from '@/assets/hero-bg-enterprises.jpg';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Building2, ShieldCheck, Headset, Truck, FileCheck2, Globe2, ArrowRight, Check, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { useSeo } from '@/hooks/useSeo';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

const KPIS = [
  { icon: Globe2, value: '6', label: 'Hubs internationaux' },
  { icon: Truck, value: '150+', label: 'Pays desservis' },
  { icon: Headset, value: '24h', label: 'Réponse devis' },
  { icon: ShieldCheck, value: '99%', label: 'Dédouanements OK' },
];

// Placeholder client logos (text-based, no external assets)
const CLIENTS = [
  'NIMSA Group', 'Baobab Trade', 'Sahel Tech', 'TerangaCo',
  'Atlas Import', 'CIE Ouest', 'Konnekt', 'Dakar Retail',
];

const CASE_STUDY = {
  client: 'NIMSA Group',
  sector: 'Distribution électronique',
  challenge: 'Importer un conteneur 40\' d\'électroménager depuis Shenzhen vers Dakar tous les 2 mois, avec dédouanement et livraison entrepôt — sans interruption de stock.',
  solution: [
    'Sourcing usine direct + audit qualité avant chargement',
    'Conteneur FCL maritime, route optimisée Shenzhen → Dakar',
    'Dédouanement Sénégal géré de bout en bout',
    'Livraison hub client + reporting hebdo',
  ],
  results: [
    { value: '−38%', label: 'vs précédent transitaire' },
    { value: '32 j', label: 'délai porte-à-porte' },
    { value: '100%', label: 'conformité douane' },
  ],
};

const PRICING = [
  {
    name: 'À la demande',
    desc: 'Pour vos imports ponctuels',
    price: 'Sur devis',
    sub: 'À partir de 250 €',
    features: [
      'Devis en 24h',
      'Sourcing optionnel',
      'Dédouanement pris en charge',
      'Suivi en ligne',
    ],
    cta: 'Demander un devis',
    highlight: false,
  },
  {
    name: 'Récurrent',
    desc: 'Imports réguliers (mensuels)',
    price: '−15 à −25%',
    sub: 'vs prix unitaire',
    features: [
      'Tarifs négociés volume',
      'Account manager dédié',
      'Reporting mensuel',
      'Stockage inclus 30j',
      'Priorité dédouanement',
    ],
    cta: 'Parler à un commercial',
    highlight: true,
  },
  {
    name: 'Sur mesure',
    desc: 'Conteneurs FCL · contrats annuels',
    price: 'Custom',
    sub: 'Conditions négociées',
    features: [
      'Contrat-cadre annuel',
      'Tarifs préférentiels',
      'SLA personnalisés',
      'Multi-origines',
      'Intégration ERP possible',
    ],
    cta: 'Étudier mon besoin',
    highlight: false,
  },
];

const VALUE_PROPS = [
  { icon: Building2, title: 'Spécialisé B2B', desc: 'Volumes, conteneurs, contrats récurrents — pas de marketplace, un opérateur.' },
  { icon: ShieldCheck, title: 'Dédouanement maîtrisé', desc: 'Conformité documentaire et optimisation taxes dans tous nos hubs.' },
  { icon: Headset, title: 'Interlocuteur dédié', desc: 'Un account manager qui connaît vos flux et vos contraintes.' },
  { icon: FileCheck2, title: 'Reporting transparent', desc: 'Suivi en ligne, factures structurées, KPIs partagés.' },
];

const contactSchema = z.object({
  fullName: z.string().trim().min(2, 'Nom requis').max(100),
  company: z.string().trim().min(2, 'Entreprise requise').max(120),
  email: z.string().trim().email('Email invalide').max(255),
  phone: z.string().trim().min(6, 'Téléphone requis').max(30),
  volume: z.string().min(1, 'Volume requis'),
  origin: z.string().min(1, 'Origine requise'),
  message: z.string().trim().max(1000).optional(),
});

export default function EnterprisesPage() {
  useSeo({
    title: 'Solutions logistiques B2B pour entreprises | Yobbanté',
    description: "Yobbanté accompagne les entreprises dans leur logistique internationale : sourcing, douane, transport multimodal et reporting.",
    path: '/entreprises',
  });
  const navigate = useNavigate();
  const goDevis = () => navigate('/devis-entreprise');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    fullName: '', company: '', email: '', phone: '',
    volume: '', origin: '', message: '',
  });

  const update = <K extends keyof typeof form>(k: K, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = contactSchema.safeParse(form);
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    // Open mailto with structured body as fallback (no email backend yet)
    const body = encodeURIComponent(
      `Nom: ${form.fullName}\nEntreprise: ${form.company}\nEmail: ${form.email}\nTéléphone: ${form.phone}\nVolume estimé: ${form.volume}\nOrigine: ${form.origin}\n\nMessage:\n${form.message || '(aucun)'}`
    );
    window.location.href = `mailto:contact@yobbante.com?subject=${encodeURIComponent('Contact commercial — ' + form.company)}&body=${body}`;
    setTimeout(() => {
      setSent(true);
      setSubmitting(false);
      toast.success('Message prêt à être envoyé via votre client mail');
    }, 400);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-center bg-cover opacity-40 dark:opacity-55 pointer-events-none"
          style={{ backgroundImage: `url(${heroBg})` }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/65 to-background pointer-events-none" aria-hidden />
        <div className="relative max-w-5xl mx-auto px-5 sm:px-6 pt-12 pb-12 md:pt-24 md:pb-16 text-center md:text-left">
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-xs font-medium text-muted-foreground mb-5"
        >
          <Building2 className="w-3.5 h-3.5" /> Pour entreprises & importateurs réguliers
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="text-[2.25rem] sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] text-balance"
        >
          Votre opérateur logistique B2B en Afrique de l'Ouest.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="mt-5 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto md:mx-0 leading-relaxed text-pretty"
        >
          Conteneurs, sourcing usine, dédouanement, contrats récurrents. Un seul interlocuteur pour vos flux d'import, du devis à la livraison.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="mt-7 flex flex-col sm:flex-row gap-3 sm:justify-center md:justify-start"
        >
          <button
            onClick={goDevis}
            className="inline-flex items-center justify-center gap-2 text-sm font-semibold bg-foreground text-background px-6 py-3.5 rounded-xl hover:opacity-90 transition-opacity"
          >
            Demander un devis entreprise <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href="#contact"
            className="inline-flex items-center justify-center gap-2 text-sm font-semibold border border-border text-foreground px-6 py-3.5 rounded-xl hover:bg-secondary transition-colors"
          >
            Écrire un message
          </a>
        </motion.div>
        </div>
      </section>

      {/* KPIs */}
      <section className="border-t border-border bg-secondary">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-12 md:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {KPIS.map(({ icon: Icon, value, label }, i) => (
              <motion.div
                key={label}
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                className="text-center md:text-left"
              >
                <Icon className="w-5 h-5 text-muted-foreground mx-auto md:mx-0" />
                <p className="text-3xl md:text-4xl font-bold text-foreground mt-3 tracking-tight">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Logos */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-12 md:py-16">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium text-center mb-8">
            Ils nous font confiance
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
            {CLIENTS.map((c, i) => (
              <motion.div
                key={c}
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                className="h-16 md:h-20 rounded-xl border border-border bg-card flex items-center justify-center px-3 hover:bg-secondary transition-colors"
              >
                <span className="text-sm md:text-base font-semibold text-muted-foreground tracking-tight text-center">
                  {c}
                </span>
              </motion.div>
            ))}
          </div>
          <p className="text-[11px] text-center text-muted-foreground mt-6 italic">
            Logos illustratifs — la liste réelle de nos clients est partagée sur demande.
          </p>
        </div>
      </section>

      {/* Value props */}
      <section className="border-t border-border bg-secondary">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-20">
          <div className="text-center md:text-left max-w-2xl mx-auto md:mx-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Pourquoi Yobbanté</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mt-3 text-balance">
              Pas un courtier. Un opérateur.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mt-10">
            {VALUE_PROPS.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                className="bg-card border border-border rounded-2xl p-5"
              >
                <Icon className="w-5 h-5 text-foreground" />
                <h3 className="text-base font-semibold text-foreground mt-4 text-balance">{title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed text-pretty">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Case study */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-16 md:py-24">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium text-center md:text-left">Étude de cas</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mt-3 text-balance text-center md:text-left">
            {CASE_STUDY.client} — {CASE_STUDY.sector}
          </h2>

          <div className="mt-10 grid md:grid-cols-2 gap-8 md:gap-12">
            <motion.div
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Le défi</p>
              <p className="text-base text-foreground leading-relaxed text-pretty">{CASE_STUDY.challenge}</p>
            </motion.div>
            <motion.div
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Notre solution</p>
              <ul className="space-y-2.5">
                {CASE_STUDY.solution.map((s) => (
                  <li key={s} className="flex items-start gap-2.5 text-sm text-foreground leading-relaxed">
                    <Check className="w-4 h-4 text-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-pretty">{s}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-3 md:gap-4">
            {CASE_STUDY.results.map((r, i) => (
              <motion.div
                key={r.label}
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                className="bg-foreground text-background rounded-2xl p-5 md:p-6 text-center"
              >
                <p className="text-2xl md:text-4xl font-bold tracking-tight">{r.value}</p>
                <p className="text-[11px] md:text-xs text-background/70 mt-1.5 leading-tight">{r.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-border bg-secondary">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-24">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Tarification indicative</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mt-3 text-balance">
              3 formules. Pas de surprises.
            </h2>
            <p className="text-sm text-muted-foreground mt-4 max-w-lg mx-auto text-pretty">
              Tarifs dépendant du volume, de la route et de la nature des marchandises. Devis personnalisé sous 24h.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-5 mt-10">
            {PRICING.map((tier, i) => (
              <motion.div
                key={tier.name}
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                className={`rounded-2xl p-6 md:p-7 flex flex-col ${
                  tier.highlight
                    ? 'bg-foreground text-background border-2 border-foreground shadow-xl md:scale-[1.02]'
                    : 'bg-card border border-border'
                }`}
              >
                {tier.highlight && (
                  <span className="self-start inline-block text-[10px] font-bold uppercase tracking-wider bg-background/15 text-background px-2.5 py-1 rounded-full mb-3">
                    Recommandé
                  </span>
                )}
                <h3 className={`text-xl font-bold tracking-tight ${tier.highlight ? 'text-background' : 'text-foreground'}`}>
                  {tier.name}
                </h3>
                <p className={`text-sm mt-1 ${tier.highlight ? 'text-background/70' : 'text-muted-foreground'}`}>
                  {tier.desc}
                </p>
                <div className="mt-5">
                  <p className={`text-3xl md:text-4xl font-bold tracking-tight ${tier.highlight ? 'text-background' : 'text-foreground'}`}>
                    {tier.price}
                  </p>
                  <p className={`text-xs mt-1 ${tier.highlight ? 'text-background/60' : 'text-muted-foreground'}`}>
                    {tier.sub}
                  </p>
                </div>
                <ul className="mt-5 space-y-2.5 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2 text-sm ${tier.highlight ? 'text-background/90' : 'text-foreground'}`}>
                      <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${tier.highlight ? 'text-background' : 'text-foreground'}`} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={goDevis}
                  className={`mt-6 inline-flex items-center justify-center gap-2 text-sm font-semibold px-5 py-3 rounded-xl transition-opacity ${
                    tier.highlight
                      ? 'bg-background text-foreground hover:opacity-90'
                      : 'bg-foreground text-background hover:opacity-90'
                  }`}
                >
                  {tier.cta} <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact form */}
      <section id="contact" className="border-t border-border">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-16 md:py-24">
          <div className="text-center md:text-left">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Contact commercial</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mt-3 text-balance">
              Parlons de vos flux.
            </h2>
            <p className="text-sm text-muted-foreground mt-4 max-w-lg mx-auto md:mx-0 text-pretty">
              Décrivez votre besoin — un de nos commerciaux vous rappelle sous 24h ouvrées avec une première estimation.
            </p>
          </div>

          {sent ? (
            <div className="mt-10 bg-secondary rounded-2xl p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-foreground text-background flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mt-4">Message en cours d'envoi</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto text-pretty">
                Si rien ne s'ouvre, écrivez-nous directement à{' '}
                <a href="mailto:contact@yobbante.com" className="text-foreground font-semibold underline">contact@yobbante.com</a>.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-10 grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Nom complet *</Label>
                <Input value={form.fullName} onChange={e => update('fullName', e.target.value)} placeholder="Amadou Diallo" />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Entreprise *</Label>
                <Input value={form.company} onChange={e => update('company', e.target.value)} placeholder="NIMSA Group" />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Email pro *</Label>
                <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="amadou@nimsa.sn" />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Téléphone *</Label>
                <Input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+221 77 000 00 00" />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Volume estimé *</Label>
                <Select value={form.volume} onValueChange={(v) => update('volume', v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="<500kg">Moins de 500 kg / mois</SelectItem>
                    <SelectItem value="500-2t">500 kg – 2 tonnes / mois</SelectItem>
                    <SelectItem value="2t-conteneur">2 tonnes – 1 conteneur / mois</SelectItem>
                    <SelectItem value=">conteneur">Plusieurs conteneurs / mois</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Pays d'origine *</Label>
                <Select value={form.origin} onValueChange={(v) => update('origin', v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CN">🇨🇳 Chine</SelectItem>
                    <SelectItem value="AE">🇦🇪 Dubai</SelectItem>
                    <SelectItem value="FR">🇫🇷 France</SelectItem>
                    <SelectItem value="DE">🇩🇪 Allemagne</SelectItem>
                    <SelectItem value="US">🇺🇸 USA</SelectItem>
                    <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                    <SelectItem value="multi">Multi-origines</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-sm font-medium mb-2 block">Décrivez votre besoin (optionnel)</Label>
                <Textarea
                  value={form.message}
                  onChange={e => update('message', e.target.value)}
                  placeholder="Type de produits, fréquence, contraintes particulières…"
                  rows={4}
                  maxLength={1000}
                />
              </div>
              <div className="sm:col-span-2 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  En soumettant, vous acceptez d'être contacté par notre équipe.
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 text-sm font-semibold bg-foreground text-background px-6 py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</> : <>Envoyer ma demande <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
