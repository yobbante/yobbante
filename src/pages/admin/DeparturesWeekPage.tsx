import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Send, Filter, Image as ImageIcon, Smartphone } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useSeo } from '@/hooks/useSeo';
import { WeekExportTemplate } from '@/components/admin/inbox/WeekExportTemplate';
import { DepartureDetailDrawer } from '@/components/admin/inbox/DepartureDetailDrawer';
import { CapacityBar } from '@/components/ui/capacity-bar';
import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';

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
  return `*PROCHAINS DÉPARTS YOBBANTÉ*\n\n${lines.join('\n')}\n\nContactez-nous au +221 78 122 18 91 en indiquant la référence du départ.`;
}

export default function DeparturesWeekPage() {
  useSeo({ title: 'Départs de la semaine · Admin Yobbanté', path: '/admin/departs-semaine' });
  const { list } = useManualDepartures();
  const qc = useQueryClient();
  const [routeFilter, setRouteFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('all');
  const [pubFilter, setPubFilter] = useState('all');
  const [copied, setCopied] = useState(false);
  const [exportFormat, setExportFormat] = useState<'square' | 'story' | null>(null);
  const [selected, setSelected] = useState<ManualDeparture | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

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
      <header className="border-b border-border px-6 py-4 flex items-center justify-between gap-3 sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link to="/admin/departures" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold">Départs de la semaine</h1>
            <p className="text-xs text-muted-foreground">3 semaines à venir · Publication sur les canaux</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={copyWhatsApp} variant="outline" className="gap-2" disabled={upcoming.length === 0}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            Copier texte WhatsApp
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2" disabled={upcoming.length === 0 || exportFormat !== null}>
                <ImageIcon className="w-4 h-4" />
                {exportFormat ? 'Génération…' : 'Exporter image'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filtrer par route…"
            value={routeFilter}
            onChange={e => setRouteFilter(e.target.value)}
            className="max-w-xs"
          />
          <Select value={modeFilter} onValueChange={setModeFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous modes</SelectItem>
              <SelectItem value="air">Air</SelectItem>
              <SelectItem value="sea_lcl">Mer</SelectItem>
              <SelectItem value="road">Route</SelectItem>
            </SelectContent>
          </Select>
          <Select value={pubFilter} onValueChange={setPubFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
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
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {formatDayHeader(date)}
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {deps.map(d => {
                  const remaining = d.available_capacity_kg;
                  const total = d.total_capacity_kg;
                  const pub = PUB_BADGE[d.publication_status ?? 'draft'];
                  return (
                    <button
                      key={d.id}
                      onClick={() => setSelected(d)}
                      className="text-left rounded-xl border border-border p-4 bg-card hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="text-xs text-muted-foreground">{MODE_LABEL[d.transport_mode]}</div>
                          <div className="font-semibold mt-1">{d.origin_city} → {d.destination_city}</div>
                        </div>
                        <div className="text-right" style={{ color: '#F5C518' }}>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Réf</div>
                          <div className="text-2xl font-bold font-mono">#{d.short_ref ?? '----'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                        <span>{d.carrier_name ?? '—'}</span>
                        <span>·</span>
                        <span>{remaining}kg / {total}kg dispo</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={pub.variant}>{pub.label}</Badge>
                        {(d.publication_status ?? 'draft') !== 'published' && (
                          <span
                            role="button"
                            onClick={(e) => { e.stopPropagation(); markPublished(d); }}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-secondary"
                          >
                            <Send className="w-3 h-3" /> Marquer publié
                          </span>
                        )}
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
    </div>
  );
}
