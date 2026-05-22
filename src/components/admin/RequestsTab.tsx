import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Search, ChevronRight, Inbox, ExternalLink, Mail, Phone,
  Weight, Wallet, Calendar, MapPin, Building2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  COUNTRY_FLAGS, DOSSIER_STATUS_LABELS, DOSSIER_STATUS_ORDER,
  type Dossier, type DossierStatus,
} from '@/lib/types';
import { getStatutsPourDossier } from '@/lib/dossierStatuts';
import { toast } from 'sonner';

const TYPE_FILTERS = [
  { id: 'all',      label: 'Tous' },
  { id: 'send',     label: 'Expédier' },
  { id: 'receive',  label: 'Recevoir' },
  { id: 'sourcing', label: 'Sourcing' },
] as const;

type TypeFilter = typeof TYPE_FILTERS[number]['id'];

function getKind(d: Dossier): TypeFilter {
  if (d.needs_sourcing) return 'sourcing';
  if (d.app_source === 'expedier') return 'send';
  return 'receive';
}

const KIND_BADGE: Record<TypeFilter, string> = {
  all: '',
  send: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  receive: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  sourcing: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
};

const STATUS_TONE: Partial<Record<DossierStatus, string>> = {
  SUBMITTED: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  IN_REVIEW: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  SOURCING: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  PROCURED: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  IN_TRANSIT: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  CUSTOMS: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  DELIVERED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  CLOSED: 'bg-secondary text-muted-foreground border-border',
};

const PAGE_SIZE = 50;

