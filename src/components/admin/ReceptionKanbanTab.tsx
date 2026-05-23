import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Inbox, Package, CheckCircle2, Truck, MapPin, Camera, Save, X, Calculator, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ReceptionOrder = {
  id: string;
  reference: string;
  user_id: string;
  status: string;
  merchant_name: string;
  order_description: string;
  order_reference: string | null;
  expected_packages: number;
  estimated_weight_kg: number | null;
  estimated_value_eur: number | null;
  goods_type: string;
  transport_mode: string;
  priority: string;
  actual_weight_kg: number | null;
  actual_dimensions_cm: any;
  final_price_eur: number | null;
  final_price_xof: number | null;
  payment_status: string;
  client_note: string | null;
  internal_note: string | null;
  created_at: string;
  relay_address_id: string;
  relay_addresses?: { city: string; country: string; country_code: string } | null;
  profiles?: { full_name: string | null; email: string | null; phone: string | null } | null;
};

const COLUMNS: { id: string; label: string; icon: typeof Inbox; tone: string }[] = [
  { id: 'pending_arrival', label: 'En attente',      icon: Inbox,        tone: 'bg-muted text-muted-foreground' },
  { id: 'received',        label: 'Reçu au relais',  icon: Package,      tone: 'bg-blue-500/10 text-blue-500' },
  { id: 'inspected',       label: 'Inspecté',        icon: CheckCircle2, tone: 'bg-amber-500/10 text-amber-600' },
  { id: 'consolidated',    label: 'Consolidé',       icon: Package,      tone: 'bg-violet-500/10 text-violet-500' },
  { id: 'in_transit',      label: 'En transit',      icon: Truck,        tone: 'bg-blue-500/10 text-blue-500' },
  { id: 'delivered',       label: 'Livré',           icon: CheckCircle2, tone: 'bg-emerald-500/10 text-emerald-500' },
];

