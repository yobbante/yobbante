import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FilterChip {
  value: string;
  label: string;
  count?: number;
}

interface SearchFilterBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  placeholder?: string;
  chips?: FilterChip[];
  activeChip?: string;
  onChipChange?: (value: string) => void;
}

/**
 * Barre de recherche + chips de filtre — design plat, mobile-first,
 * scroll horizontal sur petit écran.
 */
export function SearchFilterBar({
  query,
  onQueryChange,
  placeholder = 'Rechercher…',
  chips,
  activeChip,
  onChipChange,
}: SearchFilterBarProps) {
  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className="pl-9 pr-9 h-10 bg-card border-border text-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Effacer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {chips && chips.length > 0 && onChipChange && (
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-none">
          {chips.map((chip) => {
            const isActive = activeChip === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => onChipChange(chip.value)}
                className={cn(
                  'shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[12px] font-medium border transition-colors',
                  isActive
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-card text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground'
                )}
              >
                {chip.label}
                {typeof chip.count === 'number' && (
                  <span className={cn(
                    'tabular-nums text-[10px] px-1.5 py-0.5 rounded-full',
                    isActive ? 'bg-background/15 text-background' : 'bg-secondary text-muted-foreground',
                  )}>
                    {chip.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
