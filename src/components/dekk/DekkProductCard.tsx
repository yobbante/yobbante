import { Link } from 'react-router-dom';
import { Heart, Plus, Package } from 'lucide-react';
import { CAT_PILLS, type CatKey } from './CatNav';

const DEKK = {
  accent: '#C97B3A',
  accentDark: '#8B5220',
  accentLight: '#F5E6D8',
  ink: '#0E0E0E',
  muted: '#6B6B6B',
  line: '#ECECEC',
};

const CAT_LABEL: Record<string, string> = Object.fromEntries(
  CAT_PILLS.map((c) => [c.key, c.label])
);

const DB_TO_UI: Record<string, CatKey> = {
  mode: 'merch-identite',
  auto: 'voyage-mobilite',
  tech: 'tech-productivite',
  electronique: 'rc-gadgets',
  maison: 'lifestyle-deco',
  beaute: 'bien-etre',
};

const WOW_UI_CATS: CatKey[] = ['cachettes', 'rc-gadgets'];

export type DekkProduct = {
  id: string;
  name: string;
  category: string;
  stock_mode: string;
  stock_qty: number;
  price_eur: number;
  price_fcfa: number;
  image_url: string | null;
};

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
  const isWow = WOW_UI_CATS.includes(uiCat);
  const mode = (p.stock_mode || '').toLowerCase();
  const isDrop = mode === 'drop' || mode === 'commande';

  let modeBadge: { label: string; bg: string; color: string } | null = null;
  if (badge) {
    modeBadge = { label: badge, bg: DEKK.accent, color: '#fff' };
  } else if (isWow) {
    modeBadge = { label: 'Waouh', bg: DEKK.accent, color: '#fff' };
  } else if (isDrop) {
    modeBadge = { label: '10–15j', bg: '#2563EB', color: '#fff' };
  } else if (p.stock_qty > 0) {
    modeBadge = { label: 'En stock', bg: '#0E7A4F', color: '#fff' };
  } else {
    modeBadge = { label: 'Rupture', bg: '#DC2626', color: '#fff' };
  }

  return (
    <article
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        borderRadius: 12,
        border: `0.5px solid ${DEKK.line}`,
        overflow: 'hidden',
      }}
    >
      <Link
        to={`/boutique/${p.id}`}
        style={{
          position: 'relative',
          display: 'block',
          aspectRatio: '1/1',
          background: '#F6F6F6',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          overflow: 'hidden',
        }}
      >
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={p.name}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: DEKK.muted,
            }}
          >
            <Package size={32} />
          </div>
        )}

        {modeBadge && (
          <span
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              background: modeBadge.bg,
              color: modeBadge.color,
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.04em',
              padding: '3px 7px',
              borderRadius: 99,
            }}
          >
            {modeBadge.label}
          </span>
        )}

        <button
          onClick={(e) => {
            e.preventDefault();
            onWish();
          }}
          aria-label="Favori"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 26,
            height: 26,
            borderRadius: 13,
            background: '#fff',
            border: `0.5px solid ${DEKK.line}`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          <Heart
            size={14}
            fill={wished ? DEKK.accent : 'none'}
            color={wished ? DEKK.accent : DEKK.muted}
          />
        </button>
      </Link>

      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div
          style={{
            fontSize: 10,
            fontFamily: '"DM Mono", monospace',
            color: DEKK.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 3,
          }}
        >
          {catLabel}
        </div>
        <Link
          to={`/boutique/${p.id}`}
          style={{
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.3,
            color: DEKK.ink,
            textDecoration: 'none',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {p.name}
        </Link>

        <div
          style={{
            marginTop: 'auto',
            paddingTop: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 8,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: DEKK.accentDark,
                lineHeight: 1.1,
              }}
            >
              {Math.round(p.price_fcfa).toLocaleString('fr-FR')} FCFA
            </div>
            {isDrop && (
              <div
                style={{
                  fontSize: 10,
                  color: DEKK.muted,
                  fontFamily: '"DM Mono", monospace',
                  marginTop: 2,
                }}
              >
                ≈ {Math.round(p.price_fcfa / 655)} €
              </div>
            )}
          </div>
          <button
            onClick={onAdd}
            aria-label="Ajouter au panier"
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: DEKK.accent,
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              padding: 0,
            }}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
