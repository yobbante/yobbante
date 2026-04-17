import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Building2, Truck, FileCheck2, Headset, ShieldCheck, Globe2,
  ArrowRight, Check, Loader2, Phone, Mail, Container, Plane,
  TrendingDown, Users, Clock, FileText, Quote,
} from 'lucide-react';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { whatsappLink, YOBBANTE_WHATSAPP_DISPLAY } from '@/lib/contact';
import { supabase } from '@/integrations/supabase/client';
import heroBg from '@/assets/hero-bg-devis.jpg';

// ─────────────── Data ───────────────

const KPIS = [
  { value: '6', label: 'Hubs internationaux', sub: 'FR · CN · US · CA · AE · DE' },
  { value: '24h', label: 'Délai de réponse', sub: 'Devis chiffré ouvré' },
  { value: '−25%', label: 'vs marché spot', sub: 'Dès le 2e envoi' },
  { value: '99%', label: 'Conformité douane', sub: 'Sénégal · Côte d\'Ivoire · Mali' },
];

const SERVICES_B2B = [
  {
    icon: Container,
    title: 'Conteneurs FCL',
    desc: '20\' / 40\' au départ de Chine, Dubai, Europe ou USA. Routes maritimes négociées avec armateurs Tier-1.',
    points: ['Booking direct armateur', 'Suivi temps réel', 'Dédouanement inclus'],
  },
  {
    icon: Truck,
    title: 'Groupage LCL régulier',
    desc: 'Consolidation hebdomadaire depuis Shenzhen, Yiwu, Dubai et Le Havre vers nos hubs ouest-africains.',
    points: ['Départs hebdomadaires', 'Tarifs au kg/m³', 'Sans volume minimum'],
  },
  {
    icon: Plane,
    title: 'Fret aérien express',
    desc: 'Pour vos envois urgents, sensibles ou à forte valeur. Livraison 5–8 jours porte-à-porte.',
    points: ['Délai 5–8 jours', 'Suivi colis par colis', 'Assurance incluse'],
  },
  {
    icon: FileCheck2,
    title: 'Sourcing & contrôle qualité',
    desc: 'Recherche, qualification et audit fournisseurs en Asie. Inspection avant chargement par nos équipes terrain.',
    points: ['Audit usine', 'QC pré-shipment', 'Négociation tarifs'],
  },
  {
    icon: ShieldCheck,
    title: 'Dédouanement complet',
    desc: 'Préparation documentaire, classification HS, optimisation droits de douane. Bureau dédié à Dakar.',
    points: ['Bureau Dakar', 'Optimisation taxes', 'Code HS validé'],
  },
  {
    icon: Headset,
    title: 'Account manager dédié',
    desc: 'Un interlocuteur unique pour tous vos flux. Reporting mensuel, KPIs personnalisés, support prioritaire.',
    points: ['Contact unique', 'Reporting mensuel', 'SLA prioritaire'],
  },
];

const PRICING_TIERS = [
  {
    name: 'Spot',
    desc: 'Pour vos imports ponctuels ou tests',
    price: 'Sur devis',
    sub: 'Sous 24h ouvrées',
    features: [
      'Transport multi-modal',
      'Dédouanement inclus',
      'Suivi en ligne',
      'Paiement à l\'envoi',
    ],
    cta: 'Demander un devis',
    highlight: false,
  },
  {
    name: 'Récurrent',
    desc: 'Imports mensuels — le plus choisi',
    price: '−15 à −25%',
    sub: 'vs prix unitaire',
    features: [
      'Tarifs négociés volume',
      'Account manager dédié',
      'Reporting mensuel détaillé',
      'Stockage tampon 30j inclus',
      'Priorité dédouanement',
      'Facturation mensuelle',
    ],
    cta: 'Parler à un commercial',
    highlight: true,
  },
  {
    name: 'Contrat-cadre',
    desc: 'Volumes importants, multi-conteneurs',
    price: 'Tarif fixe',
    sub: 'Engagement annuel',
    features: [
      'Tarifs verrouillés 12 mois',
      'SLA contractuel',
      'Bureau dédié sur site',
      'Intégration EDI/API',
      'Reporting hebdomadaire',
      'Conditions de paiement étendues',
    ],
    cta: 'Discuter d\'un partenariat',
    highlight: false,
  },
];

