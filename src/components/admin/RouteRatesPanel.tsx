import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Route, Save } from 'lucide-react';
import { toast } from 'sonner';

type Row = {
  id: string;
  zone: string;
  zone_label: string;
  default_rate_per_kg: number;
  express_coefficient: number;
};

export function RouteRatesPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('route_default_rates')
        .select('id, zone, zone_label, default_rate_per_kg, express_coefficient')
        .order('zone_label');
      if (error) toast.error('Erreur de chargement des tarifs');
      else setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  const update = (id: string, key: keyof Row, val: number) =>
    setRows(rs => rs.map(r => (r.id === id ? { ...r, [key]: val } : r)));

  const save = async (row: Row) => {
    setSavingId(row.id);
    const { error } = await supabase
      .from('route_default_rates')
      .update({
        default_rate_per_kg: row.default_rate_per_kg,
        express_coefficient: row.express_coefficient,
      })
      .eq('id', row.id);
    setSavingId(null);
    if (error) toast.error('Echec de la mise à jour');
    else toast.success(`${row.zone_label} mis à jour`);
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Route className="w-4 h-4 text-primary" />
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Tarifs par défaut des routes
        </p>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Ces tarifs sont utilisés si aucun GP n'est assigné, ou si le GP n'a pas saisi de prix pour la ville.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 px-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            <div className="col-span-5">Zone</div>
            <div className="col-span-3">Tarif/kg (FCFA)</div>
            <div className="col-span-2">Coef. Express</div>
            <div className="col-span-2" />
          </div>
          {rows.map(r => (
            <div key={r.id} className="grid grid-cols-12 gap-2 items-center bg-background/40 rounded-lg p-2">
              <div className="col-span-5">
                <div className="text-sm font-medium">{r.zone_label}</div>
                <div className="text-xs text-muted-foreground">{r.zone}</div>
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  value={r.default_rate_per_kg}
                  onChange={e => update(r.id, 'default_rate_per_kg', Number(e.target.value))}
                  className="h-9"
                />
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  step="0.01"
                  value={r.express_coefficient}
                  onChange={e => update(r.id, 'express_coefficient', Number(e.target.value))}
                  className="h-9"
                />
              </div>
              <div className="col-span-2 flex justify-end">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => save(r)}
                  disabled={savingId === r.id}
                >
                  {savingId === r.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
