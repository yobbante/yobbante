import { useState, useMemo, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, ArrowLeft, ArrowRight, Check, MessageCircle, MapPin } from 'lucide-react';
import { TransporteurReferenceLookup } from '@/components/admin/TransporteurReferenceLookup';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  INTAKE_SOURCES, SERVICE_KINDS, RECEPTION_TAG, SOURCING_TAG,
  type IntakeSource, type ServiceKind,
} from '@/lib/intakeSources';
import { useIntakeDraft } from '@/hooks/useIntakeDraft';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type DepartureMode = 'ref' | 'route' | 'gp' | 'skip';

type IntakeData = {
  source: IntakeSource | null;
  source_reference: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  client_city: string;
  client_type: 'individual' | 'business';
  client_company: string;
  service_kind: ServiceKind | null;
  origin_city: string;
  destination_city: string;
  weight_kg: string;
  transport_mode: 'air' | 'sea' | 'road';
  description: string;
  declared_value: string;
  desired_date: string;
  product: string;
  sourcing_country: string;
  budget: string;
  quantity: string;
  product_url: string;
  origin_country_reception: string;
  tracking_number: string;
  intake_notes: string;
  price_mode: 'auto' | 'manual';
  manual_price: string;
  manual_currency: 'XOF' | 'EUR';
  initial_status: 'SUBMITTED' | 'CONFIRMED';
  send_whatsapp: boolean;
  // Fix 3 — Quel départ ?
  departure_mode: DepartureMode | null;
  departure_short_ref: string;
  selected_departure_id: string | null;
  selected_departure_label: string;
  selected_transporteur_ref: string;
};

const INITIAL: IntakeData = {
  source: null, source_reference: '',
  client_name: '', client_phone: '', client_email: '', client_city: '',
  client_type: 'individual', client_company: '',
  service_kind: null,
  origin_city: '', destination_city: '', weight_kg: '', transport_mode: 'air',
  description: '', declared_value: '', desired_date: '',
  product: '', sourcing_country: '', budget: '', quantity: '', product_url: '',
  origin_country_reception: '', tracking_number: '',
  intake_notes: '', price_mode: 'auto', manual_price: '', manual_currency: 'XOF',
  initial_status: 'SUBMITTED', send_whatsapp: true,
  departure_mode: null, departure_short_ref: '', selected_departure_id: null,
  selected_departure_label: '', selected_transporteur_ref: '',
};

const TOTAL_STEPS = 5;

