import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { computeQuote, fmtEur, loadDraft } from '@/lib/quote';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const STEPS = ['Devis', 'Coordonnées', 'Paiement', 'Confirmation'];

export default function DevisConfirmerPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [draft] = useState(() => loadDraft());
  const [step] = useState(1); // active = Coordonnées
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Yobbanté · Confirmation';
    if (!draft) navigate('/', { replace: true });
  }, [draft, navigate]);

  const result = useMemo(() => draft ? computeQuote(draft.input) : null, [draft]);
  const opt = result?.options.find(o => o.key === draft?.selected) ?? result?.options[0];

  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [recName, setRecName] = useState('');
  const [recAddr, setRecAddr] = useState('');
  const [recCity, setRecCity] = useState('');
  const [recZip, setRecZip] = useState('');
  const [recCountry, setRecCountry] = useState('France');
  const [desc, setDesc] = useState('');
  const [declared, setDeclared] = useState('');

  if (!draft || !result || !opt) return null;
  const { input } = draft;

  const onPay = async () => {
    if (!senderName.trim() || !senderPhone.trim() || !senderEmail.trim() || !recName.trim() || !recAddr.trim()) {
      toast.error('Veuillez remplir les champs obligatoires (expéditeur et destinataire).');
      return;
    }
    if (authLoading) return;
    if (!user) {
      // Force login — keep the draft so it can resume
      toast.message('Connexion requise pour confirmer votre envoi.');
      navigate(`/auth?next=${encodeURIComponent('/devis/confirmer')}`);
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-shipment-from-quote', {
        body: {
          origin: input.origin,
          destination: input.destination,
          weight_kg: input.weightKg,
          transport_mode: input.mode,
          goods_type: input.type,
          selected_option: opt.key,
          total_eur: opt.priceEur,
          departure_date: opt.departure,
          sender: { name: senderName, phone: senderPhone, email: senderEmail },
          receiver: { name: recName, address: recAddr, city: recCity, zip: recZip, country: recCountry },
          description: desc,
          declared_value_eur: declared ? Number(declared) : undefined,
        },
      });
      if (error) throw new Error(error.message || 'Erreur serveur');
      const tn = (data as any)?.tracking_number || (data as any)?.id;
      if (!tn) throw new Error('Numéro de suivi manquant');
      toast.success('Envoi confirmé · paiement à venir');
      navigate(`/track/${tn}`);
    } catch (e) {
      toast.error((e as Error).message || 'Échec de la création de l\'envoi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav />

      {/* Stepper */}
      <div className="px-6 py-4" style={{ borderBottom: '0.5px solid hsl(var(--color-border-tertiary))' }}>
        <ol className="flex items-center gap-2 max-w-3xl mx-auto">
          {STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={label} className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-medium"
                    style={{
                      background: done ? '#1D9E75' : active ? 'hsl(var(--foreground))' : 'transparent',
                      color: done || active ? '#fff' : 'hsl(var(--text-tertiary))',
                      border: done || active ? 'none' : '0.5px solid hsl(var(--color-border-tertiary))',
                    }}
                  >
                    {done ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : i + 1}
                  </div>
                  <div
                    className="text-[12px] mt-1"
                    style={{
                      color: done ? '#1D9E75' : active ? 'hsl(var(--foreground))' : 'hsl(var(--text-tertiary))',
                      fontWeight: active ? 500 : 400,
                    }}
                  >
                    {label}
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <span className="w-6 self-start mt-2.5"
                    style={{ borderTop: '0.5px solid hsl(var(--color-border-tertiary))' }} />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* 2 columns */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4">
        {/* LEFT */}
        <div className="space-y-3">
          <FormSection title="Expéditeur">
            <FormField label="Nom complet *">
              <input className="input-base w-full" value={senderName} onChange={e => setSenderName(e.target.value)} />
            </FormField>
            <FormField label="Téléphone / WhatsApp *">
              <input className="input-base w-full" placeholder="+221 …" value={senderPhone} onChange={e => setSenderPhone(e.target.value)} />
            </FormField>
            <FormField label="Email *">
              <input type="email" className="input-base w-full" placeholder="votre@email.com" value={senderEmail} onChange={e => setSenderEmail(e.target.value)} />
            </FormField>
          </FormSection>

          <FormSection title="Destinataire">
            <FormField label="Nom complet *">
              <input className="input-base w-full" value={recName} onChange={e => setRecName(e.target.value)} />
            </FormField>
            <FormField label="Adresse complète *">
              <input className="input-base w-full" placeholder="Rue, numéro…" value={recAddr} onChange={e => setRecAddr(e.target.value)} />
            </FormField>
            <div className="grid grid-cols-2 gap-2.5">
              <FormField label="Ville">
                <input className="input-base w-full" value={recCity} onChange={e => setRecCity(e.target.value)} />
              </FormField>
              <FormField label="Code postal">
                <input className="input-base w-full" value={recZip} onChange={e => setRecZip(e.target.value)} />
              </FormField>
            </div>
            <FormField label="Pays">
              <select className="input-base w-full" value={recCountry} onChange={e => setRecCountry(e.target.value)}>
                {['France', 'Sénégal', 'Belgique', 'USA', 'Maroc', 'Côte d\'Ivoire', 'Autre'].map(c =>
                  <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
          </FormSection>

          <FormSection title="Détails colis">
            <FormField label="Description">
              <input className="input-base w-full" value={desc} onChange={e => setDesc(e.target.value)} />
            </FormField>
            <div className="grid grid-cols-2 gap-2.5">
              <FormField label="Type de marchandise">
                <input className="input-base w-full" defaultValue={input.type} disabled />
              </FormField>
              <FormField label="Valeur déclarée (€)">
                <input type="number" className="input-base w-full" value={declared} onChange={e => setDeclared(e.target.value)} />
              </FormField>
            </div>
          </FormSection>
        </div>

        {/* RIGHT — recap */}
        <aside
          className="self-start md:sticky md:top-20 rounded-[12px] p-4"
          style={{ background: 'hsl(var(--background-surface))', border: '0.5px solid hsl(var(--color-border-tertiary))' }}
        >
          <div className="text-label mb-3.5">Récapitulatif</div>
          <Row k="Trajet" v={`${input.origin} → ${input.destination}`} />
          <Row k="Option" v={opt.label} />
          <Row k="Poids taxable" v={`${result.taxableWeight} kg`} />
          <Row k="Mode" v={labelMode(input.mode)} />
          <Row k="Départ" v={opt.departure.replace('Départ ', '')} />

          <Divider />
          <Row k="Sous-total" v={fmtEur(Math.round(opt.priceEur * 0.82))} />
          <Row k="Dédouanement" v="Inclus" />
          <Row k="Assurance" v="Incluse" />

          <Divider />
          <div className="flex justify-between items-center mb-4" style={{ fontSize: 16, fontWeight: 500 }}>
            <span>Total</span>
            <span>{fmtEur(opt.priceEur)}</span>
          </div>

          <button onClick={onPay} disabled={submitting} className="btn-cta w-full mb-2"
            style={{ padding: '12px 20px', fontSize: 14 }}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Payer {fmtEur(opt.priceEur)} →</>}
          </button>
          <p className="text-[11px] text-center" style={{ color: 'hsl(var(--text-tertiary))' }}>
            Paiement sécurisé · SSL
          </p>
          <p className="text-[12px] text-center mt-1.5" style={{ color: 'hsl(var(--text-tertiary))' }}>
            Wave · Orange Money · Visa · Mastercard
          </p>
        </aside>
      </main>

      <PublicFooter />
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-card">
      <div className="text-label mb-3">{title}</div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-label block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 mb-2">
      <span className="text-[13px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{k}</span>
      <span className="text-[13px] text-right">{v}</span>
    </div>
  );
}
function Divider() {
  return <div className="my-3" style={{ borderTop: '0.5px solid hsl(var(--color-border-tertiary))' }} />;
}
function labelMode(m: string) {
  return ({ air: 'Aérien', sea: 'Maritime', road: 'Route' } as Record<string, string>)[m] ?? m;
}
