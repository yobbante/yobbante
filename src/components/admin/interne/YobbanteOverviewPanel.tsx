import { Card } from '@/components/ui/card';
import { Loader2, Plane, Ship, Route as RouteIcon, Package, Users } from 'lucide-react';
import { useInternalOverview } from '@/hooks/useInternalWorkspace';

const MODE_META: Record<string, { label: string; icon: typeof Plane }> = {
  gp: { label: 'GP', icon: Package },
  aerien: { label: 'Aérien', icon: Plane },
  maritime: { label: 'Maritime', icon: Ship },
  routier: { label: 'Routier', icon: RouteIcon },
};

const FRET_LABEL: Record<string, string> = {
  A_ENLEVER: 'À enlever',
  PENDING_ACCEPT: 'En attente chauffeur',
  REMIS_CHAUFFEUR: 'Remis au chauffeur',
  EN_ROUTE: 'En route',
  ARRIVE: 'Arrivé',
  LIVRE: 'Livré',
};

/** Vue d'activité Yobbanté — lecture seule, sans aucune donnée financière. */
export function YobbanteOverviewPanel() {
  const { data, isLoading } = useInternalOverview();

  if (isLoading) {
    return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  const modes = data?.dossiers_by_mode ?? {};
  const fret = data?.fret_by_status ?? {};

  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-sm font-semibold mb-2">Dossiers actifs par mode</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.keys(MODE_META).map(k => {
            const Icon = MODE_META[k].icon;
            return (
              <Card key={k} className="p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className="w-3.5 h-3.5" /> {MODE_META[k].label}
                </div>
                <div className="text-2xl font-semibold mt-1">{modes[k] ?? 0}</div>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Courses Terminal D en cours</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(fret).length === 0 && (
            <Card className="p-3 text-sm text-muted-foreground">Aucune course en cours.</Card>
          )}
          {Object.entries(fret).map(([k, v]) => (
            <Card key={k} className="p-3">
              <div className="text-xs text-muted-foreground">{FRET_LABEL[k] ?? k}</div>
              <div className="text-2xl font-semibold mt-1">{v}</div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Réseau GP</h3>
        <Card className="p-3 flex items-center gap-3">
          <Users className="w-4 h-4 text-primary" />
          <div className="text-sm">
            <span className="text-2xl font-semibold mr-2">{data?.gp_actifs ?? 0}</span>
            transporteurs actifs sur {data?.gp_total ?? 0} enregistrés
          </div>
        </Card>
      </section>
    </div>
  );
}
