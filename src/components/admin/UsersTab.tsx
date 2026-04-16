import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ShieldCheck, Shield, User as UserIcon, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type AppRole = 'admin' | 'staff' | 'user';
type AdminUser = {
  id: string; email: string | null; created_at: string;
  last_sign_in_at: string | null; full_name: string | null; roles: AppRole[];
};

const ROLE_META: Record<AppRole, { label: string; Icon: typeof ShieldCheck; cls: string }> = {
  admin: { label: 'Admin', Icon: ShieldCheck, cls: 'bg-foreground text-background' },
  staff: { label: 'Staff', Icon: Shield, cls: 'bg-primary/10 text-primary' },
  user:  { label: 'User',  Icon: UserIcon, cls: 'bg-secondary text-foreground' },
};

export function UsersTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-users', { body: { action: 'list' } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.users || []) as AdminUser[];
    },
  });

  const mutateRole = useMutation({
    mutationFn: async (input: { user_id: string; role: AppRole; op: 'add' | 'remove' }) => {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: input.op === 'add' ? 'add_role' : 'remove_role', user_id: input.user_id, role: input.role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(vars.op === 'add' ? `Rôle ${vars.role} ajouté` : `Rôle ${vars.role} retiré`);
    },
    onError: (e: Error) => toast.error(e.message || 'Erreur'),
  });

  const filtered = users.filter(u => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (u.email || '').toLowerCase().includes(s) || (u.full_name || '').toLowerCase().includes(s);
  });

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm font-semibold text-destructive">Impossible de charger les utilisateurs</p>
        <p className="text-xs text-muted-foreground mt-1">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Email ou nom…" className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-semibold text-foreground">Aucun utilisateur trouvé</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => {
            const hasAdmin = u.roles.includes('admin');
            const hasStaff = u.roles.includes('staff');
            return (
              <div key={u.id} className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">{u.full_name || u.email}</p>
                    {u.roles.map(r => {
                      const m = ROLE_META[r];
                      return (
                        <span key={r} className={cn('inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full', m.cls)}>
                          <m.Icon className="w-3 h-3" /> {m.label}
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{u.email}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Inscrit le {new Date(u.created_at).toLocaleDateString('fr-FR')}
                    {u.last_sign_in_at && ` · Dernière connexion ${new Date(u.last_sign_in_at).toLocaleDateString('fr-FR')}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <RoleToggle label="Staff" active={hasStaff} disabled={mutateRole.isPending}
                    onAdd={() => mutateRole.mutate({ user_id: u.id, role: 'staff', op: 'add' })}
                    onRemove={() => mutateRole.mutate({ user_id: u.id, role: 'staff', op: 'remove' })}
                  />
                  <RoleToggle label="Admin" active={hasAdmin} disabled={mutateRole.isPending}
                    onAdd={() => mutateRole.mutate({ user_id: u.id, role: 'admin', op: 'add' })}
                    onRemove={() => mutateRole.mutate({ user_id: u.id, role: 'admin', op: 'remove' })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RoleToggle({ label, active, disabled, onAdd, onRemove }: {
  label: string; active: boolean; disabled: boolean; onAdd: () => void; onRemove: () => void;
}) {
  return active ? (
    <Button size="sm" variant="outline" disabled={disabled} onClick={onRemove} className="h-8">
      <X className="w-3.5 h-3.5 mr-1" /> Retirer {label}
    </Button>
  ) : (
    <Button size="sm" disabled={disabled} onClick={onAdd} className="h-8">
      <Plus className="w-3.5 h-3.5 mr-1" /> {label}
    </Button>
  );
}
