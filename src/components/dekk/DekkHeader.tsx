import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Heart, User } from 'lucide-react';
import { useDekkCartCount } from '@/hooks/useDekkCart';

export interface DekkHeaderProps {
  /** Current search value (controlled). */
  searchValue?: string;
  /** Called when the search input changes. */
  onSearchChange?: (value: string) => void;
  /** Called when the heart / wishlist icon is clicked. */
  onWishlist?: () => void;
  /** Whether the whole header (banner + bar) should stick to the top. */
  sticky?: boolean;
}

/**
 * Dëkk boutique header.
 * 1. Delivery banner
 * 2. Main bar: wordmark | search | icons
 * 3. 0.5px bottom separator
 */
export function DekkHeader({
  searchValue = '',
  onSearchChange,
  onWishlist,
  sticky = true,
}: DekkHeaderProps) {
  const nav = useNavigate();
  const cartCount = useDekkCartCount();

  const handleSearch = (v: string) => {
    onSearchChange?.(v);
  };

  return (
    <header
      style={{
        position: sticky ? 'sticky' : 'static',
        top: 0,
        zIndex: 50,
        background: '#fff',
        borderBottom: '0.5px solid hsl(var(--color-border-tertiary))',
      }}
    >
      {/* ── Delivery banner ───────────────────────────── */}
      <div
        style={{
          width: '100%',
          background: '#FBF3EC',
          borderBottom: '1px solid #F5E6D8',
          padding: '7px 16px',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: '#8B5220',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, sans-serif',
          }}
        >
          🚚 Livraison gratuite à partir de 25 000 FCFA · Dakar J+1 · Régions J+3
        </span>
      </div>

      {/* ── Main bar ──────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '10px 16px',
          height: 60,
        }}
      >
        {/* Left — wordmark */}
        <Link
          to="/boutique"
          style={{
            textDecoration: 'none',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: '#C97B3A',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, sans-serif',
            }}
          >
            DËKK
          </span>
          <span
            style={{
              fontSize: 11,
              fontFamily:
                '"SF Mono", "DM Mono", "Fira Code", ui-monospace, monospace',
              color: 'hsl(var(--text-tertiary))',
              lineHeight: 1.2,
            }}
          >
            by Yobbanté · Le monde, livré ici.
          </span>
        </Link>

        {/* Center — search */}
        <div
          style={{
            flex: 1,
            maxWidth: 340,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'hsl(var(--text-tertiary))',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Chercher un produit..."
            style={{
              width: '100%',
              height: 40,
              padding: '0 12px 0 36px',
              fontSize: 14,
              borderRadius: 8,
              border: '0.5px solid hsl(var(--color-border-tertiary))',
              background: '#F5F5F5',
              color: 'hsl(var(--foreground))',
              outline: 'none',
              transition: 'border-color 150ms ease',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, sans-serif',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#C97B3A';
              e.currentTarget.style.background = '#fff';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'hsl(var(--color-border-tertiary))';
              e.currentTarget.style.background = '#F5F5F5';
            }}
          />
        </div>

        {/* Right — icons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onWishlist}
            aria-label="Favoris"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 4,
              color: '#141414',
              cursor: 'pointer',
              display: 'inline-flex',
            }}
          >
            <Heart size={22} />
          </button>

          <button
            type="button"
            onClick={() => nav('/panier')}
            aria-label="Voir le panier"
            style={{
              position: 'relative',
              background: 'transparent',
              border: 'none',
              padding: 4,
              color: '#141414',
              cursor: 'pointer',
              display: 'inline-flex',
            }}
          >
            <ShoppingCart size={22} />
            {cartCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -4,
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 999,
                  background: '#C97B3A',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => nav('/auth')}
            aria-label="Compte"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 4,
              color: '#141414',
              cursor: 'pointer',
              display: 'inline-flex',
            }}
          >
            <User size={22} />
          </button>
        </div>
      </div>
    </header>
  );
}
