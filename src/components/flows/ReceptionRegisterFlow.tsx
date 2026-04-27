import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Inbox, ArrowRight, ArrowLeft, Loader2, Copy, Check, MapPin,
  Package, ShoppingBag, AlertTriangle, Plane, Ship, Sparkles,
  Building2, ShieldCheck,
} from 'lucide-react';
import { FlowSection } from './FlowPrimitives';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
   Types & static data
   ────────────────────────────────────────────────────────────────────── */

type RelayAddress = {
  id: string;
  country: string;
  country_code: string;
  city: string;
  address_line1: string;
  address_line2: string | null;
  postal_code: string | null;
  phone: string | null;
  contact_name: string | null;
  active: boolean;
  notes: string | null;
};

const COUNTRY_LABEL: Record<string, string> = {
  US: 'USA', FR: 'France', CN: 'Chine', GB: 'UK', AE: 'Dubai',
};

const MERCHANT_PRESETS: { name: string; suggestedRelay: string }[] = [
  { name: 'Amazon US',   suggestedRelay: 'US' },
  { name: 'Amazon FR',   suggestedRelay: 'FR' },
  { name: 'AliExpress',  suggestedRelay: 'CN' },
  { name: 'eBay',        suggestedRelay: 'US' },
  { name: 'SHEIN',       suggestedRelay: 'CN' },
  { name: 'Temu',        suggestedRelay: 'CN' },
  { name: 'Etsy',        suggestedRelay: 'US' },
  { name: 'RockAuto',    suggestedRelay: 'US' },
  { name: 'B&H Photo',   suggestedRelay: 'US' },
  { name: 'iHerb',       suggestedRelay: 'US' },
];

const GOODS_TYPES = [
  { id: 'standard',   label: 'Standard',          desc: 'Articles courants' },
  { id: 'electronic', label: 'Électronique',      desc: 'Téléphone, ordinateur, accessoires' },
  { id: 'fragile',    label: 'Fragile',           desc: 'Verre, écran, instruments' },
  { id: 'auto_part',  label: 'Pièces auto',       desc: 'Recommandé : maritime' },
  { id: 'cosmetic',   label: 'Cosmétiques / Santé', desc: 'Peut nécessiter des documents' },
  { id: 'food',       label: 'Alimentation',      desc: 'Peut nécessiter des documents' },
  { id: 'high_value', label: 'Forte valeur',      desc: 'Assurance recommandée' },
] as const;

const HAZARDOUS_HINT = "Batteries lithium, aérosols ou liquides : transport aérien interdit, choisissez maritime.";

type Step = 'merchant' | 'details' | 'relay' | 'review' | 'success';

type FormState = {
  merchant_name: string;
  merchant_url: string;
  order_reference: string;
  tracking_number: string;
  order_description: string;
  estimated_value_eur: string;
  estimated_weight_kg: string;
  expected_packages: number;
  goods_type: typeof GOODS_TYPES[number]['id'];
  transport_mode: 'air' | 'sea_lcl';
  priority: 'standard' | 'express';
  relay_address_id: string | null;
};

const EMPTY_FORM: FormState = {
  merchant_name: '',
  merchant_url: '',
  order_reference: '',
  tracking_number: '',
  order_description: '',
  estimated_value_eur: '',
  estimated_weight_kg: '',
  expected_packages: 1,
  goods_type: 'standard',
  transport_mode: 'air',
  priority: 'standard',
  relay_address_id: null,
};

/* ──────────────────────────────────────────────────────────────────────
   Main component
   ────────────────────────────────────────────────────────────────────── */

