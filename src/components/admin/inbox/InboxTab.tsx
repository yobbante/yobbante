import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, Loader2, Upload } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useInboxDossiers, type InboxDossier } from '@/hooks/useInboxDossiers';
import { useInboxStats } from '@/hooks/useInboxStats';
import { InboxCard } from './InboxCard';
import { InboxFilters, type InboxFilterState } from './InboxFilters';
import { NewIntakeDialog } from './NewIntakeDialog';
import { InboxKpiCards } from './InboxKpiCards';
import { HistoryColumn } from './HistoryColumn';
import { detectServiceKind, SERVICE_KINDS } from '@/lib/intakeSources';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SendEditLinkDialog } from '../SendEditLinkDialog';
import { DeliveryFinalePanel } from './DeliveryFinalePanel';
import { Pencil } from 'lucide-react';

const COLS = [
  { id: 'todo',      title: 'À traiter',         statuses: ['SUBMITTED', 'IN_REVIEW'] },
  { id: 'awaiting',  title: 'En attente client', statuses: ['AWAITING_CLIENT'] },
  { id: 'confirmed', title: 'Confirmés',          statuses: ['CONFIRMED'] },
] as const;

function buildClientRecap(d: InboxDossier) {
  const kind = detectServiceKind(d);
  const serviceLabel = SERVICE_KINDS.find(s => s.id === kind)?.label || 'Demande';
  const tracking = `https://yobbante.com/suivre?ref=${d.reference}`;
  return (
    `Bonjour ${d.buyer_name || ''}, ici Yobbanté.\n\n` +
    `Suite à notre échange, voici le récap de votre demande :\n` +
    `${serviceLabel}\n` +
    `${d.origin_country} -> ${d.destination_country}\n` +
    (d.estimated_weight ? `${d.estimated_weight} kg\n` : '') +
    (d.estimated_cost ? `Estimation : ${Math.round(d.estimated_cost * 655.957)} XOF\n` : '') +
    `Numéro de suivi : ${d.reference}\n` +
    `Suivre : ${tracking}\n\n` +
    `Pour confirmer, répondez OUI ou cliquez sur le lien ci-dessus.\n` +
    `Merci de votre confiance.`
  );
}

export function InboxTab() {
  const { data: dossiers = [], isLoading, refetch, updateStatus } = useInboxDossiers();
  const stats = useInboxStats(dossiers);
  const [filters, setFilters] = useState<InboxFilterState>({ search: '', sources: [], kinds: [] });
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [detail, setDetail] = useState<InboxDossier | null>(null);
  const [editLinkType, setEditLinkType] = useState<'dossier_client' | 'dossier_destinataire' | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'history' ? 'history' : 'kanban';

  const filtered = useMemo(() => {
    return dossiers.filter(d => {
      if (filters.sources.length && !filters.sources.includes(d.source as any)) return false;
      if (filters.kinds.length && !filters.kinds.includes(detectServiceKind(d))) return false;
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const hay = `${d.reference} ${d.buyer_name || ''} ${d.contact_phone || ''} ${d.contact_email || ''} ${d.product_description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dossiers, filters]);

  const byCol = useMemo(() => {
    const map: Record<string, InboxDossier[]> = { todo: [], awaiting: [], confirmed: [] };
    for (const d of filtered) {
      for (const c of COLS) {
        if ((c.statuses as readonly string[]).includes(d.status)) { map[c.id].push(d); break; }
      }
    }
    return map;
  }, [filtered]);

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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Inbox</h1>
          <p className="text-sm text-muted-foreground">Toutes les demandes — site, WhatsApp, appels, email…</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/inbox/import"><Upload className="w-4 h-4 mr-1" /> Import Excel</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={() => setIntakeOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nouveau dossier
          </Button>
        </div>
      </div>

      <InboxKpiCards stats={stats} />

      <Tabs value={tab} onValueChange={v => { const sp = new URLSearchParams(searchParams); if (v === 'history') sp.set('tab', 'history'); else sp.delete('tab'); setSearchParams(sp, { replace: true }); }}>
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="space-y-4 mt-4">
          <InboxFilters value={filters} onChange={setFilters} />

          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {COLS.map(col => (
                <div key={col.id} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
                    <span className="text-xs text-muted-foreground">{byCol[col.id].length}</span>
                  </div>
                  <div className="space-y-2 min-h-[200px] p-2 rounded-lg bg-muted/30">
                    {byCol[col.id].length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">Aucun dossier</p>
                    ) : (
                      byCol[col.id].map(d => (
                        <InboxCard
                          key={d.id}
                          dossier={d}
                          onView={setDetail}
                          onConfirm={handleConfirm}
                          onWhatsApp={handleWhatsApp}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryColumn />
        </TabsContent>
      </Tabs>

      <NewIntakeDialog open={intakeOpen} onOpenChange={setIntakeOpen} />

      <Sheet open={!!detail} onOpenChange={v => !v && setDetail(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>{detail.reference}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-3 text-sm">
                <div><span className="text-muted-foreground">Client :</span> {detail.buyer_name || '—'}</div>
                <div><span className="text-muted-foreground">Téléphone :</span> {detail.contact_phone || '—'}</div>
                <div><span className="text-muted-foreground">Email :</span> {detail.contact_email || '—'}</div>
                <div><span className="text-muted-foreground">Canal :</span> {detail.source}</div>
                {detail.source_reference && (
                  <div><span className="text-muted-foreground">Réf. canal :</span> {detail.source_reference}</div>
                )}
                <div><span className="text-muted-foreground">Route :</span> {detail.origin_country} → {detail.destination_country}</div>
                {detail.estimated_weight && <div><span className="text-muted-foreground">Poids :</span> {detail.estimated_weight} kg</div>}
                {detail.estimated_cost != null && <div><span className="text-muted-foreground">Estimation :</span> {Math.round(detail.estimated_cost)} €</div>}
                <div><span className="text-muted-foreground">Description :</span><br />{detail.product_description}</div>
                {detail.intake_notes && (
                  <div className="p-3 rounded bg-muted/50">
                    <div className="text-xs font-semibold mb-1">Notes internes</div>
                    {detail.intake_notes}
                  </div>
                )}
                <div className="pt-2 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleWhatsApp(detail)} disabled={!detail.contact_phone}>
                    Récap WhatsApp client
                  </Button>
                  {detail.status !== 'CONFIRMED' && (
                    <Button size="sm" variant="outline" onClick={() => { handleConfirm(detail); setDetail(null); }}>
                      Marquer confirmé
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setEditLinkType('dossier_client')} disabled={!detail.contact_phone}>
                    <Pencil className="w-3 h-3 mr-1" /> Lien modif. expéditeur
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditLinkType('dossier_destinataire')} disabled={!detail.contact_phone}>
                    <Pencil className="w-3 h-3 mr-1" /> Lien modif. destinataire
                  </Button>
                </div>

                {(detail.status === 'ARRIVED_HUB' || detail.status === 'DELIVERED' || detail.delivery_mode) && (
                  <DeliveryFinalePanel dossier={detail} onChanged={() => { refetch(); }} />
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {detail && editLinkType && (
        <SendEditLinkDialog
          open={!!editLinkType}
          onOpenChange={(v) => { if (!v) setEditLinkType(null); }}
          entityType={editLinkType}
          entityId={detail.id}
          recipientPhone={detail.contact_phone}
          recipientFirstName={(detail.buyer_name || '').split(' ')[0]}
          trackingLabel={detail.reference}
        />
      )}
    </div>
  );
}
