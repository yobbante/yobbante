import { useMemo, useState } from 'react';
import { Route as RouteIcon, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useFretCourses, FRET_ACTIVE_STATUSES } from '@/hooks/useFretAdmin';
import { FRET_STATUS_LABEL } from '@/lib/fretApi';
import { cn } from '@/lib/utils';

/**
 * Courses Terminal D (fret routier) affichées dans la liste des dossiers.
 * Le détail complet reste géré dans Équipe terrain → Fret routier : on
 * propose donc un lien direct plutôt qu'une fiche dupliquée.
 */
export function FretDossiersList({ compact = false }: { compact?: boolean }) {
  const { data: courses = [], isLoading } = useFretCourses();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [activeOnly, setActiveOnly] = useState(compact);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return courses.filter((c) => {
      if (activeOnly && !FRET_ACTIVE_STATUSES.includes(c.status)) return false;
      if (!s) return true;
      return c.ref.toLowerCase().includes(s)
        || c.destination.toLowerCase().includes(s)
        || (c.client_nom ?? '').toLowerCase().includes(s)
        || (c.expediteur_nom ?? '').toLowerCase().includes(s);
    });
  }, [courses, q, activeOnly]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-9"
                 placeholder="Réf YBR · destination · client" />
        </div>
        <Button size="sm" variant="outline" className="h-9 text-xs shrink-0"
                onClick={() => setActiveOnly(v => !v)}>
          {activeOnly ? 'Voir tout' : 'Actives'}
        </Button>
        <Button size="sm" variant="outline" className="h-9 text-xs shrink-0"
                onClick={() => navigate('/admin/terrain?tab=fret')}>
          Module fret
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Aucun dossier routier.</p>
      ) : rows.map((c) => (
        <button
          key={c.id}
          onClick={() => navigate('/admin/terrain?tab=fret')}
          className="w-full text-left rounded-xl border border-border p-3 space-y-1 hover:bg-secondary/50 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted-foreground">{c.ref}</span>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="h-5 text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                <RouteIcon className="w-2.5 h-2.5 mr-0.5" /> Routier
                {c.scope === 'international' ? ' int.' : ''}
              </Badge>
              <Badge variant="outline" className={cn('h-5 text-[9px]')}>{FRET_STATUS_LABEL[c.status]}</Badge>
            </div>
          </div>
          <p className="text-sm font-medium truncate">
            Dakar → {c.destination} · {c.client_nom || c.expediteur_nom || 'Client'}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {c.total_fcfa ? `${c.total_fcfa.toLocaleString('fr-FR')} FCFA · ` : ''}
            {new Date(c.created_at).toLocaleDateString('fr-FR')}
            {c.pickup_address ? ` · Enlèvement : ${c.pickup_address}` : ''}
          </p>
        </button>
      ))}
    </div>
  );
}
