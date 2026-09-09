import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  ArrowRight, CheckCircle2, Loader2, MessageCircle, Send, ShieldCheck, Clock, BadgeCheck,
} from 'lucide-react';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { CityPicker } from '@/components/quote/CityPicker';
import { DOSSIER_TRANSPORT_MODES, type DossierTransportMode, normalizeTransportMode } from '@/lib/transportMode';
import { submitQuoteRequest, QUOTE_BOT_DISPLAY, type QuoteSegment } from '@/lib/quoteRequest';
import { supabase } from '@/integrations/supabase/client';
import { useSeo } from '@/hooks/useSeo';
import { cn } from '@/lib/utils';

const DAKAR = 'Dakar';

const Schema = z.object({
  name: z.string().trim().min(2, 'Indiquez votre nom').max(120),
  phone: z.string().trim().regex(/^\+?[0-9 .()-]{7,20}$/, 'Numéro de téléphone invalide'),
  email: z.string().trim().email('Email invalide').max(255).optional().or(z.literal('')),
  city: z.string().trim().min(2, 'Choisissez une ville'),
});

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const inputCls =
  'w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/30 transition';

export default function DemandeDevisPage() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  useSeo({
    title: 'Demander un devis transport — Yobbanté',
    description:
      'Un seul formulaire pour obtenir un devis Yobbanté : GP, aérien, maritime ou routier. Réponse d’un chargé de dossier sous 2 h ouvrées.',
    path: '/demande-devis',
  });

  const [segment, setSegment] = useState<QuoteSegment>(
    sp.get('segment') === 'entreprise' ? 'entreprise' : 'particulier',
  );
  const [mode, setMode] = useState<DossierTransportMode>(normalizeTransportMode(sp.get('mode')) ?? 'gp');
  const [direction, setDirection] = useState<'from_dakar' | 'to_dakar'>(
    sp.get('direction') === 'from_dakar' ? 'from_dakar' : 'to_dakar',
  );
  const [city, setCity] = useState(sp.get('city') ?? sp.get('destination') ?? sp.get('origin') ?? '');
  const [weight, setWeight] = useState(sp.get('weight') ?? '');
  const [parcels, setParcels] = useState('');
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [done, setDone] = useState<{ reference: string; trackingId: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthed(!!data.user);
      const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      const fullName = (meta.full_name || meta.name) as string | undefined;
      if (fullName) setName((p) => p || fullName);
      if (data.user?.email) setEmail((p) => p || data.user!.email!);
      if (data.user?.phone) setPhone((p) => p || `+${data.user!.phone!.replace(/^\+/, '')}`);
    });
  }, []);

  const route = useMemo(
    () => (direction === 'from_dakar'
      ? { origin: DAKAR, destination: city }
      : { origin: city, destination: DAKAR }),
    [direction, city],
  );

  async function submit() {
    const parsed = Schema.safeParse({ name, phone, email, city });
    if (!parsed.success) {
      toast.error(Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Champs invalides');
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitQuoteRequest({
        clientName: parsed.data.name,
        clientPhone: parsed.data.phone,
        clientEmail: parsed.data.email || null,
        segment,
        company: segment === 'entreprise' ? company || null : null,
        originCity: route.origin,
        destinationCity: route.destination,
        weightKg: weight ? Number(weight) : null,
        parcelCount: parcels ? Number(parcels) : null,
        transportMode: mode,
        description: description || null,
        note: note || null,
        source: 'devis_page',
      });
      setDone(res);
      toast.success('Demande envoyée');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      console.error('Quote request error', e);
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'envoi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav />

      <main className="flex-1 w-full max-w-2xl mx-auto px-5 py-8 md:py-12">
        {done ? (
          <section className="rounded-3xl border border-border bg-card p-7 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-secondary grid place-items-center">
              <CheckCircle2 className="w-7 h-7" strokeWidth={1.75} />
            </div>
            <h1 className="mt-5 text-[24px] font-semibold tracking-tight">Demande envoyée</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Un chargé de dossier vous répond sous <strong className="text-foreground">2 h ouvrées</strong> sur
              WhatsApp au {QUOTE_BOT_DISPLAY}.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3.5 py-1.5 text-[12px] font-mono">
              <span className="text-muted-foreground">Réf.</span>
              <span className="font-semibold">{done.reference}</span>
            </div>
            <div className="mt-6 space-y-2">
              <Link
                to={`/suivre/${done.trackingId}`}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background px-5 py-3 text-[13px] font-semibold"
              >
                Suivre ma demande <ArrowRight className="w-4 h-4" />
              </Link>
              {!isAuthed && (
                <button
                  type="button"
                  onClick={() => {
                    try { sessionStorage.setItem('post_auth_redirect', `/suivre/${done.trackingId}`); } catch { /* ignore */ }
                    navigate('/auth');
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-2.5 text-[13px] font-medium hover:bg-secondary"
                >
                  Créer mon compte pour suivre mes devis
                </button>
              )}
              <a
                href={`https://wa.me/${QUOTE_BOT_DISPLAY.replace(/\D/g, '')}?text=${encodeURIComponent(`Bonjour, réf ${done.reference}.`)}`}
                target="_blank" rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[13px] text-muted-foreground hover:text-foreground"
              >
                <MessageCircle className="w-4 h-4" /> Ouvrir WhatsApp
              </a>
            </div>
          </section>
        ) : (
          <>
            <header className="mb-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Devis Yobbanté</p>
              <h1 className="mt-1.5 text-[28px] md:text-[34px] font-semibold tracking-tight leading-tight">
                Demandez votre devis en 1 minute
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                GP, aérien, maritime ou routier Terminal D — un seul formulaire, une réponse humaine sous 2 h ouvrées.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"><Clock className="w-3 h-3" /> Réponse 2 h ouvrées</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"><ShieldCheck className="w-3 h-3" /> Sans engagement</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"><BadgeCheck className="w-3 h-3" /> Prix validé par un humain</span>
              </div>
            </header>

            <div className="space-y-6 rounded-3xl border border-border bg-card p-5 md:p-7">
              {/* Segment */}
              <Field label="Vous êtes">
                <div className="grid grid-cols-2 gap-2">
                  {(['particulier', 'entreprise'] as QuoteSegment[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSegment(s)}
                      className={cn(
                        'rounded-xl border px-3 py-2.5 text-[13px] font-medium transition',
                        segment === s ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-secondary',
                      )}
                    >
                      {s === 'particulier' ? 'Particulier' : 'Entreprise'}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Mode */}
              <Field label="Mode de transport">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DOSSIER_TRANSPORT_MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMode(m.id)}
                      className={cn(
                        'rounded-xl border px-3 py-3 text-left transition',
                        mode === m.id ? 'border-foreground bg-secondary' : 'border-border hover:bg-secondary/60',
                      )}
                    >
                      <m.Icon className="w-4 h-4 mb-1.5" strokeWidth={1.75} />
                      <p className="text-[13px] font-medium leading-tight">{m.label}</p>
                      <p className="text-[10.5px] text-muted-foreground leading-tight mt-0.5">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </Field>

              {/* Trajet */}
              <Field label="Trajet" hint="Yobbanté opère au départ ou à destination de Dakar.">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {([['to_dakar', 'Vers Dakar'], ['from_dakar', 'Depuis Dakar']] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDirection(id)}
                      className={cn(
                        'rounded-xl border px-3 py-2 text-[13px] font-medium transition',
                        direction === id ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-secondary',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <CityPicker
                  value={city}
                  onChange={setCity}
                  includeHub
                  excludeCity={DAKAR}
                  placeholder={direction === 'to_dakar' ? "Ville d'origine…" : 'Ville de destination…'}
                  ariaLabel="Choisir la ville"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {route.origin || '—'} → {route.destination || '—'}
                </p>
              </Field>

              {/* Colis */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Poids estimé (kg)">
                  <input className={inputCls} inputMode="decimal" value={weight}
                         onChange={(e) => setWeight(e.target.value)} placeholder="ex. 25" />
                </Field>
                <Field label="Nombre de colis">
                  <input className={inputCls} inputMode="numeric" value={parcels}
                         onChange={(e) => setParcels(e.target.value)} placeholder="ex. 2" />
                </Field>
              </div>

              <Field label="Contenu / marchandise">
                <textarea
                  className={cn(inputCls, 'resize-none')}
                  rows={3}
                  maxLength={600}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex. 3 cartons de vêtements + 1 valise, valeur ~200 000 FCFA"
                />
              </Field>

              {/* Contact */}
              <div className="space-y-3 pt-1 border-t border-border/60">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground pt-4">Vos coordonnées</p>
                <Field label="Nom complet">
                  <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Aïssatou Diop" />
                </Field>
                {segment === 'entreprise' && (
                  <Field label="Société">
                    <input className={inputCls} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nom de l'entreprise" />
                  </Field>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Téléphone / WhatsApp">
                    <input className={inputCls} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+221 77 000 00 00" />
                  </Field>
                  <Field label="Email (optionnel)">
                    <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@email.com" />
                  </Field>
                </div>
                <Field label="Précisions (optionnel)">
                  <textarea
                    className={cn(inputCls, 'resize-none')}
                    rows={2}
                    maxLength={500}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Date souhaitée, contraintes, budget…"
                  />
                </Field>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background px-5 py-3.5 text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 transition"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {submitting ? 'Envoi…' : 'Envoyer ma demande de devis'}
                </button>
                <p className="text-[11px] text-muted-foreground text-center" aria-live="polite">
                  Sans engagement · Vos données ne servent qu'au traitement de la demande.
                </p>
              </div>
            </div>
          </>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
