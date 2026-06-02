import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { RefreshCw, FlaskConical, ShieldAlert, CalendarClock, CheckCircle2, XCircle, PlayCircle, Loader2, Hash } from 'lucide-react';

// --- Types ------------------------------------------------------------------

type ClientEventType =
  | 'client_confirmed'
  | 'client_cancelled'
  | 'client_pickup_updated'
  | 'client_departure_decision_public'
  | 'public_edit_applied';

interface RawEvent {
  id: string;
  dossier_id: string;
  event_type: string;
  event_data: Record<string, any> | null;
  created_at: string;
}

interface EnrichedEvent extends RawEvent {
  tracking_id: string | null;
  reference: string | null;
}

const CLIENT_EVENTS: ClientEventType[] = [
  'client_confirmed',
  'client_cancelled',
  'client_pickup_updated',
  'client_departure_decision_public',
  'public_edit_applied',
];

const EVENT_LABEL: Record<string, { label: string; color: string }> = {
  client_confirmed:                  { label: 'Confirmation client',   color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
  client_cancelled:                  { label: 'Annulation client',     color: 'bg-red-500/15 text-red-300 border-red-500/40' },
  client_pickup_updated:             { label: 'MAJ collecte client',   color: 'bg-blue-500/15 text-blue-300 border-blue-500/40' },
  client_departure_decision_public:  { label: 'Décision départ (public)', color: 'bg-[#F5C518]/15 text-[#F5C518] border-[#F5C518]/40' },
  public_edit_applied:               { label: 'Édition lien public',   color: 'bg-purple-500/15 text-purple-300 border-purple-500/40' },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

// --- Audit log --------------------------------------------------------------

function ClientAuditLog() {
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['client-audit-log'],
    queryFn: async (): Promise<EnrichedEvent[]> => {
      const { data: ev, error } = await supabase
        .from('dossier_events')
        .select('id, dossier_id, event_type, event_data, created_at')
        .in('event_type', CLIENT_EVENTS)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const ids = Array.from(new Set((ev ?? []).map((e: RawEvent) => e.dossier_id))).filter(Boolean);
      let dossierMap: Record<string, { tracking_id: string | null; reference: string | null }> = {};
      if (ids.length) {
        const { data: dos } = await supabase
          .from('dossiers')
          .select('id, tracking_id, reference')
          .in('id', ids);
        for (const d of dos ?? []) {
          dossierMap[d.id] = { tracking_id: d.tracking_id, reference: d.reference };
        }
      }
      return (ev ?? []).map((e: RawEvent) => ({
        ...e,
        tracking_id: dossierMap[e.dossier_id]?.tracking_id ?? null,
        reference: dossierMap[e.dossier_id]?.reference ?? null,
      }));
    },
    staleTime: 10_000,
  });

  // Realtime: invalidate on any new dossier_event matching a client_* type
  useEffect(() => {
    const channel = supabase
      .channel('client-audit-stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dossier_events' },
        (payload) => {
          const evType = (payload.new as any)?.event_type as string | undefined;
          if (evType && CLIENT_EVENTS.includes(evType as ClientEventType)) {
            qc.invalidateQueries({ queryKey: ['client-audit-log'] });
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#F5C518]" />
            Journal d'audit — Actions client
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Confirmations, refus, annulations, modifications collecte. Mis à jour en temps réel.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Actualiser
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : (data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Aucune action client enregistrée pour le moment.</p>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {data!.map((e) => {
              const meta = EVENT_LABEL[e.event_type] ?? { label: e.event_type, color: 'bg-muted text-muted-foreground' };
              const summary = summarize(e);
              return (
                <div key={e.id} className="rounded-md border border-border/50 bg-muted/20 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${meta.color}`}>{meta.label}</Badge>
                      <span className="font-mono text-xs text-foreground">{e.tracking_id || e.reference || '—'}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">{fmtDate(e.created_at)}</span>
                  </div>
                  {summary && <p className="text-xs text-muted-foreground">{summary}</p>}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function summarize(e: EnrichedEvent): string | null {
  const d = e.event_data ?? {};
  switch (e.event_type) {
    case 'client_cancelled':
      return d.reason ? `Raison : ${d.reason}` : 'Annulation sans raison spécifiée.';
    case 'client_pickup_updated': {
      const c = d.changes ?? {};
      const parts: string[] = [];
      if (c.pickup_date) parts.push(`Date : ${c.pickup_date.old ?? '—'} → ${c.pickup_date.new}`);
      if (c.sender_address) parts.push(`Adresse : ${(c.sender_address.new ?? '').slice(0, 80)}`);
      return parts.join(' · ') || null;
    }
    case 'client_departure_decision_public':
      return `Décision : ${d.decision ?? '—'}${d.reason ? ` · ${d.reason}` : ''}`;
    case 'client_confirmed':
      return d.via ? `Via : ${d.via}` : null;
    case 'public_edit_applied': {
      const ch = Array.isArray(d.changes) ? d.changes : [];
      return ch.length ? `${ch.length} champ(s) modifié(s)` : null;
    }
    default:
      return null;
  }
}

// --- Test mode panel --------------------------------------------------------

type ActionId = 'cancel' | 'pickup' | 'confirm' | 'refuse';

function DossierTestPanel() {
  const [tracking, setTracking] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [address, setAddress] = useState('');
  const [reason, setReason] = useState('Test simulation');
  const [busy, setBusy] = useState<ActionId | null>(null);

  async function resolveDossierId(): Promise<string | null> {
    const trk = tracking.trim();
    if (!trk) { toast.error('Saisis un numéro de suivi ou une référence.'); return null; }
    const { data, error } = await supabase
      .from('dossiers')
      .select('id, tracking_id, reference, status')
      .or(`tracking_id.eq.${trk},reference.eq.${trk}`)
      .limit(1)
      .maybeSingle();
    if (error || !data) { toast.error(`Dossier introuvable : ${trk}`); return null; }
    return data.id;
  }

  async function run(action: ActionId) {
    setBusy(action);
    try {
      if (action === 'cancel') {
        const id = await resolveDossierId(); if (!id) return;
        const { error } = await supabase.rpc('client_cancel_dossier', { p_dossier_id: id, p_reason: reason || 'Test' });
        if (error) throw error;
        toast.success('Simulation annulation envoyée.');
      } else if (action === 'pickup') {
        const id = await resolveDossierId(); if (!id) return;
        if (!pickupDate && !address) { toast.error('Indique une date ou une adresse.'); return; }
        const { error } = await supabase.rpc('client_update_pickup', {
          p_dossier_id: id,
          p_pickup_date: pickupDate || null,
          p_sender_address: address || null,
        });
        if (error) throw error;
        toast.success('Simulation MAJ collecte envoyée.');
      } else if (action === 'confirm' || action === 'refuse') {
        const trk = tracking.trim();
        if (!trk) { toast.error('Tracking requis.'); return; }
        const { error } = await supabase.rpc('confirm_departure_public', {
          p_tracking: trk,
          p_confirmed: action === 'confirm',
          p_reason: action === 'refuse' ? reason : null,
        });
        if (error) throw error;
        toast.success(action === 'confirm' ? 'Confirmation départ simulée.' : 'Refus départ simulé.');
      }
    } catch (e: any) {
      toast.error(`Erreur : ${e?.message ?? 'inconnue'}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-[#F5C518]/30 bg-[#F5C518]/[0.03]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-[#F5C518]" />
          Mode test — Simuler une action client
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Déclenche les RPCs côté client comme s'ils provenaient du dashboard public. Notifications admin envoyées.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="text-xs">Tracking ID ou référence</Label>
            <Input
              placeholder="YOB-XXXXXX"
              value={tracking}
              onChange={(e) => setTracking(e.target.value.toUpperCase())}
              className="font-mono"
            />
          </div>
          <div>
            <Label className="text-xs">Date de collecte (test MAJ)</Label>
            <Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Adresse (test MAJ)</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optionnel" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Raison (annulation / refus)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          <Button size="sm" variant="destructive" disabled={busy !== null} onClick={() => run('cancel')}>
            <XCircle className="w-3.5 h-3.5 mr-1" /> Annulation
          </Button>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run('pickup')}>
            <CalendarClock className="w-3.5 h-3.5 mr-1" /> MAJ collecte
          </Button>
          <Button size="sm" className="bg-emerald-500/90 hover:bg-emerald-500" disabled={busy !== null} onClick={() => run('confirm')}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirmer départ
          </Button>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run('refuse')}>
            <XCircle className="w-3.5 h-3.5 mr-1" /> Refuser départ
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Combined panel ---------------------------------------------------------

export function ClientAuditPanel() {
  const [tab, setTab] = useState<'log' | 'test'>('log');
  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'log' | 'test')}>
        <TabsList>
          <TabsTrigger value="log">Journal d'audit</TabsTrigger>
          <TabsTrigger value="test">Mode test</TabsTrigger>
        </TabsList>
        <TabsContent value="log" className="mt-4"><ClientAuditLog /></TabsContent>
        <TabsContent value="test" className="mt-4"><DossierTestPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

export default ClientAuditPanel;
