import { motion } from 'framer-motion';
import { Package, ArrowRight, Truck, CheckCircle2, Box, Clock, AlertCircle } from 'lucide-react';
import { TimelineEvent } from '@/lib/types';
import { cn } from '@/lib/utils';

const eventIcons: Record<string, React.ReactNode> = {
  WELCOME: <CheckCircle2 className="w-4 h-4" />,
  PACKAGE_RECEIVED: <Package className="w-4 h-4" />,
  PACKAGE_STATUS: <Box className="w-4 h-4" />,
  SHIPMENT_CREATED: <Truck className="w-4 h-4" />,
  SHIPMENT_STATUS: <ArrowRight className="w-4 h-4" />,
  DELIVERED: <CheckCircle2 className="w-4 h-4" />,
  IDLE_ALERT: <Clock className="w-4 h-4" />,
  CONSOLIDATION: <AlertCircle className="w-4 h-4" />,
};

const eventColors: Record<string, string> = {
  WELCOME: 'text-primary bg-primary/10',
  PACKAGE_RECEIVED: 'text-emerald-600 bg-emerald-50',
  PACKAGE_STATUS: 'text-muted-foreground bg-secondary',
  SHIPMENT_CREATED: 'text-primary bg-blue-50',
  SHIPMENT_STATUS: 'text-primary bg-blue-50',
  DELIVERED: 'text-emerald-600 bg-emerald-50',
  IDLE_ALERT: 'text-amber-600 bg-amber-50',
  CONSOLIDATION: 'text-amber-600 bg-amber-50',
};

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function TimelineItem({ event, index }: { event: TimelineEvent; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="group flex gap-4 p-4 rounded-xl hover:bg-secondary/60 transition-colors cursor-pointer"
    >
      <div className={cn(
        'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center',
        eventColors[event.event_type] || 'text-muted-foreground bg-secondary'
      )}>
        {eventIcons[event.event_type] || <Box className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{event.title}</p>
        {event.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{event.description}</p>
        )}
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap self-start mt-0.5">
        {timeAgo(event.created_at)}
      </span>
    </motion.div>
  );
}
