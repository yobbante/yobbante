/**
 * /konnekt — Konnekt beta registration page (synchronisée avec le projet Konnekt /beta)
 *
 * - Lit ?ref=GPxxxx pour afficher un badge "Partenaire vérifié"
 * - Pas de mot de passe : l'identifiant est le téléphone, activation par
 *   notre équipe via WhatsApp dans les 24h.
 * - Validation inline par champ
 * - Appelle la fonction konnekt-beta-signup (backend Yobbanté)
 * - Sur succès : page de confirmation WhatsApp (pas de redirection auto)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Loader2, Check, ArrowRight, ArrowLeft, ShieldCheck, MessageCircle,
  Truck, Briefcase, Building2, Users, Phone,
  Luggage, Plane, Ship, Zap, Bike, Car,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/* ───────── Data ───────── */

const CITY_GROUPS: { label: string; cities: string[] }[] = [
  {
    label: "Europe",
    cities: [
      "Paris", "Lyon", "Marseille", "Bordeaux",
      "Madrid", "Barcelone", "Rome", "Milan",
      "Bruxelles", "Amsterdam", "Genève",
      "Londres", "Lisbonne",
    ],
  },
  {
    label: "Amérique",
    cities: ["New York", "Montréal", "Toronto", "Washington DC", "Miami"],
  },
  {
    label: "Afrique (hors Sénégal)",
    cities: ["Abidjan", "Conakry", "Bamako", "Douala", "Libreville"],
  },
  {
    label: "Sénégal",
    cities: ["Dakar", "Thiès", "Saint-Louis", "Ziguinchor", "Kaolack", "Touba", "Mbour"],
  },
];

const ROLES = [
  { id: "gp",          label: "GP / Voyageur",      sub: "Bagages accompagnés",       icon: Briefcase },
  { id: "transporteur", label: "Transporteur Pro", sub: "Routier, maritime, aérien", icon: Truck },
  { id: "client",      label: "Particulier",        sub: "J'envoie des colis",        icon: Users },
  { id: "entreprise",  label: "Entreprise",         sub: "Logistique B2B",            icon: Building2 },
] as const;

const MODES = [
  { id: "bagages_international", label: "GP Bagages", icon: Luggage },
  { id: "routier",               label: "Routier",    icon: Truck },
  { id: "aerien",                label: "Aérien",     icon: Plane },
  { id: "maritime",              label: "Maritime",   icon: Ship },
  { id: "express",               label: "Coursier",   icon: Zap },
  { id: "moto",                  label: "Moto",       icon: Bike },
  { id: "mobility",              label: "Mobility",   icon: Car },
];

const KONNEKT_WA = "221781221891";
const KONNEKT_TEL = "+221 78 122 18 91";

type RoleId = typeof ROLES[number]["id"];

/* ───────── Helpers ───────── */

function cleanPhone(v: string) {
  const t = v.trim();
  const plus = t.startsWith("+") ? "+" : "";
  return plus + t.replace(/[^\d]/g, "");
}

type Errors = Partial<Record<"first" | "last" | "phone" | "city" | "role" | "modes", string>>;

/* ───────── Page ───────── */

