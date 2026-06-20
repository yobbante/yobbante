import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Loader2, Plane, Plus, User, Coins, Package, Trash2, Pencil, ChevronLeft, ChevronRight, X, LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import logoYobbante from '@/assets/logo-yobbante.png';
import { hasValidGpSessionFor, clearGpSession } from '@/lib/gpSession';

// ── Palette Yobbanté ────────────────────────────────────────────────────────
const BG = '#0A0F1E';
const GOLD = '#D4AF37';
const SURFACE = '#121828';
const BORDER = 'rgba(212,175,55,0.18)';

// ── Types ──────────────────────────────────────────────────────────────────
type Departure = {
  id: string;
  origin_city: string;
  destination_city: string;
  departure_date: string;
  total_capacity_kg: number;
  available_capacity_kg: number;
  price_override_xof: number | null;
  status: string;
  short_ref: string | null;
};

type Mission = {
  id: string;
  tracking_id: string;
  status: string;
  destination_city: string | null;
  destination_country: string | null;
  actual_weight_kg: number | null;
  estimated_weight: number | null;
  gp_amount: number | null;
  gp_paid: boolean | null;
  paid_at: string | null;
  created_at: string;
};

type Payment = {
  id: string;
  tracking_id: string;
  gp_amount: number | null;
  gp_paid: boolean | null;
  gp_paid_at: string | null;
  gp_payment_method: string | null;
  status: string;
  created_at: string;
};

type Profile = {
  id: string;
  reference: string;
  prenom: string | null;
  nom: string | null;
  telephone_1: string;
  whatsapp: string | null;
  ville: string | null;
  default_rate_per_kg: number | null;
  beta_tarif_defaut: number | null;
  beta_notes_conditions: string | null;
  beta_wizard_completed_at: string | null;
  whatsapp_confirmed_at: string | null;
  konnekt_registered: boolean;
  actif: boolean;
  last_bot_activity_at: string | null;
};

type Dashboard = {
  found: boolean;
  profile?: Profile;
  departures?: Departure[];
  missions?: Mission[];
  payments?: Payment[];
};

function normalizeRef(raw: string | undefined): string {
  return String(raw ?? '').replace(/\D/g, '').padStart(4, '0').slice(-4);
}

