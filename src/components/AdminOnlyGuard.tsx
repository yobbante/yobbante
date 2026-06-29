import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';

/**
 * Si l'utilisateur connecté est admin, il est verrouillé sur /admin.
 * Les routes publiques restent accessibles à tout le monde (admin inclus).
 */
const PUBLIC_PATHS = [
  '/suivre',
  '/pay',
  '/gp/depart',
  '/avis',
  '/track',
  '/modifier',
  '/tarifs',
  '/boutique',
  '/panier',
  '/produit',
  '/expedier',
  '/sourcing',
  '/acheter',
  '/entreprises',
  '/devis',
  '/confidentialite',
  '/mentions-legales',
  '/cgu',
  '/cgv',
  '/cookies',
];

function isPublicPath(path: string): boolean {
  // Exact match
  if (PUBLIC_PATHS.some((p) => path === p)) return true;
  // Prefix match (e.g. /suivre/ABC123, /pay/XYZ, /gp/depart/REF)
  if (PUBLIC_PATHS.some((p) => path.startsWith(p + '/'))) return true;
  return false;
}

export function AdminOnlyGuard() {
  const { isAdmin, isLoading } = useUserRole();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading || !isAdmin) return;
    const path = location.pathname;
    const search = location.search || '';
    if (path === '/auth') return;
    if (isPublicPath(path)) return;
    if (path === '/admin' || path.startsWith('/admin/')) return;
    // CORRECTION 3 — laisser l'admin terminer un flow client en cours
    // (modal de confirmation OAuth → ?resume=1). Sans ça, le bouton
    // "Continuer avec Google" du formulaire renverrait l'admin sur /admin.
    if (search.includes('resume=1')) return;
    navigate('/admin', { replace: true });
  }, [isAdmin, isLoading, location.pathname, location.search, navigate]);

  return null;
}
