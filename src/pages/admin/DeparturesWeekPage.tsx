import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Send, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useManualDepartures, type ManualDeparture } from '@/hooks/useManualDepartures';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useSeo } from '@/hooks/useSeo';

const MODE_ICON: Record<string, string> = {
  air: '✈️',
  sea_lcl: '🚢',
  road: '🚛',
};

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
    const icon = MODE_ICON[d.transport_mode] ?? '📦';
    const date = formatDateShort(d.departure_date);
    return `${icon} ${date} · ${d.origin_city} → ${d.destination_city} · *Réf ${d.short_ref ?? '----'}*`;
  });
  return `📅 *PROCHAINS DÉPARTS YOBBANTÉ*\n\n${lines.join('\n')}\n\n📞 Contactez-nous au +221 78 122 18 91 en indiquant la référence du départ.`;
}

export default function DeparturesWeekPage() {
  useSeo({ title: 'Départs de la semaine · Admin Yobbanté', path: '/admin/departs-semaine' });
  const { list } = useManualDepartures();
  const qc = useQueryClient();
  const [routeFilter, setRouteFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('all');
  const [pubFilter, setPubFilter] = useState('all');
  const [copied, setCopied] = useState(false);

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

  async function markPublished(d: ManualDeparture) {
    const { error } = await supabase
      .from('manual_departures')
      .update({ publication_status: 'published', published_at: new Date().toISOString() })
      .eq('id', d.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Réf #${d.short_ref} marqué comme publié`);
    qc.invalidateQueries({ queryKey: ['manual_departures'] });
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
          <Button onClick={copyWhatsApp} className="gap-2" disabled={upcoming.length === 0}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            Copier texte WhatsApp
          </Button>
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
              <SelectItem value="air">✈️ Air</SelectItem>
              <SelectItem value="sea_lcl">🚢 Mer</SelectItem>
              <SelectItem value="road">🚛 Route</SelectItem>
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
                    <div
                      key={d.id}
                      className="rounded-xl border border-border p-4 bg-card hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="text-xs text-muted-foreground">{MODE_ICON[d.transport_mode]} {d.transport_mode}</div>
                          <div className="font-semibold mt-1">{d.origin_city} → {d.destination_city}</div>
                        </div>
                        <div
                          className="text-right"
                          style={{ color: '#F5C518' }}
                        >
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
                          <Button size="sm" variant="outline" onClick={() => markPublished(d)} className="gap-1">
                            <Send className="w-3 h-3" /> Marquer publié
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
