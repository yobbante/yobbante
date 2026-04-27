import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TimelineItem } from '@/components/TimelineItem';
import { useTimeline } from '@/hooks/useTimeline';
import { Package as PackageIcon } from 'lucide-react';
import { COUNTRY_FLAGS, type Package } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pkg: Package | null;
}

/**
 * Dialog showing the live timeline filtered for one specific package.
 * Streams from useTimeline (Realtime channel already subscribed),
 * so new events from server-side triggers appear instantly.
 */
export function PackageTimelineDialog({ open, onOpenChange, pkg }: Props) {
  const { events, isLoading } = useTimeline();

  const filtered = useMemo(() => {
    if (!pkg) return [];
    return events.filter(
      (e) =>
        e.related_package_id === pkg.id ||
        (e.metadata as { package_id?: string } | null)?.package_id === pkg.id,
    );
  }, [events, pkg]);

  if (!pkg) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageIcon className="w-4 h-4 text-primary" />
            <span>{COUNTRY_FLAGS[pkg.warehouse_country]} {pkg.description || 'Colis sans description'}</span>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 pt-1">
            <StatusBadge status={pkg.status} />
            {pkg.weight && <span className="text-xs">· {pkg.weight} kg</span>}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <PackageIcon className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">Aucun événement pour ce colis</p>
              <p className="text-xs text-muted-foreground mt-1">
                Les mouvements apparaîtront ici en temps réel.
              </p>
            </div>
          ) : (
            <div className="space-y-1 -mx-2 py-2">
              {filtered.map((event, i) => (
                <TimelineItem key={event.id} event={event} index={i} />
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