function DepartureStep({ data, update }: { data: IntakeData; update: (p: Partial<IntakeData>) => void }) {
  const [searching, setSearching] = useState(false);
  const [routeDeps, setRouteDeps] = useState<any[]>([]);

  async function lookupByRef() {
    const ref = data.departure_short_ref.trim();
    if (!/^\d{4}$/.test(ref)) {
      toast.error('La référence doit faire 4 chiffres');
      return;
    }
    setSearching(true);
    const { data: rows, error } = await supabase
      .from('manual_departures')
      .select('id, short_ref, origin_city, destination_city, departure_date, transport_mode, available_capacity_kg, total_capacity_kg, carrier_name')
      .eq('short_ref', ref)
      .limit(1);
    setSearching(false);
    if (error || !rows || rows.length === 0) {
      toast.error('Aucun départ trouvé pour cette référence');
      update({ selected_departure_id: null, selected_departure_label: '' });
      return;
    }
    const d: any = rows[0];
    update({
      selected_departure_id: d.id,
      selected_departure_label: `#${d.short_ref} · ${d.origin_city}→${d.destination_city} · ${new Date(d.departure_date).toLocaleDateString('fr-FR')}`,
    });
    if (d.available_capacity_kg <= 0) toast.warning('⚠️ Ce départ est complet');
  }

  async function loadByRoute() {
    if (!data.origin_city || !data.destination_city) {
      toast.error('Origine et destination requises (étape précédente)');
      return;
    }
    setSearching(true);
    const { data: rows } = await supabase
      .from('manual_departures')
      .select('id, short_ref, origin_city, destination_city, departure_date, transport_mode, available_capacity_kg, total_capacity_kg, carrier_name')
      .ilike('destination_city', `%${data.destination_city}%`)
      .gte('departure_date', new Date().toISOString().slice(0, 10))
      .eq('status', 'active')
      .order('departure_date', { ascending: true })
      .limit(20);
    setSearching(false);
    setRouteDeps(rows ?? []);
    if (!rows || rows.length === 0) toast.info('Aucun départ disponible pour cette route');
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Quel départ ?</h3>
      <p className="text-xs text-muted-foreground">Le client mentionne-t-il une référence ?</p>

      <RadioGroup
        value={data.departure_mode ?? ''}
        onValueChange={(v: any) => update({ departure_mode: v, selected_departure_id: null, selected_departure_label: '', selected_transporteur_ref: '' })}
        className="space-y-2"
      >
        <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-border hover:border-primary/50">
          <RadioGroupItem value="ref" className="mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-medium">Oui — il a vu une réf publiée</div>
            {data.departure_mode === 'ref' && (
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="0000"
                  maxLength={4}
                  value={data.departure_short_ref}
                  onChange={e => update({ departure_short_ref: e.target.value.replace(/\D/g, '') })}
                  className="w-24 font-mono"
                />
                <Button size="sm" variant="outline" type="button" onClick={lookupByRef} disabled={searching}>
                  Chercher
                </Button>
                {data.selected_departure_label && (
                  <span className="text-xs text-primary self-center">{data.selected_departure_label}</span>
                )}
              </div>
            )}
          </div>
        </label>

        <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-border hover:border-primary/50">
          <RadioGroupItem value="route" className="mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-medium">Non — trouver le bon départ pour la route</div>
            {data.departure_mode === 'route' && (
              <div className="mt-2 space-y-2">
                <Button size="sm" variant="outline" type="button" onClick={loadByRoute} disabled={searching}>
                  Charger les départs disponibles
                </Button>
                {routeDeps.map(d => {
                  const status = d.available_capacity_kg <= 0 ? '🔴' : d.available_capacity_kg < 5 ? '🟡' : '🟢';
                  const selected = data.selected_departure_id === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => update({
                        selected_departure_id: d.id,
                        selected_departure_label: `#${d.short_ref} · ${d.origin_city}→${d.destination_city}`,
                      })}
                      className={`w-full text-left text-xs p-2 rounded border ${selected ? 'border-primary bg-primary/10' : 'border-border'}`}
                    >
                      {status} {new Date(d.departure_date).toLocaleDateString('fr-FR')} · {d.carrier_name ?? 'GP'} · <strong>Réf {d.short_ref}</strong> · {d.available_capacity_kg}kg dispo
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </label>

        <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-border hover:border-primary/50">
          <RadioGroupItem value="gp" className="mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-medium">Aucun départ ne convient — j'ai un GP en tête</div>
            {data.departure_mode === 'gp' && (
              <div className="mt-2">
                <TransporteurReferenceLookup
                  value={data.selected_transporteur_ref}
                  onChange={(ref) => update({ selected_transporteur_ref: ref })}
                  onMatch={async (t) => {
                    if (!t) return;
                    const { data: extra } = await supabase
                      .from('transporteurs' as any)
                      .select('adresse_collecte_dakar, adresses_remise')
                      .eq('id', t.id)
                      .maybeSingle();
                    const e = extra as unknown as { adresse_collecte_dakar: string | null; adresses_remise: Record<string, string> | null } | null;
                    if (!e) return;
                    const remiseKey = (data.destination_city || '').trim().toLowerCase();
                    const remise = e.adresses_remise
                      ? Object.entries(e.adresses_remise).find(([k]) => k.toLowerCase() === remiseKey)?.[1]
                      : null;
                    const lines: string[] = [];
                    if (e.adresse_collecte_dakar) lines.push(`📍 Collecte Dakar (GP ${t.reference}): ${e.adresse_collecte_dakar}`);
                    if (remise) lines.push(`📍 Remise ${data.destination_city} (GP ${t.reference}): ${remise}`);
                    if (lines.length === 0) return;
                    const block = lines.join('\n');
                    if ((data.intake_notes || '').includes(block)) return;
                    update({ intake_notes: [data.intake_notes, block].filter(Boolean).join('\n\n') });
                    toast.success('Adresses GP pré-remplies dans les notes');
                  }}
                />
              </div>
            )}
          </div>
        </label>


        <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-border hover:border-primary/50">
          <RadioGroupItem value="skip" className="mt-0.5" />
          <div className="text-sm font-medium">Skip — on verra plus tard</div>
        </label>
      </RadioGroup>
    </div>
  );
}

export function NewIntakeDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const { data, setData, hasExisting, loadExisting, clearDraft } = useIntakeDraft<IntakeData>(INITIAL);
  const [resumePromptShown, setResumePromptShown] = useState(false);
  const [createdDossier, setCreatedDossier] = useState<{ id: string; reference: string; hasDeparture: boolean } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (open && hasExisting && !resumePromptShown) {
      setResumePromptShown(true);
      if (window.confirm('Un brouillon précédent existe. Le reprendre ?')) {
        loadExisting();
      } else {
        clearDraft();
      }
    }
  }, [open, hasExisting, resumePromptShown, loadExisting, clearDraft]);

  const update = (patch: Partial<IntakeData>) => setData({ ...data, ...patch });

  const canNext = useMemo(() => {
    if (step === 0) return !!data.source;
    if (step === 1) return data.client_name.trim().length >= 2 && data.client_phone.trim().length >= 6;
    if (step === 2) {
      if (!data.service_kind) return false;
      if (data.service_kind === 'envoi') return !!(data.origin_city && data.destination_city && data.weight_kg);
      if (data.service_kind === 'sourcing') return !!(data.product && data.sourcing_country);
      if (data.service_kind === 'reception') return !!(data.origin_country_reception && data.description);
    }
    if (step === 3) {
      // Departure step is optional (skip is always valid)
      if (!data.departure_mode) return false;
      if (data.departure_mode === 'ref') return !!data.selected_departure_id;
      if (data.departure_mode === 'route') return !!data.selected_departure_id;
      if (data.departure_mode === 'gp') return data.selected_transporteur_ref.trim().length > 0;
      return true; // skip
    }
    return true;
  }, [step, data]);

  const calculatePrice = async () => {
    if (data.service_kind !== 'envoi') {
      setEstimatedPrice(null);
      return;
    }
    const w = parseFloat(data.weight_kg);
    if (!w || !data.destination_city) return;
    const { data: q } = await supabase.rpc('calculate_quote', {
      p_origin_country: 'FR',
      p_destination_country: 'SN',
      p_weight_kg: w,
      p_transport_type: data.transport_mode === 'sea' ? 'sea' : 'air',
      p_priority: 'normal',
      p_origin_city: data.origin_city,
      p_destination_city: data.destination_city,
    });
    if (q && q[0]) setEstimatedPrice(Math.round(q[0].price_eur));
  };

  const handleSave = async (sendWhatsApp: boolean) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      let productDescription = data.description || data.product || 'Demande client';
      if (data.service_kind === 'reception') productDescription = `${RECEPTION_TAG} ${productDescription}`;
      if (data.service_kind === 'sourcing') productDescription = `${SOURCING_TAG} ${data.product}${data.product_url ? ` — ${data.product_url}` : ''}`;

      const price = data.price_mode === 'manual'
        ? (data.manual_currency === 'EUR' ? parseFloat(data.manual_price) : parseFloat(data.manual_price) / 655.957)
        : estimatedPrice;

      // Status logic: gp-only mode forces EN_RECHERCHE_DEPART
      const computedStatus = data.departure_mode === 'gp'
        ? 'EN_RECHERCHE_DEPART'
        : data.initial_status;

      const insertRow: any = {
        user_id: user.id,
        product_description: productDescription,
        origin_country: data.service_kind === 'reception'
          ? (data.origin_country_reception?.slice(0, 2).toUpperCase() || 'FR')
          : 'FR',
        destination_country: 'SN',
        contact_phone: data.client_phone,
        contact_email: data.client_email || null,
        estimated_weight: data.weight_kg ? parseFloat(data.weight_kg) : null,
        estimated_cost: price ?? null,
        needs_sourcing: data.service_kind === 'sourcing',
        app_source: data.service_kind === 'envoi'
          ? 'expedier'
          : data.service_kind === 'reception'
            ? 'recevoir'
            : 'sourcing',
        notes: [
          data.client_company && `Société: ${data.client_company}`,
          data.client_city && `Ville: ${data.client_city}`,
          data.desired_date && `Date souhaitée: ${data.desired_date}`,
          data.sourcing_country && `Pays sourcing: ${data.sourcing_country}`,
          data.budget && `Budget: ${data.budget}`,
          data.quantity && `Quantité: ${data.quantity}`,
          data.tracking_number && `Tracking: ${data.tracking_number}`,
          data.declared_value && `Valeur déclarée: ${data.declared_value} €`,
          data.selected_departure_label && `Départ: ${data.selected_departure_label}`,
        ].filter(Boolean).join('\n') || null,
        status: computedStatus,
        source: data.source,
        source_reference: data.source_reference || null,
        intake_notes: data.intake_notes || null,
        assigned_departure_id: data.selected_departure_id || null,
        assigned_transporteur_ref: data.selected_transporteur_ref || null,
        intake_by: user.id,
        intake_method: 'manual_intake',
        buyer_name: data.client_name,
        buyer_country: data.client_city || null,
        buyer_contact: data.client_phone,
        dossier_type: data.client_type,
      };

      const { data: created, error } = await supabase
        .from('dossiers')
        .insert(insertRow)
        .select('id, reference')
        .single();
      if (error) throw error;

      await clearDraft();
      qc.invalidateQueries({ queryKey: ['inbox-dossiers'] });
      qc.invalidateQueries({ queryKey: ['dossiers'] });

      toast.success(`Dossier ${created.reference} créé`);

      if (sendWhatsApp && data.client_phone) {
        const phoneClean = data.client_phone.replace(/[^\d]/g, '');
        const trackingUrl = `https://yobbante.com/suivre/${created.reference}`;
        const serviceLabel = SERVICE_KINDS.find(s => s.id === data.service_kind)?.label || 'Demande';
        const route = data.service_kind === 'envoi'
          ? `${data.origin_city || data.origin_country_reception || '?'} → ${data.destination_city || 'Dakar'}`
          : data.service_kind === 'sourcing'
            ? `${data.sourcing_country || '?'} → Sénégal`
            : `${data.origin_country_reception || '?'} → SN`;
        const priceXof = price ? Math.round(price * 655.957) : null;
        const msg =
`Bonjour ${data.client_name}, ici Yobbanté.

Suite à notre échange, voici le récap de votre demande :
${serviceLabel}
${route}
${data.weight_kg ? `${data.weight_kg} kg\n` : ''}${priceXof ? `Estimation : ${priceXof} XOF\n` : ''}Numéro de suivi : ${created.reference}
Suivre : ${trackingUrl}

Pour confirmer, répondez OUI ou cliquez sur le lien ci-dessus.
Merci de votre confiance.`;
        window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(msg)}`, '_blank');
      }

      const hasDeparture = data.service_kind === 'envoi' && !!data.selected_departure_id;
      if (hasDeparture) {
        // Show quick-action panel — keep the dialog open
        setCreatedDossier({ id: created.id, reference: created.reference, hasDeparture: true });
      } else {
        setData(INITIAL);
        setStep(0);
        setEstimatedPrice(null);
        onOpenChange(false);
      }
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  const resetAndClose = () => {
    setData(INITIAL);
    setStep(0);
    setEstimatedPrice(null);
    setCreatedDossier(null);
    onOpenChange(false);
  };

  const confirmDossier = async (notifyGp: boolean) => {
    if (!createdDossier) return;
    setActionLoading(notifyGp ? 'notify' : 'silent');
    try {
      // ASSIGNED triggers the WhatsApp notify trigger to GP + client; CONFIRMED is silent.
      const nextStatus = notifyGp ? 'ASSIGNED' : 'CONFIRMED';
      const { error } = await supabase
        .from('dossiers')
        .update({ status: nextStatus as any })
        .eq('id', createdDossier.id);
      if (error) throw error;
      toast.success(notifyGp ? 'Dossier confirmé et GP notifié' : 'Dossier confirmé (sans notification)');
      qc.invalidateQueries({ queryKey: ['inbox-dossiers'] });
      qc.invalidateQueries({ queryKey: ['admin-requests'] });
      resetAndClose();
    } catch (e: any) {
      toast.error(e.message || 'Échec de la confirmation');
    } finally {
      setActionLoading(null);
    }
  };


  if (createdDossier) {
    return (
      <Sheet open={open} onOpenChange={(v) => { if (!v) resetAndClose(); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Dossier créé</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <Card className="p-4 border-primary/40 bg-primary/5">
              <div className="text-sm text-muted-foreground">Référence</div>
              <div className="text-lg font-semibold">{createdDossier.reference}</div>
              <div className="text-xs text-muted-foreground mt-2">
                Lié au départ {data.selected_departure_label || '—'}
              </div>
            </Card>

            <div className="text-sm font-medium">Actions rapides</div>
            <div className="grid gap-2">
              <Button
                onClick={() => confirmDossier(true)}
                disabled={!!actionLoading}
                className="justify-start"
              >
                {actionLoading === 'notify'
                  ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  : <Check className="h-4 w-4 mr-2" />}
                Confirmer et notifier le GP
              </Button>
              <Button
                onClick={() => confirmDossier(false)}
                disabled={!!actionLoading}
                variant="secondary"
                className="justify-start"
              >
                {actionLoading === 'silent'
                  ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  : <Check className="h-4 w-4 mr-2" />}
                Confirmer sans notifier
              </Button>
              <Button
                onClick={() => { const id = createdDossier.id; resetAndClose(); window.open(`/admin/dossier/${id}`, '_blank'); }}
                disabled={!!actionLoading}
                variant="outline"
                className="justify-start"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Voir le dossier
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nouveau dossier · Étape {step + 1} / {TOTAL_STEPS}</SheetTitle>
        </SheetHeader>


        <div className="mt-6 space-y-4">
          <div className="flex gap-1">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded ${i <= step ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold">D'où vient cette demande ?</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {INTAKE_SOURCES.filter(s => s.id !== 'site_web').map(s => (
                  <button
                    key={s.id}
                    onClick={() => update({ source: s.id })}
                    className="p-3 rounded-lg border-2 text-left transition-all"
                    style={{
                      borderColor: data.source === s.id ? s.color : 'hsl(var(--border))',
                      background: data.source === s.id ? `${s.color}15` : 'transparent',
                    }}
                  >
                    <div className="text-2xl"></div>
                    <div className="text-sm font-medium mt-1">{s.label}</div>
                  </button>
                ))}
              </div>
              {data.source && (
                <div>
                  <Label className="text-xs">Référence</Label>
                  <Input
                    value={data.source_reference}
                    onChange={e => update({ source_reference: e.target.value })}
                    placeholder={INTAKE_SOURCES.find(s => s.id === data.source)?.referencePlaceholder}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Saisi le {new Date().toLocaleString('fr-FR')}
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <h3 className="text-base font-semibold">Qui est le client ?</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nom complet *</Label>
                  <Input value={data.client_name} onChange={e => update({ client_name: e.target.value })} placeholder="Prénom Nom" />
                </div>
                <div>
                  <Label className="text-xs">WhatsApp *</Label>
                  <Input value={data.client_phone} onChange={e => update({ client_phone: e.target.value })} placeholder="+221 …" />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={data.client_email} onChange={e => update({ client_email: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Ville</Label>
                  <Input value={data.client_city} onChange={e => update({ client_city: e.target.value })} placeholder="Dakar" />
                </div>
              </div>
              <RadioGroup
                value={data.client_type}
                onValueChange={(v: any) => update({ client_type: v })}
                className="flex gap-4 pt-2"
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="individual" /> Particulier
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="business" /> Entreprise
                </label>
              </RadioGroup>
              {data.client_type === 'business' && (
                <div>
                  <Label className="text-xs">Nom de l'entreprise</Label>
                  <Input value={data.client_company} onChange={e => update({ client_company: e.target.value })} />
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold">Que veut le client ?</h3>
              <div className="grid grid-cols-3 gap-2">
                {SERVICE_KINDS.map(k => (
                  <button
                    key={k.id}
                    onClick={() => update({ service_kind: k.id })}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      data.service_kind === k.id ? 'border-primary bg-primary/10' : 'border-border'
                    }`}
                  >
                    <div className="text-2xl"></div>
                    <div className="text-xs font-medium mt-1">{k.label}</div>
                  </button>
                ))}
              </div>

              {data.service_kind === 'envoi' && (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Origine</Label>
                    <Input value={data.origin_city} onChange={e => update({ origin_city: e.target.value })} placeholder="Paris" /></div>
                  <div><Label className="text-xs">Destination</Label>
                    <Input value={data.destination_city} onChange={e => update({ destination_city: e.target.value })} placeholder="Dakar" /></div>
                  <div><Label className="text-xs">Poids (kg)</Label>
                    <Input type="number" value={data.weight_kg} onChange={e => update({ weight_kg: e.target.value })} /></div>
                  <div><Label className="text-xs">Mode</Label>
                    <select
                      className="flex h-10 w-full rounded-[8px] border-[0.5px] border-[hsl(var(--color-border-tertiary))] bg-[hsl(var(--background-surface))] px-3 text-sm"
                      value={data.transport_mode}
                      onChange={e => update({ transport_mode: e.target.value as any })}
                    >
                      <option value="air">Air</option>
                      <option value="sea">Maritime</option>
                      <option value="road">Routier</option>
                    </select>
                  </div>
                  <div className="col-span-2"><Label className="text-xs">Description</Label>
                    <Textarea value={data.description} onChange={e => update({ description: e.target.value })} rows={2} /></div>
                  <div><Label className="text-xs">Valeur déclarée (€)</Label>
                    <Input type="number" value={data.declared_value} onChange={e => update({ declared_value: e.target.value })} /></div>
                  <div><Label className="text-xs">Date souhaitée</Label>
                    <Input type="date" value={data.desired_date} onChange={e => update({ desired_date: e.target.value })} /></div>
                </div>
              )}

              {data.service_kind === 'sourcing' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label className="text-xs">Produit recherché</Label>
                    <Input value={data.product} onChange={e => update({ product: e.target.value })} /></div>
                  <div><Label className="text-xs">Pays</Label>
                    <Input value={data.sourcing_country} onChange={e => update({ sourcing_country: e.target.value })} placeholder="Chine, USA, Turquie…" /></div>
                  <div><Label className="text-xs">Budget</Label>
                    <Input value={data.budget} onChange={e => update({ budget: e.target.value })} /></div>
                  <div><Label className="text-xs">Quantité</Label>
                    <Input value={data.quantity} onChange={e => update({ quantity: e.target.value })} /></div>
                  <div><Label className="text-xs">URL produit</Label>
                    <Input value={data.product_url} onChange={e => update({ product_url: e.target.value })} placeholder="https://…" /></div>
                  <div className="col-span-2"><Label className="text-xs">Notes spéciales</Label>
                    <Textarea value={data.description} onChange={e => update({ description: e.target.value })} rows={2} /></div>
                </div>
              )}

              {data.service_kind === 'reception' && (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Origine du colis</Label>
                    <Input value={data.origin_country_reception} onChange={e => update({ origin_country_reception: e.target.value })} placeholder="France, USA, Chine…" /></div>
                  <div><Label className="text-xs">Tracking existant</Label>
                    <Input value={data.tracking_number} onChange={e => update({ tracking_number: e.target.value })} /></div>
                  <div className="col-span-2"><Label className="text-xs">Description colis</Label>
                    <Textarea value={data.description} onChange={e => update({ description: e.target.value })} rows={2} /></div>
                  <div><Label className="text-xs">Valeur déclarée (€)</Label>
                    <Input type="number" value={data.declared_value} onChange={e => update({ declared_value: e.target.value })} /></div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <DepartureStep data={data} update={update} />
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold">Récap + Notes</h3>
              <Card className="p-3 bg-muted/50 text-xs space-y-1">
                <div><strong>Client:</strong> {data.client_name} ({data.client_phone})</div>
                <div><strong>Canal:</strong> {INTAKE_SOURCES.find(s => s.id === data.source)?.label}</div>
                <div><strong>Service:</strong> {SERVICE_KINDS.find(s => s.id === data.service_kind)?.label}</div>
                {data.service_kind === 'envoi' && (
                  <div>{data.origin_city} → {data.destination_city} · {data.weight_kg} kg · {data.transport_mode}</div>
                )}
                {data.service_kind === 'sourcing' && <div>{data.product} ({data.sourcing_country})</div>}
                {data.service_kind === 'reception' && <div>{data.origin_country_reception} → SN</div>}
              </Card>

              <div>
                <Label className="text-xs">Notes internes</Label>
                <Textarea
                  value={data.intake_notes}
                  onChange={e => update({ intake_notes: e.target.value })}
                  rows={3}
                  placeholder="Contexte, négociation, points d'attention…"
                />
              </div>

              <div>
                <Label className="text-xs">Estimation prix</Label>
                <div className="flex gap-2 items-center">
                  <RadioGroup
                    value={data.price_mode}
                    onValueChange={(v: any) => update({ price_mode: v })}
                    className="flex gap-3"
                  >
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <RadioGroupItem value="auto" /> Auto
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <RadioGroupItem value="manual" /> Manuel
                    </label>
                  </RadioGroup>
                  {data.price_mode === 'auto' ? (
                    <>
                      <Button size="sm" variant="outline" onClick={calculatePrice} type="button">Calculer</Button>
                      {estimatedPrice != null && <span className="text-sm font-semibold">{estimatedPrice} €</span>}
                    </>
                  ) : (
                    <>
                      <Input
                        type="number"
                        value={data.manual_price}
                        onChange={e => update({ manual_price: e.target.value })}
                        className="w-32"
                      />
                      <select
                        className="h-10 rounded border px-2 text-sm bg-background"
                        value={data.manual_currency}
                        onChange={e => update({ manual_currency: e.target.value as any })}
                      >
                        <option value="XOF">XOF</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-xs">Statut initial</Label>
                <RadioGroup
                  value={data.initial_status}
                  onValueChange={(v: any) => update({ initial_status: v })}
                  className="flex gap-4 pt-1"
                >
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <RadioGroupItem value="SUBMITTED" /> Nouveau (à confirmer)
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <RadioGroupItem value="CONFIRMED" /> Déjà confirmé
                  </label>
                </RadioGroup>
              </div>
            </div>
          )}

          <div className="flex justify-between gap-2 pt-4 border-t">
            <Button
              variant="ghost"
              onClick={() => step === 0 ? onOpenChange(false) : setStep(step - 1)}
              disabled={saving}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              {step === 0 ? 'Annuler' : 'Retour'}
            </Button>
            {step < TOTAL_STEPS - 1 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
                Suivant <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                  Enregistrer
                </Button>
                <Button onClick={() => handleSave(true)} disabled={saving || !data.client_phone}>
                  <MessageCircle className="w-4 h-4 mr-1" />
                  Enregistrer + WhatsApp
                </Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
