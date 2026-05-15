import { useEffect, useState, useCallback } from 'react';

/**
 * Shared wishlist (favoris) hook for Boutique Dëkk.
 * Persists in localStorage under `dekk_wishlist`, syncs across tabs and
 * components via `storage` + `dekk:wishlist` custom event.
 */
const KEY = 'dekk_wishlist';
const EVT = 'dekk:wishlist';

function read(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

function emit() { window.dispatchEvent(new Event(EVT)); }

export function useDekkWishlist() {
  const [ids, setIds] = useState<Set<string>>(() => new Set(read()));

  useEffect(() => {
    const sync = () => setIds(new Set(read()));
    window.addEventListener('storage', (e) => { if (e.key === KEY) sync(); });
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, []);

  const toggle = useCallback((id: string) => {
    const cur = new Set(read());
    cur.has(id) ? cur.delete(id) : cur.add(id);
    localStorage.setItem(KEY, JSON.stringify([...cur]));
    setIds(cur);
    emit();
  }, []);

  const has = useCallback((id: string) => ids.has(id), [ids]);

  return { ids, count: ids.size, has, toggle };
}

export function useDekkWishlistCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const sync = () => setCount(read().length);
    sync();
    window.addEventListener('storage', (e) => { if (e.key === KEY) sync(); });
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, []);
  return count;
}
