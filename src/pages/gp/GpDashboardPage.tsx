import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plane, Plus, User, Coins, Bell, LogOut, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

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

type Profile = {
  id: string;
  reference: string;
  prenom: string | null;
  nom: string | null;
  telephone_1: string;
  ville: string | null;
  photo_url: string | null;
  default_rate_per_kg: number | null;
  rates_per_city: Record<string, number> | null;
  gp_notes: string | null;
  wizard_step: number;
  profile_completed_at: string | null;
};

type Dashboard = { found: boolean; profile?: Profile; departures?: Departure[] };

function normalizeRef(raw: string | undefined): string {
  return String(raw ?? '').replace(/\D/g, '').padStart(4, '0').slice(-4);
}

async function callSave(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('gp-dashboard-save', { body: payload });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

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
    if (!loading && data && !data.found) {
      navigate(`/onboarding/GP${ref}`, { replace: true });
    }
  }, [loading, data, navigate, ref]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0E1A]">
        <Loader2 className="w-6 h-6 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (!data?.found || !data.profile) return null;

  const showWizard = !data.profile.profile_completed_at;

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white">
      <Header profile={data.profile} />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {showWizard ? (
          <Wizard profile={data.profile} departures={data.departures ?? []} onChange={refresh} />
        ) : (
          <Dashboard profile={data.profile} departures={data.departures ?? []} onChange={refresh} />
        )}
      </main>
    </div>
  );
}

