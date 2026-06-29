import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import logoYobbante from '@/assets/logo-yobbante.png';

interface BrandLogoProps {
  /** Taille du symbole en px (carré). Défaut 28. */
  size?: number;
  /** Affiche le wordmark à côté du symbole. Défaut true. */
  showWordmark?: boolean;
  /** Wrap dans un Link. Défaut true. */
  asLink?: boolean;
  /** Force la destination du lien. Si omis : `/app` si connecté, sinon `/`. */
  to?: string;
  className?: string;
}

/**
 * Logo officiel Yobbanté (symbole + wordmark).
 * Source unique pour la nav, le footer, les écrans d'auth, etc.
 *
 * Comportement intelligent : un utilisateur connecté est ramené vers son
 * espace `/app`, pas vers la landing publique.
 */
export function BrandLogo({ size = 28, showWordmark = true, asLink = true, to, className = '' }: BrandLogoProps) {
  const { user } = useAuth();
  const target = to ?? (user ? '/app' : '/');

  const inner = (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={logoYobbante}
        alt="Yobbanté logo"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="object-contain shrink-0"
      />
      {showWordmark && (
        <span className="text-base sm:text-lg font-bold tracking-tight text-foreground">YOBBANTÉ</span>
      )}
    </span>
  );

  if (!asLink) return inner;
  return (
    <Link to={target} aria-label="Yobbanté — accueil" className="inline-flex items-center">
      {inner}
    </Link>
  );
}
