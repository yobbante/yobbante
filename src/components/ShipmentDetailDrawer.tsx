import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { StatusBadge, StatusProgress } from '@/components/StatusBadge';
import { COUNTRY_FLAGS, COUNTRY_NAMES, type Shipment, type Package as Pkg } from '@/lib/types';
import { ArrowRight, Copy, Share2, Package, Clock, Truck } from 'lucide-react';
import { toast } from 'sonner';

interface ShipmentDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipment: Shipment | null;
  packages: Pkg[];
}

const TIMELINE_STEPS = [
  { status: 'PENDING', label: 'Créé', desc: 'Dossier en préparation' },
  { status: 'IN_TRANSIT', label: 'En transit', desc: 'En route vers la destination' },
  { status: 'CUSTOMS', label: 'Douanes', desc: 'Dédouanement en cours' },
  { status: 'DELIVERED', label: 'Livré', desc: 'Remis au destinataire' },
];

const STATUS_ORDER = ['PENDING', 'IN_TRANSIT', 'CUSTOMS', 'DELIVERED'];

export function ShipmentDetailDrawer({ open, onOpenChange, shipment, packages }: ShipmentDetailDrawerProps) {
  if (!shipment) return null;

  const currentIndex = STATUS_ORDER.indexOf(shipment.status);
  const flag = COUNTRY_FLAGS[shipment.origin_country] || '';
  const destFlag = shipment.destination_country === 'SN' ? '🇸🇳' : '🌍';
  const destName = shipment.destination_country === 'SN' ? 'Sénégal' : shipment.destination_country;
  const groupedPackages = packages.filter(p => p.shipment_id === shipment.id);

  const copyTracking = () => {
    const id = shipment.konnekt_id || shipment.id.slice(0, 8).toUpperCase();
    navigator.clipboard.writeText(id);
    toast.success('Numéro de suivi copié');
  };

  const share = async () => {
    const text = `Suivi Yobbanté: ${COUNTRY_NAMES[shipment.origin_country]} → ${destName} | Status: ${shipment.status} | ${shipment.konnekt_id || shipment.id.slice(0, 8).toUpperCase()}`;
    if (navigator.share) {
      await navigator.share({ title: 'Suivi Yobbanté', text });
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Lien copié');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <span>{flag}</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <span>{destFlag}</span>
            <span className="ml-1">{destName}</span>
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <StatusBadge status={shipment.status} />
            {shipment.transport_type && (
              <span className="text-xs text-muted-foreground capitalize">• {shipment.transport_type}</span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pb-8">
          {/* Tracking ID */}
          <div className="flex items-center gap-3 p-4 bg-secondary rounded-xl">
            <Truck className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Numéro de suivi</p>
              <p className="text-sm font-mono font-semibold text-foreground">
                {shipment.konnekt_id || `YBT-${shipment.id.slice(0, 8).toUpperCase()}`}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyTracking}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>

          {/* Live Timeline */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4">Suivi en direct</h4>
            <div className="space-y-0">
              {TIMELINE_STEPS.map((step, i) => {
                const isActive = i === currentIndex;
                const isDone = i < currentIndex;
                const isFuture = i > currentIndex;

                return (
                  <div key={step.status} className="flex gap-3">
                    {/* Vertical line + dot */}
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        isDone ? 'bg-green-500' : isActive ? 'bg-primary ring-4 ring-primary/20' : 'bg-border'
                      }`} />
                      {i < TIMELINE_STEPS.length - 1 && (
                        <div className={`w-0.5 h-12 ${isDone ? 'bg-green-500' : 'bg-border'}`} />
                      )}
                    </div>
                    <div className={`pb-6 ${isFuture ? 'opacity-40' : ''}`}>
                      <p className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-foreground'}`}>
                        {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            {shipment.total_cost != null && (
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-xs text-muted-foreground">Coût total</p>
                <p className="text-xl font-bold text-foreground mt-1">{shipment.total_cost} €</p>
              </div>
            )}
            <div className="bg-secondary rounded-xl p-4">
              <p className="text-xs text-muted-foreground">ETA</p>
              <p className="text-xl font-bold text-foreground mt-1 flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {shipment.eta ? new Date(shipment.eta).toLocaleDateString('fr-FR') : '—'}
              </p>
            </div>
          </div>

          {/* Grouped Packages */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">
              Colis groupés ({groupedPackages.length})
            </h4>
            {groupedPackages.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun colis lié</p>
            ) : (
              <div className="space-y-2">
                {groupedPackages.map(pkg => (
                  <div key={pkg.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
                    <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {pkg.description || 'Colis sans description'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pkg.weight ? `${pkg.weight} kg` : 'Poids inconnu'}
                      </p>
                    </div>
                    <StatusBadge status={pkg.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={share}>
              <Share2 className="w-4 h-4 mr-2" /> Partager
            </Button>
            <Button variant="outline" className="flex-1" onClick={copyTracking}>
              <Copy className="w-4 h-4 mr-2" /> Copier le suivi
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Créé le {new Date(shipment.created_at).toLocaleDateString('fr-FR')}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
