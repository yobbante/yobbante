import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Send, Filter, Image as ImageIcon, Smartphone, MessageSquarePlus, Plus, Globe, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useManualDepartures, type ManualDeparture } from '@/hooks/useManualDepartures';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useSeo } from '@/hooks/useSeo';
import { WeekExportTemplate } from '@/components/admin/inbox/WeekExportTemplate';
import { DepartureDetailDrawer } from '@/components/admin/inbox/DepartureDetailDrawer';
import { CapacityBar } from '@/components/ui/capacity-bar';
import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { WhatsAppImportDepartureDialog } from '@/components/admin/WhatsAppImportDepartureDialog';
import { ManualDepartureForm } from '@/components/admin/ManualDepartureForm';

const MODE_LABEL: Record<string, string> = { air: 'Air', sea_lcl: 'Mer', road: 'Route' };

const PUB_BADGE: Record<string, { label: string; variant: any }> = {
  draft: { label: 'Brouillon', variant: 'warning' },
  ready: { label: 'Prêt', variant: 'secondary' },
  published: { label: 'Publié', variant: 'success' },
  closed: { label: 'Clôturé', variant: 'secondary' },
  completed: { label: 'Terminé', variant: 'secondary' },
};

function formatDateShort(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}
function formatDayHeader(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function buildWhatsAppText(departures: ManualDeparture[]): string {
  const sorted = [...departures].sort((a, b) => a.departure_date.localeCompare(b.departure_date));
  const lines = sorted.map(d => {
    const date = formatDateShort(d.departure_date);
    const mode = MODE_LABEL[d.transport_mode] ?? d.transport_mode;
    return `- ${date} · ${mode} · ${d.origin_city} -> ${d.destination_city} · *Réf ${d.short_ref ?? '----'}*`;
  });
  return `*PROCHAINS DÉPARTS YOBBANTÉ*\n\n${lines.join('\n')}\n\nContactez-nous au +221 78 926 97 56 en indiquant la référence du départ.`;
}

export default function DeparturesWeekPage() {
  useSeo({ title: 'Départs de la semaine · Admin Yobbanté', path: '/admin/departs-semaine' });
  const { list, remove } = useManualDepartures();
  const qc = useQueryClient();
  const [routeFilter, setRouteFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('all');
  const [pubFilter, setPubFilter] = useState('all');
  const [copied, setCopied] = useState(false);
  const [exportFormat, setExportFormat] = useState<'square' | 'story' | null>(null);
  const [selected, setSelected] = useState<ManualDeparture | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ManualDeparture | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ManualDeparture | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Realtime — refetch on any change to manual_departures
  useEffect(() => {
    const channel = supabase
      .channel('admin-departures-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'manual_departures' },
        () => qc.invalidateQueries({ queryKey: ['manual_departures'] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const upcoming = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const horizon = new Date(today); horizon.setDate(horizon.getDate() + 21);
    const all = list.data ?? [];
    return all.filter(d => {
      const dt = new Date(d.departure_date);
      if (dt < today || dt > horizon) return false;
      if (d.status === 'cancelled' || d.status === 'expired') return false;
      if (modeFilter !== 'all' && d.transport_mode !== modeFilter) return false;
      if (pubFilter !== 'all' && (d.publication_status ?? 'draft') !== pubFilter) return false;
      if (routeFilter) {
        const r = routeFilter.toLowerCase();
        if (!d.origin_city.toLowerCase().includes(r) && !d.destination_city.toLowerCase().includes(r)) return false;
      }
      return true;
    });
  }, [list.data, routeFilter, modeFilter, pubFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ManualDeparture[]>();
    for (const d of upcoming) {
      const k = d.departure_date;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(d);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [upcoming]);

  async function copyWhatsApp() {
    const txt = buildWhatsAppText(upcoming);
    try {
      await navigator.clipboard.writeText(txt);
      setCopied(true);
      toast.success('Message WhatsApp copié');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Impossible de copier');
    }
  }

  async function exportImage(format: 'square' | 'story') {
    setExportFormat(format);
    // wait next paint
    await new Promise(r => setTimeout(r, 100));
    if (!exportRef.current) {
      setExportFormat(null);
      return;
    }
    try {
      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        width: 1080,
        height: format === 'story' ? 1920 : 1080,
      });
      const link = document.createElement('a');
      link.download = `yobbante-departs-${format}-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      toast.success(`Image ${format === 'story' ? '1080×1920' : '1080×1080'} téléchargée`);
    } catch (e: any) {
      toast.error(`Export échoué : ${e.message}`);
    } finally {
      setExportFormat(null);
    }
  }

  async function markPublished(d: ManualDeparture) {
    const { error } = await supabase
      .from('manual_departures')
      .update({ publication_status: 'published', published_at: new Date().toISOString() })
      .eq('id', d.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ['manual_departures'] });

    // Notify GP via WhatsApp (best-effort)
    const phone = (d.carrier_contact ?? '').replace(/\D/g, '');
    if (phone) {
      const date = new Date(d.departure_date).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long',
      });
      const mode = MODE_LABEL[d.transport_mode] ?? d.transport_mode;
      const message =
        `Bonjour ${d.carrier_name ?? ''},\n\n` +
        `Votre départ Yobbanté Réf #${d.short_ref ?? '----'} vient d'être publié.\n` +
        `Route : ${d.origin_city} → ${d.destination_city}\n` +
        `Mode : ${mode}\n` +
        `Date : ${date}\n` +
        `Capacité : ${d.total_capacity_kg} kg\n\n` +
        `Nous vous transmettrons les colis attribués au fur et à mesure.\n— Yobbanté`;
      try {
        const { error: waErr } = await supabase.functions.invoke('send-whatsapp', {
          body: { recipient_phone: phone, message },
        });
        if (waErr) throw waErr;
        toast.success(`Réf #${d.short_ref} publié · GP notifié sur WhatsApp`);
      } catch {
        toast.success(`Réf #${d.short_ref} publié`);
        toast.warning(`Notification WhatsApp non envoyée — contactez ${d.carrier_contact} manuellement.`);
      }
    } else {
      toast.success(`Réf #${d.short_ref} publié`);
      toast.warning('Aucun numéro WhatsApp pour ce GP — notification manuelle requise.');
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-3 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between gap-2 sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/admin/departures" className="text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-bold truncate">Départs de la semaine</h1>
            <p className="hidden sm:block text-xs text-muted-foreground">3 semaines à venir · Publication sur les canaux</p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Button onClick={() => setCreating(true)} size="sm" className="gap-2 h-8 px-2 sm:h-9 sm:px-3" title="Nouveau départ">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nouveau départ</span>
          </Button>
          <Link
            to="/admin/villes"
            className="inline-flex items-center gap-2 h-8 sm:h-9 px-2 sm:px-3 rounded-md border border-input text-sm hover:bg-secondary"
            title="Gérer les villes personnalisées"
          >
            <Globe className="w-4 h-4" /> <span className="hidden sm:inline">Villes</span>
          </Link>
          <Button onClick={() => setImportOpen(true)} size="sm" variant="outline" className="hidden sm:inline-flex gap-2" title="Importer depuis WhatsApp">
            <MessageSquarePlus className="w-4 h-4" /> <span className="hidden sm:inline">Importer depuis WhatsApp</span>
          </Button>
          <Button onClick={copyWhatsApp} size="sm" variant="outline" className="gap-2 h-8 px-2 sm:h-9 sm:px-3" disabled={upcoming.length === 0} title="Copier texte WhatsApp">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline">Copier texte WhatsApp</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-2 h-8 px-2 sm:h-9 sm:px-3" disabled={upcoming.length === 0 || exportFormat !== null} title="Exporter image">
                <ImageIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{exportFormat ? 'Génération…' : 'Exporter image'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setImportOpen(true)} className="gap-2 sm:hidden">
                <MessageSquarePlus className="w-4 h-4" /> Importer depuis WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportImage('square')} className="gap-2">
                <ImageIcon className="w-4 h-4" /> Carré 1080×1080 (Instagram, Facebook)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportImage('story')} className="gap-2">
                <Smartphone className="w-4 h-4" /> Story 1080×1920 (WhatsApp, Stories)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-3 sm:py-6 space-y-4 sm:space-y-6">
        {/* Filters */}
        <div className="flex gap-2 items-center overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0 hidden sm:block" />
          <Input
            placeholder="Filtrer…"
            value={routeFilter}
            onChange={e => setRouteFilter(e.target.value)}
            className="h-8 sm:h-10 text-sm min-w-[120px] max-w-[160px] sm:max-w-xs"
          />
          <Select value={modeFilter} onValueChange={setModeFilter}>
            <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm w-[110px] sm:w-[150px] shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous modes</SelectItem>
              <SelectItem value="air">Air</SelectItem>
              <SelectItem value="sea_lcl">Mer</SelectItem>
              <SelectItem value="road">Route</SelectItem>
            </SelectContent>
          </Select>
          <Select value={pubFilter} onValueChange={setPubFilter}>
            <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm w-[120px] sm:w-[150px] shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts pub</SelectItem>
              <SelectItem value="draft">Brouillon</SelectItem>
              <SelectItem value="ready">Prêt</SelectItem>
              <SelectItem value="published">Publié</SelectItem>
              <SelectItem value="closed">Clôturé</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Groups */}
        {list.isLoading ? (
          <div className="text-sm text-muted-foreground">Chargement…</div>
        ) : grouped.length === 0 ? (
          <div className="rounded-xl border border-border p-10 text-center text-muted-foreground">
            Aucun départ planifié pour les 3 prochaines semaines.
          </div>
        ) : (
          grouped.map(([date, deps]) => (
            <section key={date}>
              <h2 className="text-[11px] sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 sm:mb-3 sticky top-[52px] sm:static bg-background/95 backdrop-blur py-1 z-[5]">
                {formatDayHeader(date)}
              </h2>
              <div className="grid sm:grid-cols-2 gap-1.5 sm:gap-3">
                {deps.map(d => {
                  const remaining = d.available_capacity_kg;
                  const total = d.total_capacity_kg;
                  const used = Math.max(0, total - remaining);
                  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
                  return (
                    <button
                      key={d.id}
                      onClick={() => setSelected(d)}
                      className="text-left rounded-lg sm:rounded-xl border border-border p-2.5 sm:p-4 bg-card hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5 sm:mb-3">
                        <div className="min-w-0">
                          <div className="hidden sm:block text-xs text-muted-foreground">{MODE_LABEL[d.transport_mode]}</div>
                          <div className="font-semibold text-sm sm:text-base sm:mt-1 truncate">{d.origin_city} → {d.destination_city}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {d.carrier_name ?? '—'} · {used}kg / {total}kg
                          </div>
                        </div>
                        <div className="text-right shrink-0" style={{ color: '#F5C518' }}>
                          <div className="hidden sm:block text-[10px] uppercase tracking-wider text-muted-foreground">Réf</div>
                          <div className="text-base sm:text-2xl font-bold font-mono">#{d.short_ref ?? '----'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                        <CapacityBar value={pct} ariaLabel="Capacité utilisée" className="flex-1" />
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider rounded-full px-1.5 py-0.5 shrink-0"
                          style={{
                            background: remaining > 15 ? '#10b98122' : remaining >= 5 ? '#f59e0b22' : '#ef444422',
                            color: remaining > 15 ? '#10b981' : remaining >= 5 ? '#f59e0b' : '#ef4444',
                          }}
                          title="Capacité restante"
                        >
                          {remaining}kg libre
                        </span>
                      </div>
                      <AssignedDossiersList departureId={d.id} />
                      <div className="flex items-center justify-end gap-1 mt-1.5 sm:mt-3">
                        <span
                          role="button"
                          onClick={(e) => { e.stopPropagation(); setEditing(d); }}
                          className="inline-flex items-center gap-1 text-[11px] sm:text-xs px-2 py-1 rounded-md border border-border hover:bg-secondary"
                        >
                          <Pencil className="w-3 h-3" /> Modifier
                        </span>
                        <span
                          role="button"
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(d); }}
                          className="inline-flex items-center gap-1 text-[11px] sm:text-xs px-2 py-1 rounded-md border border-border text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3 h-3" /> Supprimer
                        </span>
                      </div>

                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      {/* Offscreen export template */}
      {exportFormat && (
        <div style={{ position: 'fixed', top: -10000, left: -10000, pointerEvents: 'none' }}>
          <WeekExportTemplate ref={exportRef} departures={upcoming} format={exportFormat} />
        </div>
      )}

      <DepartureDetailDrawer departure={selected} onClose={() => setSelected(null)} />
      <WhatsAppImportDepartureDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ['manual_departures'] })}
      />
      <ManualDepartureForm
        open={creating || !!editing}
        departure={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce départ ?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete && `${confirmDelete.origin_city} → ${confirmDelete.destination_city} · Réf #${confirmDelete.short_ref ?? '----'}`}
              <br />
              Action définitive. Si des colis sont déjà assignés, détachez-les d'abord.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await remove.mutateAsync(confirmDelete.id);
                  toast.success('Départ supprimé');
                  setConfirmDelete(null);
                } catch (e: any) {
                  toast.error(e.message ?? 'Suppression impossible');
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
}

function AssignedDossiersList({ departureId }: { departureId: string }) {
  const { data } = useQuery({
    queryKey: ['departure-dossiers', departureId],
    queryFn: async () => {
      const { data } = await supabase
        .from('dossiers')
        .select('id, tracking_id, reference, status, actual_weight_kg, estimated_weight')
        .eq('assigned_departure_id', departureId)
        .order('created_at', { ascending: false });
      return (data ?? []) as any[];
    },
  });
  if (!data || data.length === 0) {
    return (
      <div className="text-[11px] text-muted-foreground italic">
        Aucun colis assigné à ce départ
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        <Package className="w-3 h-3" /> {data.length} colis assigné{data.length > 1 ? 's' : ''}
      </div>
      <ul className="space-y-0.5 max-h-24 overflow-y-auto">
        {data.slice(0, 6).map((d) => (
          <li key={d.id} className="text-[11px] text-foreground/80 font-mono flex items-center justify-between gap-2">
            <span className="truncate">{d.tracking_id ?? d.reference}</span>
            <span className="text-muted-foreground tabular-nums">
              {d.actual_weight_kg ?? d.estimated_weight ?? '—'}kg
            </span>
          </li>
        ))}
        {data.length > 6 && (
          <li className="text-[10px] text-muted-foreground italic">+{data.length - 6} autres</li>
        )}
      </ul>
    </div>
  );
}
