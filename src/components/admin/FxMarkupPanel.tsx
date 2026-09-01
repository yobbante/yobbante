import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Percent, Save } from 'lucide-react';
import { toast } from 'sonner';
import { BASE_FX, fetchFxMarkupPercent, saveFxMarkupPercent } from '@/lib/sourcingPricing';

/** Marge appliquée au taux de change standard pour les commandes Sourcing / Relais D. */
export function FxMarkupPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['fx-markup'], queryFn: fetchFxMarkupPercent });
  const [value, setValue] = useState('8');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data != null) setValue(String(data)); }, [data]);

  async function save() {
    const pct = Number(value);
    if (!Number.isFinite(pct) || pct < 0 || pct > 50) {
      toast.error('Marge invalide (0 à 50 %)');
      return;
    }
    setSaving(true);
    try {
      await saveFxMarkupPercent(pct);
      qc.invalidateQueries({ queryKey: ['fx-markup'] });
      toast.success('Taux de change majoré mis à jour');
    } catch (e: any) {
      toast.error(e?.message ?? 'Échec de l\'enregistrement');
    } finally { setSaving(false); }
  }

  const pct = Number(value) || 0;

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
        Sourcing — taux de change majoré
      </p>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Marge appliquée au taux de change standard pour convertir les prix produits en FCFA
          (commandes Relais D / Sourcing).
        </p>
        <div className="flex items-end gap-2">
          <div className="w-32">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Marge (%)</label>
            <div className="relative">
              <Input
                type="number" inputMode="decimal" value={value}
                onChange={e => setValue(e.target.value)} disabled={isLoading} className="h-9 pr-7"
              />
              <Percent className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
          <Button size="sm" className="h-9" onClick={save} disabled={saving || isLoading}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Enregistrer
          </Button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {Object.entries(BASE_FX).filter(([c]) => c !== 'XOF').map(([c, rate]) => (
            <span key={c}>
              1 {c} → <strong className="text-foreground">
                {Math.round(rate * (1 + pct / 100)).toLocaleString('fr-FR')} FCFA
              </strong>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
