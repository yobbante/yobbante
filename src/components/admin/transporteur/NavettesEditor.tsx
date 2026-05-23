import { useMemo, useState } from 'react';
import { Trash2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { type Navette, newNavette } from '@/lib/dakarZones';
import { ALL_CITIES } from '@/lib/worldCities';
import { useCustomCities } from '@/hooks/useCustomCities';
import { useToast } from '@/hooks/use-toast';

interface Props {
  value: Navette[];
  onChange: (next: Navette[]) => void;
}

const CUSTOM_CITY = '__custom__';

export function NavettesEditor({ value, onChange }: Props) {
  const navettes = Array.isArray(value) ? value : [];
  const { cities: customCities, addCustomCity } = useCustomCities();
  const { toast } = useToast();

  // Inline "Autre ville" form state, keyed by `${navIdx}-${escIdx}`
  const [customForm, setCustomForm] = useState<Record<string, { city: string; countryCode: string; countryLabel: string; flag: string; busy?: boolean }>>({});

  // Group all 36 + custom cities by country label
  const groupedCities = useMemo(() => {
    const pool = [...ALL_CITIES, ...customCities];
    const map = new Map<string, typeof pool>();
    pool.forEach(c => {
      const k = c.countryLabel;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(c);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'fr'))
      .map(([label, cities]) => ({
        label,
        cities: [...cities].sort((a, b) => a.city.localeCompare(b.city, 'fr')),
      }));
  }, [customCities]);

  const knownCityNames = useMemo(
    () => new Set([...ALL_CITIES, ...customCities].map(c => c.city)),
    [customCities],
  );

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

  const formKey = (n: number, e: number) => `${n}-${e}`;

  const submitCustom = async (navIdx: number, escIdx: number) => {
    const k = formKey(navIdx, escIdx);
    const f = customForm[k];
    if (!f?.city.trim() || !f?.countryCode.trim() || !f?.countryLabel.trim()) {
      toast({ title: 'Champs incomplets', description: 'Renseignez la ville, le code pays (ex: FR) et le nom du pays.', variant: 'destructive' });
      return;
    }
    setCustomForm(s => ({ ...s, [k]: { ...f, busy: true } }));
    try {
      const created = await addCustomCity({
        city: f.city,
        country_code: f.countryCode,
        country_label: f.countryLabel,
        flag: f.flag || '🏳️',
      });
      setEscale(navIdx, escIdx, { ville: created.city });
      setCustomForm(s => {
        const next = { ...s };
        delete next[k];
        return next;
      });
      toast({ title: 'Ville ajoutée', description: `${created.flag} ${created.city} est désormais sélectionnable partout sur le site.` });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message ?? 'Impossible d\'enregistrer la ville.', variant: 'destructive' });
      setCustomForm(s => ({ ...s, [k]: { ...f, busy: false } }));
    }
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
              const k = formKey(navIdx, escIdx);
              const showCustomForm = !!customForm[k];
              const isUnknown = !!esc.ville && !knownCityNames.has(esc.ville);
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
                        value={showCustomForm ? CUSTOM_CITY : (esc.ville || '')}
                        onValueChange={(v) => {
                          if (v === CUSTOM_CITY) {
                            setCustomForm(s => ({ ...s, [k]: { city: '', countryCode: '', countryLabel: '', flag: '🏳️' } }));
                            setEscale(navIdx, escIdx, { ville: '' });
                          } else {
                            setEscale(navIdx, escIdx, { ville: v });
                          }
                        }}
                      >
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                        <SelectContent className="max-h-[320px]">
                          {groupedCities.map(group => (
                            <SelectGroup key={group.label}>
                              <SelectLabel>{group.label}</SelectLabel>
                              {group.cities.map(c => (
                                <SelectItem key={c.id} value={c.city}>
                                  {c.flag} {c.city}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                          <SelectGroup>
                            <SelectLabel>Autre</SelectLabel>
                            <SelectItem value={CUSTOM_CITY}>+ Ajouter une nouvelle ville…</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {isUnknown && !showCustomForm && (
                        <p className="text-[10px] text-amber-600 mt-1">⚠ "{esc.ville}" n'est pas dans le catalogue.</p>
                      )}

                      {showCustomForm && (
                        <div className="mt-2 space-y-2 rounded-md border border-dashed border-border p-2 bg-secondary/30">
                          <p className="text-[11px] text-muted-foreground">
                            Cette ville sera enregistrée en base et disponible partout sur le site.
                          </p>
                          <Input
                            className="h-9 text-sm"
                            placeholder="Nom de la ville (ex: Lisbonne)"
                            value={customForm[k].city}
                            onChange={(e) => setCustomForm(s => ({ ...s, [k]: { ...s[k], city: e.target.value } }))}
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              className="h-9 text-sm"
                              placeholder="Code (PT)"
                              maxLength={2}
                              value={customForm[k].countryCode}
                              onChange={(e) => setCustomForm(s => ({ ...s, [k]: { ...s[k], countryCode: e.target.value.toUpperCase() } }))}
                            />
                            <Input
                              className="h-9 text-sm col-span-2"
                              placeholder="Pays (Portugal)"
                              value={customForm[k].countryLabel}
                              onChange={(e) => setCustomForm(s => ({ ...s, [k]: { ...s[k], countryLabel: e.target.value } }))}
                            />
                          </div>
                          <Input
                            className="h-9 text-sm"
                            placeholder="Drapeau (🇵🇹)"
                            value={customForm[k].flag}
                            onChange={(e) => setCustomForm(s => ({ ...s, [k]: { ...s[k], flag: e.target.value } }))}
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button" size="sm"
                              disabled={customForm[k].busy}
                              onClick={() => submitCustom(navIdx, escIdx)}
                            >
                              {customForm[k].busy ? 'Ajout…' : 'Ajouter et sélectionner'}
                            </Button>
                            <Button
                              type="button" size="sm" variant="ghost"
                              onClick={() => setCustomForm(s => { const n = { ...s }; delete n[k]; return n; })}
                            >
                              Annuler
                            </Button>
                          </div>
                        </div>
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
