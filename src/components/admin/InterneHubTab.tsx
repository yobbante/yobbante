import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Handshake, Plane, LayoutDashboard, Activity } from 'lucide-react';
import { Tabs, TabsList, TabsContent } from '@/components/ui/tabs';
import { HubHeader, HubTab } from './hub-ui';
import { TasksPanel } from './interne/TasksPanel';
import { PartenairesPanel } from './interne/PartenairesPanel';
import { GpReadOnlyPanel } from './interne/GpReadOnlyPanel';
import { YobbanteOverviewPanel } from './interne/YobbanteOverviewPanel';
import { ActivityPanel } from './interne/ActivityPanel';

const TABS = ['taches', 'partenaires', 'gp', 'activite', 'suivi'] as const;
type TabId = typeof TABS[number];

export function InterneHubTab({ isAdmin }: { isAdmin: boolean }) {
  const [sp, setSp] = useSearchParams();
  const tabParam = sp.get('tab');
  const tab: TabId = tabParam && (TABS as readonly string[]).includes(tabParam)
    ? (tabParam as TabId)
    : 'taches';

  const setTab = (v: string) => {
    const next = new URLSearchParams(sp);
    if (v === 'taches') next.delete('tab');
    else next.set('tab', v);
    setSp(next, { replace: true });
  };

  return (
    <div className="space-y-3 md:space-y-4">
      <HubHeader
        title="Équipe interne"
        subtitle="Tâches, partenaires logistiques et suivi d'activité en temps réel."
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <HubTab value="taches"      icon={ClipboardList}   label="Mes tâches" />
          <HubTab value="partenaires" icon={Handshake}       label="Partenaires" />
          <HubTab value="gp"          icon={Plane}           label="Transporteurs GP" />
          <HubTab value="activite"    icon={LayoutDashboard} label="Vue Yobbanté" />
          {isAdmin && <HubTab value="suivi" icon={Activity} label="Suivi & présence" />}
        </TabsList>

        <TabsContent value="taches"      className="mt-3 md:mt-4"><TasksPanel isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="partenaires" className="mt-3 md:mt-4"><PartenairesPanel readOnly={false} /></TabsContent>
        <TabsContent value="gp"          className="mt-3 md:mt-4"><GpReadOnlyPanel /></TabsContent>
        <TabsContent value="activite"    className="mt-3 md:mt-4"><YobbanteOverviewPanel /></TabsContent>
        {isAdmin && <TabsContent value="suivi" className="mt-3 md:mt-4"><ActivityPanel /></TabsContent>}
      </Tabs>
    </div>
  );
}
