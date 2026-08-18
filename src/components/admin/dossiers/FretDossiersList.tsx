import { useMemo, useState } from 'react';
import { Route as RouteIcon, Search, ChevronRight, Truck, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useFretCourses, useChauffeurs, FRET_ACTIVE_STATUSES, type AdminFretCourse } from '@/hooks/useFretAdmin';
import { FRET_STATUS_LABEL } from '@/lib/fretApi';
import { FretCourseSheet, FRET_STATUS_TONE } from '@/components/admin/fret/FretCourseSheet';
import { cn } from '@/lib/utils';

/**
 * Courses Terminal D (fret routier) affichées dans la liste des dossiers.
 * Chaque fiche est cliquable et ouvre la fiche détaillée (pop-up) où l'agent
 * peut consulter, modifier et faire avancer la course.
 */
export function FretDossiersList({ compact = false }: { compact?: boolean }) {
  const { data: courses = [], isLoading } = useFretCourses();
  const { data: chauffeurs = [] } = useChauffeurs();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [activeOnly, setActiveOnly] = useState(compact);
  const [selected, setSelected] = useState<AdminFretCourse | null>(null);

  const chauffeurById = useMemo(() => new Map(chauffeurs.map(c => [c.id, c])), [chauffeurs]);

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

  // Garde la fiche ouverte à jour après une mutation.
  const current = selected ? courses.find(c => c.id === selected.id) ?? selected : null;

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
      ) : rows.map((c) => {
        const ch = chauffeurById.get(c.chauffeur_id ?? '');
        return (
          <button
            key={c.id}
            onClick={() => setSelected(c)}
            className="group w-full text-left rounded-xl border border-border bg-card p-3 space-y-1.5 hover:border-primary/50 hover:bg-secondary/40 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted-foreground">{c.ref}</span>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="h-5 text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                  <RouteIcon className="w-2.5 h-2.5 mr-0.5" /> Routier
                  {c.scope === 'international' ? ' int.' : ''}
                </Badge>
                <Badge variant="outline" className={cn('h-5 text-[9px]', FRET_STATUS_TONE[c.status])}>
                  {FRET_STATUS_LABEL[c.status]}
                </Badge>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
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
            <p className="text-[11px] text-muted-foreground flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Truck className="w-3 h-3" />
                {ch ? (ch.nom_complet || ch.telephone) : 'Aucun chauffeur'}
              </span>
              {c.pickup_zone && (
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.pickup_zone}</span>
              )}
            </p>
          </button>
        );
      })}

      <FretCourseSheet
        course={current}
        open={!!current}
        onOpenChange={(v) => { if (!v) setSelected(null); }}
        onAssign={() => navigate('/admin/terrain?tab=fret')}
      />
    </div>
  );
}
