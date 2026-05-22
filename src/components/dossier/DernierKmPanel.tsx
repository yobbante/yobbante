import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Home, MapPin, Package, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface Rate {
  carrier: string;
  service: string;
  price_xof: number;
  price_eur: number;
  eta_days_min: number;
  eta_days_max: number;
  is_default?: boolean;
}

interface Props {
  dossierId: string;
  destinationCountry: string;
  weightKg: number | null;
  initialAddress: string | null;
  initialCarrier: string | null;
  initialMode?: 'home' | 'relay' | null;
}

/**
 * Client-facing panel — choose home delivery vs relay pickup,
 * and compare carrier rates (Yobbanté Standard always shown).
 */
export function DernierKmPanel({
  dossierId, destinationCountry, weightKg, initialAddress, initialCarrier, initialMode,
}: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'home' | 'relay'>(initialMode ?? 'home');
  const [address, setAddress] = useState(initialAddress ?? '');
  const [selected, setSelected] = useState<string | null>(initialCarrier);

  const ratesQuery = useQuery({
    queryKey: ['ship-rates', dossierId, destinationCountry, weightKg],
    queryFn: async (): Promise<Rate[]> => {
      const { data, error } = await supabase.functions.invoke('get-shipping-rates', {
        body: {
          destination_country: destinationCountry,
          weight_kg: weightKg ?? 1,
        },
      });
      if (error) throw error;
      return (data?.rates ?? []) as Rate[];
    },
    enabled: !!destinationCountry,
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: async () => {
      const rate = (ratesQuery.data ?? []).find(r => `${r.carrier}-${r.service}` === selected);
      const { error } = await supabase
        .from('dossiers' as any)
        .update({
          dernier_km_carrier: rate ? `${rate.carrier} ${rate.service}` : null,
          dernier_km_prix: rate?.price_xof ?? null,
          dernier_km_adresse: mode === 'home' ? address : null,
        })
        .eq('id', dossierId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Choix de livraison enregistré');
      qc.invalidateQueries({ queryKey: ['dossier', dossierId] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erreur'),
  });

  return (
    <section>
      <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
        <Truck className="w-4 h-4" /> Livraison dernier kilomètre
      </h2>

      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode('home')}
            className="rounded-xl border p-3 text-left transition-colors"
            style={{
              borderColor: mode === 'home' ? '#F5C518' : 'hsl(var(--border))',
              background: mode === 'home' ? 'rgba(245,197,24,0.08)' : 'transparent',
            }}
          >
            <Home className="w-4 h-4 mb-1" />
            <div className="font-medium text-sm">Livraison à domicile</div>
            <div className="text-xs text-muted-foreground">Le coursier vient chez vous</div>
          </button>
          <button
            onClick={() => setMode('relay')}
            className="rounded-xl border p-3 text-left transition-colors"
            style={{
              borderColor: mode === 'relay' ? '#F5C518' : 'hsl(var(--border))',
              background: mode === 'relay' ? 'rgba(245,197,24,0.08)' : 'transparent',
            }}
          >
            <MapPin className="w-4 h-4 mb-1" />
            <div className="font-medium text-sm">Point relais</div>
            <div className="text-xs text-muted-foreground">Vous récupérez sur place</div>
          </button>
        </div>

        {/* Address */}
        {mode === 'home' && (
          <div>
            <Label className="text-xs">Adresse de livraison</Label>
            <Textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              placeholder="Numéro, rue, quartier, ville…"
            />
          </div>
        )}

        {/* Rates */}
        <div>
          <Label className="text-xs">Choix du transporteur</Label>
          {ratesQuery.isLoading ? (
            <Skeleton className="h-20 w-full mt-1" />
          ) : (
            <div className="space-y-1.5 mt-1.5">
              {(ratesQuery.data ?? []).map((r) => {
                const key = `${r.carrier}-${r.service}`;
                const active = selected === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    className="w-full rounded-xl border p-3 flex items-center justify-between transition-colors"
                    style={{
                      borderColor: active ? '#F5C518' : 'hsl(var(--border))',
                      background: active ? 'rgba(245,197,24,0.08)' : 'transparent',
                    }}
                  >
                    <div className="text-left">
                      <div className="text-sm font-medium flex items-center gap-2">
                        <Package className="w-3.5 h-3.5" />
                        {r.carrier} · {r.service}
                        {r.is_default && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider"
                            style={{ background: '#F5C518', color: '#0A0E1A' }}>
                            Recommandé
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.eta_days_min}–{r.eta_days_max} jours
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">{r.price_xof.toLocaleString('fr-FR')} XOF</div>
                      <div className="text-[10px] text-muted-foreground">≈ {r.price_eur} €</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !selected || (mode === 'home' && !address.trim())}
            style={{ background: '#F5C518', color: '#0A0E1A' }}
          >
            {save.isPending ? 'Enregistrement…' : 'Valider mon choix'}
          </Button>
        </div>
      </div>
    </section>
  );
}
