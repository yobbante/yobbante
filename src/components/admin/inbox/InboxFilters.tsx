import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { INTAKE_SOURCES, type IntakeSource } from '@/lib/intakeSources';

export type InboxStatusFilter =
  | 'new' | 'to_assign' | 'gp_assigned' | 'awaiting_payment'
  | 'paid' | 'pickup_scheduled' | 'in_transit' | 'delivered'
  | 'cancelled' | 'return_requested' | 'returned';

export type CarrierFilter = 'gp_yobbante' | 'konnekt' | 'dhl' | 'fedex' | 'other';
export type UrgencyFilter = 'urgent' | 'normal';

export interface InboxFilterState {
  search: string;
  sources: IntakeSource[];
  statuses: InboxStatusFilter[];
  destinations: string[];
  carriers: CarrierFilter[];
  urgency: UrgencyFilter[];
}

export const EMPTY_FILTERS: InboxFilterState = {
  search: '', sources: [], statuses: [], destinations: [], carriers: [], urgency: [],
};

const STATUSES: { id: InboxStatusFilter; label: string }[] = [
  { id: 'new', label: 'Nouveau' },
  { id: 'to_assign', label: 'À assigner' },
  { id: 'gp_assigned', label: 'GP assigné' },
  { id: 'awaiting_payment', label: 'Attente paiement' },
  { id: 'paid', label: 'Payé' },
  { id: 'pickup_scheduled', label: 'Collecte planifiée' },
  { id: 'in_transit', label: 'En transit' },
  { id: 'delivered', label: 'Livré' },
  { id: 'cancelled', label: 'Annulé' },
  { id: 'return_requested', label: 'Retour' },
  { id: 'returned', label: 'Retourné' },
];

const DESTINATIONS = [
  { id: 'Paris', label: 'Paris/FR' },
  { id: 'New York', label: 'NYC/USA' },
  { id: 'Dubai', label: 'Dubai/AE' },
  { id: 'Abidjan', label: 'Abidjan/CI' },
  { id: 'Montreal', label: 'Montréal/CA' },
  { id: 'Bordeaux', label: 'Bordeaux/FR' },
];

const CARRIERS: { id: CarrierFilter; label: string }[] = [
  { id: 'gp_yobbante', label: 'GP Yobbanté' },
  { id: 'konnekt', label: 'Konnekt' },
  { id: 'dhl', label: 'DHL' },
  { id: 'fedex', label: 'FedEx' },
  { id: 'other', label: 'Autre' },
];

interface Props {
  value: InboxFilterState;
  onChange: (v: InboxFilterState) => void;
}

function toggleIn<T>(arr: T[], id: T): T[] {
  const set = new Set(arr);
  set.has(id) ? set.delete(id) : set.add(id);
  return Array.from(set);
}

function ChipRow<T extends string>({
  items, active, onToggle, colorFor,
}: {
  items: { id: T; label: string; color?: string }[];
  active: T[];
  onToggle: (id: T) => void;
  colorFor?: (id: T) => string | undefined;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(it => {
        const isOn = active.includes(it.id);
        const color = it.color || colorFor?.(it.id);
        return (
          <button
            key={it.id}
            onClick={() => onToggle(it.id)}
            className="text-[11px] px-2 py-1 rounded-full border transition-colors"
            style={{
              background: isOn ? (color ? `${color}22` : 'hsl(var(--primary)/0.15)') : 'transparent',
              borderColor: isOn ? (color || 'hsl(var(--primary))') : 'hsl(var(--border))',
              color: isOn ? (color || 'hsl(var(--primary))') : 'hsl(var(--muted-foreground))',
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export function InboxFilters({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const activeCount =
    value.sources.length + value.statuses.length + value.destinations.length +
    value.carriers.length + value.urgency.length;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={value.search}
            onChange={e => onChange({ ...value, search: e.target.value })}
            placeholder="Nom, téléphone, YOB-XXXXXX, destination…"
            className="pl-9"
          />
          {value.search && (
            <button
              onClick={() => onChange({ ...value, search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(o => !o)}>
          Filtres {activeCount > 0 && <span className="ml-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5">{activeCount}</span>}
          {open ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
        </Button>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onChange({ ...EMPTY_FILTERS, search: value.search })}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {open && (
        <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/20">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Canal</div>
            <ChipRow
              items={INTAKE_SOURCES.map(s => ({ id: s.id, label: s.label, color: s.color }))}
              active={value.sources}
              onToggle={(id) => onChange({ ...value, sources: toggleIn(value.sources, id) })}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Statut</div>
            <ChipRow
              items={STATUSES}
              active={value.statuses}
              onToggle={(id) => onChange({ ...value, statuses: toggleIn(value.statuses, id) })}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Destination</div>
            <ChipRow
              items={DESTINATIONS}
              active={value.destinations}
              onToggle={(id) => onChange({ ...value, destinations: toggleIn(value.destinations, id) })}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Transporteur</div>
            <ChipRow
              items={CARRIERS}
              active={value.carriers}
              onToggle={(id) => onChange({ ...value, carriers: toggleIn(value.carriers, id) })}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Urgence</div>
            <ChipRow
              items={[
                { id: 'urgent', label: 'Urgent +48h', color: '#ef4444' },
                { id: 'normal', label: 'Normal', color: '#22c55e' },
              ]}
              active={value.urgency}
              onToggle={(id) => onChange({ ...value, urgency: toggleIn(value.urgency, id) })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
