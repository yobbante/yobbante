import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Auto-scrolls window to top on every route change.
 * Skips when navigating to a hash anchor (e.g. /page#section).
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, hash]);

  return null;
}
