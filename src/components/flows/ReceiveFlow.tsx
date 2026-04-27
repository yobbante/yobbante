import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Link2, Loader2, Copy, Check, Inbox, ShieldCheck, X, Plus,
  ShoppingBag, ExternalLink, Bell, Sparkles, Hash, FileText, Package,
  ArrowRight, RotateCcw, MapPin, Truck, ListChecks, Clock, CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  FlowShell, FlowHero, FlowSection, CountryGrid, FlowSuccess,
} from './FlowPrimitives';
import { useDossiers } from '@/hooks/useDossiers';
import { useAddresses } from '@/hooks/useAddresses';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { WarehouseCountry } from '@/lib/types';
import { HubsWorldMap, type HubId } from '@/components/HubsWorldMap';
import { ReceptionRegisterFlow } from './ReceptionRegisterFlow';

/** Detect a recommended hub from a free-text input (URL or paste). */
function detectHubFromInput(text: string): HubId | null {
  const t = text.toLowerCase();
  if (/alibaba|aliexpress|shein|temu|1688|taobao|\.cn\b/.test(t)) return 'CN';
  if (/amazon\.fr|cdiscount|fnac|laposte|colissimo|chronopost/.test(t)) return 'FR';
  if (/amazon\.com|ebay\.com|walmart|usps|fedex\.com\/us/.test(t)) return 'US';
  if (/amazon\.ae|noon\.com|\.ae\b/.test(t)) return 'AE';
  if (/trendyol|hepsiburada|\.tr\b/.test(t)) return 'TR';
  if (/amazon\.de|otto\.de|zalando\.de|\.de\b/.test(t)) return 'FR'; // DE → routed via FR hub
  return null;
}

/* ──────────────────────────────────────────────────────────────────────
   Static data
   ────────────────────────────────────────────────────────────────────── */

const HUBS = [
  { id: 'CN', flag: '🇨🇳', label: 'Chine' },
  { id: 'FR', flag: '🇫🇷', label: 'France' },
  { id: 'US', flag: '🇺🇸', label: 'USA' },
  { id: 'AE', flag: '🇦🇪', label: 'Dubai' },
];
const DESTINATIONS = [
  { id: 'SN', flag: '🇸🇳', label: 'Sénégal' },
  { id: 'CI', flag: '🇨🇮', label: "Côte d'Ivoire" },
  { id: 'ML', flag: '🇲🇱', label: 'Mali' },
  { id: 'GN', flag: '🇬🇳', label: 'Guinée' },
  { id: 'BF', flag: '🇧🇫', label: 'Burkina' },
  { id: 'TG', flag: '🇹🇬', label: 'Togo' },
];
const COUNTRY_NAME = (id: string) =>
  [...HUBS, ...DESTINATIONS].find(c => c.id === id)?.label ?? id;

/** Suggested external order URL per hub. */
const EXTERNAL_PORTAL: Record<string, { label: string; url: string }[]> = {
  CN: [
    { label: 'Alibaba',   url: 'https://www.alibaba.com' },
    { label: 'AliExpress',url: 'https://www.aliexpress.com' },
    { label: 'Shein',     url: 'https://www.shein.com' },
    { label: 'Temu',      url: 'https://www.temu.com' },
  ],
  FR: [
    { label: 'Amazon FR', url: 'https://www.amazon.fr' },
    { label: 'Cdiscount', url: 'https://www.cdiscount.com' },
    { label: 'Fnac',      url: 'https://www.fnac.com' },
  ],
  US: [
    { label: 'Amazon US', url: 'https://www.amazon.com' },
    { label: 'eBay',      url: 'https://www.ebay.com' },
    { label: 'Walmart',   url: 'https://www.walmart.com' },
  ],
  AE: [
    { label: 'Amazon.ae', url: 'https://www.amazon.ae' },
    { label: 'Noon',      url: 'https://www.noon.com' },
  ],
};

/** Public template addresses for each hub — used as fallback when the
 *  visitor isn't authenticated yet. The personal `identifier_code` is
 *  generated only after sign-up (see `handle_new_user` trigger). */
const FALLBACK_HUB_ADDRESS: Record<string, string> = {
  CN: 'Room 501, Building 3, Nanshan District, Shenzhen 518000, China',
  FR: '12 Rue de la Logistique, 93200 Saint-Denis, France',
  US: '1200 NW 78th Ave, Suite 200, Miami, FL 33126, USA',
  AE: 'Warehouse 14, Jebel Ali Free Zone, Dubai, UAE',
  TR: 'Atatürk Havalimanı Cargo Terminal, 34149 Istanbul, Türkiye',
  SN: "Zone de fret Aéroport Blaise Diagne, Diass, Sénégal",
};

/* ──────────────────────────────────────────────────────────────────────
   Local-state persistence (so users coming back from Amazon resume here)
   ────────────────────────────────────────────────────────────────────── */

const LS_KEY = 'yobbante.receive.session.v1';

type SavedSession = {
  ordered: 'yes' | 'no' | null;
  hub: string | null;
  destination: string | null;
  /** Auto-suggested hub — persisted so it survives step navigation. */
  recommendedHub: HubId | null;
  generatedAt: number | null;
  exitedAt: number | null;
};

const EMPTY_SESSION: SavedSession = {
  ordered: null, hub: null, destination: null, recommendedHub: null,
  generatedAt: null, exitedAt: null,
};

function loadSession(): SavedSession {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...EMPTY_SESSION };
    return { ...EMPTY_SESSION, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY_SESSION };
  }
}
function saveSession(s: Partial<SavedSession>) {
  try {
    const cur = loadSession();
    localStorage.setItem(LS_KEY, JSON.stringify({ ...cur, ...s }));
  } catch { /* noop */ }
}
function clearSession() {
  try { localStorage.removeItem(LS_KEY); } catch { /* noop */ }
}

/** Public hand-off key used by the landing-page hub map. */
const LANDING_HUB_KEY = 'yobbante.landing.preferredHub';
function readLandingHub(): HubId | null {
  try {
    const v = localStorage.getItem(LANDING_HUB_KEY);
    return v && ['CN', 'FR', 'US', 'AE', 'TR', 'SN'].includes(v) ? (v as HubId) : null;
  } catch { return null; }
}
function clearLandingHub() {
  try { localStorage.removeItem(LANDING_HUB_KEY); } catch { /* noop */ }
}

