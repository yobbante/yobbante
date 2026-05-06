import { useEffect, useMemo, useState } from 'react';
import { PublicNav } from '@/components/PublicNav';
import { supabase } from '@/integrations/supabase/client';

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price_eur: number;
  price_fcfa: number;
  origin_country: string;
  stock_mode: string;
  delivery_days: number | null;
  status: string;
  image_url: string | null;
  source_type: string;
  created_at: string;
};

const CATEGORIES = ['Tous', 'Électronique', 'Mode', 'Auto', 'Maison', 'Tech', 'Beauté'];

const ORIGIN_LABEL: Record<string, string> = {
  CN: '🇨🇳 Chine',
  US: '🇺🇸 USA',
  FR: '🇫🇷 France',
  OTHER: '🌍 Autre',
};

const fmtEur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const fmtFcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

export default function BoutiquePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState('Tous');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('products' as any)
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });
      setProducts((data as any as Product[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () => (activeCat === 'Tous' ? products : products.filter(p => p.category === activeCat)),
    [products, activeCat],
  );

  return (
    <div className="min-h-screen" style={{ background: 'hsl(var(--background-primary))' }}>
      <PublicNav />

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <div
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono, monospace)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#1D9E75',
              marginBottom: 12,
            }}
          >
            YOBBANTÉ BOUTIQUE
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', color: 'hsl(var(--foreground))', margin: 0 }}>
            Les produits que le Sénégal commande.
          </h1>
          <p style={{ fontSize: 14, color: 'hsl(var(--muted-foreground))', marginTop: 8, maxWidth: 560 }}>
            Chaque produit ici a été importé par un client Yobbanté. Commandez — on gère le reste.
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-6 -mx-6 px-6" style={{ scrollbarWidth: 'none' }}>
          {CATEGORIES.map(cat => {
            const active = cat === activeCat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                style={{
                  flexShrink: 0,
                  height: 36,
                  padding: '0 14px',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  background: active ? '#1a1a1a' : 'transparent',
                  color: active ? '#fff' : 'hsl(var(--muted-foreground))',
                  border: active ? 'none' : '0.5px solid hsl(var(--color-border-tertiary))',
                  cursor: 'pointer',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Grid / empty */}
        {loading ? null : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div style={{ fontSize: 32, marginBottom: 12 }}>🛍️</div>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'hsl(var(--foreground))' }}>La boutique s'alimente.</p>
            <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginTop: 6, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
              Les premiers produits arrivent dès qu'un client passe sa première commande internationale.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filtered.map(p => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ProductCard({ p }: { p: Product }) {
  const stockBadge =
    p.stock_mode === 'stock'
      ? { label: 'En stock', bg: '#E1F5EE', color: '#085041' }
      : { label: `Sous ${p.delivery_days ?? 7} j`, bg: '#FAEEDA', color: '#633806' };

  return (
    <article
      style={{
        border: '0.5px solid hsl(var(--color-border-tertiary))',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'hsl(var(--background-primary))',
      }}
    >
      <div style={{ position: 'relative', height: 180, background: '#F5F5F5' }}>
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : null}
        <span
          style={{
            position: 'absolute', top: 8, left: 8,
            background: '#fff', borderRadius: 6, padding: '3px 8px',
            fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
            color: 'hsl(var(--foreground))',
          }}
        >
          {ORIGIN_LABEL[p.origin_country] ?? ORIGIN_LABEL.OTHER}
        </span>
        <span
          style={{
            position: 'absolute', top: 8, right: 8,
            background: stockBadge.bg, color: stockBadge.color,
            borderRadius: 20, padding: '3px 8px',
            fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
          }}
        >
          {stockBadge.label}
        </span>
      </div>
      <div style={{ padding: 14 }}>
        <div
          style={{
            fontSize: 14, fontWeight: 500, color: 'hsl(var(--foreground))',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {p.name}
        </div>
        {p.description && (
          <div
            style={{
              fontSize: 12, color: 'hsl(var(--muted-foreground))', marginTop: 4,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {p.description}
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', color: 'hsl(var(--foreground))' }}>
            {fmtEur(p.price_eur)}
          </div>
          <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-mono, monospace)' }}>
            {fmtFcfa(p.price_fcfa)}
          </div>
        </div>
        <button
          onClick={() => {
            window.location.href = `/devis?product=${encodeURIComponent(p.id)}`;
          }}
          style={{
            marginTop: 12, width: '100%', height: 44, minHeight: 44,
            background: '#1a1a1a', color: '#fff',
            fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none',
            cursor: 'pointer',
          }}
        >
          Commander
        </button>
      </div>
    </article>
  );
}
