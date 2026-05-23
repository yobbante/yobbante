import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDossierSheet } from './useDossierSheet';
import { useDossierMessages } from '@/hooks/useDossierMessages';
import { useUserRole } from '@/hooks/useUserRole';
import { getStatutsPourDossier } from '@/lib/dossierStatuts';
import { COUNTRY_FLAGS, COUNTRY_NAMES, type DossierStatus } from '@/lib/types';
import { TransporteurReferenceLookup } from '@/components/admin/TransporteurReferenceLookup';
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
  const open = !!dossierId;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[960px] p-0 flex flex-col"
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

  if (isLoading || !dossier) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <>
      <DossierHeader dossier={dossier} onChanged={() => refetch()} />

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-6 border-b border-border overflow-x-auto">
          <TabsList className="h-10">
            <TabsTrigger value="apercu" className="text-xs">Aperçu</TabsTrigger>
            <TabsTrigger value="transport" className="text-xs">
              <Truck className="w-3.5 h-3.5 mr-1" /> Transport
            </TabsTrigger>
            <TabsTrigger value="paiement" className="text-xs">
              <CreditCard className="w-3.5 h-3.5 mr-1" /> Paiement
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
          <TabsContent value="apercu"     className="mt-0"><ApercuTab dossier={dossier} /></TabsContent>
          <TabsContent value="transport"  className="mt-0"><TransportTab dossier={dossier} /></TabsContent>
          <TabsContent value="paiement"   className="mt-0"><PaiementTab dossier={dossier} /></TabsContent>
          <TabsContent value="messages"   className="mt-0"><MessagesTab dossier={dossier} isStaff={isStaff} /></TabsContent>
          <TabsContent value="historique" className="mt-0"><HistoriqueTab id={dossier.id} /></TabsContent>
        </div>
      </Tabs>

      <DossierFooter dossier={dossier} />
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

  return (
    <SheetHeader className="px-6 pt-6 pb-4 border-b border-border space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <SheetTitle className="text-lg flex items-center gap-2 flex-wrap">
            <span className="truncate">{dossier.reference}</span>
            {dossier.tracking_id && (
              <button
                onClick={() => copy(dossier.tracking_id)}
                className="text-xs font-mono px-2 py-0.5 rounded bg-muted hover:bg-muted/80 inline-flex items-center gap-1"
                title="Copier le tracking"
              >
                {dossier.tracking_id}
                <Copy className="w-3 h-3" />
              </button>
            )}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2 text-xs">
            <span>{COUNTRY_FLAGS[origin as keyof typeof COUNTRY_FLAGS] ?? '🌍'} {COUNTRY_NAMES[origin as keyof typeof COUNTRY_NAMES] ?? origin}</span>
            <span>→</span>
            <span>{COUNTRY_FLAGS[dest as keyof typeof COUNTRY_FLAGS] ?? '🌍'} {COUNTRY_NAMES[dest as keyof typeof COUNTRY_NAMES] ?? dest}</span>
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

        {dossier.contact_phone && (
          <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
            <a href={`https://wa.me/${dossier.contact_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Bonjour, à propos de votre dossier ${dossier.reference}`)}`} target="_blank" rel="noreferrer">
              <MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp client
            </a>
          </Button>
        )}

        {dossier.tracking_id && (
          <Button size="sm" variant="ghost" className="h-8 text-xs" asChild>
            <a href={`/track?ref=${dossier.tracking_id}`} target="_blank" rel="noreferrer">
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Page publique
            </a>
          </Button>
        )}
      </div>
    </SheetHeader>
  );
}

/* ---------------- Aperçu (editable) ---------------- */

function ApercuTab({ dossier }: { dossier: DossierRow }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    sender_name: dossier.sender_name ?? '',
    sender_phone: dossier.sender_phone ?? '',
    sender_address: dossier.sender_address ?? '',
    pickup_date: dossier.pickup_date ?? '',
    recipient_name: dossier.recipient_name ?? '',
    recipient_phone: dossier.recipient_phone ?? '',
    recipient_address: dossier.recipient_address ?? '',
    product_description: dossier.product_description ?? '',
    estimated_weight: dossier.estimated_weight ?? '',
    declared_value: dossier.declared_value ?? '',
    admin_notes: dossier.admin_notes ?? '',
  });

  useEffect(() => {
    setForm({
      sender_name: dossier.sender_name ?? '',
      sender_phone: dossier.sender_phone ?? '',
      sender_address: dossier.sender_address ?? '',
      pickup_date: dossier.pickup_date ?? '',
      recipient_name: dossier.recipient_name ?? '',
      recipient_phone: dossier.recipient_phone ?? '',
      recipient_address: dossier.recipient_address ?? '',
      product_description: dossier.product_description ?? '',
      estimated_weight: dossier.estimated_weight ?? '',
      declared_value: dossier.declared_value ?? '',
      admin_notes: dossier.admin_notes ?? '',
    });
  }, [dossier.id]);

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
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Expéditeur</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field('sender_name', 'Nom')}
          {field('sender_phone', 'Téléphone', 'tel')}
          {field('pickup_date', 'Date d\'enlèvement', 'date')}
        </div>
        {field('sender_address', 'Adresse', 'textarea')}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Destinataire</h3>
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

      <div className="flex justify-end gap-2 sticky bottom-0 bg-background py-3 border-t border-border -mx-6 px-6">
        <Button onClick={() => save.mutate()} disabled={save.isPending} size="sm">
          {save.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
          Enregistrer
        </Button>
      </div>
    </div>
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
      const { error } = await supabase
        .from('dossiers')
        .update({ assigned_transporteur_ref: newRef })
        .eq('id', dossier.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(ref ? 'Transporteur assigné' : 'Transporteur détaché');
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
          <TransporteurReferenceLookup value={ref} onChange={setRef} onMatch={setMatched} />
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

      <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground space-y-1">
        <div className="flex items-center gap-2">
          <PackageIcon className="w-3.5 h-3.5" />
          <span className="font-medium">Départ & colis</span>
        </div>
        <p>Liaison à un départ et gestion des colis rattachés arrivent dans la prochaine itération.</p>
      </div>
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
            rows={2}
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

/* ---------------- Historique ---------------- */

function HistoriqueTab({ id }: { id: string }) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['dossier-events', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossier_events')
        .select('*')
        .eq('dossier_id', id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (events.length === 0) {
    return <div className="text-xs text-muted-foreground text-center py-8">Aucun évènement enregistré.</div>;
  }

  return (
    <ul className="space-y-2">
      {events.map((e: any) => (
        <li key={e.id} className="rounded-lg border border-border p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono font-medium text-foreground">{e.event_type}</span>
            <span className="text-muted-foreground">{format(new Date(e.created_at), 'dd/MM/yyyy HH:mm')}</span>
          </div>
          {e.event_data && (
            <pre className="mt-1 text-[10px] text-muted-foreground bg-muted rounded p-2 overflow-x-auto">
              {JSON.stringify(e.event_data, null, 2)}
            </pre>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Footer ---------------- */

function DossierFooter({ dossier }: { dossier: DossierRow }) {
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
    <div className="border-t border-border px-6 py-3 flex items-center justify-between text-xs text-muted-foreground">
      <span>MAJ : {format(new Date(dossier.updated_at), 'dd/MM/yyyy HH:mm')}</span>
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
  );
}
