import { useEffect, useState, useCallback } from 'react';
import { ecommerce } from '@/lib/analytics';

/**
 * Shared cart hook for Boutique Dëkk.
 * Persists in localStorage under `dekk_cart`, syncs across tabs (`storage`)
 * and across components within the same tab (custom `dekk:cart` event).
 */
export type DekkCartItem = {
  product: { id: string; name?: string; price_eur?: number; image_url?: string | null; [k: string]: any };
  qty: number;
  size?: string | null;
  color?: string | null;
};

const KEY = 'dekk_cart';
const EVT = 'dekk:cart';

function read(): DekkCartItem[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

function emit() {
  window.dispatchEvent(new Event(EVT));
}

export function useDekkCart() {
  const [items, setItems] = useState<DekkCartItem[]>(() => read());

  useEffect(() => {
    const sync = () => setItems(read());
    window.addEventListener('storage', (e) => { if (e.key === KEY) sync(); });
    window.addEventListener(EVT, sync);
    return () => {
      window.removeEventListener(EVT, sync);
    };
  }, []);

  const write = useCallback((next: DekkCartItem[]) => {
    localStorage.setItem(KEY, JSON.stringify(next));
    setItems(next);
    emit();
  }, []);

  const addItem = useCallback((product: DekkCartItem['product'], qty = 1, opts: { size?: string | null; color?: string | null } = {}) => {
    const cur = read();
    const existing = cur.find(i => i.product.id === product.id && i.size === (opts.size ?? null) && i.color === (opts.color ?? null));
    let next: DekkCartItem[];
    if (existing) {
      next = cur.map(i => i === existing ? { ...i, qty: i.qty + qty } : i);
    } else {
      next = [...cur, { product, qty, size: opts.size ?? null, color: opts.color ?? null }];
    }
    write(next);
    const price = Number(product.price_eur ?? 0);
    ecommerce.addToCart(
      { id: product.id, name: product.name, category: product.category, price, quantity: qty },
      { value: price * qty, currency: 'EUR' },
    );
  }, [write]);

  const updateQty = useCallback((id: string, delta: number) => {
    const next = read()
      .map(i => i.product.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
      .filter(i => i.qty > 0);
    write(next);
  }, [write]);

  const removeItem = useCallback((id: string) => {
    write(read().filter(i => i.product.id !== id));
  }, [write]);

  const clear = useCallback(() => write([]), [write]);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + (i.product.price_eur ?? 0) * i.qty, 0);

  return { items, count, total, addItem, updateQty, removeItem, clear, setItems: write };
}

/** Lightweight read-only version for chrome (header badges). */
export function useDekkCartCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const sync = () => setCount(read().reduce((s, i) => s + i.qty, 0));
    sync();
    window.addEventListener('storage', (e) => { if (e.key === KEY) sync(); });
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, []);
  return count;
}
