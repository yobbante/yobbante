import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { InboxTab } from './inbox/InboxTab';
import { RequestsTab } from './RequestsTab';
import { ReceptionKanbanTab } from './ReceptionKanbanTab';
import { SourcingTab } from './SourcingTab';

const TABS = ['tous', 'demandes', 'reception', 'sourcing'] as const;
type TabId = typeof TABS[number];

export function DossiersHubTab() {
  const [sp, setSp] = useSearchParams();
  const tabParam = sp.get('tab') as TabId | null;
  const tab: TabId = tabParam && TABS.includes(tabParam) ? tabParam : 'tous';

  const onChange = (v: string) => {
    const next = new URLSearchParams(sp);
    if (v === 'tous') next.delete('tab');
    else next.set('tab', v);
    setSp(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dossiers</h1>
        <p className="text-sm text-muted-foreground">Toutes les demandes et expéditions, par catégorie.</p>
      </div>

      <Tabs value={tab} onValueChange={onChange}>
        <TabsList>
          <TabsTrigger value="tous">Tous</TabsTrigger>
          <TabsTrigger value="demandes">Demandes entrantes</TabsTrigger>
          <TabsTrigger value="reception">Réception</TabsTrigger>
          <TabsTrigger value="sourcing">Sourcing</TabsTrigger>
        </TabsList>

        <TabsContent value="tous"      className="mt-4"><RequestsTab /></TabsContent>
        <TabsContent value="demandes"  className="mt-4"><InboxTab /></TabsContent>
        <TabsContent value="reception" className="mt-4"><ReceptionKanbanTab /></TabsContent>
        <TabsContent value="sourcing"  className="mt-4"><SourcingTab /></TabsContent>
      </Tabs>
    </div>
  );
}
