import { useEffect, useMemo, useState } from 'react';
import { useDossierSheet } from './dossier-sheet/useDossierSheet';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Search, ChevronRight, Inbox, ExternalLink, Mail, Phone,
  Weight, Wallet, Calendar, MapPin, Building2, LayoutGrid, List as ListIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  COUNTRY_FLAGS, DOSSIER_STATUS_LABELS, DOSSIER_STATUS_ORDER,
  type Dossier, type DossierStatus,
} from '@/lib/types';
import { getStatutsPourDossier } from '@/lib/dossierStatuts';
import { getDossierBadges } from '@/lib/dossierBadges';
import { GpAssignBadge } from './dossiers/GpAssignBadge';
import { AssignDepartureDialog } from './dossiers/AssignDepartureDialog';
import { DossierLifecycleRail } from './dossiers/DossierLifecycleRail';
import { NextActionsSheet } from './dossiers/NextActionsSheet';
import { parseClientNotes, hasParsedEssentials } from '@/lib/parseClientNotes';
import { toast } from 'sonner';


const TYPE_FILTERS = [
  { id: 'all',      label: 'Tous' },
  { id: 'send',     label: 'Expédier' },
  { id: 'receive',  label: 'Recevoir' },
  { id: 'sourcing', label: 'Sourcing' },
] as const;

type TypeFilter = typeof TYPE_FILTERS[number]['id'];
type ViewMode = 'list' | 'kanban';

function getKind(d: Dossier): TypeFilter {
  if (d.app_source === 'expedier') return 'send';
  if (d.app_source === 'recevoir') return 'receive';
  if (d.app_source === 'sourcing' || d.needs_sourcing) return 'sourcing';
  return 'receive';
}

const KIND_BADGE: Record<TypeFilter, string> = {
  all: '',
  send: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  receive: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  sourcing: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
};

const STATUS_TONE: Partial<Record<DossierStatus, string>> = {
  SUBMITTED: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  IN_REVIEW: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  SOURCING: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  PROCURED: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  IN_TRANSIT: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  CUSTOMS: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  DELIVERED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  CLOSED: 'bg-secondary text-muted-foreground border-border',
};

const PAGE_SIZE = 50;

// Kanban swimlanes (collapsed view of the dossier lifecycle)
const KANBAN_COLUMNS: { id: DossierStatus; label: string }[] = [
  { id: 'SUBMITTED',  label: DOSSIER_STATUS_LABELS.SUBMITTED },
  { id: 'IN_REVIEW',  label: DOSSIER_STATUS_LABELS.IN_REVIEW },
  { id: 'SOURCING',   label: DOSSIER_STATUS_LABELS.SOURCING },
  { id: 'IN_TRANSIT', label: DOSSIER_STATUS_LABELS.IN_TRANSIT },
  { id: 'DELIVERED',  label: DOSSIER_STATUS_LABELS.DELIVERED },
];

export interface RequestsTabProps {
  /** Preset the "kind" filter (Expédier / Recevoir / Sourcing / Tous). */
  initialKind?: TypeFilter;
  /** Lock the kind filter so the user cannot switch — hides the pills too. */
  lockKind?: boolean;
  /** Hide the top header (title + subtitle) when the parent already renders one. */
  hideHeader?: boolean;
  /** Hide these statuses entirely (e.g. CANCELLED / ARCHIVED in "Demandes entrantes"). */
  excludeStatuses?: string[];
  /** Optional override for the page title. */
  title?: string;
  /** Optional override for the subtitle. */
  subtitle?: string;
}

