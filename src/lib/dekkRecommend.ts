// Dëkk recommendation engine — category + recently viewed signal.
// Returns up to N relevant products excluding the current one.

import { supabase } from '@/integrations/supabase/client';

export type RecProduct = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price_eur: number;
  price_fcfa: number;
  origin_country: string;
  stock_mode: string;
  delivery_days: number | null;
  status: string;
  image_url: string;
  verified?: boolean;
  created_at: string;
};

const RV_KEY = 'dekk_recently_viewed';
const RV_MAX = 12;

export function trackView(productId: string, category: string) {
  try {
    const raw = JSON.parse(localStorage.getItem(RV_KEY) || '[]') as Array<{ id: string; cat: string; t: number }>;
    const next = [{ id: productId, cat: category, t: Date.now() }, ...raw.filter(r => r.id !== productId)].slice(0, RV_MAX);
    localStorage.setItem(RV_KEY, JSON.stringify(next));
  } catch {}
}

export function getRecentCategories(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RV_KEY) || '[]') as Array<{ cat: string }>;
    const counts = new Map<string, number>();
    raw.forEach(r => counts.set(r.cat, (counts.get(r.cat) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  } catch { return []; }
}

function getCartCategories(): string[] {
  try {
    const cart = JSON.parse(localStorage.getItem('dekk_cart') || '[]') as Array<{ product: { category: string } }>;
    return [...new Set(cart.map(i => i.product.category))];
  } catch { return []; }
}

/**
 * Returns up to `limit` recommended products.
 * Score: same category +5, recently viewed category +3, in cart category +2, verified +1.
 */
export async function recommend(opts: {
  excludeIds?: string[];
  primaryCategory?: string;
  limit?: number;
} = {}): Promise<RecProduct[]> {
  const { excludeIds = [], primaryCategory, limit = 4 } = opts;
  const recentCats = getRecentCategories();
  const cartCats = getCartCategories();
  const interestCats = new Set<string>([
    ...(primaryCategory ? [primaryCategory] : []),
    ...recentCats.slice(0, 3),
    ...cartCats,
  ]);

  let query = supabase
    .from('products' as any)
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(40);

  if (excludeIds.length) {
    query = query.not('id', 'in', `(${excludeIds.map(id => `"${id}"`).join(',')})`);
  }

  const { data } = await query;
  const list = (data as any as RecProduct[]) || [];

  const scored = list.map(p => {
    let s = 0;
    if (primaryCategory && p.category === primaryCategory) s += 5;
    if (recentCats.slice(0, 3).includes(p.category)) s += 3;
    if (cartCats.includes(p.category)) s += 2;
    if (p.verified) s += 1;
    // Tiny freshness bonus
    const ageDays = (Date.now() - +new Date(p.created_at)) / 86400000;
    s += Math.max(0, 1 - ageDays / 60);
    return { p, s };
  });

  scored.sort((a, b) => b.s - a.s);

  // If no signal at all, just return latest verified-first
  if (interestCats.size === 0) {
    return list.sort((a, b) => Number(!!b.verified) - Number(!!a.verified)).slice(0, limit);
  }

  return scored.slice(0, limit).map(s => s.p);
}
