import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsContent } from '@/components/ui/tabs';
import { CalendarDays, List, Radio } from 'lucide-react';
import { HubHeader, HubTab } from './hub-ui';
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
    <div className="space-y-3 md:space-y-4">
      <HubHeader title="Départs" subtitle="Vue semaine, liste des départs manuels et monitoring Konnekt." />

      <Tabs value={tab} onValueChange={onChange}>
        <TabsList>
          <HubTab value="semaine" icon={CalendarDays} label="Vue semaine" />
          <HubTab value="liste"   icon={List}         label="Liste" />
          <HubTab value="konnekt" icon={Radio}        label="Konnekt" />
        </TabsList>

        <TabsContent value="semaine" className="mt-3 md:mt-4"><DeparturesWeekPage /></TabsContent>
        <TabsContent value="liste"   className="mt-3 md:mt-4"><DeparturesTab /></TabsContent>
        <TabsContent value="konnekt" className="mt-3 md:mt-4"><KonnektMonitorTab /></TabsContent>
      </Tabs>
    </div>
  );
}
