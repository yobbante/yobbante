import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';


import { RequestsTab } from './RequestsTab';
import { ReceptionKanbanTab } from './ReceptionKanbanTab';
import { SourcingTab } from './SourcingTab';
import { NewIntakeDialog } from './inbox/NewIntakeDialog';
import { DossierSheetProvider } from './dossier-sheet/useDossierSheet';
import { AdminDossierSheet } from './dossier-sheet/AdminDossierSheet';
import { ClientAuditPanel } from './ClientAuditPanel';
import { useInboxUnassignedCount } from '@/hooks/useInboxUnassignedCount';

const TABS = ['tous', 'demandes', 'reception', 'sourcing', 'audit'] as const;
type TabId = typeof TABS[number];
const DEFAULT_TAB: TabId = 'demandes';

export function DossiersHubTab() {
  const [sp, setSp] = useSearchParams();
  const tabParam = sp.get('tab') as TabId | null;
  const tab: TabId = tabParam && TABS.includes(tabParam) ? tabParam : DEFAULT_TAB;
  const [intakeOpen, setIntakeOpen] = useState(false);
  const { data: unassignedCount = 0 } = useInboxUnassignedCount();

  const onChange = (v: string) => {
    const next = new URLSearchParams(sp);
    if (v === DEFAULT_TAB) next.delete('tab');
    else next.set('tab', v);
    setSp(next, { replace: true });
  };

  return (
    <DossierSheetProvider>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Dossiers</h1>
            <p className="text-sm text-muted-foreground">Toutes les demandes et expéditions, par catégorie.</p>
          </div>
          <Button size="sm" onClick={() => setIntakeOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nouveau dossier
          </Button>
        </div>

        <Tabs value={tab} onValueChange={onChange}>
          <TabsList>
            <TabsTrigger value="tous">Tous</TabsTrigger>
            <TabsTrigger value="demandes" className="relative">
              Demandes entrantes
              {unassignedCount > 0 && (
                <span className="ml-1.5 text-[10px] bg-orange-500 text-white rounded-full px-1.5 py-0.5 tabular-nums">
                  {unassignedCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="reception">Réception</TabsTrigger>
            <TabsTrigger value="sourcing">Sourcing</TabsTrigger>
            <TabsTrigger value="audit">Audit & Test</TabsTrigger>
          </TabsList>

          <TabsContent value="tous"      className="mt-4"><RequestsTab /></TabsContent>
          <TabsContent value="demandes"  className="mt-4"><InboxTab /></TabsContent>
          <TabsContent value="reception" className="mt-4"><ReceptionKanbanTab /></TabsContent>
          <TabsContent value="sourcing"  className="mt-4"><SourcingTab /></TabsContent>
          <TabsContent value="audit"     className="mt-4"><ClientAuditPanel /></TabsContent>
        </Tabs>
      </div>

      <NewIntakeDialog open={intakeOpen} onOpenChange={setIntakeOpen} />

      <AdminDossierSheet />
    </DossierSheetProvider>
  );
}