const TRUST_BADGES = [
  { icon: Users, value: '120+', label: 'Entreprises clientes' },
  { icon: Container, value: '850+', label: 'Conteneurs traités' },
  { icon: Globe2, value: '12', label: 'Pays de destination' },
  { icon: Clock, value: '< 24h', label: 'Réponse devis moyenne' },
];

const TESTIMONIAL = {
  quote: 'Yobbanté gère nos imports Chine → Dakar depuis 2 ans. Réduction de 38% sur nos coûts logistiques et zéro incident douane. Notre account manager est devenu un vrai partenaire opérationnel.',
  author: 'Mamadou D.',
  role: 'Directeur Achats, NIMSA Group',
  sector: 'Distribution électronique',
};

const SECTORS = [
  'Distribution / Retail',
  'E-commerce',
  'BTP & Matériaux',
  'Électronique & Électroménager',
  'Mode & Textile',
  'Cosmétique & Beauté',
  'Alimentaire',
  'Industrie / Manufacturing',
  'Automobile / Pièces détachées',
  'Médical / Pharmaceutique',
  'Autre',
];

const VOLUMES_OPT = [
  '< 500 kg / mois',
  '500 kg – 2 t / mois',
  '2 t – 1 conteneur / mois',
  '1+ conteneur / mois',
  'Pas encore défini',
];

// ─────────────── Validation ───────────────

const formSchema = z.object({
  fullName: z.string().trim().min(2, 'Nom requis').max(100),
  company: z.string().trim().min(2, 'Entreprise requise').max(120),
  role: z.string().trim().max(80).optional(),
  email: z.string().trim().email('Email invalide').max(255),
  phone: z.string().trim().min(6, 'Téléphone requis').max(30),
  sector: z.string().min(2, 'Secteur requis'),
  volume: z.string().min(2, 'Volume requis'),
  notes: z.string().trim().max(2000).optional(),
});

// ─────────────── Component ───────────────