export function ReceptionKanbanTab() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<ReceptionOrder | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin-reception-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reception_orders')
        .select('*, relay_addresses(city, country, country_code)')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      // fetch profiles separately (no FK)
      const userIds = Array.from(new Set((data || []).map((o: any) => o.user_id)));
      let profilesMap: Record<string, any> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, phone')
          .in('user_id', userIds);
        profilesMap = Object.fromEntries((profs || []).map((p: any) => [p.user_id, p]));
      }
      return (data || []).map((o: any) => ({ ...o, profiles: profilesMap[o.user_id] || null })) as ReceptionOrder[];
    },
  });

  const grouped = useMemo(() => {
    const map: Record<string, ReceptionOrder[]> = {};
    for (const c of COLUMNS) map[c.id] = [];
    for (const o of orders) {
      if (map[o.status]) map[o.status].push(o);
      else map['pending_arrival'].push(o); // fallback
    }
    return map;
  }, [orders]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-reception-orders'] });

  // Open detail from dashboard "Activité récente" deep-link
  useEffect(() => {
    if (!orders.length) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { service?: string; id?: string };
      if (detail?.service !== 'reception' || !detail.id) return;
      const found = orders.find(o => o.id === detail.id);
      if (found) setSelected(found);
    };
    window.addEventListener('admin:focus', handler);
    return () => window.removeEventListener('admin:focus', handler);
  }, [orders]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Réception internationale</h1>
        <p className="text-sm text-muted-foreground">
          Suivi des commandes attendues aux relais. Cliquez une fiche pour enregistrer la réception (poids, photo, prix final).
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 pb-2">
          <div className="grid grid-flow-col auto-cols-[280px] gap-3 min-w-full">
            {COLUMNS.map(col => {
              const Icon = col.icon;
              const items = grouped[col.id] || [];
              return (
                <div
                  key={col.id}
                  className="flex flex-col rounded-[12px] overflow-hidden bg-card"
                  style={{ border: '0.5px solid hsl(var(--color-border-tertiary))' }}
                >
                  <div
                    className="flex items-center justify-between px-3 py-2.5 bg-secondary"
                    style={{ borderBottom: '0.5px solid hsl(var(--color-border-tertiary))' }}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded', col.tone)}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-foreground">{col.label}</p>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">{items.length}</span>
                  </div>

                  <div className="flex-1 p-2 space-y-2 max-h-[70vh] overflow-y-auto">
                    {items.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground text-center py-6">Aucune commande</p>
                    ) : items.map(o => (
                      <button
                        key={o.id}
                        onClick={() => setSelected(o)}
                        className={cn(
                          'w-full text-left rounded-[12px] bg-card transition-colors p-3 space-y-1.5',
                          selected?.id === o.id ? 'card-featured' : ''
                        )}
                        style={selected?.id === o.id ? undefined : { border: '0.5px solid hsl(var(--color-border-tertiary))' }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-mono text-muted-foreground truncate">{o.reference}</p>
                          {o.final_price_eur != null && (
                            <span className="text-[11px] font-medium text-success tabular-nums">{Math.round(o.final_price_eur)} €</span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-foreground truncate">{o.merchant_name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{o.order_description}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-1">
                          <MapPin className="w-3 h-3" />
                          <span>{o.relay_addresses?.city || '—'}</span>
                          <span>·</span>
                          <span>{o.profiles?.full_name || o.profiles?.email || 'Client'}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected && (
        <ReceptionOrderDrawer
          order={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { refresh(); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Drawer / Order detail with "Mark as received" action
// ============================================================================

function ReceptionOrderDrawer({
  order,
  onClose,
  onChanged,
}: {
  order: ReceptionOrder;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<'info' | 'receive'>(order.status === 'pending_arrival' ? 'receive' : 'info');

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative ml-auto w-full max-w-xl bg-background border-l border-border flex flex-col shadow-2xl">
        <header className="flex items-start justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <p className="text-[11px] font-mono text-muted-foreground">{order.reference}</p>
            <h2 className="text-base font-bold text-foreground truncate">{order.merchant_name}</h2>
            <p className="text-xs text-muted-foreground truncate">{order.order_description}</p>
          </div>
          <button onClick={onClose} className="p-1 -mr-1 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex border-b border-border">
          {[
            { id: 'info' as const, label: 'Détails' },
            { id: 'receive' as const, label: 'Réception' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors',
                tab === t.id ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'info' ? <InfoPanel order={order} /> : <ReceivePanel order={order} onChanged={() => { onChanged(); onClose(); }} />}
        </div>
      </aside>
    </div>
  );
}

function InfoPanel({ order }: { order: ReceptionOrder }) {
  return (
    <div className="space-y-4 text-sm">
      <Section title="Client">
        <Row k="Nom"      v={order.profiles?.full_name || '—'} />
        <Row k="Email"    v={order.profiles?.email || '—'} />
        <Row k="Téléphone" v={order.profiles?.phone || '—'} />
      </Section>

      <Section title="Commande">
        <Row k="Marchand" v={order.merchant_name} />
        <Row k="Référence cmd" v={order.order_reference || '—'} />
        <Row k="Description"   v={order.order_description} />
        <Row k="Colis attendus" v={String(order.expected_packages)} />
        <Row k="Poids estimé"   v={order.estimated_weight_kg ? `${order.estimated_weight_kg} kg` : '—'} />
        <Row k="Valeur estimée" v={order.estimated_value_eur ? `${order.estimated_value_eur} €` : '—'} />
        <Row k="Type"           v={order.goods_type} />
      </Section>

      <Section title="Relais">
        <Row k="Ville"  v={order.relay_addresses?.city || '—'} />
        <Row k="Pays"   v={order.relay_addresses?.country || '—'} />
      </Section>

      <Section title="Réception">
        <Row k="Statut"            v={order.status} />
        <Row k="Poids réel"        v={order.actual_weight_kg ? `${order.actual_weight_kg} kg` : '—'} />
        <Row k="Prix final"        v={order.final_price_eur ? `${order.final_price_eur.toFixed(2)} €` : '—'} />
        <Row k="Paiement"          v={order.payment_status} />
      </Section>

      {order.client_note && (
        <Section title="Note client">
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{order.client_note}</p>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="rounded-lg border border-border bg-card divide-y divide-border">{children}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-foreground font-medium text-right break-words max-w-[60%]">{v}</span>
    </div>
  );
}

// ============================================================================
// Receive panel — weight, dimensions, photo, recalculated price
// ============================================================================

function ReceivePanel({ order, onChanged }: { order: ReceptionOrder; onChanged: () => void }) {
  const [weight, setWeight] = useState<string>(order.actual_weight_kg?.toString() || '');
  const [length, setLength] = useState<string>(order.actual_dimensions_cm?.length?.toString() || '');
  const [width, setWidth] = useState<string>(order.actual_dimensions_cm?.width?.toString() || '');
  const [height, setHeight] = useState<string>(order.actual_dimensions_cm?.height?.toString() || '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [internalNote, setInternalNote] = useState(order.internal_note || '');
  const [quote, setQuote] = useState<{ price_eur: number; price_xof: number } | null>(
    order.final_price_eur ? { price_eur: order.final_price_eur, price_xof: order.final_price_xof || 0 } : null
  );
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePhoto = (f: File | null) => {
    setPhotoFile(f);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(f ? URL.createObjectURL(f) : null);
  };

  const calculatePrice = async () => {
    const w = parseFloat(weight);
    if (!w || w <= 0) { toast.error('Poids requis'); return; }
    setCalculating(true);
    const { data, error } = await supabase.rpc('calculate_quote_v2', {
      p_destination_country: 'SN',
      p_real_weight_kg: w,
      p_length_cm: length ? parseFloat(length) : null,
      p_width_cm: width ? parseFloat(width) : null,
      p_height_cm: height ? parseFloat(height) : null,
      p_transport_mode: order.transport_mode || 'air',
      p_priority: order.priority || 'standard',
      p_goods_type: order.goods_type || 'standard',
    });
    setCalculating(false);
    if (error) { toast.error(error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) { toast.error('Impossible de calculer le prix'); return; }
    // Add 2000 XOF handling fee
    const price_xof = Number(row.price_xof) + 2000;
    const price_eur = +(price_xof / 655.957).toFixed(2);
    setQuote({ price_eur, price_xof });
    toast.success(`Prix calculé : ${price_eur} € (${price_xof.toLocaleString()} XOF)`);
  };

  const markAsReceived = async () => {
    const w = parseFloat(weight);
    if (!w || w <= 0) { toast.error('Poids réel requis'); return; }
    if (!quote) { toast.error('Calculez le prix d\'abord'); return; }

    setSaving(true);
    try {
      let photoUrl: string | null = null;
      if (photoFile) {
        const ext = photoFile.name.split('.').pop() || 'jpg';
        const path = `${order.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('reception-photos')
          .upload(path, photoFile, { contentType: photoFile.type, upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('reception-photos').getPublicUrl(path);
        photoUrl = pub.publicUrl;
      }

      const dims: any = {};
      if (length) dims.length = parseFloat(length);
      if (width)  dims.width  = parseFloat(width);
      if (height) dims.height = parseFloat(height);

      // Update reception_orders
      const { error: updErr } = await supabase
        .from('reception_orders')
        .update({
          status: 'received',
          actual_weight_kg: w,
          actual_dimensions_cm: Object.keys(dims).length ? dims : null,
          final_price_eur: quote.price_eur,
          final_price_xof: quote.price_xof,
          internal_note: internalNote || null,
        })
        .eq('id', order.id);
      if (updErr) throw updErr;

      // Insert reception_packages row (one per actual package received)
      const { error: pkgErr } = await supabase
        .from('reception_packages')
        .insert({
          order_id: order.id,
          package_number: 1,
          weight_kg: w,
          dimensions_cm: Object.keys(dims).length ? dims : null,
          photo_url: photoUrl,
          received_at: new Date().toISOString(),
          notes: internalNote || null,
        });
      if (pkgErr) throw pkgErr;

      toast.success('Commande marquée comme reçue');
      onChanged();
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const advanceTo = async (next: string) => {
    setSaving(true);
    const { error } = await supabase
      .from('reception_orders')
      .update({ status: next })
      .eq('id', order.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success('Statut mis à jour'); onChanged(); }
  };

  if (order.status !== 'pending_arrival') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
          Cette commande est au statut <span className="font-bold text-foreground">{order.status}</span>.
          Vous pouvez la faire avancer dans le pipeline ci-dessous.
        </div>

        <div className="grid grid-cols-2 gap-2">
          {COLUMNS.filter(c => c.id !== order.status).map(c => (
            <Button
              key={c.id}
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => advanceTo(c.id)}
              className="justify-start text-xs"
            >
              <c.icon className="w-3.5 h-3.5 mr-1.5" /> {c.label}
            </Button>
          ))}
        </div>

        {order.actual_weight_kg && (
          <Section title="Mesures enregistrées">
            <Row k="Poids réel" v={`${order.actual_weight_kg} kg`} />
            {order.actual_dimensions_cm && (
              <Row k="Dimensions" v={`${order.actual_dimensions_cm.length || '?'} × ${order.actual_dimensions_cm.width || '?'} × ${order.actual_dimensions_cm.height || '?'} cm`} />
            )}
            <Row k="Prix final" v={order.final_price_eur ? `${order.final_price_eur.toFixed(2)} €` : '—'} />
          </Section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-xs">Poids réel (kg) *</Label>
        <Input
          type="number" step="0.01" inputMode="decimal"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          placeholder="ex. 2.45"
          className="mt-1"
        />
      </div>

      <div>
        <Label className="text-xs">Dimensions (cm)</Label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          <Input type="number" placeholder="L" value={length} onChange={e => setLength(e.target.value)} />
          <Input type="number" placeholder="l" value={width}  onChange={e => setWidth(e.target.value)} />
          <Input type="number" placeholder="H" value={height} onChange={e => setHeight(e.target.value)} />
        </div>
      </div>

      <div>
        <Label className="text-xs">Photo du colis</Label>
        <div className="mt-1 flex items-center gap-3">
          <label className="flex-1 cursor-pointer rounded-lg border border-dashed border-border bg-card hover:bg-secondary/30 transition-colors p-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Camera className="w-4 h-4" />
            {photoFile ? photoFile.name : 'Choisir une photo'}
            <input
              type="file" accept="image/*" capture="environment"
              className="hidden"
              onChange={e => handlePhoto(e.target.files?.[0] || null)}
            />
          </label>
          {photoPreview && (
            <img src={photoPreview} alt="Aperçu" className="w-14 h-14 rounded-lg object-cover border border-border" />
          )}
        </div>
      </div>

      <div>
        <Label className="text-xs">Note interne</Label>
        <Textarea
          value={internalNote}
          onChange={e => setInternalNote(e.target.value)}
          rows={2}
          placeholder="État du colis, détails…"
          className="mt-1"
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prix final</p>
          <Button size="sm" variant="outline" disabled={calculating} onClick={calculatePrice}>
            {calculating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Calculator className="w-3.5 h-3.5 mr-1.5" /> Recalculer</>}
          </Button>
        </div>
        {quote ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Transport</span>
              <span className="text-foreground font-medium tabular-nums">{(quote.price_xof - 2000).toLocaleString()} XOF</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Frais de manutention</span>
              <span className="text-foreground font-medium tabular-nums">2 000 XOF</span>
            </div>
            <div className="border-t border-border pt-1.5 flex items-end justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</span>
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground tabular-nums leading-none">{quote.price_eur.toFixed(2)} €</p>
                <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">{quote.price_xof.toLocaleString()} XOF</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Renseignez le poids puis cliquez sur "Recalculer".</p>
        )}
      </div>

      <Button onClick={markAsReceived} disabled={saving || !quote} className="w-full" size="lg">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1.5" /> Marquer comme reçu</>}
      </Button>
    </div>
  );
}
