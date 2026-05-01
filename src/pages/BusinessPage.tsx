import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Building2, CheckCircle2, Loader2, Phone, Mail,
  AlertTriangle, ShieldCheck, Sparkles, Briefcase, Users, FileText,
  PackageSearch, Truck, Inbox, BarChart3, Receipt, Bell, LayoutDashboard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessAccount } from '@/hooks/useBusinessAccount';
import { useBusinessMembers } from '@/hooks/useBusinessMembers';
import { useBusinessInvoices } from '@/hooks/useBusinessInvoices';
import { TeamSection } from '@/components/business/TeamSection';
import { InvoicesSection } from '@/components/business/InvoicesSection';
import { AccountManagerCard } from '@/components/business/AccountManagerCard';
import { DossiersSection } from '@/components/business/DossiersSection';
import { isValidNinea, normalizeNinea, formatNinea } from '@/lib/ninea';
import { cn } from '@/lib/utils';

/* ────────────────────────────────────────────────────────────────────────── */

const LEGAL_FORMS = ['SARL', 'SA', 'SAS', 'EI', 'GIE', 'Autre'];
const SECTORS = [
  'Commerce · Import/Export',
  'Distribution',
  'Industrie',
  'Agriculture',
  'Tech',
  'Services',
  'BTP',
  'Cosmétique',
  'Textile',
  'Autre',
];

/* ─── Shell ──────────────────────────────────────────────────────────────── */

function BusinessShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-5 py-3">
          <button
            onClick={() => navigate('/app')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Retour à mon espace
          </button>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-muted-foreground">
            <Briefcase className="w-3.5 h-3.5" /> Yobbanté Business
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 md:py-12">{children}</main>
    </div>
  );
}

/* ─── Page principale ────────────────────────────────────────────────────── */

export default function BusinessPage() {
  const { user, loading: authLoading } = useAuth();
  const { account, loading, refresh } = useBusinessAccount();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth?redirect=/business');
  }, [authLoading, user, navigate]);

  if (authLoading || loading) {
    return (
      <BusinessShell>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      </BusinessShell>
    );
  }

  if (!account) return <BusinessShell><BusinessOnboarding onDone={refresh} /></BusinessShell>;
  return <BusinessShell><BusinessDashboard account={account} /></BusinessShell>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ONBOARDING
   ═══════════════════════════════════════════════════════════════════════════ */

type Step = 'intro' | 'ninea' | 'legal' | 'admin' | 'confirm';

function BusinessOnboarding({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('intro');

  const [ninea, setNinea] = useState('');
  const [legalName, setLegalName] = useState('');
  const [legalForm, setLegalForm] = useState('SARL');
  const [sector, setSector] = useState(SECTORS[0]);
  const [headquarters, setHeadquarters] = useState('');
  const [website, setWebsite] = useState('');

  const [adminName, setAdminName] = useState('');
  const [adminRole, setAdminRole] = useState('Gérant');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminEmail, setAdminEmail] = useState(user?.email ?? '');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (user?.email && !adminEmail) setAdminEmail(user.email); }, [user, adminEmail]);

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from('business_accounts').insert({
      user_id: user.id,
      ninea: normalizeNinea(ninea),
      legal_name: legalName.trim(),
      legal_form: legalForm,
      sector,
      headquarters_address: headquarters.trim(),
      website: website.trim() || null,
      admin_full_name: adminName.trim(),
      admin_role: adminRole.trim(),
      admin_phone: adminPhone.trim(),
      admin_email: adminEmail.trim(),
      status: 'active',
      activated_at: new Date().toISOString(),
    });
    setSubmitting(false);
    if (error) {
      console.error(error);
      if (error.code === '23505') {
        toast.error('Ce NINEA est déjà associé à un compte.');
      } else {
        toast.error("Impossible d'activer le compte. Réessayez.");
      }
      return;
    }
    setStep('confirm');
    onDone();
  };

  const titles: Record<Step, string> = {
    intro: 'Yobbanté Business',
    ninea: 'Vérification NINEA',
    legal: 'Informations légales',
    admin: 'Administrateur principal',
    confirm: 'Compte activé',
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Stepper */}
      {step !== 'intro' && step !== 'confirm' && (
        <div className="flex items-center gap-2 mb-8 text-xs">
          {(['ninea', 'legal', 'admin'] as Step[]).map((s, i) => {
            const reached = ['ninea', 'legal', 'admin'].indexOf(step) >= i;
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center font-semibold transition-colors',
                    reached ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                  )}
                >
                  {i + 1}
                </div>
                {i < 2 && <div className={cn('w-12 h-px', reached ? 'bg-primary' : 'bg-border')} />}
              </div>
            );
          })}
        </div>
      )}

      <motion.div
        key={step}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">{titles[step]}</h1>

        {step === 'intro' && (
          <IntroStep onStart={() => setStep('ninea')} />
        )}

        {step === 'ninea' && (
          <NineaStep
            value={ninea}
            onChange={setNinea}
            onBack={() => setStep('intro')}
            onNext={() => setStep('legal')}
          />
        )}

        {step === 'legal' && (
          <LegalStep
            legalName={legalName} setLegalName={setLegalName}
            legalForm={legalForm} setLegalForm={setLegalForm}
            sector={sector} setSector={setSector}
            headquarters={headquarters} setHeadquarters={setHeadquarters}
            website={website} setWebsite={setWebsite}
            onBack={() => setStep('ninea')}
            onNext={() => setStep('admin')}
          />
        )}

        {step === 'admin' && (
          <AdminStep
            adminName={adminName} setAdminName={setAdminName}
            adminRole={adminRole} setAdminRole={setAdminRole}
            adminPhone={adminPhone} setAdminPhone={setAdminPhone}
            adminEmail={adminEmail} setAdminEmail={setAdminEmail}
            onBack={() => setStep('legal')}
            onSubmit={submit}
            submitting={submitting}
          />
        )}

        {step === 'confirm' && (
          <ConfirmStep
            legalName={legalName}
            ninea={formatNinea(ninea)}
            adminName={adminName}
          />
        )}
      </motion.div>
    </div>
  );
}

