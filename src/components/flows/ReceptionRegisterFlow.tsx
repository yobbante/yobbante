import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowRight, ArrowLeft, Loader2, Copy, Check, Package, ShoppingBag,
  AlertTriangle, Plane, Ship, Sparkles, Building2, ShieldCheck,
  ExternalLink, Hash, FileText, Tag, Minus, Plus, CheckCircle2, Zap,
} from 'lucide-react';
import { FlowSection } from './FlowPrimitives';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { RelayPicker, type RelayAddress } from './RelayPicker';

/* ──────────────────────────────────────────────────────────────────────
   Static data — merchants, carriers, goods types
   ────────────────────────────────────────────────────────────────────── */

type MerchantPreset = {
  name: string;
  suggestedRelay: string;
  badge?: { label: string; tone: 'info' | 'warn' | 'time' };
};

const MERCHANT_PRESETS: MerchantPreset[] = [
  { name: 'Amazon US',   suggestedRelay: 'US' },
  { name: 'Amazon FR',   suggestedRelay: 'FR' },
  { name: 'AliExpress',  suggestedRelay: 'CN', badge: { label: 'Délai habituel : 7-14j avant relais', tone: 'time' } },
  { name: 'eBay',        suggestedRelay: 'US' },
  { name: 'SHEIN',       suggestedRelay: 'CN', badge: { label: 'Délai habituel : 7-14j avant relais', tone: 'time' } },
  { name: 'Temu',        suggestedRelay: 'CN', badge: { label: 'Délai habituel : 7-14j avant relais', tone: 'time' } },
  { name: 'Etsy',        suggestedRelay: 'US' },
  { name: 'RockAuto',    suggestedRelay: 'US', badge: { label: 'Maritime recommandé', tone: 'info' } },
  { name: 'B&H Photo',   suggestedRelay: 'US' },
  { name: 'iHerb',       suggestedRelay: 'US', badge: { label: 'Documents douaniers requis', tone: 'warn' } },
];

type GoodsType = {
  id: 'standard' | 'electronic' | 'fragile' | 'auto_part' | 'cosmetic' | 'food' | 'high_value';
  label: string;
  desc: string;
  hint?: string;
};

const GOODS_TYPES: GoodsType[] = [
  { id: 'standard',   label: 'Standard',         desc: 'Articles courants' },
  { id: 'electronic', label: 'Électronique',     desc: 'Téléphone, ordinateur, accessoires' },
  { id: 'fragile',    label: 'Fragile',          desc: 'Verre, écran, instruments' },
  { id: 'auto_part',  label: 'Pièces auto',      desc: 'Maritime recommandé', hint: 'Les pièces auto sont souvent volumineuses — le maritime offre le meilleur rapport prix/poids.' },
  { id: 'cosmetic',   label: 'Cosmétiques',      desc: 'Documents requis',    hint: 'Ce type de produit peut nécessiter des documents à la douane. Notre équipe vous contactera si besoin.' },
  { id: 'food',       label: 'Alimentation',     desc: 'Documents requis',    hint: 'Ce type de produit peut nécessiter des documents à la douane. Notre équipe vous contactera si besoin.' },
  { id: 'high_value', label: 'Forte valeur',     desc: 'Assurance recommandée', hint: 'Pour les commandes ≥ 500 €, une assurance est recommandée — gérée à la réception.' },
];

/* ──────────────────────────────────────────────────────────────────────
   Carrier auto-detection
   ────────────────────────────────────────────────────────────────────── */

type CarrierMatch = {
  carrier: string;
  origin?: string;
  trackingUrl: (n: string) => string;
};

