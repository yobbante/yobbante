import {
  Plane, Ship, Truck, Zap, Clock, Boxes, Smartphone, Banknote,
} from 'lucide-react';

// ─────────────────────────── Static config (SendFlow) ───────────────────────────

export type SenderKind = 'individual' | 'business';

export const TIME_SLOTS = [
  { id: 'morning'   as const, label: 'Matin · 8h-12h',       desc: 'Récupération matinale' },
  { id: 'afternoon' as const, label: 'Après-midi · 13h-18h', desc: 'Récupération après-midi' },
];

export const GOODS_TYPES = [
  { id: 'standard'    as const, label: 'Standard',         desc: 'Articles courants',                    risk: 'low'    },
  { id: 'electronics' as const, label: 'Électronique',     desc: 'Téléphone, ordinateur, accessoires',   risk: 'medium' },
  { id: 'fragile'     as const, label: 'Fragile',          desc: 'Emballage renforcé recommandé',        risk: 'medium' },
  { id: 'fashion'     as const, label: 'Textile / Mode',   desc: 'Déclaration valeur obligatoire',       risk: 'low'    },
  { id: 'cosmetics'   as const, label: 'Cosmétiques',      desc: 'Vérification douanière requise',       risk: 'high'   },
  { id: 'food'        as const, label: 'Alimentation',     desc: 'Restrictions selon corridor',          risk: 'high'   },
  { id: 'high_value'  as const, label: 'Forte valeur',     desc: 'Assurance obligatoire dès 500 €',      risk: 'high'   },
  { id: 'documents'   as const, label: 'Documents',        desc: 'Traitement prioritaire possible',      risk: 'low'    },
  { id: 'auto_parts'  as const, label: 'Pièces auto',      desc: 'Maritime recommandé',                  risk: 'medium' },
];
export type GoodsId = typeof GOODS_TYPES[number]['id'];

export const TRANSPORT_MODES = [
  { id: 'AIR'  as const, label: 'Aérien',   eta: '3-7 jours',    icon: <Plane className="w-4 h-4" /> },
  { id: 'SEA'  as const, label: 'Maritime', eta: '18-25 jours',  icon: <Ship  className="w-4 h-4" /> },
  { id: 'ROAD' as const, label: 'Routier',  eta: '7-14 jours',   icon: <Truck className="w-4 h-4" /> },
];

export const PRIORITIES = [
  { id: 'normal'  as const, label: 'Standard', desc: 'Inclus · Traitement 3-5j' },
  { id: 'express' as const, label: 'Express',  desc: '+4 000 FCFA · Traitement sous 24h' },
];

export const PAYMENT_METHODS = [
  { id: 'wave',         label: 'Wave',         sub: 'Instantané',    icon: <Smartphone className="w-4 h-4" /> },
  { id: 'orange_money', label: 'Orange Money', sub: 'Instantané',    icon: <Smartphone className="w-4 h-4" /> },
  { id: 'cash',         label: 'Espèces',      sub: 'À la collecte', icon: <Banknote   className="w-4 h-4" /> },
];

export const OPTION_ICONS = {
  fast:    <Zap   className="w-4 h-4" />,
  economy: <Clock className="w-4 h-4" />,
  volume:  <Boxes className="w-4 h-4" />,
} as const;

export const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

/** Sensitive corridor combinations → trigger contextual warning. */
export function corridorRisk(
  goods: GoodsId | null,
  originCountry?: string,
  destCountry?: string,
): string | null {
  if (!goods || !originCountry || !destCountry) return null;
  if (goods === 'cosmetics')  return `Les cosmétiques vers ${destCountry} nécessitent une déclaration spécifique. Notre équipe vous contacte sous 2 h pour confirmer.`;
  if (goods === 'food')       return `L'alimentaire vers ${destCountry} est soumis à des restrictions. Vérification opérée avant collecte.`;
  if (goods === 'high_value') return `Forte valeur — assurance obligatoire et signature à la livraison.`;
  return null;
}
