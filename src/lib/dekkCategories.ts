import { CAT_PILLS, type CatKey } from '@/components/dekk/CatNav';

/**
 * Table de correspondance catégorie base de données → clé de catégorie UI.
 * Toute catégorie absente de cette table est utilisée telle quelle
 * (les catégories récentes sont déjà nommées avec la clé UI).
 */
export const DB_TO_UI: Record<string, CatKey> = {
  mode: 'merch-identite',
  auto: 'voyage-mobilite',
  tech: 'tech-productivite',
  electronique: 'rc-gadgets',
  maison: 'lifestyle-deco',
  beaute: 'bien-etre',
  lifestyle: 'lifestyle-deco',
  pro: 'equipement-pro',
  packs: 'packs-cadeaux',
  guides: 'guides-outils-digitaux',
  merch: 'merch-identite',
  voyage: 'voyage-mobilite',
};

export const CAT_LABEL: Record<string, string> = Object.fromEntries(CAT_PILLS.map((c) => [c.key, c.label]));

/** Clé de catégorie UI d'un produit. */
export function uiCategory(dbCategory: string | null | undefined): CatKey {
  const raw = (dbCategory || '').trim();
  return (DB_TO_UI[raw] ?? raw) as CatKey;
}

/** Libellé lisible d'une catégorie (base ou UI). */
export function categoryLabel(dbCategory: string | null | undefined): string {
  const key = uiCategory(dbCategory);
  return CAT_LABEL[key] ?? (dbCategory || 'Catalogue');
}

/** Le produit appartient-il à la catégorie UI sélectionnée ? */
export function matchesCategory(dbCategory: string | null | undefined, activeKey: string): boolean {
  if (!activeKey || activeKey === 'all') return true;
  return uiCategory(dbCategory) === activeKey || (dbCategory || '') === activeKey;
}
