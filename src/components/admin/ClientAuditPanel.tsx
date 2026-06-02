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

interface ScenarioStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'ok' | 'fail';
  detail?: string;
  trackingId?: string | null;
  at?: string;
}

function DossierTestPanel() {
  const [tracking, setTracking] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [address, setAddress] = useState('');
  const [reason, setReason] = useState('Test simulation');
  const [busy, setBusy] = useState<ActionId | null>(null);
  const [scenarioRunning, setScenarioRunning] = useState(false);
  const [scenarioDecision, setScenarioDecision] = useState<'confirm' | 'refuse'>('confirm');
  const [steps, setSteps] = useState<ScenarioStep[]>([]);
  const [resolvedTracking, setResolvedTracking] = useState<string | null>(null);

  async function resolveDossier(): Promise<{ id: string; tracking_id: string | null; reference: string | null; status: string } | null> {
    const trk = tracking.trim();
    if (!trk) { toast.error('Saisis un numéro de suivi ou une référence.'); return null; }
    const { data, error } = await supabase
      .from('dossiers')
      .select('id, tracking_id, reference, status')
      .or(`tracking_id.eq.${trk},reference.eq.${trk}`)
      .limit(1)
      .maybeSingle();
    if (error || !data) { toast.error(`Dossier introuvable : ${trk}`); return null; }
    return data as any;
  }

  async function run(action: ActionId) {
    setBusy(action);
    try {
      const dos = await resolveDossier(); if (!dos) return;
      const trk = dos.tracking_id || dos.reference || tracking.trim();
      if (action === 'cancel') {
        const { error } = await supabase.rpc('client_cancel_dossier', { p_dossier_id: dos.id, p_reason: reason || 'Test' });
        if (error) throw error;
        toast.success(`Annulation simulée — ${trk}`, { id: `sim-cancel-${dos.id}` });
      } else if (action === 'pickup') {
        if (!pickupDate && !address) { toast.error('Indique une date ou une adresse.'); return; }
        const { error } = await supabase.rpc('client_update_pickup', {
          p_dossier_id: dos.id,
          p_pickup_date: pickupDate || null,
          p_sender_address: address || null,
        });
        if (error) throw error;
        toast.success(`MAJ collecte simulée — ${trk}`, { id: `sim-pickup-${dos.id}` });
      } else if (action === 'confirm' || action === 'refuse') {
        const { error } = await supabase.rpc('confirm_departure_public', {
          p_tracking: trk,
          p_confirmed: action === 'confirm',
          p_reason: action === 'refuse' ? reason : null,
        });
        if (error) throw error;
        toast.success(`${action === 'confirm' ? 'Confirmation' : 'Refus'} départ simulé — ${trk}`, { id: `sim-${action}-${dos.id}` });
      }
    } catch (e: any) {
      toast.error(`Erreur : ${e?.message ?? 'inconnue'}`);
    } finally {
      setBusy(null);
    }
  }

  // --- Scenario runner ------------------------------------------------------
  function setStep(id: string, patch: Partial<ScenarioStep>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function fetchDossier(id: string) {
    const { data } = await supabase
      .from('dossiers')
      .select('id, tracking_id, reference, status, collected_at_requested, sender_address, departure_confirmed_by_client, client_departure_decision')
      .eq('id', id).maybeSingle();
    return data as any;
  }

  async function countEvent(dossierId: string, type: string, after: string): Promise<number> {
    const { count } = await supabase
      .from('dossier_events')
      .select('id', { count: 'exact', head: true })
      .eq('dossier_id', dossierId)
      .eq('event_type', type)
      .gte('created_at', after);
    return count ?? 0;
  }

  async function runScenario() {
    setScenarioRunning(true);
    const initial: ScenarioStep[] = [
      { id: 'resolve',  label: 'Résolution du dossier',          status: 'pending' },
      { id: 'pickup',   label: '① MAJ collecte (date + adresse)', status: 'pending' },
      { id: 'decision', label: `② ${scenarioDecision === 'confirm' ? 'Confirmer' : 'Refuser'} le départ`, status: 'pending' },
      { id: 'cancel',   label: '③ Annulation client',             status: 'pending' },
    ];
    setSteps(initial);
    setResolvedTracking(null);

    setStep('resolve', { status: 'running' });
    const dos = await resolveDossier();
    if (!dos) { setStep('resolve', { status: 'fail', detail: 'Dossier introuvable' }); setScenarioRunning(false); return; }
    const trk = dos.tracking_id || dos.reference;
    setResolvedTracking(trk);
    setStep('resolve', { status: 'ok', trackingId: trk, detail: `Statut initial : ${dos.status}`, at: new Date().toISOString() });

    const startedAt = new Date(Date.now() - 1000).toISOString();

    // Step 1 : pickup update
    setStep('pickup', { status: 'running', trackingId: trk });
    try {
      const newDate = pickupDate || new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      const newAddr = address || `Test scenario · ${new Date().toLocaleTimeString('fr-FR')}`;
      const { error } = await supabase.rpc('client_update_pickup', {
        p_dossier_id: dos.id, p_pickup_date: newDate, p_sender_address: newAddr,
      });
      if (error) throw error;
      await new Promise((r) => setTimeout(r, 600));
      const updated = await fetchDossier(dos.id);
      const evCount = await countEvent(dos.id, 'client_pickup_updated', startedAt);
      const ok = !!updated && (
        updated.collected_at_requested?.startsWith(newDate) ||
        updated.sender_address === newAddr
      ) && evCount > 0;
      setStep('pickup', {
        status: ok ? 'ok' : 'fail',
        detail: ok ? `Date ${newDate} · évènement audit OK` : 'Aucune trace UI/audit détectée',
        at: new Date().toISOString(),
      });
      toast(ok ? `① Pickup OK — ${trk}` : `① Pickup KO — ${trk}`, { id: `scn-pickup-${dos.id}` });
    } catch (e: any) {
      setStep('pickup', { status: 'fail', detail: e?.message ?? 'erreur RPC' });
    }

    // Step 2 : confirm / refuse departure (public RPC, no auth required for the call)
    setStep('decision', { status: 'running', trackingId: trk });
    try {
      const { error } = await supabase.rpc('confirm_departure_public', {
        p_tracking: trk,
        p_confirmed: scenarioDecision === 'confirm',
        p_reason: scenarioDecision === 'refuse' ? (reason || 'Test refus') : null,
      });
      if (error) throw error;
      await new Promise((r) => setTimeout(r, 600));
      const updated = await fetchDossier(dos.id);
      const evCount = await countEvent(dos.id, 'client_departure_decision_public', startedAt);
      const expected = scenarioDecision === 'confirm' ? 'confirmed' : 'refused';
      const ok = updated?.client_departure_decision === expected && evCount > 0;
      setStep('decision', {
        status: ok ? 'ok' : 'fail',
        detail: ok
          ? `Décision = ${expected} · badge realtime mis à jour`
          : `Attendu ${expected}, reçu ${updated?.client_departure_decision ?? '—'}`,
        at: new Date().toISOString(),
      });
      toast(ok ? `② Décision OK — ${trk}` : `② Décision KO — ${trk}`, { id: `scn-dec-${dos.id}` });
    } catch (e: any) {
      setStep('decision', { status: 'fail', detail: e?.message ?? 'erreur RPC' });
    }

    // Step 3 : cancel
    setStep('cancel', { status: 'running', trackingId: trk });
    try {
      const { error } = await supabase.rpc('client_cancel_dossier', {
        p_dossier_id: dos.id, p_reason: reason || 'Test scenario',
      });
      // cancel can fail if status no longer allows it (e.g. shipped) — surface as fail with reason
      if (error) {
        setStep('cancel', { status: 'fail', detail: error.message });
      } else {
        await new Promise((r) => setTimeout(r, 600));
        const updated = await fetchDossier(dos.id);
        const evCount = await countEvent(dos.id, 'client_cancelled', startedAt);
        const ok = updated?.status === 'CANCELLED' && evCount > 0;
        setStep('cancel', {
          status: ok ? 'ok' : 'fail',
          detail: ok ? 'Statut = CANCELLED · notif admin envoyée' : `Statut courant : ${updated?.status}`,
          at: new Date().toISOString(),
        });
        toast(ok ? `③ Cancel OK — ${trk}` : `③ Cancel KO — ${trk}`, { id: `scn-cancel-${dos.id}` });
      }
    } catch (e: any) {
      setStep('cancel', { status: 'fail', detail: e?.message ?? 'erreur RPC' });
    }

    setScenarioRunning(false);
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
          <Button size="sm" variant="destructive" disabled={busy !== null || scenarioRunning} onClick={() => run('cancel')}>
            <XCircle className="w-3.5 h-3.5 mr-1" /> Annulation
          </Button>
          <Button size="sm" variant="outline" disabled={busy !== null || scenarioRunning} onClick={() => run('pickup')}>
            <CalendarClock className="w-3.5 h-3.5 mr-1" /> MAJ collecte
          </Button>
          <Button size="sm" className="bg-emerald-500/90 hover:bg-emerald-500" disabled={busy !== null || scenarioRunning} onClick={() => run('confirm')}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirmer départ
          </Button>
          <Button size="sm" variant="outline" disabled={busy !== null || scenarioRunning} onClick={() => run('refuse')}>
            <XCircle className="w-3.5 h-3.5 mr-1" /> Refuser départ
          </Button>
        </div>

        {/* Scenario runner */}
        <div className="pt-4 mt-2 border-t border-[#F5C518]/20 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-[#F5C518]" /> Run scenario (MAJ → décision → cancel)
              </p>
              <p className="text-[11px] text-muted-foreground">
                Enchaîne les 3 actions client et vérifie statuts, audit et toasts. Le tracking ID est affiché à chaque étape.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-[11px] text-muted-foreground">Décision :</Label>
              <Button size="sm" variant={scenarioDecision === 'confirm' ? 'default' : 'outline'}
                className={scenarioDecision === 'confirm' ? 'bg-emerald-500/90 hover:bg-emerald-500' : ''}
                onClick={() => setScenarioDecision('confirm')} disabled={scenarioRunning}>
                Confirmer
              </Button>
              <Button size="sm" variant={scenarioDecision === 'refuse' ? 'default' : 'outline'}
                onClick={() => setScenarioDecision('refuse')} disabled={scenarioRunning}>
                Refuser
              </Button>
              <Button size="sm" className="bg-[#F5C518] text-black hover:bg-[#F5C518]/90"
                disabled={scenarioRunning || busy !== null} onClick={runScenario}>
                {scenarioRunning ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5 mr-1" />}
                Run scenario
              </Button>
            </div>
          </div>

          {resolvedTracking && (
            <div className="flex items-center gap-2 text-xs">
              <Hash className="w-3.5 h-3.5 text-[#F5C518]" />
              <span className="text-muted-foreground">Tracking suivi :</span>
              <span className="font-mono font-semibold text-foreground">{resolvedTracking}</span>
            </div>
          )}

          {steps.length > 0 && (
            <div className="space-y-1.5">
              {steps.map((s) => {
                const icon =
                  s.status === 'ok' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
                  s.status === 'fail' ? <XCircle className="w-4 h-4 text-red-400" /> :
                  s.status === 'running' ? <Loader2 className="w-4 h-4 animate-spin text-[#F5C518]" /> :
                  <div className="w-4 h-4 rounded-full border border-muted-foreground/40" />;
                const tone =
                  s.status === 'ok' ? 'border-emerald-500/30 bg-emerald-500/5' :
                  s.status === 'fail' ? 'border-red-500/30 bg-red-500/5' :
                  s.status === 'running' ? 'border-[#F5C518]/30 bg-[#F5C518]/5' :
                  'border-border/40 bg-muted/10';
                return (
                  <div key={s.id} className={`rounded-md border p-2.5 text-xs flex items-start gap-2 ${tone}`}>
                    <div className="mt-0.5">{icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">{s.label}</span>
                        {s.trackingId && (
                          <span className="font-mono text-[10px] text-muted-foreground shrink-0">#{s.trackingId}</span>
                        )}
                      </div>
                      {s.detail && <p className="text-muted-foreground mt-0.5">{s.detail}</p>}
                      {s.at && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{fmtDate(s.at)}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
