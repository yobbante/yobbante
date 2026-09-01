/**
 * Catalogue des marchands supportés par « Commander en ligne » (Relais D).
 *
 * L'approche iframe est abandonnée (X-Frame-Options / CSP côté marchands) :
 * chaque site dispose d'une VITRINE INTERNE Yobbanté (catégories + recherche
 * + tendances). Toute ouverture du marchand se fait dans un nouvel onglet.
 */

export type ShopCategory = { label: string; path: string };

export type ShopSite = {
  id: string;
  name: string;
  url: string;
  accent: string;
  /** Pays de l'adresse relais Yobbanté utilisée pour ce marchand. */
  relay: 'FR' | 'US' | 'CN';
  /** Construit l'URL de résultats de recherche du marchand. */
  search: (q: string) => string;
  categories: ShopCategory[];
};

export const RELAY_LABEL: Record<string, string> = {
  FR: 'Relais Yobbanté France',
  US: 'Relais Yobbanté USA',
  CN: 'Relais Yobbanté Chine (Guangzhou)',
};

const e = encodeURIComponent;

export const SHOP_SITES: ShopSite[] = [
  {
    id: 'amazon', name: 'Amazon', url: 'https://www.amazon.fr', accent: '#FF9900', relay: 'FR',
    search: (q) => `https://www.amazon.fr/s?k=${e(q)}`,
    categories: [
      { label: 'Tech & informatique', path: 'https://www.amazon.fr/s?k=informatique' },
      { label: 'Téléphones', path: 'https://www.amazon.fr/s?k=smartphone' },
      { label: 'Maison', path: 'https://www.amazon.fr/s?k=maison+cuisine' },
      { label: 'Mode', path: 'https://www.amazon.fr/s?k=mode' },
      { label: 'Beauté', path: 'https://www.amazon.fr/s?k=beaute' },
      { label: 'Enfants & jouets', path: 'https://www.amazon.fr/s?k=jouets+enfants' },
    ],
  },
  {
    id: 'zara', name: 'Zara', url: 'https://www.zara.com/fr', accent: '#1A1A1A', relay: 'FR',
    search: (q) => `https://www.zara.com/fr/fr/search?searchTerm=${e(q)}`,
    categories: [
      { label: 'Femme', path: 'https://www.zara.com/fr/fr/femme-l1000.html' },
      { label: 'Homme', path: 'https://www.zara.com/fr/fr/homme-l1.html' },
      { label: 'Enfant', path: 'https://www.zara.com/fr/fr/enfant-l1.html' },
      { label: 'Chaussures', path: 'https://www.zara.com/fr/fr/search?searchTerm=chaussures' },
      { label: 'Sacs', path: 'https://www.zara.com/fr/fr/search?searchTerm=sac' },
    ],
  },
  {
    id: 'shein', name: 'Shein', url: 'https://fr.shein.com', accent: '#000000', relay: 'CN',
    search: (q) => `https://fr.shein.com/pdsearch/${e(q)}`,
    categories: [
      { label: 'Femme', path: 'https://fr.shein.com/pdsearch/femme' },
      { label: 'Homme', path: 'https://fr.shein.com/pdsearch/homme' },
      { label: 'Chaussures', path: 'https://fr.shein.com/pdsearch/chaussures' },
      { label: 'Maison', path: 'https://fr.shein.com/pdsearch/maison' },
      { label: 'Beauté', path: 'https://fr.shein.com/pdsearch/beaute' },
    ],
  },
  {
    id: 'nike', name: 'Nike', url: 'https://www.nike.com/fr', accent: '#111111', relay: 'US',
    search: (q) => `https://www.nike.com/fr/w?q=${e(q)}`,
    categories: [
      { label: 'Air Max', path: 'https://www.nike.com/fr/w?q=air%20max' },
      { label: 'Homme', path: 'https://www.nike.com/fr/w/homme-nik1' },
      { label: 'Femme', path: 'https://www.nike.com/fr/w/femme-5e1x6' },
      { label: 'Enfant', path: 'https://www.nike.com/fr/w/enfant-agibjek' },
      { label: 'Football', path: 'https://www.nike.com/fr/w?q=football' },
    ],
  },
  {
    id: 'alibaba', name: 'Alibaba', url: 'https://www.alibaba.com', accent: '#FF6A00', relay: 'CN',
    search: (q) => `https://www.alibaba.com/trade/search?SearchText=${e(q)}`,
    categories: [
      { label: 'Électronique', path: 'https://www.alibaba.com/trade/search?SearchText=electronics' },
      { label: 'Textile', path: 'https://www.alibaba.com/trade/search?SearchText=clothing' },
      { label: 'Machines', path: 'https://www.alibaba.com/trade/search?SearchText=machinery' },
      { label: 'Emballage', path: 'https://www.alibaba.com/trade/search?SearchText=packaging' },
      { label: 'Beauté', path: 'https://www.alibaba.com/trade/search?SearchText=beauty' },
    ],
  },
  {
    id: 'aliexpress', name: 'AliExpress', url: 'https://fr.aliexpress.com', accent: '#E62E04', relay: 'CN',
    search: (q) => `https://www.aliexpress.com/wholesale?SearchText=${e(q)}`,
    categories: [
      { label: 'Téléphones', path: 'https://www.aliexpress.com/wholesale?SearchText=smartphone' },
      { label: 'Électronique', path: 'https://www.aliexpress.com/wholesale?SearchText=electronics' },
      { label: 'Mode', path: 'https://www.aliexpress.com/wholesale?SearchText=fashion' },
      { label: 'Maison', path: 'https://www.aliexpress.com/wholesale?SearchText=home' },
      { label: 'Auto', path: 'https://www.aliexpress.com/wholesale?SearchText=car+accessories' },
    ],
  },
  {
    id: 'temu', name: 'Temu', url: 'https://www.temu.com', accent: '#FB7701', relay: 'CN',
    search: (q) => `https://www.temu.com/search_result.html?search_key=${e(q)}`,
    categories: [
      { label: 'Mode', path: 'https://www.temu.com/search_result.html?search_key=fashion' },
      { label: 'Maison', path: 'https://www.temu.com/search_result.html?search_key=home' },
      { label: 'Tech', path: 'https://www.temu.com/search_result.html?search_key=electronics' },
      { label: 'Beauté', path: 'https://www.temu.com/search_result.html?search_key=beauty' },
      { label: 'Enfants', path: 'https://www.temu.com/search_result.html?search_key=kids' },
    ],
  },
  {
    id: 'ebay', name: 'eBay', url: 'https://www.ebay.fr', accent: '#0064D2', relay: 'US',
    search: (q) => `https://www.ebay.fr/sch/i.html?_nkw=${e(q)}`,
    categories: [
      { label: 'Tech', path: 'https://www.ebay.fr/sch/i.html?_nkw=informatique' },
      { label: 'Téléphones', path: 'https://www.ebay.fr/sch/i.html?_nkw=smartphone' },
      { label: 'Mode', path: 'https://www.ebay.fr/sch/i.html?_nkw=mode' },
      { label: 'Auto & pièces', path: 'https://www.ebay.fr/sch/i.html?_nkw=pieces+auto' },
      { label: 'Collection', path: 'https://www.ebay.fr/sch/i.html?_nkw=collection' },
    ],
  },
  {
    id: 'decathlon', name: 'Decathlon', url: 'https://www.decathlon.fr', accent: '#0082C3', relay: 'FR',
    search: (q) => `https://www.decathlon.fr/search?Ntt=${e(q)}`,
    categories: [
      { label: 'Football', path: 'https://www.decathlon.fr/search?Ntt=football' },
      { label: 'Running', path: 'https://www.decathlon.fr/search?Ntt=running' },
      { label: 'Fitness', path: 'https://www.decathlon.fr/search?Ntt=fitness' },
      { label: 'Vélo', path: 'https://www.decathlon.fr/search?Ntt=velo' },
      { label: 'Camping', path: 'https://www.decathlon.fr/search?Ntt=camping' },
    ],
  },
  {
    id: 'hm', name: 'H&M', url: 'https://www2.hm.com/fr_fr', accent: '#E50010', relay: 'FR',
    search: (q) => `https://www2.hm.com/fr_fr/search-results.html?q=${e(q)}`,
    categories: [
      { label: 'Femme', path: 'https://www2.hm.com/fr_fr/femme.html' },
      { label: 'Homme', path: 'https://www2.hm.com/fr_fr/homme.html' },
      { label: 'Enfant', path: 'https://www2.hm.com/fr_fr/enfant.html' },
      { label: 'Maison', path: 'https://www2.hm.com/fr_fr/maison.html' },
      { label: 'Chaussures', path: 'https://www2.hm.com/fr_fr/search-results.html?q=chaussures' },
    ],
  },
];

export const getShopSite = (id: string) => SHOP_SITES.find((s) => s.id === id) ?? null;

/** Nom lisible du marchand déduit d'une URL collée. */
export function detectSiteFromUrl(url: string): { id: string; name: string } {
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch { return { id: 'autre', name: 'Autre site' }; }
  const hit = SHOP_SITES.find((s) => {
    const root = s.id === 'hm' ? 'hm.com' : s.id === 'aliexpress' ? 'aliexpress.com' : `${s.id}.`;
    return host.includes(root) || host.includes(`${s.id}.com`) || host.includes(`${s.id}.fr`);
  });
  if (hit) return { id: hit.id, name: hit.name };
  return { id: 'autre', name: host.replace(/^www\d?\./, '') || 'Autre site' };
}
