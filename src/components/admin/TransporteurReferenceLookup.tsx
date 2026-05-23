import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { fetchTransporteurByRef, type Transporteur } from '@/hooks/useTransporteurs';
import { uniqueCitiesFromNavettes, navettesServeCity } from '@/lib/dakarZones';

interface Props {
  value: string;
  onChange: (ref: string) => void;
  onMatch: (t: Transporteur | null) => void;
  /** Optional destination filter (city or country) — only show GPs serving this destination in the picker */
  destinationCity?: string | null;
  destinationCountry?: string | null;
}

export function TransporteurReferenceLookup({ value, onChange, onMatch, destinationCity, destinationCountry }: Props) {
  const [matched, setMatched] = useState<Transporteur | null>(null);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!/^[0-9]{4}$/.test(value)) {
      setMatched(null); setChecked(false); onMatch(null);
      return;
    }
    setLoading(true);
    fetchTransporteurByRef(value).then((t) => {
      if (cancelled) return;
      setMatched(t); setChecked(true); setLoading(false); onMatch(t);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Picker query — all active GPs
  const { data: allGps } = useQuery({
    queryKey: ['transporteurs-picker'],
    enabled: pickerOpen,
    queryFn: async (): Promise<Transporteur[]> => {
      const { data } = await supabase
        .from('transporteurs' as any)
        .select('*')
        .eq('actif', true)
        .order('updated_at', { ascending: false });
      return (data ?? []) as unknown as Transporteur[];
    },
  });

  const filteredGps = useMemo(() => {
    const list = allGps ?? [];
    const target = destinationCity || destinationCountry || '';
    const byDest = target
      ? list.filter(g => navettesServeCity(g.navettes, target))
      : list;
    if (!pickerQ.trim()) return byDest;
    const s = pickerQ.trim().toLowerCase();
    return byDest.filter(g =>
      g.reference.includes(s) ||
      (g.nom ?? '').toLowerCase().includes(s) ||
      (g.prenom ?? '').toLowerCase().includes(s) ||
      uniqueCitiesFromNavettes(g.navettes).some(c => c.toLowerCase().includes(s)),
    );
  }, [allGps, pickerQ, destinationCity, destinationCountry]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Référence transporteur</Label>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              Parcourir les GP <ChevronDown className="w-3 h-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[420px] p-0" align="end">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={pickerQ} onChange={(e) => setPickerQ(e.target.value)}
                  placeholder="Filtrer par nom, réf, ville desservie…"
                  className="pl-8 h-9 text-sm"
                />
              </div>
              {(destinationCity || destinationCountry) && (
                <div className="text-[11px] text-muted-foreground mt-2">
                  Filtré sur la destination : <span className="font-medium text-foreground">{destinationCity || destinationCountry}</span>
                </div>
              )}
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {filteredGps.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  Aucun GP ne dessert cette destination.
                </div>
              ) : filteredGps.map(g => {
                const cities = uniqueCitiesFromNavettes(g.navettes);
                const initials = ((g.prenom?.[0] || '') + (g.nom?.[0] || '')).toUpperCase() || '?';
                return (
                  <button
                    key={g.id}
                    onClick={() => { onChange(g.reference); setPickerOpen(false); }}
                    className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-secondary/50 text-left border-b border-border/40 last:border-0"
                  >
                    {g.photo_url ? (
                      <img src={g.photo_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-[11px] font-bold shrink-0">
                        {initials}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{[g.prenom, g.nom].filter(Boolean).join(' ')}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">GP{g.reference.padStart(4, '0')}</span>
                        {!g.profile_complete && (
                          <span className="text-[9px] px-1 py-0.5 rounded border border-amber-500/40 text-amber-500">incomplet</span>
                        )}
                      </div>
                      {g.zone && <div className="text-[11px] text-muted-foreground">Zone Dakar : {g.zone}</div>}
                      {g.adresse_collecte_dakar && (
                        <div className="text-[11px] text-muted-foreground truncate">📍 {g.adresse_collecte_dakar}</div>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {cities.slice(0, 4).map(c => (
                          <Badge key={c} variant="secondary" className="text-[9px] font-normal">{c}</Badge>
                        ))}
                        {cities.length > 4 && <Badge variant="outline" className="text-[9px] font-normal">+{cities.length - 4}</Badge>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        placeholder="4 chiffres ex: 2241"
        inputMode="numeric"
        maxLength={4}
      />

      {!checked && (
        <p className="text-[11px] text-muted-foreground">
          Nouveau transporteur ? Les infos seront enregistrées automatiquement.
        </p>
      )}

      {checked && matched && (
        <div className="space-y-2">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-[12px]"
            style={{
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.2)',
              color: '#22C55E',
            }}
          >
            <span>✅ Transporteur connu — infos pré-remplies</span>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
            <div className="flex items-start gap-3">
              {matched.photo_url ? (
                <img src={matched.photo_url} alt="" className="h-12 w-12 rounded-full object-cover shrink-0" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center text-sm font-bold shrink-0">
                  {((matched.prenom?.[0] || '') + (matched.nom?.[0] || '')).toUpperCase() || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold">{[matched.prenom, matched.nom].filter(Boolean).join(' ')}</p>
                  {matched.profile_complete ? (
                    <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-500">✅ Complet</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-500">⚠️ Profil incomplet</Badge>
                  )}
                </div>
                <p className="text-[12px] text-muted-foreground">{matched.telephone_1}{matched.telephone_2 && <> · {matched.telephone_2}</>}</p>
                {(matched.adresse_collecte_dakar || matched.adresse_1) && (
                  <p className="text-[12px] text-muted-foreground">📍 {matched.adresse_collecte_dakar || matched.adresse_1}{matched.zone && <> — {matched.zone}</>}</p>
                )}
              </div>
            </div>
            {(() => {
              const cities = uniqueCitiesFromNavettes(matched.navettes);
              if (cities.length === 0) return null;
              return (
                <div className="flex flex-wrap gap-1 pt-1 border-t border-border/50">
                  {cities.map(c => (
                    <Badge key={c} variant="secondary" className="text-[10px] font-normal">{c}</Badge>
                  ))}
                </div>
              );
            })()}
            {matched.notes && (
              <p className="text-[11px] text-muted-foreground/70 italic pt-1 border-t border-border/50">
                "{matched.notes}"
              </p>
            )}
          </div>
        </div>
      )}

      {checked && !matched && !loading && (
        <p className="font-mono text-[11px]" style={{ color: '#F5C518' }}>
          Nouveau transporteur · Réf. {value}
        </p>
      )}
    </div>
  );
}
