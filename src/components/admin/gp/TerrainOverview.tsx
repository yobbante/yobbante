import { useMemo } from 'react';
import { AlertTriangle, Truck, Plane, Package, CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFretCourses, FRET_ACTIVE_STATUSES } from '@/hooks/useFretAdmin';
import { useGpColis, stepOf, stalledHours, GP_STEPS, GP_STEP_TONE } from '@/hooks/useGpTerrain';
import { cn } from '@/lib/utils';

/** Tableau de bord combiné : activité routière (Terminal D) + colis GP, avec alertes. */
export function TerrainOverview({ onGoto }: { onGoto?: (tab: 'fret' | 'colis') => void }) {
  const { data: courses = [] } = useFretCourses();
  const { data: colis = [] } = useGpColis();

  const stats = useMemo(() => {
    const activeCourses = courses.filter(c => FRET_ACTIVE_STATUSES.includes(c.status));
    const aEnlever = courses.filter(c => c.status === 'A_ENLEVER');
    const livreesJour = courses.filter(c =>
      c.status === 'LIVRE' && c.delivered_at &&
      new Date(c.delivered_at).toDateString() === new Date().toDateString());

    const gpActifs = colis.filter(c => stepOf(c.status) !== 'RECUPERE');
    const gpAEnlever = colis.filter(c => stepOf(c.status) === 'A_ENLEVER');
    const gpArrives = colis.filter(c => stepOf(c.status) === 'ARRIVE');

    const alerts: { id: string; label: string; detail: string; tab: 'fret' | 'colis' }[] = [];
    courses.forEach((c) => {
      if (c.status === 'ARRIVE' && c.arrived_at &&
          Date.now() - new Date(c.arrived_at).getTime() > 24 * 3600 * 1000) {
        alerts.push({ id: `f-${c.id}`, label: `Course ${c.ref}`, detail: 'Arrivée depuis +24h, non confirmée', tab: 'fret' });
      }
      if (c.status === 'A_ENLEVER' &&
          Date.now() - new Date(c.created_at).getTime() > 12 * 3600 * 1000) {
        alerts.push({ id: `p-${c.id}`, label: `Enlèvement ${c.ref}`, detail: 'En attente depuis +12h', tab: 'fret' });
      }
    });
    colis.forEach((c) => {
      const st = stepOf(c.status);
      if (st !== 'RECUPERE' && stalledHours(c) > 48) {
        alerts.push({
          id: `g-${c.id}`,
          label: `Colis ${c.reference ?? '—'}`,
          detail: `Bloqué en « ${GP_STEPS.find(s => s.id === st)?.label} » depuis +48h`,
          tab: 'colis',
        });
      }
    });

    return {
      activeCourses: activeCourses.length,
      aEnlever: aEnlever.length,
      livreesJour: livreesJour.length,
      gpActifs: gpActifs.length,
      gpAEnlever: gpAEnlever.length,
      gpArrives: gpArrives.length,
      alerts,
    };
  }, [courses, colis]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Kpi icon={Truck}  label="Courses actives"   value={stats.activeCourses} onClick={() => onGoto?.('fret')} />
        <Kpi icon={Package} label="Enlèvements routiers" value={stats.aEnlever} tone="amber" onClick={() => onGoto?.('fret')} />
        <Kpi icon={CheckCircle2} label="Livrées aujourd'hui" value={stats.livreesJour} tone="emerald" onClick={() => onGoto?.('fret')} />
        <Kpi icon={Plane} label="Colis GP en cours" value={stats.gpActifs} onClick={() => onGoto?.('colis')} />
        <Kpi icon={Package} label="Colis GP à enlever" value={stats.gpAEnlever} tone="amber" onClick={() => onGoto?.('colis')} />
        <Kpi icon={CheckCircle2} label="Colis GP arrivés" value={stats.gpArrives} tone="violet" onClick={() => onGoto?.('colis')} />
      </div>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Alertes ({stats.alerts.length})
        </h3>
        {stats.alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Rien à signaler, tout est à jour.</p>
        ) : (
          <div className="space-y-1.5">
            {stats.alerts.slice(0, 12).map((a) => (
              <button
                key={a.id}
                onClick={() => onGoto?.(a.tab)}
                className="w-full text-left rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5 hover:bg-amber-500/10 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{a.label}</span>
                  <Badge variant="outline" className={cn('text-[10px]', GP_STEP_TONE.ARRIVE)}>
                    {a.tab === 'fret' ? 'Routier' : 'GP'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{a.detail}</p>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone = 'primary', onClick }: {
  icon: LucideIcon; label: string; value: number;
  tone?: 'primary' | 'amber' | 'emerald' | 'violet';
  onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    primary: 'text-primary',
    amber: 'text-amber-600',
    emerald: 'text-emerald-600',
    violet: 'text-violet-500',
  };
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-border bg-card p-3 text-left hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className={cn('w-3.5 h-3.5', tones[tone])} />
        <span className="truncate">{label}</span>
      </div>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </button>
  );
}
