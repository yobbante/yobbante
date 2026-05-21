import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  ChevronDown, ChevronRight, Coins, FileDown, Loader2, TrendingUp, Users, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  PAYMENT_METHOD_LABELS, formatXof, marginPercent, suggestedGpAmount,
  type PaymentMethod,
} from '@/lib/gpFinance';

type DossierFin = {
  id: string;
  tracking_id: string | null;
  reference: string;
  status: string;
  origin_country: string | null;
  destination_country: string | null;
  destination_city: string | null;
  actual_weight_kg: number | null;
  estimated_weight: number | null;
  final_amount_xof: number | null;
  estimated_cost: number | null;
  gp_amount: number | null;
  gp_paid: boolean;
  gp_paid_at: string | null;
  gp_payment_method: string | null;
  delivered_at: string | null;
  created_at: string;
  assigned_transporteur_ref: string | null;
  gp_receipt_path: string | null;
};

type GpLite = {
  id: string;
  reference: string;
  nom: string;
  prenom: string | null;
  telephone_1: string;
  default_rate_per_kg: number | null;
  default_routes: Record<string, number> | null;
};

const YELLOW = '#F5C518';

export function FinancesTab() {
  const qc = useQueryClient();

  // ---- Data ----
  const { data: gps = [] } = useQuery({
    queryKey: ['finances-gps'],
    queryFn: async (): Promise<GpLite[]> => {
      const { data, error } = await supabase
        .from('transporteurs' as any)
        .select('id, reference, nom, prenom, telephone_1, default_rate_per_kg, default_routes');
      if (error) throw error;
      return (data ?? []) as unknown as GpLite[];
    },
  });

  const { data: pending = [], isLoading: loadingPending, refetch: refetchPending } = useQuery({
    queryKey: ['finances-pending'],
    queryFn: async (): Promise<DossierFin[]> => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('id, tracking_id, reference, status, origin_country, destination_country, destination_city, actual_weight_kg, estimated_weight, final_amount_xof, estimated_cost, gp_amount, gp_paid, gp_paid_at, gp_payment_method, delivered_at, created_at, assigned_transporteur_ref, gp_receipt_path')
        .eq('status', 'DELIVERED')
        .eq('gp_paid', false)
        .not('assigned_transporteur_ref', 'is', null)
        .order('delivered_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DossierFin[];
    },
  });

  const startOfMonth = useMemo(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const { data: monthly } = useQuery({
    queryKey: ['finances-monthly', startOfMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('final_amount_xof, gp_amount, delivered_at, gp_paid')
        .eq('status', 'DELIVERED')
        .gte('delivered_at', startOfMonth);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---- KPIs ----
  const kpis = useMemo(() => {
    const revenu = (monthly ?? []).reduce((s, d: any) => s + Number(d.final_amount_xof ?? 0), 0);
    const cout = (monthly ?? []).reduce((s, d: any) => s + Number(d.gp_amount ?? 0), 0);
    const marge = revenu - cout;
    const dueByGp = pending.reduce((s, d) => s + Number(d.gp_amount ?? 0), 0);
    return { revenu, cout, marge, dueByGp };
  }, [monthly, pending]);

  // ---- Group pending by GP ----
  const gpById = useMemo(() => {
    const m = new Map<string, GpLite>();
    gps.forEach(g => m.set(g.reference, g));
    return m;
  }, [gps]);

  const grouped = useMemo(() => {
    const map = new Map<string, { gp: GpLite | null; ref: string; rows: DossierFin[]; needRate: DossierFin[]; ready: DossierFin[]; total: number }>();
    for (const d of pending) {
      const ref = d.assigned_transporteur_ref ?? 'inconnu';
      const gp = gpById.get(ref) ?? null;
      let entry = map.get(ref);
      if (!entry) {
        entry = { gp, ref, rows: [], needRate: [], ready: [], total: 0 };
        map.set(ref, entry);
      }
      entry.rows.push(d);
      if (Number(d.gp_amount ?? 0) > 0) {
        entry.ready.push(d);
        entry.total += Number(d.gp_amount);
      } else {
        entry.needRate.push(d);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [pending, gpById]);

  // ---- Update GP amount on dossier ----
  const setAmount = useMutation({
    mutationFn: async ({ dossierId, amount }: { dossierId: string; amount: number }) => {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const { error } = await supabase
        .from('dossiers')
        .update({
          gp_amount: amount,
          gp_amount_set_by: userId,
          gp_amount_set_at: new Date().toISOString(),
        } as any)
        .eq('id', dossierId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finances-pending'] });
      qc.invalidateQueries({ queryKey: ['finances-monthly'] });
      toast.success('Tarif GP enregistré');
    },
    onError: (e: Error) => toast.error('Échec : ' + e.message),
  });

  // ---- Payment dialog ----
  const [paying, setPaying] = useState<{ gp: GpLite; dossiers: DossierFin[] } | null>(null);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Wallet className="w-5 h-5" style={{ color: YELLOW }} />
          Finances
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Suivi des marges, tarifs GP et paiements en attente · réservé admin
        </p>
      </header>

      {/* ============ KPI cards ============ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Revenus ce mois" value={formatXof(kpis.revenu)} icon={TrendingUp} />
        <KpiCard label="Coûts GP ce mois" value={formatXof(kpis.cout)} icon={Users} />
        <KpiCard
          label="Marge ce mois"
          value={formatXof(kpis.marge)}
          accent
          extra={`${marginPercent(kpis.revenu, kpis.cout)} %`}
        />
        <KpiCard label="Paiements GP en attente" value={formatXof(kpis.dueByGp)} icon={Coins} accent />
      </div>

      {/* ============ Pending payments grouped ============ */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Paiements GP en attente
          </h2>
          <Badge variant="outline" className="text-xs">
            {pending.length} dossier{pending.length > 1 ? 's' : ''}
          </Badge>
        </div>

        {loadingPending ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : grouped.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
            🎉 Aucun paiement GP en attente.
          </div>
        ) : (
          <div className="space-y-2">
            {grouped.map(group => (
              <GpPendingGroup
                key={group.ref}
                group={group}
                onSetAmount={(dossierId, amount) => setAmount.mutate({ dossierId, amount })}
                onPay={(dossiers) => group.gp && setPaying({ gp: group.gp, dossiers })}
              />
            ))}
          </div>
        )}
      </section>

      {/* ============ Monthly chart ============ */}
      <MonthlyChartSection />

      {paying && (
        <PayDialog
          open={!!paying}
          gp={paying.gp}
          dossiers={paying.dossiers}
          onClose={() => setPaying(null)}
          onPaid={() => {
            setPaying(null);
            refetchPending();
            qc.invalidateQueries({ queryKey: ['finances-monthly'] });
          }}
        />
      )}
    </div>
  );
}


// ============================================================================

function KpiCard({ label, value, icon: Icon, accent, extra }: {
  label: string; value: string; icon?: any; accent?: boolean; extra?: string;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${accent ? 'border-[#F5C518]/40 bg-[#F5C518]/5' : 'border-border bg-card'}`}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className={`text-lg font-bold mt-1.5 ${accent ? 'text-[#F5C518]' : 'text-foreground'}`}>
        {value}
      </div>
      {extra && <div className="text-[11px] text-muted-foreground mt-0.5">{extra}</div>}
    </div>
  );
}

function GpPendingGroup({
  group, onSetAmount, onPay,
}: {
  group: { gp: GpLite | null; ref: string; rows: DossierFin[]; needRate: DossierFin[]; ready: DossierFin[]; total: number };
  onSetAmount: (id: string, amount: number) => void;
  onPay: (dossiers: DossierFin[]) => void;
}) {
  const [open, setOpen] = useState(true);
  const gpName = group.gp ? `${group.gp.prenom ?? ''} ${group.gp.nom}`.trim() : `GP ${group.ref}`;
  const missionsLabel = group.rows.length === 1 ? '1 mission' : `${group.rows.length} missions`;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <div className="text-left min-w-0">
            <div className="font-semibold text-sm truncate">{gpName}</div>
            <div className="text-[11px] text-muted-foreground">
              Réf {group.ref} · {missionsLabel}
              {group.needRate.length > 0 && (
                <> · <span className="text-amber-500">{group.needRate.length} sans tarif</span></>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-bold text-[#F5C518]">{formatXof(group.total)}</div>
            <div className="text-[10px] text-muted-foreground">à payer</div>
          </div>
          <Button
            size="sm"
            disabled={!group.gp || group.ready.length === 0}
            onClick={(e) => { e.stopPropagation(); onPay(group.ready); }}
            style={{ background: YELLOW, color: '#000' }}
          >
            Payer {formatXof(group.total)}
          </Button>
        </div>
      </button>

      {open && (
        <div className="border-t border-border divide-y divide-border">
          {group.rows.map(d => (
            <PendingRow
              key={d.id}
              dossier={d}
              defaultRate={group.gp?.default_rate_per_kg ?? null}
              routes={group.gp?.default_routes ?? null}
              onSetAmount={onSetAmount}
              onPaySingle={() => group.gp && onPay([d])}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PendingRow({
  dossier, defaultRate, routes, onSetAmount, onPaySingle,
}: {
  dossier: DossierFin;
  defaultRate: number | null;
  routes: Record<string, number> | null;
  onSetAmount: (id: string, amount: number) => void;
  onPaySingle: () => void;
}) {
  const weight = dossier.actual_weight_kg ?? dossier.estimated_weight ?? 0;
  const suggested = suggestedGpAmount({
    weightKg: weight,
    defaultRatePerKg: defaultRate,
    routes,
    origin: dossier.origin_country,
    destination: dossier.destination_city ?? dossier.destination_country,
  });
  const clientPrice = Number(dossier.final_amount_xof ?? dossier.estimated_cost ?? 0);

  const [value, setValue] = useState<string>(
    dossier.gp_amount && Number(dossier.gp_amount) > 0 ? String(dossier.gp_amount) : (suggested ? String(suggested) : ''),
  );
  const [editing, setEditing] = useState(false);

  const current = Number(dossier.gp_amount ?? 0);
  const margin = clientPrice - current;
  const route = `${dossier.origin_country ?? '—'} → ${dossier.destination_city ?? dossier.destination_country ?? '—'}`;

  return (
    <div className="px-4 py-3 grid md:grid-cols-[1fr_auto] gap-3 items-start text-sm">
      <div className="min-w-0">
        <div className="font-mono text-xs text-muted-foreground">
          {dossier.tracking_id || dossier.reference}
        </div>
        <div className="text-foreground">{route} · {weight || '—'} kg</div>
        {dossier.delivered_at && (
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Livré le {new Date(dossier.delivered_at).toLocaleDateString('fr-FR')}
          </div>
        )}

        {/* Admin financial recap (never visible to client/GP) */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          <span><span className="text-muted-foreground">Prix client :</span> <span className="font-medium">{formatXof(clientPrice)}</span></span>
          <span><span className="text-muted-foreground">Coût GP :</span> <span className="font-medium">{formatXof(current)}</span></span>
          {current > 0 && (
            <span>
              <span className="text-muted-foreground">Marge :</span>{' '}
              <span className={`font-medium ${margin >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                {formatXof(margin)} ({marginPercent(clientPrice, current)}%)
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {current > 0 && !editing ? (
          <>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Modifier</Button>
            <Button
              size="sm"
              onClick={onPaySingle}
              style={{ background: YELLOW, color: '#000' }}
            >
              Marquer payé
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={suggested ? String(suggested) : 'XOF'}
                className="h-8 w-28 text-sm"
              />
              <span className="text-[11px] text-muted-foreground">XOF</span>
            </div>
            <Button
              size="sm"
              disabled={!value || Number(value) <= 0}
              onClick={() => {
                const n = Math.round(Number(value));
                if (n > 0) {
                  onSetAmount(dossier.id, n);
                  setEditing(false);
                }
              }}
            >
              Valider
            </Button>
            {editing && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Annuler</Button>
            )}
          </>
        )}
      </div>

      {suggested != null && current === 0 && (
        <div className="md:col-span-2 text-[11px] text-muted-foreground -mt-1">
          Tarif suggéré : {formatXof(suggested)}
          {defaultRate ? <> (basé sur {defaultRate} XOF/kg)</> : null}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Payment confirmation dialog
// ============================================================================
function PayDialog({
  open, gp, dossiers, onClose, onPaid,
}: {
  open: boolean; gp: GpLite; dossiers: DossierFin[]; onClose: () => void; onPaid: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>('wave');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);

  const total = dossiers.reduce((s, d) => s + Number(d.gp_amount ?? 0), 0);

  async function confirm() {
    if (!reference.trim()) {
      toast.error('Référence de transaction requise');
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('gp-payment-confirm', {
        body: {
          transporteur_id: gp.id,
          dossier_ids: dossiers.map(d => d.id),
          method,
          reference: reference.trim(),
          note: note.trim() || null,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Échec');
      toast.success(`Paiement confirmé · ${dossiers.length} mission${dossiers.length > 1 ? 's' : ''}`);
      setReceipt(data.receipt_path ?? null);
      // Brief delay so admin sees the success state, then refresh
      setTimeout(() => onPaid(), 400);
    } catch (e) {
      toast.error('Échec : ' + (e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function downloadReceipt() {
    if (!receipt) return;
    const { data, error } = await supabase.storage.from('gp-receipts').createSignedUrl(receipt, 60 * 5);
    if (error || !data?.signedUrl) {
      toast.error('Impossible de télécharger le reçu');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !sending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmer paiement GP</DialogTitle>
          <DialogDescription>
            {gp.prenom ?? ''} {gp.nom} · {dossiers.length} mission{dossiers.length > 1 ? 's' : ''} · {formatXof(total)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Méthode</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {(['wave', 'orange_money', 'cash'] as PaymentMethod[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`text-xs font-medium rounded-md border px-2 py-2 transition-colors ${
                    method === m ? 'border-[#F5C518] bg-[#F5C518]/10 text-[#F5C518]' : 'border-border text-foreground hover:bg-secondary'
                  }`}
                >
                  {PAYMENT_METHOD_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Référence de transaction *</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="ID transaction Wave / OM / Cash-001"
              autoFocus
            />
          </div>
          <div>
            <Label>Note (optionnel)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>

          {receipt && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs flex items-center justify-between gap-2">
              <span className="text-emerald-500">✓ Paiement enregistré. Reçu PDF prêt.</span>
              <Button size="sm" variant="outline" onClick={downloadReceipt}>
                <FileDown className="w-3.5 h-3.5 mr-1" /> Télécharger
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>Fermer</Button>
          <Button
            onClick={confirm}
            disabled={sending || !reference.trim() || !!receipt}
            style={{ background: YELLOW, color: '#000' }}
          >
            {sending && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
            Confirmer paiement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
