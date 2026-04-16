import { PackageStatus, ShipmentStatus, PACKAGE_STATUS_ORDER, SHIPMENT_STATUS_ORDER } from '@/lib/types';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  CREATED: 'bg-muted text-muted-foreground',
  RECEIVED: 'bg-blue-50 text-blue-600',
  IN_STORAGE: 'bg-amber-50 text-amber-600',
  READY_TO_SHIP: 'bg-emerald-50 text-emerald-600',
  SHIPPED: 'bg-blue-50 text-blue-600',
  DELIVERED: 'bg-emerald-50 text-emerald-600',
  PENDING: 'bg-muted text-muted-foreground',
  IN_TRANSIT: 'bg-blue-50 text-blue-600',
  CUSTOMS: 'bg-amber-50 text-amber-600',
};

export function StatusBadge({ status, className }: { status: PackageStatus | ShipmentStatus; className?: string }) {
  const label = status.replace(/_/g, ' ');
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase',
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
    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
      <div
        className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
