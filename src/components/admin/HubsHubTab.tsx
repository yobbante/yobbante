import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsContent } from '@/components/ui/tabs';
import { Globe2, Radio, Route } from 'lucide-react';
import { HubHeader, HubTab } from './hub-ui';
import { HubsTab } from './HubsTab';
import { KonnektMonitorTab } from './KonnektMonitorTab';
import { TrackingTab } from './TrackingTab';

const TABS = ['hubs', 'konnekt', 'tracking'] as const;
type TabId = typeof TABS[number];

export function HubsHubTab() {
  const [sp, setSp] = useSearchParams();
  const tabParam = sp.get('tab') as TabId | null;
  const tab: TabId = tabParam && TABS.includes(tabParam) ? tabParam : 'hubs';

  const onChange = (v: string) => {
    const next = new URLSearchParams(sp);
    if (v === 'hubs') next.delete('tab');
    else next.set('tab', v);
    setSp(next, { replace: true });
  };

  return (
    <div className="space-y-3 md:space-y-4">
      <HubHeader title="Hubs & réseau" subtitle="Configuration des hubs, partenaire Konnekt et tracking global." />

      <Tabs value={tab} onValueChange={onChange}>
        <TabsList>
          <HubTab value="hubs"     icon={Globe2} label="Hubs" />
          <HubTab value="konnekt"  icon={Radio}  label="Konnekt" />
          <HubTab value="tracking" icon={Route}  label="Tracking global" />
        </TabsList>

        <TabsContent value="hubs"     className="mt-3 md:mt-4"><HubsTab /></TabsContent>
        <TabsContent value="konnekt"  className="mt-3 md:mt-4"><KonnektMonitorTab /></TabsContent>
        <TabsContent value="tracking" className="mt-3 md:mt-4"><TrackingTab /></TabsContent>
      </Tabs>
    </div>
  );
}