export function ReceptionRegisterFlow({ goBack }: { goBack: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('merchant');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [relays, setRelays] = useState<RelayAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createdReference, setCreatedReference] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load relays
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('relay_addresses')
        .select('*')
        .eq('active', true)
        .order('country');
      if (cancelled) return;
      if (error) {
        toast.error("Impossible de charger les adresses de relais");
      } else {
        setRelays(data as RelayAddress[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const selectedRelay = useMemo(
    () => relays.find(r => r.id === form.relay_address_id) ?? null,
    [relays, form.relay_address_id]
  );

  const isHazardous = /batteri|aérosol|aerosol|liquide|parfum|essence/i.test(form.order_description);
  const isHighValue = Number(form.estimated_value_eur) >= 500;

  // Auto-pick relay when merchant suggests one
  useEffect(() => {
    if (form.relay_address_id || !relays.length || !form.merchant_name) return;
    const preset = MERCHANT_PRESETS.find(m => m.name === form.merchant_name);
    if (!preset) return;
    const match = relays.find(r => r.country_code === preset.suggestedRelay);
    if (match) update('relay_address_id', match.id);
  }, [form.merchant_name, form.relay_address_id, relays]);

  // Block air for hazardous
  useEffect(() => {
    if (isHazardous && form.transport_mode === 'air') {
      update('transport_mode', 'sea_lcl');
    }
  }, [isHazardous, form.transport_mode]);

  const submit = async () => {
    if (!user) {
      toast.info("Connectez-vous pour enregistrer votre commande");
      navigate('/auth?redirect=/expedier/recevoir');
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
        order_reference: form.order_reference || null,
        order_description: form.order_description,
        estimated_value_eur: form.estimated_value_eur ? Number(form.estimated_value_eur) : null,
        estimated_weight_kg: form.estimated_weight_kg ? Number(form.estimated_weight_kg) : null,
        expected_packages: form.expected_packages,
        goods_type: form.goods_type,
        transport_mode: form.transport_mode,
        priority: form.priority,
      })
      .select('reference')
      .single();
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
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
    } catch {
      toast.error("Impossible de copier");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-white/60" />
      </div>
    );
  }

  return (
    <>
      <div className="pt-2">
        <button
          onClick={step === 'success' ? goBack : (step === 'merchant' ? goBack : () => {
            const order: Step[] = ['merchant', 'details', 'relay', 'review'];
            const idx = order.indexOf(step);
            setStep(order[Math.max(0, idx - 1)]);
          })}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-white/55 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Retour
        </button>
      </div>

      {/* ── STEP 1: Merchant ──────────────────────────────────────────── */}
      {step === 'merchant' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <FlowSection
            revealed
            title="Sur quel site avez-vous commandé ?"
            hint="Sélectionnez le marchand ou saisissez son nom."
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-w-3xl">
              {MERCHANT_PRESETS.map(m => (
                <button
                  key={m.name}
                  onClick={() => { update('merchant_name', m.name); setStep('details'); }}
                  className={cn(
                    "rounded-xl border-2 p-3 text-left transition-all hover:-translate-y-0.5",
                    form.merchant_name === m.name
                      ? "border-yellow-400 bg-yellow-400/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/30"
                  )}
                >
                  <ShoppingBag className="w-4 h-4 text-white/70" />
                  <p className="mt-1.5 text-xs font-semibold text-white truncate">{m.name}</p>
                </button>
              ))}
              <button
                onClick={() => { update('merchant_name', ''); setStep('details'); }}
                className="rounded-xl border-2 border-dashed border-white/15 bg-transparent p-3 text-left hover:border-white/40 transition-colors"
              >
                <Package className="w-4 h-4 text-white/50" />
                <p className="mt-1.5 text-xs font-semibold text-white/80">Autre marchand…</p>
              </button>
            </div>
          </FlowSection>
        </motion.div>
      )}

      {/* ── STEP 2: Details ───────────────────────────────────────────── */}
      {step === 'details' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <FlowSection
            revealed
            title="Détails de votre commande"
            hint="Ces infos servent à identifier votre colis et à préparer la douane."
          >
            <div className="space-y-4 max-w-2xl">
              {!MERCHANT_PRESETS.find(p => p.name === form.merchant_name) && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-white/70">Nom du marchand *</label>
                    <Input
                      value={form.merchant_name}
                      onChange={e => update('merchant_name', e.target.value)}
                      placeholder="Ex: AutoPartsWarehouse"
                      className="mt-1 bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-white/70">URL (optionnel)</label>
                    <Input
                      value={form.merchant_url}
                      onChange={e => update('merchant_url', e.target.value)}
                      placeholder="https://…"
                      className="mt-1 bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-white/70">Description *</label>
                <Textarea
                  value={form.order_description}
                  onChange={e => update('order_description', e.target.value)}
                  placeholder="Ex: MacBook Pro 14 pouces, coloris gris sidéral"
                  rows={3}
                  className="mt-1 bg-white/5 border-white/10 text-white"
                />
                <p className="mt-1 text-[11px] text-white/45">Soyez précis — utile pour la douane.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-white/70">Valeur (€) *</label>
                  <Input
                    type="number" min={0}
                    value={form.estimated_value_eur}
                    onChange={e => update('estimated_value_eur', e.target.value)}
                    className="mt-1 bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/70">Poids estimé (kg)</label>
                  <Input
                    type="number" min={0} step="0.1"
                    value={form.estimated_weight_kg}
                    onChange={e => update('estimated_weight_kg', e.target.value)}
                    className="mt-1 bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/70">Réf. commande</label>
                  <Input
                    value={form.order_reference}
                    onChange={e => update('order_reference', e.target.value)}
                    placeholder="Optionnel"
                    className="mt-1 bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/70">Nb colis</label>
                  <Input
                    type="number" min={1} max={20}
                    value={form.expected_packages}
                    onChange={e => update('expected_packages', Math.max(1, Number(e.target.value) || 1))}
                    className="mt-1 bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-white/70 mb-2 block">Type de marchandise *</label>
                <div className="grid sm:grid-cols-2 gap-2">
                  {GOODS_TYPES.map(g => (
                    <button
                      key={g.id}
                      onClick={() => update('goods_type', g.id)}
                      className={cn(
                        "text-left rounded-lg border-2 px-3 py-2 transition-colors",
                        form.goods_type === g.id
                          ? "border-yellow-400 bg-yellow-400/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/25"
                      )}
                    >
                      <p className="text-xs font-semibold text-white">{g.label}</p>
                      <p className="text-[11px] text-white/55">{g.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-white/70 mb-2 block">Mode de transport *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => !isHazardous && update('transport_mode', 'air')}
                      disabled={isHazardous}
                      className={cn(
                        "rounded-lg border-2 px-3 py-2.5 text-left transition-colors",
                        form.transport_mode === 'air'
                          ? "border-yellow-400 bg-yellow-400/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/25",
                        isHazardous && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      <Plane className="w-4 h-4 text-white/80" />
                      <p className="mt-1 text-xs font-semibold text-white">Aérien</p>
                      <p className="text-[11px] text-white/55">3-7 jours</p>
                    </button>
                    <button
                      onClick={() => update('transport_mode', 'sea_lcl')}
                      className={cn(
                        "rounded-lg border-2 px-3 py-2.5 text-left transition-colors",
                        form.transport_mode === 'sea_lcl'
                          ? "border-yellow-400 bg-yellow-400/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/25"
                      )}
                    >
                      <Ship className="w-4 h-4 text-white/80" />
                      <p className="mt-1 text-xs font-semibold text-white">Maritime</p>
                      <p className="text-[11px] text-white/55">18-25 jours</p>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/70 mb-2 block">Priorité</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => update('priority', 'standard')}
                      className={cn(
                        "rounded-lg border-2 px-3 py-2.5 text-xs font-semibold transition-colors",
                        form.priority === 'standard'
                          ? "border-yellow-400 bg-yellow-400/10 text-white"
                          : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25"
                      )}
                    >Standard</button>
                    <button
                      onClick={() => update('priority', 'express')}
                      className={cn(
                        "rounded-lg border-2 px-3 py-2.5 text-xs font-semibold transition-colors",
                        form.priority === 'express'
                          ? "border-yellow-400 bg-yellow-400/10 text-white"
                          : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25"
                      )}
                    >Express +35%</button>
                  </div>
                </div>
              </div>

              {isHazardous && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-200 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{HAZARDOUS_HINT}</span>
                </div>
              )}
              {(form.goods_type === 'food' || form.goods_type === 'cosmetic') && (
                <div className="rounded-lg border border-blue-400/30 bg-blue-400/5 p-3 text-xs text-blue-200 flex gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Les produits alimentaires/cosmétiques peuvent nécessiter des documents douaniers. Notre équipe vous contactera si besoin.</span>
                </div>
              )}
              {isHighValue && (
                <div className="rounded-lg border border-violet-400/30 bg-violet-400/5 p-3 text-xs text-violet-200 flex gap-2">
                  <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Commande de forte valeur (≥ 500 €) — assurance recommandée, gérée à la réception.</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setStep('relay')}
                  disabled={!form.merchant_name || !form.order_description || !form.estimated_value_eur}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold bg-yellow-400 text-zinc-950 rounded-lg px-4 py-2.5 hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Choisir le relais <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </FlowSection>
        </motion.div>
      )}

      {/* ── STEP 3: Relay ─────────────────────────────────────────────── */}
      {step === 'relay' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <FlowSection
            revealed
            title="Choisissez votre adresse de relais"
            hint="C'est l'adresse à utiliser sur le site marchand."
          >
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl">
              {relays.map(r => (
                <button
                  key={r.id}
                  onClick={() => update('relay_address_id', r.id)}
                  className={cn(
                    "text-left rounded-xl border-2 p-4 transition-all hover:-translate-y-0.5",
                    form.relay_address_id === r.id
                      ? "border-yellow-400 bg-yellow-400/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{COUNTRY_FLAG[r.country_code] ?? '🌍'}</span>
                    <div>
                      <p className="text-sm font-bold text-white">{r.country}</p>
                      <p className="text-xs text-white/55">{r.city}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-white/45 line-clamp-2">{r.address_line1}</p>
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => setStep('review')}
                disabled={!form.relay_address_id}
                className="inline-flex items-center gap-1.5 text-sm font-semibold bg-yellow-400 text-zinc-950 rounded-lg px-4 py-2.5 hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Récapitulatif <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </FlowSection>
        </motion.div>
      )}

      {/* ── STEP 4: Review ───────────────────────────────────────────── */}
      {step === 'review' && selectedRelay && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <FlowSection
            revealed
            title="Vérifiez votre demande"
            hint="Aucun paiement maintenant. On calcule le prix une fois votre colis reçu."
          >
            <div className="space-y-3 max-w-2xl">
              <Row label="Marchand" value={form.merchant_name} />
              <Row label="Description" value={form.order_description} />
              <Row label="Valeur déclarée" value={`${form.estimated_value_eur} €`} />
              {form.estimated_weight_kg && <Row label="Poids estimé" value={`${form.estimated_weight_kg} kg`} />}
              <Row label="Type" value={GOODS_TYPES.find(g => g.id === form.goods_type)?.label ?? ''} />
              <Row label="Transport" value={`${form.transport_mode === 'air' ? 'Aérien' : 'Maritime LCL'} · ${form.priority === 'express' ? 'Express' : 'Standard'}`} />
              <Row label="Relais" value={`${COUNTRY_FLAG[selectedRelay.country_code] ?? ''} ${selectedRelay.city}, ${selectedRelay.country}`} />
              <Row label="Nb colis attendus" value={String(form.expected_packages)} />

              <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/5 p-3 text-xs text-yellow-100 flex gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Paiement en deux temps :</strong> votre enregistrement est gratuit.
                  Nous recevons le colis, le pesons, le photographions et calculons le prix réel.
                  Vous payez seulement à ce moment-là.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold bg-yellow-400 text-zinc-950 rounded-lg px-4 py-2.5 hover:bg-yellow-300 disabled:opacity-40 transition-colors"
                >
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</>
                              : <>Enregistrer la commande <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          </FlowSection>
        </motion.div>
      )}

      {/* ── STEP 5: Success ──────────────────────────────────────────── */}
      {step === 'success' && selectedRelay && createdReference && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <FlowSection revealed title="✅ Commande enregistrée" hint="Utilisez l'adresse ci-dessous sur le site marchand.">
            <div className="rounded-2xl border-2 border-yellow-400/40 bg-yellow-400/5 p-5 max-w-xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-yellow-300">
                  <Building2 className="w-4 h-4" />
                  Yobbanté Relay — {selectedRelay.country}
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
                  le champ "Nom" ou "Apt/Suite" du marchand. Sans elle, on ne peut pas associer le colis.
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => { setForm(EMPTY_FORM); setCreatedReference(null); setStep('merchant'); }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white border border-white/15 hover:border-white/30 rounded-lg px-3 py-2 transition-colors"
              >
                <Package className="w-3.5 h-3.5" /> Enregistrer une autre commande
              </button>
              <button
                onClick={goBack}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/15 text-white rounded-lg px-3 py-2 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Retour à l'accueil
              </button>
            </div>
          </FlowSection>
        </motion.div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-2">
      <span className="text-xs text-white/55">{label}</span>
      <span className="text-xs font-semibold text-white text-right max-w-[60%]">{value}</span>
    </div>
  );
}
