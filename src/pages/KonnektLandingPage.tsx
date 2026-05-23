import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package, MessageCircle, Wallet, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * KONNEKT — Landing + onboarding beta GP.
 * Identité visuelle : bleu nuit #1A1A2E + jaune Yobbanté #F5C518.
 * Mobile-first.
 */

const KONNEKT_BG = '#1A1A2E';
const KONNEKT_CARD = '#16213E';
const KONNEKT_ACCENT = '#F5C518';

const VILLES = ['Dakar', 'Paris', 'Lyon', 'Marseille', 'New York', 'Montréal', 'Dubai', 'Autre'];
const SOURCES = ['WhatsApp', 'Instagram', 'Bouche à oreille', 'Yobbanté.com', 'Autre'];
const FREQUENCES = [
  { id: 'hebdomadaire', label: 'Hebdomadaire' },
  { id: 'mensuel', label: 'Mensuel' },
  { id: 'occasionnel', label: 'Occasionnel' },
] as const;

type Step = 'landing' | 'confirmation';

export default function KonnektLandingPage() {
  const [params] = useSearchParams();
  const refFromUrl = (params.get('ref') || '').trim();

  const [step, setStep] = useState<Step>('landing');
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ prenom: string; reference?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alreadyMsg, setAlreadyMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    prenom: '',
    nom: '',
    telephone: '',
    ville: '',
    villes_desservies: [] as string[],
    frequence: 'mensuel' as typeof FREQUENCES[number]['id'],
    source_decouverte: '',
    ref_parrainage: refFromUrl,
  });

  useEffect(() => {
    document.title = 'Konnekt · Plateforme transporteurs Yobbanté';
    if (refFromUrl) setForm(f => ({ ...f, ref_parrainage: refFromUrl }));
  }, [refFromUrl]);

  useEffect(() => {
    if (window.location.hash === '#inscription') {
      setTimeout(() => document.getElementById('inscription')?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, []);

  const canSubmit = useMemo(() =>
    form.prenom.trim().length >= 2 &&
    form.nom.trim().length >= 2 &&
    form.telephone.trim().length >= 8 &&
    form.ville &&
    form.villes_desservies.length > 0 &&
    !submitting,
  [form, submitting]);

  const toggleVille = (v: string) => {
    setForm(f => ({
      ...f,
      villes_desservies: f.villes_desservies.includes(v)
        ? f.villes_desservies.filter(x => x !== v)
        : [...f.villes_desservies, v],
    }));
  };

  const submit = async () => {
    setError(null);
    setAlreadyMsg(null);
    setSubmitting(true);
    try {
      const tel = form.telephone.trim().replace(/\s+/g, '');
      const phone = tel.startsWith('+') ? tel : (tel.length === 9 ? `+221${tel}` : `+${tel}`);
      const { data, error: invErr } = await supabase.functions.invoke('konnekt-beta-signup', {
        body: { ...form, telephone: phone },
      });
      if (invErr) throw invErr;
      const r = data as { ok?: boolean; already_registered?: boolean; message?: string; prenom?: string; reference?: string };
      if (r?.already_registered) {
        setAlreadyMsg(r.message || 'Vous etes deja partenaire Yobbante.');
        return;
      }
      if (!r?.ok) {
        setError('Une erreur est survenue. Reessayez ou ecrivez-nous sur WhatsApp.');
        return;
      }
      setConfirmation({ prenom: r.prenom || form.prenom, reference: r.reference });
      setStep('confirmation');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      console.error(e);
      setError('Impossible de transmettre votre demande. Verifiez votre connexion.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen text-white" style={{ background: KONNEKT_BG }}>
      <KonnektHeader />
      {step === 'confirmation' && confirmation ? (
        <ConfirmationView prenom={confirmation.prenom} onBack={() => { setStep('landing'); setConfirmation(null); }} />
      ) : (
        <>
          <Hero onJoinClick={() => document.getElementById('inscription')?.scrollIntoView({ behavior: 'smooth' })} />
          <Avantages />
          <CommentCaMarche />
          <InscriptionForm
            form={form}
            setForm={setForm}
            toggleVille={toggleVille}
            canSubmit={canSubmit}
            submitting={submitting}
            onSubmit={submit}
            error={error}
            alreadyMsg={alreadyMsg}
          />
        </>
      )}
      <Footer />
    </div>
  );
}

function KonnektHeader() {
  return (
    <header className="px-5 py-5 sm:px-8 sm:py-6 max-w-5xl mx-auto">
      <div className="flex items-baseline gap-3">
        <span className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: KONNEKT_ACCENT }}>
          KONNEKT
        </span>
        <span className="hidden sm:inline text-[12px] text-white/60">by Yobbanté</span>
      </div>
      <p className="mt-1 text-[12px] sm:text-[13px] text-white/70">
        La plateforme des transporteurs partenaires Yobbanté
      </p>
    </header>
  );
}

function Hero({ onJoinClick }: { onJoinClick: () => void }) {
  return (
    <section className="px-5 sm:px-8 max-w-5xl mx-auto pt-8 pb-12">
      <h1 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight">
        Transportez.<br />
        Gagnez. <span style={{ color: KONNEKT_ACCENT }}>Simplement.</span>
      </h1>
      <p className="mt-4 text-[15px] sm:text-lg text-white/75 max-w-xl leading-relaxed">
        Rejoignez le réseau Yobbanté et gérez vos missions depuis votre téléphone.
      </p>
      <button
        type="button"
        onClick={onJoinClick}
        className="mt-7 inline-flex items-center gap-2 font-bold rounded-xl px-6 py-3.5 text-sm transition-all active:scale-95"
        style={{ background: KONNEKT_ACCENT, color: KONNEKT_BG }}
      >
        Rejoindre le réseau beta
        <ArrowRight className="w-4 h-4" />
      </button>
    </section>
  );
}

function Avantages() {
  const items = [
    { icon: <Package className="w-5 h-5" />, title: 'Missions directes', desc: 'Recevez des colis à transporter sans démarcher.' },
    { icon: <MessageCircle className="w-5 h-5" />, title: 'Tout sur WhatsApp', desc: "Gérez tout depuis le bot WhatsApp. Pas d'app à installer." },
    { icon: <Wallet className="w-5 h-5" />, title: 'Paiements rapides', desc: 'Paiement Wave ou Orange Money après chaque mission.' },
  ];
  return (
    <section className="px-5 sm:px-8 max-w-5xl mx-auto pb-12">
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
        {items.map(it => (
          <div key={it.title} className="rounded-2xl p-5 border" style={{ background: KONNEKT_CARD, borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3" style={{ background: 'rgba(245,197,24,0.12)', color: KONNEKT_ACCENT }}>
              {it.icon}
            </div>
            <p className="font-bold text-base">{it.title}</p>
            <p className="mt-1 text-[13px] text-white/70 leading-relaxed">{it.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CommentCaMarche() {
  const steps = [
    'Inscrivez-vous ici',
    'Enregistrez votre numéro WhatsApp',
    'Recevez vos premières missions',
    'Confirmez et soyez payé',
  ];
  return (
    <section className="px-5 sm:px-8 max-w-5xl mx-auto pb-12">
      <h2 className="text-xl sm:text-2xl font-bold mb-5">Comment ça marche</h2>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s} className="flex items-start gap-3 rounded-xl p-4 border" style={{ background: KONNEKT_CARD, borderColor: 'rgba(255,255,255,0.08)' }}>
            <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-[13px]" style={{ background: KONNEKT_ACCENT, color: KONNEKT_BG }}>
              {i + 1}
            </span>
            <span className="text-[14px] mt-0.5">{s}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function InscriptionForm({
  form, setForm, toggleVille, canSubmit, submitting, onSubmit, error, alreadyMsg,
}: {
  form: any;
  setForm: any;
  toggleVille: (v: string) => void;
  canSubmit: boolean;
  submitting: boolean;
  onSubmit: () => void;
  error: string | null;
  alreadyMsg: string | null;
}) {
  return (
    <section id="inscription" className="px-5 sm:px-8 max-w-2xl mx-auto pb-16 scroll-mt-6">
      <div className="rounded-2xl p-5 sm:p-7 border" style={{ background: KONNEKT_CARD, borderColor: 'rgba(255,255,255,0.08)' }}>
        <h2 className="text-xl sm:text-2xl font-bold">Rejoindre la beta Konnekt</h2>
        <p className="mt-1 text-[13px] text-white/70">Places limitées — Transporteurs sérieux uniquement</p>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom *">
              <input className={inputClass} value={form.prenom} onChange={e => setForm({ ...form, prenom: e.target.value })} />
            </Field>
            <Field label="Nom *">
              <input className={inputClass} value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
            </Field>
          </div>

          <Field label="Téléphone WhatsApp *" hint="Format : +221 77 123 45 67">
            <input
              className={inputClass}
              placeholder="+221 ..."
              value={form.telephone}
              onChange={e => setForm({ ...form, telephone: e.target.value })}
              inputMode="tel"
            />
          </Field>

          <Field label="Ville de résidence *">
            <select className={inputClass} value={form.ville} onChange={e => setForm({ ...form, ville: e.target.value })}>
              <option value="">Choisir...</option>
              {VILLES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>

          <Field label="Villes que vous desservez *" hint="Sélectionnez toutes les villes que vous couvrez">
            <div className="flex flex-wrap gap-2 mt-1">
              {VILLES.map(v => {
                const active = form.villes_desservies.includes(v);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => toggleVille(v)}
                    className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-all"
                    style={active
                      ? { background: KONNEKT_ACCENT, color: KONNEKT_BG }
                      : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Fréquence de voyages *">
            <div className="flex flex-wrap gap-2 mt-1">
              {FREQUENCES.map(f => {
                const active = form.frequence === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setForm({ ...form, frequence: f.id })}
                    className="px-3 py-1.5 rounded-full text-[12px] font-medium"
                    style={active
                      ? { background: KONNEKT_ACCENT, color: KONNEKT_BG }
                      : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Comment avez-vous connu Konnekt ?">
            <select className={inputClass} value={form.source_decouverte} onChange={e => setForm({ ...form, source_decouverte: e.target.value })}>
              <option value="">Choisir...</option>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="Code de parrainage" hint="Optionnel — Si un GP vous a invité">
            <input
              className={inputClass}
              placeholder="ex. GP1234"
              value={form.ref_parrainage || ''}
              onChange={e => setForm({ ...form, ref_parrainage: e.target.value.toUpperCase() })}
            />
          </Field>

          {error && (
            <div className="rounded-lg p-3 text-[13px]" style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)' }}>
              {error}
            </div>
          )}
          {alreadyMsg && (
            <div className="rounded-lg p-3 text-[13px]" style={{ background: 'rgba(245,197,24,0.1)', color: KONNEKT_ACCENT, border: '1px solid rgba(245,197,24,0.25)' }}>
              {alreadyMsg}
            </div>
          )}

          <button
            type="button"
            disabled={!canSubmit}
            onClick={onSubmit}
            className="w-full inline-flex items-center justify-center gap-2 font-bold rounded-xl px-6 py-3.5 text-sm transition-all disabled:opacity-60 active:scale-[0.98]"
            style={{ background: KONNEKT_ACCENT, color: KONNEKT_BG }}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Envoi...' : 'Rejoindre la beta →'}
          </button>
        </div>
      </div>
    </section>
  );
}

function ConfirmationView({ prenom, onBack }: { prenom: string; onBack: () => void }) {
  return (
    <section className="px-5 sm:px-8 max-w-xl mx-auto py-16 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-5" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
        <CheckCircle2 className="w-9 h-9" />
      </div>
      <h2 className="text-2xl sm:text-3xl font-bold">Demande envoyée !</h2>
      <p className="mt-3 text-[14px] text-white/80 leading-relaxed">
        Bonjour {prenom},<br />
        Votre demande d'inscription à la beta Konnekt a bien été reçue.
      </p>
      <p className="mt-3 text-[14px] text-white/80 leading-relaxed">
        Nous examinons votre profil et vous contactons sous 24h sur WhatsApp.
      </p>

      <div className="mt-7 text-left rounded-2xl p-5 border" style={{ background: KONNEKT_CARD, borderColor: 'rgba(255,255,255,0.08)' }}>
        <p className="font-bold mb-3">En attendant :</p>
        <ol className="space-y-3 text-[13px] text-white/80">
          <li>
            <span className="font-semibold text-white">1.</span> Enregistrez ce numéro dans vos contacts :
            <div className="mt-1 ml-4">
              <p className="font-mono text-[14px]" style={{ color: KONNEKT_ACCENT }}>+221 78 122 18 91</p>
              <p className="text-[12px] text-white/60">Nom : Konnekt GP</p>
            </div>
          </li>
          <li>
            <span className="font-semibold text-white">2.</span> Envoyez « AIDE » pour découvrir comment fonctionne le système.
          </li>
        </ol>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="mt-7 inline-flex items-center gap-2 font-medium text-[14px] hover:underline"
        style={{ color: KONNEKT_ACCENT }}
      >
        ← Retour à l'accueil
      </button>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[12px] font-medium text-white/80 block mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-white/50 mt-1">{hint}</p>}
    </div>
  );
}

const inputClass = 'w-full rounded-lg px-3 py-2.5 text-[14px] outline-none transition-colors';
// Inline styles for input
const _ = ''; // keep tree-shaker quiet

function Footer() {
  return (
    <footer className="px-5 sm:px-8 max-w-5xl mx-auto py-8 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <p className="text-[12px] text-white/50">© 2026 Konnekt by Yobbanté · contact@yobbante.com</p>
    </footer>
  );
}
