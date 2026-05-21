import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Transporteur } from '@/hooks/useTransporteurs';

export function GpRatesDialog({
  gp, open, onClose, onSaved,
}: { gp: Transporteur; open: boolean; onClose: () => void; onSaved?: () => void }) {
  const [defaultRate, setDefaultRate] = useState<string>('');
  const [routes, setRoutes] = useState<Array<{ key: string; rate: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDefaultRate(gp.default_rate_per_kg != null ? String(gp.default_rate_per_kg) : '');
    const r = gp.default_routes ?? {};
    setRoutes(Object.entries(r).map(([key, rate]) => ({ key, rate: String(rate) })));
  }, [open, gp]);

  async function save() {
    setSaving(true);
    try {
      const routesObj: Record<string, number> = {};
      for (const r of routes) {
        const k = r.key.trim().toLowerCase();
        const v = Number(r.rate);
        if (k && v > 0) routesObj[k] = v;
      }
      const { error } = await supabase
        .from('transporteurs' as any)
        .update({
          default_rate_per_kg: defaultRate ? Number(defaultRate) : null,
          default_routes: routesObj,
        })
        .eq('id', gp.id);
      if (error) throw error;
      toast.success('Tarifs enregistrés');
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error('Échec : ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tarifs GP — {gp.prenom ?? ''} {gp.nom}</DialogTitle>
          <DialogDescription>Tarif par défaut au kilo et tarifs par route.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tarif par défaut (XOF/kg)</Label>
            <Input
              type="number"
              min={0}
              value={defaultRate}
              onChange={(e) => setDefaultRate(e.target.value)}
              placeholder="Ex : 800"
            />
          </div>

          <div className="space-y-2">
            <Label>Tarifs par route</Label>
            <p className="text-[11px] text-muted-foreground">
              Clé route au format <code>origine-destination</code> (ex : <code>paris-dakar</code>)
            </p>
            {routes.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={r.key}
                  onChange={(e) => setRoutes(rs => rs.map((x, j) => j === i ? { ...x, key: e.target.value } : x))}
                  placeholder="paris-dakar"
                  className="flex-1"
                />
                <Input
                  type="number"
                  min={0}
                  value={r.rate}
                  onChange={(e) => setRoutes(rs => rs.map((x, j) => j === i ? { ...x, rate: e.target.value } : x))}
                  placeholder="XOF/kg"
                  className="w-28"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setRoutes(rs => rs.filter((_, j) => j !== i))}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRoutes(rs => [...rs, { key: '', rate: '' }])}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter une route
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={save} disabled={saving} style={{ background: '#F5C518', color: '#000' }}>
            {saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