/* ──────────────────────────────────────────────────────────────────────
   Tracking parser — extract carrier + tracking number from
   url / number / pasted confirmation text.
   ────────────────────────────────────────────────────────────────────── */

type ParsedTracking = {
  trackingNumber: string | null;
  carrier: string | null;
  merchant: string | null;
  productHint: string | null;
  raw: string;
};

const TRACKING_PATTERNS: Array<{ carrier: string; re: RegExp }> = [
  { carrier: 'DHL',          re: /\b\d{10,11}\b/ },
  { carrier: 'UPS',          re: /\b1Z[0-9A-Z]{16}\b/i },
  { carrier: 'FedEx',        re: /\b\d{12,15}\b/ },
  { carrier: 'La Poste',     re: /\b[A-Z]{2}\d{9}[A-Z]{2}\b/ },
  { carrier: 'China Post',   re: /\b[A-Z]{2}\d{9}CN\b/i },
  { carrier: 'Amazon',       re: /\bTBA\d{12}\b/i },
];

const MERCHANT_HINTS: Array<{ name: string; re: RegExp }> = [
  { name: 'Amazon',     re: /amazon\.[a-z.]+/i },
  { name: 'Alibaba',    re: /alibaba\.com/i },
  { name: 'AliExpress', re: /aliexpress\.[a-z.]+/i },
  { name: 'Shein',      re: /shein\.[a-z]+/i },
  { name: 'Temu',       re: /temu\.com/i },
  { name: 'eBay',       re: /ebay\.[a-z.]+/i },
  { name: 'Cdiscount',  re: /cdiscount\.com/i },
];