export default function KonnektLandingPage() {
  const [params] = useSearchParams();
  const ref = (params.get("ref") || "").trim();
  const refClean = ref.replace(/^GP/i, "").toLowerCase();
  const hasRef = /^[0-9a-z]{3,8}$/.test(refClean);

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("+221 ");
  const [whatsapp, setWhatsapp] = useState("");
  const [role, setRole] = useState<RoleId | "">("");
  const [city, setCity] = useState("Dakar");
  const [citiesServed, setCitiesServed] = useState("");
  const [modes, setModes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState(false);
  const [prefillNotice, setPrefillNotice] = useState<string | null>(null);
  const [missions, setMissions] = useState<Array<{
    id: string; tracking_id: string | null; status: string;
    destination_country: string | null; destination_city: string | null;
    weight_kg: number | null; departure_date: string | null;
  }>>([]);
  const [missionsGpName, setMissionsGpName] = useState<string>("");
  const [missionsLoaded, setMissionsLoaded] = useState(false);
  const initialized = useRef(false);
  const prefillTriedFor = useRef<string>("");
  const missionsTriedFor = useRef<string>("");


  /* Force light mode pendant qu'on est sur /konnekt */
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.remove("dark");
    return () => { if (hadDark) root.classList.add("dark"); };
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    document.title = hasRef ? "Konnekt Bêta — Bienvenue partenaire" : "Konnekt — Rejoindre";
    if (hasRef) {
      try { localStorage.setItem("konnekt_ref", refClean); } catch { /* noop */ }
    }
  }, [hasRef, refClean]);

  const refLabel = useMemo(() => (hasRef ? `GP${refClean.toUpperCase().slice(0, 4)}` : ""), [hasRef, refClean]);

  /* Pré-remplissage depuis transporteurs (Yobbanté) */
  // Mappe les modes stockés en base vers les ids des boutons Konnekt.
  const modeAliases: Record<string, string> = {
    bagages: 'bagages_international', bagage: 'bagages_international',
    bagages_international: 'bagages_international',
    air: 'aerien', aerien: 'aerien', aérien: 'aerien', avion: 'aerien', plane: 'aerien',
    road: 'routier', route: 'routier', routier: 'routier', truck: 'routier',
    sea: 'maritime', sea_lcl: 'maritime', sea_fcl: 'maritime', maritime: 'maritime', boat: 'maritime',
    express: 'express', coursier: 'express',
    moto: 'moto', motorbike: 'moto', scooter: 'moto',
    car: 'mobility', mobility: 'mobility', vtc: 'mobility',
  };
  useEffect(() => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9 && !hasRef) return;
    const key = digits.length >= 9 ? digits.slice(-9) : `ref:${refClean}`;
    if (prefillTriedFor.current === key) return;
    prefillTriedFor.current = key;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('konnekt-prefill', {
          body: {
            phone: digits.length >= 9 ? '+' + digits : null,
            reference: hasRef ? refClean : null,
          },
        });
        if (cancelled || error) return;
        const res = data as { found?: boolean; data?: Record<string, any> };
        if (!res?.found || !res.data) return;
        const d = res.data;
        // Pré-remplir UNIQUEMENT les champs encore vides pour ne pas écraser la saisie.
        setFirst(prev => prev || d.prenom || '');
        setLast(prev => prev || d.nom || '');
        if (digits.length < 9 && d.telephone_1) {
          setPhone('+' + d.telephone_1.replace(/\D/g, ''));
        }
        setWhatsapp(prev => prev || (d.whatsapp ? '+' + String(d.whatsapp).replace(/\D/g, '') : ''));
        if (d.ville) setCity(prev => (prev && prev !== 'Dakar' ? prev : d.ville));
        if (Array.isArray(d.destinations) && d.destinations.length) {
          setCitiesServed(prev => prev || d.destinations.join(', '));
        }
        if (Array.isArray(d.modes_transport) && d.modes_transport.length) {
          const mapped = Array.from(new Set(
            d.modes_transport
              .map((m: string) => modeAliases[String(m).toLowerCase()] || null)
              .filter(Boolean) as string[]
          ));
          if (mapped.length) setModes(prev => (prev.length ? prev : mapped));
        }
        setPrefillNotice(`Bienvenue ${d.prenom || ''} ! Nous avons reconnu votre numéro — vos informations sont pré-remplies.`);
      } catch {
        /* silent */
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, hasRef, refClean]);


  /* Validation */
  const errors = useMemo<Errors>(() => {
    const e: Errors = {};
    if (first.trim().length < 2) e.first = "Au moins 2 caractères";
    if (last.trim().length < 2) e.last = "Au moins 2 caractères";
    if (phone.replace(/\D/g, "").length < 8) e.phone = "Numéro invalide (min. 8 chiffres)";
    if (!city) e.city = "Sélectionnez une ville";
    if (!role) e.role = "Sélectionnez un rôle";
    if (modes.length === 0) e.modes = "Choisissez au moins un mode";
    return e;
  }, [first, last, phone, city, role, modes]);

  const valid = Object.keys(errors).length === 0;

  const toggleMode = (id: string) => {
    setModes((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  };

  const showErr = (k: keyof Errors) => (touched[k] || touched.__submit) && errors[k];

  const submit = async () => {
    setTouched((t) => ({ ...t, __submit: true }));
    setServerError(null);
    if (!valid) {
      const el = document.querySelector("[data-error='1']");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    try {
      const villesArr = citiesServed
        .split(/[,;\n]+/)
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 20);

      // Modes injectés dans source_decouverte pour traçabilité backend
      const sourceTag = `role:${role}|modes:${modes.join("+")}${hasRef ? `|ref:${refLabel}` : ""}`;

      const { data, error } = await supabase.functions.invoke("konnekt-beta-signup", {
        body: {
          prenom: first.trim(),
          nom: last.trim(),
          telephone: phone.trim(),
          email: "",
          ville: city,
          villes_desservies: villesArr,
          source_decouverte: sourceTag,
          ref_parrainage: hasRef ? refLabel : null,
        },
      });
      if (error) throw new Error(error.message);
      const res = data as { ok?: boolean; already_registered?: boolean; message?: string; error?: string };
      if (res?.already_registered) {
        setServerError(res.message || "Vous êtes déjà partenaire Yobbanté.");
        return;
      }
      if (!res?.ok) throw new Error(res?.error || "Une erreur est survenue.");
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Une erreur est survenue. Réessayez dans un instant.";
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3.5">
          <Link to="/" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span className="w-7 h-7 rounded-md bg-[#F5C518] text-[#0A0E1A] grid place-items-center font-bold text-sm">K</span>
            <div className="flex flex-col leading-none">
              <span className="font-bold text-[15px] tracking-tight">KONNEKT</span>
              <span className="text-[10px] text-slate-500">by Yobbanté</span>
            </div>
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold border border-[#F5C518]/40 bg-[#F5C518]/15 text-[#8a6b00] rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F5C518] animate-pulse" />
            Accès prioritaire
          </span>
        </div>
      </header>

      <main className="px-4 py-10 md:py-14">
        <div className="max-w-xl mx-auto">
          {!done ? (
            <>
              {/* HERO */}
              <section className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                  Recevez vos missions{" "}
                  <span className="text-[#0A0E1A] bg-[#F5C518] px-2 rounded">Yobbanté</span> ici.
                </h1>
                <p className="text-sm md:text-base text-slate-600 mt-3 max-w-md mx-auto leading-relaxed">
                  Inscription en 2 minutes. Notre équipe vous active sur WhatsApp dans les 24h.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-5 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /> Gratuit</span>
                  <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /> 2 minutes</span>
                  <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Sécurisé</span>
                </div>
              </section>

              {/* CARD */}
              <div id="inscription" className="bg-white border border-slate-200 rounded-2xl p-5 md:p-7 shadow-sm">
                {hasRef && (
                  <div className="flex items-start gap-3 mb-6 bg-[#F5C518]/10 border border-[#F5C518]/30 rounded-xl px-4 py-3">
                    <ShieldCheck className="w-5 h-5 text-[#8a6b00] mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Partenaire vérifié · {refLabel}</div>
                      <div className="text-xs text-slate-600 mt-0.5">Votre référence sera transmise à l'équipe.</div>
                    </div>
                  </div>
                )}

                {prefillNotice && (
                  <div className="flex items-start gap-3 mb-6 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                    <Check className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-emerald-900">{prefillNotice}</div>
                  </div>
                )}


                {/* Nom */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Prénom" required error={showErr("first") ? errors.first : undefined}>
                    <KInput value={first} onChange={setFirst} onBlur={() => setTouched((t) => ({ ...t, first: true }))} placeholder="Ibrahima" invalid={!!showErr("first")} />
                  </Field>
                  <Field label="Nom" required error={showErr("last") ? errors.last : undefined}>
                    <KInput value={last} onChange={setLast} onBlur={() => setTouched((t) => ({ ...t, last: true }))} placeholder="Fall" invalid={!!showErr("last")} />
                  </Field>
                </div>

                {/* Téléphone */}
                <Field label="Téléphone" required hint="Sera votre identifiant Konnekt" error={showErr("phone") ? errors.phone : undefined}>
                  <KInput
                    value={phone}
                    onChange={(v) => setPhone(cleanPhone(v))}
                    onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                    placeholder="+221 77 000 00 00"
                    type="tel"
                    invalid={!!showErr("phone")}
                  />
                </Field>

                <Field label="WhatsApp" hint="Si différent du téléphone">
                  <KInput value={whatsapp} onChange={(v) => setWhatsapp(cleanPhone(v))} placeholder="+221 76 000 00 00" type="tel" />
                </Field>

                {/* Rôle */}
                <Field label="Rôle" required error={showErr("role") ? errors.role : undefined}>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map((r) => {
                      const Ico = r.icon;
                      const active = role === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => { setRole(r.id); setTouched((t) => ({ ...t, role: true })); }}
                          className={`text-left p-3 rounded-xl border transition-all ${
                            active
                              ? "border-[#F5C518] bg-[#F5C518]/10 ring-1 ring-[#F5C518]/40"
                              : "border-slate-200 bg-white hover:border-slate-400"
                          }`}
                        >
                          <Ico className={`w-4 h-4 ${active ? "text-[#8a6b00]" : "text-slate-900"}`} strokeWidth={1.75} />
                          <div className="text-sm font-semibold mt-2">{r.label}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{r.sub}</div>
                        </button>
                      );
                    })}
                  </div>
                </Field>

                {/* Ville de base */}
                <Field
                  label="Ville de base"
                  required
                  hint="Où vous résidez principalement"
                  error={showErr("city") ? errors.city : undefined}
                >
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, city: true }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-[#F5C518]/40 focus:border-[#F5C518]"
                  >
                    {CITY_GROUPS.map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.cities.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </optgroup>
                    ))}
                    <option value="Autre">Autre</option>
                  </select>
                </Field>

                {/* Villes desservies */}
                <Field label="Villes desservies" hint="Séparez les villes par des virgules">
                  <KInput
                    value={citiesServed}
                    onChange={setCitiesServed}
                    placeholder="Ex : Paris, Dakar, Lyon, New York..."
                  />
                </Field>

                {/* Modes recherchés */}
                <Field label="Mode(s) recherché(s)" required hint="Sélectionnez tous ceux qui s'appliquent" error={showErr("modes") ? errors.modes : undefined}>
                  <div className="flex flex-wrap gap-2">
                    {MODES.map((m) => {
                      const Ico = m.icon;
                      const active = modes.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => { toggleMode(m.id); setTouched((t) => ({ ...t, modes: true })); }}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                            active
                              ? "border-[#F5C518] bg-[#F5C518] text-[#0A0E1A]"
                              : "border-slate-200 bg-white text-slate-900 hover:border-slate-400"
                          }`}
                        >
                          <Ico className="w-3.5 h-3.5" strokeWidth={2} />
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                {/* Bloc info — pas de mot de passe */}
                <div
                  className="mt-5 flex items-start gap-3 rounded-xl"
                  style={{ backgroundColor: "#F5F5F5", padding: "12px 20px", borderRadius: 12 }}
                >
                  <MessageCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#25D366" }} strokeWidth={2} />
                  <p className="text-xs md:text-sm text-slate-800 leading-relaxed">
                    Votre numéro de téléphone est votre identifiant. Pas de mot de passe —
                    nous vous activons sur WhatsApp sous 24h.
                  </p>
                </div>

                <p className="text-[11px] text-slate-500 mt-5 leading-relaxed">
                  En vous inscrivant, vous acceptez les{" "}
                  <a href="/cgu" className="text-[#8a6b00] hover:underline font-medium">conditions d'utilisation</a> de Konnekt.
                </p>

                {serverError && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
                    {serverError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="w-full mt-5 inline-flex items-center justify-center gap-2 bg-[#0A0E1A] hover:bg-[#0A0E1A]/90 text-white rounded-lg py-3.5 font-semibold text-sm shadow-md disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {hasRef ? "Activer mon compte Konnekt" : "Rejoindre Konnekt"}
                  {!submitting && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>

              <p className="text-center text-xs text-slate-500 mt-6">
                Déjà partenaire ?{" "}
                <a href={`https://wa.me/${KONNEKT_WA}`} target="_blank" rel="noopener noreferrer" className="text-[#8a6b00] hover:underline font-medium">
                  Écrivez-nous sur WhatsApp
                </a>
              </p>
            </>
          ) : (
            <ConfirmationBlock firstName={first} />
          )}
        </div>
      </main>
    </div>
  );
}

