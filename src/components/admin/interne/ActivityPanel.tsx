import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Activity, CircleDot } from 'lucide-react';
import { useStaffActivity, useInternalMembers } from '@/hooks/useInternalWorkspace';

const ACTION_LABEL: Record<string, string> = {
  task_created: 'Tâche créée',
  task_updated: 'Tâche mise à jour',
  task_completed: 'Tâche terminée',
  task_comment: 'Commentaire laissé',
  partner_created: 'Fiche partenaire ajoutée',
  partner_updated: 'Fiche partenaire modifiée',
};

function since(iso: string | null) {
  if (!iso) return 'Aucune activité';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 5) return 'En ligne';
  if (min < 60) return `Dernière activité il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Dernière activité il y a ${h} h`;
  return `Dernière activité il y a ${Math.floor(h / 24)} j`;
}

function isOnline(iso: string | null) {
  return !!iso && Date.now() - new Date(iso).getTime() < 5 * 60_000;
}

/** Fil d'activité + présence — vue admin (« zoom sans appel »). */
export function ActivityPanel() {
  const { data: rows = [], isLoading } = useStaffActivity(80);
  const { data: members = [] } = useInternalMembers();

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {members.map(m => (
          <Card key={m.user_id} className="p-3 flex items-center gap-3">
            <CircleDot
              className={`w-4 h-4 ${isOnline(m.last_activity) ? 'text-emerald-500 animate-pulse' : 'text-muted-foreground'}`}
            />
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{m.name}</div>
              <div className="text-xs text-muted-foreground">{since(m.last_activity)}</div>
            </div>
          </Card>
        ))}
        {members.length === 0 && (
          <Card className="p-3 text-sm text-muted-foreground">
            Aucun membre avec le rôle « Stagiaire partenariats » pour l'instant.
          </Card>
        )}
      </div>

      <Card className="p-3 md:p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Fil d'activité</h3>
        </div>
        {isLoading ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Aucune activité enregistrée.</p>
        ) : (
          <ol className="space-y-2">
            {rows.map(r => (
              <li key={r.id} className="flex items-start gap-3 text-sm border-l-2 border-border pl-3">
                <div className="flex-1 min-w-0">
                  <Badge variant="secondary" className="text-[10px] mr-2">
                    {ACTION_LABEL[r.action] ?? r.action}
                  </Badge>
                  <span className="text-foreground">{r.label ?? '—'}</span>
                </div>
                <time className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString('fr-FR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}
                </time>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
