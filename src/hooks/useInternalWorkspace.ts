import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type TaskStatus = 'a_faire' | 'en_cours' | 'termine';
export type TaskPriority = 'basse' | 'normale' | 'haute';

export type InternalTask = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  assignee_id: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Partenaire = {
  id: string;
  chantier: string;
  zone_code: string | null;
  zone_label: string | null;
  ville: string | null;
  nom: string;
  contact: string | null;
  specialite: string | null;
  statut: string;
  tarif_obtenu: string | null;
  tarif_montant: number | null;
  devise: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ActivityRow = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  label: string | null;
  created_at: string;
};

/** Tâches internes — l'RLS filtre déjà : la stagiaire ne voit que les siennes. */
export function useInternalTasks() {
  return useQuery({
    queryKey: ['internal-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('internal_tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as InternalTask[];
    },
  });
}

export function useTaskComments(taskId: string | null) {
  return useQuery({
    queryKey: ['internal-task-comments', taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('internal_task_comments')
        .select('*')
        .eq('task_id', taskId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInternalTaskMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['internal-tasks'] });
    qc.invalidateQueries({ queryKey: ['staff-activity'] });
  };

  const createTask = useMutation({
    mutationFn: async (input: Partial<InternalTask>) => {
      const { error } = await supabase.from('internal_tasks').insert({
        title: input.title ?? 'Nouvelle tâche',
        description: input.description ?? null,
        due_date: input.due_date || null,
        priority: input.priority ?? 'normale',
        status: input.status ?? 'a_faire',
        assignee_id: input.assignee_id ?? null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<InternalTask> & { id: string }) => {
      const { error } = await supabase.from('internal_tasks').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const addComment = useMutation({
    mutationFn: async ({ taskId, body, label }: { taskId: string; body: string; label?: string }) => {
      const { error } = await supabase.from('internal_task_comments').insert({
        task_id: taskId,
        author_id: user?.id ?? null,
        author_label: label ?? null,
        body,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['internal-task-comments', v.taskId] });
      qc.invalidateQueries({ queryKey: ['staff-activity'] });
    },
  });

  return { createTask, updateTask, addComment };
}

export function usePartenaires() {
  return useQuery({
    queryKey: ['partenaires-logistique'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partenaires_logistique')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Partenaire[];
    },
  });
}

export function usePartenaireMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['partenaires-logistique'] });
    qc.invalidateQueries({ queryKey: ['staff-activity'] });
  };

  const savePartenaire = useMutation({
    mutationFn: async (input: Partial<Partenaire> & { id?: string }) => {
      const payload = {
        chantier: input.chantier ?? 'aerien',
        zone_code: input.zone_code ?? null,
        zone_label: input.zone_label ?? null,
        ville: input.ville ?? null,
        nom: input.nom ?? 'Sans nom',
        contact: input.contact ?? null,
        specialite: input.specialite ?? null,
        statut: input.statut ?? 'a_contacter',
        tarif_obtenu: input.tarif_obtenu ?? null,
        tarif_montant: input.tarif_montant ?? null,
        devise: input.devise ?? 'XOF',
        notes: input.notes ?? null,
        updated_by: user?.id ?? null,
      };
      if (input.id) {
        const { error } = await supabase.from('partenaires_logistique').update(payload).eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('partenaires_logistique')
          .insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  return { savePartenaire };
}

export function useStaffActivity(limit = 80) {
  return useQuery({
    queryKey: ['staff-activity', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
    refetchInterval: 60_000,
  });
}

export type InternalOverview = {
  dossiers_by_mode: Record<string, number>;
  fret_by_status: Record<string, number>;
  gp_actifs: number;
  gp_total: number;
};

export function useInternalOverview() {
  return useQuery({
    queryKey: ['internal-activity-overview'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_internal_activity_overview');
      if (error) throw error;
      return data as unknown as InternalOverview;
    },
    refetchInterval: 120_000,
  });
}

/** Membres internes (stagiaires partenariats) + présence basée sur leur dernière action réelle. */
export function useInternalMembers() {
  return useQuery({
    queryKey: ['internal-members'],
    queryFn: async () => {
      const { data: roleRows, error } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'stagiaire_partenariats');
      if (error) throw error;
      const ids = (roleRows ?? []).map(r => r.user_id);
      if (ids.length === 0) return [] as { user_id: string; name: string; last_activity: string | null }[];

      const [{ data: profiles }, { data: acts }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids),
        supabase.from('staff_activity_log').select('user_id, created_at').in('user_id', ids)
          .order('created_at', { ascending: false }).limit(500),
      ]);

      const last = new Map<string, string>();
      (acts ?? []).forEach(a => {
        if (a.user_id && !last.has(a.user_id)) last.set(a.user_id, a.created_at);
      });

      return ids.map(id => {
        const p = (profiles ?? []).find(x => x.user_id === id);
        return {
          user_id: id,
          name: p?.full_name || p?.email || 'Membre interne',
          last_activity: last.get(id) ?? null,
        };
      });
    },
    refetchInterval: 60_000,
  });
}
