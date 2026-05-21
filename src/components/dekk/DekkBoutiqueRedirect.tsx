import { useEffect } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { DEKK_ORIGIN, isProductionMainHost } from '@/lib/dekkDomain';

/**
 * Sur la prod du site principal (yobbante.com), redirige toute URL /boutique*
 * vers le sous-domaine dédié dekk.yobbante.com (équivalent 301 côté client).
 * En dev/preview/lovable.app, on laisse passer pour pouvoir tester.
 */
export function DekkBoutiqueRedirect({ children }: { children: React.ReactNode }) {
  const loc = useLocation();

  useEffect(() => {
    if (isProductionMainHost()) {
      window.location.replace(`${DEKK_ORIGIN}${loc.pathname}${loc.search}`);
    }
  }, [loc.pathname, loc.search]);

  if (isProductionMainHost()) {
    return null;
  }
  return <>{children}</>;
}

/** Variante pour les pages panier qui devraient vivre uniquement sur le sous-domaine. */
export function DekkOnlyRoute({ children }: { children: React.ReactNode }) {
  if (isProductionMainHost()) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