export function RequestsTab() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<TypeFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Open + scroll to a row from dashboard "Activité récente" deep-link
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { service?: string; id?: string };
      if (detail?.service !== 'expedier' || !detail.id) return;
      setExpandedId(detail.id);
      setTimeout(() => {
        const el = document.querySelector(`[data-dossier-id="${detail.id}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    };
    window.addEventListener('admin:focus', handler);
    return () => window.removeEventListener('admin:focus', handler);
  }, []);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['admin-requests', limit],
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('id, reference, product_description, status, origin_country, destination_country, needs_sourcing, app_source, business_id, contact_email, contact_phone, estimated_weight, budget_eur, estimated_delivery_date, notes, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as Dossier[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DossierStatus }) => {
      const { error } = await supabase.from('dossiers').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Statut mis à jour');
      qc.invalidateQueries({ queryKey: ['admin-requests'] });
      qc.invalidateQueries({ queryKey: ['admin-overview'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Échec mise à jour'),
  });

  const counts = useMemo(() => {
    const c: Record<TypeFilter, number> = { all: dossiers.length, send: 0, receive: 0, sourcing: 0 };
    dossiers.forEach(d => { c[getKind(d)]++; });
    return c;
  }, [dossiers]);

  const filtered = useMemo(() => {
    return dossiers.filter(d => {
      if (kind !== 'all' && getKind(d) !== kind) return false;
      if (q) {
        const s = q.toLowerCase();
        return (
          d.reference.toLowerCase().includes(s) ||
          d.product_description.toLowerCase().includes(s) ||
          (d.contact_email || '').toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [dossiers, q, kind]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Demandes clients</h1>
        <p className="text-sm text-muted-foreground">
          Inbox unifié — clic pour développer, double-clic pour ouvrir la fiche complète.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Réf, produit, email…"
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
          {TYPE_FILTERS.map(f => {
            const active = kind === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setKind(f.id)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors inline-flex items-center gap-1.5',
                  active
                    ? 'bg-foreground text-background'
                    : 'bg-secondary text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
                <span className={cn(
                  'tabular-nums text-[10px] px-1 rounded',
                  active ? 'bg-background/20' : 'bg-background/40',
                )}>
                  {counts[f.id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Inbox className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">Aucune demande</p>
          <p className="text-xs text-muted-foreground mt-1">Ajustez vos filtres.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-xl bg-card overflow-hidden">
          {filtered.map(d => {
            const k = getKind(d);
            const isOpen = expandedId === d.id;
            return (
              <li key={d.id} data-dossier-id={d.id}>
                {/* Header — click to toggle */}
                <button
                  onClick={() => setExpandedId(isOpen ? null : d.id)}
                  onDoubleClick={() => navigate(`/app/dossier/${d.id}`)}
                  className={cn(
                    'w-full text-left px-4 py-3 flex items-center gap-3 transition-colors',
                    isOpen ? 'bg-secondary/40' : 'hover:bg-secondary/30',
                  )}
                  aria-expanded={isOpen}
                >
                  <span className="text-lg">{COUNTRY_FLAGS[d.origin_country] || '🌍'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-[11px] flex-wrap">
                      <span className="font-mono text-foreground font-semibold">{d.reference}</span>
                      <span className={cn(
                        'px-1.5 py-0.5 rounded border uppercase tracking-wide text-[10px]',
                        KIND_BADGE[k],
                      )}>
                        {k === 'send' ? 'Expédier' : k === 'sourcing' ? 'Sourcing' : 'Recevoir'}
                      </span>
                      <span className={cn(
                        'px-1.5 py-0.5 rounded border text-[10px]',
                        STATUS_TONE[d.status] || 'bg-secondary text-muted-foreground border-border',
                      )}>
                        {DOSSIER_STATUS_LABELS[d.status]}
                      </span>
                      {d.business_id && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px]">
                          <Building2 className="w-2.5 h-2.5" /> Business
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground truncate mt-0.5">{d.product_description}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums hidden sm:inline">
                    {new Date(d.created_at).toLocaleDateString('fr-FR')}
                  </span>
                  <ChevronRight
                    className={cn(
                      'w-4 h-4 text-muted-foreground transition-transform',
                      isOpen && 'rotate-90',
                    )}
                  />
                </button>

                {/* Expandable details */}
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 bg-secondary/20 border-t border-border space-y-3">
                    {/* Quick info grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <Info icon={MapPin} label="Origine → Dest.">
                        {d.origin_country} → {d.destination_country}
                      </Info>
                      <Info icon={Weight} label="Poids estimé">
                        {d.estimated_weight ? `${d.estimated_weight} kg` : '—'}
                      </Info>
                      <Info icon={Wallet} label="Budget">
                        {d.budget_eur ? `${d.budget_eur} €` : '—'}
                      </Info>
                      <Info icon={Calendar} label="Livraison estimée">
                        {d.estimated_delivery_date
                          ? new Date(d.estimated_delivery_date).toLocaleDateString('fr-FR')
                          : '—'}
                      </Info>
                    </div>

                    {/* Contact */}
                    {(d.contact_email || d.contact_phone) && (
                      <div className="flex flex-wrap gap-3 text-xs">
                        {d.contact_email && (
                          <a
                            href={`mailto:${d.contact_email}`}
                            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                          >
                            <Mail className="w-3.5 h-3.5" /> {d.contact_email}
                          </a>
                        )}
                        {d.contact_phone && (
                          <a
                            href={`tel:${d.contact_phone}`}
                            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                          >
                            <Phone className="w-3.5 h-3.5" /> {d.contact_phone}
                          </a>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    {d.notes && (
                      <div className="text-xs">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          Notes client
                        </p>
                        <p className="text-foreground bg-background border border-border rounded-md p-2 whitespace-pre-wrap">
                          {d.notes}
                        </p>
                      </div>
                    )}

                    {/* Actions: status + open */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Statut
                        </span>
                        <Select
                          value={d.status}
                          onValueChange={(v) => updateStatus.mutate({ id: d.id, status: v as DossierStatus })}
                        >
                          <SelectTrigger className="h-8 w-56 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {getStatutsPourDossier({
                              app_source: d.app_source,
                              needs_sourcing: d.needs_sourcing,
                            }).map(s => (
                              <SelectItem key={s.value} value={s.value} className="text-xs">
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/app/dossier/${d.id}`)}
                        className="text-xs h-8"
                      >
                        Ouvrir la fiche
                        <ExternalLink className="w-3 h-3 ml-1.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!isLoading && dossiers.length >= limit && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLimit(l => l + PAGE_SIZE)}
            className="text-xs h-8"
          >
            Charger {PAGE_SIZE} de plus ({dossiers.length} affichés)
          </Button>
        </div>
      )}
    </div>
  );
}

function Info({
  icon: Icon, label, children,
}: { icon: typeof Inbox; label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
        <Icon className="w-3 h-3" /> {label}
      </p>
      <p className="text-foreground font-medium truncate">{children}</p>
    </div>
  );
}
