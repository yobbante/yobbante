import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Tabs, TabsList, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Plus, Inbox, PackageOpen, ShoppingCart, ShieldCheck, Route as RouteIcon, Plane, Ship, Users,
  FileText, Loader2, CheckCircle2, Archive,
} from 'lucide-react';
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

/** Groupes de statuts — une demande n'apparaît que dans UN seul onglet métier. */
const S = {
  devis: ['QUOTE_REQUESTED', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'QUOTE_REFUSED'],
  traiter: ['SUBMITTED', 'IN_REVIEW', 'AWAITING_CLIENT', 'EN_RECHERCHE_DEPART', 'STALE'],
  encours: [
    'CONFIRMED', 'DEPARTURE_CONFIRMED', 'ASSIGNED', 'COLLECTING', 'COLLECTED', 'WEIGHED',
    'ARRIVED_HUB', 'IN_TRANSIT', 'CUSTOMS', 'OUT_FOR_DELIVERY', 'SOURCING', 'PROCURED',
    'RETURN_REQUESTED', 'RETURN_IN_PROGRESS',
  ],
  termines: ['DELIVERED', 'CLOSED', 'RETURNED'],
  archives: ['CANCELLED', 'ARCHIVED'],
};
/** Masqué partout sauf dans l'onglet Archivés. */
const HIDE_DEAD = S.archives;

const TABS = [
  'traiter', 'devis', 'encours', 'gp', 'aerien', 'maritime', 'routier',
  'reception', 'sourcing', 'termines', 'archives', 'audit',
] as const;
type TabId = typeof TABS[number];
const DEFAULT_TAB: TabId = 'traiter';

/** Anciens liens (?tab=demandes / ?tab=tous) → onglet de travail. */
const ALIASES: Record<string, TabId> = { demandes: 'traiter', tous: 'traiter' };

const TAB_META: Record<TabId, { label: string; subtitle: string }> = {
  traiter:   { label: 'À traiter',   subtitle: 'File de travail — nouvelles demandes et dossiers en attente d’action de votre part.' },
  devis:     { label: 'Devis',       subtitle: 'Toutes les demandes de devis, du premier contact à l’acceptation.' },
  encours:   { label: 'En cours',    subtitle: 'Dossiers confirmés, en collecte, en transit ou en livraison.' },
  gp:        { label: 'GP',          subtitle: 'Bagage accompagné — dossiers rattachés à un transporteur GP.' },
  aerien:    { label: 'Cargo aérien', subtitle: 'Fret cargo aérien — devis indicatifs et dossiers confirmés.' },
  maritime:  { label: 'Maritime',    subtitle: 'Fret maritime (LCL).' },
  routier:   { label: 'Routier',     subtitle: 'Courses Terminal D — national et pays voisins.' },
  reception: { label: 'Réception',   subtitle: 'Colis reçus en entrepôt.' },
  sourcing:  { label: 'Sourcing',    subtitle: 'Achats pour le compte du client.' },
  termines:  { label: 'Terminés',    subtitle: 'Dossiers livrés, clôturés ou retournés.' },
  archives:  { label: 'Archivés',    subtitle: 'Annulés et archivés — hors de la file de travail.' },
  audit:     { label: 'Audit & Test', subtitle: 'Contrôles internes.' },
};

