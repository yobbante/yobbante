import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, Users, Package, Folder, Building2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ClientRow = {
  user_id: string;
  full_name: string | null;
  created_at: string;
  packages_count: number;
  dossiers_count: number;
};

type BusinessRow = {
  id: string;
  legal_name: string;
  ninea: string;
  sector: string;
  admin_full_name: string;
  admin_email: string;
  admin_phone: string;
  status: 'pending' | 'active' | 'suspended' | 'rejected';
  created_at: string;
  activated_at: string | null;
};

const BUSINESS_STATUS = [
  { id: 'pending',   label: 'En attente', icon: Clock,         tone: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  { id: 'active',    label: 'Actif',      icon: CheckCircle2,  tone: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  { id: 'suspended', label: 'Suspendu',   icon: Clock,         tone: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  { id: 'rejected',  label: 'Rejeté',     icon: XCircle,       tone: 'bg-destructive/10 text-destructive border-destructive/20' },
] as const;

export function ClientsTab() {
  const [tab, setTab] = useState<'individuals' | 'business'>('individuals');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Clients</h1>
        <p className="text-sm text-muted-foreground">
          Annuaire des comptes Yobbanté — particuliers et comptes business.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {[
          { id: 'individuals', label: 'Particuliers', icon: Users },
          { id: 'business',    label: 'Business',     icon: Building2 },
        ].map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={cn(
                '-mb-px px-3 py-2 text-sm font-medium border-b-2 transition-colors inline-flex items-center gap-1.5',
                active
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'individuals' ? <IndividualsTable /> : <BusinessTable />}
    </div>
  );
}

function IndividualsTable() {
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-clients'],
    staleTime: 60_000,
    queryFn: async () => {
      const [profilesR, pkgR, dosR] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('packages').select('user_id').limit(2000),
        supabase.from('dossiers').select('user_id').limit(2000),
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
    <div className="space-y-4">
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

function BusinessTable() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-business-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_accounts')
        .select('id, legal_name, ninea, sector, admin_full_name, admin_email, admin_phone, status, created_at, activated_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as BusinessRow[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BusinessRow['status'] }) => {
      const patch: any = { status };
      if (status === 'active') patch.activated_at = new Date().toISOString();
      const { error } = await supabase.from('business_accounts').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Compte business mis à jour');
      qc.invalidateQueries({ queryKey: ['admin-business-accounts'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Échec'),
  });

  const filtered = useMemo(() => {
    if (!q) return data;
    const s = q.toLowerCase();
    return data.filter(b =>
      b.legal_name.toLowerCase().includes(s) ||
      b.ninea.toLowerCase().includes(s) ||
      b.admin_email.toLowerCase().includes(s)
    );
  }, [data, q]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Raison sociale, NINEA, email admin…" className="pl-9 h-9" />
      </div>

      {isLoading ? (
        <div className="space-y-1.5">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Building2 className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">Aucun compte business</p>
          <p className="text-xs text-muted-foreground mt-1">Les inscriptions apparaîtront ici.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-xl bg-card overflow-hidden">
          {filtered.map(b => {
            const tone = BUSINESS_STATUS.find(s => s.id === b.status);
            return (
              <li key={b.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground truncate">{b.legal_name}</span>
                    <span className={cn(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-wide',
                      tone?.tone,
                    )}>
                      {tone?.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">NINEA {b.ninea}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {b.sector} · {b.admin_full_name} · {b.admin_email} · {b.admin_phone}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={b.status}
                    onValueChange={(v) => updateStatus.mutate({ id: b.id, status: v as BusinessRow['status'] })}
                  >
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_STATUS.map(s => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-[11px] text-muted-foreground tabular-nums hidden sm:inline">
                    {new Date(b.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