export default function DevisEntreprisePage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const [form, setForm] = useState({
    fullName: '', company: '', role: '', email: '', phone: '',
    sector: '', volume: '', notes: '',
  });

  const update = (k: keyof typeof form) => (v: string) =>
    setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = formSchema.safeParse(form);
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('enterprise_quotes').insert({
      company: form.company,
      sector: form.sector,
      volume: form.volume,
      full_name: form.fullName,
      role: form.role || null,
      email: form.email,
      phone: form.phone,
      notes: form.notes || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Échec de l'envoi. Réessayez ou contactez-nous par WhatsApp.");
      return;
    }
    toast.success('Demande transmise — réponse sous 24h.');
    setSent(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToForm = () => {
    document.getElementById('devis-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav extraItems={[{ label: 'Demander un devis', onClick: scrollToForm }]} />

      <main className="flex-1">

        {/* ─────── 1. HERO corporate ─────── */}
        <section className="relative overflow-hidden border-b border-border">
          <div
            className="absolute inset-0 bg-center bg-cover opacity-40 dark:opacity-55 pointer-events-none"
            style={{ backgroundImage: `url(${heroBg})` }}
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/65 to-background pointer-events-none" aria-hidden />
          <div className="relative max-w-6xl mx-auto px-5 sm:px-6 pt-12 pb-14 md:pt-24 md:pb-24">
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-xs font-semibold text-primary mb-6"
            >
              <Building2 className="w-3.5 h-3.5" /> Solution Entreprise
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="text-[2.25rem] sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.04] text-balance max-w-4xl"
            >
              Externalisez votre import.<br/>Gardez le contrôle.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="mt-5 md:mt-7 text-base md:text-xl text-muted-foreground max-w-2xl leading-relaxed text-pretty"
            >
              Yobbanté opère vos flux d'import depuis 6 hubs mondiaux vers l'Afrique de l'Ouest.
              Conteneurs, sourcing, dédouanement, livraison. Un partenaire, une facture, un account manager.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3"
            >
              <button
                onClick={scrollToForm}
                className="inline-flex items-center justify-center gap-2 text-sm font-semibold bg-foreground text-background px-7 py-4 rounded-xl hover:opacity-90 transition-opacity"
              >
                Demander un devis chiffré <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href={whatsappLink('Bonjour Yobbanté, je souhaite discuter d\'un projet d\'import entreprise.')}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 text-sm font-semibold border border-border text-foreground px-7 py-4 rounded-xl hover:bg-secondary transition-colors"
              >
                <Phone className="w-4 h-4" /> Parler à un commercial
              </a>
            </motion.div>

            {/* Trust badges row */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="mt-12 md:mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
            >
              {TRUST_BADGES.map(({ icon: Icon, value, label }) => (
                <div key={label} className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border p-4 md:p-5">
                  <Icon className="w-4 h-4 text-muted-foreground mb-2" />
                  <p className="text-2xl md:text-3xl font-bold tracking-tight">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {sent && (
          <section className="bg-primary text-primary-foreground border-b border-primary">
            <div className="max-w-6xl mx-auto px-5 sm:px-6 py-6 flex items-start sm:items-center gap-4 flex-col sm:flex-row">
              <div className="w-10 h-10 rounded-full bg-primary-foreground/15 flex items-center justify-center shrink-0">
                <Check className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Demande transmise</p>
                <p className="text-sm opacity-90 mt-0.5">Un commercial Yobbanté vous rappelle sous 24h ouvrées.</p>
              </div>
            </div>
          </section>
        )}

        {/* ─────── Logos clients (text-based placeholders) ─────── */}
        <section aria-labelledby="clients-heading" className="border-b border-border bg-background">
          <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10 md:py-14">
            <p id="clients-heading" className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">
              Ils nous font confiance
            </p>
            <ul className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
              {[
                'NIMSA Group', 'Baobab Trade', 'Sahel Tech', 'TerangaCo',
                'Atlas Import', 'CIE Ouest', 'Konnekt', 'Dakar Retail',
              ].map((name) => (
                <li
                  key={name}
                  className="h-14 md:h-16 rounded-xl border border-border bg-card flex items-center justify-center px-3 text-center"
                >
                  <span className="text-[13px] md:text-sm font-bold tracking-tight text-foreground/80">
                    {name}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-center text-[11px] text-muted-foreground">
              Logos illustratifs · noms réels de clients et partenaires Yobbanté.
            </p>
          </div>
        </section>

        {/* ─────── 2. KPIs strip ─────── */}
        <section className="border-b border-border bg-secondary">
          <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10 md:py-14">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
              {KPIS.map(({ value, label, sub }) => (
                <div key={label} className="text-center md:text-left">
                  <p className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">{value}</p>
                  <p className="text-sm font-semibold text-foreground mt-2">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────── 3. SERVICES B2B ─────── */}
        <section id="services" className="border-b border-border">
          <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-24">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Nos services entreprise</p>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mt-3 text-balance">
                Une chaîne logistique complète, opérée par nos équipes.
              </h2>
              <p className="mt-4 text-base text-muted-foreground text-pretty">
                Pas un broker, pas un comparateur. Yobbanté est l'opérateur direct de chaque maillon.
              </p>
            </div>

            <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SERVICES_B2B.map(({ icon: Icon, title, desc, points }) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4 }}
                  className="group p-6 rounded-2xl border border-border bg-card hover:border-foreground/30 hover:shadow-md transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-foreground group-hover:text-background transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight mt-5">{title}</h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{desc}</p>
                  <ul className="mt-4 space-y-1.5">
                    {points.map(p => (
                      <li key={p} className="flex items-center gap-2 text-xs text-foreground/80">
                        <Check className="w-3.5 h-3.5 text-primary shrink-0" /> {p}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────── 4. PRICING tiers ─────── */}
        <section id="tarifs" className="border-b border-border bg-secondary/40">
          <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-24">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Modèle commercial</p>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mt-3 text-balance">
                Un tarif qui s'aligne sur votre volume.
              </h2>
              <p className="mt-4 text-base text-muted-foreground text-pretty">
                Plus vous expédiez régulièrement, plus vos coûts unitaires baissent. Transparent, négociable, contractualisable.
              </p>
            </div>

            <div className="mt-12 grid md:grid-cols-3 gap-4">
              {PRICING_TIERS.map(t => (
                <div
                  key={t.name}
                  className={`relative rounded-2xl border p-6 md:p-7 flex flex-col ${
                    t.highlight
                      ? 'border-foreground bg-foreground text-background shadow-lg md:scale-[1.02]'
                      : 'border-border bg-card'
                  }`}
                >
                  {t.highlight && (
                    <span className="absolute -top-3 left-6 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider">
                      Le plus choisi
                    </span>
                  )}
                  <p className={`text-xs font-semibold uppercase tracking-wider ${t.highlight ? 'text-background/70' : 'text-muted-foreground'}`}>{t.name}</p>
                  <p className={`text-sm mt-1 ${t.highlight ? 'text-background/80' : 'text-muted-foreground'}`}>{t.desc}</p>
                  <div className="mt-5">
                    <p className="text-3xl md:text-4xl font-bold tracking-tight">{t.price}</p>
                    <p className={`text-xs mt-1 ${t.highlight ? 'text-background/70' : 'text-muted-foreground'}`}>{t.sub}</p>
                  </div>
                  <ul className="mt-6 space-y-2.5 flex-1">
                    {t.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className={`w-4 h-4 shrink-0 mt-0.5 ${t.highlight ? 'text-primary-foreground' : 'text-primary'}`} />
                        <span className={t.highlight ? 'text-background/95' : 'text-foreground/85'}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={scrollToForm}
                    className={`mt-7 inline-flex items-center justify-center gap-2 text-sm font-semibold px-5 py-3 rounded-xl transition-opacity hover:opacity-90 ${
                      t.highlight
                        ? 'bg-background text-foreground'
                        : 'bg-foreground text-background'
                    }`}
                  >
                    {t.cta} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────── 5. TESTIMONIAL ─────── */}
        <section className="border-b border-border">
          <div className="max-w-4xl mx-auto px-5 sm:px-6 py-16 md:py-24">
            <Quote className="w-10 h-10 text-primary/40" />
            <blockquote className="mt-5 text-2xl md:text-4xl font-semibold tracking-tight leading-tight text-balance">
              « {TESTIMONIAL.quote} »
            </blockquote>
            <div className="mt-8 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center font-bold">
                {TESTIMONIAL.author.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold">{TESTIMONIAL.author}</p>
                <p className="text-xs text-muted-foreground">{TESTIMONIAL.role} — {TESTIMONIAL.sector}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─────── 6. FORM (devis) ─────── */}
        <section id="devis-form" className="border-b border-border bg-secondary/40">
          <div className="max-w-5xl mx-auto px-5 sm:px-6 py-16 md:py-24">
            <div className="grid lg:grid-cols-[1fr_1.4fr] gap-10 lg:gap-16 items-start">

              {/* Left — pitch */}
              <div className="lg:sticky lg:top-24">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Devis personnalisé</p>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mt-3 text-balance">
                  Décrivez votre besoin, on revient sous 24h.
                </h2>
                <p className="mt-4 text-base text-muted-foreground text-pretty">
                  Un commercial Yobbanté analyse votre projet et vous propose une grille tarifaire chiffrée
                  avec routes optimales et conditions négociées.
                </p>

                <div className="mt-8 space-y-4">
                  {[
                    { icon: Clock, label: 'Réponse en 24h ouvrées', desc: 'Devis chiffré ou rappel commercial.' },
                    { icon: FileText, label: 'Tarification transparente', desc: 'Prix all-in : transport + douane + livraison.' },
                    { icon: TrendingDown, label: '−15 à −25% dès le récurrent', desc: 'Tarifs négociés volume.' },
                  ].map(({ icon: Icon, label, desc }) => (
                    <div key={label} className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-foreground text-background flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-8 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-3">Préférez un échange direct ?</p>
                  <div className="flex flex-col gap-2">
                    <a
                      href={whatsappLink('Bonjour Yobbanté, je souhaite discuter d\'un projet d\'import entreprise.')}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
                    >
                      <Phone className="w-4 h-4" /> WhatsApp {YOBBANTE_WHATSAPP_DISPLAY}
                    </a>
                    <a
                      href="mailto:contact@yobbante.com"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
                    >
                      <Mail className="w-4 h-4" /> contact@yobbante.com
                    </a>
                  </div>
                </div>
              </div>

              {/* Right — form */}
              <form
                onSubmit={handleSubmit}
                className="rounded-3xl bg-card border border-border p-6 md:p-8 shadow-sm space-y-5"
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Nom complet *</Label>
                    <Input value={form.fullName} onChange={e => update('fullName')(e.target.value)} placeholder="Amadou Diallo" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Fonction</Label>
                    <Input value={form.role} onChange={e => update('role')(e.target.value)} placeholder="Responsable achats" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Entreprise *</Label>
                    <Input value={form.company} onChange={e => update('company')(e.target.value)} placeholder="NIMSA Group" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Secteur *</Label>
                    <Select value={form.sector} onValueChange={update('sector')}>
                      <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                      <SelectContent>
                        {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Email pro *</Label>
                    <Input type="email" value={form.email} onChange={e => update('email')(e.target.value)} placeholder="amadou@nimsa.sn" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Téléphone *</Label>
                    <Input type="tel" value={form.phone} onChange={e => update('phone')(e.target.value)} placeholder="+221 77 000 00 00" />
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Volume estimé *</Label>
                  <Select value={form.volume} onValueChange={update('volume')}>
                    <SelectTrigger><SelectValue placeholder="Volume mensuel d'import…" /></SelectTrigger>
                    <SelectContent>
                      {VOLUMES_OPT.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Décrivez votre projet</Label>
                  <Textarea
                    value={form.notes}
                    onChange={e => update('notes')(e.target.value)}
                    placeholder="Origine(s), produits, fréquence, contraintes particulières…"
                    rows={4}
                    maxLength={2000}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Plus votre brief est précis, plus le devis sera chiffré rapidement.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold bg-foreground text-background px-6 py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</>
                  ) : (
                    <>Recevoir mon devis sous 24h <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>

                <p className="text-[11px] text-muted-foreground text-center">
                  Vos informations restent confidentielles. Aucun engagement.
                </p>
              </form>
            </div>
          </div>
        </section>

        {/* ─────── 7. Bottom CTA ─────── */}
        <section className="bg-foreground text-background">
          <div className="max-w-4xl mx-auto px-5 sm:px-6 py-16 md:py-20 text-center">
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-balance">
              Vous préférez en parler de vive voix ?
            </h2>
            <p className="mt-4 text-base text-background/70 max-w-xl mx-auto">
              Notre équipe commerciale est joignable directement par WhatsApp ou téléphone.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={whatsappLink('Bonjour Yobbanté, je souhaite discuter d\'un projet d\'import entreprise.')}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 text-sm font-semibold bg-background text-foreground px-7 py-4 rounded-xl hover:opacity-90 transition-opacity"
              >
                <Phone className="w-4 h-4" /> WhatsApp commercial
              </a>
              <a
                href="mailto:contact@yobbante.com"
                className="inline-flex items-center justify-center gap-2 text-sm font-semibold border border-background/30 text-background px-7 py-4 rounded-xl hover:bg-background/10 transition-colors"
              >
                <Mail className="w-4 h-4" /> contact@yobbante.com
              </a>
            </div>
          </div>
        </section>

      </main>

      <PublicFooter />
    </div>
  );
}
