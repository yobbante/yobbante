import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DeparturesTab } from './DeparturesTab';
import { KonnektMonitorTab } from './KonnektMonitorTab';
import DeparturesWeekPage from '@/pages/admin/DeparturesWeekPage';

const TABS = ['semaine', 'liste', 'konnekt'] as const;
type TabId = typeof TABS[number];

export function DepartsHubTab() {
  const [sp, setSp] = useSearchParams();
  const tabParam = sp.get('tab') as TabId | null;
  const tab: TabId = tabParam && TABS.includes(tabParam) ? tabParam : 'semaine';

  const onChange = (v: string) => {
    const next = new URLSearchParams(sp);
    if (v === 'semaine') next.delete('tab');
    else next.set('tab', v);
    setSp(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Départs</h1>
        <p className="text-sm text-muted-foreground">Vue semaine, liste des départs manuels et monitoring Konnekt.</p>
      </div>

      <Tabs value={tab} onValueChange={onChange}>
        <TabsList>
          <TabsTrigger value="semaine">Vue semaine</TabsTrigger>
          <TabsTrigger value="liste">Liste</TabsTrigger>
          <TabsTrigger value="konnekt">Konnekt</TabsTrigger>
        </TabsList>

        <TabsContent value="semaine" className="mt-4"><DeparturesWeekPage /></TabsContent>
        <TabsContent value="liste"   className="mt-4"><DeparturesTab /></TabsContent>
        <TabsContent value="konnekt" className="mt-4"><KonnektMonitorTab /></TabsContent>
      </Tabs>
    </div>
  );
}
