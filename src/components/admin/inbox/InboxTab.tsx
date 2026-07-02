import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, Loader2, Upload, LayoutGrid, List as ListIcon, Inbox as InboxIcon, Copy } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useInboxDossiers, type InboxDossier } from '@/hooks/useInboxDossiers';
import { useInboxStats } from '@/hooks/useInboxStats';
import { InboxFilters, EMPTY_FILTERS, type InboxFilterState } from './InboxFilters';
import { InboxListView } from './InboxListView';
import { InboxKanban } from './InboxKanban';
import { NewIntakeDialog } from './NewIntakeDialog';
import { InboxKpiCards } from './InboxKpiCards';
import { HistoryColumn } from './HistoryColumn';
import { detectServiceKind, SERVICE_KINDS } from '@/lib/intakeSources';
import { applyInboxFilters } from '@/lib/inboxFilters';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useDossierSheet } from '../dossier-sheet/useDossierSheet';
import { NextActionsSheet } from '@/components/admin/dossiers/NextActionsSheet';

function buildClientRecap(d: InboxDossier) {
  const kind = detectServiceKind(d);
  const serviceLabel = SERVICE_KINDS.find(s => s.id === kind)?.label || 'Demande';
  const tracking = `https://yobbante.com/suivre?ref=${d.reference}`;
  return (
    `Bonjour ${d.buyer_name || ''}, ici Yobbanté.\n\n` +
    `Suite à notre échange, voici le récap de votre demande :\n` +
    `${serviceLabel}\n` +
    `${d.origin_city || d.origin_country} -> ${d.destination_city || d.destination_country}\n` +
    (d.estimated_weight ? `${d.estimated_weight} kg\n` : '') +
    (d.estimated_cost ? `Estimation : ${Math.round(d.estimated_cost * 655.957)} XOF\n` : '') +
    `Numéro de suivi : ${d.reference}\n` +
    `Suivre : ${tracking}\n\n` +
    `Pour confirmer, répondez OUI ou cliquez sur le lien ci-dessus.\n` +
    `Merci de votre confiance.`
  );
}

export function InboxTab() {
  const sheet = useDossierSheet();
  const { data: allDossiers = [], isLoading, refetch, updateStatus } = useInboxDossiers();
  // Flow expédition uniquement : sourcing & réception ont leurs propres onglets.
  const dossiers = useMemo(
    () => allDossiers.filter((d) => detectServiceKind(d) === 'envoi'),
    [allDossiers],
  );
  const stats = useInboxStats(dossiers);
  const [filters, setFilters] = useState<InboxFilterState>(EMPTY_FILTERS);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('view') === 'history' ? 'history' : 'pipeline';

  // Flash + scroll a row after a lifecycle transition (cancel/return/etc.).
  useEffect(() => {
    const focusRow = (id: string) => {
      setTimeout(() => {
        const el = document.querySelector(`[data-dossier-id="${id}"]`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('animate-row-flash');
        setTimeout(() => el.classList.remove('animate-row-flash'), 2600);
      }, 80);
    };
    const onLifecycle = (e: Event) => {
      const detail = (e as CustomEvent).detail as { dossierId?: string };
      if (detail?.dossierId) focusRow(detail.dossierId);
    };
    const onFocus = (e: Event) => {
      const detail = (e as CustomEvent).detail as { service?: string; id?: string };
      if (detail?.service === 'expedier' && detail.id) focusRow(detail.id);
    };
    window.addEventListener('dossier:lifecycle-action', onLifecycle);
    window.addEventListener('admin:focus', onFocus);
    return () => {
      window.removeEventListener('dossier:lifecycle-action', onLifecycle);
      window.removeEventListener('admin:focus', onFocus);
    };
  }, []);

  const filtered = useMemo(() => applyInboxFilters(dossiers, filters), [dossiers, filters]);

  const handleConfirm = (d: InboxDossier) => {
    updateStatus.mutate({ id: d.id, status: 'CONFIRMED' }, {
      onSuccess: () => toast.success(`Dossier ${d.reference} confirmé`),
      onError: () => toast.error('Erreur'),
    });
  };

  const handleWhatsApp = (d: InboxDossier) => {
    if (!d.contact_phone) return;
    const phone = d.contact_phone.replace(/[^\d]/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(buildClientRecap(d))}`, '_blank');
  };

  const copyExpedierLink = async () => {
    await navigator.clipboard.writeText('https://yobbante.com/expedier');
    toast.success('Lien copié');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Demandes entrantes</h1>
          <p className="text-sm text-muted-foreground">Flow expédition Yobbanté — Dakar vers le monde.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/inbox/import"><Upload className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline">Import Excel</span></Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading} aria-label="Rafraîchir">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={() => setIntakeOpen(true)}>
            <Plus className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline">Nouveau dossier</span>
          </Button>
        </div>
      </div>

      <InboxKpiCards stats={stats} />

      <Tabs value={tab} onValueChange={v => { const sp = new URLSearchParams(searchParams); if (v === 'history') sp.set('view', 'history'); else sp.delete('view'); setSearchParams(sp, { replace: true }); }}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
          </TabsList>

          {tab === 'pipeline' && (
            <div className="inline-flex rounded-md border border-border p-0.5">
              <Button
                size="sm" variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                className="h-7 px-2" onClick={() => setViewMode('kanban')}
                aria-label="Vue Kanban"
              >
                <LayoutGrid className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline text-xs">Kanban</span>
              </Button>
              <Button
                size="sm" variant={viewMode === 'list' ? 'default' : 'ghost'}
                className="h-7 px-2" onClick={() => setViewMode('list')}
                aria-label="Vue Liste"
              >
                <ListIcon className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline text-xs">Liste</span>
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="pipeline" className="space-y-4 mt-4">
          <InboxFilters value={filters} onChange={setFilters} />

          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState onCopy={copyExpedierLink} onCreate={() => setIntakeOpen(true)} hasFilters={filters !== EMPTY_FILTERS && (filters.search.length > 0 || filters.sources.length + filters.statuses.length + filters.destinations.length + filters.carriers.length + filters.urgency.length > 0)} />
          ) : viewMode === 'list' ? (
            <InboxListView dossiers={filtered} onView={(d) => sheet.open(d.id)} />
          ) : (
            <InboxKanban
              dossiers={filtered}
              onView={(d) => sheet.open(d.id)}
              onConfirm={handleConfirm}
              onWhatsApp={handleWhatsApp}
              onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
            />
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryColumn />
        </TabsContent>
      </Tabs>

      <NewIntakeDialog open={intakeOpen} onOpenChange={setIntakeOpen} />
    </div>
  );
}

function EmptyState({ onCopy, onCreate, hasFilters }: { onCopy: () => void; onCreate: () => void; hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center mb-4">
        <InboxIcon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-base font-medium text-foreground mb-1">
        {hasFilters ? 'Aucun résultat' : 'Aucune demande en attente'}
      </h3>
      <p className="text-sm text-muted-foreground mb-5">
        {hasFilters ? 'Essayez d’élargir vos filtres.' : 'Partagez votre lien d’expédition ou créez un dossier.'}
      </p>
      {!hasFilters && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCopy}>
            <Copy className="w-4 h-4 mr-1" /> Copier le lien
          </Button>
          <Button size="sm" onClick={onCreate}>
            <Plus className="w-4 h-4 mr-1" /> Créer un dossier
          </Button>
        </div>
      )}
    </div>
  );
}
