import { useAdminRealtime, type LiveStatus } from '@/hooks/useAdminRealtime';
import { cn } from '@/lib/utils';

const LABELS: Record<LiveStatus, string> = {
  connected: 'Live',
  connecting: 'Connexion...',
  disconnected: 'Reconnexion...',
};

export function AdminLiveBadge({ className }: { className?: string }) {
  const status = useAdminRealtime();
  const dotColor =
    status === 'connected' ? 'bg-emerald-500' :
    status === 'connecting' ? 'bg-amber-500' : 'bg-destructive';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground px-2 py-1 rounded-full bg-muted/40',
        className,
      )}
      title={`Realtime: ${LABELS[status]}`}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', dotColor, status === 'connected' && 'animate-pulse')} />
      {LABELS[status]}
    </span>
  );
}
