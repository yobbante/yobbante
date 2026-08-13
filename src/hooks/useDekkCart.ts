import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
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

/** Prix unitaire en FCFA (XOF) — source de verite pour l'affichage et le tracking. */
export function fcfaOf(product: { price_fcfa?: number | null; price_eur?: number | null }): number {
  const f = Number(product?.price_fcfa ?? 0);
  if (f > 0) return Math.round(f);
  return Math.round(Number(product?.price_eur ?? 0) * 655);
}

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
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) sync(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener(EVT, sync);
    return () => {
      window.removeEventListener('storage', onStorage);
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
    const price = fcfaOf(product);
    ecommerce.addToCart(
      { id: product.id, name: product.name, category: product.category, price, quantity: qty },
      { value: price * qty, currency: 'XOF' },
    );
    toast.success('Ajouté au panier ✓', {
      description: product.name,
    });
  }, [write]);

  /** Modifie la quantité de la ligne `index` (les variantes d'un même produit sont des lignes distinctes). */
  const updateQty = useCallback((index: number, delta: number) => {
    const next = read()
      .map((i, k) => k === index ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
      .filter(i => i.qty > 0);
    write(next);
  }, [write]);

  /** Retire la ligne `index` du panier. */
  const removeItem = useCallback((index: number) => {
    write(read().filter((_, k) => k !== index));
  }, [write]);

  const clear = useCallback(() => write([]), [write]);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + fcfaOf(i.product) * i.qty, 0);

  return { items, count, total, addItem, updateQty, removeItem, clear, setItems: write };
}

/** Lightweight read-only version for chrome (header badges). */
export function useDekkCartCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const sync = () => setCount(read().reduce((s, i) => s + i.qty, 0));
    sync();
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) sync(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener(EVT, sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(EVT, sync);
    };
  }, []);
  return count;
}

