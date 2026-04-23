import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Search, ChevronRight, Inbox } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { COUNTRY_FLAGS, DOSSIER_STATUS_LABELS, type Dossier } from '@/lib/types';

const TYPE_FILTERS = [
  { id: 'all',      label: 'Tous' },
  { id: 'send',     label: 'Expédier' },
  { id: 'receive',  label: 'Recevoir' },
  { id: 'sourcing', label: 'Sourcing' },
] as const;

type TypeFilter = typeof TYPE_FILTERS[number]['id'];

function getKind(d: Dossier): TypeFilter {
  if (d.needs_sourcing) return 'sourcing';
  if (d.app_source === 'expedier') return 'send';
  return 'receive';
}

export function RequestsTab() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<TypeFilter>('all');

  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['admin-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as Dossier[];
    },
  });

  const filtered = useMemo(() => {
    return dossiers.filter(d => {
      if (kind !== 'all' && getKind(d) !== kind) return false;
      if (q) {
        const s = q.toLowerCase();
        return (
          d.reference.toLowerCase().includes(s) ||
          d.product_description.toLowerCase().includes(s) ||
          (d.contact_email || '').toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [dossiers, q, kind]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Demandes clients</h1>
        <p className="text-sm text-muted-foreground">Inbox unifié — expédition, réception, sourcing.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Réf, produit, email…" className="pl-9 h-9" />
        </div>
        <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setKind(f.id)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
                kind === f.id ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Inbox className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">Aucune demande</p>
          <p className="text-xs text-muted-foreground mt-1">Ajustez vos filtres.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-xl bg-card overflow-hidden">
          {filtered.map(d => {
            const k = getKind(d);
            return (
              <li key={d.id}>
                <button
                  onClick={() => navigate(`/app/dossier/${d.id}`)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-secondary/40 transition-colors"
                >
                  <span className="text-lg">{COUNTRY_FLAGS[d.origin_country] || '🌍'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="font-mono text-foreground font-semibold">{d.reference}</span>
                      <span className="px-1.5 py-0.5 rounded bg-secondary text-muted-foreground uppercase tracking-wide">
                        {k === 'send' ? 'Expédier' : k === 'sourcing' ? 'Sourcing' : 'Recevoir'}
                      </span>
                      <span className="text-muted-foreground">· {DOSSIER_STATUS_LABELS[d.status]}</span>
                    </div>
                    <p className="text-sm text-foreground truncate mt-0.5">{d.product_description}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums hidden sm:inline">
                    {new Date(d.created_at).toLocaleDateString('fr-FR')}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
