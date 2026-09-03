import { useState } from 'react';
import { Plus, MessageSquare, CalendarDays, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import {
  useInternalTasks, useInternalTaskMutations, useTaskComments, useInternalMembers,
  type InternalTask,
} from '@/hooks/useInternalWorkspace';

const STATUS_LABEL: Record<string, string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  termine: 'Terminé',
};
const STATUS_CLS: Record<string, string> = {
  a_faire: 'bg-muted text-muted-foreground',
  en_cours: 'bg-primary/10 text-primary',
  termine: 'bg-emerald-500/10 text-emerald-600',
};
const PRIORITY_LABEL: Record<string, string> = {
  basse: 'Basse', normale: 'Normale', haute: 'Haute',
};

function isLate(t: InternalTask) {
  return !!t.due_date && t.status !== 'termine' && new Date(t.due_date) < new Date(new Date().toDateString());
}

export function TasksPanel({ isAdmin }: { isAdmin: boolean }) {
  const { data: tasks = [], isLoading } = useInternalTasks();
  const { data: members = [] } = useInternalMembers();
  const { createTask, updateTask } = useInternalTaskMutations();
  const [openTask, setOpenTask] = useState<InternalTask | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: '', description: '', due_date: '', priority: 'normale', assignee_id: '' });

  const counts = {
    a_faire: tasks.filter(t => t.status === 'a_faire').length,
    en_cours: tasks.filter(t => t.status === 'en_cours').length,
    termine: tasks.filter(t => t.status === 'termine').length,
    retard: tasks.filter(isLate).length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {([['À faire', counts.a_faire], ['En cours', counts.en_cours], ['Terminées', counts.termine], ['En retard', counts.retard]] as const).map(([label, n]) => (
          <Card key={label} className="p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold text-foreground">{n}</p>
          </Card>
        ))}
      </div>

      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nouvelle tâche
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">Aucune tâche pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map(t => (
            <button
              key={t.id}
              onClick={() => setOpenTask(t)}
              className="w-full text-left rounded-lg border border-border p-3 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                  {t.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.description}</p>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge variant="secondary" className={STATUS_CLS[t.status]}>{STATUS_LABEL[t.status] ?? t.status}</Badge>
                    <span className="text-[11px] text-muted-foreground">Priorité {PRIORITY_LABEL[t.priority] ?? t.priority}</span>
                    {t.due_date && (
                      <span className={`text-[11px] inline-flex items-center gap-1 ${isLate(t) ? 'text-destructive' : 'text-muted-foreground'}`}>
                        <CalendarDays className="w-3 h-3" />
                        {new Date(t.due_date).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>
                </div>
                <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Création (admin) */}
      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Nouvelle tâche</SheetTitle></SheetHeader>
          <div className="space-y-3 mt-4">
            <Input placeholder="Titre" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
            <Textarea placeholder="Description" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
            <Input type="date" value={draft.due_date} onChange={e => setDraft({ ...draft, due_date: e.target.value })} />
            <Select value={draft.priority} onValueChange={v => setDraft({ ...draft, priority: v })}>
              <SelectTrigger><SelectValue placeholder="Priorité" /></SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={draft.assignee_id} onValueChange={v => setDraft({ ...draft, assignee_id: v })}>
              <SelectTrigger><SelectValue placeholder="Assigner à" /></SelectTrigger>
              <SelectContent>
                {members.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              disabled={createTask.isPending || !draft.title.trim()}
              onClick={async () => {
                try {
                  await createTask.mutateAsync({
                    title: draft.title.trim(),
                    description: draft.description || null,
                    due_date: draft.due_date || null,
                    priority: draft.priority,
                    assignee_id: draft.assignee_id || null,
                  });
                  toast({ title: 'Tâche créée' });
                  setDraft({ title: '', description: '', due_date: '', priority: 'normale', assignee_id: '' });
                  setCreating(false);
                } catch (e) {
                  toast({ title: 'Erreur', description: (e as Error).message, variant: 'destructive' });
                }
              }}
            >
              {createTask.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Créer la tâche
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <TaskDetailSheet task={openTask} onClose={() => setOpenTask(null)} onStatus={(id, status) => updateTask.mutate({ id, status })} />
    </div>
  );
}

function TaskDetailSheet({
  task, onClose, onStatus,
}: { task: InternalTask | null; onClose: () => void; onStatus: (id: string, status: string) => void }) {
  const { data: comments = [] } = useTaskComments(task?.id ?? null);
  const { addComment } = useInternalTaskMutations();
  const [body, setBody] = useState('');

  return (
    <Sheet open={!!task} onOpenChange={o => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {task && (
          <>
            <SheetHeader><SheetTitle className="text-left">{task.title}</SheetTitle></SheetHeader>
            <div className="space-y-4 mt-4">
              {task.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>}
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Statut</p>
                <Select value={task.status} onValueChange={v => onStatus(task.id, v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Fil de commentaires</p>
                <div className="space-y-2">
                  {comments.length === 0 && <p className="text-xs text-muted-foreground">Aucun commentaire.</p>}
                  {comments.map((c: any) => (
                    <div key={c.id} className="rounded-lg bg-secondary/60 p-2.5">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{c.body}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {c.author_label ? `${c.author_label} · ` : ''}
                        {new Date(c.created_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  ))}
                </div>
                <Textarea
                  className="mt-2"
                  placeholder="Écrire un commentaire…"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                />
                <Button
                  size="sm"
                  className="mt-2"
                  disabled={!body.trim() || addComment.isPending}
                  onClick={async () => {
                    try {
                      await addComment.mutateAsync({ taskId: task.id, body: body.trim() });
                      setBody('');
                    } catch (e) {
                      toast({ title: 'Erreur', description: (e as Error).message, variant: 'destructive' });
                    }
                  }}
                >
                  Publier
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
