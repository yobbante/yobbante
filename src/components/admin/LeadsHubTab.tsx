import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsContent } from '@/components/ui/tabs';
import { User, Building2 } from 'lucide-react';
import { HubHeader, HubTab } from './hub-ui';
import { EnterpriseQuotesTab } from './EnterpriseQuotesTab';
import { DevisSurMesureTab } from './DevisSurMesureTab';

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
    <div className="space-y-3 md:space-y-4">
      <HubHeader title="Leads & devis" subtitle="Toutes les demandes de devis particuliers et entreprises." />

      <Tabs value={tab} onValueChange={onChange}>
        <TabsList className="flex-wrap h-auto">
          <HubTab value="particuliers" icon={User}      label="Particuliers & sur mesure" />
          <HubTab value="b2b"          icon={Building2} label="Entreprises B2B" />
        </TabsList>

        <TabsContent value="particuliers" className="mt-3 md:mt-4"><DevisSurMesureTab /></TabsContent>
        <TabsContent value="b2b"          className="mt-3 md:mt-4"><EnterpriseQuotesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
