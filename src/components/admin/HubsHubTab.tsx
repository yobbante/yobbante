import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Hubs &amp; réseau</h1>
        <p className="text-sm text-muted-foreground">Configuration des hubs, partenaire Konnekt et tracking global.</p>
      </div>

      <Tabs value={tab} onValueChange={onChange}>
        <TabsList>
          <TabsTrigger value="hubs">Hubs</TabsTrigger>
          <TabsTrigger value="konnekt">Konnekt</TabsTrigger>
          <TabsTrigger value="tracking">Tracking global</TabsTrigger>
        </TabsList>

        <TabsContent value="hubs"     className="mt-4"><HubsTab /></TabsContent>
        <TabsContent value="konnekt"  className="mt-4"><KonnektMonitorTab /></TabsContent>
        <TabsContent value="tracking" className="mt-4"><TrackingTab /></TabsContent>
      </Tabs>
    </div>
  );
}
