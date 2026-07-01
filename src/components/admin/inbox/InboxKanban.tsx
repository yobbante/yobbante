import { useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { InboxCard } from './InboxCard';
import type { InboxDossier } from '@/hooks/useInboxDossiers';
import { isFromKonnekt } from '@/lib/inboxFilters';

type ColId = 'nouveau' | 'to_assign' | 'gp_assigned' | 'ready' | 'in_transit';

interface ColDef {
  id: ColId;
  title: string;
  accent: string; // tw classes for header dot
  droppable: boolean; // false = info-only column (drop shows toast)
}

const COLS: ColDef[] = [
  { id: 'nouveau',     title: 'Nouveau',         accent: 'bg-emerald-500', droppable: true },
  { id: 'to_assign',   title: 'À assigner',      accent: 'bg-amber-500',   droppable: true },
  { id: 'gp_assigned', title: 'GP assigné',      accent: 'bg-sky-500',     droppable: false },
  { id: 'ready',       title: 'Prêt au départ',  accent: 'bg-violet-500',  droppable: false },
  { id: 'in_transit',  title: 'En transit',      accent: 'bg-primary',     droppable: true },
];

function colOf(d: InboxDossier): ColId | null {
  const s = d.status;
  const paid = d.payment_status === 'paid';
  // Terminal / retour statuses ne s'affichent pas dans le kanban actif
  if (['CANCELLED', 'RETURNED', 'RETURN_REQUESTED', 'RETURN_IN_PROGRESS'].includes(s)) return null;
  if (s === 'IN_TRANSIT') return 'in_transit';
  if (paid && !['DELIVERED', 'CANCELLED'].includes(s)) return 'ready';
  if (d.assigned_departure_id) return 'gp_assigned';
  if (s === 'IN_REVIEW') return 'to_assign';
  if (s === 'SUBMITTED') return 'nouveau';
  // fallback: dossiers confirmed without departure → to_assign
  if (s === 'CONFIRMED' || s === 'AWAITING_CLIENT') return 'to_assign';
  return 'nouveau';
}

const STATUS_BY_COL: Partial<Record<ColId, string>> = {
  nouveau: 'SUBMITTED',
  to_assign: 'IN_REVIEW',
  in_transit: 'IN_TRANSIT',
};

interface Props {
  dossiers: InboxDossier[];
  onView: (d: InboxDossier) => void;
  onConfirm: (d: InboxDossier) => void;
  onWhatsApp: (d: InboxDossier) => void;
  onStatusChange: (id: string, status: string) => void;
}

export function InboxKanban({ dossiers, onView, onConfirm, onWhatsApp, onStatusChange }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);

  const byCol = useMemo(() => {
    const m: Record<ColId, InboxDossier[]> = {
      nouveau: [], to_assign: [], gp_assigned: [], ready: [], in_transit: [],
    };
    for (const d of dossiers) m[colOf(d)].push(d);
    return m;
  }, [dossiers]);

  const active = useMemo(() => dossiers.find(d => d.id === activeId) || null, [dossiers, activeId]);

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const dossierId = String(e.active.id);
    const target = e.over?.id ? (String(e.over.id) as ColId) : null;
    if (!target) return;
    const d = dossiers.find(x => x.id === dossierId);
    if (!d) return;
    const current = colOf(d);
    if (current === target) return;

    const newStatus = STATUS_BY_COL[target];
    if (!newStatus) {
      const colName = COLS.find(c => c.id === target)?.title;
      toast.info(`Pour passer en "${colName}", utilisez le drawer (assignation GP / paiement).`);
      return;
    }
    onStatusChange(dossierId, newStatus);
    toast.success(`Dossier déplacé en ${COLS.find(c => c.id === target)?.title}`);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {COLS.map(col => (
          <Column key={col.id} col={col} items={byCol[col.id]}>
            {byCol[col.id].length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Aucun dossier</p>
            ) : (
              byCol[col.id].map(d => (
                <DraggableCard key={d.id} dossier={d}>
                  <InboxCard
                    dossier={d}
                    onView={onView}
                    onConfirm={onConfirm}
                    onWhatsApp={onWhatsApp}
                  />
                </DraggableCard>
              ))
            )}
          </Column>
        ))}
      </div>
      <DragOverlay>
        {active ? (
          <div className="opacity-90 rotate-1 shadow-2xl">
            <InboxCard dossier={active} onView={() => {}} onConfirm={() => {}} onWhatsApp={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ col, items, children }: { col: ColDef; items: InboxDossier[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  const konnektCount = items.filter(isFromKonnekt).length;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${col.accent}`} />
          <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {konnektCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-500 font-medium">
              {konnektCount}K
            </span>
          )}
          <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2 min-h-[200px] p-2 rounded-lg border transition-colors ${
          isOver ? (col.droppable ? 'bg-primary/10 border-primary/40' : 'bg-amber-500/10 border-amber-500/40 border-dashed')
                 : 'bg-muted/30 border-transparent'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function DraggableCard({ dossier, children }: { dossier: InboxDossier; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: dossier.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.4 : 1 }
    : { opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing touch-none">
      {children}
    </div>
  );
}