/* ───────── Subcomponents ───────── */

function Field({
  label, required, hint, error, children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4" data-error={error ? "1" : undefined}>
      <label className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-slate-900">
          {label} {required && <span className="text-[#c79400]">*</span>}
        </span>
        {hint && !error && <span className="text-[11px] text-slate-500">{hint}</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1.5 font-medium">{error}</p>}
    </div>
  );
}

function KInput({
  value, onChange, onBlur, placeholder, type = "text", invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
  invalid?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className={`w-full bg-white rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors border focus:ring-2 ${
        invalid
          ? "border-red-400 focus:ring-red-200 focus:border-red-500"
          : "border-slate-200 focus:ring-[#F5C518]/40 focus:border-[#F5C518]"
      }`}
    />
  );
}

function ConfirmationBlock({ firstName }: { firstName: string }) {
  const waText = encodeURIComponent(
    `Salam, je viens de m'inscrire sur Konnekt.\nMon prénom : ${firstName || "—"}`
  );
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-7 text-center shadow-sm">
      <div className="flex justify-center mb-5">
        <div className="w-20 h-20 rounded-full bg-emerald-50 border border-emerald-200 grid place-items-center">
          <Check className="w-10 h-10 text-emerald-600" strokeWidth={2.5} />
        </div>
      </div>

      <h2 className="text-2xl font-bold tracking-tight">
        Inscription reçue{firstName ? `, ${firstName}` : ""} !
      </h2>

      <p className="text-sm text-slate-600 mt-4 max-w-md mx-auto leading-relaxed">
        Notre équipe Konnekt vous contacte sur WhatsApp dans les
        <span className="font-semibold text-slate-900"> 24 heures </span>
        pour activer votre compte.
      </p>

      <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-left">
        <div className="text-[11px] uppercase tracking-widest font-semibold text-slate-500 mb-2">
          En attendant, enregistrez ce numéro
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-bold text-slate-900">{KONNEKT_TEL}</div>
            <div className="text-xs text-slate-500 mt-0.5">Nom : Konnekt GP</div>
          </div>
          <a
            href={`tel:+${KONNEKT_WA}`}
            className="w-10 h-10 rounded-full bg-white border border-slate-200 grid place-items-center text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Appeler Konnekt"
          >
            <Phone className="w-4 h-4" />
          </a>
        </div>
      </div>

      <a
        href={`https://wa.me/${KONNEKT_WA}?text=${waText}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full mt-5 inline-flex items-center justify-center gap-2 text-white rounded-lg py-3.5 font-semibold text-sm shadow-md transition-transform hover:scale-[1.01] active:scale-[0.99]"
        style={{ backgroundColor: "#25D366" }}
      >
        <MessageCircle className="w-4 h-4" />
        Écrire à Konnekt sur WhatsApp
        <ArrowRight className="w-4 h-4" />
      </a>

      <p className="text-xs text-slate-500 mt-4">
        Ou appelez-nous :{" "}
        <a href={`tel:${KONNEKT_TEL.replace(/\s/g, "")}`} className="text-slate-900 font-semibold hover:underline">
          {KONNEKT_TEL}
        </a>
      </p>
    </div>
  );
}
