import { useSearchParams, useNavigate } from 'react-router-dom';
import { Image as ImageIcon, Truck, UserCheck, Bike, ClipboardList, Route as RouteIcon } from 'lucide-react';
import { Tabs, TabsList, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { HubHeader, HubTab } from './hub-ui';
import { TransporteursTab } from './TransporteursTab';
import { LivreursTab } from './LivreursTab';
import { GpOperationsTab } from './GpOperationsTab';
import { SuiviOnboardingTab } from './SuiviOnboardingTab';
import { FretRoutierTab } from './FretRoutierTab';

const TABS = ['gp', 'onboarding', 'livreurs', 'fret', 'operations'] as const;
type TabId = typeof TABS[number];

export function TerrainHubTab({ fretOnly = false }: { fretOnly?: boolean }) {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const tabParam = sp.get('tab') as TabId | null;
  const defaultTab: TabId = fretOnly ? 'fret' : 'gp';
  const tab: TabId = fretOnly
    ? 'fret'
    : (tabParam && TABS.includes(tabParam) ? tabParam : defaultTab);

  const onChange = (v: string) => {
    const next = new URLSearchParams(sp);
    if (v === defaultTab) next.delete('tab');
    else next.set('tab', v);
    setSp(next, { replace: true });
  };

  if (fretOnly) {
    return (
      <div className="space-y-3 md:space-y-4">
        <HubHeader
          title="Fret routier — Terminal D"
          subtitle="Remises de colis, demandes d'enlèvement, courses en cours et chauffeurs."
        />
        <FretRoutierTab />
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      <HubHeader
        title="Équipe terrain"
        subtitle="Transporteurs GP, livreurs Dakar et opérations du jour."
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/flyers')} aria-label="Flyers WhatsApp">
            <ImageIcon className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Flyers WhatsApp</span>
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={onChange}>
        <TabsList>
          <HubTab value="gp"         icon={Truck}         label="Transporteurs GP" />
          <HubTab value="onboarding" icon={UserCheck}     label="Suivi onboarding" />
          <HubTab value="livreurs"   icon={Bike}          label="Livreurs Dakar" />
          <HubTab value="fret"        icon={RouteIcon}     label="Fret routier" />
          <HubTab value="operations" icon={ClipboardList} label="Opérations du jour" />
        </TabsList>

        <TabsContent value="gp"         className="mt-3 md:mt-4"><TransporteursTab /></TabsContent>
        <TabsContent value="onboarding" className="mt-3 md:mt-4"><SuiviOnboardingTab /></TabsContent>
        <TabsContent value="livreurs"   className="mt-3 md:mt-4"><LivreursTab /></TabsContent>
        <TabsContent value="fret"       className="mt-3 md:mt-4"><FretRoutierTab /></TabsContent>
        <TabsContent value="operations" className="mt-3 md:mt-4"><GpOperationsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
