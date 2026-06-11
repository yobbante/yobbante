import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { TransporteursTab } from './TransporteursTab';
import { LivreursTab } from './LivreursTab';
import { GpOperationsTab } from './GpOperationsTab';
import { SuiviOnboardingTab } from './SuiviOnboardingTab';

const TABS = ['gp', 'onboarding', 'livreurs', 'operations'] as const;
type TabId = typeof TABS[number];

export function TerrainHubTab() {
  const [sp, setSp] = useSearchParams();
  const tabParam = sp.get('tab') as TabId | null;
  const tab: TabId = tabParam && TABS.includes(tabParam) ? tabParam : 'gp';
  const [reprocessing, setReprocessing] = useState(false);

  const onChange = (v: string) => {
    const next = new URLSearchParams(sp);
    if (v === 'gp') next.delete('tab');
    else next.set('tab', v);
    setSp(next, { replace: true });
  };

  const reprocessFlyers = async () => {
    setReprocessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('gp-bot-reprocess-flyers');
      if (error) throw error;
      const sent = (data?.results ?? []).filter((r: any) => r.status === 'sent').length;
      toast.success(`Retraitement : ${sent} récap(s) envoyé(s) sur ${data?.pending ?? 0} image(s)`);
    } catch (e: any) {
      toast.error(e?.message || 'Erreur retraitement');
    } finally {
      setReprocessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Équipe terrain</h1>
          <p className="text-sm text-muted-foreground">Transporteurs GP, livreurs Dakar et opérations du jour.</p>
        </div>
        <Button variant="outline" size="sm" onClick={reprocessFlyers} disabled={reprocessing}>
          {reprocessing
            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            : <RefreshCcw className="h-4 w-4 mr-2" />}
          🔄 Retraiter les flyers non lus
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