async function callSave(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('gp-dashboard-save', { body: payload });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────
export default function GpDashboardPage() {
  const { ref: rawRef } = useParams<{ ref: string }>();
  const ref = useMemo(() => normalizeRef(rawRef), [rawRef]);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Dashboard | null>(null);

  const refresh = async () => {
    const { data: d, error } = await supabase.rpc('get_gp_dashboard', { _ref: ref });
    if (error) { toast.error(error.message); return; }
    setData(d as unknown as Dashboard);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { await refresh(); } finally { setLoading(false); }
    })();
     
  }, [ref]);

  useEffect(() => {
    if (!loading && data && !data.found) navigate('/', { replace: true });
  }, [loading, data, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }
  if (!data?.found || !data.profile) return null;

  const p = data.profile;
  const botActive = !!p.last_bot_activity_at || !!p.whatsapp_confirmed_at;

  // GP trouvé mais bot pas actif
  if (!botActive) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: BG }}>
        <div className="max-w-md w-full rounded-2xl p-8 text-center space-y-5" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <img src={logoYobbante} alt="Yobbanté" className="h-10 mx-auto" />
          <h1 className="text-2xl font-bold text-white">Finalisez votre inscription d'abord</h1>
          <p className="text-sm text-white/70">
            Bonjour {p.prenom ?? ''}, votre compte GP{p.reference} est créé mais pas encore activé sur WhatsApp.
          </p>
          <Link
            to={`/rejoindre-konnekt?ref=GP${p.reference}`}
            className="inline-block w-full rounded-xl py-3 font-semibold transition"
            style={{ background: GOLD, color: BG }}
          >
            Terminer l'inscription →
          </Link>
        </div>
      </div>
    );
  }

  const needsWizard = !p.beta_wizard_completed_at && (!p.ville || !p.beta_tarif_defaut);

  return (
    <div className="min-h-screen" style={{ background: BG, color: 'white' }}>
      <BetaBanner />
      <Header profile={p} />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {needsWizard ? (
          <Wizard profile={p} onChange={refresh} />
        ) : (
          <Dashboard data={data} onChange={refresh} />
        )}
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Bandeau beta + Header
// ────────────────────────────────────────────────────────────────────────────
function BetaBanner() {
  return (
    <div className="text-center text-xs sm:text-sm py-2 px-3 font-medium" style={{ background: GOLD, color: BG }}>
      🚧 Espace beta — Vos données seront conservées et migrées automatiquement.
    </div>
  );
}

function Header({ profile }: { profile: Profile }) {
  const name = `${profile.prenom ?? ''} ${profile.nom ?? ''}`.trim() || 'Mon espace GP';
  return (
    <header className="border-b sticky top-0 z-30" style={{ background: BG, borderColor: BORDER }}>
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <img src={logoYobbante} alt="Yobbanté" className="h-7" />
        <div className="text-right">
          <div className="text-sm font-semibold">{name}</div>
          <div className="text-[11px]" style={{ color: GOLD }}>GP{profile.reference}</div>
        </div>
      </div>
    </header>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Wizard (3 étapes)
// ────────────────────────────────────────────────────────────────────────────
function Wizard({ profile, onChange }: { profile: Profile; onChange: () => Promise<void> | void }) {
  const [step, setStep] = useState(1);
  return (
    <div className="space-y-4">
      <Stepper step={step} />
      {step === 1 && <StepProfile profile={profile} onNext={() => setStep(2)} onChange={onChange} />}
      {step === 2 && <StepDeparture profile={profile} onSkip={() => setStep(3)} onNext={() => setStep(3)} onChange={onChange} />}
      {step === 3 && <StepRates profile={profile} onBack={() => setStep(2)} onChange={onChange} />}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ['Profil', 'Départ', 'Tarifs'];
  return (
    <div className="flex items-center gap-2">
      {labels.map((l, i) => {
        const active = step >= i + 1;
        return (
          <div key={l} className="flex items-center gap-2 flex-1">
            <div
              className="w-7 h-7 rounded-full grid place-items-center text-xs font-bold"
              style={active ? { background: GOLD, color: BG } : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
            >{i + 1}</div>
            <span className="text-xs" style={{ color: active ? 'white' : 'rgba(255,255,255,0.4)' }}>{l}</span>
            {i < labels.length - 1 && <div className="flex-1 h-px" style={{ background: BORDER }} />}
          </div>
        );
      })}
    </div>
  );
}

function Card({ title, icon: Icon, children, action }: { title: string; icon: any; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="w-4 h-4" style={{ color: GOLD }} /> {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function GoldButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-full rounded-xl py-3 font-semibold transition disabled:opacity-50 ${props.className ?? ''}`}
      style={{ background: GOLD, color: BG }}
    >
      {children}
    </button>
  );
}

function StepProfile({ profile, onNext, onChange }: { profile: Profile; onNext: () => void; onChange: () => void | Promise<void> }) {
  const [prenom, setPrenom] = useState(profile.prenom ?? '');
  const [nom, setNom] = useState(profile.nom ?? '');
  const [ville, setVille] = useState(profile.ville ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!prenom.trim() || !nom.trim() || !ville.trim()) { toast.error('Tous les champs sont requis'); return; }
    setSaving(true);
    try {
      await callSave({ op: 'update_profile', ref: profile.reference, prenom, nom, ville, wizard_step: 2 });
      await onChange();
      onNext();
    } catch (e: any) { toast.error(e?.message ?? 'Erreur'); } finally { setSaving(false); }
  };

  return (
    <Card title="Mon profil" icon={User}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Prénom</Label><Input value={prenom} onChange={e => setPrenom(e.target.value)} /></div>
          <div><Label>Nom</Label><Input value={nom} onChange={e => setNom(e.target.value)} /></div>
        </div>
        <div><Label>Ville de résidence principale</Label><Input value={ville} onChange={e => setVille(e.target.value)} placeholder="Dakar" /></div>
        <div>
          <Label>Téléphone</Label>
          <Input value={profile.telephone_1} readOnly className="opacity-70 cursor-not-allowed" />
        </div>
        <GoldButton onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : <>Continuer <ChevronRight className="inline w-4 h-4" /></>}
        </GoldButton>
      </div>
    </Card>
  );
}

function StepDeparture({ profile, onSkip, onNext, onChange }: { profile: Profile; onSkip: () => void; onNext: () => void; onChange: () => void | Promise<void> }) {
  const [origin, setOrigin] = useState(profile.ville ?? '');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [kg, setKg] = useState('');
  const [price, setPrice] = useState(profile.beta_tarif_defaut ? String(profile.beta_tarif_defaut) : '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!origin || !destination || !date || !kg) { toast.error('Tous les champs sont requis'); return; }
    setSaving(true);
    try {
      await callSave({
        op: 'add_departure', ref: profile.reference,
        origin_city: origin, destination_city: destination, departure_date: date,
        total_capacity_kg: Number(kg),
        price_override_xof: price ? Number(price) : null,
      });
      toast.success('Départ enregistré');
      await onChange();
      onNext();
    } catch (e: any) { toast.error(e?.message ?? 'Erreur'); } finally { setSaving(false); }
  };

  return (
    <Card title="Mon premier départ" icon={Plane}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Ville départ</Label><Input value={origin} onChange={e => setOrigin(e.target.value)} placeholder="Dakar" /></div>
          <div><Label>Ville arrivée</Label><Input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Paris" /></div>
          <div><Label>Date de départ</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><Label>Capacité (kg)</Label><Input type="number" value={kg} onChange={e => setKg(e.target.value)} placeholder="30" /></div>
          <div className="col-span-2"><Label>Tarif / kg (FCFA)</Label><Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="6000" /></div>
        </div>
        <GoldButton onClick={submit} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Ajouter ce départ'}
        </GoldButton>
        <button onClick={onSkip} className="w-full text-sm text-white/60 hover:text-white py-2">
          Passer cette étape →
        </button>
      </div>
    </Card>
  );
}

function StepRates({ profile, onBack, onChange }: { profile: Profile; onBack: () => void; onChange: () => Promise<void> | void }) {
  const [tarif, setTarif] = useState<string>(profile.beta_tarif_defaut ? String(profile.beta_tarif_defaut) : '');
  const [notes, setNotes] = useState<string>(profile.beta_notes_conditions ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!tarif || Number(tarif) <= 0) { toast.error('Indiquez votre tarif par défaut'); return; }
    setSaving(true);
    try {
      await callSave({
        op: 'update_profile', ref: profile.reference,
        beta_tarif_defaut: Number(tarif),
        beta_notes_conditions: notes,
        beta_wizard_completed: true,
      });
      toast.success('Bienvenue sur votre espace GP 🚀');
      await onChange();
    } catch (e: any) { toast.error(e?.message ?? 'Erreur'); } finally { setSaving(false); }
  };

  return (
    <Card title="Mes tarifs" icon={Coins}>
      <div className="space-y-3">
        <div>
          <Label>Tarif par défaut (FCFA / kg)</Label>
          <Input type="number" value={tarif} onChange={e => setTarif(e.target.value)} placeholder="6000" />
        </div>
        <div>
          <Label>Notes et conditions</Label>
          <Textarea
            rows={4}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Pas de médicaments, pas de bijoux, dépôt 48h avant"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} className="flex-1 rounded-xl py-3 font-medium border" style={{ borderColor: BORDER, color: 'white' }}>
            <ChevronLeft className="inline w-4 h-4" /> Retour
          </button>
          <GoldButton onClick={submit} disabled={saving} className="flex-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Accéder à mon espace →'}
          </GoldButton>
        </div>
      </div>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Dashboard
// ────────────────────────────────────────────────────────────────────────────
function Dashboard({ data, onChange }: { data: Dashboard; onChange: () => Promise<void> | void }) {
  const profile = data.profile!;
  return (
    <div className="space-y-6">
      <SectionDepartures profile={profile} departures={data.departures ?? []} onChange={onChange} />
      <SectionMissions missions={data.missions ?? []} />
      <SectionPayments payments={data.payments ?? []} />
      <SectionProfile profile={profile} onChange={onChange} />
    </div>
  );
}

// ── 1. Mes départs ─────────────────────────────────────────────────────────
function SectionDepartures({ profile, departures, onChange }: { profile: Profile; departures: Departure[]; onChange: () => Promise<void> | void }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Departure | null>(null);
  const upcoming = [...departures].sort((a, b) => a.departure_date.localeCompare(b.departure_date));

  return (
    <Card
      title="Mes départs"
      icon={Plane}
      action={
        <button
          onClick={() => setAdding(true)}
          className="text-xs font-semibold rounded-lg px-3 py-1.5"
          style={{ background: GOLD, color: BG }}
        >
          <Plus className="inline w-3.5 h-3.5 mr-1" /> Ajouter
        </button>
      }
    >
      {upcoming.length === 0 && !adding && (
        <div className="text-sm text-white/60">Aucun départ. Ajoutez votre premier départ.</div>
      )}
      <div className="space-y-2">
        {upcoming.map(d => (
          <div key={d.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}` }}>
            <div>
              <div className="text-sm font-semibold">{d.origin_city} → {d.destination_city}</div>
              <div className="text-xs text-white/60">
                {new Date(d.departure_date).toLocaleDateString('fr-FR')} · {d.total_capacity_kg} kg
                {d.price_override_xof ? ` · ${d.price_override_xof.toLocaleString()} FCFA/kg` : ''}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-2 rounded hover:bg-white/5" onClick={() => setEditing(d)}>
                <Pencil className="w-4 h-4" style={{ color: GOLD }} />
              </button>
              <button
                className="p-2 rounded hover:bg-white/5"
                onClick={async () => {
                  if (!confirm('Supprimer ce départ ?')) return;
                  try { await callSave({ op: 'delete_departure', ref: profile.reference, departure_id: d.id }); toast.success('Supprimé'); onChange(); }
                  catch (e: any) { toast.error(e?.message ?? 'Erreur'); }
                }}
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {adding && <DepartureModal profile={profile} onClose={() => setAdding(false)} onSaved={onChange} />}
      {editing && <DepartureModal profile={profile} initial={editing} onClose={() => setEditing(null)} onSaved={onChange} />}
    </Card>
  );
}

function DepartureModal({ profile, initial, onClose, onSaved }: { profile: Profile; initial?: Departure; onClose: () => void; onSaved: () => Promise<void> | void }) {
  const [origin, setOrigin] = useState(initial?.origin_city ?? profile.ville ?? '');
  const [destination, setDestination] = useState(initial?.destination_city ?? '');
  const [date, setDate] = useState(initial?.departure_date ?? '');
  const [kg, setKg] = useState(initial?.total_capacity_kg ? String(initial.total_capacity_kg) : '');
  const [price, setPrice] = useState(initial?.price_override_xof ? String(initial.price_override_xof) : (profile.beta_tarif_defaut ? String(profile.beta_tarif_defaut) : ''));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!origin || !destination || !date || !kg) { toast.error('Tous les champs sont requis'); return; }
    setSaving(true);
    try {
      if (initial) {
        await callSave({
          op: 'update_departure', ref: profile.reference, departure_id: initial.id,
          origin_city: origin, destination_city: destination, departure_date: date,
          total_capacity_kg: Number(kg),
          price_override_xof: price ? Number(price) : null,
        });
        toast.success('Départ mis à jour');
      } else {
        await callSave({
          op: 'add_departure', ref: profile.reference,
          origin_city: origin, destination_city: destination, departure_date: date,
          total_capacity_kg: Number(kg),
          price_override_xof: price ? Number(price) : null,
        });
        toast.success('Départ ajouté');
      }
      await onSaved();
      onClose();
    } catch (e: any) { toast.error(e?.message ?? 'Erreur'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-2xl p-5 space-y-3" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between">
          <div className="font-semibold">{initial ? 'Modifier le départ' : 'Nouveau départ'}</div>
          <button onClick={onClose}><X className="w-5 h-5 text-white/60" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Ville départ</Label><Input value={origin} onChange={e => setOrigin(e.target.value)} /></div>
          <div><Label>Ville arrivée</Label><Input value={destination} onChange={e => setDestination(e.target.value)} /></div>
          <div><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><Label>Capacité (kg)</Label><Input type="number" value={kg} onChange={e => setKg(e.target.value)} /></div>
          <div className="col-span-2"><Label>Tarif / kg (FCFA)</Label><Input type="number" value={price} onChange={e => setPrice(e.target.value)} /></div>
        </div>
        <GoldButton onClick={submit} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Enregistrer'}
        </GoldButton>
      </div>
    </div>
  );
}

// ── 2. Mes missions ────────────────────────────────────────────────────────
function SectionMissions({ missions }: { missions: Mission[] }) {
  return (
    <Card title="Mes missions" icon={Package}>
      {missions.length === 0 && <div className="text-sm text-white/60">Aucune mission en cours.</div>}
      <div className="space-y-2">
        {missions.map(m => (
          <div key={m.id} className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{m.tracking_id}</div>
              <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ background: GOLD, color: BG }}>{m.status}</span>
            </div>
            <div className="text-xs text-white/60 mt-1">
              → {m.destination_city ?? m.destination_country ?? '—'}
              {m.actual_weight_kg ? ` · ${m.actual_weight_kg} kg` : m.estimated_weight ? ` · ~${m.estimated_weight} kg` : ''}
              {m.gp_amount ? ` · ${m.gp_amount.toLocaleString()} FCFA` : ''}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── 3. Mes paiements ───────────────────────────────────────────────────────
function SectionPayments({ payments }: { payments: Payment[] }) {
  const pending = payments.filter(p => !p.gp_paid).reduce((s, p) => s + (p.gp_amount ?? 0), 0);
  const paid = payments.filter(p => p.gp_paid);
  const unpaid = payments.filter(p => !p.gp_paid);
  return (
    <Card title="Mes paiements" icon={Coins}>
      {pending > 0 && (
        <div className="mb-3 rounded-lg p-3 text-center" style={{ background: GOLD, color: BG }}>
          <div className="text-xs font-semibold">En attente de paiement</div>
          <div className="text-2xl font-bold">{pending.toLocaleString()} FCFA</div>
        </div>
      )}
      {payments.length === 0 && <div className="text-sm text-white/60">Aucun paiement pour le moment.</div>}
      {unpaid.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <div className="text-[11px] uppercase tracking-wider text-white/40">En attente</div>
          {unpaid.map(p => <PaymentRow key={p.id} p={p} />)}
        </div>
      )}
      {paid.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wider text-white/40">Reçus</div>
          {paid.map(p => <PaymentRow key={p.id} p={p} />)}
        </div>
      )}
    </Card>
  );
}

function PaymentRow({ p }: { p: Payment }) {
  return (
    <div className="flex items-center justify-between p-2 rounded text-sm" style={{ background: 'rgba(255,255,255,0.03)' }}>
      <div>
        <div className="font-medium">{p.tracking_id}</div>
        <div className="text-[11px] text-white/50">
          {p.gp_paid_at ? `Reçu le ${new Date(p.gp_paid_at).toLocaleDateString('fr-FR')}` : `Créé le ${new Date(p.created_at).toLocaleDateString('fr-FR')}`}
          {p.gp_payment_method ? ` · ${p.gp_payment_method}` : ''}
        </div>
      </div>
      <div className="font-bold" style={{ color: p.gp_paid ? GOLD : 'white' }}>
        {(p.gp_amount ?? 0).toLocaleString()} FCFA
      </div>
    </div>
  );
}

// ── 4. Mon profil ──────────────────────────────────────────────────────────
function SectionProfile({ profile, onChange }: { profile: Profile; onChange: () => Promise<void> | void }) {
  const [ville, setVille] = useState(profile.ville ?? '');
  const [tarif, setTarif] = useState<string>(profile.beta_tarif_defaut ? String(profile.beta_tarif_defaut) : '');
  const [notes, setNotes] = useState<string>(profile.beta_notes_conditions ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await callSave({
        op: 'update_profile', ref: profile.reference,
        ville,
        beta_tarif_defaut: tarif ? Number(tarif) : null,
        beta_notes_conditions: notes,
      });
      toast.success('Profil mis à jour');
      await onChange();
    } catch (e: any) { toast.error(e?.message ?? 'Erreur'); } finally { setSaving(false); }
  };

  return (
    <Card title="Mon profil" icon={User}>
      <div className="space-y-3">
        <div><Label>Ville de résidence</Label><Input value={ville} onChange={e => setVille(e.target.value)} /></div>
        <div><Label>Tarif par défaut (FCFA / kg)</Label><Input type="number" value={tarif} onChange={e => setTarif(e.target.value)} /></div>
        <div><Label>Notes et conditions</Label><Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        <GoldButton onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Enregistrer'}
        </GoldButton>
      </div>
    </Card>
  );
}
