import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';

/**
 * Si l'utilisateur connecté est admin, il est verrouillé sur /admin.
 * Toute tentative d'aller ailleurs (sauf /auth) le ramène sur /admin.
 */
export function AdminOnlyGuard() {
  const { isAdmin, isLoading } = useUserRole();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading || !isAdmin) return;
    const path = location.pathname;
    if (path === '/auth') return;
    if (path === '/admin' || path.startsWith('/admin/')) return;
    navigate('/admin', { replace: true });
  }, [isAdmin, isLoading, location.pathname, navigate]);

  return null;
}