const CARRIER_PATTERNS: Array<{ re: RegExp } & CarrierMatch> = [
  { re: /^1Z[0-9A-Z]{16}$/i,           carrier: 'UPS',        origin: 'États-Unis', trackingUrl: n => `https://www.ups.com/track?tracknum=${n}` },
  { re: /^TBA\d{12}$/i,                 carrier: 'Amazon Logistics', origin: 'Variable',   trackingUrl: n => `https://track.amazon.com/tracking/${n}` },
  { re: /^[A-Z]{2}\d{9}CN$/i,           carrier: 'China Post', origin: 'Chine',      trackingUrl: n => `https://t.17track.net/en#nums=${n}` },
  { re: /^[A-Z]{2}\d{9}[A-Z]{2}$/i,     carrier: 'La Poste',   origin: 'France',     trackingUrl: n => `https://www.laposte.fr/outils/suivre-vos-envois?code=${n}` },
  { re: /^\d{12}$/,                     carrier: 'FedEx',      origin: 'États-Unis', trackingUrl: n => `https://www.fedex.com/fedextrack/?trknbr=${n}` },
  { re: /^\d{15}$/,                     carrier: 'FedEx',      origin: 'États-Unis', trackingUrl: n => `https://www.fedex.com/fedextrack/?trknbr=${n}` },
  { re: /^\d{10,11}$/,                  carrier: 'DHL',        origin: 'International', trackingUrl: n => `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${n}` },
];

function detectCarrier(input: string): CarrierMatch | null {
  const v = input.replace(/\s+/g, '').toUpperCase();
  if (v.length < 6) return null;
  for (const p of CARRIER_PATTERNS) {
    if (p.re.test(v)) return { carrier: p.carrier, origin: p.origin, trackingUrl: p.trackingUrl };
  }
  return null;
}

/* ──────────────────────────────────────────────────────────────────────
   State
   ────────────────────────────────────────────────────────────────────── */

type Step = 'merchant' | 'tracking' | 'description' | 'goods' | 'transport' | 'relay' | 'review' | 'success';
const STEP_ORDER: Step[] = ['merchant', 'tracking', 'description', 'goods', 'transport', 'relay', 'review'];

type FormState = {
  merchant_name: string;
  merchant_url: string;
  tracking_number: string;
  order_description: string;
  estimated_value_eur: string;
  expected_packages: number;
  goods_type: GoodsType['id'];
  transport_mode: 'air' | 'sea_lcl';
  priority: 'standard' | 'express';
  relay_address_id: string | null;
};

const EMPTY_FORM: FormState = {
  merchant_name: '',
  merchant_url: '',
  tracking_number: '',
  order_description: '',
  estimated_value_eur: '',
  expected_packages: 1,
  goods_type: 'standard',
  transport_mode: 'air',
  priority: 'standard',
  relay_address_id: null,
};

/* ──────────────────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────────────────── */

