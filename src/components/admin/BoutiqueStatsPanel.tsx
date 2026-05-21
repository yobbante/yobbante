import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, ShoppingBag, Package as PackageIcon, AlertTriangle } from 'lucide-react';

type Order = {
  id: string;
  status: string;
  total_eur: number;
  total_fcfa: number;
  items: any[];
  created_at: string;
};

type Product = { id: string; name: string; stock_qty: number | null; status: string };

const fmtEur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const fmtFcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

const RANGES = [
  { id: '7d', label: '7 jours', days: 7 },
  { id: '30d', label: '30 jours', days: 30 },
  { id: '90d', label: '90 jours', days: 90 },
  { id: 'all', label: 'Tout', days: 9999 },
];

export function BoutiqueStatsPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [range, setRange] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [o, p] = await Promise.all([
        supabase.from('dekk_orders' as any).select('id,status,total_eur,total_fcfa,items,created_at').order('created_at', { ascending: false }),
        supabase.from('products' as any).select('id,name,stock_qty,status'),
      ]);
      setOrders(((o.data as any) || []) as Order[]);
      setProducts(((p.data as any) || []) as Product[]);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const days = RANGES.find(r => r.id === range)!.days;
    const cutoff = Date.now() - days * 86400000;
    const inRange = orders.filter(o => new Date(o.created_at).getTime() >= cutoff);
    const paid = inRange.filter(o => !['cancelled', 'awaiting_payment'].includes(o.status));
    const revenueEur = paid.reduce((s, o) => s + (o.total_eur || 0), 0);
    const revenueFcfa = paid.reduce((s, o) => s + (o.total_fcfa || 0), 0);
    const avg = paid.length ? revenueEur / paid.length : 0;

    const productCount: Record<string, { name: string; qty: number; revenue: number }> = {};
    paid.forEach(o => {
      (o.items || []).forEach((it: any) => {
        const key = it.id || it.product_id || it.name;
        if (!key) return;
        if (!productCount[key]) productCount[key] = { name: it.name || 'Produit', qty: 0, revenue: 0 };
        productCount[key].qty += it.quantity || 1;
        productCount[key].revenue += (it.price_eur || 0) * (it.quantity || 1);
      });
    });
    const topProducts = Object.values(productCount).sort((a, b) => b.qty - a.qty).slice(0, 5);

    const statusBreakdown: Record<string, number> = {};
    inRange.forEach(o => { statusBreakdown[o.status] = (statusBreakdown[o.status] || 0) + 1; });

    return { revenueEur, revenueFcfa, avg, orderCount: inRange.length, paidCount: paid.length, topProducts, statusBreakdown };
  }, [orders, range]);

  const lowStock = useMemo(() =>
    products.filter(p => p.status === 'published' && p.stock_qty !== null && p.stock_qty <= 3).slice(0, 8),
  [products]);

  if (loading) return <div className="p-8 text-center text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Chargement…</div>;

  return (
    <div>
      {/* Range selector */}
      <div className="flex gap-1 mb-5" style={{ borderBottom: '0.5px solid hsl(var(--color-border-tertiary))' }}>
        {RANGES.map(r => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '8px 12px', fontSize: 12,
              fontWeight: range === r.id ? 500 : 400,
              color: range === r.id ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
              borderBottom: range === r.id ? '2px solid #1a1a1a' : '2px solid transparent',
              marginBottom: -1, fontFamily: '"DM Mono", monospace',
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        <Kpi icon={<TrendingUp size={16} />} label="CA confirmé" value={fmtEur(stats.revenueEur)} sub={fmtFcfa(stats.revenueFcfa)} />
        <Kpi icon={<ShoppingBag size={16} />} label="Commandes" value={String(stats.orderCount)} sub={`${stats.paidCount} confirmées`} />
        <Kpi icon={<TrendingUp size={16} />} label="Panier moyen" value={fmtEur(stats.avg)} sub="confirmées" />
        <Kpi icon={<AlertTriangle size={16} />} label="Stock faible" value={String(lowStock.length)} sub="≤ 3 unités" />
      </div>

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* Top produits */}
        <Card title="Top 5 produits">
          {stats.topProducts.length === 0 ? (
            <Empty>Aucune vente sur la période.</Empty>
          ) : (
            <div>
              {stats.topProducts.map((p, i) => (
                <Row key={i}>
                  <span style={{ flex: 1, fontSize: 13 }}>{p.name}</span>
                  <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, color: 'hsl(var(--muted-foreground))', marginRight: 12 }}>{p.qty}×</span>
                  <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, fontWeight: 500 }}>{fmtEur(p.revenue)}</span>
                </Row>
              ))}
            </div>
          )}
        </Card>

        {/* Statuts */}
        <Card title="Répartition par statut">
          {Object.keys(stats.statusBreakdown).length === 0 ? (
            <Empty>Aucune commande sur la période.</Empty>
          ) : (
            <div>
              {Object.entries(stats.statusBreakdown).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
                <Row key={s}>
                  <span style={{ flex: 1, fontSize: 13 }}>{statusLabel(s)}</span>
                  <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, fontWeight: 500 }}>{n}</span>
                </Row>
              ))}
            </div>
          )}
        </Card>

        {/* Stock faible */}
        <Card title="Alertes stock">
          {lowStock.length === 0 ? (
            <Empty>Aucun produit en stock faible.</Empty>
          ) : (
            <div>
              {lowStock.map(p => (
                <Row key={p.id}>
                  <PackageIcon size={14} style={{ color: '#A32D2D', marginRight: 8 }} />
                  <span style={{ flex: 1, fontSize: 13 }}>{p.name}</span>
                  <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, color: p.stock_qty === 0 ? '#A32D2D' : '#8B5220', fontWeight: 500 }}>
                    {p.stock_qty === 0 ? 'Rupture' : `${p.stock_qty} restant${p.stock_qty! > 1 ? 's' : ''}`}
                  </span>
                </Row>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function statusLabel(s: string): string {
  const m: Record<string, string> = {
    awaiting_payment: 'En attente paiement',
    confirmed: 'Confirmée',
    preparing: 'En préparation',
    shipped: 'Expédiée',
    delivered: 'Livrée',
    cancelled: 'Annulée',
  };
  return m[s] || s;
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div style={{ border: '0.5px solid hsl(var(--color-border-tertiary))', borderRadius: 12, padding: 14, background: 'hsl(var(--background-primary))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'hsl(var(--muted-foreground))', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: '"DM Mono", monospace' }}>
        {icon}{label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 500, marginTop: 8, fontFamily: '"DM Mono", monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 2, fontFamily: '"DM Mono", monospace' }}>{sub}</div>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '0.5px solid hsl(var(--color-border-tertiary))', borderRadius: 12, padding: 14, background: 'hsl(var(--background-primary))' }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'hsl(var(--muted-foreground))', fontFamily: '"DM Mono", monospace', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderTop: '0.5px solid hsl(var(--color-border-tertiary))' }}>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '12px 0', fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{children}</div>;
}