export function RequestsTab({
  initialKind = 'all',
  lockKind = false,
  hideHeader = false,
  excludeStatuses,
  title,
  subtitle,
}: RequestsTabProps = {}) {
  const sheet = useDossierSheet();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<TypeFilter>(initialKind);
  const [statusFilter, setStatusFilter] = useState<Set<DossierStatus>>(new Set());
  const [view, setView] = useState<ViewMode>('list');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const excludedSet = useMemo(() => new Set(excludeStatuses ?? []), [excludeStatuses]);

  const [flashId, setFlashId] = useState<string | null>(null);

  // Highlight + scroll helper — used both by the deep-link and lifecycle events.
  const focusRow = (id: string) => {
    setExpandedId(id);
    setFlashId(id);
    setTimeout(() => {
      const el = document.querySelector(`[data-dossier-id="${id}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
    // Clear the flash class after the animation duration so it can retrigger.
    setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 2600);
  };

  // Open + scroll to a row from dashboard "Activité récente" deep-link
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { service?: string; id?: string };
      if (detail?.service !== 'expedier' || !detail.id) return;
      setView('list');
      focusRow(detail.id);
    };
    window.addEventListener('admin:focus', handler);
    return () => window.removeEventListener('admin:focus', handler);
  }, []);

  // Auto-scroll + flash a row after a lifecycle action so the admin sees
  // exactly where it moved in the list.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { dossierId?: string };
      if (!detail?.dossierId) return;
      setView('list');
      focusRow(detail.dossierId);
    };
    window.addEventListener('dossier:lifecycle-action', handler);
    return () => window.removeEventListener('dossier:lifecycle-action', handler);
  }, []);

  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['admin-requests', limit],
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('id, reference, product_description, status, origin_country, destination_country, origin_city, destination_city, needs_sourcing, app_source, business_id, contact_email, contact_phone, estimated_weight, budget_eur, declared_value, estimated_delivery_date, sender_name, sender_phone, recipient_name, recipient_phone, recipient_address, pickup_date, supplier_name, supplier_country, quantity, unit, notes, created_at, assigned_transporteur_ref, assigned_departure_id, tracking_id, final_amount_xof, estimated_cost, payment_status')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const [quickAssign, setQuickAssign] = useState<{ id: string; destCountry?: string | null; destCity?: string | null; weight?: number | null } | null>(null);

  // Programmatic quick-assign trigger (fired from NextActionsSheet).
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id?: string; destCountry?: string | null; destCity?: string | null };
      if (!detail?.id) return;
      setQuickAssign({
        id: detail.id,
        destCountry: detail.destCountry ?? null,
        destCity: detail.destCity ?? null,
        weight: null,
      });
    };
    window.addEventListener('admin:quick-assign', handler);
    return () => window.removeEventListener('admin:quick-assign', handler);
  }, []);




  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DossierStatus }) => {
      const { error } = await supabase.from('dossiers').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Statut mis à jour');
      qc.invalidateQueries({ queryKey: ['admin-requests'] });
      qc.invalidateQueries({ queryKey: ['admin-overview'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Échec mise à jour'),
  });

  const counts = useMemo(() => {
    const scope = dossiers.filter(d => !excludedSet.has(d.status));
    const c: Record<TypeFilter, number> = { all: scope.length, send: 0, receive: 0, sourcing: 0 };
    scope.forEach(d => { c[getKind(d)]++; });
    return c;
  }, [dossiers, excludedSet]);

  const filtered = useMemo(() => {
    return dossiers.filter(d => {
      if (excludedSet.has(d.status)) return false;
      if (kind !== 'all' && getKind(d) !== kind) return false;
      if (statusFilter.size > 0 && !statusFilter.has(d.status)) return false;
      if (q) {
        const s = q.toLowerCase();
        return (
          (d.tracking_id || '').toLowerCase().includes(s) ||
          d.reference.toLowerCase().includes(s) ||
          d.product_description.toLowerCase().includes(s) ||
          (d.contact_email || '').toLowerCase().includes(s) ||
          (d.contact_phone || '').toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [dossiers, q, kind, statusFilter, excludedSet]);

  const statusCounts = useMemo(() => {
    const c = new Map<DossierStatus, number>();
    const scope = dossiers.filter(d => kind === 'all' || getKind(d) === kind);
    scope.forEach(d => c.set(d.status, (c.get(d.status) ?? 0) + 1));
    return c;
  }, [dossiers, kind]);

  function toggleStatus(s: DossierStatus) {
    setStatusFilter(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        {!hideHeader ? (
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{title ?? 'Demandes clients'}</h1>
            <p className="text-sm text-muted-foreground">
              {subtitle ?? 'Inbox unifié — clic pour développer, double-clic pour ouvrir la fiche complète.'}
            </p>
          </div>
        ) : <div />}
        <div className="inline-flex rounded-md border border-border bg-card p-0.5">
          <button
            onClick={() => setView('list')}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium inline-flex items-center gap-1.5 transition-colors',
              view === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <ListIcon className="w-3.5 h-3.5" /> Liste
          </button>
          <button
            onClick={() => setView('kanban')}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium inline-flex items-center gap-1.5 transition-colors',
              view === 'kanban' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Kanban
          </button>
        </div>
      </div>


      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Réf, produit, email…"
            className="pl-9 h-9"
          />
        </div>
        {!lockKind && (
          <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
            {TYPE_FILTERS.map(f => {
              const active = kind === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setKind(f.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors inline-flex items-center gap-1.5',
                    active
                      ? 'bg-foreground text-background'
                      : 'bg-secondary text-muted-foreground hover:text-foreground',
                  )}
                >
                  {f.label}
                  <span className={cn(
                    'tabular-nums text-[10px] px-1 rounded',
                    active ? 'bg-background/20' : 'bg-background/40',
                  )}>
                    {counts[f.id]}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>


      {/* Status pill filters (multi-select) */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Statut :</span>
        {DOSSIER_STATUS_ORDER.map(s => {
          const active = statusFilter.has(s);
          const count = statusCounts.get(s) ?? 0;
          return (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={cn(
                'px-2 py-0.5 rounded-full text-[11px] border inline-flex items-center gap-1.5 transition-colors',
                active
                  ? 'bg-[#F5C518]/15 border-[#F5C518]/40 text-foreground'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {DOSSIER_STATUS_LABELS[s]}
              <span className="tabular-nums text-[10px] opacity-70">{count}</span>
            </button>
          );
        })}
        {statusFilter.size > 0 && (
          <button
            onClick={() => setStatusFilter(new Set())}
            className="text-[11px] text-muted-foreground hover:text-foreground underline ml-1"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Inbox className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">Aucune demande</p>
          <p className="text-xs text-muted-foreground mt-1">Ajustez vos filtres.</p>
        </div>
      ) : view === 'kanban' ? (
        <KanbanView
          dossiers={filtered}
          onMove={(id, status) => updateStatus.mutate({ id, status })}
          onOpen={(id) => sheet.open(id)}
        />
      ) : (
        <ul className="divide-y divide-border border border-border rounded-xl bg-card overflow-hidden">
          {filtered.map(d => {

            const k = getKind(d);
            const isOpen = expandedId === d.id;
            const badges = getDossierBadges({
              status: d.status,
              created_at: d.created_at,
              assigned_transporteur_ref: (d as any).assigned_transporteur_ref,
              assigned_departure_id: (d as any).assigned_departure_id,
              departure_date: (d as any).estimated_delivery_date,
            });
            return (
              <li key={d.id} data-dossier-id={d.id} className={cn(flashId === d.id && 'animate-row-flash')}>
                {/* Header — click to toggle */}
                <button
                  onClick={() => setExpandedId(isOpen ? null : d.id)}
                  onDoubleClick={() => sheet.open(d.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 flex items-center gap-3 transition-colors',
                    isOpen ? 'bg-secondary/40' : 'hover:bg-secondary/30',
                  )}
                  aria-expanded={isOpen}
                >
                  <span className="text-lg">{COUNTRY_FLAGS[d.origin_country] || '🌍'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-[11px] flex-wrap">
                      <span className="font-mono text-foreground font-semibold text-[12px]">{d.tracking_id || d.reference}</span>
                      {d.tracking_id && (
                        <span className="font-mono text-[10px] text-muted-foreground/70" title="Référence interne">Réf. {d.reference}</span>
                      )}
                      {badges.map(b => (
                        <span
                          key={b.kind}
                          title={b.reason}
                          className={cn(
                            'px-1.5 py-0.5 rounded uppercase tracking-wide text-[10px] font-bold',
                            b.className,
                          )}
                        >
                          {b.label}
                        </span>
                      ))}
                      <span className={cn(
                        'px-1.5 py-0.5 rounded border uppercase tracking-wide text-[10px]',
                        KIND_BADGE[k],
                      )}>
                        {k === 'send' ? 'Expédier' : k === 'sourcing' ? 'Sourcing' : 'Recevoir'}
                      </span>
                      <span className={cn(
                        'px-1.5 py-0.5 rounded border text-[10px]',
                        STATUS_TONE[d.status] || 'bg-secondary text-muted-foreground border-border',
                      )}>
                        {DOSSIER_STATUS_LABELS[d.status]}
                      </span>
                      {d.business_id && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px]">
                          <Building2 className="w-2.5 h-2.5" /> Business
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground truncate mt-0.5">{d.product_description}</p>
                    <div className="mt-1.5 hidden sm:block">
                      <DossierLifecycleRail status={d.status} size="sm" />
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center" onClick={(e) => e.stopPropagation()}>
                    <GpAssignBadge
                      transporteurRef={(d as any).assigned_transporteur_ref}
                      onAssignClick={() =>
                        setQuickAssign({
                          id: d.id,
                          destCountry: d.destination_country,
                          destCity: (d as any).destination_city ?? null,
                          weight: (d as any).actual_weight_kg ?? d.estimated_weight ?? null,
                        })
                      }
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums hidden md:inline">
                    {new Date(d.created_at).toLocaleDateString('fr-FR')}
                  </span>
                  <ChevronRight
                    className={cn(
                      'w-4 h-4 text-muted-foreground transition-transform',
                      isOpen && 'rotate-90',
                    )}
                  />
                </button>


                {/* Expandable details */}
                {isOpen && (
                  <div className="px-4 pb-4 pt-2 bg-secondary/20 border-t border-border space-y-3">
                    <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                        Cycle de vie du dossier
                      </div>
                      <DossierLifecycleRail status={d.status} />
                    </div>
                    <ExpandedKindBody dossier={d} kind={k} />


                    {(d.contact_email || d.contact_phone) && (
                      <div className="flex flex-wrap gap-3 text-xs">
                        {d.contact_email && (
                          <a href={`mailto:${d.contact_email}`} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                            <Mail className="w-3.5 h-3.5" /> {d.contact_email}
                          </a>
                        )}
                        {d.contact_phone && (
                          <a href={`tel:${d.contact_phone}`} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                            <Phone className="w-3.5 h-3.5" /> {d.contact_phone}
                          </a>
                        )}
                      </div>
                    )}


                    {/* Actions: status + open */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Statut
                        </span>
                        <Select
                          value={d.status}
                          onValueChange={(v) => updateStatus.mutate({ id: d.id, status: v as DossierStatus })}
                        >
                          <SelectTrigger className="h-8 w-56 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {getStatutsPourDossier({
                              app_source: d.app_source,
                              needs_sourcing: d.needs_sourcing,
                            }).map(s => (
                              <SelectItem key={s.value} value={s.value} className="text-xs">
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => sheet.open(d.id)}
                        className="text-xs h-8"
                      >
                        Ouvrir la fiche
                        <ChevronRight className="w-3 h-3 ml-1.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!isLoading && dossiers.length >= limit && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLimit(l => l + PAGE_SIZE)}
            className="text-xs h-8"
          >
            Charger {PAGE_SIZE} de plus ({dossiers.length} affichés)
          </Button>
        </div>
      )}

      {quickAssign && (
        <AssignDepartureDialog
          open={!!quickAssign}
          onOpenChange={(v) => { if (!v) setQuickAssign(null); }}
          dossierId={quickAssign.id}
          destinationCountry={quickAssign.destCountry}
          destinationCity={quickAssign.destCity}
          weightKg={quickAssign.weight}
        />
      )}

      {/* Contextual "next actions" panel — auto-opens after a lifecycle transition. */}
      <NextActionsSheet />
    </div>
  );
}



/* ──────────────────────── Kanban view ──────────────────────── */
function KanbanView({
  dossiers, onMove, onOpen,
}: {
  dossiers: Dossier[];
  onMove: (id: string, status: DossierStatus) => void;
  onOpen: (id: string) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<DossierStatus, Dossier[]>();
    KANBAN_COLUMNS.forEach(c => map.set(c.id, []));
    for (const d of dossiers) {
      // Bucket CUSTOMS into IN_TRANSIT, PROCURED into SOURCING, CLOSED into DELIVERED
      const bucket: DossierStatus =
        d.status === 'CUSTOMS' ? 'IN_TRANSIT'
        : d.status === 'PROCURED' ? 'SOURCING'
        : d.status === 'CLOSED' ? 'DELIVERED'
        : d.status;
      if (!map.has(bucket)) map.set(bucket, []);
      map.get(bucket)!.push(d);
    }
    return map;
  }, [dossiers]);

  const [dragging, setDragging] = useState<string | null>(null);
  const [hover, setHover] = useState<DossierStatus | null>(null);

  return (
    <div className="grid grid-flow-col auto-cols-[minmax(240px,1fr)] gap-3 overflow-x-auto pb-2">
      {KANBAN_COLUMNS.map(col => {
        const items = grouped.get(col.id) ?? [];
        const isHover = hover === col.id;
        return (
          <div
            key={col.id}
            onDragOver={(e) => { e.preventDefault(); setHover(col.id); }}
            onDragLeave={() => setHover(prev => (prev === col.id ? null : prev))}
            onDrop={(e) => {
              e.preventDefault();
              setHover(null);
              if (dragging) {
                const d = dossiers.find(x => x.id === dragging);
                if (d && d.status !== col.id) onMove(dragging, col.id);
              }
              setDragging(null);
            }}
            className={cn(
              'rounded-xl border bg-card flex flex-col min-h-[160px]',
              isHover ? 'border-[#F5C518]/60 bg-[#F5C518]/5' : 'border-border',
            )}
          >
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <div className="text-xs font-semibold text-foreground">{col.label}</div>
              <span className="text-[10px] text-muted-foreground tabular-nums">{items.length}</span>
            </div>
            <div className="p-2 space-y-1.5 flex-1">
              {items.length === 0 && (
                <div className="text-[11px] text-muted-foreground text-center py-6 italic">
                  Vide
                </div>
              )}
              {items.map(d => (
                <div
                  key={d.id}
                  draggable
                  onDragStart={() => setDragging(d.id)}
                  onDragEnd={() => { setDragging(null); setHover(null); }}
                  onDoubleClick={() => onOpen(d.id)}
                  className={cn(
                    'rounded-md border border-border bg-background px-2.5 py-2 cursor-grab active:cursor-grabbing text-xs space-y-1 hover:border-[#F5C518]/40 transition-colors',
                    dragging === d.id && 'opacity-50',
                  )}
                  title="Glisser pour changer de statut · double-clic pour ouvrir"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="font-mono text-[11px] text-foreground font-semibold truncate">{d.tracking_id || d.reference}</span>
                      {d.tracking_id && (
                        <span className="font-mono text-[9px] text-muted-foreground/70 truncate">Réf. {d.reference}</span>
                      )}
                    </div>
                    <span className="text-sm">{COUNTRY_FLAGS[d.origin_country] || '🌍'}</span>
                  </div>
                  <div className="text-foreground line-clamp-2 leading-snug">{d.product_description}</div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{(d as any).origin_city || d.origin_country} → {(d as any).destination_city || d.destination_country}</span>
                    {d.business_id && (
                      <span className="inline-flex items-center gap-0.5 text-primary">
                        <Building2 className="w-2.5 h-2.5" />B2B
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Info({
  icon: Icon, label, children,
}: { icon: typeof Inbox; label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
        <Icon className="w-3 h-3" /> {label}
      </p>
      <p className="text-foreground font-medium truncate">{children}</p>
    </div>
  );
}

/* ──────────────────────── Expanded body — variant per kind ──────────────────────── */

function ExpandedKindBody({ dossier: d, kind }: { dossier: any; kind: TypeFilter }) {
  const parsed = useMemo(() => parseClientNotes(d.notes), [d.notes]);
  const senderName = d.sender_name || parsed.senderName;
  const senderPhone = d.sender_phone || parsed.senderPhone || d.contact_phone;
  const recipientName = d.recipient_name || parsed.recipientName;
  const recipientPhone = d.recipient_phone || parsed.recipientPhone;
  const recipientAddress = d.recipient_address || parsed.recipientAddress;
  const weight = d.estimated_weight ?? parsed.weightKg;
  const pickupDate = d.pickup_date || parsed.pickupDate;
  const route = [
    d.origin_city || d.origin_country,
    d.destination_city || d.destination_country,
  ].filter(Boolean).join(' → ');

  if (kind === 'send') {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <Info icon={MapPin} label="Route">{route}</Info>
          <Info icon={Weight} label="Poids">{weight ? `${weight} kg${parsed.parcelCount ? ` · ${parsed.parcelCount} colis` : ''}` : '—'}</Info>
          <Info icon={Calendar} label="Collecte">{pickupDate || '—'}</Info>
          <Info icon={Wallet} label="Transport">{parsed.transport ? `${parsed.transport}${parsed.priority ? ` · ${parsed.priority}` : ''}` : '—'}</Info>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <ContactLine label="Expéditeur" name={senderName} phone={senderPhone} />
          <ContactLine label="Destinataire" name={recipientName} phone={recipientPhone} address={recipientAddress} />
        </div>
        <Essentials parsed={parsed} fallback={d.notes} />
      </div>
    );
  }

  if (kind === 'sourcing') {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <Info icon={Wallet} label="Budget">{d.budget_eur ? `${d.budget_eur} €` : '—'}</Info>
          <Info icon={Weight} label="Qté">{d.quantity ? `${d.quantity}${d.unit ? ` ${d.unit}` : ''}` : '—'}</Info>
          <Info icon={Building2} label="Fournisseur">{d.supplier_name || '—'}</Info>
          <Info icon={MapPin} label="Origine fournisseur">{d.supplier_country || d.origin_country}</Info>
        </div>
        <Essentials parsed={parsed} fallback={d.notes} />
      </div>
    );
  }

  // receive
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <Info icon={MapPin} label="Route">{route}</Info>
        <Info icon={Weight} label="Poids estimé">{weight ? `${weight} kg` : '—'}</Info>
        <Info icon={Calendar} label="Livraison estimée">
          {d.estimated_delivery_date ? new Date(d.estimated_delivery_date).toLocaleDateString('fr-FR') : '—'}
        </Info>
        <Info icon={Wallet} label="Budget">{d.budget_eur ? `${d.budget_eur} €` : '—'}</Info>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <ContactLine label="Expéditeur" name={senderName} phone={senderPhone} />
        <ContactLine label="Destinataire" name={recipientName} phone={recipientPhone} address={recipientAddress} />
      </div>
      <Essentials parsed={parsed} fallback={d.notes} />
    </div>
  );
}

function ContactLine({ label, name, phone, address }: { label: string; name?: string | null; phone?: string | null; address?: string | null }) {
  if (!name && !phone && !address) {
    return (
      <div className="rounded-md border border-dashed border-border bg-background/40 px-2.5 py-1.5 text-muted-foreground">
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
        <div className="italic text-[11px]">Non renseigné</div>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border bg-background px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-foreground font-medium">{name || '—'}</div>
      {phone && <a href={`tel:${phone}`} className="text-[11px] text-muted-foreground hover:text-foreground font-mono">{phone}</a>}
      {address && <div className="text-[11px] text-muted-foreground truncate">{address}</div>}
    </div>
  );
}

function Essentials({ parsed, fallback }: { parsed: ReturnType<typeof parseClientNotes>; fallback?: string | null }) {
  if (!hasParsedEssentials(parsed) && !fallback) return null;
  const chips: Array<{ k: string; v: string; tone?: string }> = [];
  if (parsed.declaredValue)  chips.push({ k: 'Valeur', v: parsed.declaredValue, tone: 'bg-amber-500/10 text-amber-500 border-amber-500/20' });
  if (parsed.payment)        chips.push({ k: 'Paiement', v: parsed.payment, tone: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' });
  if (parsed.insurance && parsed.insurance.toLowerCase() !== 'none')
                             chips.push({ k: 'Assurance', v: parsed.insurance, tone: 'bg-pink-500/10 text-pink-500 border-pink-500/20' });
  if (parsed.goodsType)      chips.push({ k: 'Type', v: parsed.goodsType });
  if (parsed.profile)        chips.push({ k: 'Profil', v: parsed.profile });

  if (chips.length === 0 && !parsed.description && !parsed.rest.length) return null;

  return (
    <div className="rounded-md bg-background/60 border border-border p-2 space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Notes client</div>
      {parsed.description && <p className="text-xs text-foreground">{parsed.description}</p>}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chips.map(c => (
            <span key={c.k} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${c.tone || 'bg-secondary text-muted-foreground border-border'}`}>
              <span className="opacity-70">{c.k}</span><span className="font-medium">{c.v}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}


