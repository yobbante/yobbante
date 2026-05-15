import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Search, ShoppingCart, Heart } from 'lucide-react';
import { useDekkCartCount } from '@/hooks/useDekkCart';
import { useDekkWishlistCount } from '@/hooks/useDekkWishlist';

export interface DekkHeaderProps {
  title?: string;
  /** Where the back arrow goes. Defaults to /boutique on inner pages, / on the boutique root. */
  backTo?: string;
  /** Custom search handler (e.g. focus the on-page input). If omitted, navigates to /boutique. */
  onSearch?: () => void;
  /** Custom wishlist handler. If omitted, navigates to /boutique?wishlist=1. */
  onWishlist?: () => void;
  /** Whether the header should stick to the top of the viewport. */
  sticky?: boolean;
}

/**
 * Sticky black header used across all Boutique Dëkk pages.
 * Layout: ← Back · Title · 🔍 🛒(badge) ♡(badge)
 */
export function DekkHeader({
  title = 'Boutique Dëkk',
  backTo,
  onSearch,
  onWishlist,
  sticky = true,
}: DekkHeaderProps) {
  const nav = useNavigate();
  const loc = useLocation();
  const cartCount = useDekkCartCount();
  const wishCount = useDekkWishlistCount();

  const fallbackBack = loc.pathname === '/boutique' || loc.pathname === '/dekk' ? '/' : '/boutique';
  const back = backTo ?? fallbackBack;

  const handleSearch = () => {
    if (onSearch) onSearch();
    else nav('/boutique');
  };
  const handleWishlist = () => {
    if (onWishlist) onWishlist();
    else nav('/boutique?wishlist=1');
  };

  const Badge = ({ n, color = 'hsl(var(--primary))' }: { n: number; color?: string }) => (
    <span
      aria-label={`${n}`}
      style={{
        position: 'absolute', top: -4, right: -6,
        minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999,
        background: color, color: '#fff',
        fontSize: 9, fontWeight: 700, lineHeight: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >{n > 99 ? '99+' : n}</span>
  );

  return (
    <div
      style={{
        position: sticky ? 'sticky' : 'static',
        top: 0, zIndex: 50,
        height: 52, padding: '0 16px',
        background: '#0A0A0A',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}
    >
      <Link to={back} aria-label="Retour" style={{ color: '#fff', display: 'inline-flex', alignItems: 'center' }}>
        <ChevronLeft size={22} />
      </Link>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button type="button" onClick={handleSearch} aria-label="Rechercher"
          style={{ background: 'transparent', border: 'none', padding: 0, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'inline-flex' }}>
          <Search size={20} />
        </button>
        <button type="button" onClick={() => nav('/boutique/panier')} aria-label="Voir le panier"
          style={{ position: 'relative', background: 'transparent', border: 'none', padding: 0, color: '#fff', cursor: 'pointer', display: 'inline-flex' }}>
          <ShoppingCart size={20} />
          <Badge n={cartCount} />
        </button>
        <button type="button" onClick={handleWishlist} aria-label="Favoris"
          style={{ position: 'relative', background: 'transparent', border: 'none', padding: 0, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'inline-flex' }}>
          <Heart size={20} fill={wishCount > 0 ? '#fff' : 'none'} />
          {wishCount > 0 && <Badge n={wishCount} color="#C97B3A" />}
        </button>
      </div>
    </div>
  );
}
