import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock, Loader2, Package as PackageIcon, ArrowRight } from 'lucide-react';
import { COUNTRY_FLAGS, COUNTRY_NAMES, type Package, type WarehouseCountry } from '@/lib/types';
import { useShipments } from '@/hooks/useShipments';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';

interface IdleShipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Packages idle >48h that the user can ship in one click. */
  idlePackages: Package[];
}

/**
 * One-click confirmation for the 48h idle prompt.
 * Pre-selects every idle package in the user's most-stocked hub and
 * creates a single manual shipment toward their default delivery country.
 * No multi-step picker — just a clear summary + a confirm button.
 */
export function IdleShipDialog({ open, onOpenChange, idlePackages }: IdleShipDialogProps) {
  const { createShipment } = useShipments();
  const { profile } = useProfile();
  const [submitting, setSubmitting] = useState(false);

  // Pick the warehouse with the most idle packages — that's the obvious route.
  const route = useMemo(() => {
    if (idlePackages.length === 0) return null;
    const counts = idlePackages.reduce<Record<WarehouseCountry, Package[]>>((acc, p) => {
      const key = p.warehouse_country;
      (acc[key] ||= []).push(p);
      return acc;
    }, {} as Record<WarehouseCountry, Package[]>);
    const [origin, pkgs] = Object.entries(counts)
      .sort(([, a], [, b]) => b.length - a.length)[0] as [WarehouseCountry, Package[]];
    return { origin, pkgs };
  }, [idlePackages]);

  const destination = (profile?.default_delivery_country || 'SN').toUpperCase();
  const totalWeight = route?.pkgs.reduce((sum, p) => sum + (p.weight || 0.5), 0) ?? 0;

  const handleConfirm = async () => {
    if (!route) return;
    setSubmitting(true);
    try {
      await createShipment.mutateAsync({
        origin_country: route.origin as 'FR' | 'CN' | 'US',
        destination_country: destination,
        transport_type: 'standard',
        package_ids: route.pkgs.map(p => p.id),
        manual_request: true,
        client_note: `Expédition automatique : ${route.pkgs.length} colis en stock depuis +48h.`,
      });
      toast.success('Expédition lancée 🚀', {
        description: `${route.pkgs.length} colis · ${COUNTRY_NAMES[route.origin]} → ${destination}`,
      });
      onOpenChange(false);
    } catch (e) {
      toast.error('Impossible de lancer l\'expédition');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
            <Clock className="w-5 h-5" />
          </div>
          <DialogTitle>Expédier maintenant ?</DialogTitle>
          <DialogDescription>
            {route
              ? `${route.pkgs.length} colis attendent depuis plus de 48h. Un seul clic et on les met en route.`
              : 'Aucun colis n\'attend depuis plus de 48h.'}
          </DialogDescription>
        </DialogHeader>

        {route && (
          <div className="space-y-4">
            {/* Route summary */}
            <div className="rounded-xl border border-border bg-secondary/40 p-4">
              <div className="flex items-center justify-center gap-3 text-sm font-semibold text-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-lg leading-none">{COUNTRY_FLAGS[route.origin]}</span>
                  {COUNTRY_NAMES[route.origin]}
                </span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-lg leading-none">🇸🇳</span>
                  {destination}
                </span>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-2">
                {route.pkgs.length} colis · ~{totalWeight.toFixed(1)} kg
              </p>
            </div>

            {/* Compact package list */}
            <ul className="space-y-1.5 max-h-40 overflow-y-auto">
              {route.pkgs.map(p => (
                <li key={p.id} className="flex items-center gap-2.5 text-xs text-muted-foreground px-1">
                  <PackageIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate flex-1">{p.description || 'Colis sans description'}</span>
                  {p.weight && <span className="shrink-0">{p.weight} kg</span>}
                </li>
              ))}
            </ul>

            <p className="text-[11px] text-muted-foreground text-center">
              Sans frais d'annulation. Un expert valide votre départ sous 24h.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Plus tard
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!route || submitting}
            className="min-w-32"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Envoi…
              </>
            ) : (
              <>Confirmer l'expédition</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