export function ReceptionRegisterFlow({ goBack }: { goBack: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('merchant');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [selectedRelay, setSelectedRelay] = useState<RelayAddress | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdReference, setCreatedReference] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Live transport pricing (XOF)
  const [pricing, setPricing] = useState<{
    air?:    { price_xof: number; days_min: number; days_max: number };
    sea_lcl?: { price_xof: number; days_min: number; days_max: number };
    express_delta_xof?: number;
    loading: boolean;
  }>({ loading: false });

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const merchantPreset = useMemo(
    () => MERCHANT_PRESETS.find(m => m.name === form.merchant_name) ?? null,
    [form.merchant_name],
  );

  const carrierMatch = useMemo(
    () => (form.tracking_number ? detectCarrier(form.tracking_number) : null),
    [form.tracking_number],
  );

  /** Country code suggested by chosen merchant — passed to RelayPicker. */
  const suggestedCountryCode = merchantPreset?.suggestedRelay ?? null;

  const goodsHint = useMemo(
    () => GOODS_TYPES.find(g => g.id === form.goods_type)?.hint ?? null,
    [form.goods_type],
  );

  /* ── Live quote: fetch when entering "transport" step ── */
  useEffect(() => {
    if (step !== 'transport' || !selectedRelay) return;
    const dest = selectedRelay.country_code || 'SN';
    // Use estimated weight (we don't ask user) → fallback heuristic by goods type
    const weight = form.goods_type === 'auto_part' ? 8
                  : form.goods_type === 'electronic' ? 2
                  : 1.5;

    let cancelled = false;
    setPricing(p => ({ ...p, loading: true }));

    Promise.all([
      supabase.rpc('calculate_quote_v2', {
        p_destination_country: dest,
        p_real_weight_kg: weight,
        p_transport_mode: 'air',
        p_priority: 'standard',
        p_goods_type: form.goods_type,
      }),
      supabase.rpc('calculate_quote_v2', {
        p_destination_country: dest,
        p_real_weight_kg: weight,
        p_transport_mode: 'sea_lcl',
        p_priority: 'standard',
        p_goods_type: form.goods_type,
      }),
      supabase.rpc('calculate_quote_v2', {
        p_destination_country: dest,
        p_real_weight_kg: weight,
        p_transport_mode: 'air',
        p_priority: 'express',
        p_goods_type: form.goods_type,
      }),
    ]).then(([air, sea, expr]) => {
      if (cancelled) return;
      const a = (air.data as any[])?.[0];
      const s = (sea.data as any[])?.[0];
      const e = (expr.data as any[])?.[0];
      setPricing({
        loading: false,
        air: a ? { price_xof: Number(a.price_xof), days_min: a.delivery_days_min, days_max: a.delivery_days_max } : undefined,
        sea_lcl: s ? { price_xof: Number(s.price_xof), days_min: s.delivery_days_min, days_max: s.delivery_days_max } : undefined,
        express_delta_xof: a && e ? Math.max(0, Number(e.price_xof) - Number(a.price_xof)) : undefined,
      });
    }).catch(() => !cancelled && setPricing({ loading: false }));

    return () => { cancelled = true; };
  }, [step, selectedRelay, form.goods_type]);

  /* ── Submit ── */
  const submit = async () => {
    if (!user) {
      toast.info("Connectez-vous pour enregistrer votre commande");
      navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (!form.relay_address_id || !form.merchant_name || !form.order_description) {
      toast.error("Champs obligatoires manquants");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from('reception_orders')
      .insert({
        user_id: user.id,
        relay_address_id: form.relay_address_id,
        merchant_name: form.merchant_name,
        merchant_url: form.merchant_url || null,
        order_reference: form.tracking_number || null,
        order_description: form.order_description
          + (form.tracking_number ? `\n\nN° suivi: ${form.tracking_number}${carrierMatch ? ` (${carrierMatch.carrier})` : ''}` : ''),
        estimated_value_eur: form.estimated_value_eur ? Number(form.estimated_value_eur) : null,
        expected_packages: form.expected_packages,
        goods_type: form.goods_type,
        transport_mode: form.transport_mode,
        priority: form.priority,
      })
      .select('reference')
      .single();
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setCreatedReference(data.reference as string);
    setStep('success');
  };

  const copyAddress = async () => {
    if (!selectedRelay || !createdReference) return;
    const lines = [
      selectedRelay.contact_name ?? 'Yobbanté',
      `Réf: ${createdReference}`,
      selectedRelay.address_line1,
      selectedRelay.address_line2,
      [selectedRelay.postal_code, selectedRelay.city].filter(Boolean).join(' '),
      selectedRelay.country,
      selectedRelay.phone ? `Tel: ${selectedRelay.phone}` : null,
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      setCopied(true);
      toast.success("Adresse copiée");
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("Impossible de copier"); }
  };

  /* ── Navigation helpers ── */
  const stepIndex = STEP_ORDER.indexOf(step);
  const goPrev = () => {
    if (step === 'success') return goBack();
    if (stepIndex <= 0) return goBack();
    setStep(STEP_ORDER[stepIndex - 1]);
  };
  const goNext = (s: Step) => setStep(s);

  return (
    <>
      {/* ── Header: back + progress ──────────────────────────────── */}
      <div className="pt-2 flex items-center justify-between gap-3">
        <button
          onClick={goPrev}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-white/55 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Retour
        </button>
        {step !== 'success' && (
          <div className="flex items-center gap-1">
            {STEP_ORDER.map((s, i) => (
              <div
                key={s}
                className={cn(
                  "h-1 rounded-full transition-all",
                  i <= stepIndex ? "bg-yellow-400 w-6" : "bg-white/10 w-3",
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* ──────────────────── STEP 1: MERCHANT ──────────────────── */}
      {step === 'merchant' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <FlowSection
            revealed
            title="Sur quel site avez-vous commandé ?"
            hint="Sélectionnez le marchand pour adapter le suivi et la douane."
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-w-3xl">
              {MERCHANT_PRESETS.map(m => {
                const active = form.merchant_name === m.name;
                return (
                  <button
                    key={m.name}
                    onClick={() => { update('merchant_name', m.name); goNext('tracking'); }}
                    className={cn(
                      "group relative rounded-xl border-2 p-3 text-left transition-all hover:-translate-y-0.5",
                      active
                        ? "border-yellow-400 bg-yellow-400/10"
                        : "border-white/10 bg-white/[0.03] hover:border-white/30"
                    )}
                  >
                    <ShoppingBag className="w-4 h-4 text-white/70" />
                    <p className="mt-1.5 text-xs font-semibold text-white truncate">{m.name}</p>
                    {m.badge && (
                      <p className={cn(
                        "mt-1 text-[10px] leading-tight font-medium truncate",
                        m.badge.tone === 'warn' && "text-amber-300",
                        m.badge.tone === 'info' && "text-sky-300",
                        m.badge.tone === 'time' && "text-white/45",
                      )}>
                        {m.badge.label}
                      </p>
                    )}
                  </button>
                );
              })}
              <button
                onClick={() => { update('merchant_name', ''); goNext('tracking'); }}
                className="rounded-xl border-2 border-dashed border-white/15 bg-transparent p-3 text-left hover:border-white/40 transition-colors"
              >
                <Package className="w-4 h-4 text-white/50" />
                <p className="mt-1.5 text-xs font-semibold text-white/80">Autre marchand…</p>
              </button>
            </div>

            {!merchantPreset && form.merchant_name === '' && (
              <p className="mt-3 text-[11px] text-white/45">Astuce : si votre marchand n'est pas listé, choisissez « Autre marchand ».</p>
            )}
          </FlowSection>
        </motion.div>
      )}

      {/* ──────────────────── STEP 2: TRACKING ──────────────────── */}
      {step === 'tracking' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <FlowSection
            revealed
            title="Collez votre numéro de suivi"
            hint="Le transporteur est détecté automatiquement."
          >
            <div className="space-y-4 max-w-xl">
              {!merchantPreset && (
                <div>
                  <label className="text-xs font-semibold text-white/70">Nom du marchand *</label>
                  <Input
                    value={form.merchant_name}
                    onChange={e => update('merchant_name', e.target.value)}
                    placeholder="Ex: AutoPartsWarehouse"
                    className="mt-1 bg-white/5 border-white/10 text-white"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" /> Numéro de suivi
                </label>
                <Input
                  value={form.tracking_number}
                  onChange={e => update('tracking_number', e.target.value)}
                  placeholder="Ex: 1Z999AA10123456784"
                  className="mt-1 bg-white/5 border-white/10 text-white font-mono text-sm h-12"
                  autoFocus
                />

                <AnimatePresence mode="wait">
                  {form.tracking_number.length >= 6 && (
                    <motion.div
                      key={carrierMatch?.carrier ?? 'unknown'}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-2"
                    >
                      {carrierMatch ? (
                        <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs text-emerald-200">
                            <CheckCircle2 className="w-4 h-4" />
                            <span><strong>{carrierMatch.carrier}</strong> détecté{carrierMatch.origin ? ` — Expédition depuis ${carrierMatch.origin}` : ''}</span>
                          </div>
                          <a
                            href={carrierMatch.trackingUrl(form.tracking_number.replace(/\s+/g, ''))}
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200"
                          >
                            Voir le suivi <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-white/60">
                          Numéro non reconnu automatiquement — ce n'est pas bloquant, on le vérifie à réception.
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => goNext('description')}
                  className="text-xs font-medium text-white/50 hover:text-white px-3 py-2"
                >
                  Je n'ai pas encore le numéro
                </button>
                <button
                  onClick={() => goNext('description')}
                  disabled={!form.merchant_name}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold bg-yellow-400 text-zinc-950 rounded-lg px-4 py-2.5 hover:bg-yellow-300 disabled:opacity-40 transition-colors"
                >
                  Continuer <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </FlowSection>
        </motion.div>
      )}

      {/* ──────────────────── STEP 3: DESCRIPTION ──────────────────── */}
      {step === 'description' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <FlowSection
            revealed
            title="Qu'avez-vous commandé ?"
            hint="Soyez précis : c'est ce qui apparaît sur la déclaration douanière."
          >
            <div className="space-y-4 max-w-xl">
              <div>
                <label className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Description de l'article
                </label>
                <Textarea
                  value={form.order_description}
                  onChange={e => update('order_description', e.target.value)}
                  placeholder='Ex : MacBook Pro 14", gris sidéral'
                  rows={2}
                  className="mt-1 bg-white/5 border-white/10 text-white"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-white/70">Valeur déclarée (€)</label>
                  <Input
                    type="number" min={0}
                    value={form.estimated_value_eur}
                    onChange={e => update('estimated_value_eur', e.target.value)}
                    placeholder="0"
                    className="mt-1 bg-white/5 border-white/10 text-white"
                  />
                  <p className="mt-1 text-[10px] text-white/45">Utilisé uniquement pour la douane</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-white/70">Nombre de colis</label>
                  <div className="mt-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-md h-10 px-2">
                    <button
                      onClick={() => update('expected_packages', Math.max(1, form.expected_packages - 1))}
                      className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors"
                      type="button"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="flex-1 text-center text-sm font-semibold text-white tabular-nums">
                      {form.expected_packages}
                    </span>
                    <button
                      onClick={() => update('expected_packages', Math.min(20, form.expected_packages + 1))}
                      className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors"
                      type="button"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-[11px] text-white/55 flex gap-2">
                <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-yellow-400/70" />
                <span>Le poids exact est mesuré au relais — pas besoin de l'estimer.</span>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => goNext('goods')}
                  disabled={!form.order_description.trim()}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold bg-yellow-400 text-zinc-950 rounded-lg px-4 py-2.5 hover:bg-yellow-300 disabled:opacity-40 transition-colors"
                >
                  Continuer <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </FlowSection>
        </motion.div>
      )}

      {/* ──────────────────── STEP 4: GOODS TYPE ──────────────────── */}
      {step === 'goods' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <FlowSection
            revealed
            title="Type de marchandise"
            hint="Cela détermine les documents et le mode de transport recommandé."
          >
            <div className="space-y-3 max-w-2xl">
              <div className="grid sm:grid-cols-2 gap-2">
                {GOODS_TYPES.map(g => (
                  <button
                    key={g.id}
                    onClick={() => update('goods_type', g.id)}
                    className={cn(
                      "text-left rounded-xl border-2 px-3 py-3 transition-colors",
                      form.goods_type === g.id
                        ? "border-yellow-400 bg-yellow-400/10"
                        : "border-white/10 bg-white/[0.03] hover:border-white/25"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-white/60" />
                      <p className="text-sm font-semibold text-white">{g.label}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-white/55">{g.desc}</p>
                  </button>
                ))}
              </div>

              <AnimatePresence>
                {goodsHint && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-lg border border-blue-400/30 bg-blue-400/5 p-3 text-xs text-blue-100 flex gap-2"
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{goodsHint}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => goNext('relay')}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold bg-yellow-400 text-zinc-950 rounded-lg px-4 py-2.5 hover:bg-yellow-300 transition-colors"
                >
                  Choisir le relais <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </FlowSection>
        </motion.div>
      )}

      {/* ──────────────────── STEP 5: RELAY ──────────────────── */}
      {step === 'relay' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <FlowSection
            revealed
            title="Choisissez votre adresse de relais"
            hint="C'est l'adresse à utiliser sur le site marchand."
          >
            <RelayPicker
              value={form.relay_address_id}
              suggestedCountryCode={suggestedCountryCode}
              theme="dark"
              onChange={(id, relay) => {
                update('relay_address_id', id);
                setSelectedRelay(relay);
              }}
            />

            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => goNext('transport')}
                disabled={!form.relay_address_id}
                className="inline-flex items-center gap-1.5 text-sm font-semibold bg-yellow-400 text-zinc-950 rounded-lg px-4 py-2.5 hover:bg-yellow-300 disabled:opacity-40 transition-colors"
              >
                Continuer <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </FlowSection>
        </motion.div>
      )}

      {/* ──────────────────── STEP 6: TRANSPORT + PRIORITY ──────────────────── */}
      {step === 'transport' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <FlowSection
            revealed
            title="Transport & priorité"
            hint="Prix estimatifs — montant définitif calculé à réception."
          >
            <div className="space-y-5 max-w-2xl">
              {/* Mode */}
              <div>
                <label className="text-xs font-semibold text-white/70 mb-2 block">Mode de transport</label>
                <div className="grid grid-cols-2 gap-2">
                  <PriceOption
                    icon={<Plane className="w-4 h-4" />}
                    label="Aérien"
                    delay="3-7 jours"
                    price={pricing.air ? `${pricing.air.price_xof.toLocaleString('fr-FR')} FCFA` : (pricing.loading ? '…' : '—')}
                    selected={form.transport_mode === 'air'}
                    onClick={() => update('transport_mode', 'air')}
                  />
                  <PriceOption
                    icon={<Ship className="w-4 h-4" />}
                    label="Maritime"
                    delay="18-25 jours"
                    price={pricing.sea_lcl ? `${pricing.sea_lcl.price_xof.toLocaleString('fr-FR')} FCFA` : (pricing.loading ? '…' : '—')}
                    selected={form.transport_mode === 'sea_lcl'}
                    onClick={() => update('transport_mode', 'sea_lcl')}
                  />
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="text-xs font-semibold text-white/70 mb-2 block">Priorité</label>
                <div className="grid grid-cols-2 gap-2">
                  <PriceOption
                    icon={<Zap className="w-4 h-4" />}
                    label="Express"
                    delay="Traitement 24h"
                    price={pricing.express_delta_xof != null ? `+${pricing.express_delta_xof.toLocaleString('fr-FR')} FCFA` : (pricing.loading ? '…' : '+supplément')}
                    selected={form.priority === 'express'}
                    onClick={() => update('priority', 'express')}
                  />
                  <PriceOption
                    icon={<Check className="w-4 h-4" />}
                    label="Standard"
                    delay="Traitement 3-5j"
                    price="inclus"
                    selected={form.priority === 'standard'}
                    onClick={() => update('priority', 'standard')}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-[11px] text-white/55">
                Prix définitif calculé après pesée et mesure de votre colis au relais.
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => goNext('review')}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold bg-yellow-400 text-zinc-950 rounded-lg px-4 py-2.5 hover:bg-yellow-300 transition-colors"
                >
                  Récapitulatif <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </FlowSection>
        </motion.div>
      )}

      {/* ──────────────────── STEP 7: REVIEW ──────────────────── */}
      {step === 'review' && selectedRelay && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <FlowSection
            revealed
            title="Récapitulatif"
            hint="Aucun paiement maintenant. Le prix est confirmé à réception."
          >
            <div className="space-y-3 max-w-xl">
              <Row label="Marchand" value={form.merchant_name} />
              <Row
                label="Suivi"
                value={form.tracking_number
                  ? `${form.tracking_number}${carrierMatch ? ` (${carrierMatch.carrier} ✓)` : ''}`
                  : '— (à fournir plus tard)'}
              />
              <Row label="Article" value={form.order_description} />
              {form.estimated_value_eur && <Row label="Valeur déclarée" value={`${Number(form.estimated_value_eur).toLocaleString('fr-FR')} €`} />}
              <Row label="Type" value={GOODS_TYPES.find(g => g.id === form.goods_type)!.label} />
              <Row
                label="Transport"
                value={`${form.transport_mode === 'air' ? 'Aérien' : 'Maritime'} · ${form.priority === 'express' ? 'Express' : 'Standard'}`}
              />
              <Row label="Relais" value={`${selectedRelay.city}, ${selectedRelay.country}`} />
              {form.expected_packages > 1 && <Row label="Nb colis attendus" value={String(form.expected_packages)} />}
              {pricing[form.transport_mode] && (
                <Row
                  label="Délai estimé"
                  value={`${pricing[form.transport_mode]!.days_min}-${pricing[form.transport_mode]!.days_max} jours après réception`}
                />
              )}

              {pricing[form.transport_mode] && (
                <div className="flex items-center justify-between rounded-xl border-2 border-yellow-400/40 bg-yellow-400/5 p-4 mt-4">
                  <span className="text-sm font-semibold text-white">Total estimé</span>
                  <span className="text-xl font-bold text-yellow-300 tabular-nums">
                    {(pricing[form.transport_mode]!.price_xof + (form.priority === 'express' ? (pricing.express_delta_xof ?? 0) : 0)).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              )}

              <button
                onClick={submit}
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-bold bg-yellow-400 text-zinc-950 rounded-xl px-4 py-3.5 hover:bg-yellow-300 disabled:opacity-40 transition-colors mt-2"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</>
                            : <>Confirmer la commande <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </FlowSection>
        </motion.div>
      )}

      {/* ──────────────────── STEP 8: SUCCESS ──────────────────── */}
      {step === 'success' && selectedRelay && createdReference && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <FlowSection revealed title="Commande enregistrée" hint="Votre colis est attendu au relais. On vous notifie dès qu'il est réceptionné.">
            <div className="max-w-xl space-y-4">
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-white">Commande enregistrée</p>
                  <p className="text-white/60 text-xs">Référence : <span className="font-mono text-emerald-300 font-bold">{createdReference}</span></p>
                </div>
              </div>

              <div className="rounded-2xl border-2 border-yellow-400/40 bg-yellow-400/5 p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-yellow-300">
                    <Building2 className="w-4 h-4" />
                    Adresse du relais — {selectedRelay.country}
                  </div>
                  <button
                    onClick={copyAddress}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-yellow-300 hover:text-yellow-200"
                  >
                    {copied ? <><Check className="w-3.5 h-3.5" /> Copié</> : <><Copy className="w-3.5 h-3.5" /> Copier</>}
                  </button>
                </div>
                <div className="space-y-0.5 text-sm text-white">
                  <p>{selectedRelay.contact_name ?? 'Yobbanté'}</p>
                  <p className="font-mono text-yellow-300 font-bold">Réf : {createdReference}</p>
                  <p>{selectedRelay.address_line1}</p>
                  {selectedRelay.address_line2 && <p>{selectedRelay.address_line2}</p>}
                  <p>{[selectedRelay.postal_code, selectedRelay.city].filter(Boolean).join(' ')}</p>
                  <p>{selectedRelay.country}</p>
                  {selectedRelay.phone && <p className="text-white/70">Tel : {selectedRelay.phone}</p>}
                </div>
                <div className="rounded-lg bg-yellow-400/10 border border-yellow-400/30 p-2.5 text-[11px] text-yellow-100 flex gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    <strong>Important :</strong> incluez votre référence <strong>{createdReference}</strong> dans
                    le champ « Nom » ou « Apt/Suite » du marchand.
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={goBack}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-yellow-400 text-zinc-950 hover:bg-yellow-300 rounded-lg px-3 py-2 transition-colors"
                >
                  Suivre cette commande
                </button>
                <button
                  onClick={() => { setForm(EMPTY_FORM); setCreatedReference(null); setSelectedRelay(null); setStep('merchant'); }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white border border-white/15 hover:border-white/30 rounded-lg px-3 py-2 transition-colors"
                >
                  <Package className="w-3.5 h-3.5" /> Ajouter un autre colis
                </button>
              </div>
            </div>
          </FlowSection>
        </motion.div>
      )}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────────────────────── */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-2">
      <span className="text-xs text-white/55">{label}</span>
      <span className="text-xs font-semibold text-white text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function PriceOption({
  icon, label, delay, price, selected, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  delay: string;
  price: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border-2 px-3 py-3 text-left transition-colors",
        selected
          ? "border-yellow-400 bg-yellow-400/10"
          : "border-white/10 bg-white/[0.03] hover:border-white/25",
      )}
      type="button"
    >
      <div className="flex items-center gap-1.5 text-white/80">{icon}<p className="text-sm font-semibold text-white">{label}</p></div>
      <p className="mt-1 text-[11px] text-white/55">{delay}</p>
      <p className={cn("mt-1.5 text-sm font-bold tabular-nums", selected ? "text-yellow-300" : "text-white")}>{price}</p>
    </button>
  );
}
