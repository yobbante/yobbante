import { useSearchParams, useNavigate } from 'react-router-dom';
import { Image as ImageIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { TransporteursTab } from './TransporteursTab';
import { LivreursTab } from './LivreursTab';
import { GpOperationsTab } from './GpOperationsTab';
import { SuiviOnboardingTab } from './SuiviOnboardingTab';

const TABS = ['gp', 'onboarding', 'livreurs', 'operations'] as const;
type TabId = typeof TABS[number];

export function TerrainHubTab() {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const tabParam = sp.get('tab') as TabId | null;
  const tab: TabId = tabParam && TABS.includes(tabParam) ? tabParam : 'gp';

  const onChange = (v: string) => {
    const next = new URLSearchParams(sp);
    if (v === 'gp') next.delete('tab');
    else next.set('tab', v);
    setSp(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Équipe terrain</h1>
          <p className="text-sm text-muted-foreground">Transporteurs GP, livreurs Dakar et opérations du jour.</p>
        </div>
        {/* CORRECTION #6 — ouvre la page dédiée /admin/flyers (liste + actions
            individuelles) au lieu de lancer un batch aveugle. */}
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/flyers')}>
          <ImageIcon className="h-4 w-4 mr-2" />
          Flyers WhatsApp
        </Button>
      </div>

      <Tabs value={tab} onValueChange={onChange}>
        <TabsList>
          <TabsTrigger value="gp">Transporteurs GP</TabsTrigger>
          <TabsTrigger value="onboarding">Suivi onboarding</TabsTrigger>
          <TabsTrigger value="livreurs">Livreurs Dakar</TabsTrigger>
          <TabsTrigger value="operations">Opérations du jour</TabsTrigger>
        </TabsList>

        <TabsContent value="gp"         className="mt-4"><TransporteursTab /></TabsContent>
        <TabsContent value="onboarding" className="mt-4"><SuiviOnboardingTab /></TabsContent>
        <TabsContent value="livreurs"   className="mt-4"><LivreursTab /></TabsContent>
        <TabsContent value="operations" className="mt-4"><GpOperationsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
