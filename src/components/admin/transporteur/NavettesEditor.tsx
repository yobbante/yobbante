import { Trash2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CITIES_BY_REGION, type Navette, newNavette } from '@/lib/dakarZones';

interface Props {
  value: Navette[];
  onChange: (next: Navette[]) => void;
}

const CUSTOM_CITY = '__custom__';

export function NavettesEditor({ value, onChange }: Props) {
  const navettes = Array.isArray(value) ? value : [];

  const updateNavette = (idx: number, patch: Partial<Navette>) => {
    const next = navettes.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  const removeNavette = (idx: number) => onChange(navettes.filter((_, i) => i !== idx));
  const addNavette = () => onChange([...navettes, newNavette()]);

  const addEscale = (navIdx: number) => {
    const nav = navettes[navIdx];
    updateNavette(navIdx, { villes: [...(nav.villes ?? []), { ville: '', adresse: '', creneau: '' }] });
  };
  const removeEscale = (navIdx: number, escIdx: number) => {
    const nav = navettes[navIdx];
    updateNavette(navIdx, { villes: nav.villes.filter((_, i) => i !== escIdx) });
  };
  const setEscale = (navIdx: number, escIdx: number, patch: Partial<Navette['villes'][number]>) => {
    const nav = navettes[navIdx];
    const villes = nav.villes.slice();
    villes[escIdx] = { ...villes[escIdx], ...patch };
    updateNavette(navIdx, { villes });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Vos routes et escales</h3>
        <p className="text-xs text-muted-foreground">
          Ajoutez toutes les villes desservies, y compris les escales. Le départ est toujours Dakar.
        </p>
      </div>

      {navettes.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          Aucune navette. Ajoutez-en une pour décrire vos routes.
        </div>
      )}

      {navettes.map((nav, navIdx) => (
        <div key={nav.id} className="rounded-lg border border-border bg-secondary/20 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px]">Navette {navIdx + 1}</Badge>
              <span className="text-xs text-muted-foreground">Dakar → …</span>
            </div>
            <Button
              type="button" size="sm" variant="ghost"
              className="h-7 text-destructive hover:text-destructive"
              onClick={() => removeNavette(navIdx)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Supprimer
            </Button>
          </div>

          <div className="space-y-3">
            {nav.villes.map((esc, escIdx) => {
              const isCustom = !!esc.ville && !Object.values(CITIES_BY_REGION).flat().includes(esc.ville);
              return (
                <div key={escIdx} className="rounded-md border border-border bg-background p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Escale {escIdx + 1}
                    </Label>
                    <Button
                      type="button" size="icon" variant="ghost"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => removeEscale(navIdx, escIdx)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px]">Ville *</Label>
                      <Select
                        value={isCustom ? CUSTOM_CITY : (esc.ville || '')}
                        onValueChange={(v) => {
                          if (v === CUSTOM_CITY) setEscale(navIdx, escIdx, { ville: '' });
                          else setEscale(navIdx, escIdx, { ville: v });
                        }}
                      >
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(CITIES_BY_REGION).map(([region, cities]) => (
                            <SelectGroup key={region}>
                              <SelectLabel>{region}</SelectLabel>
                              {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectGroup>
                          ))}
                          <SelectGroup>
                            <SelectLabel>Autre</SelectLabel>
                            <SelectItem value={CUSTOM_CITY}>Saisir une autre ville…</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {isCustom && (
                        <Input
                          className="mt-1 h-9 text-sm"
                          placeholder="Nom de la ville"
                          value={esc.ville}
                          onChange={(e) => setEscale(navIdx, escIdx, { ville: e.target.value })}
                        />
                      )}
                    </div>
                    <div>
                      <Label className="text-[11px]">Créneau dans cette ville</Label>
                      <Input
                        className="h-9 text-sm"
                        placeholder="Ex: Mardis et vendredis 9h-17h"
                        value={esc.creneau ?? ''}
                        onChange={(e) => setEscale(navIdx, escIdx, { creneau: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[11px]">Adresse de remise (optionnel)</Label>
                    <Input
                      className="h-9 text-sm"
                      placeholder="Ex: 12 rue de la Paix, 75001 Paris"
                      value={esc.adresse ?? ''}
                      onChange={(e) => setEscale(navIdx, escIdx, { adresse: e.target.value })}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            type="button" variant="outline" size="sm"
            className="w-full border-dashed"
            onClick={() => addEscale(navIdx)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter une escale
          </Button>
        </div>
      ))}

      <Button
        type="button" variant="outline" size="sm"
        onClick={addNavette}
        style={{ borderColor: '#F5C518', color: '#F5C518' }}
      >
        <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter une navette
      </Button>
    </div>
  );
}
