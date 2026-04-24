import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search, Users, Package, Folder } from 'lucide-react';

type ClientRow = {
  user_id: string;
  full_name: string | null;
  created_at: string;
  packages_count: number;
  dossiers_count: number;
};

export function ClientsTab() {
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-clients'],
    queryFn: async () => {
      const [profilesR, pkgR, dosR] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('packages').select('user_id'),
        supabase.from('dossiers').select('user_id'),
      ]);
      const pkgCount = new Map<string, number>();
      const dosCount = new Map<string, number>();
      (pkgR.data || []).forEach(p => pkgCount.set(p.user_id, (pkgCount.get(p.user_id) || 0) + 1));
      (dosR.data || []).forEach(d => dosCount.set(d.user_id, (dosCount.get(d.user_id) || 0) + 1));
      const rows: ClientRow[] = (profilesR.data || []).map(p => ({
        user_id: p.user_id,
        full_name: p.full_name,
        created_at: p.created_at,
        packages_count: pkgCount.get(p.user_id) || 0,
        dossiers_count: dosCount.get(p.user_id) || 0,
      }));
      return rows;
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!q) return data;
    const s = q.toLowerCase();
    return data.filter(r => (r.full_name || '').toLowerCase().includes(s) || r.user_id.toLowerCase().includes(s));
  }, [data, q]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Clients</h1>
        <p className="text-sm text-muted-foreground">Annuaire de tous les comptes Yobbanté avec leur volume d'activité.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Nom ou ID utilisateur…" className="pl-9 h-9" />
      </div>

      {isLoading ? (
        <div className="space-y-1.5">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Users className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">Aucun client</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Client</th>
                <th className="text-left font-medium px-4 py-2.5 hidden md:table-cell">ID</th>
                <th className="text-left font-medium px-4 py-2.5">Colis</th>
                <th className="text-left font-medium px-4 py-2.5">Dossiers</th>
                <th className="text-left font-medium px-4 py-2.5 hidden md:table-cell">Inscrit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(r => (
                <tr key={r.user_id} className="hover:bg-secondary/30">
                  <td className="px-4 py-2.5 text-foreground font-medium">{r.full_name || <span className="text-muted-foreground italic">Sans nom</span>}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground hidden md:table-cell">{r.user_id.slice(0, 8)}…</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1 text-xs text-foreground"><Package className="w-3 h-3 text-muted-foreground" />{r.packages_count}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1 text-xs text-foreground"><Folder className="w-3 h-3 text-muted-foreground" />{r.dossiers_count}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums hidden md:table-cell">
                    {new Date(r.created_at).toLocaleDateString('fr-FR')}
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
