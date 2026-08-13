import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  const [showArchived, setShowArchived] = useState(false);


  const onChange = (v: string) => {
    const next = new URLSearchParams(sp);
    if (v === DEFAULT_TAB) next.delete('tab');
    else next.set('tab', v);
    setSp(next, { replace: true });
  };

  return (
    <DossierSheetProvider>
      <div className="space-y-3 md:space-y-4">
        <HubHeader
          title="Dossiers"
          subtitle="Toutes les demandes et expéditions, par catégorie."
          actions={
            <Button size="sm" onClick={() => setIntakeOpen(true)} aria-label="Nouveau dossier">
              <Plus className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline">Nouveau dossier</span>
            </Button>
          }
        />

        <Tabs value={tab} onValueChange={onChange}>
          <TabsList>
            <HubTab value="tous"     icon={Layers}   label="Tous" />
            <HubTab
              value="demandes"
              icon={Inbox}
              label="Demandes entrantes"
              badge={unassignedCount > 0 ? (
                <span className="ml-1 text-[10px] bg-orange-500 text-white rounded-full px-1.5 py-0.5 tabular-nums">
                  {unassignedCount}
                </span>
              ) : undefined}
            />
            <HubTab value="reception" icon={PackageOpen} label="Réception" />
            <HubTab value="sourcing"  icon={ShoppingCart} label="Sourcing" />
            <HubTab value="audit"     icon={ShieldCheck}  label="Audit & Test" />
          </TabsList>

          <TabsContent value="tous"      className="mt-3 md:mt-4"><RequestsTab /></TabsContent>
          <TabsContent value="demandes"  className="mt-3 md:mt-4">
            <div className="mb-3 flex items-center justify-end gap-2">
              <Label htmlFor="show-archived" className="text-xs text-muted-foreground cursor-pointer">
                <span className="hidden md:inline">Voir archivés / annulés</span>
                <span className="md:hidden">Archivés</span>
              </Label>
              <Switch
                id="show-archived"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
            </div>
            <RequestsTab
              initialKind="send"
              lockKind
              hideHeader
              title="Demandes entrantes"
              subtitle="Flow expédition — clients ayant envoyé une demande."
              excludeStatuses={showArchived ? [] : ['CANCELLED', 'ARCHIVED']}
            />
          </TabsContent>

          <TabsContent value="reception" className="mt-3 md:mt-4"><ReceptionKanbanTab /></TabsContent>
          <TabsContent value="sourcing"  className="mt-3 md:mt-4"><SourcingTab /></TabsContent>
          <TabsContent value="audit"     className="mt-3 md:mt-4"><ClientAuditPanel /></TabsContent>
        </Tabs>
      </div>


      <NewIntakeDialog open={intakeOpen} onOpenChange={setIntakeOpen} />

      <AdminDossierSheet />
    </DossierSheetProvider>
  );
}
