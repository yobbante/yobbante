import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Copy, Truck, MessageCircle, CreditCard, ExternalLink, Loader2,
  CheckCircle2, AlertCircle, FileText, History, Package as PackageIcon, Send,
  Scale, MapPin, Download, Upload, Trash2, X,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDossierSheet } from './useDossierSheet';
import { useDossierMessages } from '@/hooks/useDossierMessages';
import { useUserRole } from '@/hooks/useUserRole';
import { getStatutsPourDossier } from '@/lib/dossierStatuts';
import { COUNTRY_FLAGS, COUNTRY_NAMES, type DossierStatus } from '@/lib/types';
import { TransporteurReferenceLookup } from '@/components/admin/TransporteurReferenceLookup';
import { AttachPackagesDialog } from '@/components/admin/AttachPackagesDialog';
import { WeighingDialog, type WeighingDossier } from '@/components/admin/WeighingDialog';
import { ContactBlock } from '@/components/admin/dossiers/ContactBlock';
import { CLIENT_TEMPLATES, buildGpAssignMessage } from '@/lib/clientTemplates';
import { sendGpMessage } from '@/lib/sendGpMessage';
import { assignTransporteurAndNotify } from '@/lib/assignGpAndNotify';
import PricingBreakdownPanel from '@/components/admin/PricingBreakdownPanel';
import { parseClientNotes, hasParsedEssentials, type ParsedClientNotes } from '@/lib/parseClientNotes';

import { format } from 'date-fns';


type DossierRow = Record<string, any>;

function fmtXof(n: number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA';
}

function copy(s: string) {
  navigator.clipboard?.writeText(s).then(() => toast.success('Copié'));
}

