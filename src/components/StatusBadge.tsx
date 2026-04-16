import { PackageStatus, ShipmentStatus, PACKAGE_STATUS_ORDER, SHIPMENT_STATUS_ORDER } from '@/lib/types';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  CREATED: 'bg-muted text-muted-foreground',
  RECEIVED: 'bg-primary/15 text-primary',
  IN_STORAGE: 'bg-amber-500/15 text-amber-400',
  READY_TO_SHIP: 'bg-emerald-500/15 text-emerald-400',
  SHIPPED: 'bg-primary/15 text-primary',
  DELIVERED: 'bg-emerald-500/15 text-emerald-400',
  PENDING: 'bg-muted text-muted-foreground',
  IN_TRANSIT: 'bg-primary/15 text-primary',
  CUSTOMS: 'bg-amber-500/15 text-amber-400',
};

export function StatusBadge({ status, className }: { status: PackageStatus | ShipmentStatus; className?: string }) {
  const label = status.replace(/_/g, ' ');
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase',
      statusColors[status] || 'bg-muted text-muted-foreground',
      className
    )}>
      {label}
    </span>
  );
}

export function StatusProgress({ status, type }: { status: PackageStatus | ShipmentStatus; type: 'package' | 'shipment' }) {
  const order = type === 'package' ? PACKAGE_STATUS_ORDER : SHIPMENT_STATUS_ORDER;
  const currentIndex = order.indexOf(status as any);
  const progress = ((currentIndex + 1) / order.length) * 100;

  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
