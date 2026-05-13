import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { X, Search, Package, Phone, MapPin, CreditCard, Plus, ChevronRight } from 'lucide-react';

type Order = {
  id: string;
  reference: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  city: string;
  address: string;
  note: string | null;
  payment_method: string;
  items: any[];
  subtotal_eur: number;
  total_eur: number;
  total_fcfa: number;
  status: string;
  created_at: string;
  updated_at: string;
};

type OrderEvent = {
  id: string;
  order_id: string;
  status: string;
  note: string | null;
  created_at: string;
};

const STATUS_FLOW: { id: string; label: string; color: string; bg: string }[] = [
  { id: 'awaiting_payment', label: 'En attente paiement', color: '#8B5220', bg: '#F5E6D8' },
  { id: 'confirmed',        label: 'Confirmée',           color: '#1D4ED8', bg: '#EFF6FF' },
  { id: 'preparing',        label: 'En préparation',      color: '#7C3AED', bg: '#F3E8FF' },
  { id: 'shipped',          label: 'Expédiée',            color: '#0E7490', bg: '#CFFAFE' },
  { id: 'delivered',        label: 'Livrée',              color: '#085041', bg: '#E1F5EE' },
  { id: 'cancelled',        label: 'Annulée',             color: '#A32D2D', bg: '#FBE5E5' },
];
const STATUS_MAP = Object.fromEntries(STATUS_FLOW.map(s => [s.id, s]));

const PAY_LABEL: Record<string, string> = {
  wave: 'Wave', om: 'Orange Money', card: 'Carte bancaire', cash: 'À la livraison',
};

const fmtDate = (s: string) => {
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};
const fmtEur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const fmtFcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

export function BoutiqueOrdersPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('dekk_orders' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setOrders((data as any as Order[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        return [o.reference, o.customer_name, o.customer_phone, o.city].some(v => v?.toLowerCase().includes(q));
      }
      return true;
    });
  }, [orders, statusFilter, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    STATUS_FLOW.forEach(s => { c[s.id] = orders.filter(o => o.status === s.id).length; });
    return c;
  }, [orders]);

  return (
    <div>
      {/* Status pills */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        <FilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} label={`Toutes (${counts.all})`} />
        {STATUS_FLOW.map(s => (
          <FilterPill key={s.id} active={statusFilter === s.id} onClick={() => setStatusFilter(s.id)} label={`${s.label} (${counts[s.id] ?? 0})`} />
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'hsl(var(--muted-foreground))' }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Réf, nom, téléphone, ville…"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-md outline-none"
          style={{ border: '0.5px solid hsl(var(--color-border-tertiary))', background: 'hsl(var(--background-primary))' }}
        />
      </div>

      {/* Table */}
      <div style={{ border: '0.5px solid hsl(var(--color-border-tertiary))', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
            <Package className="w-8 h-8 mx-auto mb-3 opacity-40" />
            Aucune commande {statusFilter !== 'all' ? `pour ce statut` : ''}.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
              <thead style={{ background: 'hsl(var(--background-secondary))' }}>
                <tr>
                  {['Référence','Client','Ville','Articles','Total','Paiement','Statut','Date',''].map((h,i) => (
                    <th key={i} style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'hsl(var(--muted-foreground))', fontFamily: '"DM Mono", monospace' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const st = STATUS_MAP[o.status] ?? STATUS_FLOW[0];
                  const itemsCount = (o.items || []).reduce((s: number, i: any) => s + (i.qty || 0), 0);
                  return (
                    <tr key={o.id} style={{ borderTop: '0.5px solid hsl(var(--color-border-tertiary))', cursor: 'pointer' }} onClick={() => setSelected(o)}>
                      <td style={{ padding: '10px 12px', fontFamily: '"DM Mono", monospace', fontWeight: 500 }}>{o.reference}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 500 }}>{o.customer_name}</div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', fontFamily: '"DM Mono", monospace' }}>{o.customer_phone}</div>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))' }}>{o.city}</td>
                      <td style={{ padding: '10px 12px', fontFamily: '"DM Mono", monospace' }}>{itemsCount}</td>
                      <td style={{ padding: '10px 12px', fontFamily: '"DM Mono", monospace' }}>{fmtEur(o.total_eur)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{PAY_LABEL[o.payment_method] ?? o.payment_method}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: st.bg, color: st.color, fontSize: 9, fontFamily: '"DM Mono", monospace', borderRadius: 20, padding: '3px 10px' }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontFamily: '"DM Mono", monospace', fontSize: 11 }}>{fmtDate(o.created_at)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}><ChevronRight className="w-4 h-4 inline" style={{ color: 'hsl(var(--muted-foreground))' }}/></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <OrderDetailDrawer
          order={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { load(); }}
        />
      )}
    </div>
  );
}

function FilterPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-3 py-1.5 rounded-full transition-colors"
      style={{
        background: active ? 'hsl(var(--foreground))' : 'hsl(var(--background-secondary))',
        color: active ? 'hsl(var(--background))' : 'hsl(var(--muted-foreground))',
        border: '0.5px solid hsl(var(--color-border-tertiary))',
      }}
    >
      {label}
    </button>
  );
}