export function AdminDossierSheet() {
  const { dossierId, close } = useDossierSheet();
  const isMobile = useIsMobile();
  const open = !!dossierId;

  // Desktop ≥ md : panneau latéral persistant, non modal, sans overlay sombre
  if (!isMobile) {
    return (
      <SheetPrimitive.Root open={open} onOpenChange={(v) => { if (!v) close(); }} modal={false}>
        <SheetPrimitive.Portal>
          <SheetPrimitive.Content
            onInteractOutside={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => e.preventDefault()}
            className="fixed top-0 right-0 bottom-0 z-40 w-[44vw] min-w-[480px] max-w-[760px] bg-background border-l border-border shadow-2xl flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right data-[state=open]:duration-200 data-[state=closed]:duration-150"
          >
            <button
              onClick={close}
              className="absolute right-3 top-3 z-10 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
            {dossierId ? <DossierSheetBody id={dossierId} /> : null}
          </SheetPrimitive.Content>
        </SheetPrimitive.Portal>
      </SheetPrimitive.Root>
    );
  }

  // Mobile : Sheet plein écran (comportement actuel)
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[640px] p-0 flex flex-col"
      >
        {dossierId ? <DossierSheetBody id={dossierId} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function DossierSheetBody({ id }: { id: string }) {
  const qc = useQueryClient();
  const { isStaff } = useUserRole();
  const [tab, setTab] = useState('apercu');
  const [apercuSave, setApercuSave] = useState<{ run: () => void; pending: boolean; dirty: boolean } | null>(null);

  const { data: dossier, isLoading, refetch } = useQuery({
    queryKey: ['admin-dossier', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as DossierRow | null;
    },
  });

  // Realtime updates on this dossier
  useEffect(() => {
    const ch = supabase
      .channel(`admin-dossier-${id}-${crypto.randomUUID()}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'dossiers', filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ['admin-dossier', id] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  const parsed = useMemo(() => parseClientNotes(dossier?.notes), [dossier?.notes]);

  if (isLoading || !dossier) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }


  // Fallback: when dedicated columns were not yet captured (older dossiers),
  // use the structured info we parsed out of the free-form notes payload.
  const sender = {
    name: dossier.sender_name || parsed.senderName || null,
    phone: dossier.sender_phone || parsed.senderPhone || dossier.contact_phone || null,
    address: dossier.sender_address || parsed.senderAddress || null,
  };
  const recipient = {
    name: dossier.recipient_name || parsed.recipientName || null,
    phone: dossier.recipient_phone || parsed.recipientPhone || null,
    address: dossier.recipient_address || parsed.recipientAddress || null,
  };

  return (
    <>
      <DossierHeader dossier={dossier} onChanged={() => refetch()} />

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-6 border-b border-border overflow-x-auto">

          <TabsList className="h-10">
            <TabsTrigger value="apercu" className="text-xs">Aperçu</TabsTrigger>
            <TabsTrigger value="colis" className="text-xs">
              <Scale className="w-3.5 h-3.5 mr-1" /> Colis & poids
            </TabsTrigger>
            <TabsTrigger value="transport" className="text-xs">
              <Truck className="w-3.5 h-3.5 mr-1" /> Transport
            </TabsTrigger>
            <TabsTrigger value="livraison" className="text-xs">
              <MapPin className="w-3.5 h-3.5 mr-1" /> Livraison
            </TabsTrigger>
            <TabsTrigger value="paiement" className="text-xs">
              <CreditCard className="w-3.5 h-3.5 mr-1" /> Paiement
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-xs">
              <FileText className="w-3.5 h-3.5 mr-1" /> Documents
            </TabsTrigger>
            <TabsTrigger value="messages" className="text-xs">
              <MessageCircle className="w-3.5 h-3.5 mr-1" /> Messages
            </TabsTrigger>
            <TabsTrigger value="historique" className="text-xs">
              <History className="w-3.5 h-3.5 mr-1" /> Historique
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <TabsContent value="apercu"     className="mt-0">
            <ApercuTab
              dossier={dossier}
              sender={sender}
              recipient={recipient}
              parsed={parsed}
              registerSave={setApercuSave}
            />
          </TabsContent>
          <TabsContent value="colis"      className="mt-0"><ColisTab dossier={dossier} /></TabsContent>
          <TabsContent value="transport"  className="mt-0"><TransportTab dossier={dossier} /></TabsContent>
          <TabsContent value="livraison"  className="mt-0"><LivraisonTab dossier={dossier} /></TabsContent>
          <TabsContent value="paiement"   className="mt-0"><PaiementTab dossier={dossier} /></TabsContent>
          <TabsContent value="documents"  className="mt-0"><DocumentsTab dossier={dossier} /></TabsContent>
          <TabsContent value="messages"   className="mt-0"><MessagesTab dossier={dossier} isStaff={isStaff} /></TabsContent>
          <TabsContent value="historique" className="mt-0"><HistoriqueTab id={dossier.id} /></TabsContent>
        </div>
      </Tabs>

      <DossierFooter
        dossier={dossier}
        apercuSave={tab === 'apercu' ? apercuSave : null}
      />
    </>
  );
}

/* ---------------- Header ---------------- */

function DossierHeader({ dossier, onChanged }: { dossier: DossierRow; onChanged: () => void }) {
  const qc = useQueryClient();
  const statutOptions = getStatutsPourDossier({
    app_source: dossier.app_source,
    needs_sourcing: dossier.needs_sourcing,
  });

  const setStatus = useMutation({
    mutationFn: async (next: string) => {
      const { error } = await supabase
        .from('dossiers')
        .update({ status: next as DossierStatus })
        .eq('id', dossier.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Statut mis à jour');
      qc.invalidateQueries({ queryKey: ['admin-dossier', dossier.id] });
      qc.invalidateQueries({ queryKey: ['dossiers'] });
      onChanged();
    },
    onError: (e: any) => toast.error(e?.message || 'Échec mise à jour'),
  });

  const origin = dossier.origin_country as string;
  const dest = dossier.destination_country as string;
  const originCity = (dossier.origin_city as string | null) || null;
  const destCity = (dossier.destination_city as string | null) || null;
  const originLabel = originCity || (COUNTRY_NAMES[origin as keyof typeof COUNTRY_NAMES] ?? origin);
  const destLabel = destCity || (COUNTRY_NAMES[dest as keyof typeof COUNTRY_NAMES] ?? dest);

  return (
    <SheetHeader className="px-6 pt-6 pb-4 border-b border-border space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <SheetTitle className="text-lg flex items-center gap-2 flex-wrap">
            <span className="truncate font-mono">{dossier.tracking_id || dossier.reference}</span>
            {dossier.tracking_id && (
              <button
                onClick={() => copy(dossier.tracking_id)}
                title="Copier le tracking"
                className="text-muted-foreground hover:text-foreground"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
            {dossier.tracking_id && (
              <span className="text-[10px] font-mono text-muted-foreground/60" title="Référence interne">
                Réf. interne : {dossier.reference}
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2 text-xs flex-wrap">
            <span title={COUNTRY_NAMES[origin as keyof typeof COUNTRY_NAMES] ?? origin}>
              {COUNTRY_FLAGS[origin as keyof typeof COUNTRY_FLAGS] ?? '🌍'} {originLabel}
            </span>
            <span>→</span>
            <span title={COUNTRY_NAMES[dest as keyof typeof COUNTRY_NAMES] ?? dest}>
              {COUNTRY_FLAGS[dest as keyof typeof COUNTRY_FLAGS] ?? '🌍'} {destLabel}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              Créé le {format(new Date(dossier.created_at), 'dd/MM/yyyy HH:mm')}
            </span>
          </SheetDescription>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={dossier.status}
          onValueChange={(v) => setStatus.mutate(v)}
          disabled={setStatus.isPending}
        >
          <SelectTrigger className="h-8 w-64 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statutOptions.map(s => (
              <SelectItem key={s.value} value={s.value} className="text-xs">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {dossier.contact_phone && (() => {
          const waHref = `https://wa.me/${dossier.contact_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Bonjour, à propos de votre dossier ${dossier.reference}`)}`;
          return (
            <div className="inline-flex">
              <Button size="sm" variant="outline" className="h-8 text-xs rounded-r-none border-r-0" asChild>
                <a href={waHref} target="_blank" rel="noreferrer">
                  <MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp client
                </a>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2 rounded-l-none"
                title="Copier le lien wa.me (envoyer depuis mon téléphone)"
                onClick={() => {
                  navigator.clipboard?.writeText(waHref).then(() => toast.success('Lien WhatsApp copié'));
                }}
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          );
        })()}

        {dossier.tracking_id && (
          <>
            <Button size="sm" variant="ghost" className="h-8 text-xs" asChild title="Vue client — page de suivi">
              <a href={`/suivre/${dossier.tracking_id}`} target="_blank" rel="noreferrer">
                <ExternalLink className="w-3.5 h-3.5 mr-1" /> Voir /suivre
              </a>
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" asChild title="Vue client — page de paiement">
              <a href={`/pay/${dossier.tracking_id}`} target="_blank" rel="noreferrer">
                <ExternalLink className="w-3.5 h-3.5 mr-1" /> Voir /pay
              </a>
            </Button>
          </>
        )}
      </div>
    </SheetHeader>
  );
}

/* ---------------- Aperçu (editable) ---------------- */

type ContactInfo = { name: string | null; phone: string | null; address: string | null };

function ApercuTab({
  dossier,
  sender,
  recipient,
  parsed: parsedProp,
  registerSave,
}: {
  dossier: DossierRow;
  sender: ContactInfo;
  recipient: ContactInfo;
  parsed: ParsedClientNotes;
  registerSave: (s: { run: () => void; pending: boolean; dirty: boolean } | null) => void;
}) {
  const qc = useQueryClient();
  const parsed = parsedProp;

  const initial = () => ({
    sender_name:        dossier.sender_name        ?? parsed.senderName       ?? '',
    sender_phone:       dossier.sender_phone       ?? parsed.senderPhone      ?? dossier.contact_phone ?? '',
    sender_address:     dossier.sender_address     ?? parsed.senderAddress    ?? '',
    pickup_date:        dossier.pickup_date        ?? (parsed.pickupDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.pickupDate) ? parsed.pickupDate : '') ?? '',
    recipient_name:     dossier.recipient_name     ?? parsed.recipientName    ?? '',
    recipient_phone:    dossier.recipient_phone    ?? parsed.recipientPhone   ?? '',
    recipient_address:  dossier.recipient_address  ?? parsed.recipientAddress ?? '',
    product_description: dossier.product_description ?? parsed.description    ?? '',
    estimated_weight:   dossier.estimated_weight   ?? parsed.weightKg         ?? '',
    declared_value:     dossier.declared_value     ?? '',
    admin_notes:        dossier.admin_notes        ?? '',
  });
  const [form, setForm] = useState(initial);

  useEffect(() => { setForm(initial()); /* eslint-disable-next-line */ }, [dossier.id]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      if (payload.pickup_date === '') payload.pickup_date = null;
      if (payload.estimated_weight === '') payload.estimated_weight = null;
      if (payload.declared_value === '') payload.declared_value = null;
      const { error } = await supabase.from('dossiers').update(payload).eq('id', dossier.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Dossier enregistré');
      qc.invalidateQueries({ queryKey: ['admin-dossier', dossier.id] });
      qc.invalidateQueries({ queryKey: ['dossiers'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Échec enregistrement'),
  });

  // Register save handler so the footer can trigger it as an icon-only button.
  useEffect(() => {
    registerSave({
      run: () => save.mutate(),
      pending: save.isPending,
      dirty: true,
    });
    return () => registerSave(null);
  }, [registerSave, save.isPending, form]);

  const field = (k: keyof typeof form, label: string, type: 'text' | 'tel' | 'date' | 'number' | 'textarea' = 'text') => (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {type === 'textarea' ? (
        <Textarea
          value={form[k] as string}
          onChange={(e) => setForm(f => ({ ...f, [k]: e.target.value }))}
          rows={3}
          className="text-sm"
        />
      ) : (
        <Input
          type={type}
          value={form[k] as string}
          onChange={(e) => setForm(f => ({ ...f, [k]: e.target.value }))}
          className="h-9 text-sm"
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ContactBlock
          title="Expéditeur"
          accent="sender"
          name={sender.name}
          phone={sender.phone}
          address={sender.address}
          extra={parsed.pickupDate ? `Collecte : ${parsed.pickupDate}${parsed.pickupSlot ? ` · ${parsed.pickupSlot === 'morning' ? 'Matin' : parsed.pickupSlot === 'afternoon' ? 'Après-midi' : parsed.pickupSlot}` : ''}` : null}
          whatsappPrefill={`Bonjour, à propos de votre dossier ${dossier.reference}`}
        />
        <ContactBlock
          title="Destinataire"
          accent="recipient"
          name={recipient.name}
          phone={recipient.phone}
          address={recipient.address}
          extra={
            [dossier.destination_city, dossier.destination_country].filter(Boolean).join(' · ') || null
          }
        />
      </div>

      <ClientNotesPanel parsed={parsed} raw={dossier.notes} />

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Expéditeur — édition</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field('sender_name', 'Nom')}
          {field('sender_phone', 'Téléphone', 'tel')}
          {field('pickup_date', 'Date d\'enlèvement', 'date')}
        </div>
        {field('sender_address', 'Adresse', 'textarea')}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Destinataire — édition</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field('recipient_name', 'Nom')}
          {field('recipient_phone', 'Téléphone', 'tel')}
        </div>
        {field('recipient_address', 'Adresse', 'textarea')}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Marchandise</h3>
        {field('product_description', 'Description', 'textarea')}
        <div className="grid grid-cols-2 gap-3">
          {field('estimated_weight', 'Poids estimé (kg)', 'number')}
          {field('declared_value', 'Valeur déclarée (EUR)', 'number')}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Notes admin (internes)</h3>
        {field('admin_notes', '', 'textarea')}
      </section>
    </div>
  );
}

/* ---------------- Notes client (essentials first) ---------------- */

function ClientNotesPanel({ parsed, raw }: { parsed: ParsedClientNotes; raw?: string | null }) {
  const [showRaw, setShowRaw] = useState(false);
  if (!raw && !hasParsedEssentials(parsed)) return null;

  const chips: Array<{ label: string; value: string; tone?: string }> = [];
  if (parsed.weightKg)       chips.push({ label: 'Poids', value: `${parsed.weightKg} kg${parsed.parcelCount ? ` · ${parsed.parcelCount} colis` : ''}`, tone: 'bg-blue-500/10 text-blue-500 border-blue-500/20' });
  if (parsed.declaredValue)  chips.push({ label: 'Valeur', value: parsed.declaredValue, tone: 'bg-amber-500/10 text-amber-500 border-amber-500/20' });
  if (parsed.transport)      chips.push({ label: 'Transport', value: `${parsed.transport}${parsed.priority ? ` · ${parsed.priority}` : ''}`, tone: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' });
  if (parsed.payment)        chips.push({ label: 'Paiement', value: parsed.payment, tone: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' });
  if (parsed.insurance && parsed.insurance.toLowerCase() !== 'none')
                             chips.push({ label: 'Assurance', value: parsed.insurance, tone: 'bg-pink-500/10 text-pink-500 border-pink-500/20' });
  if (parsed.pickupDate)     chips.push({ label: 'Collecte', value: `${parsed.pickupDate}${parsed.pickupSlot ? ` · ${parsed.pickupSlot === 'morning' ? 'Matin' : parsed.pickupSlot === 'afternoon' ? 'Après-midi' : parsed.pickupSlot}` : ''}`, tone: 'bg-violet-500/10 text-violet-500 border-violet-500/20' });
  if (parsed.profile)        chips.push({ label: 'Profil', value: parsed.profile });
  if (parsed.goodsType)      chips.push({ label: 'Type', value: parsed.goodsType });

  return (
    <section className="rounded-xl border border-border bg-card/60 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
          Notes client
        </h3>
        {raw && (
          <button
            type="button"
            onClick={() => setShowRaw(v => !v)}
            className="text-[10px] text-muted-foreground hover:text-foreground underline"
          >
            {showRaw ? 'Masquer le brut' : 'Voir le brut'}
          </button>
        )}
      </div>

      {parsed.description && (
        <p className="text-sm text-foreground leading-snug">
          {parsed.description}
        </p>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map(c => (
            <span
              key={c.label}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] ${c.tone || 'bg-secondary text-muted-foreground border-border'}`}
            >
              <span className="opacity-70">{c.label}</span>
              <span className="font-medium">{c.value}</span>
            </span>
          ))}
        </div>
      )}

      {parsed.rest.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
          {parsed.rest.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}

      {showRaw && raw && (
        <pre className="text-[11px] bg-background border border-border rounded-md p-2 whitespace-pre-wrap font-mono text-muted-foreground">
{raw}
          </pre>
      )}
    </section>
  );
}

/* ---------------- Transport ---------------- */

function TransportTab({ dossier }: { dossier: DossierRow }) {
  const qc = useQueryClient();
  const [ref, setRef] = useState(dossier.assigned_transporteur_ref ?? '');
  const [matched, setMatched] = useState<any>(null);

  useEffect(() => {
    setRef(dossier.assigned_transporteur_ref ?? '');
  }, [dossier.id, dossier.assigned_transporteur_ref]);

  const assign = useMutation({
    mutationFn: async (newRef: string | null) => {
      if (!newRef) {
        const { error } = await supabase
          .from('dossiers')
          .update({ assigned_transporteur_ref: null })
          .eq('id', dossier.id);
        if (error) throw error;
        return;
      }
      const res = await assignTransporteurAndNotify({
        dossierId: dossier.id,
        transporteurRef: newRef,
      });
      if (!res.ok) throw new Error('Echec');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-dossier', dossier.id] });
      qc.invalidateQueries({ queryKey: ['dossiers'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Échec'),
  });

  const currentRef = dossier.assigned_transporteur_ref;

  return (
    <div className="space-y-6">
      {currentRef ? (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-primary" />
            <div className="font-medium text-sm">Transporteur assigné</div>
            <Badge variant="secondary" className="ml-auto font-mono">{currentRef}</Badge>
          </div>
          <CurrentTransporteurInfo ref_={currentRef} />
          <NotifyGpButton dossier={dossier} transporteurRef={currentRef} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setRef(''); assign.mutate(null); }}
            disabled={assign.isPending}
            className="text-xs"
          >
            Détacher
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Saisis la référence à 4 chiffres du transporteur (GP) à qui confier ce dossier.
          </div>
          <TransporteurReferenceLookup
            value={ref}
            onChange={setRef}
            onMatch={setMatched}
            destinationCity={(dossier as any).destination_city ?? null}
            destinationCountry={dossier.destination_country ?? null}
          />
          <Button
            size="sm"
            onClick={() => assign.mutate(ref)}
            disabled={ref.length !== 4 || assign.isPending}
          >
            {assign.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Truck className="w-3.5 h-3.5 mr-1" />}
            Assigner
          </Button>
        </div>
      )}

      <PricingBreakdownPanel
        gpRatePerKg={(dossier as any).gp_rate_per_kg}
        yobbanteMarginPct={(dossier as any).yobbante_margin_pct}
        pickupZone={(dossier as any).pickup_zone}
        enlevementAmount={(dossier as any).enlevement_amount}
        deliveryCarrierCost={(dossier as any).delivery_carrier_cost}
        displayedPricePerKg={(dossier as any).displayed_price_per_kg}
        totalDisplayedPrice={(dossier as any).total_displayed_price}
        totalCostPrice={(dossier as any).total_cost_price}
        yobbanteGrossMargin={(dossier as any).yobbante_gross_margin}
        weightKg={dossier.actual_weight_kg ?? dossier.estimated_weight}
        isExpress={(dossier as any).is_express}
        isEstimate={(dossier as any).price_is_estimate ?? true}
      />
    </div>
  );

}


function CurrentTransporteurInfo({ ref_ }: { ref_: string }) {
  const { data } = useQuery({
    queryKey: ['transporteur-by-ref', ref_],
    queryFn: async () => {
      const { data } = await supabase
        .from('transporteurs' as any)
        .select('*')
        .eq('reference', ref_)
        .maybeSingle();
      return data as any;
    },
  });
  if (!data) return <div className="text-xs text-muted-foreground">Aucun profil trouvé pour cette référence.</div>;
  return (
    <div className="text-xs space-y-0.5">
      <div className="font-medium text-foreground">{data.prenom} {data.nom}</div>
      {data.telephone_1 && <div className="text-muted-foreground">📞 {data.telephone_1}</div>}
      {data.adresse_collecte_dakar && <div className="text-muted-foreground">📍 {data.adresse_collecte_dakar}</div>}
    </div>
  );
}

function NotifyGpButton({ dossier, transporteurRef }: { dossier: DossierRow; transporteurRef: string }) {
  const [sending, setSending] = useState(false);
  const { data: gp } = useQuery({
    queryKey: ['transporteur-by-ref', transporteurRef],
    queryFn: async () => {
      const { data } = await supabase
        .from('transporteurs' as any)
        .select('prenom, nom, telephone_1')
        .eq('reference', transporteurRef)
        .maybeSingle();
      return data as any;
    },
  });

  const lastNotifiedAt = dossier.gp_reminded_at;

  async function handleSend() {
    if (!gp?.telephone_1) {
      toast.error('Numéro du GP introuvable');
      return;
    }
    setSending(true);
    try {
      const message = buildGpAssignMessage({
        gp_prenom: gp.prenom,
        tracking_id: dossier.tracking_id,
        reference: dossier.reference,
        origin: dossier.origin_country,
        destination: dossier.destination_country,
        client_name: dossier.sender_name || dossier.recipient_name,
        weight: dossier.estimated_weight,
        pickup_address: dossier.sender_address,
        pickup_date: dossier.pickup_date,
      });
      const res = await sendGpMessage({
        phone: gp.telephone_1,
        message,
        dossier_id: dossier.id,
        trigger_type: 'gp_assignment_notice',
      });
      if (res.ok) {
        toast.success('GP notifié sur WhatsApp');
        await supabase
          .from('dossiers')
          .update({ gp_reminded_at: new Date().toISOString() })
          .eq('id', dossier.id);
      }
    } finally {
      setSending(false);
    }
  }

  function buildWaHref() {
    if (!gp?.telephone_1) return '';
    const message = buildGpAssignMessage({
      gp_prenom: gp.prenom,
      tracking_id: dossier.tracking_id,
      reference: dossier.reference,
      origin: dossier.origin_country,
      destination: dossier.destination_country,
      client_name: dossier.sender_name || dossier.recipient_name,
      weight: dossier.estimated_weight,
      pickup_address: dossier.sender_address,
      pickup_date: dossier.pickup_date,
    });
    return `https://wa.me/${String(gp.telephone_1).replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
  }

  return (
    <div className="space-y-1.5">
      <div className="inline-flex">
        <Button
          size="sm"
          onClick={handleSend}
          disabled={sending || !gp?.telephone_1}
          className="text-xs bg-green-600 hover:bg-green-700 text-white rounded-r-none"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5 mr-1" />}
          Envoyer WhatsApp au GP
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-8 px-2 rounded-l-none border-green-600/40 text-green-600 hover:text-green-700"
          disabled={!gp?.telephone_1}
          title="Copier le lien wa.me (envoyer depuis mon téléphone)"
          onClick={() => {
            const href = buildWaHref();
            if (!href) return;
            navigator.clipboard?.writeText(href).then(() => toast.success('Lien WhatsApp copié'));
          }}
        >
          <Copy className="w-3.5 h-3.5" />
        </Button>
      </div>
      {lastNotifiedAt && (
        <div className="text-[10px] text-muted-foreground">
          Notifié le {format(new Date(lastNotifiedAt), 'dd/MM/yyyy HH:mm')}
        </div>
      )}
    </div>
  );
}


/* ---------------- Paiement ---------------- */

function PaiementTab({ dossier }: { dossier: DossierRow }) {
  const qc = useQueryClient();

  const markPaid = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('dossiers')
        .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', dossier.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Marqué comme payé');
      qc.invalidateQueries({ queryKey: ['admin-dossier', dossier.id] });
      qc.invalidateQueries({ queryKey: ['dossiers'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Échec'),
  });

  const toggleCod = useMutation({
    mutationFn: async (v: boolean) => {
      const { error } = await supabase
        .from('dossiers')
        .update({
          cash_on_delivery: v,
          payment_status: v ? 'pending_delivery' : 'pending',
        })
        .eq('id', dossier.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-dossier', dossier.id] });
    },
  });

  const paid = dossier.payment_status === 'paid';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <KV label="Statut paiement" value={
          paid
            ? <Badge className="bg-green-500/10 text-green-500 border-green-500/30">Payé</Badge>
            : <Badge variant="secondary">{dossier.payment_status || 'pending'}</Badge>
        } />
        <KV label="Montant final" value={fmtXof(dossier.final_amount_xof)} />
        <KV label="Poids pesé" value={dossier.actual_weight_kg ? `${dossier.actual_weight_kg} kg` : '—'} />
        <KV label="Méthode" value={dossier.payment_method || '—'} />
      </div>

      <div className="rounded-lg border border-border p-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Paiement à la livraison (COD)</div>
          <div className="text-xs text-muted-foreground">Le client règle au livreur à la remise.</div>
        </div>
        <Switch
          checked={!!dossier.cash_on_delivery}
          onCheckedChange={(v) => toggleCod.mutate(v)}
          disabled={paid || toggleCod.isPending}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {!paid && (
          <Button size="sm" onClick={() => markPaid.mutate()} disabled={markPaid.isPending}>
            {markPaid.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
            Marquer comme payé
          </Button>
        )}
        {dossier.invoice_url && (
          <Button size="sm" variant="outline" asChild>
            <a href={dossier.invoice_url} target="_blank" rel="noreferrer">
              <FileText className="w-3.5 h-3.5 mr-1" /> Voir la facture
            </a>
          </Button>
        )}
      </div>

      {!dossier.actual_weight_kg && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 flex items-start gap-2 text-xs">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <span>Le dossier n'a pas encore été pesé. Pèse-le pour générer le montant final.</span>
        </div>
      )}
    </div>
  );
}

function KV({ label, value }: { label: string; value: any }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

/* ---------------- Messages ---------------- */

function MessagesTab({ dossier, isStaff }: { dossier: DossierRow; isStaff: boolean }) {
  const { messages, isLoading, sendMessage } = useDossierMessages(dossier.id);
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);

  const visible = isStaff ? messages : messages.filter(m => !m.internal_note);

  const send = async () => {
    if (!body.trim()) return;
    try {
      await sendMessage.mutateAsync({ body: body.trim(), asStaff: isStaff, internal: isStaff && internal });
      setBody('');
    } catch (e: any) {
      toast.error(e?.message || 'Échec envoi');
    }
  };

  return (
    <div className="flex flex-col h-[60vh]">
      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : visible.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-8">Aucun message pour le moment.</div>
        ) : (
          visible.map(m => (
            <div
              key={m.id}
              className={`rounded-lg p-3 text-sm max-w-[80%] ${
                m.author_role === 'staff'
                  ? 'ml-auto bg-primary/10 border border-primary/20'
                  : 'bg-muted'
              } ${m.internal_note ? 'border-amber-500/40 bg-amber-500/10' : ''}`}
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                <span>{m.author_role === 'staff' ? 'Staff' : 'Client'}</span>
                {m.internal_note && <Badge variant="outline" className="text-[9px] h-4">Interne</Badge>}
                <span className="ml-auto">{format(new Date(m.created_at), 'dd/MM HH:mm')}</span>
              </div>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border pt-3 mt-3 space-y-2">
        {!internal && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground self-center mr-1">
              Templates :
            </span>
            {CLIENT_TEMPLATES.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setBody(t.build({
                  prenom: dossier.sender_name || dossier.recipient_name,
                  tracking_id: dossier.tracking_id,
                  reference: dossier.reference,
                  origin: dossier.origin_country,
                  destination: dossier.destination_country,
                  status: dossier.status,
                }))}
                title={t.description}
                className="px-2 py-1 rounded-md text-[11px] bg-secondary text-muted-foreground hover:bg-[#F5C518]/15 hover:text-[#F5C518] border border-border transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        {isStaff && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={internal} onCheckedChange={setInternal} />
            Note interne (invisible client)
          </label>
        )}
        <div className="flex gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={internal ? 'Note interne…' : 'Message au client…'}
            rows={3}
            className="text-sm flex-1"
          />
          <Button onClick={send} disabled={!body.trim() || sendMessage.isPending} size="sm">
            {sendMessage.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

    </div>
  );
}

/* ---------------- Historique (timeline) ---------------- */

const EVENT_META: Record<string, { label: string; icon: string; tone: string }> = {
  dossier_created:        { label: 'Dossier créé',           icon: '📦', tone: 'text-primary' },
  status_changed:         { label: 'Changement de statut',   icon: '🔄', tone: 'text-blue-500' },
  payment_received:       { label: 'Paiement reçu',          icon: '💰', tone: 'text-green-500' },
  payment_status_changed: { label: 'Statut paiement modifié', icon: '💳', tone: 'text-amber-500' },
  package_attached:       { label: 'Colis rattaché',         icon: '➕', tone: 'text-foreground' },
  package_detached:       { label: 'Colis détaché',          icon: '➖', tone: 'text-muted-foreground' },
  weighed:                { label: 'Dossier pesé',           icon: '⚖️', tone: 'text-primary' },
  transporteur_assigned:  { label: 'Transporteur assigné',   icon: '🚚', tone: 'text-primary' },
  transporteur_detached:  { label: 'Transporteur détaché',   icon: '🚫', tone: 'text-muted-foreground' },
  collected:              { label: 'Collecté chez le client', icon: '📥', tone: 'text-blue-500' },
  in_transit:             { label: 'En transit',             icon: '✈️', tone: 'text-blue-500' },
  arrived_hub:            { label: 'Arrivé au hub',          icon: '🏁', tone: 'text-primary' },
  delivered:              { label: 'Livré',                  icon: '✅', tone: 'text-green-500' },
  dossier_cancelled:      { label: 'Dossier annulé',         icon: '⛔', tone: 'text-destructive' },
  public_edit_applied:    { label: 'Édition publique',       icon: '✏️', tone: 'text-muted-foreground' },
  document_uploaded:      { label: 'Document ajouté',        icon: '📄', tone: 'text-foreground' },
  message_sent:           { label: 'Message envoyé',         icon: '💬', tone: 'text-muted-foreground' },
};

function summarizeEvent(e: any): string | null {
  const d = e.event_data || {};
  switch (e.event_type) {
    case 'status_changed':
      return d.from && d.to ? `${d.from} → ${d.to}` : (d.to ?? null);
    case 'transporteur_assigned':
      return d.reference ? `GP${d.reference}` : (d.transporteur_ref ?? null);
    case 'weighed':
      return d.weight_kg ? `${d.weight_kg} kg` : null;
    case 'payment_status_changed':
      return d.from && d.to ? `${d.from} → ${d.to}` : null;
    case 'public_edit_applied':
      if (Array.isArray(d.changes) && d.changes.length) {
        return d.changes.map((c: any) => c.field).join(', ');
      }
      return null;
    case 'package_attached':
    case 'package_detached':
      return d.package_id ? String(d.package_id).slice(0, 8) : null;
    default:
      return d.note ?? d.message ?? null;
  }
}

function HistoriqueTab({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['dossier-events', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossier_events')
        .select('*')
        .eq('dossier_id', id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`dossier-events-${id}-${crypto.randomUUID()}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dossier_events', filter: `dossier_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ['dossier-events', id] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (events.length === 0) {
    return <div className="text-xs text-muted-foreground text-center py-8">Aucun évènement enregistré.</div>;
  }

  return (
    <ol className="relative border-l border-border pl-5 space-y-4">
      {events.map((e: any) => {
        const meta = EVENT_META[e.event_type] ?? { label: e.event_type, icon: '•', tone: 'text-muted-foreground' };
        const summary = summarizeEvent(e);
        return (
          <li key={e.id} className="relative">
            <span className="absolute -left-[27px] top-0 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-[12px]">
              {meta.icon}
            </span>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-semibold ${meta.tone}`}>{meta.label}</span>
                <span className="text-[10px] text-muted-foreground">{format(new Date(e.created_at), 'dd/MM/yyyy HH:mm')}</span>
              </div>
              {summary && (
                <div className="mt-1 text-xs text-muted-foreground">{summary}</div>
              )}
              {!summary && e.event_data && Object.keys(e.event_data).length > 0 && (
                <details className="mt-1">
                  <summary className="text-[10px] text-muted-foreground cursor-pointer">Détails techniques</summary>
                  <pre className="mt-1 text-[10px] text-muted-foreground bg-muted rounded p-2 overflow-x-auto">
                    {JSON.stringify(e.event_data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}


/* ---------------- Footer ---------------- */

function DossierFooter({
  dossier,
  apercuSave,
}: {
  dossier: DossierRow;
  apercuSave: { run: () => void; pending: boolean; dirty: boolean } | null;
}) {
  const qc = useQueryClient();
  const cancel = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('dossiers')
        .update({ status: 'CANCELLED' as DossierStatus })
        .eq('id', dossier.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Dossier annulé');
      qc.invalidateQueries({ queryKey: ['admin-dossier', dossier.id] });
      qc.invalidateQueries({ queryKey: ['dossiers'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Échec annulation'),
  });

  return (
    <div className="border-t border-border px-6 py-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>MAJ : {format(new Date(dossier.updated_at), 'dd/MM/yyyy HH:mm')}</span>
      <div className="flex items-center gap-1">
        {apercuSave && (
          <Button
            size="sm"
            onClick={apercuSave.run}
            disabled={apercuSave.pending}
            className="h-8 w-8 p-0"
            title="Enregistrer les modifications"
          >
            {apercuSave.pending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <CheckCircle2 className="w-4 h-4" />}
          </Button>
        )}
        {dossier.status !== 'CANCELLED' && dossier.status !== 'DELIVERED' && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive h-8 text-xs"
            onClick={() => { if (confirm('Annuler ce dossier ?')) cancel.mutate(); }}
            disabled={cancel.isPending}
          >
            Annuler le dossier
          </Button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Colis & poids ---------------- */

function ColisTab({ dossier }: { dossier: DossierRow }) {
  const qc = useQueryClient();
  const [attachOpen, setAttachOpen] = useState(false);
  const [weighOpen, setWeighOpen] = useState(false);
  const [draftWeights, setDraftWeights] = useState<Record<string, string>>({});

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['dossier-packages', dossier.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('dossier_id', dossier.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Realtime — refresh on any packages change for this dossier
  useEffect(() => {
    const ch = supabase
      .channel(`dossier-packages-${dossier.id}-${crypto.randomUUID()}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'packages', filter: `dossier_id=eq.${dossier.id}` },
        () => qc.invalidateQueries({ queryKey: ['dossier-packages', dossier.id] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [dossier.id, qc]);

  const totalDeclared = packages.reduce((s, p: any) => s + (Number(p.weight) || 0), 0);

  const updateWeight = useMutation({
    mutationFn: async ({ id, weight }: { id: string; weight: number | null }) => {
      const { error } = await supabase.from('packages').update({ weight }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Poids mis à jour');
      qc.invalidateQueries({ queryKey: ['dossier-packages', dossier.id] });
    },
    onError: (e: any) => toast.error(e?.message || 'Échec'),
  });

  const detachPackage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('packages').update({ dossier_id: null }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Colis détaché');
      qc.invalidateQueries({ queryKey: ['dossier-packages', dossier.id] });
    },
    onError: (e: any) => toast.error(e?.message || 'Échec'),
  });

  const weighingDossier: WeighingDossier = {
    id: dossier.id,
    reference: dossier.reference,
    tracking_id: dossier.tracking_id,
    buyer_name: dossier.buyer_name,
    contact_phone: dossier.contact_phone,
    estimated_weight: dossier.estimated_weight,
    estimated_cost: dossier.estimated_cost,
    destination_country: dossier.destination_country,
    user_id: dossier.user_id,
    gp_rate_per_kg: (dossier as any).gp_rate_per_kg,
    pickup_zone: (dossier as any).pickup_zone,
    sender_address: (dossier as any).sender_address,
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <KV label="Poids estimé" value={dossier.estimated_weight ? `${dossier.estimated_weight} kg` : '—'} />
        <KV label="Poids déclaré (colis)" value={totalDeclared ? `${totalDeclared.toFixed(2)} kg` : '—'} />
        <KV label="Poids pesé" value={dossier.actual_weight_kg ? `${dossier.actual_weight_kg} kg` : '—'} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setAttachOpen(true)}>
          <PackageIcon className="w-3.5 h-3.5 mr-1" /> Attacher / détacher des colis
        </Button>
        <Button size="sm" onClick={() => setWeighOpen(true)}>
          <Scale className="w-3.5 h-3.5 mr-1" />
          {dossier.actual_weight_kg ? 'Re-peser' : 'Peser le dossier'}
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Colis rattachés ({packages.length})</h3>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : packages.length === 0 ? (
          <div className="text-xs text-muted-foreground rounded-lg border border-dashed border-border p-4 text-center">
            Aucun colis n'est rattaché à ce dossier.
          </div>
        ) : (
          <ul className="space-y-2">
            {packages.map((p: any) => {
              const draft = draftWeights[p.id];
              const currentVal = draft !== undefined ? draft : (p.weight != null ? String(p.weight) : '');
              const changed = draft !== undefined && draft !== (p.weight != null ? String(p.weight) : '');
              return (
                <li key={p.id} className="rounded-lg border border-border p-3 text-xs flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-foreground">{p.id.slice(0, 8)}</div>
                    <div className="text-muted-foreground truncate">{p.description || 'Sans description'}</div>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{p.status}</Badge>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={currentVal}
                      onChange={(e) => setDraftWeights(d => ({ ...d, [p.id]: e.target.value }))}
                      className="h-7 w-20 text-xs"
                      placeholder="kg"
                    />
                    <span className="text-muted-foreground">kg</span>
                    {changed && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[10px]"
                        disabled={updateWeight.isPending}
                        onClick={() => {
                          const w = currentVal === '' ? null : Number(currentVal);
                          updateWeight.mutate({ id: p.id, weight: w }, {
                            onSuccess: () => setDraftWeights(d => { const { [p.id]: _, ...rest } = d; return rest; }),
                          });
                        }}
                      >
                        OK
                      </Button>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => { if (confirm('Détacher ce colis du dossier ?')) detachPackage.mutate(p.id); }}
                    disabled={detachPackage.isPending}
                    title="Détacher"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AttachPackagesDialog
        open={attachOpen}
        onOpenChange={(v) => { setAttachOpen(v); if (!v) qc.invalidateQueries({ queryKey: ['dossier-packages', dossier.id] }); }}
        dossierId={dossier.id}
        ownerUserId={dossier.user_id}
      />
      <WeighingDialog
        dossier={weighOpen ? weighingDossier : null}
        open={weighOpen}
        onClose={() => setWeighOpen(false)}
        onDone={() => {
          setWeighOpen(false);
          qc.invalidateQueries({ queryKey: ['admin-dossier', dossier.id] });
        }}
      />
    </div>
  );
}


/* ---------------- Livraison (dernier km) ---------------- */

function LivraisonTab({ dossier }: { dossier: DossierRow }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    delivery_mode: dossier.delivery_mode ?? 'pickup_gp',
    dernier_km_carrier: dossier.dernier_km_carrier ?? '',
    dernier_km_tracking: dossier.dernier_km_tracking ?? '',
    dernier_km_adresse: dossier.dernier_km_adresse ?? '',
    dernier_km_prix: dossier.dernier_km_prix ?? '',
    delivery_appointment: dossier.delivery_appointment ? new Date(dossier.delivery_appointment).toISOString().slice(0, 16) : '',
  });

  useEffect(() => {
    setForm({
      delivery_mode: dossier.delivery_mode ?? 'pickup_gp',
      dernier_km_carrier: dossier.dernier_km_carrier ?? '',
      dernier_km_tracking: dossier.dernier_km_tracking ?? '',
      dernier_km_adresse: dossier.dernier_km_adresse ?? '',
      dernier_km_prix: dossier.dernier_km_prix ?? '',
      delivery_appointment: dossier.delivery_appointment ? new Date(dossier.delivery_appointment).toISOString().slice(0, 16) : '',
    });
  }, [dossier.id]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      if (payload.dernier_km_prix === '') payload.dernier_km_prix = null;
      if (payload.delivery_appointment === '') payload.delivery_appointment = null;
      else payload.delivery_appointment = new Date(payload.delivery_appointment).toISOString();
      const { error } = await supabase.from('dossiers').update(payload).eq('id', dossier.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Livraison mise à jour');
      qc.invalidateQueries({ queryKey: ['admin-dossier', dossier.id] });
    },
    onError: (e: any) => toast.error(e?.message || 'Échec'),
  });

  const markDelivered = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('dossiers')
        .update({ status: 'DELIVERED' as DossierStatus, delivered_at: new Date().toISOString() })
        .eq('id', dossier.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Dossier marqué livré');
      qc.invalidateQueries({ queryKey: ['admin-dossier', dossier.id] });
      qc.invalidateQueries({ queryKey: ['dossiers'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Échec'),
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <KV label="Mode de livraison" value={dossier.delivery_mode || '—'} />
        <KV label="Livré le" value={dossier.delivered_at ? format(new Date(dossier.delivered_at), 'dd/MM/yyyy HH:mm') : '—'} />
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Adresse destinataire (rappel)</h3>
        <div className="text-xs text-muted-foreground rounded-lg bg-muted p-3 space-y-0.5">
          <div className="font-medium text-foreground">{dossier.recipient_name || '—'}</div>
          <div>{dossier.recipient_phone || '—'}</div>
          <div className="whitespace-pre-wrap">{dossier.recipient_address || '—'}</div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Dernier kilomètre</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Mode</Label>
            <Select value={form.delivery_mode} onValueChange={(v) => setForm(f => ({ ...f, delivery_mode: v }))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pickup_gp">Retrait chez le GP</SelectItem>
                <SelectItem value="relay_point">Point relais</SelectItem>
                <SelectItem value="home_delivery">Livraison à domicile</SelectItem>
                <SelectItem value="hub_pickup">Retrait en hub</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Transporteur dernier km</Label>
            <Input value={form.dernier_km_carrier} onChange={(e) => setForm(f => ({ ...f, dernier_km_carrier: e.target.value }))} placeholder="Yango, livreur interne…" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">N° de suivi</Label>
            <Input value={form.dernier_km_tracking} onChange={(e) => setForm(f => ({ ...f, dernier_km_tracking: e.target.value }))} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Prix (XOF)</Label>
            <Input type="number" value={form.dernier_km_prix as any} onChange={(e) => setForm(f => ({ ...f, dernier_km_prix: e.target.value as any }))} className="h-9 text-sm" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Adresse précise de livraison</Label>
            <Textarea value={form.dernier_km_adresse} onChange={(e) => setForm(f => ({ ...f, dernier_km_adresse: e.target.value }))} rows={2} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Rendez-vous livraison</Label>
            <Input type="datetime-local" value={form.delivery_appointment} onChange={(e) => setForm(f => ({ ...f, delivery_appointment: e.target.value }))} className="h-9 text-sm" />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap justify-between gap-2 sticky bottom-0 bg-background py-3 border-t border-border -mx-6 px-6">
        <Button onClick={() => save.mutate()} disabled={save.isPending} size="sm" variant="outline">
          {save.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
          Enregistrer
        </Button>
        {dossier.status !== 'DELIVERED' && (
          <Button onClick={() => { if (confirm('Marquer ce dossier comme livré ?')) markDelivered.mutate(); }} disabled={markDelivered.isPending} size="sm">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Marquer livré
          </Button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Documents ---------------- */

function DocumentsTab({ dossier }: { dossier: DossierRow }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['dossier-documents', dossier.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossier_documents')
        .select('*')
        .eq('dossier_id', dossier.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: customs = [] } = useQuery({
    queryKey: ['dossier-customs', dossier.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossier_customs_documents')
        .select('*')
        .eq('dossier_id', dossier.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Non connecté');
      const path = `${dossier.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('dossier-documents').upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from('dossier_documents').insert({
        dossier_id: dossier.id,
        file_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        kind: 'other',
        uploaded_by: u.user.id,
      });
      if (insErr) throw insErr;
      toast.success('Document ajouté');
      qc.invalidateQueries({ queryKey: ['dossier-documents', dossier.id] });
    } catch (e: any) {
      toast.error(e?.message || 'Échec upload');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from('dossier-documents').createSignedUrl(path, 60);
    if (error || !data) { toast.error('Lien indisponible'); return; }
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = name;
    a.target = '_blank';
    a.click();
  };

  const handleDelete = async (id: string, path: string) => {
    if (!confirm('Supprimer ce document ?')) return;
    await supabase.storage.from('dossier-documents').remove([path]);
    const { error } = await supabase.from('dossier_documents').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Supprimé');
    qc.invalidateQueries({ queryKey: ['dossier-documents', dossier.id] });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Documents du dossier</h3>
        <label className="cursor-pointer">
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }}
          />
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card hover:bg-muted px-3 h-8 text-xs">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Uploader
          </span>
        </label>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : docs.length === 0 ? (
        <div className="text-xs text-muted-foreground rounded-lg border border-dashed border-border p-4 text-center">
          Aucun document.
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map((d: any) => (
            <li key={d.id} className="rounded-lg border border-border p-3 text-xs flex items-center gap-3">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">{d.file_name}</div>
                <div className="text-muted-foreground">
                  {d.kind} · {d.size_bytes ? `${Math.round(d.size_bytes / 1024)} ko` : ''} · {format(new Date(d.created_at), 'dd/MM/yyyy')}
                </div>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownload(d.file_path, d.file_name)} title="Télécharger">
                <Download className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(d.id, d.file_path)} title="Supprimer">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {customs.length > 0 && (
        <section className="space-y-2 pt-3 border-t border-border">
          <h3 className="text-sm font-semibold">Documents douane générés</h3>
          <ul className="space-y-2">
            {customs.map((d: any) => (
              <li key={d.id} className="rounded-lg border border-border p-3 text-xs flex items-center gap-3">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">{d.file_name}</div>
                  <div className="text-muted-foreground">{d.kind} · {d.reference}</div>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownload(d.file_path, d.file_name)}>
                  <Download className="w-3.5 h-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
