import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Layers, Inbox, PackageOpen, ShoppingCart, ShieldCheck, Route as RouteIcon, Plane, Ship, Users } from 'lucide-react';
import { HubHeader, HubTab } from './hub-ui';




import { RequestsTab } from './RequestsTab';
import { FretDossiersList } from './dossiers/FretDossiersList';
import { ReceptionKanbanTab } from './ReceptionKanbanTab';
import { SourcingTab } from './SourcingTab';
import { NewIntakeDialog } from './inbox/NewIntakeDialog';
import { DossierSheetProvider } from './dossier-sheet/useDossierSheet';
import { AdminDossierSheet } from './dossier-sheet/AdminDossierSheet';
import { ClientAuditPanel } from './ClientAuditPanel';
import { useInboxUnassignedCount } from '@/hooks/useInboxUnassignedCount';

const TABS = ['tous', 'demandes', 'gp', 'aerien', 'maritime', 'routier', 'reception', 'sourcing', 'audit'] as const;
type TabId = typeof TABS[number];
const DEFAULT_TAB: TabId = 'demandes';


export function DossiersHubTab({ fretOnly = false }: { fretOnly?: boolean }) {
  const [sp, setSp] = useSearchParams();
  const tabParam = sp.get('tab') as TabId | null;
  const tab: TabId = tabParam && TABS.includes(tabParam) ? tabParam : DEFAULT_TAB;
  const [intakeOpen, setIntakeOpen] = useState(false);
  const { data: unassignedCount = 0 } = useInboxUnassignedCount(!fretOnly);
  const [showArchived, setShowArchived] = useState(false);

  // Agent terrain : uniquement les dossiers routiers (Terminal D), en lecture.
  if (fretOnly) {
    return (
      <div className="space-y-3 md:space-y-4">
        <HubHeader
          title="Dossiers routiers"
          subtitle="Courses Terminal D — cliquez une fiche pour la consulter, la modifier et faire avancer le statut."
        />
        <FretDossiersList />
      </div>
    );
  }



  const onChange = (v: string) => {
    const next = new URLSearchParams(sp);
    if (v === DEFAULT_TAB) next.delete('tab');
    else next.set('tab', v);
    setSp(next, { replace: true });
  };

  return (
    <DossierSheetProvider>
      <div className="space-y-3 md:space-y-4">
        <div className="hidden md:block">
          <HubHeader
            title="Dossiers"
            subtitle="Toutes les demandes et expéditions, par catégorie."
            actions={
              <Button size="sm" onClick={() => setIntakeOpen(true)} aria-label="Nouveau dossier">
                <Plus className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline">Nouveau dossier</span>
              </Button>
            }
          />
        </div>

        <Tabs value={tab} onValueChange={onChange}>
          <div className="flex items-center gap-2">
            <TabsList className="flex-1 md:flex-none justify-center md:justify-start">
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
              <HubTab value="gp"        icon={Users}       label="GP" />
              <HubTab value="aerien"    icon={Plane}       label="Aérien" />
              <HubTab value="maritime"  icon={Ship}        label="Maritime" />
              <HubTab value="routier"   icon={RouteIcon}   label="Routier" />

              <HubTab value="reception" icon={PackageOpen} label="Réception" />
              <HubTab value="sourcing"  icon={ShoppingCart} label="Sourcing" />
              <HubTab value="audit"     icon={ShieldCheck}  label="Audit & Test" />
            </TabsList>
            <Button size="icon" className="md:hidden h-9 w-9 shrink-0" onClick={() => setIntakeOpen(true)} aria-label="Nouveau dossier">
              <Plus className="w-4 h-4" />
            </Button>
          </div>


          <TabsContent value="tous"      className="mt-3 md:mt-4 space-y-4">
            <RequestsTab />
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Dossiers routiers (Terminal D)</p>
              <FretDossiersList compact />
            </div>
          </TabsContent>
          <TabsContent value="demandes"  className="mt-3 md:mt-4">
            <div className="mb-3 hidden md:flex items-center justify-end gap-2">
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

          <TabsContent value="gp" className="mt-3 md:mt-4">
            <RequestsTab
              hideHeader
              transportModes={['gp']}
              title="Dossiers GP"
              subtitle="Bagage accompagné — dossiers rattachés à un transporteur GP."
              excludeStatuses={['CANCELLED', 'ARCHIVED']}
            />
          </TabsContent>
          <TabsContent value="aerien" className="mt-3 md:mt-4">
            <RequestsTab
              hideHeader
              transportModes={['air']}
              title="Dossiers aériens"
              subtitle="Fret aérien — devis indicatifs et dossiers confirmés."
              excludeStatuses={['CANCELLED', 'ARCHIVED']}
            />
          </TabsContent>
          <TabsContent value="maritime" className="mt-3 md:mt-4">
            <RequestsTab
              hideHeader
              transportModes={['sea']}
              title="Dossiers maritimes"
              subtitle="Fret maritime (LCL) — en préparation."
              excludeStatuses={['CANCELLED', 'ARCHIVED']}
            />
          </TabsContent>
          <TabsContent value="routier"   className="mt-3 md:mt-4"><FretDossiersList /></TabsContent>

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
