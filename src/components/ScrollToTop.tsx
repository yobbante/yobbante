import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageview } from '@/lib/analytics';

/**
 * Auto-scrolls window to top on every route change.
 * Skips when navigating to a hash anchor (e.g. /page#section).
 * Also pushes a GTM page_view event for SPA navigation tracking.
 */
export function ScrollToTop() {
  const { pathname, hash, search } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, hash]);

  useEffect(() => {
    trackPageview(pathname + search);
  }, [pathname, search]);

  return null;
}
