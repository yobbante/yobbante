import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ManualQuotesTab } from './ManualQuotesTab';
import { EnterpriseQuotesTab } from './EnterpriseQuotesTab';

const TABS = ['particuliers', 'b2b'] as const;
type TabId = typeof TABS[number];

export function LeadsHubTab() {
  const [sp, setSp] = useSearchParams();
  const tabParam = sp.get('tab') as TabId | null;
  const tab: TabId = tabParam && TABS.includes(tabParam) ? tabParam : 'particuliers';

  const onChange = (v: string) => {
    const next = new URLSearchParams(sp);
    if (v === 'particuliers') next.delete('tab');
    else next.set('tab', v);
    setSp(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Leads &amp; devis</h1>
        <p className="text-sm text-muted-foreground">Demandes de devis particuliers et entreprises B2B.</p>
      </div>

      <Tabs value={tab} onValueChange={onChange}>
        <TabsList>
          <TabsTrigger value="particuliers">Particuliers</TabsTrigger>
          <TabsTrigger value="b2b">Entreprises B2B</TabsTrigger>
        </TabsList>

        <TabsContent value="particuliers" className="mt-4"><ManualQuotesTab /></TabsContent>
        <TabsContent value="b2b"          className="mt-4"><EnterpriseQuotesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
