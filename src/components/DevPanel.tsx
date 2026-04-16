import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Package, Truck, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePackages } from '@/hooks/usePackages';
import { useShipments } from '@/hooks/useShipments';
import { useTimeline } from '@/hooks/useTimeline';

export function DevPanel() {
  const [open, setOpen] = useState(false);
  const { createPackage, updateStatus: updatePkgStatus, packages } = usePackages();
  const { createShipment, updateStatus: updateShipStatus, shipments } = useShipments();
  const { addEvent } = useTimeline();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      setOpen(v => !v);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const simulatePackageArrival = async () => {
    await createPackage.mutateAsync({
      warehouse_country: (['FR', 'CN', 'US'] as const)[Math.floor(Math.random() * 3)],
      description: `Test Package ${Date.now().toString(36)}`,
      weight: Math.round(Math.random() * 10 * 100) / 100,
    });
    await addEvent.mutateAsync({
      event_type: 'PACKAGE_RECEIVED',
      title: 'Package received 📦',
      description: 'A new package arrived at your warehouse',
    });
  };

  const simulateShipment = async () => {
    const readyPkgs = packages.filter(p => !p.shipment_id && p.status !== 'DELIVERED');
    await createShipment.mutateAsync({
      origin_country: 'FR',
      destination_country: 'SN',
      transport_type: 'air',
      package_ids: readyPkgs.slice(0, 3).map(p => p.id),
    });
    await addEvent.mutateAsync({
      event_type: 'SHIPMENT_CREATED',
      title: 'Shipment created ✈️',
      description: 'Your packages are on their way!',
    });
  };

  const simulateDelivery = async () => {
    const active = shipments.find(s => s.status !== 'DELIVERED');
    if (active) {
      await updateShipStatus.mutateAsync({ id: active.id, status: 'DELIVERED' });
      await addEvent.mutateAsync({
        event_type: 'DELIVERED',
        title: 'Delivered ✅',
        description: 'Your shipment has been delivered!',
        related_shipment_id: active.id,
      });
    }
  };

  const advancePackageStatus = async () => {
    const statusOrder = ['CREATED', 'RECEIVED', 'IN_STORAGE', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED'] as const;
    const pkg = packages.find(p => p.status !== 'DELIVERED');
    if (pkg) {
      const idx = statusOrder.indexOf(pkg.status);
      if (idx < statusOrder.length - 1) {
        await updatePkgStatus.mutateAsync({ id: pkg.id, status: statusOrder[idx + 1] });
        await addEvent.mutateAsync({
          event_type: 'PACKAGE_STATUS',
          title: `Package → ${statusOrder[idx + 1].replace(/_/g, ' ')}`,
          description: pkg.description || 'Package status updated',
          related_package_id: pkg.id,
        });
      }
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-20 right-4 z-[100] w-72 bg-card border border-border/50 rounded-lg p-4 shadow-2xl md:bottom-4"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-foreground">Dev Panel</span>
          </div>
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start border-border/50" onClick={simulatePackageArrival}>
            <Package className="w-3.5 h-3.5 mr-2" /> Simulate Package Arrival
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start border-border/50" onClick={advancePackageStatus}>
            <Zap className="w-3.5 h-3.5 mr-2" /> Advance Package Status
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start border-border/50" onClick={simulateShipment}>
            <Truck className="w-3.5 h-3.5 mr-2" /> Simulate Shipment
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start border-border/50" onClick={simulateDelivery}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Simulate Delivery
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 text-center">Ctrl+Shift+D to toggle</p>
      </motion.div>
    </AnimatePresence>
  );
}