function Header({ profile }: { profile: Profile }) {
  const name = `${profile.prenom ?? ''} ${profile.nom ?? ''}`.trim() || 'GP Konnekt';
  return (
    <header className="border-b border-white/10 bg-[#0A0E1A]/95 sticky top-0 z-40">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {profile.photo_url ? (
            <img src={profile.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-yellow-400 text-black flex items-center justify-center font-bold">
              {(profile.prenom?.[0] ?? 'G').toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-sm font-semibold">{name}</div>
            <div className="text-[11px] text-white/60">GP{profile.reference} · {profile.telephone_1}</div>
          </div>
        </div>
        <Badge variant="outline" className="border-yellow-400/40 text-yellow-300">Konnekt</Badge>
      </div>
    </header>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Wizard
// ────────────────────────────────────────────────────────────────────────────

function Wizard({
  profile, departures, onChange,
}: { profile: Profile; departures: Departure[]; onChange: () => void | Promise<void> }) {
  const [step, setStep] = useState<number>(Math.max(1, profile.wizard_step || 1));

  useEffect(() => {
    callSave({ op: 'update_profile', ref: profile.reference, wizard_step: step }).catch(() => {});
  }, [step, profile.reference]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-white/60">
        <StepDot n={1} active={step >= 1} label="Profil" />
        <div className="flex-1 h-px bg-white/10" />
        <StepDot n={2} active={step >= 2} label="Départs" />
        <div className="flex-1 h-px bg-white/10" />
        <StepDot n={3} active={step >= 3} label="Tarifs" />
      </div>

      {step === 1 && <StepProfile profile={profile} onNext={() => setStep(2)} onChange={onChange} />}
      {step === 2 && (
        <StepDepartures
          profile={profile}
          departures={departures}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          onChange={onChange}
        />
      )}
      {step === 3 && (
        <StepRates
          profile={profile}
          onBack={() => setStep(2)}
          onDone={async () => {
            await callSave({ op: 'update_profile', ref: profile.reference, profile_completed: true });
            toast.success('Profil complété 🚀');
            onChange();
          }}
        />
      )}
    </div>
  );
}

function StepDot({ n, active, label }: { n: number; active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold ${active ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/40'}`}>{n}</div>
      <span className={active ? 'text-white' : ''}>{label}</span>
    </div>
  );
}

function StepProfile({ profile, onNext, onChange }: { profile: Profile; onNext: () => void; onChange: () => void | Promise<void> }) {
  const [prenom, setPrenom] = useState(profile.prenom ?? '');
  const [nom, setNom] = useState(profile.nom ?? '');
  const [ville, setVille] = useState(profile.ville ?? '');
  const [photoUrl, setPhotoUrl] = useState(profile.photo_url ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!prenom.trim() || !nom.trim() || !ville.trim()) {
      toast.error('Prénom, nom et ville sont obligatoires'); return;
    }
    setSaving(true);
    try {
      await callSave({
        op: 'update_profile', ref: profile.reference,
        prenom, nom, ville, photo_url: photoUrl || undefined, wizard_step: 2,
      });
      await onChange();
      onNext();
    } catch (e: any) { toast.error(e?.message ?? 'Erreur'); }
    finally { setSaving(false); }
  };

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><User className="w-4 h-4" /> Votre profil</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Prénom</Label><Input value={prenom} onChange={e => setPrenom(e.target.value)} /></div>
          <div><Label>Nom</Label><Input value={nom} onChange={e => setNom(e.target.value)} /></div>
        </div>
        <div><Label>Ville de résidence principale</Label><Input value={ville} onChange={e => setVille(e.target.value)} placeholder="Dakar" /></div>
        <div><Label>Photo (URL, optionnel)</Label><Input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="https://…" /></div>
        <div><Label>Téléphone (confirmé)</Label><Input value={profile.telephone_1} readOnly className="opacity-70" /></div>
        <Button onClick={save} disabled={saving} className="w-full bg-yellow-400 text-black hover:bg-yellow-300">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continuer'}
        </Button>
      </CardContent>
    </Card>
  );
}

function DepartureForm({ profile, onCreated }: { profile: Profile; onCreated: () => void }) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [kg, setKg] = useState('');
  const [price, setPrice] = useState('');
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
      toast.success('Départ ajouté');
      setOrigin(''); setDestination(''); setDate(''); setKg(''); setPrice('');
      onCreated();
    } catch (e: any) { toast.error(e?.message ?? 'Erreur'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-3 p-4 rounded-lg border border-white/10 bg-white/5">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Ville départ</Label><Input value={origin} onChange={e => setOrigin(e.target.value)} placeholder="Dakar" /></div>
        <div><Label>Ville arrivée</Label><Input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Paris" /></div>
        <div><Label>Date départ</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><Label>Capacité (kg)</Label><Input type="number" value={kg} onChange={e => setKg(e.target.value)} placeholder="30" /></div>
        <div className="col-span-2"><Label>Tarif / kg (FCFA, optionnel)</Label><Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="6000" /></div>
      </div>
      <Button onClick={submit} disabled={saving} className="w-full bg-yellow-400 text-black hover:bg-yellow-300">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" />Ajouter ce départ</>}
      </Button>
    </div>
  );
}

function StepDepartures({
  profile, departures, onBack, onNext, onChange,
}: { profile: Profile; departures: Departure[]; onBack: () => void; onNext: () => void; onChange: () => void | Promise<void> }) {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Plane className="w-4 h-4" /> Mes départs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <DepartureForm profile={profile} onCreated={onChange} />
        {departures.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-white/60 uppercase tracking-wider">Départs enregistrés</div>
            {departures.map(d => (
              <DepartureRow key={d.id} d={d} ref_={profile.reference} onChange={onChange} />
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onBack}>Retour</Button>
          <Button className="flex-1 bg-yellow-400 text-black hover:bg-yellow-300" onClick={onNext}>Continuer</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DepartureRow({ d, ref_, onChange }: { d: Departure; ref_: string; onChange: () => void | Promise<void> }) {
  const cancel = async () => {
    if (!confirm('Annuler ce départ ?')) return;
    try { await callSave({ op: 'cancel_departure', ref: ref_, departure_id: d.id }); toast.success('Annulé'); onChange(); }
    catch (e: any) { toast.error(e?.message ?? 'Erreur'); }
  };
  return (
    <div className="flex items-center justify-between p-3 rounded border border-white/10">
      <div>
        <div className="text-sm font-medium">{d.origin_city} → {d.destination_city}</div>
        <div className="text-xs text-white/60">
          {new Date(d.departure_date).toLocaleDateString('fr-FR')} · {d.available_capacity_kg}/{d.total_capacity_kg} kg
          {d.price_override_xof ? ` · ${d.price_override_xof.toLocaleString()} FCFA/kg` : ''}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={d.status === 'active' ? 'default' : 'outline'} className="text-[10px]">{d.status}</Badge>
        {d.status === 'active' && (
          <Button size="icon" variant="ghost" onClick={cancel}><Trash2 className="w-4 h-4 text-red-400" /></Button>
        )}
      </div>
    </div>
  );
}

function StepRates({ profile, onBack, onDone }: { profile: Profile; onBack: () => void; onDone: () => Promise<void> }) {
  const [defaultRate, setDefaultRate] = useState<string>(profile.default_rate_per_kg ? String(profile.default_rate_per_kg) : '');
  const [notes, setNotes] = useState<string>(profile.gp_notes ?? '');
  const [routes, setRoutes] = useState<Array<{ key: string; price: string }>>(() => {
    const r = profile.rates_per_city ?? {};
    return Object.entries(r).map(([k, v]) => ({ key: k, price: String(v) }));
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const ratesObj: Record<string, number> = {};
      for (const r of routes) if (r.key.trim() && Number(r.price) > 0) ratesObj[r.key.trim()] = Number(r.price);
      await callSave({
        op: 'update_rates', ref: profile.reference,
        default_rate_per_kg: defaultRate ? Number(defaultRate) : null,
        rates_per_city: ratesObj,
        gp_notes: notes,
      });
      await onDone();
    } catch (e: any) { toast.error(e?.message ?? 'Erreur'); }
    finally { setSaving(false); }
  };

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Coins className="w-4 h-4" /> Mes tarifs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Tarif par défaut (FCFA/kg)</Label>
          <Input type="number" value={defaultRate} onChange={e => setDefaultRate(e.target.value)} placeholder="6000" />
        </div>
        <div className="space-y-2">
          <Label>Tarifs spéciaux par route</Label>
          {routes.map((r, i) => (
            <div key={i} className="flex gap-2">
              <Input value={r.key} onChange={e => setRoutes(rs => rs.map((x, j) => j === i ? { ...x, key: e.target.value } : x))} placeholder="Dakar-Paris" />
              <Input type="number" value={r.price} onChange={e => setRoutes(rs => rs.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} placeholder="7000" />
              <Button variant="ghost" size="icon" onClick={() => setRoutes(rs => rs.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRoutes(rs => [...rs, { key: '', price: '' }])}>
            <Plus className="w-4 h-4 mr-1" /> Ajouter une route
          </Button>
        </div>
        <div>
          <Label>Notes / conditions</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex : pas de médicaments, pas de liquides…" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onBack}>Retour</Button>
          <Button className="flex-1 bg-yellow-400 text-black hover:bg-yellow-300" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Terminer'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Dashboard (after wizard)
// ────────────────────────────────────────────────────────────────────────────

function Dashboard({
  profile, departures, onChange,
}: { profile: Profile; departures: Departure[]; onChange: () => void | Promise<void> }) {
  const [showAdd, setShowAdd] = useState(false);
  const active = departures.filter(d => d.status === 'active');
  const past = departures.filter(d => d.status !== 'active');

  return (
    <div className="space-y-4">
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base"><Plane className="w-4 h-4" /> Mes départs actifs</CardTitle>
          <Button size="sm" className="bg-yellow-400 text-black hover:bg-yellow-300" onClick={() => setShowAdd(s => !s)}>
            <Plus className="w-4 h-4 mr-1" /> Ajouter un départ
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {showAdd && <DepartureForm profile={profile} onCreated={() => { setShowAdd(false); onChange(); }} />}
          {active.length === 0 && !showAdd && <div className="text-sm text-white/60">Aucun départ actif.</div>}
          {active.map(d => <DepartureRow key={d.id} d={d} ref_={profile.reference} onChange={onChange} />)}
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Bell className="w-4 h-4" /> Mes missions Yobbanté</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-white/60">
            Les missions Yobbanté en cours apparaîtront ici. Connecté en tant que GP{profile.reference}.
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Coins className="w-4 h-4" /> Historique paiements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-white/60">À venir.</div>
        </CardContent>
      </Card>

      {past.length > 0 && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader><CardTitle className="text-sm text-white/70">Historique départs</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {past.map(d => <DepartureRow key={d.id} d={d} ref_={profile.reference} onChange={onChange} />)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
