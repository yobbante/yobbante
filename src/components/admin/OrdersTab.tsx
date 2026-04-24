import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Search, Package as PkgIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { COUNTRY_FLAGS, type Package } from '@/lib/types';
import { OrderDetailDrawer, type OrderRowRef } from './OrderDetailDrawer';

type Shipment = {
  id: string;
  user_id: string;
  status: string;
  origin_country: string;
  destination_country: string;
  transport_type: string | null;
  eta: string | null;
  created_at: string;
};

const STATUS_TONE: Record<string, string> = {
  PENDING:        'bg-muted text-muted-foreground',
  CREATED:        'bg-muted text-muted-foreground',
  RECEIVED:       'bg-blue-500/10 text-blue-500',
  IN_STORAGE:     'bg-amber-500/10 text-amber-500',
  READY_TO_SHIP:  'bg-emerald-500/10 text-emerald-500',
  SHIPPED:        'bg-blue-500/10 text-blue-500',
  IN_TRANSIT:     'bg-blue-500/10 text-blue-500',
  CUSTOMS:        'bg-amber-500/10 text-amber-500',
  DELIVERED:      'bg-emerald-500/10 text-emerald-500',
};

export function OrdersTab() {
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      const [pkgR, shipR] = await Promise.all([
        supabase.from('packages').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('shipments').select('*').order('created_at', { ascending: false }).limit(200),
      ]);
      return {
        packages: (pkgR.data || []) as Package[],
        shipments: (shipR.data || []) as Shipment[],
      };
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const pkg = data.packages.map(p => ({
      kind: 'package' as const,
      id: p.id,
      ref: p.id.slice(0, 8),
      hub: p.warehouse_country as string,
      status: p.status,
      transport: '—',
      eta: null as string | null,
      created_at: p.created_at,
      label: p.description || 'Colis',
    }));
    const ship = data.shipments.map(s => ({
      kind: 'shipment' as const,
      id: s.id,
      ref: s.id.slice(0, 8),
      hub: s.origin_country,
      status: s.status,
      transport: s.transport_type || '—',
      eta: s.eta,
      created_at: s.created_at,
      label: `${s.origin_country} → ${s.destination_country}`,
    }));
    const merged = [...ship, ...pkg].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    if (!q) return merged;
    const s = q.toLowerCase();
    return merged.filter(r => r.ref.toLowerCase().includes(s) || r.label.toLowerCase().includes(s) || r.hub.toLowerCase().includes(s));
  }, [data, q]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Commandes & Colis</h1>
        <p className="text-sm text-muted-foreground">Vue dense de toutes les unités physiques en circulation.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="ID, hub, libellé…" className="pl-9 h-9" />
      </div>

      {isLoading ? (
        <div className="space-y-1.5">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <PkgIcon className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">Aucune commande</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">ID</th>
                <th className="text-left font-medium px-4 py-2.5">Type</th>
                <th className="text-left font-medium px-4 py-2.5">Hub</th>
                <th className="text-left font-medium px-4 py-2.5">Libellé</th>
                <th className="text-left font-medium px-4 py-2.5">Statut</th>
                <th className="text-left font-medium px-4 py-2.5 hidden md:table-cell">Transport</th>
                <th className="text-left font-medium px-4 py-2.5 hidden md:table-cell">ETA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(r => (
                <tr key={`${r.kind}-${r.id}`} className="hover:bg-secondary/30">
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground">{r.ref}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground capitalize">{r.kind}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-base mr-1">{COUNTRY_FLAGS[r.hub as keyof typeof COUNTRY_FLAGS] || '🌍'}</span>
                    <span className="text-xs text-muted-foreground">{r.hub}</span>
                  </td>
                  <td className="px-4 py-2.5 text-foreground truncate max-w-[260px]">{r.label}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide', STATUS_TONE[r.status] || 'bg-muted text-muted-foreground')}>
                      {r.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{r.transport}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums hidden md:table-cell">
                    {r.eta ? new Date(r.eta).toLocaleDateString('fr-FR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
