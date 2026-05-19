import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search, MapPin, Package, Truck, CheckCircle2, AlertCircle, Box } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TimelineEvent } from '@/lib/types';
import { formatEventLabel } from '@/lib/statusLabels';

const ICONS: Record<string, React.ReactNode> = {
  WELCOME: <CheckCircle2 className="w-3.5 h-3.5" />,
  PACKAGE_RECEIVED: <Package className="w-3.5 h-3.5" />,
  PACKAGE_STATUS: <Box className="w-3.5 h-3.5" />,
  SHIPMENT_CREATED: <Truck className="w-3.5 h-3.5" />,
  SHIPMENT_STATUS: <Truck className="w-3.5 h-3.5" />,
  DELIVERED: <CheckCircle2 className="w-3.5 h-3.5" />,
  IDLE_ALERT: <AlertCircle className="w-3.5 h-3.5" />,
};

const TONES: Record<string, string> = {
  WELCOME: 'text-primary bg-primary/10',
  PACKAGE_RECEIVED: 'text-emerald-500 bg-emerald-500/10',
  PACKAGE_STATUS: 'text-muted-foreground bg-secondary',
  SHIPMENT_CREATED: 'text-blue-500 bg-blue-500/10',
  SHIPMENT_STATUS: 'text-blue-500 bg-blue-500/10',
  DELIVERED: 'text-emerald-500 bg-emerald-500/10',
  IDLE_ALERT: 'text-amber-500 bg-amber-500/10',
};

const FILTERS: { id: string; label: string }[] = [
  { id: 'all',      label: 'Tous' },
  { id: 'package',  label: 'Colis' },
  { id: 'shipment', label: 'Expéditions' },
  { id: 'alert',    label: 'Alertes' },
];

export function TrackingTab() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['admin-timeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timeline_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as TimelineEvent[];
    },
  });

  const filtered = useMemo(() => {
    let rows = events;
    if (filter === 'package')  rows = rows.filter(e => e.event_type.startsWith('PACKAGE'));
    if (filter === 'shipment') rows = rows.filter(e => e.event_type.startsWith('SHIPMENT') || e.event_type === 'DELIVERED');
    if (filter === 'alert')    rows = rows.filter(e => e.event_type.includes('ALERT') || e.event_type === 'CONSOLIDATION');
    if (q) {
      const s = q.toLowerCase();
      rows = rows.filter(e =>
        e.title.toLowerCase().includes(s) ||
        (e.description || '').toLowerCase().includes(s) ||
        e.event_type.toLowerCase().includes(s)
      );
    }
    return rows;
  }, [events, filter, q]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Tracking global</h1>
        <p className="text-sm text-muted-foreground">Timeline unifiée — tous les events plateforme en temps réel.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Titre, description, type…" className="pl-9 h-9" />
        </div>
        <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'px-3 py-1.5 text-xs rounded-md transition-colors',
                filter === f.id ? 'bg-background text-foreground font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-1.5">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <MapPin className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">Aucun événement</p>
          <p className="text-xs text-muted-foreground mt-1">Modifie tes filtres ou attends de nouveaux events.</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-card divide-y divide-border">
          {filtered.map(ev => (
            <div key={ev.id} className="flex gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors">
              <div className={cn('flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center', TONES[ev.event_type] || 'text-muted-foreground bg-secondary')}>
                {ICONS[ev.event_type] || <Box className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">{formatEventLabel(ev.event_type)}</span>
                </div>
                {ev.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{ev.description}</p>}
              </div>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap tabular-nums self-start mt-1">
                {new Date(ev.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
