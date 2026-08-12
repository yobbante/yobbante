/**
 * Dëkk — jetons visuels de la boutique premium.
 * Fond crème, texte noir, or Yobbanté comme unique accent de marque.
 */
export const DEKK = {
  /** Fond principal crème */
  cream: '#F7F4EF',
  /** Fond de surface (cartes, header) */
  surface: '#FFFFFF',
  /** Fond alternatif légèrement plus chaud */
  creamDeep: '#EFEAE1',
  /** Texte principal */
  ink: '#141210',
  /** Texte secondaire */
  muted: '#6E675E',
  /** Filets */
  line: '#E2DBD0',
  /** Or Yobbanté — accent unique */
  gold: '#B8873B',
  goldDark: '#8E661F',
  goldSoft: '#F3E9D7',
} as const;

export const SERIF = '"Cormorant Garamond", "Playfair Display", Georgia, serif';
export const SANS = '"DM Sans", -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif';
export const MONO = '"DM Mono", "SF Mono", ui-monospace, monospace';

export const fmtFcfa = (n: number) =>
  `${Math.round(n || 0).toLocaleString('fr-FR')} FCFA`;

/** Ouvre le tiroir panier depuis n'importe quel composant Dëkk. */
export const openDekkCart = () => window.dispatchEvent(new Event('dekk:cart-open'));