export function DossiersHubTab({ fretOnly = false }: { fretOnly?: boolean }) {
  const [sp, setSp] = useSearchParams();
  const raw = sp.get('tab') || '';
  const resolved = (ALIASES[raw] ?? raw) as TabId;
  const tab: TabId = TABS.includes(resolved) ? resolved : DEFAULT_TAB;
  const [intakeOpen, setIntakeOpen] = useState(false);
  const { data: unassignedCount = 0 } = useInboxUnassignedCount(!fretOnly);

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

  const meta = TAB_META[tab];

  return (
    <DossierSheetProvider>
      <div className="space-y-3 md:space-y-4">
        <div className="hidden md:block">
          <HubHeader
            title="Dossiers"
            subtitle="Une demande n’apparaît que dans un seul onglet : à traiter, devis, en cours, terminés ou archivés."
            actions={
              <Button size="sm" onClick={() => setIntakeOpen(true)} aria-label="Nouveau dossier">
                <Plus className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline">Nouveau dossier</span>
              </Button>
            }
          />
        </div>

        <Tabs value={tab} onValueChange={onChange}>
          <div className="flex items-center gap-2">
            <TabsList className="flex-1 md:flex-none justify-start overflow-x-auto">
              <HubTab
                value="traiter"
                icon={Inbox}
                label="À traiter"
                badge={unassignedCount > 0 ? (
                  <span className="ml-1 text-[10px] bg-orange-500 text-white rounded-full px-1.5 py-0.5 tabular-nums">
                    {unassignedCount}
                  </span>
                ) : undefined}
              />
              <HubTab value="devis"     icon={FileText}     label="Devis" />
              <HubTab value="encours"   icon={Loader2}      label="En cours" />
              <HubTab value="gp"        icon={Users}        label="GP" />
              <HubTab value="aerien"    icon={Plane}        label="Cargo aérien" />
              <HubTab value="maritime"  icon={Ship}         label="Maritime" />
              <HubTab value="routier"   icon={RouteIcon}    label="Routier" />
              <HubTab value="reception" icon={PackageOpen}  label="Réception" />
              <HubTab value="sourcing"  icon={ShoppingCart} label="Sourcing" />
              <HubTab value="termines"  icon={CheckCircle2} label="Terminés" />
              <HubTab value="archives"  icon={Archive}      label="Archivés" />
              <HubTab value="audit"     icon={ShieldCheck}  label="Audit & Test" />
            </TabsList>
            <Button size="icon" className="md:hidden h-9 w-9 shrink-0" onClick={() => setIntakeOpen(true)} aria-label="Nouveau dossier">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Repère permanent : on sait toujours dans quel onglet on travaille. */}
          <div className="mt-3 rounded-lg border border-primary/30 border-l-4 border-l-primary bg-primary/5 px-3 py-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary">{meta.label}</p>
              <p className="text-[11px] text-muted-foreground leading-snug">{meta.subtitle}</p>
            </div>
            {(tab === 'aerien' || tab === 'maritime') && (
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <Link to="/admin/departs?tab=air-mer">
                  {tab === 'aerien' ? <Plane className="w-4 h-4 mr-1" /> : <Ship className="w-4 h-4 mr-1" />}
                  Départs & partenaires
                </Link>
              </Button>
            )}
          </div>

          <TabsContent value="traiter" className="mt-3 md:mt-4">
            <RequestsTab hideHeader includeStatuses={S.traiter} excludeStatuses={HIDE_DEAD} />
          </TabsContent>

          <TabsContent value="devis" className="mt-3 md:mt-4">
            <RequestsTab hideHeader includeStatuses={S.devis} excludeStatuses={HIDE_DEAD} />
          </TabsContent>

          <TabsContent value="encours" className="mt-3 md:mt-4">
            <RequestsTab hideHeader includeStatuses={S.encours} excludeStatuses={HIDE_DEAD} />
          </TabsContent>

          <TabsContent value="gp" className="mt-3 md:mt-4">
            <RequestsTab hideHeader transportModes={['gp']} excludeStatuses={HIDE_DEAD} />
          </TabsContent>
          <TabsContent value="aerien" className="mt-3 md:mt-4">
            <RequestsTab hideHeader transportModes={['air']} excludeStatuses={HIDE_DEAD} />
          </TabsContent>
          <TabsContent value="maritime" className="mt-3 md:mt-4">
            <RequestsTab hideHeader transportModes={['sea']} excludeStatuses={HIDE_DEAD} />
          </TabsContent>
          <TabsContent value="routier" className="mt-3 md:mt-4"><FretDossiersList /></TabsContent>

          <TabsContent value="reception" className="mt-3 md:mt-4"><ReceptionKanbanTab /></TabsContent>
          <TabsContent value="sourcing"  className="mt-3 md:mt-4"><SourcingTab /></TabsContent>

          <TabsContent value="termines" className="mt-3 md:mt-4">
            <RequestsTab hideHeader includeStatuses={S.termines} excludeStatuses={HIDE_DEAD} />
          </TabsContent>
          <TabsContent value="archives" className="mt-3 md:mt-4">
            <RequestsTab hideHeader includeStatuses={S.archives} />
          </TabsContent>

          <TabsContent value="audit" className="mt-3 md:mt-4"><ClientAuditPanel /></TabsContent>
        </Tabs>
      </div>

      <NewIntakeDialog open={intakeOpen} onOpenChange={setIntakeOpen} />

      <AdminDossierSheet />
    </DossierSheetProvider>
  );
}