function parseTrackingInput(raw: string): ParsedTracking {
  const text = raw.trim();
  const result: ParsedTracking = {
    trackingNumber: null, carrier: null, merchant: null, productHint: null, raw: text,
  };
  for (const m of MERCHANT_HINTS) {
    if (m.re.test(text)) { result.merchant = m.name; break; }
  }
  for (const p of TRACKING_PATTERNS) {
    const match = text.match(p.re);
    if (match) { result.trackingNumber = match[0]; result.carrier = p.carrier; break; }
  }
  // Extract a product-name hint from longer pasted text (first sensible line).
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const candidate = lines.find(l => l.length > 12 && l.length < 120 && !/^https?:\/\//i.test(l));
  if (candidate) result.productHint = candidate;
  return result;
}

/* ──────────────────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────────────────── */

type ParsedItem = {
  id: string;
  source: string;
  title: string;
  platform: string;
  estimatedPriceEur: number;
  estimatedWeightKg: number;
  imageUrl: string;
};

type Step = 'ask' | 'pre-order' | 'returning' | 'tracking' | 'orders' | 'reception';

export function ReceiveFlow({ compactHeader }: { compactHeader?: React.ReactNode } = {}) {
  const navigate = useNavigate();
  const { createDossier } = useDossiers();
  const { addresses } = useAddresses();
  const { user } = useAuth();

  /* ── Session restoration: detect returning users ── */
  const initialSession = useMemo(loadSession, []);
  const [step, setStep] = useState<Step>(() => {
    if (initialSession.exitedAt && initialSession.hub) return 'returning';
    if (initialSession.ordered === 'yes') return 'tracking';
    if (initialSession.ordered === 'no' && initialSession.hub) return 'pre-order';
    return 'ask';
  });

  /* ── Pre-order flow state ── */
  const landingHub = useMemo(readLandingHub, []);
  const [hub, setHubState] = useState<string | null>(initialSession.hub ?? landingHub);
  const [destination, setDestination] = useState<string | null>(initialSession.destination);
  const [copied, setCopied] = useState(false);
  const [reminderEmail, setReminderEmail] = useState('');
  const [reminderSaved, setReminderSaved] = useState(false);

  /* ── Tracking flow state ── */
  const [trackingInput, setTrackingInput] = useState('');
  const [parsing, setParsing] = useState(false);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [trackingEntries, setTrackingEntries] = useState<ParsedTracking[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  /**
   * Recommended hub is now durable state — it survives step navigation and
   * is only cleared when the user manually picks a different hub.
   */
  const [recommendedHub, setRecommendedHub] = useState<HubId | null>(initialSession.recommendedHub);

  /* ── Derived ──
   * Real per-user address requires sign-up (RLS-protected). For unauthenticated
   * visitors we synthesize a public template so the flow keeps progressing
   * after they pick a hub — the personal `identifier_code` is filled in once
   * they sign in (a banner prompts them).
   */
  const hubAddress = useMemo(() => {
    if (!hub) return null;
    const real = addresses.find(a => a.country === hub);
    if (real) return real;
    const template = FALLBACK_HUB_ADDRESS[hub];
    if (!template) return null;
    return {
      id: `fallback-${hub}`,
      country: hub as any,
      address_line: template,
      identifier_code: '',
      user_id: '',
      created_at: new Date().toISOString(),
    } as ReturnType<typeof useAddresses>['addresses'][number];
  }, [hub, addresses]);
  const isFallbackAddress = !!hubAddress && !hubAddress.identifier_code;
  const portals = hub ? EXTERNAL_PORTAL[hub] ?? [] : [];

  /** Wraps setHub: any *manual* hub change clears the recommendation. */
  const setHub = (next: string | null) => {
    setHubState(next);
    if (next) setRecommendedHub(null);
  };

  /** Auto-detect: update the persisted recommendation when input/items change,
   *  but never override an existing user pick. */
  useEffect(() => {
    if (hub) return; // user already chose — leave them alone
    const fromInput = detectHubFromInput(trackingInput);
    if (fromInput) { setRecommendedHub(prev => prev === fromInput ? prev : fromInput); return; }
    for (const it of items) {
      const fromItem = detectHubFromInput(`${it.platform} ${it.source}`);
      if (fromItem) { setRecommendedHub(prev => prev === fromItem ? prev : fromItem); return; }
    }
  }, [trackingInput, items, hub]);

  /* ── Persist core selections ── */
  useEffect(() => {
    if (step === 'ask') return;
    saveSession({ hub, destination, recommendedHub });
  }, [hub, destination, recommendedHub, step]);

  /* Once we've consumed the landing hand-off, clear it so it doesn't leak. */
  useEffect(() => {
    if (landingHub) clearLandingHub();
  }, [landingHub]);

  /* Cross-component bridge: header button can request "Mes commandes" view. */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { step?: Step } | undefined;
      if (detail?.step) setStep(detail.step);
    };
    window.addEventListener('yobbante:receive-flow:goto', handler);
    return () => window.removeEventListener('yobbante:receive-flow:goto', handler);
  }, []);

  /* ── Handlers — ASK step ── */
  function chooseOrdered(value: 'yes' | 'no') {
    saveSession({ ordered: value });
    setStep(value === 'yes' ? 'tracking' : 'pre-order');
  }

  /* ── Handlers — PRE-ORDER step ── */
  function copyAddress() {
    if (!hubAddress) return;
    const text = hubAddress.identifier_code
      ? `${hubAddress.address_line}\nRéf: ${hubAddress.identifier_code}`
      : hubAddress.address_line;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(
      isFallbackAddress
        ? 'Adresse copiée. Connectez-vous pour obtenir votre code destinataire personnel.'
        : 'Adresse copiée — collez-la dans le formulaire de livraison',
    );
    setTimeout(() => setCopied(false), 1800);
  }

  function openExternal(url: string) {
    saveSession({ exitedAt: Date.now(), generatedAt: Date.now() });
    window.open(url, '_blank', 'noopener,noreferrer');
    toast.info('Bonne commande ! Revenez ici pour suivre votre colis.', { duration: 6000 });
  }

  function saveReminder() {
    const v = reminderEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      toast.error('Email invalide');
      return;
    }
    // Stored locally — server-side reminder dispatch can be wired in later.
    saveSession({ generatedAt: Date.now() });
    try { localStorage.setItem('yobbante.receive.reminder', v); } catch { /* noop */ }
    setReminderSaved(true);
    toast.success('Rappel enregistré ✓');
  }

  /* ── Handlers — TRACKING step ── */
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  function focusItem(i: number) { itemRefs.current[i]?.focus(); }

  async function runParse(input?: string) {
    const v = (input ?? trackingInput).trim();
    if (v.length < 4) return;

    // 1) tracking signal extraction (always)
    const tk = parseTrackingInput(v);

    // 2) product enrichment via parse-product (works on URLs and free-text)
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-product', { body: { input: v } });
      if (error) throw error;
      const item: ParsedItem = {
        id: crypto.randomUUID(),
        source: v,
        title: data?.title || tk.productHint || (tk.trackingNumber ? `Colis ${tk.trackingNumber}` : v.slice(0, 60)),
        platform: data?.platform || tk.merchant || tk.carrier || 'Inconnu',
        estimatedPriceEur: data?.estimatedPriceEur ?? 0,
        estimatedWeightKg: data?.estimatedWeightKg ?? 0.5,
        imageUrl: data?.imageUrl ?? '',
      };
      setItems(prev => [...prev, item]);
      setTrackingEntries(prev => [...prev, tk]);
      setTrackingInput('');
      const detected = tk.trackingNumber ? `· suivi ${tk.carrier}` : '';
      toast.success(`Commande ajoutée ${detected}`);
    } catch {
      // Fallback: store the raw entry with whatever we extracted locally.
      const item: ParsedItem = {
        id: crypto.randomUUID(),
        source: v,
        title: tk.productHint || (tk.trackingNumber ? `Colis ${tk.trackingNumber}` : v.slice(0, 60)),
        platform: tk.merchant || tk.carrier || 'Inconnu',
        estimatedPriceEur: 0,
        estimatedWeightKg: 0.5,
        imageUrl: '',
      };
      setItems(prev => [...prev, item]);
      setTrackingEntries(prev => [...prev, tk]);
      setTrackingInput('');
      toast.success('Commande ajoutée');
    } finally { setParsing(false); }
  }

  function removeItem(id: string) {
    const idx = items.findIndex(it => it.id === id);
    if (idx < 0) return;
    const removed = items[idx];
    const removedTk = trackingEntries[idx];
    setItems(prev => prev.filter(it => it.id !== id));
    setTrackingEntries(prev => prev.filter((_, i) => i !== idx));
    toast('Commande retirée', {
      description: removed.title,
      action: {
        label: 'Annuler',
        onClick: () => {
          setItems(prev => {
            if (prev.some(it => it.id === removed.id)) return prev;
            const next = [...prev];
            next.splice(Math.min(idx, next.length), 0, removed);
            return next;
          });
          setTrackingEntries(prev => {
            const next = [...prev];
            next.splice(Math.min(idx, next.length), 0, removedTk);
            return next;
          });
        },
      },
      duration: 5000,
    });
  }

  function onInputKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (trackingInput.trim().length >= 4 && !parsing) runParse();
    } else if (e.key === 'ArrowDown' && items.length > 0) {
      e.preventDefault(); focusItem(0);
    }
  }
  function onItemKey(e: KeyboardEvent<HTMLLIElement>, index: number) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (index + 1 < items.length) focusItem(index + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (index > 0) focusItem(index - 1); else inputRef.current?.focus();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      const id = items[index]?.id; if (id) removeItem(id);
    }
  }

  // Auto-parse pasted URL
  useEffect(() => {
    const v = trackingInput.trim();
    if (v.length < 8) return;
    if (!/^https?:\/\//i.test(v)) return;
    const t = setTimeout(() => runParse(v), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingInput]);

  /* ── Submit (tracking step → create dossier) ── */
  async function submitTracking() {
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.message('Connectez-vous pour finaliser — vos colis restent enregistrés.');
        navigate(`/auth?redirect=${encodeURIComponent('/expedier/recevoir')}`);
        return;
      }
      const totalWeight = items.reduce((s, it) => s + (it.estimatedWeightKg || 0.5), 0);
      const totalValue = items.reduce((s, it) => s + (it.estimatedPriceEur || 0), 0);
      const productSummary = items.map((it, i) => {
        const tk = trackingEntries[i];
        const trackBits = [tk?.carrier, tk?.trackingNumber].filter(Boolean).join(' · ');
        return `• ${it.title} — ${it.platform}${trackBits ? ` (${trackBits})` : ''}`;
      }).join('\n');

      const dossier = await createDossier.mutateAsync({
        product_description: items.length === 1
          ? `Réception: ${items[0].title}`
          : `Réception groupée: ${items.length} commandes`,
        estimated_weight: totalWeight || null,
        origin_country: (hub ?? 'CN') as WarehouseCountry,
        destination_country: destination ?? 'SN',
        budget_eur: totalValue || null,
        notes: [
          'Type: Réception (commande déjà passée)',
          `Hub: ${hub ? COUNTRY_NAME(hub) : 'À définir'}`,
          destination ? `Destination: ${COUNTRY_NAME(destination)}` : null,
          `Commandes:\n${productSummary}`,
        ].filter(Boolean).join('\n'),
      });
      setReference(dossier.reference);
      clearSession();
      toast.success('Suivi activé 📦');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur';
      toast.error(message);
    } finally { setSubmitting(false); }
  }

  /* ── Success screen ── */
  if (reference) {
    return (
      <FlowShell theme="dark" compactHeader={compactHeader}>
        <FlowSuccess
          reference={reference}
          title="Vos commandes sont sous suivi."
          subtitle="Nous vous notifions à chaque étape : achat, en route, reçu au hub, expédié, livré."
          ctaHref="/app" ctaLabel="Voir mon espace"
        />
      </FlowShell>
    );
  }

  /* ── Render shell ── */
  return (
    <FlowShell theme="dark" compactHeader={compactHeader}>
      {!compactHeader && (
        <FlowHero
          eyebrow="Expédier · Recevoir"
          title="On réceptionne, on suit, on vous livre."
          subtitle="Que votre commande soit déjà passée ou non, Yobbanté vous accompagne sans friction — même quand vous quittez la plateforme."
        />
      )}

      {/* ── STEP A: ASK ────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {step === 'ask' && (
          <motion.div
            key="ask"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
          >
            <FlowSection revealed title="Avez-vous déjà passé votre commande ?" hint="On adapte la suite selon votre situation.">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl">
                <ChoicePill
                  icon={<ShoppingBag className="w-5 h-5" />}
                  title="Non, pas encore"
                  desc="Je veux d'abord récupérer mon adresse Yobbanté."
                  onClick={() => chooseOrdered('no')}
                />
                <ChoicePill
                  icon={<Package className="w-5 h-5" />}
                  title="Oui, déjà commandé"
                  desc="J'ai un lien de commande ou un numéro de suivi."
                  onClick={() => chooseOrdered('yes')}
                  accent
                />
                <ChoicePill
                  icon={<Inbox className="w-5 h-5" />}
                  title="Réception internationale"
                  desc="J'ai commandé sur Amazon, AliExpress… et j'ai besoin d'une adresse relais."
                  onClick={() => setStep('reception')}
                />
                <ChoicePill
                  icon={<ListChecks className="w-5 h-5" />}
                  title="Suivre mes commandes"
                  desc="Voir mes commandes en cours, déjà réceptionnées ou en route."
                  onClick={() => setStep('orders')}
                />
              </div>
            </FlowSection>
          </motion.div>
        )}

        {/* ── STEP B: RETURNING USER ─────────────────────────────────── */}
        {step === 'returning' && (
          <motion.div
            key="returning"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
          >
            <FlowSection revealed title="Bon retour 👋" hint="Vous avez généré une adresse récemment. Souhaitez-vous suivre votre colis ?">
              <div className="rounded-2xl border-2 border-yellow-400/40 bg-yellow-400/5 p-5 max-w-xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-400 text-zinc-950 flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">Suivre votre commande</p>
                    <p className="mt-1 text-xs text-white/60 leading-relaxed">
                      Collez votre lien de commande, votre numéro de suivi ou votre email de confirmation.
                      On extrait tout automatiquement.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => setStep('tracking')}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-yellow-400 text-zinc-950 rounded-lg px-3 py-2 hover:bg-yellow-300 transition-colors"
                      >
                        <ArrowRight className="w-3.5 h-3.5" /> Ajouter ma commande
                      </button>
                      <button
                        onClick={() => { clearSession(); setStep('ask'); setHub(null); setDestination(null); }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white border border-white/15 hover:border-white/30 rounded-lg px-3 py-2 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Recommencer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </FlowSection>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STEP C: PRE-ORDER (no order yet) ─────────────────────────── */}
      {step === 'pre-order' && (
        <PreOrderFlow
          hub={hub} setHub={setHub}
          recommendedHub={recommendedHub}
          hubAddress={hubAddress}
          isFallbackAddress={isFallbackAddress}
          isAuthenticated={!!user}
          portals={portals}
          copied={copied}
          copyAddress={copyAddress}
          openExternal={openExternal}
          reminderEmail={reminderEmail}
          setReminderEmail={setReminderEmail}
          reminderSaved={reminderSaved}
          saveReminder={saveReminder}
          goTracking={() => setStep('tracking')}
          goBack={() => setStep('ask')}
          goSignIn={() => navigate('/auth?redirect=/expedier/recevoir')}
        />
      )}

      {/* ── STEP D: TRACKING / IMPORT ────────────────────────────────── */}
      {step === 'tracking' && (
        <TrackingFlow
          hub={hub} setHub={setHub}
          destination={destination} setDestination={setDestination}
          recommendedHub={recommendedHub}
          inputRef={inputRef} itemRefs={itemRefs}
          trackingInput={trackingInput} setTrackingInput={setTrackingInput}
          parsing={parsing}
          items={items} trackingEntries={trackingEntries}
          onInputKey={onInputKey} onItemKey={onItemKey}
          runParse={runParse}
          removeItem={removeItem}
          submitting={submitting} submitTracking={submitTracking}
          goBack={() => setStep(initialSession.ordered === 'no' ? 'pre-order' : 'ask')}
        />
      )}

      {/* ── STEP E: ORDERS — track existing orders ───────────────────── */}
      {step === 'orders' && (
        <OrdersOverview
          isAuthenticated={!!user}
          goBack={() => setStep('ask')}
          goAddOrder={() => setStep('tracking')}
          goSignIn={() => navigate('/auth?redirect=/expedier/recevoir')}
        />
      )}

      {/* ── STEP F: RECEPTION — register an international order ──────── */}
      {step === 'reception' && (
        <ReceptionRegisterFlow goBack={() => setStep('ask')} />
      )}
    </FlowShell>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Sub-component: Choice pill
   ────────────────────────────────────────────────────────────────────── */

function ChoicePill({
  icon, title, desc, onClick, accent,
}: { icon: React.ReactNode; title: string; desc: string; onClick: () => void; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group text-left rounded-2xl border-2 p-5 transition-all hover:-translate-y-0.5',
        accent
          ? 'border-yellow-400/40 bg-yellow-400/[0.06] hover:border-yellow-400 hover:bg-yellow-400/[0.1]'
          : 'border-white/10 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.05]'
      )}
    >
      <div className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center',
        accent ? 'bg-yellow-400 text-zinc-950' : 'bg-white/10 text-white'
      )}>
        {icon}
      </div>
      <p className="mt-4 text-base font-bold text-white">{title}</p>
      <p className="mt-1.5 text-xs text-white/55 leading-relaxed">{desc}</p>
      <span className={cn(
        'mt-4 inline-flex items-center gap-1.5 text-xs font-semibold transition-all group-hover:gap-2.5',
        accent ? 'text-yellow-400' : 'text-white/80'
      )}>
        Continuer <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   PRE-ORDER FLOW
   ────────────────────────────────────────────────────────────────────── */

