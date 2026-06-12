import { supabase } from '@/integrations/supabase/client';

// Category mapping: spec label → DB slug (matches expanded products_category_check)
// "Cachettes" → cachettes, "Gaming" → gaming, "RC & Gadgets" → rc-gadgets,
// "Tech & productivité" → tech, "Bien-être" → bien-etre, "Lifestyle & Déco" → lifestyle,
// "Équipement pro" → pro, "Packs cadeaux" → packs
// Mode mapping: DROP → 'commande' (sourced on demand), STOCK → 'stock' (physical stock)

export type DekkSeedRow = {
  ref: string;
  nom: string;
  categorie: string;
  mode: 'DROP' | 'STOCK';
  prix_achat: number;
  prix_vente: number; // FCFA
  stock_disponible: number;
  en_vente: boolean;
  delai_drop: string | null;
  description_courte: string;
};

export const DEKK_SEED: DekkSeedRow[] = [
  // Cachettes — DROP — en_vente: true
  { ref: 'DK-C01', nom: 'Bouteille cachette secrète',  categorie: 'cachettes', mode: 'DROP', prix_achat: 3500, prix_vente: 8900,  stock_disponible: 0, en_vente: true,  delai_drop: '10–15 jours', description_courte: "Vraie bouteille d'eau avec compartiment secret indétectable." },
  { ref: 'DK-C02', nom: 'Lunettes cachette',           categorie: 'cachettes', mode: 'DROP', prix_achat: 2800, prix_vente: 7500,  stock_disponible: 0, en_vente: true,  delai_drop: '10–15 jours', description_courte: 'Lunettes ordinaires avec espace dissimulé intégré.' },
  { ref: 'DK-C03', nom: 'Canette soda cachette',       categorie: 'cachettes', mode: 'DROP', prix_achat: 2500, prix_vente: 6900,  stock_disponible: 0, en_vente: true,  delai_drop: '10–15 jours', description_courte: 'Vraie canette de soda avec fond amovible secret.' },
  { ref: 'DK-C04', nom: 'Livre creux cachette',        categorie: 'cachettes', mode: 'DROP', prix_achat: 4200, prix_vente: 10500, stock_disponible: 0, en_vente: true,  delai_drop: '10–15 jours', description_courte: 'Livre décoratif avec compartiment intérieur sécurisé.' },
  { ref: 'DK-C05', nom: 'Pierre décorative cachette',  categorie: 'cachettes', mode: 'DROP', prix_achat: 3000, prix_vente: 7900,  stock_disponible: 0, en_vente: true,  delai_drop: '10–15 jours', description_courte: 'Pierre réaliste avec compartiment étanche pour extérieur.' },
  { ref: 'DK-C06', nom: 'Spray nettoyant cachette',    categorie: 'cachettes', mode: 'DROP', prix_achat: 2800, prix_vente: 7200,  stock_disponible: 0, en_vente: true,  delai_drop: '10–15 jours', description_courte: 'Flacon de produit ménager avec fond secret amovible.' },

  // Gaming
  { ref: 'DK-G01', nom: 'Palettes PS5 DualSense custom',  categorie: 'gaming', mode: 'STOCK', prix_achat: 7500, prix_vente: 17500, stock_disponible: 0, en_vente: false, delai_drop: null,           description_courte: 'Palettes de remplacement colorées pour manette PS5.' },
  { ref: 'DK-G02', nom: 'Palettes Xbox Series custom',    categorie: 'gaming', mode: 'STOCK', prix_achat: 7000, prix_vente: 16900, stock_disponible: 0, en_vente: false, delai_drop: null,           description_courte: 'Palettes et grips de remplacement pour manette Xbox.' },
  { ref: 'DK-G03', nom: 'Station recharge manettes PS5',  categorie: 'gaming', mode: 'STOCK', prix_achat: 9000, prix_vente: 21500, stock_disponible: 0, en_vente: false, delai_drop: null,           description_courte: 'Chargeur double PS5, LED indicateurs, USB-C.' },
  { ref: 'DK-G04', nom: 'Station recharge manettes Xbox', categorie: 'gaming', mode: 'STOCK', prix_achat: 8500, prix_vente: 19900, stock_disponible: 0, en_vente: false, delai_drop: null,           description_courte: 'Chargeur double Xbox Series avec batteries rechargeables.' },
  { ref: 'DK-G05', nom: 'Support manette mural',          categorie: 'gaming', mode: 'DROP',  prix_achat: 3000, prix_vente: 7900,  stock_disponible: 0, en_vente: true,  delai_drop: '10–15 jours', description_courte: 'Support mural adhésif pour 2 manettes PS5/Xbox/Switch.' },
  { ref: 'DK-G06', nom: 'Bandeau LED TV gaming',          categorie: 'gaming', mode: 'DROP',  prix_achat: 3500, prix_vente: 8900,  stock_disponible: 0, en_vente: true,  delai_drop: '10–15 jours', description_courte: 'Ruban LED USB derrière TV, RGB, télécommande incluse.' },

  // RC & Gadgets
  { ref: 'DK-R01', nom: 'Voiture RC drift 1/24',        categorie: 'rc-gadgets', mode: 'DROP', prix_achat: 8500,  prix_vente: 19900, stock_disponible: 0, en_vente: true, delai_drop: '12–20 jours', description_courte: 'Mini voiture télécommandée drift, pneus silicone, 4WD.' },
  { ref: 'DK-R02', nom: 'Voiture RC anti-gravité murs', categorie: 'rc-gadgets', mode: 'DROP', prix_achat: 9500,  prix_vente: 22900, stock_disponible: 0, en_vente: true, delai_drop: '12–20 jours', description_courte: 'Roule sur murs et plafonds grâce aux ventouses motorisées.' },
  { ref: 'DK-R03', nom: 'Drone mini pliable',           categorie: 'rc-gadgets', mode: 'DROP', prix_achat: 12000, prix_vente: 28500, stock_disponible: 0, en_vente: true, delai_drop: '10–18 jours', description_courte: 'Drone de poche pliable, stabilisation gyro, caméra 720p.' },
  { ref: 'DK-R04', nom: 'Fidget magnétique bureau',     categorie: 'rc-gadgets', mode: 'DROP', prix_achat: 4500,  prix_vente: 11900, stock_disponible: 0, en_vente: true, delai_drop: '8–12 jours',  description_courte: 'Cube magnétique anti-stress, 216 billes néodyme, boîte métal.' },

  // Tech & productivité
  { ref: 'DK-T01', nom: 'NFC tags Google Review (pack 5)', categorie: 'tech', mode: 'STOCK', prix_achat: 4500,  prix_vente: 10900, stock_disponible: 0, en_vente: false, delai_drop: null,           description_courte: '5 tags NFC pré-programmés avis Google — parfait pour commerçants.' },
  { ref: 'DK-T02', nom: 'Écouteurs IEM filaires',          categorie: 'tech', mode: 'STOCK', prix_achat: 8000,  prix_vente: 19500, stock_disponible: 0, en_vente: false, delai_drop: null,           description_courte: 'Écouteurs intra-auriculaires haute fidélité, jack 3.5mm + USB-C.' },
  { ref: 'DK-T03', nom: 'Powerbank solaire 20 000 mAh',    categorie: 'tech', mode: 'DROP',  prix_achat: 18000, prix_vente: 42500, stock_disponible: 0, en_vente: true,  delai_drop: '10–15 jours', description_courte: 'Batterie externe solaire robuste, USB-C PD 65W, affichage LED.' },

  // Bien-être
  { ref: 'DK-B01', nom: 'Gratte-langue acier inox (pack 2)', categorie: 'bien-etre', mode: 'STOCK', prix_achat: 1500, prix_vente: 3900, stock_disponible: 0, en_vente: false, delai_drop: null, description_courte: 'Gratte-langue professionnel acier inox 316, pack de 2.' },

  // Lifestyle & Déco
  { ref: 'DK-L01', nom: 'Lampe lune 3D LED',        categorie: 'lifestyle', mode: 'DROP', prix_achat: 7500, prix_vente: 18500, stock_disponible: 0, en_vente: true, delai_drop: '10–15 jours', description_courte: 'Réplique lune en PLA, 16 couleurs, 15cm, télécommande.' },
  { ref: 'DK-L02', nom: 'Cadre photo LED néon',     categorie: 'lifestyle', mode: 'DROP', prix_achat: 9000, prix_vente: 21900, stock_disponible: 0, en_vente: true, delai_drop: '12–18 jours', description_courte: 'Cadre rétroéclairé LED chaud, format A4, bord aluminium.' },
  { ref: 'DK-L03', nom: 'Porte-clés GPS mini',      categorie: 'lifestyle', mode: 'DROP', prix_achat: 6500, prix_vente: 15900, stock_disponible: 0, en_vente: true, delai_drop: '10–15 jours', description_courte: 'Tracker GPS compact format carte SIM, autonomie 30j, app.' },
  { ref: 'DK-L04', nom: 'Organisateur câbles bureau', categorie: 'lifestyle', mode: 'DROP', prix_achat: 2800, prix_vente: 6900, stock_disponible: 0, en_vente: true, delai_drop: '8–12 jours', description_courte: 'Gestionnaire 5 câbles en silicone magnétique, clips adhésifs.' },

  // Équipement pro
  { ref: 'DK-P01', nom: 'Balance digitale portable 50kg',   categorie: 'pro', mode: 'STOCK', prix_achat: 12000, prix_vente: 28500, stock_disponible: 0, en_vente: false, delai_drop: null,           description_courte: 'Balance accrochage 50kg, précision 10g, LCD, pile incluse.' },
  { ref: 'DK-P02', nom: 'Imprimante étiquettes thermique',  categorie: 'pro', mode: 'DROP',  prix_achat: 22000, prix_vente: 52000, stock_disponible: 0, en_vente: true,  delai_drop: '10–15 jours', description_courte: 'Imprimante Bluetooth sans encre, 57mm, compatible iOS/Android.' },
  { ref: 'DK-P03', nom: 'Scanner codes-barres Bluetooth',   categorie: 'pro', mode: 'DROP',  prix_achat: 25000, prix_vente: 59000, stock_disponible: 0, en_vente: true,  delai_drop: '12–18 jours', description_courte: 'Scanner 1D/2D Bluetooth 5.0, autonomie 40h, compatible tout OS.' },

  // Packs cadeaux
  { ref: 'DK-PK01', nom: 'Pack Terrain Pro',          categorie: 'packs', mode: 'STOCK', prix_achat: 59000, prix_vente: 125000, stock_disponible: 0, en_vente: false, delai_drop: null,           description_courte: 'Balance + imprimante + scanner — kit complet pour point de collecte.' },
  { ref: 'DK-PK02', nom: 'Pack Gaming Complet',       categorie: 'packs', mode: 'STOCK', prix_achat: 19000, prix_vente: 44900,  stock_disponible: 0, en_vente: false, delai_drop: null,           description_courte: 'Palettes PS5 + station recharge + LED TV — setup gaming parfait.' },
  { ref: 'DK-PK03', nom: 'Pack Cachettes — les 6',    categorie: 'packs', mode: 'DROP',  prix_achat: 16800, prix_vente: 42000,  stock_disponible: 0, en_vente: true,  delai_drop: '15–20 jours', description_courte: 'Collection complète : bouteille + lunettes + canette + livre + pierre + spray.' },
];

