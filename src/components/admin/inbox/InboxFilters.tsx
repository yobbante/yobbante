import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { INTAKE_SOURCES, SERVICE_KINDS, type IntakeSource, type ServiceKind } from '@/lib/intakeSources';

export interface InboxFilterState {
  search: string;
  sources: IntakeSource[];
  kinds: ServiceKind[];
}

interface Props {
  value: InboxFilterState;
  onChange: (v: InboxFilterState) => void;
}

export function InboxFilters({ value, onChange }: Props) {
  const toggleSource = (id: IntakeSource) => {
    const set = new Set(value.sources);
    set.has(id) ? set.delete(id) : set.add(id);
    onChange({ ...value, sources: Array.from(set) });
  };
  const toggleKind = (id: ServiceKind) => {
    const set = new Set(value.kinds);
    set.has(id) ? set.delete(id) : set.add(id);
    onChange({ ...value, kinds: Array.from(set) });
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={value.search}
          onChange={e => onChange({ ...value, search: e.target.value })}
          placeholder="Rechercher (nom, téléphone, référence)…"
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

      <div className="flex flex-wrap gap-1.5">
        {INTAKE_SOURCES.map(s => {
          const active = value.sources.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggleSource(s.id)}
              className="text-[11px] px-2 py-1 rounded-full border transition-colors"
              style={{
                background: active ? `${s.color}22` : 'transparent',
                borderColor: active ? s.color : 'hsl(var(--border))',
                color: active ? s.color : 'hsl(var(--muted-foreground))',
              }}
            >
              {s.emoji} {s.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SERVICE_KINDS.map(k => {
          const active = value.kinds.includes(k.id);
          return (
            <Button
              key={k.id}
              size="sm"
              variant={active ? 'default' : 'outline'}
              className="h-7 text-[11px]"
              onClick={() => toggleKind(k.id)}
            >
              {k.emoji} {k.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