/* ─── Intro ──────────────────────────────────────────────────────────────── */

function IntroStep({ onStart }: { onStart: () => void }) {
  const features = [
    { icon: Truck, label: 'Tarifs négociés import/export volumes' },
    { icon: Users, label: 'Gestion d’équipe et rôles' },
    { icon: FileText, label: 'Documents douaniers générés automatiquement' },
    { icon: ShieldCheck, label: 'Chargé de compte dédié' },
  ];
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Accédez à des tarifs professionnels, la gestion d’équipe, les documents douaniers et un chargé de compte dédié.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {features.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-start gap-3 p-4 rounded-[var(--radius)] border border-border bg-card">
            <Icon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <span className="text-sm">{label}</span>
          </div>
        ))}
      </div>
      <div className="rounded-[var(--radius)] border border-border bg-secondary/40 p-4 text-sm text-muted-foreground flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 mt-0.5 text-foreground shrink-0" />
        <span>Pour activer votre espace, votre <strong className="text-foreground">NINEA</strong> est obligatoire.</span>
      </div>
      <Button size="lg" onClick={onStart} className="w-full sm:w-auto">
        Commencer <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}

/* ─── NINEA ──────────────────────────────────────────────────────────────── */

function NineaStep({
  value, onChange, onBack, onNext,
}: { value: string; onChange: (v: string) => void; onBack: () => void; onNext: () => void }) {
  const [touched, setTouched] = useState(false);
  const valid = useMemo(() => isValidNinea(value), [value]);
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Yobbanté Business est réservé aux entreprises enregistrées légalement au Sénégal.
      </p>
      <div>
        <Label htmlFor="ninea">NINEA / NIF *</Label>
        <Input
          id="ninea"
          value={formatNinea(value)}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="00123456 7A2"
          className="mt-1.5 font-mono tracking-wider text-base"
          maxLength={12}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Format attendu : 8 chiffres + 1 lettre + 1 chiffre.
        </p>
        {touched && !valid && value.length > 0 && (
          <div className="mt-3 flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            Ce NINEA ne semble pas valide. Vérifiez le format.
          </div>
        )}
        {valid && (
          <div className="mt-3 flex items-start gap-2 text-sm text-primary">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            Format reconnu — vous pouvez continuer.
          </div>
        )}
      </div>
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Retour
        </Button>
        <Button onClick={onNext} disabled={!valid}>
          Continuer <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Légal ──────────────────────────────────────────────────────────────── */

function LegalStep(props: {
  legalName: string; setLegalName: (v: string) => void;
  legalForm: string; setLegalForm: (v: string) => void;
  sector: string; setSector: (v: string) => void;
  headquarters: string; setHeadquarters: (v: string) => void;
  website: string; setWebsite: (v: string) => void;
  onBack: () => void; onNext: () => void;
}) {
  const ok = props.legalName.trim().length >= 2 && props.headquarters.trim().length >= 5;
  return (
    <div className="space-y-5">
      <p className="text-muted-foreground">Renseignez les informations de votre entreprise.</p>
      <div>
        <Label htmlFor="legal-name">Nom commercial *</Label>
        <Input id="legal-name" value={props.legalName} onChange={(e) => props.setLegalName(e.target.value)} placeholder="Yobbanté Sénégal SARL" className="mt-1.5" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Forme juridique *</Label>
          <Select value={props.legalForm} onValueChange={props.setLegalForm}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>{LEGAL_FORMS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Secteur d’activité *</Label>
          <Select value={props.sector} onValueChange={props.setSector}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>{SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="hq">Adresse siège *</Label>
        <Input id="hq" value={props.headquarters} onChange={(e) => props.setHeadquarters(e.target.value)} placeholder="Liberté 6, Dakar, Sénégal" className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="web">Site web (optionnel)</Label>
        <Input id="web" value={props.website} onChange={(e) => props.setWebsite(e.target.value)} placeholder="https://" className="mt-1.5" />
      </div>
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={props.onBack}><ArrowLeft className="w-4 h-4 mr-2" /> Retour</Button>
        <Button onClick={props.onNext} disabled={!ok}>Continuer <ArrowRight className="w-4 h-4 ml-2" /></Button>
      </div>
    </div>
  );
}

/* ─── Admin ──────────────────────────────────────────────────────────────── */

function AdminStep(props: {
  adminName: string; setAdminName: (v: string) => void;
  adminRole: string; setAdminRole: (v: string) => void;
  adminPhone: string; setAdminPhone: (v: string) => void;
  adminEmail: string; setAdminEmail: (v: string) => void;
  onBack: () => void; onSubmit: () => void; submitting: boolean;
}) {
  const ok =
    props.adminName.trim().length >= 2 &&
    props.adminPhone.trim().length >= 6 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.adminEmail);
  return (
    <div className="space-y-5">
      <p className="text-muted-foreground">L’administrateur reçoit toutes les notifications et factures.</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="adm-name">Nom complet *</Label>
          <Input id="adm-name" value={props.adminName} onChange={(e) => props.setAdminName(e.target.value)} placeholder="Amath Diallo" className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="adm-role">Poste *</Label>
          <Input id="adm-role" value={props.adminRole} onChange={(e) => props.setAdminRole(e.target.value)} placeholder="Gérant" className="mt-1.5" />
        </div>
      </div>
      <div>
        <Label htmlFor="adm-phone">Téléphone professionnel *</Label>
        <Input id="adm-phone" value={props.adminPhone} onChange={(e) => props.setAdminPhone(e.target.value)} placeholder="+221 77 ..." className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="adm-email">Email professionnel *</Label>
        <Input id="adm-email" type="email" value={props.adminEmail} onChange={(e) => props.setAdminEmail(e.target.value)} placeholder="amath@entreprise.sn" className="mt-1.5" />
      </div>
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={props.onBack} disabled={props.submitting}><ArrowLeft className="w-4 h-4 mr-2" /> Retour</Button>
        <Button onClick={props.onSubmit} disabled={!ok || props.submitting}>
          {props.submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Activer mon espace
        </Button>
      </div>
    </div>
  );
}

/* ─── Confirm ────────────────────────────────────────────────────────────── */

function ConfirmStep({ legalName, ninea, adminName }: { legalName: string; ninea: string; adminName: string }) {
  return (
    <div className="space-y-6 text-center max-w-md mx-auto">
      <div className="mx-auto w-16 h-16 rounded-full bg-primary/15 text-primary flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <div>
        <h2 className="text-xl font-bold">Espace Business activé</h2>
        <p className="mt-2 text-muted-foreground">Bienvenue, votre espace est prêt.</p>
      </div>
      <Card className="p-5 text-left space-y-2">
        <div className="text-sm"><span className="text-muted-foreground">Entreprise · </span><strong>{legalName}</strong></div>
        <div className="text-sm"><span className="text-muted-foreground">NINEA · </span><span className="font-mono">{ninea}</span></div>
        <div className="text-sm"><span className="text-muted-foreground">Admin · </span>{adminName}</div>
      </Card>
      <p className="text-xs text-muted-foreground">Un chargé de compte vous contacte sous 24h.</p>
      <Button size="lg" onClick={() => window.location.reload()}>Accéder au dashboard <ArrowRight className="w-4 h-4 ml-2" /></Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════════════════════ */

function BusinessDashboard({ account }: { account: import('@/hooks/useBusinessAccount').BusinessAccount }) {
  const { user } = useAuth();
  const { members } = useBusinessMembers(account.id);
  const { invoices } = useBusinessInvoices(account.id);

  const isAdmin = account.user_id === user?.id ||
    members.some(m => m.user_id === user?.id && m.role === 'admin');

  const overdueCount = invoices.filter(i => i.status === 'overdue').length;
  const unpaidAmount = invoices
    .filter(i => i.status === 'unpaid' || i.status === 'overdue')
    .reduce((s, i) => s + Number(i.amount_eur), 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="text-xs font-semibold tracking-wider uppercase text-primary mb-2">Mon entreprise</div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{account.legal_name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {account.legal_form} · {account.sector} · NINEA {formatNinea(account.ninea)}
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-8">
        <TabsList className="grid grid-cols-5 max-w-3xl">
          <TabsTrigger value="overview"><LayoutDashboard className="w-4 h-4 mr-2" />Aperçu</TabsTrigger>
          <TabsTrigger value="dossiers"><FileText className="w-4 h-4 mr-2" />Dossiers</TabsTrigger>
          <TabsTrigger value="team"><Users className="w-4 h-4 mr-2" />Équipe</TabsTrigger>
          <TabsTrigger value="invoices">
            <Receipt className="w-4 h-4 mr-2" />Factures
            {overdueCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] rounded-full bg-red-500/20 text-red-500 font-bold">
                {overdueCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="contact"><Sparkles className="w-4 h-4 mr-2" />Contact</TabsTrigger>
        </TabsList>

        {/* APERÇU */}
        <TabsContent value="overview" className="space-y-8 mt-0">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Membres" value={Math.max(1, members.length + 1)} icon={Users} />
            <StatCard label="Factures" value={invoices.length} icon={Receipt} />
            <StatCard
              label="Impayé"
              value={`${unpaidAmount.toFixed(0)} €`}
              icon={Bell}
              tone={unpaidAmount > 0 ? 'amber' : undefined}
            />
            <StatCard
              label="En retard"
              value={overdueCount}
              icon={AlertTriangle}
              tone={overdueCount > 0 ? 'red' : undefined}
            />
          </div>

          {/* Actions */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Actions rapides</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ActionCard label="Expédier" icon={Truck} to="/expedier" />
              <ActionCard label="Recevoir" icon={Inbox} to="/acheter" />
              <ActionCard label="Sourcing" icon={PackageSearch} to="/acheter" />
              <ActionCard label="Rapports" icon={BarChart3} to="#" disabled />
            </div>
          </div>

          {/* Chargé de compte (résumé visible sur l'aperçu aussi) */}
          <AccountManagerCard businessId={account.id} />
        </TabsContent>

        {/* DOSSIERS */}
        <TabsContent value="dossiers" className="mt-0">
          <DossiersSection businessId={account.id} />
        </TabsContent>

        {/* ÉQUIPE */}
        <TabsContent value="team" className="mt-0">
          <TeamSection businessId={account.id} isAdmin={isAdmin} />
        </TabsContent>

        {/* FACTURES */}
        <TabsContent value="invoices" className="mt-0">
          <InvoicesSection businessId={account.id} isAdmin={isAdmin} />
        </TabsContent>

        {/* CONTACT */}
        <TabsContent value="contact" className="mt-0 space-y-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Contact dédié</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Votre interlocuteur direct chez Yobbanté Business.
            </p>
          </div>
          <AccountManagerCard businessId={account.id} />

          <Card className="p-6">
            <h3 className="font-semibold mb-3">Administrateur du compte</h3>
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Nom · </span>{account.admin_full_name}</div>
              <div><span className="text-muted-foreground">Poste · </span>{account.admin_role}</div>
              <div><span className="text-muted-foreground">Email · </span>{account.admin_email}</div>
              <div><span className="text-muted-foreground">Téléphone · </span>{account.admin_phone}</div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: any; tone?: 'amber' | 'red' }) {
  const toneCls = tone === 'amber' ? 'text-amber-500' : tone === 'red' ? 'text-red-500' : '';
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs uppercase tracking-wider font-semibold">{label}</span>
        <Icon className={cn('w-4 h-4', toneCls)} />
      </div>
      <div className={cn('mt-2 text-3xl font-bold tracking-tight', toneCls)}>{value}</div>
    </Card>
  );
}

function ActionCard({ label, icon: Icon, to, disabled }: { label: string; icon: any; to: string; disabled?: boolean }) {
  return (
    <a
      href={disabled ? undefined : to}
      className={cn(
        'flex flex-col items-start gap-3 p-5 rounded-[var(--radius)] border border-border bg-card transition-all',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/60 hover:-translate-y-0.5'
      )}
    >
      <Icon className="w-6 h-6 text-primary" />
      <div>
        <div className="font-semibold">{label}</div>
        {disabled && <div className="text-xs text-muted-foreground mt-0.5">Bientôt</div>}
      </div>
    </a>
  );
}