function PreOrderFlow({
  hub, setHub, recommendedHub, hubAddress, isFallbackAddress, isAuthenticated,
  portals, copied, copyAddress, openExternal,
  reminderEmail, setReminderEmail, reminderSaved, saveReminder,
  goTracking, goBack, goSignIn,
}: {
  hub: string | null; setHub: (v: string) => void;
  recommendedHub: HubId | null;
  hubAddress: ReturnType<typeof useAddresses>['addresses'][number] | null | undefined;
  isFallbackAddress: boolean;
  isAuthenticated: boolean;
  portals: { label: string; url: string }[];
  copied: boolean; copyAddress: () => void;
  openExternal: (url: string) => void;
  reminderEmail: string; setReminderEmail: (v: string) => void;
  reminderSaved: boolean; saveReminder: () => void;
  goTracking: () => void; goBack: () => void;
  goSignIn: () => void;
}) {
  const TOTAL = 4;
  return (
    <>
      <div className="pt-2">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white/80 transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> Changer de réponse
        </button>
      </div>

      <FlowSection
        revealed step={1} total={TOTAL}
        title="Choisissez où recevoir votre colis"
        hint="Notre réseau de 6 hubs internationaux réceptionne et consolide vos commandes."
      >
        <HubsWorldMap
          value={hub}
          onChange={(id) => setHub(id)}
          recommended={recommendedHub}
          variant="dark"
        />
      </FlowSection>

      <FlowSection
        revealed={!!hubAddress} step={2} total={TOTAL}
        title="Votre adresse Yobbanté"
        hint="Copiez-la et collez-la comme adresse de livraison sur votre site marchand."
      >
        {hubAddress && (
          <div className="rounded-2xl border-2 border-yellow-400/40 bg-yellow-400/5 p-5 max-w-xl">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-yellow-400 font-semibold">
                  Adresse {COUNTRY_NAME(hub!)}
                </p>
                <p className="mt-2 text-sm text-white whitespace-pre-line leading-relaxed">
                  {hubAddress.address_line}
                </p>
                {isFallbackAddress ? (
                  <div className="mt-3 rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-3 py-2.5">
                    <p className="text-[11px] text-yellow-100 leading-snug">
                      <span className="font-semibold text-yellow-300">Connectez-vous</span> pour obtenir
                      votre <span className="font-semibold">code destinataire personnel</span> (indispensable
                      pour qu'on identifie votre colis à l'arrivée au hub).
                    </p>
                    <button
                      onClick={goSignIn}
                      className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-950 bg-yellow-400 hover:bg-yellow-300 rounded-md px-2.5 py-1.5 transition-colors"
                    >
                      Se connecter <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className="text-white/50">Référence destinataire:</span>
                    <code className="font-mono font-semibold text-yellow-400">{hubAddress.identifier_code}</code>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={copyAddress}
              className="mt-4 inline-flex items-center gap-2 text-xs font-semibold bg-yellow-400 text-zinc-950 rounded-lg px-3 py-2 hover:bg-yellow-300 transition-colors w-full sm:w-auto justify-center"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copié' : 'Copier l\'adresse'}
            </button>
          </div>
        )}
      </FlowSection>

      <FlowSection
        revealed={!!hubAddress} step={3} total={TOTAL}
        title="Comment l'utiliser"
        hint="3 étapes simples — ça prend moins d'une minute."
      >
        <ol className="space-y-3 max-w-xl">
          {[
            { n: 1, title: 'Copiez l\'adresse', desc: 'Bouton ci-dessus, tout est inclus (référence + ligne complète).' },
            { n: 2, title: 'Allez sur votre site', desc: 'Amazon, Alibaba, Shein… ouvrez le panier ou la fiche produit.' },
            { n: 3, title: 'Collez comme adresse de livraison', desc: 'Au moment du checkout. Finalisez la commande normalement.' },
          ].map(s => (
            <li key={s.n} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="w-7 h-7 rounded-full bg-yellow-400 text-zinc-950 text-xs font-bold flex items-center justify-center shrink-0">
                {s.n}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{s.title}</p>
                <p className="mt-0.5 text-xs text-white/55 leading-relaxed">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        {portals.length > 0 && (
          <div className="mt-6 max-w-xl">
            <p className="text-[10px] uppercase tracking-wider text-white/45 font-semibold mb-2.5">
              Sites recommandés depuis {COUNTRY_NAME(hub!)}
            </p>
            <div className="flex flex-wrap gap-2">
              {portals.map(p => (
                <button
                  key={p.url}
                  onClick={() => openExternal(p.url)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/25 text-white rounded-lg px-3 py-2 transition-colors"
                >
                  {p.label} <ExternalLink className="w-3 h-3 opacity-60" />
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-white/45">
              On garde votre session — revenez ici dès que c'est commandé pour activer le suivi.
            </p>
          </div>
        )}
      </FlowSection>

      <FlowSection
        revealed={!!hubAddress} step={4} total={TOTAL}
        title="Recevoir un rappel ?"
        hint="On vous envoie un message quand vous reviendrez, pour activer le suivi en un clic."
      >
        <div className="max-w-xl">
          {reminderSaved ? (
            <div className="rounded-xl border-2 border-emerald-400/30 bg-emerald-400/5 p-4 flex items-center gap-2.5">
              <Check className="w-4 h-4 text-emerald-400" strokeWidth={3} />
              <p className="text-sm font-semibold text-white">Rappel programmé sur {reminderEmail}</p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Bell className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55" />
                <input
                  type="email"
                  value={reminderEmail}
                  onChange={(e) => setReminderEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  className="w-full border-2 rounded-xl pl-10 pr-4 py-3 text-sm bg-white/[0.03] border-white/10 placeholder:text-white/30 focus:outline-none focus:border-yellow-400/60 transition-colors"
                />
              </div>
              <button
                onClick={saveReminder}
                className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold bg-white/10 hover:bg-white/15 text-white rounded-xl px-4 py-3 transition-colors"
              >
                Activer
              </button>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-white/55 mb-3">
              Déjà commandé entre-temps ?
            </p>
            <button
              onClick={goTracking}
              className="inline-flex items-center gap-2 text-sm font-semibold bg-yellow-400 text-zinc-950 rounded-xl px-5 py-3 hover:bg-yellow-300 transition-colors"
            >
              <Truck className="w-4 h-4" /> Suivre ma commande
            </button>
          </div>
        </div>
      </FlowSection>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   TRACKING FLOW (import order — link / number / text)
   ────────────────────────────────────────────────────────────────────── */

function TrackingFlow({
  hub, setHub, destination, setDestination, recommendedHub,
  inputRef, itemRefs,
  trackingInput, setTrackingInput, parsing,
  items, trackingEntries, onInputKey, onItemKey,
  runParse, removeItem,
  submitting, submitTracking,
  goBack,
}: {
  hub: string | null; setHub: (v: string) => void;
  destination: string | null; setDestination: (v: string) => void;
  recommendedHub: HubId | null;
  inputRef: React.RefObject<HTMLInputElement>;
  itemRefs: React.MutableRefObject<Array<HTMLLIElement | null>>;
  trackingInput: string; setTrackingInput: (v: string) => void;
  parsing: boolean;
  items: ParsedItem[]; trackingEntries: ParsedTracking[];
  onInputKey: (e: KeyboardEvent<HTMLInputElement>) => void;
  onItemKey: (e: KeyboardEvent<HTMLLIElement>, i: number) => void;
  runParse: (input?: string) => void;
  removeItem: (id: string) => void;
  submitting: boolean; submitTracking: () => void;
  goBack: () => void;
}) {
  const TOTAL = 3;
  const hasItems = items.length > 0;
  const trackedCount = trackingEntries.filter(e => !!e.trackingNumber).length;

  return (
    <>
      <div className="pt-2">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white/80 transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> Retour
        </button>
      </div>

      <FlowSection
        revealed step={1} total={TOTAL}
        title="Ajoutez votre commande"
        hint="3 façons : lien de commande, numéro de suivi, ou collez l'email de confirmation. On extrait tout automatiquement."
      >
        <div className="space-y-3 max-w-xl">
          <div className="relative">
            <Link2 className="absolute left-3.5 top-3.5 w-4 h-4 text-white/55" />
            <textarea
              ref={inputRef as unknown as React.RefObject<HTMLTextAreaElement>}
              value={trackingInput}
              onChange={(e) => setTrackingInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (trackingInput.trim().length >= 4 && !parsing) runParse();
                }
              }}
              placeholder={'Lien Amazon, numéro 1ZXXXX…, ou contenu de l\'email de confirmation\n\n↵ pour ajouter · Maj+↵ pour nouvelle ligne'}
              rows={3}
              className="w-full border-2 rounded-xl pl-10 pr-4 py-3.5 text-sm focus:outline-none transition-all bg-white/[0.03] border-white/10 placeholder:text-white/30 focus:border-yellow-400/60 resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <FormatHint icon={<Link2 className="w-3 h-3" />} label="Lien" />
            <FormatHint icon={<Hash className="w-3 h-3" />} label="N° suivi" />
            <FormatHint icon={<FileText className="w-3 h-3" />} label="Email" />
          </div>

          <button
            onClick={() => runParse()}
            disabled={parsing || trackingInput.trim().length < 4}
            className="inline-flex items-center gap-2 text-sm font-semibold text-yellow-400 hover:text-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {parsing ? 'Analyse en cours…' : 'Ajouter cette commande'}
          </button>
        </div>

        {/* Items list */}
        <AnimatePresence initial={false}>
          {items.length > 0 && (
            <motion.ul
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="mt-6 space-y-2.5 max-w-xl"
              onKeyDown={(e) => e.stopPropagation()}
            >
              {items.map((it, idx) => {
                const tk = trackingEntries[idx];
                return (
                  <motion.li
                    key={it.id}
                    ref={(el) => { itemRefs.current[idx] = el; }}
                    layout tabIndex={0}
                    onKeyDown={(e) => onItemKey(e, idx)}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                    className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4 flex gap-3 sm:gap-4 hover:border-white/20 focus:outline-none focus:border-yellow-400/60 focus:ring-2 focus:ring-yellow-400/20 transition-colors"
                  >
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                      {it.imageUrl
                        ? <img src={it.imageUrl} alt={it.title} className="w-full h-full object-cover" />
                        : <Inbox className="w-6 h-6 text-white/30" />}
                    </div>
                    <div className="min-w-0 flex-1 pr-7">
                      <p className="text-[10px] uppercase tracking-wider text-yellow-400/80 font-medium">{it.platform}</p>
                      <p className="mt-0.5 text-sm font-semibold leading-snug line-clamp-2 text-white">{it.title}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/55">
                        {tk?.trackingNumber && (
                          <span className="inline-flex items-center gap-1 text-emerald-400">
                            <Sparkles className="w-3 h-3" />
                            {tk.carrier} · <code className="font-mono">{tk.trackingNumber}</code>
                          </span>
                        )}
                        {!tk?.trackingNumber && (
                          <span className="text-white/35">Suivi à venir</span>
                        )}
                        {it.estimatedPriceEur > 0 && <span className="font-semibold text-white">{it.estimatedPriceEur}€</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(it.id)}
                      aria-label="Supprimer cette commande"
                      className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-white/35 hover:text-white hover:bg-white/10 transition-all opacity-60 group-hover:opacity-100 group-focus-within:opacity-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>

        {hasItems && (
          <div className="mt-3 flex items-center gap-3 text-[11px] text-white/45 max-w-xl">
            <span>{items.length} commande{items.length > 1 ? 's' : ''}</span>
            {trackedCount > 0 && (
              <>
                <span className="opacity-50">·</span>
                <span className="text-emerald-400 inline-flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> {trackedCount} suivi{trackedCount > 1 ? 's' : ''} actif{trackedCount > 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        )}
      </FlowSection>

      <FlowSection
        revealed={hasItems} step={2} total={TOTAL}
        title="Hub de réception"
        hint={recommendedHub
          ? "On a détecté l'origine de votre commande — un hub est suggéré."
          : "Où arrive le colis avant qu'on vous le réexpédie."}
      >
        <HubsWorldMap
          value={hub}
          onChange={(id) => setHub(id)}
          recommended={recommendedHub}
          variant="dark"
        />
      </FlowSection>

      <FlowSection
        revealed={hasItems && !!hub} step={3} total={TOTAL}
        title="Où vous livrer ?"
      >
        <CountryGrid countries={DESTINATIONS} value={destination} onChange={setDestination} />
      </FlowSection>

      {/* Sticky submit bar */}
      <AnimatePresence>
        {hasItems && hub && destination && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed bottom-0 inset-x-0 z-40 border-t bg-zinc-950/95 backdrop-blur-md border-white/10"
          >
            <div className="mx-auto max-w-3xl px-5 sm:px-8 py-3.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-white/45 font-medium">Récap</p>
                <p className="text-xs text-white/85 truncate">
                  {items.length} commande{items.length > 1 ? 's' : ''} · {COUNTRY_NAME(hub)} → {COUNTRY_NAME(destination)}
                  {trackedCount > 0 && ` · ${trackedCount} suivi${trackedCount > 1 ? 's' : ''}`}
                </p>
              </div>
              <button
                onClick={submitTracking}
                disabled={submitting}
                className="inline-flex items-center gap-2 text-sm font-semibold bg-yellow-400 text-zinc-950 rounded-xl px-5 py-3 hover:bg-yellow-300 disabled:opacity-50 transition-colors shrink-0"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {submitting ? 'Activation…' : 'Activer le suivi'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function FormatHint({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-1.5 text-[11px] text-white/55">
      <span className="text-yellow-400/80">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   ORDERS OVERVIEW — track in-progress / received / shipped orders
   ────────────────────────────────────────────────────────────────────── */

type OrderRow = {
  id: string;
  source: 'dossier' | 'shipment' | 'package' | 'reception';
  reference: string;
  title: string;
  subtitle?: string;
  status: string;
  statusLabel: string;
  statusTone: 'info' | 'progress' | 'success' | 'warning';
  createdAt: string;
};

const SHIPMENT_STATUS_LABEL: Record<string, { label: string; tone: OrderRow['statusTone'] }> = {
  PENDING:           { label: 'En attente',          tone: 'info' },
  CONFIRMED:         { label: 'Confirmé',            tone: 'progress' },
  WAITING_FOR_MATCH: { label: 'Attente départ',      tone: 'progress' },
  MATCHED:           { label: 'Départ assigné',      tone: 'progress' },
  IN_PREPARATION:    { label: 'Préparation',         tone: 'progress' },
  IN_TRANSIT:        { label: 'En transit',          tone: 'progress' },
  CUSTOMS:           { label: 'Douane',              tone: 'progress' },
  ARRIVED:           { label: 'Arrivé',              tone: 'progress' },
  OUT_FOR_DELIVERY:  { label: 'En livraison',        tone: 'progress' },
  DELIVERED:         { label: 'Livré',               tone: 'success' },
  ON_HOLD:           { label: 'En attente',          tone: 'warning' },
  CANCELLED:         { label: 'Annulé',              tone: 'warning' },
};

const PACKAGE_STATUS_LABEL: Record<string, { label: string; tone: OrderRow['statusTone'] }> = {
  CREATED:        { label: 'Attendu',          tone: 'info' },
  RECEIVED:       { label: 'Reçu au hub',      tone: 'progress' },
  IN_STORAGE:     { label: 'En stockage',      tone: 'progress' },
  READY_TO_SHIP:  { label: 'Prêt à partir',    tone: 'progress' },
  SHIPPED:        { label: 'Expédié',          tone: 'progress' },
  DELIVERED:      { label: 'Livré',            tone: 'success' },
};

const DOSSIER_STATUS_LABEL: Record<string, { label: string; tone: OrderRow['statusTone'] }> = {
  SUBMITTED:    { label: 'Envoyé',          tone: 'info' },
  IN_REVIEW:    { label: 'En revue',        tone: 'progress' },
  QUOTED:       { label: 'Devis prêt',      tone: 'progress' },
  CONFIRMED:    { label: 'Confirmé',        tone: 'progress' },
  IN_PROGRESS:  { label: 'En cours',        tone: 'progress' },
  RECEIVED:     { label: 'Réceptionné',     tone: 'progress' },
  SHIPPED:      { label: 'Expédié',         tone: 'progress' },
  DELIVERED:    { label: 'Livré',           tone: 'success' },
  CANCELLED:    { label: 'Annulé',          tone: 'warning' },
};

const RECEPTION_STATUS_LABEL: Record<string, { label: string; tone: OrderRow['statusTone'] }> = {
  pending_arrival: { label: 'Attendu au relais',  tone: 'info' },
  received:        { label: 'Reçu au relais',     tone: 'progress' },
  inspected:       { label: 'Inspecté · Devis',   tone: 'progress' },
  consolidated:    { label: 'Consolidé',          tone: 'progress' },
  in_transit:      { label: 'En transit',         tone: 'progress' },
  customs:         { label: 'Douane',             tone: 'progress' },
  delivered:       { label: 'Livré',              tone: 'success' },
  cancelled:       { label: 'Annulé',             tone: 'warning' },
};

function OrdersOverview({
  isAuthenticated, goBack, goAddOrder, goSignIn,
}: {
  isAuthenticated: boolean;
  goBack: () => void;
  goAddOrder: () => void;
  goSignIn: () => void;
}) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [{ data: dossiers }, { data: shipments }, { data: packages }] = await Promise.all([
          supabase.from('dossiers')
            .select('id, reference, product_description, status, created_at, origin_country, destination_country')
            .order('created_at', { ascending: false }).limit(20),
          supabase.from('shipments')
            .select('id, tracking_number, status, created_at, origin_country, destination_country, weight_kg')
            .order('created_at', { ascending: false }).limit(20),
          supabase.from('packages')
            .select('id, description, status, created_at, warehouse_country')
            .order('created_at', { ascending: false }).limit(20),
        ]);

        const out: OrderRow[] = [];
        for (const d of dossiers ?? []) {
          const meta = DOSSIER_STATUS_LABEL[d.status as string] ?? { label: d.status, tone: 'info' as const };
          out.push({
            id: d.id, source: 'dossier',
            reference: d.reference,
            title: d.product_description?.split('\n')[0]?.slice(0, 80) ?? 'Dossier',
            subtitle: `${d.origin_country} → ${d.destination_country}`,
            status: d.status, statusLabel: meta.label, statusTone: meta.tone,
            createdAt: d.created_at,
          });
        }
        for (const s of shipments ?? []) {
          const meta = SHIPMENT_STATUS_LABEL[s.status as string] ?? { label: s.status, tone: 'info' as const };
          out.push({
            id: s.id, source: 'shipment',
            reference: s.tracking_number ?? s.id.slice(0, 8),
            title: `Envoi ${s.tracking_number ?? ''}`.trim(),
            subtitle: `${s.origin_country} → ${s.destination_country}${s.weight_kg ? ` · ${s.weight_kg} kg` : ''}`,
            status: s.status, statusLabel: meta.label, statusTone: meta.tone,
            createdAt: s.created_at,
          });
        }
        for (const p of packages ?? []) {
          const meta = PACKAGE_STATUS_LABEL[p.status as string] ?? { label: p.status, tone: 'info' as const };
          out.push({
            id: p.id, source: 'package',
            reference: p.id.slice(0, 8).toUpperCase(),
            title: p.description ?? 'Colis',
            subtitle: `Hub ${p.warehouse_country}`,
            status: p.status, statusLabel: meta.label, statusTone: meta.tone,
            createdAt: p.created_at,
          });
        }
        out.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        if (alive) setRows(out);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [isAuthenticated]);

  const toneClass = (t: OrderRow['statusTone']) =>
    t === 'success'   ? 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30'
    : t === 'warning' ? 'bg-amber-400/15  text-amber-300  border-amber-400/30'
    : t === 'progress'? 'bg-yellow-400/15 text-yellow-300 border-yellow-400/30'
    :                   'bg-white/8       text-white/70   border-white/15';

  return (
    <FlowSection
      revealed
      title="Mes commandes"
      hint="Suivi temps réel de vos colis attendus, en stockage et en route."
    >
      <div className="pt-1 mb-4">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white/80 transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> Changer de réponse
        </button>
      </div>

      {!isAuthenticated ? (
        <div className="rounded-2xl border-2 border-yellow-400/40 bg-yellow-400/5 p-5 max-w-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-400 text-zinc-950 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Connectez-vous pour voir vos commandes</p>
              <p className="mt-1 text-xs text-white/60 leading-relaxed">
                Vos colis, dossiers et envois en cours apparaîtront ici en temps réel.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={goSignIn}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-yellow-400 text-zinc-950 rounded-lg px-3 py-2 hover:bg-yellow-300 transition-colors"
                >
                  <ArrowRight className="w-3.5 h-3.5" /> Se connecter
                </button>
                <button
                  onClick={goAddOrder}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white border border-white/15 hover:border-white/30 rounded-lg px-3 py-2 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter une commande
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-white/55">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement de vos commandes…
        </div>
      ) : !rows || rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-white/10 bg-white/[0.03] p-6 max-w-xl text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-white/10 text-white flex items-center justify-center">
            <Inbox className="w-6 h-6" />
          </div>
          <p className="mt-4 text-sm font-semibold text-white">Aucune commande pour l'instant</p>
          <p className="mt-1 text-xs text-white/55">Ajoutez un suivi pour voir l'activité ici.</p>
          <button
            onClick={goAddOrder}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold bg-yellow-400 text-zinc-950 rounded-lg px-3 py-2 hover:bg-yellow-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter une commande
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-w-3xl">
          {rows.map((r) => (
            <button
              key={`${r.source}-${r.id}`}
              onClick={() => {
                if (r.source === 'dossier') navigate(`/dossier/${r.id}`);
                else navigate('/app');
              }}
              className="w-full text-left rounded-xl border border-white/10 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.06] transition-all p-3.5 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-white/10 text-white flex items-center justify-center shrink-0">
                {r.source === 'dossier' ? <FileText className="w-4 h-4" />
                  : r.source === 'shipment' ? <Truck className="w-4 h-4" />
                  : <Package className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-white truncate">{r.title}</p>
                  <span className={cn(
                    'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider rounded-full border px-2 py-0.5',
                    toneClass(r.statusTone),
                  )}>
                    {r.statusTone === 'success' && <CheckCircle2 className="w-2.5 h-2.5" />}
                    {r.statusTone === 'progress' && <Clock className="w-2.5 h-2.5" />}
                    {r.statusLabel}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-white/55 truncate">
                  {r.reference}{r.subtitle ? ` · ${r.subtitle}` : ''} · {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-white/40 shrink-0" />
            </button>
          ))}

          <button
            onClick={goAddOrder}
            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white border border-dashed border-white/15 hover:border-white/30 rounded-xl px-3 py-3 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter une commande à suivre
          </button>
        </div>
      )}
    </FlowSection>
  );
}
