import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Search, ShoppingCart, Wallet, Package, Phone, Mail,
  ExternalLink, ChevronRight, Send, CheckCircle2, Loader2,
} from 'lucide-react';
import {
  type Dossier, type DossierStatus, COUNTRY_FLAGS,
  DOSSIER_STATUS_LABELS, DOSSIER_STATUS_ORDER,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useDossierSheet } from './dossier-sheet/useDossierSheet';

interface ParsedNotes {
  intent?: string;
  quantity?: number;
  includesShipping?: boolean;
  transport?: string;
  urgency?: string;
  whatsapp?: string;
  contact?: string;
}

function parseNotes(notes: string | null): ParsedNotes {
  if (!notes) return {};
  const out: ParsedNotes = {};
  for (const raw of notes.split('\n')) {
    const line = raw.trim();
    const [k, ...rest] = line.split(':');
    const v = rest.join(':').trim();
    if (!k || !v) continue;
    const key = k.toLowerCase();
    if (key === 'intent') out.intent = v;
    else if (key === 'quantité' || key === 'quantite') out.quantity = Number(v) || undefined;
    else if (key.startsWith('inclut livraison')) out.includesShipping = v.toLowerCase().includes('oui');
    else if (key === 'transport') out.transport = v;
    else if (key === 'urgence') out.urgency = v;
    else if (key === 'whatsapp') out.whatsapp = v;
    else if (key === 'contact') out.contact = v;
  }
  return out;
}

function isProductUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

