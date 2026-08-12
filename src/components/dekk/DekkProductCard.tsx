import { Link } from 'react-router-dom';
import { Heart, Package } from 'lucide-react';
import { CAT_PILLS, type CatKey } from './CatNav';
import { DEKK, SERIF, SANS, MONO, fmtFcfa } from './dekkTheme';

const CAT_LABEL: Record<string, string> = Object.fromEntries(CAT_PILLS.map((c) => [c.key, c.label]));

const DB_TO_UI: Record<string, CatKey> = {
  mode: 'merch-identite',
  auto: 'voyage-mobilite',
  tech: 'tech-productivite',
  electronique: 'rc-gadgets',
  maison: 'lifestyle-deco',
  beaute: 'bien-etre',
};

export type DekkProduct = {
  id: string;
  name: string;
  category: string;
  stock_mode: string;
  stock_qty: number;
  price_eur: number;
  price_fcfa: number;
  image_url: string | null;
  description?: string | null;
};

/** Carte produit éditoriale : image 4/5, zoom doux au survol, titre serif, prix FCFA. */
export function DekkProductCard({
  p,
  wished,
  onWish,
  onAdd,
  badge,
}: {
  p: DekkProduct;
  wished: boolean;
  onWish: () => void;
  onAdd: () => void;
  badge?: string;
}) {
  const uiCat = DB_TO_UI[p.category] ?? (p.category as CatKey);
  const catLabel = CAT_LABEL[uiCat] ?? p.category;
  const mode = (p.stock_mode || '').toLowerCase();
  const isDrop = mode === 'drop' || mode === 'commande';
  const out = !isDrop && (p.stock_qty ?? 0) <= 0;

  const tag = badge ?? (isDrop ? 'Sur commande' : out ? 'Rupture' : (p.stock_qty ?? 0) <= 2 ? `Plus que ${p.stock_qty}` : null);

  return (
    <article className="dekk-card" style={{ fontFamily: SANS, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .dekk-card .dekk-card-img{transition:transform 700ms cubic-bezier(.2,.7,.2,1)}
        .dekk-card:hover .dekk-card-img{transform:scale(1.045)}
        .dekk-card .dekk-card-add{opacity:0;transition:opacity 220ms ease}
        .dekk-card:hover .dekk-card-add{opacity:1}
        @media (hover:none){ .dekk-card .dekk-card-add{opacity:1} }
      `}</style>

      <Link to={`/boutique/${p.id}`}
        style={{ position: 'relative', display: 'block', aspectRatio: '4/5', background: DEKK.creamDeep, overflow: 'hidden' }}>
        {p.image_url ? (
          <img className="dekk-card-img" src={p.image_url} alt={p.name} loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DEKK.muted }}>
            <Package size={30} />
          </div>
        )}

        {tag && (
          <span style={{
            position: 'absolute', top: 10, left: 10, background: DEKK.surface, color: DEKK.ink,
            fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase',
            padding: '5px 9px',
          }}>
            {tag}
          </span>
        )}

        <button
          onClick={(e) => { e.preventDefault(); onWish(); }}
          aria-label="Ajouter aux favoris"
          style={{
            position: 'absolute', top: 8, right: 8, width: 32, height: 32,
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          }}
        >
          <Heart size={16} fill={wished ? DEKK.gold : 'none'} color={wished ? DEKK.gold : DEKK.ink} />
        </button>

        <button
          className="dekk-card-add"
          onClick={(e) => { e.preventDefault(); onAdd(); }}
          disabled={out}
          style={{
            position: 'absolute', left: 10, right: 10, bottom: 10, height: 40,
            background: out ? DEKK.creamDeep : DEKK.surface, color: out ? DEKK.muted : DEKK.ink,
            border: 'none', cursor: out ? 'not-allowed' : 'pointer',
            fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: SANS,
          }}
        >
          {out ? 'Indisponible' : 'Ajouter au panier'}
        </button>
      </Link>

      <div style={{ padding: '12px 2px 4px' }}>
        <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: DEKK.muted }}>
          {catLabel}
        </div>
        <Link to={`/boutique/${p.id}`}
          style={{ display: 'block', fontFamily: SERIF, fontSize: 19, lineHeight: 1.25, color: DEKK.ink, textDecoration: 'none', marginTop: 5 }}>
          {p.name}
        </Link>
        {p.description && (
          <p style={{ fontSize: 12, color: DEKK.muted, margin: '5px 0 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {p.description}
          </p>
        )}
        <div style={{ fontFamily: MONO, fontSize: 13, marginTop: 8 }}>{fmtFcfa(p.price_fcfa)}</div>
      </div>
    </article>
  );
}