function OrderDetailDrawer({ order, onClose, onChanged }: { order: Order; onClose: () => void; onChanged: () => void }) {
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const loadEvents = async () => {
    const { data } = await supabase
      .from('dekk_order_events' as any)
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false });
    setEvents((data as any as OrderEvent[]) || []);
  };
  useEffect(() => { loadEvents(); }, [order.id]);

  const updateStatus = async (newStatus: string) => {
    setBusy(newStatus);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('dekk_orders' as any).update({ status: newStatus }).eq('id', order.id);
    if (error) { setBusy(null); return toast.error(error.message); }
    await supabase.from('dekk_order_events' as any).insert({
      order_id: order.id,
      status: newStatus,
      note: note || null,
      created_by: session?.user?.id ?? null,
    });
    setNote('');
    setBusy(null);
    toast.success(`Statut mis à jour: ${STATUS_MAP[newStatus]?.label ?? newStatus}`);
    onChanged();
    loadEvents();
  };

  const currentIdx = STATUS_FLOW.findIndex(s => s.id === order.status);
  const next = STATUS_FLOW.slice(0, 5).filter((s, i) => i > currentIdx && s.id !== 'cancelled');

  const st = STATUS_MAP[order.status] ?? STATUS_FLOW[0];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'hsl(var(--background-primary))', width: '100%', maxWidth: 540, height: '100%', overflowY: 'auto', padding: 24 }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div style={{ fontSize: 11, fontFamily: '"DM Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'hsl(var(--muted-foreground))' }}>
              COMMANDE
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, fontFamily: '"DM Mono", monospace', marginTop: 2 }}>{order.reference}</h3>
            <span style={{ background: st.bg, color: st.color, fontSize: 10, fontFamily: '"DM Mono", monospace', borderRadius: 20, padding: '3px 10px', marginTop: 8, display: 'inline-block' }}>
              {st.label}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X className="w-5 h-5" style={{ color: 'hsl(var(--muted-foreground))' }}/>
          </button>
        </div>

        {/* Customer */}
        <Section title="Client">
          <Row label="Nom" value={order.customer_name} />
          <Row label="Téléphone" value={
            <a href={`tel:${order.customer_phone}`} style={{ color: '#1D4ED8' }}>{order.customer_phone}</a>
          } />
          {order.customer_email && <Row label="Email" value={order.customer_email} />}
          <Row label="Ville" value={order.city} />
          <Row label="Adresse" value={order.address} />
          {order.note && <Row label="Note" value={order.note} />}
        </Section>

        {/* Items */}
        <Section title="Articles">
          <div style={{ border: '0.5px solid hsl(var(--color-border-tertiary))', borderRadius: 8, overflow: 'hidden' }}>
            {(order.items || []).map((it: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-2.5" style={{ borderTop: i ? '0.5px solid hsl(var(--color-border-tertiary))' : undefined }}>
                {it.product?.image_url && (
                  <img src={it.product.image_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }}/>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{it.product?.name}</div>
                  <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: '"DM Mono", monospace' }}>
                    {it.qty} × {fmtEur(it.product?.price_eur ?? 0)}
                  </div>
                </div>
                <div className="text-sm" style={{ fontFamily: '"DM Mono", monospace' }}>
                  {fmtEur((it.product?.price_eur ?? 0) * (it.qty ?? 0))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>Paiement</span>
            <span style={{ fontFamily: '"DM Mono", monospace' }}>{PAY_LABEL[order.payment_method] ?? order.payment_method}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span style={{ fontSize: 13, fontWeight: 500 }}>Total</span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: '"DM Mono", monospace', fontWeight: 600 }}>{fmtEur(order.total_eur)}</div>
              <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{fmtFcfa(order.total_fcfa)}</div>
            </div>
          </div>
        </Section>

        {/* Status update */}
        {order.status !== 'delivered' && order.status !== 'cancelled' && (
          <Section title="Mettre à jour le statut">
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Note interne (optionnel)…"
              rows={2}
              className="w-full text-sm p-2 rounded-md mb-2"
              style={{ border: '0.5px solid hsl(var(--color-border-tertiary))', background: 'hsl(var(--background-primary))', color: 'hsl(var(--foreground))', fontFamily: 'inherit' }}
            />
            <div className="flex flex-wrap gap-2">
              {next.map(s => (
                <button
                  key={s.id}
                  disabled={busy !== null}
                  onClick={() => updateStatus(s.id)}
                  style={{
                    background: s.bg, color: s.color, border: 'none',
                    padding: '8px 14px', fontSize: 12, fontWeight: 500,
                    borderRadius: 8, cursor: 'pointer',
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  → {s.label}
                </button>
              ))}
              <button
                disabled={busy !== null}
                onClick={() => { if (confirm('Annuler cette commande ?')) updateStatus('cancelled'); }}
                style={{ background: '#FBE5E5', color: '#A32D2D', border: 'none', padding: '8px 14px', fontSize: 12, fontWeight: 500, borderRadius: 8, cursor: 'pointer' }}
              >
                Annuler
              </button>
            </div>
          </Section>
        )}

        {/* Timeline */}
        <Section title="Suivi">
          <div className="relative pl-5">
            <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 1, background: 'hsl(var(--color-border-tertiary))' }} />
            <TimelineDot label={`Commande créée`} ts={order.created_at} note={null} />
            {events.map(ev => (
              <TimelineDot
                key={ev.id}
                label={STATUS_MAP[ev.status]?.label ?? ev.status}
                ts={ev.created_at}
                note={ev.note}
              />
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div style={{ fontSize: 10, fontFamily: '"DM Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm" style={{ borderBottom: '0.5px dashed hsl(var(--color-border-tertiary))' }}>
      <span style={{ color: 'hsl(var(--muted-foreground))' }}>{label}</span>
      <span style={{ textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function TimelineDot({ label, ts, note }: { label: string; ts: string; note: string | null }) {
  return (
    <div className="relative mb-3 pl-4">
      <div style={{ position: 'absolute', left: -3, top: 4, width: 9, height: 9, borderRadius: 5, background: '#1D9E75', border: '2px solid hsl(var(--background-primary))' }} />
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: '"DM Mono", monospace' }}>{fmtDate(ts)}</div>
      {note && <div className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>{note}</div>}
    </div>
  );
}
