import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Check, ChevronsUpDown, Search, Sparkles } from 'lucide-react';
import {
  CARRIER_TYPE_LABEL, useCarrierDirectory, type CarrierEntry, type CarrierType,
} from '@/hooks/useCarrierDirectory';

/**
 * Sélecteur de transporteur : recherche dans la base (GP, chauffeurs, partenaires)
 * par type, avec saisie libre en secours. La référence est renvoyée si connue.
 */
export function CarrierPicker({
  value, valueRef, types, autoDetected, onChange,
}: {
  value: string;
  valueRef: string | null;
  types: CarrierType[];
  /** Transporteur trouvé automatiquement sur le dossier (GP assigné / chauffeur). */
  autoDetected?: CarrierEntry | null;
  onChange: (name: string, ref: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [activeTypes, setActiveTypes] = useState<CarrierType[]>(types);
  const { data: directory = [], isLoading } = useCarrierDirectory(activeTypes);

  const grouped = useMemo(() => {
    const map = new Map<CarrierType, CarrierEntry[]>();
    for (const e of directory) {
      if (!map.has(e.type)) map.set(e.type, []);
      map.get(e.type)!.push(e);
    }
    return Array.from(map.entries());
  }, [directory]);

  const label = value || 'Rechercher un transporteur…';

  return (
    <div className="space-y-2">
      {autoDetected && (
        <button
          type="button"
          onClick={() => onChange(autoDetected.name, autoDetected.ref)}
          className="w-full flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5 text-left text-xs hover:bg-primary/10"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">{autoDetected.name}</span>
            {autoDetected.ref && <span className="text-muted-foreground"> · réf {autoDetected.ref}</span>}
          </span>
          <span className="text-[10px] text-primary shrink-0">
            {value === autoDetected.name ? 'Appliqué' : 'Utiliser'}
          </span>
        </button>
      )}

      {manual ? (
        <Input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value, null)}
          placeholder="Nom du transporteur (saisie libre)"
        />
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
              <span className={value ? 'truncate' : 'truncate text-muted-foreground'}>{label}</span>
              <ChevronsUpDown className="w-3.5 h-3.5 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(22rem,90vw)] p-0" align="start">
            <div className="flex flex-wrap gap-1 border-b border-border p-2">
              {(['gp', 'road', 'partner'] as CarrierType[]).map((t) => {
                const on = activeTypes.includes(t);
                return (
                  <Badge
                    key={t}
                    variant={on ? 'default' : 'outline'}
                    className="cursor-pointer text-[10px]"
                    onClick={() =>
                      setActiveTypes((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]))
                    }
                  >
                    {CARRIER_TYPE_LABEL[t]}
                  </Badge>
                );
              })}
            </div>
            <Command filter={(v, s) => (v.toLowerCase().includes(s.toLowerCase()) ? 1 : 0)}>
              <CommandInput placeholder="Nom, référence, ville…" />
              <CommandList className="max-h-64">
                <CommandEmpty>{isLoading ? 'Chargement…' : 'Aucun transporteur trouvé'}</CommandEmpty>
                {grouped.map(([type, entries]) => (
                  <CommandGroup key={type} heading={CARRIER_TYPE_LABEL[type]}>
                    {entries.map((e) => (
                      <CommandItem
                        key={`${e.type}:${e.id}`}
                        value={[e.name, e.ref, e.detail, e.phone].filter(Boolean).join(' ')}
                        onSelect={() => { onChange(e.name, e.ref); setOpen(false); }}
                      >
                        <Check
                          className={
                            'mr-2 h-3.5 w-3.5 ' +
                            (value === e.name && valueRef === e.ref ? 'opacity-100' : 'opacity-0')
                          }
                        />
                        <span className="min-w-0 flex-1 truncate">{e.name}</span>
                        <span className="ml-2 text-[10px] text-muted-foreground shrink-0">
                          {e.ref ? `réf ${e.ref}` : e.detail || ''}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{valueRef ? `Référence liée : ${valueRef}` : 'Aucune référence liée'}</span>
        <button type="button" className="underline" onClick={() => setManual((m) => !m)}>
          {manual ? (
            <span className="inline-flex items-center gap-1"><Search className="w-3 h-3" /> Chercher dans la base</span>
          ) : 'Saisie libre'}
        </button>
      </div>
    </div>
  );
}
