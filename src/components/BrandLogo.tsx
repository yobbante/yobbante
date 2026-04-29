import { Link } from 'react-router-dom';
import logoYobbante from '@/assets/logo-yobbante.png';

interface BrandLogoProps {
  /** Taille du symbole en px (carré). Défaut 28. */
  size?: number;
  /** Affiche le wordmark à côté du symbole. Défaut true. */
  showWordmark?: boolean;
  /** Wrap dans un Link vers "/". Défaut true. */
  asLink?: boolean;
  className?: string;
}

/**
 * Logo officiel Yobbanté (symbole + wordmark).
 * Source unique pour la nav, le footer, les écrans d'auth, etc.
 */
export function BrandLogo({ size = 28, showWordmark = true, asLink = true, className = '' }: BrandLogoProps) {
  const inner = (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={logoYobbante}
        alt="Yobbanté"
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
    <Link to="/" aria-label="Yobbanté — accueil" className="inline-flex items-center">
      {inner}
    </Link>
  );
}
