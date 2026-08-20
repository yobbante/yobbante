import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Image as ImageIcon, Truck, UserCheck, Bike, ClipboardList, Route as RouteIcon,
  LayoutDashboard, Plane, Package,
} from 'lucide-react';
import { Tabs, TabsList, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { HubHeader, HubTab } from './hub-ui';
import { TransporteursTab } from './TransporteursTab';
import { LivreursTab } from './LivreursTab';
import { GpOperationsTab } from './GpOperationsTab';
import { SuiviOnboardingTab } from './SuiviOnboardingTab';
import { FretRoutierTab } from './FretRoutierTab';
import { TerrainOverview } from './gp/TerrainOverview';
import { GpTransporteursTab } from './gp/GpTransporteursTab';
import { GpColisTab } from './gp/GpColisTab';

const TABS = ['gp', 'onboarding', 'livreurs', 'fret', 'operations'] as const;
type TabId = typeof TABS[number];

const FIELD_TABS = ['apercu', 'fret', 'gp', 'colis'] as const;
type FieldTabId = typeof FIELD_TABS[number];

export function TerrainHubTab({ fretOnly = false }: { fretOnly?: boolean }) {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const tabParam = sp.get('tab');

  const setTab = (v: string, defaultTab: string) => {
    const next = new URLSearchParams(sp);
    if (v === defaultTab) next.delete('tab');
    else next.set('tab', v);
    setSp(next, { replace: true });
  };

  /* --- Vue agent terrain : routier + GP uniquement --- */
  if (fretOnly) {
    const fieldTab: FieldTabId =
      tabParam && (FIELD_TABS as readonly string[]).includes(tabParam)
        ? (tabParam as FieldTabId)
        : 'apercu';

    return (
      <div className="space-y-3 md:space-y-4">
        <HubHeader
          title="Terrain — routier & GP"
          subtitle="Courses Terminal D, transporteurs GP et colis confiés aux voyageurs."
        />

        <Tabs value={fieldTab} onValueChange={(v) => setTab(v, 'apercu')}>
          <TabsList>
            <HubTab value="apercu" icon={LayoutDashboard} label="Aperçu" />
            <HubTab value="fret"   icon={RouteIcon}       label="Fret routier" />
            <HubTab value="gp"     icon={Plane}           label="Transporteurs GP" />
            <HubTab value="colis"  icon={Package}         label="Colis GP" />
          </TabsList>

          <TabsContent value="apercu" className="mt-3 md:mt-4">
            <TerrainOverview onGoto={(t) => setTab(t, 'apercu')} />
          </TabsContent>
          <TabsContent value="fret"  className="mt-3 md:mt-4"><FretRoutierTab /></TabsContent>
          <TabsContent value="gp"    className="mt-3 md:mt-4"><GpTransporteursTab /></TabsContent>
          <TabsContent value="colis" className="mt-3 md:mt-4"><GpColisTab /></TabsContent>
        </Tabs>
      </div>
    );
  }

  /* --- Vue admin complète --- */
  const tab: TabId = tabParam && (TABS as readonly string[]).includes(tabParam)
    ? (tabParam as TabId)
    : 'gp';

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

      <Tabs value={tab} onValueChange={(v) => setTab(v, 'gp')}>
        <TabsList>
          <HubTab value="gp"         icon={Truck}         label="Transporteurs GP" />
          <HubTab value="onboarding" icon={UserCheck}     label="Suivi onboarding" />
          <HubTab value="livreurs"   icon={Bike}          label="Livreurs Dakar" />
          <HubTab value="fret"       icon={RouteIcon}     label="Fret routier" />
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