const FCFA_PER_EUR = 655;

export async function runDekkSeed(): Promise<{ ok: number; errors: { ref: string; error: string }[] }> {
  const errors: { ref: string; error: string }[] = [];
  let ok = 0;

  // Fetch existing rows by ref in one query
  const refs = DEKK_SEED.map(r => r.ref);
  const { data: existing, error: fetchErr } = await supabase
    .from('products' as any)
    .select('id, ref')
    .in('ref', refs);
  if (fetchErr) {
    return { ok: 0, errors: DEKK_SEED.map(r => ({ ref: r.ref, error: fetchErr.message })) };
  }
  const byRef = new Map<string, string>();
  ((existing as any[]) || []).forEach(row => { if (row.ref) byRef.set(row.ref, row.id); });

  for (const r of DEKK_SEED) {
    const price_eur = Math.max(1, Math.round(r.prix_vente / FCFA_PER_EUR));
    const payload: any = {
      ref: r.ref,
      name: r.nom,
      description: r.description_courte,
      category: r.categorie,
      price_eur,
      price_fcfa: r.prix_vente,
      origin_country: 'CN',
      stock_mode: r.mode === 'DROP' ? 'commande' : 'stock',
      stock_qty: r.stock_disponible,
      delivery_days: r.mode === 'DROP' ? 12 : null,
      delai_drop: r.delai_drop,
      prix_achat: r.prix_achat,
      en_vente: r.en_vente,
      status: 'published',
      image_url: '',
      source_type: 'manual',
      verified: true,
    };

    const existingId = byRef.get(r.ref);
    const { error } = existingId
      ? await supabase.from('products' as any).update(payload).eq('id', existingId)
      : await supabase.from('products' as any).insert(payload);

    if (error) errors.push({ ref: r.ref, error: error.message });
    else ok++;
  }

  return { ok, errors };
}