export function SourcingTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DossierStatus | 'ALL'>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Open detail from dashboard "Activité récente" deep-link
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { service?: string; id?: string };
      if (detail?.service === 'sourcing' && detail.id) setSelectedId(detail.id);
    };
    window.addEventListener('admin:focus', handler);
    return () => window.removeEventListener('admin:focus', handler);
  }, []);

  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['admin-sourcing-dossiers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('*')
        .or('needs_sourcing.eq.true,app_source.eq.sourcing')
        .not('app_source', 'in', '("expedier","recevoir")')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Dossier[];
    },
  });

  const updateDossier = useMutation({
    mutationFn: async (input: { id: string; status?: DossierStatus; admin_notes?: string; gp_id?: string | null }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from('dossiers').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sourcing-dossiers'] });
      toast.success('Dossier mis à jour');
    },
    onError: () => toast.error('Échec de la mise à jour'),
  });

  const pushToKonnekt = useMutation({
    mutationFn: async (dossierId: string) => {
      const { data, error } = await supabase.functions.invoke('push-to-konnekt', {
        body: { dossier_id: dossierId },
      });
      if (error) {
        let detail = error.message;
        try {
          const ctx = (error as unknown as { context?: Response }).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            const status = body?.status ?? ctx.status;
            if (status === 401 || status === 403) {
              detail = `Konnekt refuse la clé API (${status}). Vérifiez YOBBANTE_API_KEY côté Konnekt.`;
            } else if (status === 404) {
              detail = `Endpoint Konnekt introuvable (404). Vérifiez KONNEKT_BASE_URL.`;
            } else if (body?.error) {
              detail = `${body.error}${body?.details ? ` — ${JSON.stringify(body.details)}` : ''}`;
            }
          }
        } catch { /* ignore */ }
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin-sourcing-dossiers'] });
      toast.success(
        data?.konnekt_order_id
          ? `Poussé vers Konnekt (#${data.konnekt_order_id})`
          : 'Poussé vers Konnekt',
      );
    },
    onError: (e: Error) => toast.error(e.message || 'Échec de la synchro Konnekt'),
  });

  const filtered = useMemo(() => {
    return dossiers.filter(d => {
      if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          d.reference.toLowerCase().includes(q) ||
          d.product_description.toLowerCase().includes(q) ||
          (d.contact_email || '').toLowerCase().includes(q) ||
          (d.contact_phone || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [dossiers, search, statusFilter]);

  const selected = dossiers.find(d => d.id === selectedId) || null;
  const selectedNotes = selected ? parseNotes(selected.notes) : {};

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-6">
      <section>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Réf, produit, contact…"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as DossierStatus | 'ALL')}>
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous statuts</SelectItem>
              {DOSSIER_STATUS_ORDER.map(s => (
                <SelectItem key={s} value={s}>{DOSSIER_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <StatPill label="Total" value={dossiers.length} />
          <StatPill label="En cours" value={dossiers.filter(d => ['SUBMITTED', 'IN_REVIEW', 'SOURCING'].includes(d.status)).length} />
          <StatPill label="Budget cumulé" value={`${dossiers.reduce((s, d) => s + (Number(d.budget_eur) || 0), 0).toLocaleString('fr-FR')} €`} />
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <ShoppingCart className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">Aucun dossier sourcing</p>
            <p className="text-xs text-muted-foreground mt-1">Les dossiers « Acheter un produit » apparaîtront ici.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(d => {
              const n = parseNotes(d.notes);
              const isUrl = isProductUrl(d.product_description);
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={cn(
                    'w-full text-left bg-card border rounded-xl p-4 transition-all',
                    selectedId === d.id ? 'border-foreground' : 'border-border hover:border-foreground/40',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="font-mono font-semibold text-foreground">{d.reference}</span>
                        <span className="text-muted-foreground">· {DOSSIER_STATUS_LABELS[d.status]}</span>
                        <span className="text-muted-foreground">· {COUNTRY_FLAGS[d.origin_country]} → {d.destination_country}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground line-clamp-2 mt-1">
                        {isUrl ? (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <ExternalLink className="w-3.5 h-3.5" />
                            {new URL(d.product_description).hostname}
                          </span>
                        ) : d.product_description}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                        {d.budget_eur != null && (
                          <span className="inline-flex items-center gap-1"><Wallet className="w-3 h-3" /> {Number(d.budget_eur).toLocaleString('fr-FR')} €</span>
                        )}
                        {n.quantity && (
                          <span className="inline-flex items-center gap-1"><Package className="w-3 h-3" /> ×{n.quantity}</span>
                        )}
                        {n.urgency && <span>⏱️ {n.urgency}</span>}
                        {n.transport && <span>🚚 {n.transport}</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {new Date(d.created_at).toLocaleDateString('fr-FR')} · {d.contact_phone || d.contact_email || '—'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        {!selected ? (
          <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center">
            <ShoppingCart className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">Sélectionnez un dossier sourcing</p>
            <p className="text-xs text-muted-foreground mt-1">Pour voir le brief produit et mettre à jour le statut.</p>
          </div>
        ) : (
          <SourcingPanel
            key={selected.id}
            dossier={selected}
            notes={selectedNotes}
            onUpdate={(patch) => updateDossier.mutateAsync({ id: selected.id, ...patch })}
            isPending={updateDossier.isPending}
            onPushKonnekt={() => pushToKonnekt.mutateAsync(selected.id)}
            isPushing={pushToKonnekt.isPending}
          />
        )}
      </aside>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground mt-0.5">{value}</p>
    </div>
  );
}

function SourcingPanel({ dossier, notes, onUpdate, isPending, onPushKonnekt, isPushing }: {
  dossier: Dossier;
  notes: ParsedNotes;
  onUpdate: (patch: { status?: DossierStatus; admin_notes?: string; gp_id?: string | null }) => Promise<void>;
  isPending: boolean;
  onPushKonnekt: () => Promise<unknown>;
  isPushing: boolean;
}) {
  const sheet = useDossierSheet();
  const [status, setStatus] = useState<DossierStatus>(dossier.status);
  const [admin, setAdmin] = useState(dossier.admin_notes || '');
  const [gpId, setGpId] = useState(dossier.gp_id || '');
  const isUrl = isProductUrl(dossier.product_description);
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const gpTrimmed = gpId.trim();
  const gpInvalid = gpTrimmed.length > 0 && !UUID_RE.test(gpTrimmed);
  const dirty =
    status !== dossier.status ||
    admin !== (dossier.admin_notes || '') ||
    gpTrimmed !== (dossier.gp_id || '');

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-sm font-bold text-foreground">{dossier.reference}</p>
        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => sheet.open(dossier.id)}>
          <ExternalLink className="w-3 h-3 mr-1" /> Fiche complète
        </Button>
      </div>
      <div>
        <div className="mt-2 p-3 rounded-lg bg-secondary border border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Produit demandé</p>
          {isUrl ? (
            <a
              href={dossier.product_description}
              target="_blank" rel="noopener noreferrer"
              className="text-sm font-medium text-primary inline-flex items-center gap-1 break-all"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              {dossier.product_description}
            </a>
          ) : (
            <p className="text-sm text-foreground">{dossier.product_description}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Budget" value={dossier.budget_eur != null ? `${Number(dossier.budget_eur).toLocaleString('fr-FR')} €` : '—'} />
        <Field label="Quantité" value={notes.quantity ? `×${notes.quantity}` : '—'} />
        <Field label="Origine" value={`${COUNTRY_FLAGS[dossier.origin_country]} ${dossier.origin_country}`} />
        <Field label="Destination" value={dossier.destination_country} />
        <Field label="Transport" value={notes.transport || (notes.includesShipping === false ? 'Récup. sur place' : '—')} />
        <Field label="Urgence" value={notes.urgency || '—'} />
      </div>

      <div className="text-[11px] text-muted-foreground space-y-1 border-t border-border pt-3">
        {dossier.contact_phone && <p className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {dossier.contact_phone}</p>}
        {notes.whatsapp && <p className="inline-flex items-center gap-1">💬 {notes.whatsapp}</p>}
        {dossier.contact_email && <p className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {dossier.contact_email}</p>}
        {notes.contact && <p>👤 {notes.contact}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Statut</label>
        <Select value={status} onValueChange={v => setStatus(v as DossierStatus)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {DOSSIER_STATUS_ORDER.map(s => (
              <SelectItem key={s} value={s}>{DOSSIER_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Notes internes</label>
        <Textarea
          value={admin}
          onChange={e => setAdmin(e.target.value)}
          rows={4}
          placeholder="Fournisseur trouvé, prix négocié, MOQ, lead time…"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
          GP ID Konnekt (override)
        </label>
        <Input
          value={gpId}
          onChange={e => setGpId(e.target.value)}
          placeholder="UUID gestionnaire — sinon fallback secret"
          className={cn('font-mono text-xs', gpInvalid && 'border-destructive')}
        />
        {gpInvalid ? (
          <p className="text-[10px] text-destructive">Format UUID attendu : xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</p>
        ) : (
          <p className="text-[10px] text-muted-foreground">Laisser vide pour utiliser le KONNEKT_GP_ID global.</p>
        )}
      </div>

      <Button
        onClick={() => onUpdate({ status, admin_notes: admin, gp_id: gpTrimmed || null })}
        disabled={isPending || gpInvalid || !dirty}
        className="w-full"
      >
        Enregistrer
      </Button>

      <div className="border-t border-border pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
            Konnekt
          </p>
          {dossier.konnekt_order_id ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-primary">
              <CheckCircle2 className="w-3 h-3" />
              #{dossier.konnekt_order_id}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">Non synchronisé</span>
          )}
        </div>
        {dossier.konnekt_synced_at && (
          <p className="text-[10px] text-muted-foreground">
            Dernière synchro : {new Date(dossier.konnekt_synced_at).toLocaleString('fr-FR')}
          </p>
        )}
        <Button
          onClick={() => onPushKonnekt()}
          disabled={isPushing}
          variant="outline"
          className="w-full"
        >
          {isPushing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</>
          ) : (
            <><Send className="w-4 h-4" /> {dossier.konnekt_order_id ? 'Re-pousser vers Konnekt' : 'Pousser vers Konnekt'}</>
          )}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-secondary border border-border rounded-lg p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-0.5 truncate">{value}</p>
    </div>
  );
}
